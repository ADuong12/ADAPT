const HEADING_RE = /^(?:\d+\.\s+|[A-Z][A-Z\s]{4,}|[•\-]\s+)(.+)$/;

function chunkBySection(raw, minLen = 120, maxLen = 1400) {
  const lines = raw.split('\n').map(ln => ln.trimEnd()).filter(ln => ln.trim());
  const sections = [];
  let currentTitle = "Introduction";
  let currentBody = [];

  for (const ln of lines) {
    const m = HEADING_RE.exec(ln.trim());
    const isHeading = m && ln.trim().length <= 80;
    if (isHeading && currentBody.length) {
      sections.push([currentTitle, currentBody]);
      currentTitle = m[1].trim();
      currentBody = [];
    } else if (isHeading) {
      currentTitle = m[1].trim();
    } else {
      currentBody.push(ln);
    }
  }
  if (currentBody.length) sections.push([currentTitle, currentBody]);

  const chunks = [];
  let order = 0;
  for (const [title, bodyLines] of sections) {
    const body = bodyLines.join(' ').trim();
    if (!body) continue;
    if (body.length <= maxLen) {
      if (body.length >= minLen) {
        chunks.push({ section_title: title, text: body, order: order++ });
      }
      continue;
    }
    for (let i = 0; i < body.length; i += maxLen) {
      const piece = body.slice(i, i + maxLen).trim();
      if (piece.length >= minLen) {
        chunks.push({ section_title: `${title} (${Math.floor(i / maxLen) + 1})`, text: piece, order: order++ });
      }
    }
  }
  return chunks;
}

module.exports = { chunkBySection };
