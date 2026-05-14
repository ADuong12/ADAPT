import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { generateToken, authHeader } from '../helpers.js';

describe('Lessons endpoints', () => {
  let teacherAuthHeader;

  beforeAll(() => {
    teacherAuthHeader = authHeader(generateToken());
  });

  it('GET /api/lessons without auth → 401', async () => {
    const res = await request(app).get('/api/lessons');
    expect(res.status).toBe(401);
  });

  it('GET /api/lessons with auth → 200, body has lessons array, total, page, limit', async () => {
    const res = await request(app)
      .get('/api/lessons')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.lessons)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.page).toBe('number');
    expect(typeof res.body.limit).toBe('number');
  });

  it('GET /api/lessons/1 → 200, body has lesson_id=1, title field', async () => {
    const res = await request(app)
      .get('/api/lessons/1')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(res.body.lesson_id).toBe(1);
    expect(res.body.title).toBeDefined();
  });

  it('GET /api/lessons/9999 → 404', async () => {
    const res = await request(app)
      .get('/api/lessons/9999')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(404);
  });

  it('GET /api/lessons?q=Agent → returns lessons with "Agent" in title', async () => {
    const res = await request(app)
      .get('/api/lessons?q=Agent')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(res.body.lessons.length).toBeGreaterThan(0);
    expect(res.body.lessons.some(l => l.title.includes('Agent'))).toBe(true);
  });

  it('GET /api/lessons/1/source-files → 501 with "Phase 3" in detail', async () => {
    const res = await request(app)
      .get('/api/lessons/1/source-files')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(501);
    expect(res.body.detail.includes('Phase 3')).toBe(true);
  });

  it('GET /api/lessons?grade_level=K-2 → returns filtered lessons', async () => {
    const res = await request(app)
      .get('/api/lessons?grade_level=K-2')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(res.body.lessons.every(l => l.grade_level === 'K-2')).toBe(true);
  });

  it('GET /api/lessons?q=scratch&grade_level=K-2 → combined filter works', async () => {
    const res = await request(app)
      .get('/api/lessons?q=scratch&grade_level=K-2')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(res.body.lessons.every(l => l.grade_level === 'K-2')).toBe(true);
  });
});