const db = require('../src/db');

// Mock user fixture for auth-dependent tests
const TEST_USER = {
  teacher_id: 999,
  role: 'teacher',
  institution_id: 1,
  email: 'test@example.com',
};

// Mock OpenRouter response fixture
const MOCK_LLM_RESPONSE = {
  choices: [{ message: { content: JSON.stringify({ recommendations: [], plan_steps: [], companion_materials: [] }) } }],
  usage: { total_tokens: 100 },
};

// Mock embedder response fixture
const MOCK_EMBEDDING = Array(384).fill(0.01); // all-MiniLM-L6-v2 dimension

// Helper: clean test tables before each test
function cleanTestTables() {
  const tables = ['adapted_lesson', 'lesson_plan_version', 'lesson_kb_used', 'adaptation_feedback', 'rag_context_log'];
  for (const table of tables) {
    try { db.prepare(`DELETE FROM ${table}`).run(); } catch {}
  }
}

global.TEST_USER = TEST_USER;
global.MOCK_LLM_RESPONSE = MOCK_LLM_RESPONSE;
global.MOCK_EMBEDDING = MOCK_EMBEDDING;
global.cleanTestTables = cleanTestTables;
