const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const officeparser = require("officeparser");
const { Document, Packer, Paragraph, TextRun, ExternalHyperlink, ImageRun } = require("docx");
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

async function extractDocxSegments(filePath) {
  const result = await mammoth.convertToHtml({ path: filePath }, {
    convertImage: mammoth.images.dataUri,
  });
  return parseDocxHtml(result.value);
}

function parseDocxHtml(html) {
  const segments = [];
  html = html.replace(/<html[^>]*>|<\/html>|<body[^>]*>|<\/body>/gi, "");
  html = html.replace(/<br\s*\/?>/gi, "\n");

  // Strip table wrappers but keep cell content (Word often uses tables for layout)
  html = html.replace(/<\/?(table|thead|tbody|tfoot|tr)[^>]*>/gi, "");
  html = html.replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi, "$1");

  const regex = /<(p|h[1-6]|li)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    let content = match[2];

    if (tag === "li") {
      content = "• " + content;
    }

    // Split content by inline images
    const parts = [];
    const imgRegex = /(<img[^>]+src="([^"]+)"[^>]*>)/gi;
    let lastIndex = 0;
    let imgMatch;

    while ((imgMatch = imgRegex.exec(content)) !== null) {
      if (imgMatch.index > lastIndex) {
        const text = htmlToMarkdownText(content.slice(lastIndex, imgMatch.index));
        if (text.trim()) {
          parts.push({ type: "text", content: text.trim() });
        }
      }
      const src = imgMatch[2];
      if (src.startsWith("data:")) {
        const parsed = parseInlineImage(src);
        if (parsed) parts.push({ type: "image", mimeType: parsed.mimeType, base64: parsed.base64, imageType: parsed.type });
      }
      lastIndex = imgRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      const text = htmlToMarkdownText(content.slice(lastIndex));
      if (text.trim()) {
        parts.push({ type: "text", content: text.trim() });
      }
    }

    if (parts.length === 0) {
      const text = htmlToMarkdownText(content);
      if (text.trim()) {
        parts.push({ type: "text", content: text.trim() });
      }
    }

    segments.push(...parts);
  }

  return segments;
}

function htmlToMarkdownText(html) {
  let text = html.replace(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, url, linkText) => {
    const cleanLinkText = linkText.replace(/<[^>]+>/g, "").trim();
    return `[${cleanLinkText}](${url})`;
  });
  text = text.replace(/<[^>]+>/g, "");
  text = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
  return text;
}

function parseInlineImage(src) {
  const match = src.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64 = match[2];
  let type = null;
  if (mimeType === "image/png") type = "png";
  else if (mimeType === "image/jpeg" || mimeType === "image/jpg") type = "jpg";
  else if (mimeType === "image/gif") type = "gif";
  else if (mimeType === "image/bmp") type = "bmp";
  else return null;
  return { mimeType, base64, type };
}

function getImageDimensions(buffer) {
  if (buffer.length > 24 && buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i < buffer.length) {
      if (buffer[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buffer[i + 1];
      if (marker === 0xd9) break;
      if (marker === 0xd8) {
        i += 2;
        continue;
      }
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buffer.readUInt16BE(i + 5);
        const width = buffer.readUInt16BE(i + 7);
        return { width, height };
      }
      const len = buffer.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }
  if (buffer.length > 10 && buffer.toString("ascii", 0, 6) === "GIF89a") {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    return { width, height };
  }
  return null;
}

function scaleDimensions(width, height, maxDim = 500) {
  if (!width || !height) return { width: 400, height: 300 };
  const ratio = Math.min(maxDim / width, maxDim / height);
  if (ratio < 1) {
    return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
  }
  return { width, height };
}

function textToDocxRuns(text) {
  const runs = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun(text.slice(lastIndex, match.index)));
    }
    runs.push(
      new ExternalHyperlink({
        children: [new TextRun({ text: match[1], style: "Hyperlink" })],
        link: match[2],
      })
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun(text.slice(lastIndex)));
  }

  if (runs.length === 0) {
    runs.push(new TextRun(text));
  }

  return runs;
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

async function writeDocx(outPath, segments) {
  const children = [];

  for (const seg of segments) {
    if (seg.type === "text") {
      const runs = textToDocxRuns(seg.content);
      children.push(new Paragraph({ children: runs }));
    } else if (seg.type === "image") {
      const buffer = Buffer.from(seg.base64, "base64");
      const dims = getImageDimensions(buffer);
      const scaled = scaleDimensions(dims?.width, dims?.height);
      const imageRun = new ImageRun({
        type: seg.imageType,
        data: buffer,
        transformation: scaled,
      });
      children.push(new Paragraph({ children: [imageRun] }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
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
  let docxSegments = null;

  if (suffix === ".docx") {
    docxSegments = await extractDocxSegments(source);
    texts = docxSegments.filter((s) => s.type === "text").map((s) => s.content);
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
    const textSegments = docxSegments.filter((s) => s.type === "text");
    for (let i = 0; i < textSegments.length && i < rewritten.length; i++) {
      textSegments[i].content = rewritten[i].trim();
    }
    await writeDocx(outPath, docxSegments);
  } else if (suffix === ".pptx") {
    await writePptx(outPath, rewritten);
  } else if (suffix === ".pdf") {
    await writePdf(outPath, `${lesson.title} - AI Edited Copy`, rewritten);
  }

  return {
    filename: outName,
    file_type: suffix.slice(1),
    download_url: `/api/lesson-file-edits/${outName}`,
    note: "Original source file was not changed. Edited copy preserves hyperlinks and images from the original. Other layout and styling may vary.",
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
