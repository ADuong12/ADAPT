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

describe('Settings endpoints', () => {
  let authHeader;

  before(() => {
    const token = generateToken();
    authHeader = `Bearer ${token}`;
  });

  it('GET /api/teachers/1/llm-config without auth → 401', async () => {
    const { status } = await api('/api/teachers/1/llm-config');
    assert.equal(status, 401);
  });

  it('GET /api/teachers/1/llm-config → 200, returns null if no config', async () => {
    const { status, data } = await api('/api/teachers/1/llm-config', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    assert.equal(data, null);
  });

  it('PUT /api/teachers/1/llm-config with valid data → 200, stores encrypted key', async () => {
    const { status, data } = await api('/api/teachers/1/llm-config', {
      method: 'PUT',
      headers: { Authorization: authHeader },
      body: { provider: 'openrouter', model: 'gpt-4', api_key: 'sk-test-1234' }
    });
    assert.equal(status, 200);
    assert.equal(data.provider, 'openrouter');
    assert.equal(data.model, 'gpt-4');
    assert.ok(data.api_key_redacted);
    assert.equal(data.is_active, true);
  });

  it('GET /api/teachers/1/llm-config after PUT → returns config with redacted key', async () => {
    const { status, data } = await api('/api/teachers/1/llm-config', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    assert.ok(data !== null);
    assert.equal(data.provider, 'openrouter');
    assert.ok(data.api_key_redacted.includes('…'));
  });

  it('PUT /api/teachers/1/llm-config with invalid provider → 400', async () => {
    const { status } = await api('/api/teachers/1/llm-config', {
      method: 'PUT',
      headers: { Authorization: authHeader },
      body: { provider: 'invalid', api_key: 'sk-test' }
    });
    assert.equal(status, 400);
  });

  it('POST /api/teachers/1/llm-config/test → 501 with "Phase 3" in detail', async () => {
    const { status, data } = await api('/api/teachers/1/llm-config/test', {
      method: 'POST',
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 501);
    assert.ok(data.detail.includes('Phase 3'));
  });

  it('PUT /api/teachers/1/llm-config deactivates other providers', async () => {
    // Add a second provider
    await api('/api/teachers/1/llm-config', {
      method: 'PUT',
      headers: { Authorization: authHeader },
      body: { provider: 'openai', api_key: 'sk-openai-key' }
    });

    // Check that openrouter is now inactive
    const { status, data } = await api('/api/teachers/1/llm-config', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    assert.equal(data.provider, 'openai');
  });
});
