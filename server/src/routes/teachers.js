const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');
const { requireOwnerOrAdmin } = require('../middleware/rbac');
const { NotFoundError } = require('../errors');

// GET /api/teachers/:id/dashboard — owner or admin only
router.get('/:id/dashboard', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);
  const teacher = db.prepare(
    'SELECT teacher_id, first_name, last_name, email, institution_id, role FROM teacher WHERE teacher_id = ?'
  ).get(teacherId);

  if (!teacher) {
    throw new NotFoundError('Teacher');
  }

  // Get class count
  const classCount = db.prepare(
    'SELECT COUNT(*) as count FROM class WHERE teacher_id = ?'
  ).get(teacherId);

  // Get student count via enrollments
  const studentCount = db.prepare(
    'SELECT COUNT(DISTINCT e.student_id) as count FROM enrollment e JOIN class c ON e.class_id = c.class_id WHERE c.teacher_id = ?'
  ).get(teacherId);

  // Get adaptation count
  const adaptationCount = db.prepare(
    'SELECT COUNT(*) as count FROM adapted_lesson WHERE teacher_id = ?'
  ).get(teacherId);

  res.json({
    teacher,
    stats: {
      class_count: classCount.count,
      student_count: studentCount.count,
      adaptation_count: adaptationCount.count
    }
  });
});

module.exports = router;