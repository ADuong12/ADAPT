import db from '../src/db';

export const TEST_USER = {
  teacher_id: 999,
  role: 'teacher',
  institution_id: 1,
  email: 'test@example.com',
};

export const MOCK_LLM_RESPONSE = {
  choices: [{ message: { content: JSON.stringify({ recommendations: [], plan_steps: [], companion_materials: [] }) } }],
  usage: { total_tokens: 100 },
};

export const MOCK_EMBEDDING = Array(384).fill(0.01);

export function cleanTestTables() {
  const tables = ['adapted_lesson', 'lesson_plan_version', 'lesson_kb_used',
                  'adaptation_feedback', 'rag_context_log', 'refresh_token'];
  for (const table of tables) {
    try { db.prepare(`DELETE FROM ${table}`).run(); } catch {}
  }
  try { db.prepare("DELETE FROM teacher WHERE teacher_id > 4").run(); } catch {}
}