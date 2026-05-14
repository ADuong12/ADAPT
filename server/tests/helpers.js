import jwt from 'jsonwebtoken';
import config from '../src/config';

export function generateToken(overrides = {}) {
  const payload = {
    teacher_id: 1,
    role: 'teacher',
    institution_id: 1,
    ...overrides,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
}

export const teacherToken = () => generateToken({ teacher_id: 1, role: 'teacher' });
export const adminToken = () => generateToken({ teacher_id: 4, role: 'admin' });
export const wrongTeacherToken = () => generateToken({ teacher_id: 2, role: 'teacher' });

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}