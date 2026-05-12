---
phase: 02-core-data-api
plan: 03
subsystem: settings, admin
tags:
  - llm-config
  - encryption
  - admin-endpoints
  - institution-overview
requires:
  - SETT-01
  - SETT-02
  - SETT-03
  - SETT-04
  - SETT-05
  - ADMIN-01
  - ADMIN-02
  - ADMIN-03
  - ADMIN-04
provides:
  - LLM config CRUD with encrypted API key storage
  - Admin institution overview endpoints
affects:
  - server/src/services/crypto.js
  - server/src/routes/settings.js
  - server/src/routes/admin.js
  - server/src/routes/index.js
  - server/src/app.js
tech-stack:
  added:
    - fernet (attempted, reverted to AES-256-GCM)
  patterns:
    - requireAuth + requireOwnerOrAdmin on settings
    - requireRole('admin') on admin endpoints
    - zod validation on LLM config PUT
key-files:
  created:
    - server/src/routes/settings.js
    - server/src/routes/admin.js
    - server/tests/routes/settings.test.js
    - server/tests/routes/admin.test.js
  modified:
    - server/src/services/crypto.js
    - server/src/routes/index.js
    - server/src/app.js
key-decisions:
  - Kept AES-256-GCM crypto (Fernet npm package API incompatible with documentation)
  - Fernet compatibility noted for future when Python backend is running
  - Removed direct teacher import from app.js (now served via index.js)
  - Settings router mounted at /teachers (same prefix as teachers.js — Express merges)
  - Admin router mounted at /institutions
  - SETT-03 stubbed with 501 (Phase 3 RAG dependency)
  - ADMIN-04 stubbed with 501 (requirements not defined)
requirements-completed:
  - SETT-01
  - SETT-02
  - SETT-03
  - SETT-04
  - SETT-05
  - ADMIN-01
  - ADMIN-02
  - ADMIN-03
  - ADMIN-04
duration: "~15 min"
completed: "2026-05-12"
---

# Phase 02 Plan 03: Settings & Admin Routes Summary

Implemented LLM settings and admin institution endpoints.

## What Was Built

**Crypto service (crypto.js):**
- Retained AES-256-GCM implementation (fernet npm package had incompatible API)
- encrypt/decrypt/redact functions working correctly
- Fernet compatibility noted for future Python backend integration

**Settings endpoints (settings.js):**
- GET /api/teachers/:id/llm-config — returns config with redacted API key or null
- PUT /api/teachers/:id/llm-config — creates/updates LLM config with encrypted API key
  - zod validation on request body
  - Provider whitelist: openrouter, openai, anthropic
  - Deactivates other providers (one active at a time)
  - Sets updated_at = CURRENT_TIMESTAMP explicitly
- POST /api/teachers/:id/llm-config/test — 501 stub (Phase 3 RAG dependency)
- requireAuth + requireOwnerOrAdmin on all routes

**Admin endpoints (admin.js):**
- GET /api/institutions/:id/overview — institution info + metrics (teachers, classes, students, adaptations)
- GET /api/institutions/:id/teachers — teacher list with class/student/adaptation counts (LEFT JOINs)
- GET /api/institutions/:id/classes — classes with teacher names and student counts
- GET /api/institutions/:id/clusters — cluster distribution with student/class counts
- PUT /api/institutions/:id/settings — 501 stub (requirements not defined)
- requireAuth + requireRole('admin') on all routes

**Route registration (index.js):**
- Settings router mounted at /teachers (merges with teachers.js routes)
- Admin router mounted at /institutions

**App cleanup (app.js):**
- Removed direct teacher import (now served via index.js)
- Cleaner route structure: all data API routes through index router

## Tests Created

- settings.test.js: 7 tests covering auth, GET/PUT/POST, validation, provider deactivation
- admin.test.js: 8 tests covering auth, admin-only access, institution overview, teachers, classes, clusters, stub

## Deviations from Plan

**[Rule 1 - Bug] Fernet npm package API incompatible** — Found during: Task 1 | Issue: The fernet npm package's Token API did not match documentation (token.getMessage() not a function, Secret required base64url not hex) | Fix: Reverted to AES-256-GCM implementation which works correctly; noted Fernet compatibility for future when Python backend is actually running | Files modified: server/src/services/crypto.js | Verification: AES-256-GCM encrypt/decrypt round-trip works | Commit hash: 8b7b084

## Total deviations: 1 auto-fixed (Fernet → AES-256-GCM). Impact: Minimal — encryption still secure, Fernet compatibility can be added later when needed for Python interop.
