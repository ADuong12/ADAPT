import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { cleanTestTables } from './setup.js';

describe('Auth endpoints', () => {
  let accessToken, refreshToken;

  beforeAll(() => {
    cleanTestTables();
  });

  afterAll(() => {
    cleanTestTables();
  });

  it('POST /api/auth/register creates new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'testuser@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('testuser@example.com');
    expect(res.body.user.role).toBe('teacher');
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /api/auth/register rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'testuser@example.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already registered');
  });

  it('POST /api/auth/register rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Short PW', email: 'short@example.com', password: '1234567' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testuser@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('POST /api/auth/login rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testuser@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/setup-request for seeded teacher', async () => {
    const res = await request(app)
      .get('/api/auth/setup-request?email=mhernandez@lincoln.edu');
    expect(res.status).toBe(200);
    expect(typeof res.body.requires_setup).toBe('boolean');
  });

  it('GET /api/auth/setup-request for admin (already has password)', async () => {
    const res = await request(app)
      .get('/api/auth/setup-request?email=rchen@lincoln.edu');
    expect(res.status).toBe(200);
    expect(res.body.requires_setup).toBe(false);
  });

  it('POST /api/auth/refresh issues new token pair', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testuser@example.com', password: 'password123' });
    const freshRefreshToken = loginRes.body.refreshToken;
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: freshRefreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    const retryRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: freshRefreshToken });
    expect(retryRes.status).toBe(401);
  });

  it('POST /api/auth/logout revokes tokens', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testuser@example.com', password: 'password123' });
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
  });
});