const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { NotFoundError } = require('../errors');

const router = express.Router();

// GET /api/institutions/:id/overview (ADMIN-01)
router.get('/:id/overview', requireAuth, requireRole('admin'), (req, res) => {
  const institutionId = parseInt(req.params.id);

  const inst = db.prepare(
    'SELECT institution_id, name, type, district FROM institution WHERE institution_id = ?'
  ).get(institutionId);

  if (!inst) {
    throw new NotFoundError('Institution');
  }

  const { teacher_count } = db.prepare(
    "SELECT COUNT(*) as teacher_count FROM teacher WHERE institution_id = ? AND role = 'teacher'"
  ).get(institutionId);

  const { class_count } = db.prepare(
    'SELECT COUNT(*) as class_count FROM class c JOIN teacher t ON t.teacher_id = c.teacher_id WHERE t.institution_id = ?'
  ).get(institutionId);

  const { student_count } = db.prepare(
    'SELECT COUNT(DISTINCT e.student_id) as student_count FROM enrollment e JOIN class c ON e.class_id = c.class_id JOIN teacher t ON t.teacher_id = c.teacher_id WHERE t.institution_id = ?'
  ).get(institutionId);

  const { adaptation_count } = db.prepare(
    'SELECT COUNT(*) as adaptation_count FROM adapted_lesson al JOIN teacher t ON t.teacher_id = al.teacher_id WHERE t.institution_id = ?'
  ).get(institutionId);

  res.json({
    institution: inst,
    metrics: {
      teachers: teacher_count,
      classes: class_count,
      students: student_count,
      adaptations: adaptation_count
    }
  });
});

// GET /api/institutions/:id/teachers (ADMIN-02)
router.get('/:id/teachers', requireAuth, requireRole('admin'), (req, res) => {
  const institutionId = parseInt(req.params.id);

  const rows = db.prepare(`
    SELECT t.teacher_id, t.first_name, t.last_name, t.email, t.role, t.institution_id,
           COUNT(DISTINCT c.class_id) as class_count,
           COUNT(DISTINCT e.student_id) as student_count,
           COUNT(DISTINCT al.adapted_id) as adaptation_count
    FROM teacher t
    LEFT JOIN class c ON c.teacher_id = t.teacher_id
    LEFT JOIN enrollment e ON e.class_id = c.class_id
    LEFT JOIN adapted_lesson al ON al.teacher_id = t.teacher_id
    WHERE t.institution_id = ?
    GROUP BY t.teacher_id
  `).all(institutionId);

  const result = rows.map(row => ({
    teacher: {
      teacher_id: row.teacher_id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      role: row.role,
      institution_id: row.institution_id
    },
    class_count: row.class_count,
    student_count: row.student_count,
    adaptation_count: row.adaptation_count
  }));

  res.json(result);
});

// GET /api/institutions/:id/classes (ADMIN-03)
router.get('/:id/classes', requireAuth, requireRole('admin'), (req, res) => {
  const institutionId = parseInt(req.params.id);

  const rows = db.prepare(`
    SELECT c.class_id, c.class_name, c.grade_band,
           t.first_name, t.last_name,
           COUNT(e.student_id) as student_count
    FROM class c
    JOIN teacher t ON t.teacher_id = c.teacher_id
    LEFT JOIN enrollment e ON e.class_id = c.class_id
    WHERE t.institution_id = ?
    GROUP BY c.class_id
  `).all(institutionId);

  const result = rows.map(row => ({
    class_id: row.class_id,
    class_name: row.class_name,
    grade_band: row.grade_band,
    teacher_name: `${row.first_name} ${row.last_name}`,
    student_count: row.student_count
  }));

  res.json(result);
});

// GET /api/institutions/:id/clusters (ADMIN-03)
router.get('/:id/clusters', requireAuth, requireRole('admin'), (req, res) => {
  const institutionId = parseInt(req.params.id);

  const rows = db.prepare(`
    SELECT sc.cluster_name,
           COUNT(DISTINCT s.student_id) as student_count,
           COUNT(DISTINCT c.class_id) as class_count
    FROM student_cluster sc
    JOIN student s ON s.cluster_id = sc.cluster_id
    JOIN enrollment e ON e.student_id = s.student_id
    JOIN class c ON c.class_id = e.class_id
    JOIN teacher t ON t.teacher_id = c.teacher_id
    WHERE t.institution_id = ?
    GROUP BY sc.cluster_id
  `).all(institutionId);

  res.json(rows);
});

// PUT /api/institutions/:id/settings (ADMIN-04 — stub)
router.put('/:id/settings', requireAuth, requireRole('admin'), (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    detail: 'System-wide settings management — define requirements before implementation'
  });
});

module.exports = router;
