import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { generateToken, adminToken, authHeader } from '../helpers.js';

describe('Admin endpoints', () => {
  let adminAuthHeader;
  let teacherAuthHeader;

  beforeAll(() => {
    adminAuthHeader = authHeader(generateToken({ teacher_id: 4, role: 'admin', institution_id: 1 }));
    teacherAuthHeader = authHeader(generateToken({ teacher_id: 1, role: 'teacher', institution_id: 1 }));
  });

  describe('Institution overview', () => {
    it('GET /api/institutions/1/overview without auth → 401', async () => {
      const res = await request(app).get('/api/institutions/1/overview');
      expect(res.status).toBe(401);
    });

    it('GET /api/institutions/1/overview with non-admin → 403', async () => {
      const res = await request(app)
        .get('/api/institutions/1/overview')
        .set('Authorization', teacherAuthHeader.Authorization);
      expect(res.status).toBe(403);
    });

    it('GET /api/institutions/1/overview with admin → 200, returns institution + metrics', async () => {
      const res = await request(app)
        .get('/api/institutions/1/overview')
        .set('Authorization', adminAuthHeader.Authorization);
      expect(res.status).toBe(200);
      expect(res.body.institution).toBeDefined();
      expect(res.body.metrics).toBeDefined();
      expect('teachers' in res.body.metrics).toBe(true);
      expect('classes' in res.body.metrics).toBe(true);
      expect('students' in res.body.metrics).toBe(true);
      expect('adaptations' in res.body.metrics).toBe(true);
    });

    it('GET /api/institutions/9999/overview → 404', async () => {
      const res = await request(app)
        .get('/api/institutions/9999/overview')
        .set('Authorization', adminAuthHeader.Authorization);
      expect(res.status).toBe(404);
    });
  });

  describe('Teacher list', () => {
    it('GET /api/institutions/1/teachers → 200, returns teacher list with counts', async () => {
      const res = await request(app)
        .get('/api/institutions/1/teachers')
        .set('Authorization', adminAuthHeader.Authorization);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const entry = res.body[0];
      expect(entry.teacher).toBeDefined();
      expect('class_count' in entry).toBe(true);
      expect('student_count' in entry).toBe(true);
      expect('adaptation_count' in entry).toBe(true);
    });
  });

  describe('Classes', () => {
    it('GET /api/institutions/1/classes → 200, returns classes with teacher names', async () => {
      const res = await request(app)
        .get('/api/institutions/1/classes')
        .set('Authorization', adminAuthHeader.Authorization);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const classItem = res.body[0];
      expect('class_id' in classItem).toBe(true);
      expect('class_name' in classItem).toBe(true);
      expect('teacher_name' in classItem).toBe(true);
      expect('student_count' in classItem).toBe(true);
    });
  });

  describe('Clusters', () => {
    it('GET /api/institutions/1/clusters → 200, returns cluster distribution', async () => {
      const res = await request(app)
        .get('/api/institutions/1/clusters')
        .set('Authorization', adminAuthHeader.Authorization);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const cluster = res.body[0];
      expect('cluster_name' in cluster).toBe(true);
      expect('student_count' in cluster).toBe(true);
      expect('class_count' in cluster).toBe(true);
    });
  });

  describe('Settings stub', () => {
    it('PUT /api/institutions/1/settings → 501 with "system-wide settings" in detail', async () => {
      const res = await request(app)
        .put('/api/institutions/1/settings')
        .set('Authorization', adminAuthHeader.Authorization);
      expect(res.status).toBe(501);
      expect(res.body.detail.toLowerCase()).toContain('system-wide settings');
    });
  });
});