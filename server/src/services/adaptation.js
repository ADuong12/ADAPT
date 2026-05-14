const fs = require("fs");
const path = require("path");
const db = require("../db");
const { decrypt, redact } = require("./crypto");
const { OpenRouterProvider, coerceToPlanJson } = require("./llm/openrouter");
const { retrieveForLesson } = require("./rag/retriever");
const { renderLessonPlan } = require("./renderer");
const { createVersion, headVersion, parsePlanJson, listVersions } = require("./versioning");

const SYSTEM_PROMPT = fs.readFileSync(
  path.resolve(__dirname, "..", "prompts", "system.txt"),
  "utf-8"
);

function resolveProvider(teacherId) {
  const cfg = db.prepare(
    `SELECT provider, model, api_key_encrypted FROM llm_provider_config
     WHERE teacher_id = ? AND is_active = 1
     ORDER BY updated_at DESC LIMIT 1`
  ).get(teacherId);

  if (!cfg) {
    throw new Error("No LLM configured. Add an API key in Settings.");
  }

  const apiKey = decrypt(cfg.api_key_encrypted);
  return new OpenRouterProvider(apiKey, cfg.model);
}

function kbSpecs(kbIds) {
  if (!kbIds || kbIds.length === 0) return [];
  return db.prepare(
    "SELECT kb_id, kb_name, category FROM knowledge_base WHERE kb_id IN (" + kbIds.map(() => "?").join(",") + ")"
  ).all(...kbIds).map(row => ({ kb_id: row.kb_id, kb_name: row.kb_name, category: row.category }));
}

function studentsInClusterForTeacher(teacherId, clusterId) {
  return db.prepare(
    `SELECT s.first_name, s.last_name, s.math_performance, s.ela_performance, s.learner_variability
     FROM student s
     JOIN enrollment e ON e.student_id = s.student_id
     JOIN class c ON c.class_id = e.class_id
     WHERE c.teacher_id = ? AND s.cluster_id = ?`
  ).all(teacherId, clusterId);
}

async function buildContextBlocks({ lesson, cluster, kbSpecs: specs, students, previousPlanJson, instruction }) {
  const queryText = [
    lesson.title, lesson.cs_topic, lesson.objectives,
    cluster.cluster_name, cluster.cluster_description,
  ].filter(Boolean).join(" ");

  const chunks = await retrieveForLesson(queryText, specs, 3);

  const parts = [];
  parts.push("# Base lesson");
  parts.push(`Title: ${lesson.title}`);
  parts.push(`Grade: ${lesson.grade_level || "—"}`);
  parts.push(`CS topic: ${lesson.cs_topic || "—"}`);
  parts.push(`CS standard: ${lesson.cs_standard || "—"}`);
  parts.push(`Objectives: ${lesson.objectives || "—"}`);

  parts.push("\n# Target learner cluster");
  parts.push(`Name: ${cluster.cluster_name}`);
  parts.push(`Description: ${cluster.cluster_description || "—"}`);

  if (students && students.length) {
    parts.push("\n# Students in this cluster (for personalization, do not invent additional students)");
    for (const s of students) {
      parts.push(`- ${s.first_name} ${s.last_name}: math=${s.math_performance || "—"}, ela=${s.ela_performance || "—"}, notes=${s.learner_variability || "—"}`);
    }
  }

  parts.push("\n# Knowledge base context");
  if (!chunks.length) {
    parts.push("(No retrieved chunks. Rely on the KB names below as your guidance.)");
    for (const spec of specs) {
      parts.push(`- KB #${spec.kb_id} ${spec.kb_name} (${spec.category || "—"})`);
    }
  } else {
    for (const c of chunks) {
      parts.push(`\n[KB #${c.kb_id} ${c.kb_name} — ${c.section_title}]`);
      parts.push(c.text);
    }
  }

  if (previousPlanJson) {
    parts.push("\n# Previous version (refine instead of regenerating from scratch)");
    parts.push(JSON.stringify(previousPlanJson));
    parts.push("\n# Refinement instruction");
    parts.push(instruction || "");
  } else {
    parts.push("\n# Task");
    parts.push("Produce a personalized lesson plan for the cluster above. Cite KBs in `sources` as 'KB #<id> <kb_name>'. Output JSON only.");
  }

  const chunkMeta = chunks.map((c) => ({ kb_id: c.kb_id, kb_name: c.kb_name, section: c.section_title, distance: c.distance }));
  return { userPrompt: parts.join("\n"), chunkMeta };
}

async function generate({ teacherId, lessonId, clusterId, kbIds, includeStudentContext }) {
  const lesson = db.prepare("SELECT * FROM lesson WHERE lesson_id = ?").get(lessonId);
  const cluster = db.prepare("SELECT * FROM student_cluster WHERE cluster_id = ?").get(clusterId);
  if (!lesson || !cluster) throw new Error("lesson or cluster not found");

  // Create adapted_lesson row
  const adaptedResult = db.prepare(
    "INSERT INTO adapted_lesson (lesson_id, teacher_id, cluster_id) VALUES (?, ?, ?)"
  ).run(lessonId, teacherId, clusterId);
  const adaptedId = adaptedResult.lastInsertRowid;

  // Record KBs used
  for (const kbId of kbIds) {
    db.prepare("INSERT INTO lesson_kb_used (adapted_id, kb_id) VALUES (?, ?)").run(adaptedId, kbId);
  }

  const students = includeStudentContext ? studentsInClusterForTeacher(teacherId, clusterId) : [];
  const specs = kbSpecs(kbIds);
  const { userPrompt, chunkMeta } = await buildContextBlocks({
    lesson, cluster, kbSpecs: specs, students, previousPlanJson: null, instruction: null,
  });

  const provider = resolveProvider(teacherId);
  const result = await provider.generate({ system: SYSTEM_PROMPT, user: userPrompt });
  const planJson = coerceToPlanJson(result.text);

  const rendered = await renderLessonPlan({
    lesson: { title: lesson.title, grade_level: lesson.grade_level, cs_topic: lesson.cs_topic, cs_standard: lesson.cs_standard },
    cluster: { cluster_name: cluster.cluster_name, cluster_description: cluster.cluster_description },
    planJson,
    knowledgeBasesUsed: specs,
    provider: result.provider,
    modelUsed: result.model,
  });

  const version = createVersion({
    adaptedId, parentVersionId: null, instruction: null, renderedHtml: rendered,
    planJson, modelUsed: result.model, provider: result.provider, tokenCount: result.tokenCount,
  });

  // Update adapted_lesson summary fields
  db.prepare(
    "UPDATE adapted_lesson SET recommendations = ?, adapted_plan = ?, companion_materials = ? WHERE adapted_id = ?"
  ).run(
    JSON.stringify(planJson.recommendations || []),
    JSON.stringify(planJson.plan_steps || []),
    JSON.stringify(planJson.companion_materials || []),
    adaptedId
  );

  // Log RAG context
  db.prepare(
    "INSERT INTO rag_context_log (adapted_id, kb_chunks_used, token_count, context_layers) VALUES (?, ?, ?, ?)"
  ).run(
    adaptedId,
    JSON.stringify(chunkMeta),
    result.tokenCount,
    JSON.stringify({ lesson: true, cluster: true, students: !!students, kb_chunks: chunkMeta.length, previous_version: false })
  );

  return { adaptedId, version };
}

async function refine({ teacherId, adaptedId, instruction }) {
  const adapted = db.prepare("SELECT * FROM adapted_lesson WHERE adapted_id = ?").get(adaptedId);
  if (!adapted || adapted.teacher_id !== teacherId) throw new Error("adapted lesson not found");

  const head = headVersion(adaptedId);
  if (!head) throw new Error("no head version to refine from");

  const lesson = db.prepare("SELECT * FROM lesson WHERE lesson_id = ?").get(adapted.lesson_id);
  const cluster = db.prepare("SELECT * FROM student_cluster WHERE cluster_id = ?").get(adapted.cluster_id);
  const kbIds = db.prepare("SELECT kb_id FROM lesson_kb_used WHERE adapted_id = ?").all(adaptedId).map(r => r.kb_id);
  const specs = kbSpecs(kbIds);
  const students = studentsInClusterForTeacher(teacherId, adapted.cluster_id);

  const { userPrompt, chunkMeta } = await buildContextBlocks({
    lesson, cluster, kbSpecs: specs, students,
    previousPlanJson: parsePlanJson(head),
    instruction,
  });

  const provider = resolveProvider(teacherId);
  const result = await provider.generate({ system: SYSTEM_PROMPT, user: userPrompt });
  const planJson = coerceToPlanJson(result.text);

  const rendered = await renderLessonPlan({
    lesson: { title: lesson.title, grade_level: lesson.grade_level, cs_topic: lesson.cs_topic, cs_standard: lesson.cs_standard },
    cluster: { cluster_name: cluster.cluster_name, cluster_description: cluster.cluster_description },
    planJson,
    knowledgeBasesUsed: specs,
    provider: result.provider,
    modelUsed: result.model,
  });

  const version = createVersion({
    adaptedId, parentVersionId: head.version_id, instruction, renderedHtml: rendered,
    planJson, modelUsed: result.model, provider: result.provider, tokenCount: result.tokenCount,
  });

  // Update adapted_lesson summary fields
  db.prepare(
    "UPDATE adapted_lesson SET recommendations = ?, adapted_plan = ?, companion_materials = ? WHERE adapted_id = ?"
  ).run(
    JSON.stringify(planJson.recommendations || []),
    JSON.stringify(planJson.plan_steps || []),
    JSON.stringify(planJson.companion_materials || []),
    adaptedId
  );

  // Log RAG context
  db.prepare(
    "INSERT INTO rag_context_log (adapted_id, kb_chunks_used, token_count, context_layers) VALUES (?, ?, ?, ?)"
  ).run(
    adaptedId,
    JSON.stringify(chunkMeta),
    result.tokenCount,
    JSON.stringify({ lesson: true, cluster: true, students: !!students, kb_chunks: chunkMeta.length, previous_version: true })
  );

  return { adaptedId, version };
}

module.exports = { generate, refine, buildContextBlocks, resolveProvider, coerceToPlanJson };
