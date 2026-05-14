const { embed } = require("./embedder");
const { query } = require("./store");

async function retrieveForLesson(queryText, kbSpecs, topKPerKb = 3) {
  if (!kbSpecs || kbSpecs.length === 0) return [];
  try {
    const [qEmb] = await embed([queryText]) || [[]];
    if (!qEmb || qEmb.length === 0) return [];

    const out = [];
    for (const spec of kbSpecs) {
      try {
        const results = await query(spec.kb_id, qEmb, topKPerKb);
        for (const r of results) {
          const md = r.metadata || {};
          out.push({
            kb_id: spec.kb_id,
            kb_name: spec.kb_name,
            section_title: md.section_title || "Section",
            text: r.document,
            distance: r.distance,
          });
        }
      } catch (e) {
        // Collection missing or query error — skip this KB
      }
    }
    return out;
  } catch (e) {
    // Embed server unavailable — return empty so generation still works
    return [];
  }
}

module.exports = { retrieveForLesson };
