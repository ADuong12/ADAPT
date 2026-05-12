const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const { NotFoundError } = require('../errors');

const router = express.Router();

// GET /api/lessons - list with pagination and search (LESS-01, LESS-04)
router.get('/', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const { q, grade_level } = req.query;

  // Build WHERE clause dynamically for search/filter
  let whereClause = '';
  const params = [];

  if (q) {
    whereClause = 'WHERE (title LIKE ? OR cs_topic LIKE ?)';
    const likePattern = `%${q}%`;
    params.push(likePattern, likePattern);
  }

  if (grade_level) {
    if (whereClause) {
      whereClause += ' AND grade_level = ?';
    } else {
      whereClause = 'WHERE grade_level = ?';
    }
    params.push(grade_level);
  }

  // Count total with filters
  const countQuery = `SELECT COUNT(*) as total FROM lesson ${whereClause}`;
  const { total } = db.prepare(countQuery).get(...params);

  // Fetch rows with pagination
  const dataQuery = `SELECT lesson_id, title, grade_level, cs_topic, cs_standard, objectives FROM lesson ${whereClause} ORDER BY lesson_id LIMIT ? OFFSET ?`;
  const rows = db.prepare(dataQuery).all(...params, limit, offset);

  res.json({ lessons: rows, total, page, limit });
});

// GET /api/lessons/:id - single lesson by ID (LESS-02)
router.get('/:id', requireAuth, (req, res) => {
  const lessonId = parseInt(req.params.id);

  const lesson = db.prepare(
    'SELECT lesson_id, title, grade_level, cs_topic, cs_standard, objectives FROM lesson WHERE lesson_id = ?'
  ).get(lessonId);

  if (!lesson) {
    throw new NotFoundError('Lesson');
  }

  res.json(lesson);
});

// GET /api/lessons/:id/source-files - stub for Phase 3 (LESS-03)
router.get('/:id/source-files', requireAuth, (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    detail: 'Source file editing requires RAG pipeline — available in Phase 3'
  });
});

module.exports = router;
