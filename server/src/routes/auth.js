const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const authService = require('../services/auth');
const db = require('../db');
const config = require('../config');
const { ValidationError, AuthError, AppError } = require('../errors');

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  // Validation
  if (!name || !email || !password) {
    throw new ValidationError('Name, email, and password are required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Invalid email format');
  }
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  // Check duplicate email
  const existing = db.prepare('SELECT teacher_id FROM teacher WHERE email = ?').get(email);
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  // Create user
  const passwordHash = authService.hashPassword(password);
  const parts = name.split(' ');
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || '';
  const result = db.prepare(
    'INSERT INTO teacher (first_name, last_name, email, institution_id, role, password_hash) VALUES (?, ?, ?, 1, ?, ?)'
  ).run(firstName, lastName, email, 'teacher', passwordHash);

  const user = db.prepare('SELECT * FROM teacher WHERE teacher_id = ?').get(result.lastInsertRowid);
  const accessToken = authService.generateAccessToken(user);
  const refreshToken = authService.generateRefreshToken();
  authService.storeRefreshToken(user.teacher_id, refreshToken);

  res.json({
    accessToken,
    refreshToken,
    user: { teacher_id: user.teacher_id, email: user.email, role: user.role }
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM teacher WHERE email = ?').get(email);
  if (!user || !user.password_hash) {
    throw new AuthError('Invalid email or password');
  }

  if (!authService.verifyPassword(password, user.password_hash)) {
    throw new AuthError('Invalid email or password');
  }

  const accessToken = authService.generateAccessToken(user);
  const refreshToken = authService.generateRefreshToken();
  authService.storeRefreshToken(user.teacher_id, refreshToken);

  res.json({
    accessToken,
    refreshToken,
    user: { teacher_id: user.teacher_id, email: user.email, role: user.role }
  });
});

// GET /api/auth/setup-request
router.get('/setup-request', (req, res) => {
  const { email } = req.query;
  if (!email) {
    throw new ValidationError('Email required');
  }

  const user = db.prepare('SELECT teacher_id, password_hash FROM teacher WHERE email = ?').get(email);
  if (!user) {
    return res.json({ requires_setup: false });
  }

  res.json({ requires_setup: user.password_hash === null });
});

// PUT /api/auth/setup-password
router.put('/setup-password', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  const user = db.prepare('SELECT * FROM teacher WHERE email = ?').get(email);
  if (!user) {
    throw new AuthError('Teacher not found');
  }
  if (user.password_hash !== null) {
    throw new AppError('Password already set', 403);
  }

  const passwordHash = authService.hashPassword(password);
  db.prepare('UPDATE teacher SET password_hash = ? WHERE teacher_id = ?').run(passwordHash, user.teacher_id);

  const accessToken = authService.generateAccessToken(user);
  const refreshToken = authService.generateRefreshToken();
  authService.storeRefreshToken(user.teacher_id, refreshToken);

  res.json({
    accessToken,
    refreshToken,
    user: { teacher_id: user.teacher_id, email: user.email, role: user.role }
  });
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ValidationError('Refresh token required');
  }

  const row = authService.verifyRefreshToken(refreshToken);
  if (!row) {
    throw new AuthError('Invalid or expired refresh token');
  }

  const user = db.prepare('SELECT * FROM teacher WHERE teacher_id = ?').get(row.teacher_id);
  const newAccessToken = authService.generateAccessToken(user);
  const newRefreshToken = authService.generateRefreshToken();
  authService.storeRefreshToken(user.teacher_id, newRefreshToken);

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

// POST /api/auth/logout (requires auth — parse JWT manually since requireAuth middleware not yet in Plan 1)
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new AuthError('Missing token');
  const payload = jwt.verify(token, config.jwtSecret);
  authService.revokeAllRefreshTokens(payload.teacher_id);
  res.json({ ok: true });
});

module.exports = router;
