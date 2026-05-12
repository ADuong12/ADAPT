const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const config = require('../src/config');

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

describe('Knowledge bases endpoints', () => {
  let authHeader;

  before(() => {
    const token = generateToken();
    authHeader = `Bearer ${token}`;
  });

  it('GET /api/knowledge-bases without auth → 401', async () => {
    const { status } = await api('/api/knowledge-bases');
    assert.equal(status, 401);
  });

  it('GET /api/knowledge-bases with auth → 200, array with kb_id, kb_name, category', async () => {
    const { status, data } = await api('/api/knowledge-bases', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    const kb = data[0];
    assert.ok('kb_id' in kb);
    assert.ok('kb_name' in kb);
    assert.ok('category' in kb);
  });

  it('Response contains expected KB fields from seed data', async () => {
    const { status, data } = await api('/api/knowledge-bases', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    const kbNames = data.map(kb => kb.kb_name);
    assert.ok(kbNames.includes('UDL (General)'));
    assert.ok(kbNames.includes('CRP'));
  });
});
