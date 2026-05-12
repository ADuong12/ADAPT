const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const { requireOwnerOrAdmin } = require('../middleware/rbac');
const { NotFoundError, ValidationError } = require('../errors');

const router = express.Router();

// GET /api/teachers/:id/dashboard — full Python parity (TEACH-01)
router.get('/:id/dashboard', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);

  // Fetch teacher
  const teacher = db.prepare(
    'SELECT teacher_id, first_name, last_name, email, institution_id, role FROM teacher WHERE teacher_id = ?'
  ).get(teacherId);

  if (!teacher) {
    throw new NotFoundError('Teacher');
  }

  // Fetch institution (if exists)
  let institution = null;
  if (teacher.institution_id) {
    institution = db.prepare(
      'SELECT institution_id, name, type, district FROM institution WHERE institution_id = ?'
    ).get(teacher.institution_id);
  }

  // Count students
  const { student_count } = db.prepare(
    'SELECT COUNT(DISTINCT e.student_id) as student_count FROM enrollment e JOIN class c ON e.class_id = c.class_id WHERE c.teacher_id = ?'
  ).get(teacherId);

  // Count clusters
  const { cluster_count } = db.prepare(
    'SELECT COUNT(DISTINCT s.cluster_id) as cluster_count FROM student s JOIN enrollment e ON s.student_id = e.student_id JOIN class c ON e.class_id = c.class_id WHERE c.teacher_id = ?'
  ).get(teacherId);

  // Count adaptations
  const { adaptation_count } = db.prepare(
    'SELECT COUNT(*) as adaptation_count FROM adapted_lesson WHERE teacher_id = ?'
  ).get(teacherId);

  // Count KBs (global)
  const { kb_count } = db.prepare('SELECT COUNT(*) as kb_count FROM knowledge_base').get();

  // Recent adaptations (last 6)
  const recentRows = db.prepare(`
    SELECT al.adapted_id, l.title as lesson_title, l.grade_level, l.cs_topic,
           sc.cluster_name, al.generated_at
    FROM adapted_lesson al
    JOIN lesson l ON al.lesson_id = l.lesson_id
    JOIN student_cluster sc ON sc.cluster_id = al.cluster_id
    WHERE al.teacher_id = ?
    ORDER BY al.generated_at DESC
    LIMIT 6
  `).all(teacherId);

  // Roster (all students in teacher's classes)
  const rosterRows = db.prepare(`
    SELECT s.student_id, s.first_name, s.last_name,
           sc.cluster_name, c.class_name
    FROM student s
    JOIN enrollment e ON s.student_id = e.student_id
    JOIN class c ON e.class_id = c.class_id
    LEFT JOIN student_cluster sc ON s.cluster_id = sc.cluster_id
    WHERE c.teacher_id = ?
    ORDER BY c.class_name, s.last_name
  `).all(teacherId);

  const roster = rosterRows.map(r => ({
    student_id: r.student_id,
    student_name: `${r.first_name} ${r.last_name}`,
    cluster_name: r.cluster_name,
    class_name: r.class_name
  }));

  const classesCount = [...new Set(rosterRows.map(r => r.class_name))].length;

  res.json({
    teacher,
    institution,
    metrics: {
      students: student_count,
      clusters: cluster_count,
      adaptations: adaptation_count,
      knowledge_bases: kb_count,
      classes: classesCount
    },
    recent_adaptations: recentRows,
    roster
  });
});

// GET /api/teachers/:id/classes — classes with nested students (TEACH-02, TEACH-05)
router.get('/:id/classes', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);

  // Fetch classes
  const classes = db.prepare(
    'SELECT class_id, class_name, grade_band, subject, school_year FROM class WHERE teacher_id = ? ORDER BY class_id'
  ).all(teacherId);

  if (classes.length === 0) {
    return res.json([]);
  }

  // Fetch all students for all classes in a single JOIN query (avoid N+1)
  const classIds = classes.map(c => c.class_id);
  const placeholders = classIds.map(() => '?').join(',');
  const studentRows = db.prepare(`
    SELECT s.student_id, s.first_name, s.last_name, s.cluster_id,
           sc.cluster_name, s.math_performance, s.ela_performance, s.learner_variability,
           e.class_id
    FROM student s
    JOIN enrollment e ON s.student_id = e.student_id
    LEFT JOIN student_cluster sc ON s.cluster_id = sc.cluster_id
    WHERE e.class_id IN (${placeholders})
    ORDER BY e.class_id, s.last_name
  `).all(...classIds);

  // Group students by class_id
  const studentsByClass = {};
  for (const row of studentRows) {
    if (!studentsByClass[row.class_id]) {
      studentsByClass[row.class_id] = [];
    }
    studentsByClass[row.class_id].push({
      student_id: row.student_id,
      first_name: row.first_name,
      last_name: row.last_name,
      cluster_id: row.cluster_id,
      cluster_name: row.cluster_name,
      math_performance: row.math_performance,
      ela_performance: row.ela_performance,
      learner_variability: row.learner_variability
    });
  }

  // Attach students to each class
  const classesWithStudents = classes.map(c => ({
    class_id: c.class_id,
    class_name: c.class_name,
    grade_band: c.grade_band,
    subject: c.subject,
    school_year: c.school_year,
    students: studentsByClass[c.class_id] || []
  }));

  res.json(classesWithStudents);
});

// PATCH /api/teachers/:id/students/:student_id — update student cluster (TEACH-03, CLUS-04)
router.patch('/:id/students/:student_id', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);
  const studentId = parseInt(req.params.student_id);

  // Verify student belongs to teacher
  const student = db.prepare(`
    SELECT s.student_id, s.first_name, s.last_name, s.cluster_id,
           s.math_performance, s.ela_performance, s.learner_variability
    FROM student s
    JOIN enrollment e ON s.student_id = e.student_id
    JOIN class c ON e.class_id = c.class_id
    WHERE c.teacher_id = ? AND s.student_id = ?
  `).get(teacherId, studentId);

  if (!student) {
    throw new NotFoundError('Student');
  }

  const { cluster_id, math_performance, ela_performance, learner_variability } = req.body;

  // If cluster_id provided, verify cluster exists
  if (cluster_id !== undefined && cluster_id !== null) {
    const cluster = db.prepare(
      'SELECT cluster_id FROM student_cluster WHERE cluster_id = ?'
    ).get(cluster_id);

    if (!cluster) {
      throw new NotFoundError('Cluster');
    }
  }

  // Build UPDATE dynamically (only non-null fields)
  const updates = [];
  const values = [];

  if (cluster_id !== undefined && cluster_id !== null) {
    updates.push('cluster_id = ?');
    values.push(cluster_id);
  }
  if (math_performance !== undefined && math_performance !== null) {
    updates.push('math_performance = ?');
    values.push(math_performance);
  }
  if (ela_performance !== undefined && ela_performance !== null) {
    updates.push('ela_performance = ?');
    values.push(ela_performance);
  }
  if (learner_variability !== undefined && learner_variability !== null) {
    updates.push('learner_variability = ?');
    values.push(learner_variability);
  }

  if (updates.length > 0) {
    values.push(studentId);
    db.prepare(`UPDATE student SET ${updates.join(', ')} WHERE student_id = ?`).run(...values);
  }

  // Fetch updated student with cluster_name
  const updated = db.prepare(`
    SELECT s.student_id, s.first_name, s.last_name, s.cluster_id,
           sc.cluster_name, s.math_performance, s.ela_performance, s.learner_variability
    FROM student s
    LEFT JOIN student_cluster sc ON s.cluster_id = sc.cluster_id
    WHERE s.student_id = ?
  `).get(studentId);

  res.json(updated);
});

// GET /api/teachers/:id/profile — view profile (TEACH-04)
router.get('/:id/profile', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);

  const teacher = db.prepare(
    'SELECT teacher_id, first_name, last_name, email, role, institution_id FROM teacher WHERE teacher_id = ?'
  ).get(teacherId);

  if (!teacher) {
    throw new NotFoundError('Teacher');
  }

  res.json(teacher);
});

// PUT /api/teachers/:id/profile — update profile name only (TEACH-04)
router.put('/:id/profile', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);

  // Verify teacher exists
  const teacher = db.prepare(
    'SELECT teacher_id, first_name, last_name FROM teacher WHERE teacher_id = ?'
  ).get(teacherId);

  if (!teacher) {
    throw new NotFoundError('Teacher');
  }

  const { first_name, last_name } = req.body;

  // Validate: non-empty strings, max 50 chars
  if (!first_name || typeof first_name !== 'string' || first_name.length === 0 || first_name.length > 50) {
    throw new ValidationError('first_name must be a non-empty string (max 50 chars)');
  }
  if (!last_name || typeof last_name !== 'string' || last_name.length === 0 || last_name.length > 50) {
    throw new ValidationError('last_name must be a non-empty string (max 50 chars)');
  }

  // Update name fields only (NO email or role changes)
  db.prepare(
    'UPDATE teacher SET first_name = ?, last_name = ? WHERE teacher_id = ?'
  ).run(first_name, last_name, teacherId);

  // Fetch updated teacher
  const updated = db.prepare(
    'SELECT teacher_id, first_name, last_name, email, role, institution_id FROM teacher WHERE teacher_id = ?'
  ).get(teacherId);

  res.json(updated);
});

module.exports = router;
