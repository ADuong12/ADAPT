const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// GET /api/knowledge-bases - list all knowledge bases
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT kb_id, kb_name, category, description, source_url FROM knowledge_base ORDER BY category, kb_name'
  ).all();

  res.json(rows);
});

module.exports = router;
