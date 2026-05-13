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

describe('Teachers endpoints', () => {
  let authHeader;

  before(() => {
    const token = generateToken();
    authHeader = `Bearer ${token}`;
  });

  describe('Dashboard', () => {
    it('GET /api/teachers/1/dashboard without auth → 401', async () => {
      const { status } = await api('/api/teachers/1/dashboard');
      assert.equal(status, 401);
    });

    it('GET /api/teachers/1/dashboard → 200, full response with teacher, institution, metrics, recent_adaptations, roster', async () => {
      const { status, data } = await api('/api/teachers/1/dashboard', {
        headers: { Authorization: authHeader }
      });
      assert.equal(status, 200);
      assert.ok(data.teacher);
      assert.ok(data.metrics);
      assert.ok(data.metrics.students !== undefined);
      assert.ok(data.metrics.clusters !== undefined);
      assert.ok(data.metrics.adaptations !== undefined);
      assert.ok(data.metrics.knowledge_bases !== undefined);
      assert.ok(data.metrics.classes !== undefined);
      assert.ok(Array.isArray(data.recent_adaptations));
      assert.ok(Array.isArray(data.roster));
    });

    it('GET /api/teachers/9999/dashboard → 403 (non-owner)', async () => {
      const { status } = await api('/api/teachers/9999/dashboard', {
        headers: { Authorization: authHeader }
      });
      assert.equal(status, 403);
    });
  });

  describe('Classes', () => {
    it('GET /api/teachers/1/classes → 200, classes with nested students arrays', async () => {
      const { status, data } = await api('/api/teachers/1/classes', {
        headers: { Authorization: authHeader }
      });
      assert.equal(status, 200);
      assert.ok(Array.isArray(data));
      assert.ok(data.length > 0);
      const classItem = data[0];
      assert.ok('class_id' in classItem);
      assert.ok('class_name' in classItem);
      assert.ok(Array.isArray(classItem.students));
    });
  });

  describe('Student cluster assignment', () => {
    it('PATCH /api/teachers/1/students/1 with { cluster_id: 2 } → 200, returns updated student', async () => {
      const { status, data } = await api('/api/teachers/1/students/1', {
        method: 'PATCH',
        headers: { Authorization: authHeader },
        body: { cluster_id: 2 }
      });
      assert.equal(status, 200);
      assert.equal(data.student_id, 1);
      assert.equal(data.cluster_id, 2);
    });

    it('PATCH /api/teachers/1/students/1 by teacher 2 → 403', async () => {
      const adminToken = generateToken({ teacher_id: 2 });
      const { status } = await api('/api/teachers/1/students/1', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { cluster_id: 3 }
      });
      assert.equal(status, 403);
    });

    it('PATCH /api/teachers/1/students/1 with non-existent cluster_id → 404', async () => {
      const { status, data } = await api('/api/teachers/1/students/1', {
        method: 'PATCH',
        headers: { Authorization: authHeader },
        body: { cluster_id: 99999 }
      });
      assert.equal(status, 404);
      assert.ok(data.error.toLowerCase().includes('cluster'), `Expected "cluster" in error, got: ${data.error}`);
    });

    it('PATCH /api/teachers/1/students/99999 (non-existent student) → 404', async () => {
      const { status, data } = await api('/api/teachers/1/students/99999', {
        method: 'PATCH',
        headers: { Authorization: authHeader },
        body: { cluster_id: 2 }
      });
      assert.equal(status, 404);
      assert.ok(data.error.toLowerCase().includes('student'), `Expected "student" in error, got: ${data.error}`);
    });
  });

  describe('Profile', () => {
    it('GET /api/teachers/1/profile → 200, returns teacher fields', async () => {
      const { status, data } = await api('/api/teachers/1/profile', {
        headers: { Authorization: authHeader }
      });
      assert.equal(status, 200);
      assert.ok(data.teacher_id);
      assert.ok(data.first_name);
      assert.ok(data.last_name);
      assert.ok(data.email);
      assert.ok(data.role);
    });

    it('PUT /api/teachers/1/profile with { first_name: "New" } → updates name', async () => {
      const { status, data } = await api('/api/teachers/1/profile', {
        method: 'PUT',
        headers: { Authorization: authHeader },
        body: { first_name: 'NewName', last_name: 'NewLast' }
      });
      assert.equal(status, 200);
      assert.equal(data.first_name, 'NewName');
      assert.equal(data.last_name, 'NewLast');
    });

    it('PUT /api/teachers/1/profile with { email: "hacked@evil.com" } → does NOT change email (security)', async () => {
      const { status, data } = await api('/api/teachers/1/profile', {
        method: 'PUT',
        headers: { Authorization: authHeader },
        body: { first_name: 'Test', last_name: 'User', email: 'hacked@evil.com' }
      });
      assert.equal(status, 200);
      assert.equal(data.email, 'mhernandez@lincoln.edu'); // Original email unchanged
    });

    // END: Gap 2 - Profile PUT validation
    it('PUT /api/teachers/1/profile with empty first_name → 400', async () => {
      const { status, data } = await api('/api/teachers/1/profile', {
        method: 'PUT',
        headers: { Authorization: authHeader },
        body: { first_name: '', last_name: 'Valid' }
      });
      assert.equal(status, 400);
      assert.ok(data.error.toLowerCase().includes('first_name'), `Expected "first_name" in error, got: ${data.error}`);
    });

    it('PUT /api/teachers/1/profile with empty last_name → 400', async () => {
      const { status, data } = await api('/api/teachers/1/profile', {
        method: 'PUT',
        headers: { Authorization: authHeader },
        body: { first_name: 'Valid', last_name: '' }
      });
      assert.equal(status, 400);
      assert.ok(data.error.toLowerCase().includes('last_name'), `Expected "last_name" in error, got: ${data.error}`);
    });

    it('PUT /api/teachers/1/profile with missing body fields → 400', async () => {
      const { status } = await api('/api/teachers/1/profile', {
        method: 'PUT',
        headers: { Authorization: authHeader },
        body: {}
      });
      assert.equal(status, 400);
    });
  });
});
