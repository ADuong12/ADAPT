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

describe('Clusters endpoints', () => {
  let authHeader;

  before(() => {
    const token = generateToken();
    authHeader = `Bearer ${token}`;
  });

  it('GET /api/clusters without auth → 401', async () => {
    const { status } = await api('/api/clusters');
    assert.equal(status, 401);
  });

  it('GET /api/clusters with auth → 200, array with cluster_id, cluster_name, kb_count, student_count', async () => {
    const { status, data } = await api('/api/clusters', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    const cluster = data[0];
    assert.ok('cluster_id' in cluster);
    assert.ok('cluster_name' in cluster);
    assert.ok('kb_count' in cluster);
    assert.ok('student_count' in cluster);
  });

  it('GET /api/clusters/1/kbs → 200, array of KB objects with kb_id, kb_name, category', async () => {
    const { status, data } = await api('/api/clusters/1/kbs', {
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

  it('GET /api/clusters/9999/kbs → 404', async () => {
    const { status } = await api('/api/clusters/9999/kbs', {
      headers: { Authorization: authHeader }
    });
    assert.equal(status, 404);
  });

  it('PUT /api/clusters/1/kbs with { kb_ids: [1,2] } → 200, returns updated KB list', async () => {
    const { status, data } = await api('/api/clusters/1/kbs', {
      method: 'PUT',
      headers: { Authorization: authHeader },
      body: { kb_ids: [1, 2] }
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 2);
  });

  it('PUT /api/clusters/1/kbs with { kb_ids: [9999] } → 404', async () => {
    const { status } = await api('/api/clusters/1/kbs', {
      method: 'PUT',
      headers: { Authorization: authHeader },
      body: { kb_ids: [9999] }
    });
    assert.equal(status, 404);
  });

  it('PUT /api/clusters/9999/kbs → 404', async () => {
    const { status } = await api('/api/clusters/9999/kbs', {
      method: 'PUT',
      headers: { Authorization: authHeader },
      body: { kb_ids: [] }
    });
    assert.equal(status, 404);
  });
});
