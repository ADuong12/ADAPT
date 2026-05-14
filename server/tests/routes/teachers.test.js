import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { generateToken, authHeader } from '../helpers.js';

describe('Teachers endpoints', () => {
  let teacherAuthHeader;

  beforeAll(() => {
    teacherAuthHeader = authHeader(generateToken());
  });

  describe('Dashboard', () => {
    it('GET /api/teachers/1/dashboard without auth → 401', async () => {
      const res = await request(app).get('/api/teachers/1/dashboard');
      expect(res.status).toBe(401);
    });

    it('GET /api/teachers/1/dashboard → 200, full response with teacher, institution, metrics, recent_adaptations, roster', async () => {
      const res = await request(app)
        .get('/api/teachers/1/dashboard')
        .set('Authorization', teacherAuthHeader.Authorization);
      expect(res.status).toBe(200);
      expect(res.body.teacher).toBeDefined();
      expect(res.body.metrics).toBeDefined();
      expect(res.body.metrics.students).toBeDefined();
      expect(res.body.metrics.clusters).toBeDefined();
      expect(res.body.metrics.adaptations).toBeDefined();
      expect(res.body.metrics.knowledge_bases).toBeDefined();
      expect(res.body.metrics.classes).toBeDefined();
      expect(Array.isArray(res.body.recent_adaptations)).toBe(true);
      expect(Array.isArray(res.body.roster)).toBe(true);
    });

    it('GET /api/teachers/9999/dashboard → 403 (non-owner)', async () => {
      const res = await request(app)
        .get('/api/teachers/9999/dashboard')
        .set('Authorization', teacherAuthHeader.Authorization);
      expect(res.status).toBe(403);
    });
  });

  describe('Classes', () => {
    it('GET /api/teachers/1/classes → 200, classes with nested students arrays', async () => {
      const res = await request(app)
        .get('/api/teachers/1/classes')
        .set('Authorization', teacherAuthHeader.Authorization);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const classItem = res.body[0];
      expect('class_id' in classItem).toBe(true);
      expect('class_name' in classItem).toBe(true);
      expect(Array.isArray(classItem.students)).toBe(true);
    });
  });

  describe('Student cluster assignment', () => {
    it('PATCH /api/teachers/1/students/1 with { cluster_id: 2 } → 200, returns updated student', async () => {
      const res = await request(app)
        .patch('/api/teachers/1/students/1')
        .set('Authorization', teacherAuthHeader.Authorization)
        .send({ cluster_id: 2 });
      expect(res.status).toBe(200);
      expect(res.body.student_id).toBe(1);
      expect(res.body.cluster_id).toBe(2);
    });

    it('PATCH /api/teachers/1/students/1 by teacher 2 → 403', async () => {
      const wrongHeader = authHeader(generateToken({ teacher_id: 2 }));
      const res = await request(app)
        .patch('/api/teachers/1/students/1')
        .set('Authorization', wrongHeader.Authorization)
        .send({ cluster_id: 3 });
      expect(res.status).toBe(403);
    });

    it('PATCH /api/teachers/1/students/1 with non-existent cluster_id → 404', async () => {
      const res = await request(app)
        .patch('/api/teachers/1/students/1')
        .set('Authorization', teacherAuthHeader.Authorization)
        .send({ cluster_id: 99999 });
      expect(res.status).toBe(404);
      expect(res.body.error.toLowerCase()).toContain('cluster');
    });

    it('PATCH /api/teachers/1/students/99999 (non-existent student) → 404', async () => {
      const res = await request(app)
        .patch('/api/teachers/1/students/99999')
        .set('Authorization', teacherAuthHeader.Authorization)
        .send({ cluster_id: 2 });
      expect(res.status).toBe(404);
      expect(res.body.error.toLowerCase()).toContain('student');
    });
  });

  describe('Profile', () => {
    it('GET /api/teachers/1/profile → 200, returns teacher fields', async () => {
      const res = await request(app)
        .get('/api/teachers/1/profile')
        .set('Authorization', teacherAuthHeader.Authorization);
      expect(res.status).toBe(200);
      expect(res.body.teacher_id).toBeDefined();
      expect(res.body.first_name).toBeDefined();
      expect(res.body.last_name).toBeDefined();
      expect(res.body.email).toBeDefined();
      expect(res.body.role).toBeDefined();
    });

    it('PUT /api/teachers/1/profile with { first_name: "New" } → updates name', async () => {
      const res = await request(app)
        .put('/api/teachers/1/profile')
        .set('Authorization', teacherAuthHeader.Authorization)
        .send({ first_name: 'NewName', last_name: 'NewLast' });
      expect(res.status).toBe(200);
      expect(res.body.first_name).toBe('NewName');
      expect(res.body.last_name).toBe('NewLast');
    });

    it('PUT /api/teachers/1/profile with { email: "hacked@evil.com" } → does NOT change email (security)', async () => {
      const res = await request(app)
        .put('/api/teachers/1/profile')
        .set('Authorization', teacherAuthHeader.Authorization)
        .send({ first_name: 'Test', last_name: 'User', email: 'hacked@evil.com' });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('mhernandez@lincoln.edu');
    });

    it('PUT /api/teachers/1/profile with empty first_name → 400', async () => {
      const res = await request(app)
        .put('/api/teachers/1/profile')
        .set('Authorization', teacherAuthHeader.Authorization)
        .send({ first_name: '', last_name: 'Valid' });
      expect(res.status).toBe(400);
      expect(res.body.error.toLowerCase()).toContain('first_name');
    });

    it('PUT /api/teachers/1/profile with empty last_name → 400', async () => {
      const res = await request(app)
        .put('/api/teachers/1/profile')
        .set('Authorization', teacherAuthHeader.Authorization)
        .send({ first_name: 'Valid', last_name: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.toLowerCase()).toContain('last_name');
    });

    it('PUT /api/teachers/1/profile with missing body fields → 400', async () => {
      const res = await request(app)
        .put('/api/teachers/1/profile')
        .set('Authorization', teacherAuthHeader.Authorization)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});