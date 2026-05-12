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

describe('Admin endpoints', () => {
  let adminAuthHeader;
  let teacherAuthHeader;

  before(() => {
    const adminToken = generateToken({ teacher_id: 4, role: 'admin', institution_id: 1 });
    const teacherToken = generateToken({ teacher_id: 1, role: 'teacher', institution_id: 1 });
    adminAuthHeader = `Bearer ${adminToken}`;
    teacherAuthHeader = `Bearer ${teacherToken}`;
  });

  describe('Institution overview', () => {
    it('GET /api/institutions/1/overview without auth → 401', async () => {
      const { status } = await api('/api/institutions/1/overview');
      assert.equal(status, 401);
    });

    it('GET /api/institutions/1/overview with non-admin → 403', async () => {
      const { status } = await api('/api/institutions/1/overview', {
        headers: { Authorization: teacherAuthHeader }
      });
      assert.equal(status, 403);
    });

    it('GET /api/institutions/1/overview with admin → 200, returns institution + metrics', async () => {
      const { status, data } = await api('/api/institutions/1/overview', {
        headers: { Authorization: adminAuthHeader }
      });
      assert.equal(status, 200);
      assert.ok(data.institution);
      assert.ok(data.metrics);
      assert.ok('teachers' in data.metrics);
      assert.ok('classes' in data.metrics);
      assert.ok('students' in data.metrics);
      assert.ok('adaptations' in data.metrics);
    });

    it('GET /api/institutions/9999/overview → 404', async () => {
      const { status } = await api('/api/institutions/9999/overview', {
        headers: { Authorization: adminAuthHeader }
      });
      assert.equal(status, 404);
    });
  });

  describe('Teacher list', () => {
    it('GET /api/institutions/1/teachers → 200, returns teacher list with counts', async () => {
      const { status, data } = await api('/api/institutions/1/teachers', {
        headers: { Authorization: adminAuthHeader }
      });
      assert.equal(status, 200);
      assert.ok(Array.isArray(data));
      assert.ok(data.length > 0);
      const entry = data[0];
      assert.ok(entry.teacher);
      assert.ok('class_count' in entry);
      assert.ok('student_count' in entry);
      assert.ok('adaptation_count' in entry);
    });
  });

  describe('Classes', () => {
    it('GET /api/institutions/1/classes → 200, returns classes with teacher names', async () => {
      const { status, data } = await api('/api/institutions/1/classes', {
        headers: { Authorization: adminAuthHeader }
      });
      assert.equal(status, 200);
      assert.ok(Array.isArray(data));
      assert.ok(data.length > 0);
      const classItem = data[0];
      assert.ok('class_id' in classItem);
      assert.ok('class_name' in classItem);
      assert.ok('teacher_name' in classItem);
      assert.ok('student_count' in classItem);
    });
  });

  describe('Clusters', () => {
    it('GET /api/institutions/1/clusters → 200, returns cluster distribution', async () => {
      const { status, data } = await api('/api/institutions/1/clusters', {
        headers: { Authorization: adminAuthHeader }
      });
      assert.equal(status, 200);
      assert.ok(Array.isArray(data));
      assert.ok(data.length > 0);
      const cluster = data[0];
      assert.ok('cluster_name' in cluster);
      assert.ok('student_count' in cluster);
      assert.ok('class_count' in cluster);
    });
  });

  describe('Settings stub', () => {
    it('PUT /api/institutions/1/settings → 501 with "system-wide settings" in detail', async () => {
      const { status, data } = await api('/api/institutions/1/settings', {
        method: 'PUT',
        headers: { Authorization: adminAuthHeader }
      });
      assert.equal(status, 501);
      assert.ok(data.detail.includes('system-wide settings'));
    });
  });
});
