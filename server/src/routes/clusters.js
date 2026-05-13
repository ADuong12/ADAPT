const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const { requireOwnerOrAdmin } = require('../middleware/rbac');
const { NotFoundError } = require('../errors');

const router = express.Router();

// GET /api/clusters - list clusters with counts (CLUS-01)
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT sc.cluster_id, sc.cluster_name, sc.cluster_description,
           COUNT(DISTINCT ck.kb_id) as kb_count,
           COUNT(DISTINCT s.student_id) as student_count
    FROM student_cluster sc
    LEFT JOIN cluster_kb ck ON sc.cluster_id = ck.cluster_id
    LEFT JOIN student s ON sc.cluster_id = s.cluster_id
    GROUP BY sc.cluster_id
    ORDER BY sc.cluster_id
  `).all();

  res.json(rows);
});

// GET /api/clusters/:id/kbs - cluster KBs (CLUS-02)
router.get('/:id/kbs', requireAuth, (req, res) => {
  const clusterId = parseInt(req.params.id);

  const cluster = db.prepare(
    'SELECT cluster_id FROM student_cluster WHERE cluster_id = ?'
  ).get(clusterId);

  if (!cluster) {
    throw new NotFoundError('Cluster');
  }

  const rows = db.prepare(`
    SELECT kb.kb_id, kb.kb_name, kb.category, kb.description, kb.source_url
    FROM knowledge_base kb
    JOIN cluster_kb ck ON kb.kb_id = ck.kb_id
    WHERE ck.cluster_id = ?
    ORDER BY kb.category, kb.kb_name
  `).all(clusterId);

  res.json(rows);
});

// PUT /api/clusters/:id/kbs - update KB assignments (CLUS-03)
router.put('/:id/kbs', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const clusterId = parseInt(req.params.id);
  const { kb_ids } = req.body || {};
  const kbIdsArray = Array.isArray(kb_ids) ? kb_ids : [];

  // Verify cluster exists
  const cluster = db.prepare(
    'SELECT cluster_id FROM student_cluster WHERE cluster_id = ?'
  ).get(clusterId);

  if (!cluster) {
    throw new NotFoundError('Cluster');
  }

  // Validate all kb_ids exist
  if (kbIdsArray.length > 0) {
    const placeholders = kbIdsArray.map(() => '?').join(',');
    const query = `SELECT kb_id FROM knowledge_base WHERE kb_id IN (${placeholders})`;
    const foundKbs = db.prepare(query).all(...kbIdsArray);

    if (foundKbs.length !== kbIdsArray.length) {
      const foundIds = new Set(foundKbs.map(kb => kb.kb_id));
      const missingIds = kbIdsArray.filter(id => !foundIds.has(id));
      throw new NotFoundError(`knowledge base id(s) not found: ${missingIds.join(', ')}`);
    }
  }

  // Replace all KBs in a transaction
  const transaction = db.transaction((clusterId, kbIds) => {
    db.prepare('DELETE FROM cluster_kb WHERE cluster_id = ?').run(clusterId);

    if (kbIds.length > 0) {
      const insert = db.prepare('INSERT INTO cluster_kb (cluster_id, kb_id) VALUES (?, ?)');
      for (const kbId of kbIds) {
        insert.run(clusterId, kbId);
      }
    }
  });

  transaction.run(clusterId, kbIdsArray);

  // Return updated KBs
  const rows = db.prepare(`
    SELECT kb.kb_id, kb.kb_name, kb.category, kb.description, kb.source_url
    FROM knowledge_base kb
    JOIN cluster_kb ck ON kb.kb_id = ck.kb_id
    WHERE ck.cluster_id = ?
    ORDER BY kb.category, kb.kb_name
  `).all(clusterId);

  res.json(rows);
});

module.exports = router;
