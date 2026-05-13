const ejs = require("ejs");
const path = require("path");

const TEMPLATE_DIR = path.resolve(__dirname, "..", "templates");

async function renderLessonPlan({ lesson, cluster, planJson, knowledgeBasesUsed, provider, modelUsed }) {
  return ejs.renderFile(
    path.join(TEMPLATE_DIR, "lesson_plan.ejs"),
    {
      lesson,
      cluster,
      recommendations: planJson.recommendations || [],
      plan_steps: planJson.plan_steps || [],
      companion_materials: planJson.companion_materials || [],
      knowledge_bases_used: knowledgeBasesUsed,
      provider,
      model_used: modelUsed,
    },
    { async: false }
  );
}

module.exports = { renderLessonPlan };
