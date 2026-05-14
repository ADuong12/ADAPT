const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  ExternalHyperlink, ImageRun, AlignmentType,
  Table, TableCell, TableRow, WidthType,
} = require("docx");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const db = require("../db");
const { sourceFilesForLesson } = require("./source-editor");

const SAMPLE_LESSONS_BASE = path.resolve(__dirname, "..", "..", "..", "Sample Lessons");

async function extractDocxMedia(docxPath) {
  const images = [];
  const links = [];

  const options = {
    convertImage: mammoth.images.imgElement(function (image) {
      return image.read("base64").then(function (imageBuffer) {
        images.push({
          contentType: image.contentType,
          buffer: Buffer.from(imageBuffer, "base64"),
          altText: image.altText || "",
        });
        return { src: "" };
      });
    }),
  };

  let htmlResult;
  try {
    htmlResult = await mammoth.convertToHtml({ path: docxPath }, options);
  } catch (e) {
    return { images: [], links: [] };
  }

  // Extract hyperlinks from HTML
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(htmlResult.value)) !== null) {
    const url = match[1];
    const text = match[2].replace(/<[^>]*>/g, "").trim();
    if (url && text) {
      links.push({ url, text });
    }
  }

  return { images, links };
}

function mapImageType(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/bmp") return "bmp";
  return "jpg";
}

async function exportDocx({ lesson, cluster, planJson, knowledgeBasesUsed, provider, modelUsed, sourceFiles = [] }) {
  const children = [];

  // Title
  children.push(new Paragraph({
    text: lesson.title,
    heading: HeadingLevel.TITLE,
    spacing: { after: 120 },
  }));

  // Subtitle
  children.push(new Paragraph({
    children: [
      new TextRun({ text: `Adapted for ${cluster.cluster_name}`, italics: true }),
      cluster.cluster_description
        ? new TextRun({ text: ` — ${cluster.cluster_description}`, italics: true, color: "666666" })
        : new TextRun(""),
    ],
    spacing: { after: 200 },
  }));

  // Meta
  const metaItems = [];
  if (lesson.grade_level) metaItems.push(`Grade: ${lesson.grade_level}`);
  if (lesson.cs_topic) metaItems.push(`Topic: ${lesson.cs_topic}`);
  if (lesson.cs_standard) metaItems.push(`Standard: ${lesson.cs_standard}`);
  if (provider) metaItems.push(`Model: ${provider} / ${modelUsed || "default"}`);

  if (metaItems.length) {
    children.push(new Paragraph({
      children: metaItems
        .map((item, i) => [
          new TextRun({ text: item, size: 20, color: "666666" }),
          i < metaItems.length - 1 ? new TextRun({ text: "   \u2022   ", size: 20, color: "999999" }) : null,
        ])
        .flat()
        .filter(Boolean),
      spacing: { after: 300 },
    }));
  }

  // Recommendations
  if (planJson.recommendations && planJson.recommendations.length) {
    children.push(new Paragraph({
      text: "Recommendations",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }));

    const tagColors = {
      udl: "D97706",
      mll: "0D9488",
      crp: "5B21B6",
      iep: "2563EB",
      neuro: "7C3AED",
      scaffold: "059669",
      dok: "DC2626",
      sel: "0891B2",
      other: "6B7280",
    };

    for (const rec of planJson.recommendations) {
      const borderColor = tagColors[rec.tag] || tagColors.other;

      children.push(new Paragraph({
        children: [new TextRun({ text: rec.title, bold: true, size: 22 })],
        border: {
          left: {
            color: borderColor,
            size: 18,
            style: "single",
            space: 8,
          },
        },
        spacing: { before: 120, after: 60 },
        indent: { left: 240 },
      }));

      children.push(new Paragraph({
        children: [new TextRun({ text: rec.body, size: 22, color: "4B5563" })],
        spacing: { after: 80 },
        indent: { left: 240 },
      }));

      if (rec.sources && rec.sources.length) {
        children.push(new Paragraph({
          children: [
            new TextRun({
              text: `Source: ${rec.sources.join(", ")}`,
              size: 18,
              color: "9CA3AF",
              italics: true,
            }),
          ],
          spacing: { after: 160 },
          indent: { left: 240 },
        }));
      }
    }
  }

  // Plan steps
  if (planJson.plan_steps && planJson.plan_steps.length) {
    children.push(new Paragraph({
      text: "Adapted Lesson Plan",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }));

    for (const step of planJson.plan_steps) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: step.title, bold: true, size: 22 }),
          step.duration
            ? new TextRun({ text: ` (${step.duration})`, size: 22, color: "6B7280" })
            : null,
        ].filter(Boolean),
        spacing: { before: 120, after: 60 },
      }));

      children.push(new Paragraph({
        children: [new TextRun({ text: step.body, size: 22, color: "4B5563" })],
        spacing: { after: 160 },
      }));
    }
  }

  // Companion materials
  if (planJson.companion_materials && planJson.companion_materials.length) {
    children.push(new Paragraph({
      text: "Companion Materials",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }));

    const rows = planJson.companion_materials.map((mat) =>
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: mat.title, bold: true, size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: mat.description, size: 20, color: "4B5563" })] }),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        ],
      })
    );

    children.push(new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }

  // Knowledge bases
  if (knowledgeBasesUsed && knowledgeBasesUsed.length) {
    children.push(new Paragraph({
      text: "Knowledge Bases Referenced",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }));

    for (const kb of knowledgeBasesUsed) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `KB #${kb.kb_id} \u2014 ${kb.kb_name}`, bold: true, size: 22 }),
          kb.category
            ? new TextRun({ text: ` (${kb.category})`, size: 22, color: "6B7280" })
            : null,
        ].filter(Boolean),
        spacing: { after: 80 },
        bullet: { level: 0 },
      }));
    }
  }

  // Original source hyperlinks and images
  let hasSourceMedia = false;
  for (const sourceFile of sourceFiles) {
    if (sourceFile.ext === ".docx" && fs.existsSync(sourceFile.path)) {
      const { images, links } = await extractDocxMedia(sourceFile.path);

      if (links.length || images.length) {
        if (!hasSourceMedia) {
          hasSourceMedia = true;
          children.push(new Paragraph({
            text: "Original Lesson Materials",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 120 },
          }));
        }

        for (const link of links) {
          children.push(new Paragraph({
            children: [
              new ExternalHyperlink({
                children: [new TextRun({ text: link.text || link.url, color: "1E40AF", size: 22 })],
                link: link.url,
              }),
            ],
            spacing: { after: 80 },
          }));
        }

        for (const img of images) {
          try {
            children.push(new Paragraph({
              children: [
                new ImageRun({
                  data: img.buffer,
                  transformation: { width: 450, height: 300 },
                  type: mapImageType(img.contentType),
                }),
              ],
              spacing: { before: 120, after: 120 },
              alignment: AlignmentType.CENTER,
            }));
            if (img.altText) {
              children.push(new Paragraph({
                children: [new TextRun({ text: img.altText, size: 18, color: "9CA3AF", italics: true })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 120 },
              }));
            }
          } catch (e) {
            // Skip images that fail to embed
          }
        }
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

async function exportPdf({ lesson, cluster, planJson, knowledgeBasesUsed, provider, modelUsed }) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = pdfDoc.addPage([612, 792]).getSize();
  let page = pdfDoc.getPages()[0];
  let y = height - 72;

  function newPageIfNeeded(minSpace = 72) {
    if (y < minSpace) {
      page = pdfDoc.addPage([612, 792]);
      y = height - 72;
    }
  }

  function drawText(text, options = {}) {
    const { size = 11, color = rgb(0, 0, 0), f = font, x = 72, lineHeight = size + 4 } = options;
    const maxWidth = 612 - x - 72;
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const w = f.widthOfTextAtSize(test, size);
      if (w > maxWidth && line) {
        newPageIfNeeded();
        page.drawText(line, { x, y, size, color, font: f });
        y -= lineHeight;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      newPageIfNeeded();
      page.drawText(line, { x, y, size, color, font: f });
      y -= lineHeight;
    }
  }

  function addHeading(text, size = 16) {
    newPageIfNeeded(100);
    y -= 12;
    page.drawText(text, { x: 72, y, size, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    y -= size + 8;
  }

  // Title
  addHeading(lesson.title, 20);
  y -= 4;

  // Subtitle
  page.drawText(`Adapted for ${cluster.cluster_name}`, { x: 72, y, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 20;

  // Meta
  const metaItems = [];
  if (lesson.grade_level) metaItems.push(`Grade: ${lesson.grade_level}`);
  if (lesson.cs_topic) metaItems.push(`Topic: ${lesson.cs_topic}`);
  if (lesson.cs_standard) metaItems.push(`Standard: ${lesson.cs_standard}`);
  if (metaItems.length) {
    page.drawText(metaItems.join("   \u2022   "), { x: 72, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
    y -= 24;
  }

  // Recommendations
  if (planJson.recommendations && planJson.recommendations.length) {
    y -= 8;
    addHeading("Recommendations", 14);

    for (const rec of planJson.recommendations) {
      newPageIfNeeded(120);
      page.drawText(rec.title, { x: 72, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;

      drawText(rec.body, { size: 10, color: rgb(0.3, 0.3, 0.3), lineHeight: 14 });
      y -= 4;

      if (rec.sources && rec.sources.length) {
        page.drawText(`Source: ${rec.sources.join(", ")}`, { x: 72, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
        y -= 12;
      }

      y -= 8;
    }
  }

  // Plan steps
  if (planJson.plan_steps && planJson.plan_steps.length) {
    y -= 8;
    addHeading("Adapted Lesson Plan", 14);

    for (const step of planJson.plan_steps) {
      newPageIfNeeded(120);
      const titleText = step.duration ? `${step.title} (${step.duration})` : step.title;
      page.drawText(titleText, { x: 72, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;

      drawText(step.body, { size: 10, color: rgb(0.3, 0.3, 0.3), lineHeight: 14 });
      y -= 8;
    }
  }

  // Companion materials
  if (planJson.companion_materials && planJson.companion_materials.length) {
    y -= 8;
    addHeading("Companion Materials", 14);

    for (const mat of planJson.companion_materials) {
      newPageIfNeeded(120);
      page.drawText(mat.title, { x: 72, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;

      drawText(mat.description, { size: 10, color: rgb(0.3, 0.3, 0.3), lineHeight: 14 });
      y -= 8;
    }
  }

  // KBs
  if (knowledgeBasesUsed && knowledgeBasesUsed.length) {
    y -= 8;
    addHeading("Knowledge Bases Referenced", 14);

    for (const kb of knowledgeBasesUsed) {
      newPageIfNeeded(72);
      const text = `KB #${kb.kb_id} \u2014 ${kb.kb_name}${kb.category ? ` (${kb.category})` : ""}`;
      page.drawText(text, { x: 72, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 14;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function getSourceFilesForLesson(lesson) {
  const files = [];

  // From database lesson_file table
  const dbFiles = db.prepare("SELECT * FROM lesson_file WHERE lesson_id = ?").all(lesson.lesson_id);
  for (const f of dbFiles) {
    const p = path.resolve(f.file_path);
    if (fs.existsSync(p)) {
      files.push({
        path: p,
        ext: path.extname(p).toLowerCase(),
        source: "db",
      });
    }
  }

  // From Sample Lessons directory
  const sampleFiles = sourceFilesForLesson(lesson);
  for (const f of sampleFiles) {
    const p = path.resolve(SAMPLE_LESSONS_BASE, f.source_path);
    if (fs.existsSync(p)) {
      files.push({
        path: p,
        ext: path.extname(p).toLowerCase(),
        source: "sample",
      });
    }
  }

  // Deduplicate by path
  const seen = new Set();
  return files.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });
}

module.exports = { exportDocx, exportPdf, getSourceFilesForLesson, extractDocxMedia };
