const db = require("../db");

function headVersion(adaptedId) {
  return db.prepare(
    "SELECT * FROM lesson_plan_version WHERE adapted_id = ? AND is_head = 1"
  ).get(adaptedId);
}

function listVersions(adaptedId) {
  return db.prepare(
    "SELECT * FROM lesson_plan_version WHERE adapted_id = ? ORDER BY version_number"
  ).all(adaptedId);
}

function nextVersionNumber(adaptedId) {
  const rows = listVersions(adaptedId);
  return (rows.length ? Math.max(...rows.map((v) => v.version_number)) : 0) + 1;
}

function createVersion({ adaptedId, parentVersionId, instruction, renderedHtml, planJson, modelUsed, provider, tokenCount }) {
  const versionNumber = nextVersionNumber(adaptedId);
  // Demote existing head
  db.prepare("UPDATE lesson_plan_version SET is_head = 0 WHERE adapted_id = ? AND is_head = 1").run(adaptedId);
  const result = db.prepare(
    `INSERT INTO lesson_plan_version (adapted_id, parent_version_id, version_number, is_head, instruction, rendered_html, plan_json, model_used, provider, token_count)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`
  ).run(adaptedId, parentVersionId, versionNumber, instruction, renderedHtml, planJson ? JSON.stringify(planJson) : null, modelUsed, provider, tokenCount);
  return db.prepare("SELECT * FROM lesson_plan_version WHERE version_id = ?").get(result.lastInsertRowid);
}

function rollbackTo(adaptedId, versionId) {
  const target = db.prepare("SELECT * FROM lesson_plan_version WHERE version_id = ? AND adapted_id = ?").get(versionId, adaptedId);
  if (!target) throw new Error("Version not found");
  db.prepare("UPDATE lesson_plan_version SET is_head = 0 WHERE adapted_id = ?").run(adaptedId);
  db.prepare("UPDATE lesson_plan_version SET is_head = 1 WHERE version_id = ?").run(versionId);
  return target;
}

function parsePlanJson(version) {
  if (!version.plan_json) return null;
  try {
    return JSON.parse(version.plan_json);
  } catch {
    return null;
  }
}

module.exports = { headVersion, listVersions, createVersion, rollbackTo, parsePlanJson, nextVersionNumber };
