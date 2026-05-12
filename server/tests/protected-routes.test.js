const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const BASE = 'http://localhost:3001';

async function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const fetchOptions = { headers: { 'Content-Type': 'application/json', ...options.headers } };
  if (options.body) fetchOptions.body = JSON.stringify(options.body);
  if (options.method) fetchOptions.method = options.method;
  const res = await fetch(url, fetchOptions);
  const data = await res.json();
  return { status: res.status, data };
}

describe('Protected teacher routes', () => {
  let teacherToken, adminToken;

  before(async () => {
    // Login as teacher (mhernandez@lincoln.edu) — needs setup-password first
    let res = await api('/api/auth/setup-request?email=mhernandez@lincoln.edu');
    if (res.data.requires_setup) {
      await api('/api/auth/setup-password', {
        method: 'PUT',
        body: { email: 'mhernandez@lincoln.edu', password: 'password123' }
      });
    }
    res = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'mhernandez@lincoln.edu', password: 'password123' }
    });
    teacherToken = res.data.accessToken;

    // Login as admin (rchen@lincoln.edu)
    res = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'rchen@lincoln.edu', password: 'admin123' }
    });
    adminToken = res.data.accessToken;
  });

  it('GET /api/teachers/1/dashboard without token returns 401', async () => {
    const { status, data } = await api('/api/teachers/1/dashboard');
    assert.equal(status, 401);
    assert.ok(data.error);
  });

  it('GET /api/teachers/1/dashboard with valid teacher token (teacher_id=1) returns 200', async () => {
    const { status, data } = await api('/api/teachers/1/dashboard', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert.equal(status, 200);
    assert.ok(data.teacher);
    assert.equal(data.teacher.teacher_id, 1);
  });

  it('GET /api/teachers/2/dashboard with teacher token (teacher_id=1) returns 403', async () => {
    const { status, data } = await api('/api/teachers/2/dashboard', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert.equal(status, 403);
    assert.equal(data.error, 'Access denied');
  });

  it('GET /api/teachers/1/dashboard with admin token returns 200', async () => {
    const { status, data } = await api('/api/teachers/1/dashboard', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(status, 200);
    assert.ok(data.teacher);
    assert.equal(data.teacher.teacher_id, 1);
  });

  it('GET /api/teachers/1/dashboard returns teacher info and stats', async () => {
    const { status, data } = await api('/api/teachers/1/dashboard', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert.equal(status, 200);
    assert.ok(data.teacher.teacher_id);
    assert.ok(data.teacher.first_name);
    assert.ok(data.teacher.last_name);
    assert.ok(data.teacher.email);
    assert.ok(data.teacher.role);
    assert.ok(data.stats);
    assert.ok(typeof data.stats.class_count === 'number');
    assert.ok(typeof data.stats.student_count === 'number');
    assert.ok(typeof data.stats.adaptation_count === 'number');
  });
});

describe('GET /api/auth/me', () => {
  let teacherToken;

  before(async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'mhernandez@lincoln.edu', password: 'password123' }
    });
    teacherToken = res.data.accessToken;
  });

  it('returns current user info with valid token', async () => {
    const { status, data } = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert.equal(status, 200);
    assert.ok(data.teacher_id);
    assert.ok(data.first_name);
    assert.ok(data.last_name);
    assert.ok(data.email);
    assert.ok(data.role);
  });

  it('returns 401 without token', async () => {
    const { status } = await api('/api/auth/me');
    assert.equal(status, 401);
  });
});
