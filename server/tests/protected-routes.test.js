import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { cleanTestTables } from './setup.js';

describe('Protected teacher routes', () => {
  let teacherToken, adminToken;

  beforeAll(async () => {
    let res = await request(app)
      .get('/api/auth/setup-request?email=mhernandez@lincoln.edu');
    if (res.body.requires_setup) {
      await request(app)
        .put('/api/auth/setup-password')
        .send({ email: 'mhernandez@lincoln.edu', password: 'password123' });
    }
    res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mhernandez@lincoln.edu', password: 'password123' });
    teacherToken = res.body.accessToken;

    res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rchen@lincoln.edu', password: 'admin123' });
    adminToken = res.body.accessToken;
  });

  afterAll(() => {
    cleanTestTables();
  });

  it('GET /api/teachers/1/dashboard without token returns 401', async () => {
    const res = await request(app).get('/api/teachers/1/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('GET /api/teachers/1/dashboard with valid teacher token (teacher_id=1) returns 200', async () => {
    const res = await request(app)
      .get('/api/teachers/1/dashboard')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.teacher).toBeDefined();
    expect(res.body.teacher.teacher_id).toBe(1);
  });

  it('GET /api/teachers/2/dashboard with teacher token (teacher_id=1) returns 403', async () => {
    const res = await request(app)
      .get('/api/teachers/2/dashboard')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Access denied');
  });

  it('GET /api/teachers/1/dashboard with admin token returns 200', async () => {
    const res = await request(app)
      .get('/api/teachers/1/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.teacher).toBeDefined();
    expect(res.body.teacher.teacher_id).toBe(1);
  });

  it('GET /api/teachers/1/dashboard returns teacher info and stats', async () => {
    const res = await request(app)
      .get('/api/teachers/1/dashboard')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.teacher.teacher_id).toBeDefined();
    expect(res.body.teacher.first_name).toBeDefined();
    expect(res.body.teacher.last_name).toBeDefined();
    expect(res.body.teacher.email).toBeDefined();
    expect(res.body.teacher.role).toBeDefined();
    expect(res.body.metrics).toBeDefined();
    expect(typeof res.body.metrics.students).toBe('number');
    expect(typeof res.body.metrics.clusters).toBe('number');
    expect(typeof res.body.metrics.adaptations).toBe('number');
  });
});

describe('GET /api/auth/me', () => {
  let teacherToken;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mhernandez@lincoln.edu', password: 'password123' });
    teacherToken = res.body.accessToken;
  });

  it('returns current user info with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.teacher_id).toBeDefined();
    expect(res.body.first_name).toBeDefined();
    expect(res.body.last_name).toBeDefined();
    expect(res.body.email).toBeDefined();
    expect(res.body.role).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});