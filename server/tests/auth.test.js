const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const BASE = 'http://localhost:3000';

async function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const fetchOptions = { headers: { 'Content-Type': 'application/json', ...options.headers } };
  if (options.body) fetchOptions.body = JSON.stringify(options.body);
  if (options.method) fetchOptions.method = options.method;
  const res = await fetch(url, fetchOptions);
  const data = await res.json();
  return { status: res.status, data };
}

describe('Auth endpoints', () => {
  let accessToken, refreshToken;

  it('POST /api/auth/register creates new user', async () => {
    const { status, data } = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Test User', email: 'testuser@example.com', password: 'password123' }
    });
    assert.equal(status, 200);
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    assert.equal(data.user.email, 'testuser@example.com');
    assert.equal(data.user.role, 'teacher');
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
  });

  it('POST /api/auth/register rejects duplicate email', async () => {
    const { status, data } = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Test User', email: 'testuser@example.com', password: 'password123' }
    });
    assert.equal(status, 409);
    assert.equal(data.error, 'Email already registered');
  });

  it('POST /api/auth/register rejects short password', async () => {
    const { status } = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Short PW', email: 'short@example.com', password: '1234567' }
    });
    assert.equal(status, 400);
  });

  it('POST /api/auth/login with valid credentials', async () => {
    const { status, data } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'testuser@example.com', password: 'password123' }
    });
    assert.equal(status, 200);
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
  });

  it('POST /api/auth/login rejects wrong password', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'testuser@example.com', password: 'wrongpassword' }
    });
    assert.equal(status, 401);
  });

  it('GET /api/auth/setup-request for seeded teacher', async () => {
    const { status, data } = await api('/api/auth/setup-request?email=mhernandez@lincoln.edu');
    assert.equal(status, 200);
    assert.equal(data.requires_setup, true);
  });

  it('GET /api/auth/setup-request for admin (already has password)', async () => {
    const { status, data } = await api('/api/auth/setup-request?email=rchen@lincoln.edu');
    assert.equal(status, 200);
    assert.equal(data.requires_setup, false);
  });

  it('POST /api/auth/refresh issues new token pair', async () => {
    const { status, data } = await api('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken }
    });
    assert.equal(status, 200);
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    // Old refresh token should be invalidated
    const { status: retryStatus } = await api('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken }
    });
    assert.equal(retryStatus, 401);
  });

  it('POST /api/auth/logout revokes tokens', async () => {
    // Login again to get fresh tokens
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'testuser@example.com', password: 'password123' }
    });
    const { status } = await api('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.data.accessToken}` }
    });
    assert.equal(status, 200);
  });
});
