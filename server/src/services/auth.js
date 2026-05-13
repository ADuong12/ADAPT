const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');

const SALT_ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateAccessToken(user) {
  return jwt.sign(
    { teacher_id: user.teacher_id, role: user.role, institution_id: user.institution_id },
    config.jwtSecret,
    { expiresIn: '15m' }
  );
}

function generateRefreshToken() {
  return uuidv4();
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function storeRefreshToken(teacherId, token) {
  const hashed = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_token (teacher_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(teacherId, hashed, expiresAt);
}

function verifyRefreshToken(token) {
  const hashed = hashRefreshToken(token);
  const now = new Date().toISOString();
  const row = db.prepare(
    'SELECT * FROM refresh_token WHERE token_hash = ? AND expires_at > ?'
  ).get(hashed, now);
  if (!row) return null;
  // Invalidate old token (one-time use per D-03)
  db.prepare('DELETE FROM refresh_token WHERE token_hash = ?').run(hashed);
  return row;
}

function revokeAllRefreshTokens(teacherId) {
  db.prepare('DELETE FROM refresh_token WHERE teacher_id = ?').run(teacherId);
}

module.exports = {
  hashPassword, verifyPassword, generateAccessToken, generateRefreshToken,
  storeRefreshToken, verifyRefreshToken, revokeAllRefreshTokens
};
