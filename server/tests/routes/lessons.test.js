const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const config = require('../../src/config');

const BASE = 'http://localhost:3000';

function generateToken(overrides = {}) {
  const payload = {
    teacher_id: 1,
    role: 'teacher',
    institution_id: 1,
    ...overrides
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
}

async function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const fetchOptions = { headers: { 'Content-Type': 'application/json', ...options.headers } };
  if (options.body) fetchOptions.body = JSON.stringify(options.body);
  if (options.method) fetchOptions.method = options.method;
  const res = await fetch(url, fetchOptions);
  const data = await res.json();
  return { status: res.status, data };
}

describe('Lessons endpoints', () => {
  let authHeader;

  before(() => {
    const token = generateToken();
    authHeader = `Bearer ${token}`;
  });

  it('GET /api/lessons without auth → 401', async () => {
    const { status } = await api('/api/lessons');
    assert.equal(status, 401);
  });

  it('GET /api/lessons with auth → 200, body has lessons array, total, page, limit', async () => {
    const { status, data } = await api('/api/lessons', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.lessons));
    assert.ok(typeof data.total === 'number');
    assert.ok(typeof data.page === 'number');
    assert.ok(typeof data.limit === 'number');
  });

  it('GET /api/lessons/1 → 200, body has lesson_id=1, title field', async () => {
    const { status, data } = await api('/api/lessons/1', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    assert.equal(data.lesson_id, 1);
    assert.ok(data.title);
  });

  it('GET /api/lessons/9999 → 404', async () => {
    const { status } = await api('/api/lessons/9999', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 404);
  });

  it('GET /api/lessons?q=Agent → returns lessons with "Agent" in title', async () => {
    const { status, data } = await api('/api/lessons?q=Agent', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    assert.ok(data.lessons.length > 0);
    assert.ok(data.lessons.some(l => l.title.includes('Agent')));
  });

  it('GET /api/lessons/1/source-files → 501 with "Phase 3" in detail', async () => {
    const { status, data } = await api('/api/lessons/1/source-files', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 501);
    assert.ok(data.detail.includes('Phase 3'));
  });

  it('GET /api/lessons?grade_level=K-2 → returns filtered lessons', async () => {
    const { status, data } = await api('/api/lessons?grade_level=K-2', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    assert.ok(data.lessons.every(l => l.grade_level === 'K-2'));
  });

  it('GET /api/lessons?q=scratch&grade_level=K-2 → combined filter works', async () => {
    const { status, data } = await api('/api/lessons?q=scratch&grade_level=K-2', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    assert.ok(data.lessons.every(l => l.grade_level === 'K-2'));
  });
});
