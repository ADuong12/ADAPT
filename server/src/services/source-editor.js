const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const officeparser = require("officeparser");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const pptxgenjs = require("pptxgenjs");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const db = require("../db");
const { resolveProvider } = require("./adaptation");
const { retrieveForLesson } = require("./rag/retriever");

const ALLOWED_EXTENSIONS = new Set([".docx", ".pptx", ".pdf"]);
const EDIT_DIR = path.resolve(__dirname, "..", "..", "..", "uploads", "lesson_edits");
fs.mkdirSync(EDIT_DIR, { recursive: true });

function safeFilename(name) {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+|[._]+$/g, "");
  return cleaned || "lesson_edit";
}

function resolveSourcePath(sourcePath) {
  const base = path.resolve(__dirname, "..", "..", "..", "Sample Lessons");
  const candidate = path.resolve(base, sourcePath);
  if (!candidate.startsWith(base)) throw new Error("source file must be inside Sample Lessons");
  if (!fs.existsSync(candidate)) throw new Error("source file not found");
  const ext = path.extname(candidate).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error("unsupported file type");
  return candidate;
}

async function extractDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value.split('\n').filter(line => line.trim());
}

async function extractPptx(filePath) {
  return new Promise((resolve, reject) => {
    try {
      officeparser.parseOffice(filePath, (result) => {
        if (!result || typeof result.toText !== 'function') {
          return reject(new Error('PPTX extraction failed'));
        }
        resolve(result.toText().split('\n').filter(line => line.trim()));
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function extractPdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text.split('\n').filter(line => line.trim());
}

function splitTextForLengths(text, lengths) {
  if (!lengths || lengths.length === 0) return [];
  const parts = [];
  let pos = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (i === lengths.length - 1) {
      parts.push(text.slice(pos));
    } else {
      parts.push(text.slice(pos, pos + lengths[i]));
      pos += lengths[i];
    }
  }
  return parts;
}

function chunks(items, maxChars = 7000) {
  const result = [];
  let chunk = [];
  let size = 0;
  for (const [id, text] of items) {
    const itemSize = text.length;
    if (chunk.length > 0 && size + itemSize > maxChars) {
      result.push(chunk);
      chunk = [];
      size = 0;
    }
    chunk.push([id, text]);
    size += itemSize;
  }
  if (chunk.length > 0) result.push(chunk);
  return result;
}

const JSON_FENCE = /```(?:json)?\s*(\{.*?\})\s*```/s;

function parseItems(text) {
  let candidate = text.trim();
  const match = JSON_FENCE.exec(candidate);
  if (match) {
    candidate = match[1];
  } else {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first !== -1 && last !== -1) {
      candidate = candidate.slice(first, last + 1);
    }
  }
  const data = JSON.parse(candidate);
  const result = {};
  for (const item of data.items || []) {
    result[Number(item.id)] = String(item.text);
  }
  return result;
}

async function rewriteTexts({ teacherId, lesson, sourceFilename, instruction, texts, clusterId, kbIds }) {
  const provider = resolveProvider(teacherId);
  const indexed = texts.map((text, i) => [i, text]);
  const rewritten = [...texts];
  let lastResult = null;

  let kbContext = "";
  if (kbIds && kbIds.length > 0) {
    const kbRows = db.prepare(
      "SELECT kb_id, kb_name, category FROM knowledge_base WHERE kb_id IN (" + kbIds.map(() => "?").join(",") + ")"
    ).all(...kbIds);
    const specs = kbRows.map(r => ({ kb_id: r.kb_id, kb_name: r.kb_name, category: r.category }));
    const query = [lesson.title, lesson.cs_topic, lesson.objectives].filter(Boolean).join(" ");
    const retrievedChunks = await retrieveForLesson(query, specs, 2);
    const lines = [];
    for (const c of retrievedChunks) {
      lines.push(`[KB #${c.kb_id} ${c.kb_name} - ${c.section_title}]\n${c.text}`);
    }
    kbContext = lines.join("\n\n");
  }

  const system = (
    "You edit teacher lesson source files. Preserve meaning, classroom usefulness, numbering, " +
    "placeholders, URLs, hyperlink labels, and references unless the teacher explicitly asks to change them. " +
    "Follow the teacher instruction. Return JSON only."
  );

  for (const batch of chunks(indexed)) {
    const user = JSON.stringify({
      lesson: {
        title: lesson.title,
        grade_level: lesson.grade_level,
        cs_topic: lesson.cs_topic,
        objectives: lesson.objectives,
      },
      source_file: sourceFilename,
      teacher_instruction: instruction,
      rag_context: kbContext,
      items: batch.map(([id, text]) => ({ id, text })),
      required_output: {
        items: [
          { id: "same numeric id from input", text: "edited replacement text only; do not add explanations" },
        ],
      },
    });

    const result = await provider.generate({ system, user, maxTokens: 8192 });
    lastResult = result;

    try {
      const parsed = parseItems(result.text);
      for (const [itemId, newText] of Object.entries(parsed)) {
        const idx = Number(itemId);
        if (idx >= 0 && idx < rewritten.length && newText.trim()) {
          rewritten[idx] = newText.trim();
        }
      }
    } catch (e) {
      throw new Error("LLM returned an unreadable file-edit response");
    }
  }

  if (!lastResult) throw new Error("source file did not contain editable text");
  return { rewritten, result: lastResult };
}

async function writeDocx(outPath, blocks) {
  const doc = new Document({
    sections: [{
      children: blocks.map(text => new Paragraph({
        children: [new TextRun(text)],
      })),
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
}

async function writePptx(outPath, blocks) {
  const pres = new pptxgenjs();
  let slide = pres.addSlide();
  let y = 0.5;
  for (const text of blocks) {
    if (y > 6.5) {
      slide = pres.addSlide();
      y = 0.5;
    }
    slide.addText(text, { x: 0.5, y, w: 9, h: 0.5, fontSize: 14 });
    y += 0.6;
  }
  await pres.writeFile({ fileName: outPath });
}

async function writePdf(outPath, title, blocks) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([612, 792]); // Letter size
  const { height } = page.getSize();
  let y = height - 72;

  page.drawText(title, { x: 72, y, font: titleFont, size: 18, color: rgb(0, 0, 0) });
  y -= 36;

  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (y < 72) {
        page = pdfDoc.addPage([612, 792]);
        y = height - 72;
      }
      page.drawText(line.trim(), { x: 72, y, font, size: 11, color: rgb(0, 0, 0) });
      y -= 16;
    }
    y -= 8;
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outPath, pdfBytes);
}

async function editSourceFile({ teacherId, lessonId, sourcePath, instruction, clusterId, kbIds }) {
  const lesson = db.prepare("SELECT * FROM lesson WHERE lesson_id = ?").get(lessonId);
  if (!lesson) throw new Error("lesson not found");

  const source = resolveSourcePath(sourcePath);
  const suffix = path.extname(source).toLowerCase();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const baseName = path.basename(source, suffix);
  const outName = safeFilename(`${baseName}_ai_edit_${stamp}${suffix}`);
  const outPath = path.join(EDIT_DIR, outName);

  let texts;
  if (suffix === ".docx") {
    texts = await extractDocx(source);
  } else if (suffix === ".pptx") {
    texts = await extractPptx(source);
  } else if (suffix === ".pdf") {
    texts = await extractPdf(source);
  } else {
    throw new Error("unsupported source file type");
  }

  const { rewritten } = await rewriteTexts({
    teacherId, lesson, sourceFilename: path.basename(source),
    instruction, texts, clusterId, kbIds,
  });

  if (suffix === ".docx") {
    await writeDocx(outPath, rewritten);
  } else if (suffix === ".pptx") {
    await writePptx(outPath, rewritten);
  } else if (suffix === ".pdf") {
    await writePdf(outPath, `${lesson.title} - AI Edited Copy`, rewritten);
  }

  return {
    filename: outName,
    file_type: suffix.slice(1),
    download_url: `/api/lesson-file-edits/${outName}`,
    note: "Original source file was not changed. Edited copies are regenerated with extracted text — original formatting may not be preserved.",
  };
}

function editedFilePath(filename) {
  const safe = path.basename(filename);
  const filePath = path.resolve(EDIT_DIR, safe);
  if (!filePath.startsWith(EDIT_DIR)) throw new Error("invalid filename");
  if (!fs.existsSync(filePath)) throw new Error("edited file not found");
  return filePath;
}

function sourceFilesForLesson(lesson) {
  const lessonTokens = new Set(
    lesson.title.toLowerCase().match(/[a-z0-9]+/g)?.filter(t => t.length > 2) || []
  );
  const base = path.resolve(__dirname, "..", "..", "..", "Sample Lessons");
  if (!fs.existsSync(base)) return [];

  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const rel = path.relative(base, fullPath);
        const relTokens = new Set(
          rel.toLowerCase().match(/[a-z0-9]+/g)?.filter(t => t.length > 2) || []
        );
        const score = [...lessonTokens].filter(t => relTokens.has(t)).length;
        if (score > 0) {
          files.push({
            source_path: rel.replace(/\\/g, "/"),
            filename: entry.name,
            file_type: path.extname(entry.name).slice(1),
            size_bytes: fs.statSync(fullPath).size,
          });
        }
      }
    }
  };
  walk(base);
  files.sort((a, b) => b.filename.localeCompare(a.filename));
  return files;
}

module.exports = { editSourceFile, editedFilePath, sourceFilesForLesson };
