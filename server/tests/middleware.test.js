import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import requireAuth from '../src/middleware/auth';
import { requireRole, requireOwnerOrAdmin } from '../src/middleware/rbac';
import config from '../src/config';

describe('requireAuth middleware', () => {
  function mockReqRes(authHeader) {
    const req = { headers: {} };
    if (authHeader) req.headers.authorization = authHeader;
    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) { statusCode = code; return res; },
      json(body) { responseBody = body; return res; },
      _getStatus() { return statusCode; },
      _getBody() { return responseBody; },
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    return { req, res, next, wasNextCalled: () => nextCalled, getStatus: () => statusCode, getBody: () => responseBody };
  }

  it('sets req.user when valid Bearer token provided', () => {
    const payload = { teacher_id: 1, role: 'teacher', institution_id: 1 };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
    const { req, res, next, wasNextCalled } = mockReqRes(`Bearer ${token}`);

    requireAuth(req, res, next);

    expect(wasNextCalled()).toBe(true);
    expect(req.user.teacher_id).toBe(1);
    expect(req.user.role).toBe('teacher');
    expect(req.user.institution_id).toBe(1);
  });

  it('returns 401 when no Authorization header', () => {
    const { req, res, next, wasNextCalled, getStatus, getBody } = mockReqRes(undefined);

    requireAuth(req, res, next);

    expect(wasNextCalled()).toBe(false);
    expect(getStatus()).toBe(401);
    expect(getBody().error).toBe('Missing or invalid authorization header');
  });

  it('returns 401 when Authorization header does not start with Bearer', () => {
    const { req, res, next, wasNextCalled, getStatus, getBody } = mockReqRes('Basic abc123');

    requireAuth(req, res, next);

    expect(wasNextCalled()).toBe(false);
    expect(getStatus()).toBe(401);
    expect(getBody().error).toBe('Missing or invalid authorization header');
  });

  it('returns 401 with "Token expired" on expired token', () => {
    const payload = { teacher_id: 1, role: 'teacher', institution_id: 1 };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '-1s' });
    const { req, res, next, wasNextCalled, getStatus, getBody } = mockReqRes(`Bearer ${token}`);

    requireAuth(req, res, next);

    expect(wasNextCalled()).toBe(false);
    expect(getStatus()).toBe(401);
    expect(getBody().error).toBe('Token expired');
  });

  it('returns 401 with "Invalid token" on malformed token', () => {
    const { req, res, next, wasNextCalled, getStatus, getBody } = mockReqRes('Bearer not.a.valid.token');

    requireAuth(req, res, next);

    expect(wasNextCalled()).toBe(false);
    expect(getStatus()).toBe(401);
    expect(getBody().error).toBe('Invalid token');
  });

  it('returns 401 with "Invalid token" when signed with wrong secret', () => {
    const payload = { teacher_id: 1, role: 'teacher', institution_id: 1 };
    const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '15m' });
    const { req, res, next, wasNextCalled, getStatus, getBody } = mockReqRes(`Bearer ${token}`);

    requireAuth(req, res, next);

    expect(wasNextCalled()).toBe(false);
    expect(getStatus()).toBe(401);
    expect(getBody().error).toBe('Invalid token');
  });
});

describe('requireRole middleware', () => {
  function mockReqRes(user) {
    const req = { user };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) { statusCode = code; return res; },
      json(body) { responseBody = body; return res; },
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    return { req, res, next, wasNextCalled: () => nextCalled, getStatus: () => statusCode, getBody: () => responseBody };
  }

  it('allows admin when requireRole("admin") is used', () => {
    const middleware = requireRole('admin');
    const { req, res, next, wasNextCalled } = mockReqRes({ teacher_id: 4, role: 'admin', institution_id: 1 });

    middleware(req, res, next);

    expect(wasNextCalled()).toBe(true);
  });

  it('blocks teacher when requireRole("admin") is used', () => {
    const middleware = requireRole('admin');
    const { req, res, next, wasNextCalled, getStatus, getBody } = mockReqRes({ teacher_id: 1, role: 'teacher', institution_id: 1 });

    middleware(req, res, next);

    expect(wasNextCalled()).toBe(false);
    expect(getStatus()).toBe(403);
    expect(getBody().error).toBe('Insufficient permissions');
  });

  it('returns 401 when req.user is missing', () => {
    const middleware = requireRole('admin');
    const { req, res, next, wasNextCalled, getStatus, getBody } = mockReqRes(undefined);

    middleware(req, res, next);

    expect(wasNextCalled()).toBe(false);
    expect(getStatus()).toBe(401);
    expect(getBody().error).toBe('Authentication required');
  });
});

describe('requireOwnerOrAdmin middleware', () => {
  function mockReqRes(user, params) {
    const req = { user, params };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) { statusCode = code; return res; },
      json(body) { responseBody = body; return res; },
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    return { req, res, next, wasNextCalled: () => nextCalled, getStatus: () => statusCode, getBody: () => responseBody };
  }

  it('allows owner when teacher_id matches route :id param', () => {
    const { req, res, next, wasNextCalled } = mockReqRes(
      { teacher_id: 1, role: 'teacher', institution_id: 1 },
      { id: '1' }
    );

    requireOwnerOrAdmin(req, res, next);

    expect(wasNextCalled()).toBe(true);
  });

  it('allows admin regardless of route :id param', () => {
    const { req, res, next, wasNextCalled } = mockReqRes(
      { teacher_id: 4, role: 'admin', institution_id: 1 },
      { id: '999' }
    );

    requireOwnerOrAdmin(req, res, next);

    expect(wasNextCalled()).toBe(true);
  });

  it('blocks non-owner non-admin user', () => {
    const { req, res, next, wasNextCalled, getStatus, getBody } = mockReqRes(
      { teacher_id: 1, role: 'teacher', institution_id: 1 },
      { id: '2' }
    );

    requireOwnerOrAdmin(req, res, next);

    expect(wasNextCalled()).toBe(false);
    expect(getStatus()).toBe(403);
    expect(getBody().error).toBe('Access denied');
  });

  it('returns 401 when req.user is missing', () => {
    const { req, res, next, wasNextCalled, getStatus, getBody } = mockReqRes(undefined, { id: '1' });

    requireOwnerOrAdmin(req, res, next);

    expect(wasNextCalled()).toBe(false);
    expect(getStatus()).toBe(401);
    expect(getBody().error).toBe('Authentication required');
  });
});