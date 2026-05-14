import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { generateToken, adminToken, authHeader } from '../helpers.js';

describe('Settings endpoints', () => {
  let teacherAuthHeader;

  beforeAll(() => {
    teacherAuthHeader = authHeader(generateToken());
  });

  it('GET /api/teachers/1/llm-config without auth → 401', async () => {
    const res = await request(app).get('/api/teachers/1/llm-config');
    expect(res.status).toBe(401);
  });

  it('GET /api/teachers/1/llm-config → 200, returns config or null', async () => {
    const res = await request(app)
      .get('/api/teachers/1/llm-config')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(res.body === null || res.body.provider).toBeDefined();
  });

  it('PUT /api/teachers/1/llm-config with valid data → 200, stores encrypted key', async () => {
    const res = await request(app)
      .put('/api/teachers/1/llm-config')
      .set('Authorization', teacherAuthHeader.Authorization)
      .send({ provider: 'openrouter', model: 'gpt-4', api_key: 'sk-test-1234' });
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('openrouter');
    expect(res.body.model).toBe('gpt-4');
    expect(res.body.api_key_redacted).toBeDefined();
    expect(res.body.is_active).toBe(true);
  });

  it('GET /api/teachers/1/llm-config after PUT → returns config with redacted key', async () => {
    const res = await request(app)
      .get('/api/teachers/1/llm-config')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(res.body).not.toBeNull();
    expect(res.body.provider).toBe('openrouter');
    expect(res.body.api_key_redacted.includes('\u2026')).toBe(true);
  });

  it('PUT /api/teachers/1/llm-config with invalid provider → 400', async () => {
    const res = await request(app)
      .put('/api/teachers/1/llm-config')
      .set('Authorization', teacherAuthHeader.Authorization)
      .send({ provider: 'invalid', api_key: 'sk-test' });
    expect(res.status).toBe(400);
  });

  it('POST /api/teachers/1/llm-config/test → 501 with "Phase 3" in detail', async () => {
    const res = await request(app)
      .post('/api/teachers/1/llm-config/test')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(501);
    expect(res.body.detail.includes('Phase 3')).toBe(true);
  });

  it('PUT /api/teachers/1/llm-config deactivates other providers', async () => {
    await request(app)
      .put('/api/teachers/1/llm-config')
      .set('Authorization', teacherAuthHeader.Authorization)
      .send({ provider: 'openai', api_key: 'sk-openai-key' });

    const res = await request(app)
      .get('/api/teachers/1/llm-config')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('openai');
  });

  it('GET /api/teachers/2/llm-config with teacher 1 token → 403', async () => {
    const res = await request(app)
      .get('/api/teachers/2/llm-config')
      .set('Authorization', teacherAuthHeader.Authorization);
    expect(res.status).toBe(403);
  });

  it('PUT /api/teachers/2/llm-config with teacher 1 token → 403', async () => {
    const res = await request(app)
      .put('/api/teachers/2/llm-config')
      .set('Authorization', teacherAuthHeader.Authorization)
      .send({ provider: 'openrouter', api_key: 'sk-cross-tenant' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/teachers/1/llm-config with missing api_key reuses existing key → 200', async () => {
    const res = await request(app)
      .put('/api/teachers/1/llm-config')
      .set('Authorization', teacherAuthHeader.Authorization)
      .send({ provider: 'openrouter' });
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('openrouter');
    expect(res.body.api_key_redacted).toBeDefined();
  });

  it('PUT /api/teachers/1/llm-config with empty provider → 400', async () => {
    const res = await request(app)
      .put('/api/teachers/1/llm-config')
      .set('Authorization', teacherAuthHeader.Authorization)
      .send({ provider: '', api_key: 'sk-test-key-123' });
    expect(res.status).toBe(400);
  });
});