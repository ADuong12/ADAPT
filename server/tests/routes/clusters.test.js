import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { generateToken, authHeader } from '../helpers.js';

describe('Clusters endpoints', () => {
  let teacherAuthHeader;

  beforeAll(() => {
    teacherAuthHeader = authHeader(generateToken());
  });

  it('GET /api/clusters without auth → 401', async () => {
    const res = await request(app).get('/api/clusters');
    expect(res.status).toBe(401);
  });

  it('GET /api/clusters with auth → 200, array with cluster_id, cluster_name, kb_count, student_count', async () => {
    const res = await request(app)
      .get('/api/clusters')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const cluster = res.body[0];
    expect('cluster_id' in cluster).toBe(true);
    expect('cluster_name' in cluster).toBe(true);
    expect('kb_count' in cluster).toBe(true);
    expect('student_count' in cluster).toBe(true);
  });

  it('GET /api/clusters/1/kbs → 200, array of KB objects with kb_id, kb_name, category', async () => {
    const res = await request(app)
      .get('/api/clusters/1/kbs')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const kb = res.body[0];
    expect('kb_id' in kb).toBe(true);
    expect('kb_name' in kb).toBe(true);
    expect('category' in kb).toBe(true);
  });

  it('GET /api/clusters/9999/kbs → 404', async () => {
    const res = await request(app)
      .get('/api/clusters/9999/kbs')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(404);
  });

  it('PUT /api/clusters/1/kbs with { kb_ids: [1,2] } → 200, returns updated KB list', async () => {
    const res = await request(app)
      .put('/api/clusters/1/kbs')
      .set('Authorization', teacherAuthHeader.Authorization)
      .send({ kb_ids: [1, 2] });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  it('PUT /api/clusters/1/kbs with { kb_ids: [9999] } → 404', async () => {
    const res = await request(app)
      .put('/api/clusters/1/kbs')
      .set('Authorization', teacherAuthHeader.Authorization)
      .send({ kb_ids: [9999] });
    expect(res.status).toBe(404);
  });

  it('PUT /api/clusters/9999/kbs → 403 (middleware blocks before 404)', async () => {
    const res = await request(app)
      .put('/api/clusters/9999/kbs')
      .set('Authorization', teacherAuthHeader.Authorization)
      .send({ kb_ids: [] });
    expect(res.status).toBe(403);
  });
});