const express = require('express');
const { z } = require('zod');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const { requireOwnerOrAdmin } = require('../middleware/rbac');
const { NotFoundError, ValidationError } = require('../errors');
const { encrypt, decrypt, redact } = require('../services/crypto');

const router = express.Router();

const llmConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().optional(),
  api_key: z.string().min(4).max(512)
});

const ALLOWED_PROVIDERS = ['openrouter', 'openai', 'anthropic'];

// GET /api/teachers/:id/llm-config (SETT-01, SETT-02, SETT-04, SETT-05)
router.get('/:id/llm-config', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);

  const cfg = db.prepare(
    'SELECT provider, model, api_key_encrypted, is_active FROM llm_provider_config WHERE teacher_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1'
  ).get(teacherId);

  if (!cfg) {
    return res.json(null);
  }

  const decrypted = decrypt(cfg.api_key_encrypted);

  res.json({
    provider: cfg.provider,
    model: cfg.model,
    api_key_redacted: redact(decrypted),
    is_active: Boolean(cfg.is_active)
  });
});

// PUT /api/teachers/:id/llm-config (SETT-01, SETT-02, SETT-04, SETT-05)
router.put('/:id/llm-config', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);

  const parsed = llmConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid request body', parsed.error.errors);
  }

  const { provider, model, api_key } = parsed.data;

  if (!ALLOWED_PROVIDERS.includes(provider.toLowerCase())) {
    throw new ValidationError(`Invalid provider. Allowed: ${ALLOWED_PROVIDERS.join(', ')}`);
  }

  const encrypted = encrypt(api_key);

  // Check existing config
  const existing = db.prepare(
    'SELECT config_id, provider, model FROM llm_provider_config WHERE teacher_id = ? AND provider = ?'
  ).get(teacherId, provider.toLowerCase());

  if (existing) {
    db.prepare(
      'UPDATE llm_provider_config SET model = ?, api_key_encrypted = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE config_id = ?'
    ).run(model || null, encrypted, existing.config_id);
  } else {
    db.prepare(
      'INSERT INTO llm_provider_config (teacher_id, provider, model, api_key_encrypted, is_active) VALUES (?, ?, ?, ?, 1)'
    ).run(teacherId, provider.toLowerCase(), model || null, encrypted);
  }

  // Deactivate other providers
  db.prepare(
    'UPDATE llm_provider_config SET is_active = 0 WHERE teacher_id = ? AND provider != ?'
  ).run(teacherId, provider.toLowerCase());

  res.json({
    provider: provider.toLowerCase(),
    model: model || null,
    api_key_redacted: redact(api_key),
    is_active: true
  });
});

// POST /api/teachers/:id/llm-config/test (SETT-03 — Phase 3 stub)
router.post('/:id/llm-config/test', requireAuth, requireOwnerOrAdmin, (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    detail: 'LLM provider adapter requires RAG pipeline — available in Phase 3'
  });
});

module.exports = router;
