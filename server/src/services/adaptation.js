const fs = require("fs");
const path = require("path");
const db = require("../db");
const { decrypt } = require("./crypto");
const { OpenRouterProvider } = require("./llm/openrouter");
const { retrieveForLesson } = require("./rag/retriever");
const { renderLessonPlan } = require("./renderer");
const { createVersion, headVersion, parsePlanJson } = require("./versioning");

const SYSTEM_PROMPT = fs.readFileSync(
  path.resolve(__dirname, "..", "prompts", "system.txt"),
  "utf-8"
);

const JSON_FENCE = /```(?:json)?\s*(\[.*?\])\s*```/s;

function coerceToArray(text) {
  text = text.trim();
  let candidate = text;
  const m = JSON_FENCE.exec(text);
  if (m) {
    candidate = m[1];
  } else {
    const first = text.indexOf("[");
    const last = text.lastIndexOf("]");
    if (first !== -1 && last !== -1 && last > first) {
      candidate = text.slice(first, last + 1);
    }
  }
  try {
    const data = JSON.parse(candidate);
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

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

async function buildContextBlocks({ lesson, cluster, kbSpecs: specs, students }) {
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

  const chunkMeta = chunks.map((c) => ({ kb_id: c.kb_id, kb_name: c.kb_name, section: c.section_title, distance: c.distance }));
  return { context: parts.join("\n"), chunkMeta };
}

async function generateRecommendations(provider, context, previousRecs, instruction) {
  const system = (
    "You are an expert K–12 computer science lesson designer. " +
    "Return ONLY a JSON array of recommendation objects, with NO extra commentary, NO markdown fences, and NO explanation. " +
    'Each object must have: {"title":"string (5-12 words)","body":"string (1-3 sentences)","tag":"udl | mll | crp | iep | neuro | scaffold | dok | sel | other","sources":["KB #<id> <kb_name>",...]}. ' +
    "Produce 3 to 6 recommendations grounded in the KB context. Cite KB ids in sources. Be concrete."
  );
  const parts = [context];
  if (previousRecs && previousRecs.length) {
    parts.push("\n# Previous recommendations (refine or keep based on instruction)");
    parts.push(JSON.stringify(previousRecs));
    parts.push("\n# Refinement instruction");
    parts.push(instruction || "Improve these recommendations.");
  } else {
    parts.push("\n# Task");
    parts.push("Generate 3 to 6 personalized recommendations for the cluster above. Cite KBs in sources. Output ONLY a JSON array.");
  }
  const result = await provider.generate({ system, user: parts.join("\n"), maxTokens: 4096 });
  const recommendations = coerceToArray(result.text);
  return { recommendations, tokenCount: result.tokenCount };
}

async function generatePlanSteps(provider, context, recommendations, previousSteps, instruction) {
  const system = (
    "You are an expert K–12 computer science lesson designer. " +
    "Return ONLY a JSON array of plan step objects, with NO extra commentary, NO markdown fences, and NO explanation. " +
    'Each object must have: {"title":"Warm-up | Main activity | Wrap-up | Extension | Assessment","duration":"string like 10 min","body":"string describing teacher and student actions"}. ' +
    "Produce 3 to 5 concrete plan steps grounded in the recommendations."
  );
  const parts = [context];
  if (recommendations && recommendations.length) {
    parts.push("\n# Recommendations to implement");
    parts.push(JSON.stringify(recommendations));
  }
  if (previousSteps && previousSteps.length) {
    parts.push("\n# Previous plan steps (refine or keep based on instruction)");
    parts.push(JSON.stringify(previousSteps));
    parts.push("\n# Refinement instruction");
    parts.push(instruction || "Improve these plan steps.");
  } else {
    parts.push("\n# Task");
    parts.push("Generate 3 to 5 concrete plan steps for the cluster above. Output ONLY a JSON array.");
  }
  const result = await provider.generate({ system, user: parts.join("\n"), maxTokens: 4096 });
  const planSteps = coerceToArray(result.text);
  return { planSteps, tokenCount: result.tokenCount };
}

async function generateCompanionMaterials(provider, context, recommendations, planSteps, previousMaterials, instruction) {
  const system = (
    "You are an expert K–12 computer science lesson designer. " +
    "Return ONLY a JSON array of companion material objects, with NO extra commentary, NO markdown fences, and NO explanation. " +
    'Each object must have: {"title":"string","description":"string"}. ' +
    "Produce 0 to 6 companion materials grounded in the plan."
  );
  const parts = [context];
  if (recommendations && recommendations.length) {
    parts.push("\n# Recommendations");
    parts.push(JSON.stringify(recommendations));
  }
  if (planSteps && planSteps.length) {
    parts.push("\n# Plan steps");
    parts.push(JSON.stringify(planSteps));
  }
  if (previousMaterials && previousMaterials.length) {
    parts.push("\n# Previous companion materials (refine or keep based on instruction)");
    parts.push(JSON.stringify(previousMaterials));
    parts.push("\n# Refinement instruction");
    parts.push(instruction || "Improve these companion materials.");
  } else {
    parts.push("\n# Task");
    parts.push("Generate 0 to 6 companion materials for the lesson above. Output ONLY a JSON array.");
  }
  const result = await provider.generate({ system, user: parts.join("\n"), maxTokens: 4096 });
  const companionMaterials = coerceToArray(result.text);
  return { companionMaterials, tokenCount: result.tokenCount };
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
  const { context, chunkMeta } = await buildContextBlocks({
    lesson, cluster, kbSpecs: specs, students,
  });

  const provider = resolveProvider(teacherId);

  // Section 1: Recommendations
  const recResult = await generateRecommendations(provider, context, null, null);
  // Section 2: Plan steps
  const stepResult = await generatePlanSteps(provider, context, recResult.recommendations, null, null);
  // Section 3: Companion materials
  const matResult = await generateCompanionMaterials(provider, context, recResult.recommendations, stepResult.planSteps, null, null);

  const planJson = {
    recommendations: recResult.recommendations,
    plan_steps: stepResult.planSteps,
    companion_materials: matResult.companionMaterials,
  };

  const totalTokenCount = (recResult.tokenCount || 0) + (stepResult.tokenCount || 0) + (matResult.tokenCount || 0);

  const rendered = await renderLessonPlan({
    lesson: { title: lesson.title, grade_level: lesson.grade_level, cs_topic: lesson.cs_topic, cs_standard: lesson.cs_standard },
    cluster: { cluster_name: cluster.cluster_name, cluster_description: cluster.cluster_description },
    planJson,
    knowledgeBasesUsed: specs,
    provider: provider.name,
    modelUsed: provider.model,
  });

  const version = createVersion({
    adaptedId, parentVersionId: null, instruction: null, renderedHtml: rendered,
    planJson, modelUsed: provider.model, provider: provider.name, tokenCount: totalTokenCount,
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
    totalTokenCount,
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

  const { context, chunkMeta } = await buildContextBlocks({
    lesson, cluster, kbSpecs: specs, students,
  });

  const previousPlanJson = parsePlanJson(head);

  const provider = resolveProvider(teacherId);

  // Section 1: Refine recommendations
  const recResult = await generateRecommendations(
    provider, context, previousPlanJson?.recommendations, instruction
  );
  // Section 2: Refine plan steps
  const stepResult = await generatePlanSteps(
    provider, context, recResult.recommendations, previousPlanJson?.plan_steps, instruction
  );
  // Section 3: Refine companion materials
  const matResult = await generateCompanionMaterials(
    provider, context, recResult.recommendations, stepResult.planSteps, previousPlanJson?.companion_materials, instruction
  );

  const planJson = {
    recommendations: recResult.recommendations,
    plan_steps: stepResult.planSteps,
    companion_materials: matResult.companionMaterials,
  };

  const totalTokenCount = (recResult.tokenCount || 0) + (stepResult.tokenCount || 0) + (matResult.tokenCount || 0);

  const rendered = await renderLessonPlan({
    lesson: { title: lesson.title, grade_level: lesson.grade_level, cs_topic: lesson.cs_topic, cs_standard: lesson.cs_standard },
    cluster: { cluster_name: cluster.cluster_name, cluster_description: cluster.cluster_description },
    planJson,
    knowledgeBasesUsed: specs,
    provider: provider.name,
    modelUsed: provider.model,
  });

  const version = createVersion({
    adaptedId, parentVersionId: head.version_id, instruction, renderedHtml: rendered,
    planJson, modelUsed: provider.model, provider: provider.name, tokenCount: totalTokenCount,
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
    totalTokenCount,
    JSON.stringify({ lesson: true, cluster: true, students: !!students, kb_chunks: chunkMeta.length, previous_version: true })
  );

  return { adaptedId, version };
}

module.exports = { generate, refine, buildContextBlocks, resolveProvider, kbSpecs };
