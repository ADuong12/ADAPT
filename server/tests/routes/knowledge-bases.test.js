import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { generateToken, authHeader } from '../helpers.js';

describe('Knowledge bases endpoints', () => {
  let teacherAuthHeader;

  beforeAll(() => {
    teacherAuthHeader = authHeader(generateToken());
  });

  it('GET /api/knowledge-bases without auth → 401', async () => {
    const res = await request(app).get('/api/knowledge-bases');
    expect(res.status).toBe(401);
  });

  it('GET /api/knowledge-bases with auth → 200, array with kb_id, kb_name, category', async () => {
    const res = await request(app)
      .get('/api/knowledge-bases')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const kb = res.body[0];
    expect('kb_id' in kb).toBe(true);
    expect('kb_name' in kb).toBe(true);
    expect('category' in kb).toBe(true);
  });

  it('Response contains expected KB fields from seed data', async () => {
    const res = await request(app)
      .get('/api/knowledge-bases')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    const kbNames = res.body.map(kb => kb.kb_name);
    expect(kbNames.includes('UDL (General)')).toBe(true);
    expect(kbNames.includes('CRP')).toBe(true);
  });
});