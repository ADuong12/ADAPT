import { describe, it, beforeAll, afterAll, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import db from '../../src/db';
import app from '../../src/app';
import { generateToken, adminToken, teacherToken, wrongTeacherToken, authHeader } from '../helpers';
import { cleanTestTables } from '../setup.js';

const MOCK_ADAPTED = {
  adapted_id: 1,
  lesson_id: 1,
  teacher_id: 1,
  cluster_id: 1,
};

const MOCK_VERSION = {
  version_id: 1,
  adapted_id: 1,
  version_number: 1,
  parent_version_id: null,
  is_head: 1,
  instruction: 'test instruction',
  model_used: 'gpt-4',
  provider: 'openrouter',
  token_count: 100,
  created_at: '2026-05-14T00:00:00Z',
  rendered_html: '<html>mock plan</html>',
  plan_json: JSON.stringify({ recommendations: [], plan_steps: [], companion_materials: [] }),
};

function seedAdaptation() {
  cleanTestTables();
  let row = db.prepare('SELECT * FROM adapted_lesson WHERE teacher_id = 1 LIMIT 1').get();
  if (!row) {
    db.prepare(
      'INSERT INTO adapted_lesson (lesson_id, teacher_id, cluster_id) VALUES (?, ?, ?)'
    ).run(1, 1, 1);
    row = db.prepare('SELECT * FROM adapted_lesson WHERE teacher_id = 1 LIMIT 1').get();
  }
  MOCK_ADAPTED.adapted_id = row.adapted_id;
  MOCK_ADAPTED.lesson_id = row.lesson_id;
  MOCK_ADAPTED.teacher_id = row.teacher_id;
  MOCK_ADAPTED.cluster_id = row.cluster_id;

  let vRow = db.prepare('SELECT * FROM lesson_plan_version WHERE adapted_id = ? AND is_head = 1').get(row.adapted_id);
  if (!vRow) {
    db.prepare(
      `INSERT INTO lesson_plan_version (adapted_id, version_number, is_head, instruction, model_used, provider, token_count, rendered_html, plan_json)
       VALUES (?, 1, 1, 'test', 'gpt-4', 'openrouter', 100, '<html>mock</html>', '{}')`
    ).run(row.adapted_id);
    vRow = db.prepare('SELECT * FROM lesson_plan_version WHERE adapted_id = ? AND is_head = 1').get(row.adapted_id);
  }
  MOCK_VERSION.version_id = vRow.version_id;
  MOCK_VERSION.adapted_id = row.adapted_id;
}

describe('Adaptation endpoints', () => {
  beforeAll(() => {
    seedAdaptation();
  });

  afterAll(() => {
    cleanTestTables();
  });

  describe('POST /api/adapt', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/adapt')
        .send({ lesson_id: 1, cluster_id: 1 });
      expect(res.status).toBe(401);
    });

    it('returns 400 when lesson_id is missing', async () => {
      const res = await request(app)
        .post('/api/adapt')
        .set('Authorization', authHeader(teacherToken()).Authorization)
        .send({ cluster_id: 1 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when cluster_id is missing', async () => {
      const res = await request(app)
        .post('/api/adapt')
        .set('Authorization', authHeader(teacherToken()).Authorization)
        .send({ lesson_id: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/adaptations/:adapted_id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for wrong teacher', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}`)
        .set('Authorization', authHeader(wrongTeacherToken()).Authorization);
      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent adaptation', async () => {
      const res = await request(app)
        .get('/api/adaptations/99999')
        .set('Authorization', authHeader(teacherToken()).Authorization);
      expect(res.status).toBe(404);
    });

    it('returns 200 with adaptation data for owner', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}`)
        .set('Authorization', authHeader(teacherToken()).Authorization);
      expect(res.status).toBe(200);
      expect(res.body.adapted_id).toBeDefined();
      expect(res.body.head_version).toBeDefined();
    });

    it('returns 200 for admin accessing any adaptation', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}`)
        .set('Authorization', authHeader(adminToken()).Authorization);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/adaptations/:adapted_id/refine', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/refine`)
        .send({ instruction: 'test' });
      expect(res.status).toBe(401);
    });

    it('returns 403 for wrong teacher', async () => {
      const res = await request(app)
        .post(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/refine`)
        .set('Authorization', authHeader(wrongTeacherToken()).Authorization)
        .send({ instruction: 'test' });
      expect(res.status).toBe(403);
    });

    it('returns 400 when instruction is missing', async () => {
      const res = await request(app)
        .post(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/refine`)
        .set('Authorization', authHeader(teacherToken()).Authorization)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/adaptations/:adapted_id/versions', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/versions`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with versions array for owner', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/versions`)
        .set('Authorization', authHeader(teacherToken()).Authorization);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/adaptations/:adapted_id/rollback', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/rollback`)
        .send({ version_id: 1 });
      expect(res.status).toBe(401);
    });

    it('returns 400 when version_id is missing', async () => {
      const res = await request(app)
        .post(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/rollback`)
        .set('Authorization', authHeader(teacherToken()).Authorization)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/adaptations/:adapted_id/versions/:version_id/print', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/versions/${MOCK_VERSION.version_id}/print`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with HTML content-type', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/versions/${MOCK_VERSION.version_id}/print`)
        .set('Authorization', authHeader(teacherToken()).Authorization);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
    });
  });

  describe('GET /api/adaptations/:adapted_id/versions/:version_id/export.html', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/versions/${MOCK_VERSION.version_id}/export.html`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with content-disposition header', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/versions/${MOCK_VERSION.version_id}/export.html`)
        .set('Authorization', authHeader(teacherToken()).Authorization);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('POST /api/adaptations/:adapted_id/feedback', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/feedback`)
        .send({ rating: 4, comments: 'Good' });
      expect(res.status).toBe(401);
    });

    it('returns 400 with invalid rating', async () => {
      const res = await request(app)
        .post(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/feedback`)
        .set('Authorization', authHeader(teacherToken()).Authorization)
        .send({ rating: 0 });
      expect(res.status).toBe(400);
    });

    it('returns 400 with rating > 5', async () => {
      const res = await request(app)
        .post(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/feedback`)
        .set('Authorization', authHeader(teacherToken()).Authorization)
        .send({ rating: 6 });
      expect(res.status).toBe(400);
    });

    it('returns 200 with valid feedback', async () => {
      const res = await request(app)
        .post(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/feedback`)
        .set('Authorization', authHeader(teacherToken()).Authorization)
        .send({ rating: 4, comments: 'Good' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('GET /api/adaptations/:adapted_id/versions/:version_id returns 404 for non-existent version', () => {
    it('returns 404 for non-existent version', async () => {
      const res = await request(app)
        .get(`/api/adaptations/${MOCK_ADAPTED.adapted_id}/versions/99999`)
        .set('Authorization', authHeader(teacherToken()).Authorization);
      expect(res.status).toBe(404);
    });
  });
});