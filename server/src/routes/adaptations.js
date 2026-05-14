const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const adaptationService = require('../services/adaptation');
const versioningService = require('../services/versioning');
const db = require('../db');

function requireAdaptationOwner(req, res, next) {
  const adaptedId = parseInt(req.params.adapted_id);
  const adapted = db.prepare("SELECT teacher_id FROM adapted_lesson WHERE adapted_id = ?").get(adaptedId);
  if (!adapted) return res.status(404).json({ error: 'Adaptation not found' });
  if (adapted.teacher_id !== req.user.teacher_id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  req.adapted = adapted;
  next();
}

function versionSummary(v) {
  return {
    version_id: v.version_id,
    version_number: v.version_number,
    parent_version_id: v.parent_version_id,
    is_head: Boolean(v.is_head),
    instruction: v.instruction,
    model_used: v.model_used,
    provider: v.provider,
    token_count: v.token_count,
    created_at: v.created_at,
  };
}

function adaptationOut(adaptedId) {
  const head = versioningService.headVersion(adaptedId);
  if (!head) return { error: 'no versions for this adaptation' };
  const versions = versioningService.listVersions(adaptedId);
  const adapted = db.prepare("SELECT * FROM adapted_lesson WHERE adapted_id = ?").get(adaptedId);
  return {
    adapted_id: adapted.adapted_id,
    lesson_id: adapted.lesson_id,
    teacher_id: adapted.teacher_id,
    cluster_id: adapted.cluster_id,
    head_version: versionSummary(head),
    versions: versions.map(versionSummary),
  };
}

// POST /api/adapt — Generate adapted lesson plan
router.post('/adapt', requireAuth, async (req, res) => {
  const { lesson_id, cluster_id, kb_ids, include_student_context } = req.body;
  if (!lesson_id || !cluster_id) return res.status(400).json({ error: 'lesson_id and cluster_id required' });
  try {
    const result = await adaptationService.generate({
      teacherId: req.user.teacher_id,
      lessonId: lesson_id,
      clusterId: cluster_id,
      kbIds: kb_ids || [],
      includeStudentContext: include_student_context !== false,
    });
    const out = adaptationOut(result.adaptedId);
    if (out.error) return res.status(404).json({ error: out.error });
    res.status(201).json(out);
  } catch (e) {
    if (e.message.includes('No LLM configured')) return res.status(400).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// POST /api/adaptations/:adapted_id/refine — Refine with feedback
router.post('/adaptations/:adapted_id/refine', requireAuth, requireAdaptationOwner, async (req, res) => {
  const { instruction } = req.body;
  if (!instruction) return res.status(400).json({ error: 'instruction required' });
  try {
    await adaptationService.refine({
      teacherId: req.user.teacher_id,
      adaptedId: parseInt(req.params.adapted_id),
      instruction,
    });
    res.json(adaptationOut(parseInt(req.params.adapted_id)));
  } catch (e) {
    if (e.message.includes('not found')) return res.status(404).json({ error: e.message });
    if (e.message.includes('No LLM configured')) return res.status(400).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// GET /api/adaptations/:adapted_id — Get adaptation with head version
router.get('/adaptations/:adapted_id', requireAuth, requireAdaptationOwner, (req, res) => {
  const out = adaptationOut(parseInt(req.params.adapted_id));
  if (out.error) return res.status(404).json({ error: out.error });
  res.json(out);
});

// GET /api/adaptations/:adapted_id/versions — List all versions
router.get('/adaptations/:adapted_id/versions', requireAuth, requireAdaptationOwner, (req, res) => {
  const versions = versioningService.listVersions(parseInt(req.params.adapted_id));
  res.json(versions.map(versionSummary));
});

// GET /api/adaptations/:adapted_id/versions/:version_id — Get version detail
router.get('/adaptations/:adapted_id/versions/:version_id', requireAuth, requireAdaptationOwner, (req, res) => {
  const v = db.prepare("SELECT * FROM lesson_plan_version WHERE version_id = ? AND adapted_id = ?").get(
    parseInt(req.params.version_id), parseInt(req.params.adapted_id)
  );
  if (!v) return res.status(404).json({ error: 'version not found' });
  res.json({
    ...versionSummary(v),
    rendered_html: v.rendered_html,
    plan_json: versioningService.parsePlanJson(v),
  });
});

// POST /api/adaptations/:adapted_id/rollback — Rollback to previous version
router.post('/adaptations/:adapted_id/rollback', requireAuth, requireAdaptationOwner, (req, res) => {
  const { version_id } = req.body;
  if (!version_id) return res.status(400).json({ error: 'version_id required' });
  try {
    versioningService.rollbackTo(parseInt(req.params.adapted_id), version_id);
    res.json(adaptationOut(parseInt(req.params.adapted_id)));
  } catch (e) {
    if (e.message.includes('not found')) return res.status(404).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// GET /api/adaptations/:adapted_id/versions/:version_id/print — Print as HTML
router.get('/adaptations/:adapted_id/versions/:version_id/print', requireAuth, requireAdaptationOwner, (req, res) => {
  const v = db.prepare("SELECT rendered_html FROM lesson_plan_version WHERE version_id = ? AND adapted_id = ?").get(
    parseInt(req.params.version_id), parseInt(req.params.adapted_id)
  );
  if (!v) return res.status(404).json({ error: 'version not found' });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(v.rendered_html);
});

// GET /api/adaptations/:adapted_id/versions/:version_id/export.html — Download as HTML file
router.get('/adaptations/:adapted_id/versions/:version_id/export.html', requireAuth, requireAdaptationOwner, (req, res) => {
  const v = db.prepare("SELECT rendered_html, version_number FROM lesson_plan_version WHERE version_id = ? AND adapted_id = ?").get(
    parseInt(req.params.version_id), parseInt(req.params.adapted_id)
  );
  if (!v) return res.status(404).json({ error: 'version not found' });
  const filename = `adapt-lesson-${req.params.adapted_id}-v${v.version_number}.html`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(v.rendered_html);
});

// POST /api/adaptations/:adapted_id/feedback — Submit feedback
router.post('/adaptations/:adapted_id/feedback', requireAuth, (req, res) => {
  const adaptedId = parseInt(req.params.adapted_id);
  const adapted = db.prepare("SELECT teacher_id FROM adapted_lesson WHERE adapted_id = ?").get(adaptedId);
  if (!adapted) return res.status(404).json({ error: 'Adaptation not found' });
  if (adapted.teacher_id !== req.user.teacher_id) return res.status(403).json({ error: 'Access denied' });

  const { rating, comments } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' });

  const result = db.prepare(
    "INSERT INTO adaptation_feedback (adapted_id, rating, comments) VALUES (?, ?, ?)"
  ).run(adaptedId, rating, comments || null);

  res.json({ ok: true, feedback_id: result.lastInsertRowid });
});

module.exports = router;
