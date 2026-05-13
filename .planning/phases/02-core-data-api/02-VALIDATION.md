---
phase: 02
slug: core-data-api
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-12
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node.js built-in test runner) |
| **Config file** | none — built-in, configured in package.json scripts |
| **Quick run command** | `cd server && node --test tests/routes/lessons.test.js` |
| **Full suite command** | `cd server && node --test tests/` |
| **Estimated runtime** | ~30 seconds (integration tests require running server) |

---

## Sampling Rate

- **After every task commit:** Run `cd server && node --test tests/routes/{file}.test.js`
- **After every plan wave:** Run `cd server && node --test tests/`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | LESS-01 | T-02-05 | requireAuth on all lesson routes | integration | `cd server && node --test tests/routes/lessons.test.js` | ✅ | ✅ green |
| 02-01-01 | 01 | 1 | LESS-02 | — | N/A | integration | `cd server && node --test tests/routes/lessons.test.js` | ✅ | ✅ green |
| 02-01-01 | 01 | 1 | LESS-03 | — | 501 stub prevents data access | integration | `cd server && node --test tests/routes/lessons.test.js` | ✅ | ✅ green |
| 02-01-01 | 01 | 1 | LESS-04 | T-02-01 | Parameterized LIKE queries prevent SQL injection | integration | `cd server && node --test tests/routes/lessons.test.js` | ✅ | ✅ green |
| 02-01-02 | 01 | 1 | CLUS-01 | — | N/A | integration | `cd server && node --test tests/routes/clusters.test.js` | ✅ | ✅ green |
| 02-01-02 | 01 | 1 | CLUS-02 | — | N/A | integration | `cd server && node --test tests/routes/clusters.test.js` | ✅ | ✅ green |
| 02-01-02 | 01 | 1 | CLUS-03 | T-02-02 | requireOwnerOrAdmin on PUT /:id/kbs | integration | `cd server && node --test tests/routes/clusters.test.js` | ✅ | ✅ green |
| 02-01-03 | 01 | 1 | CLUS-04 | — | Traced to TEACH-03 | integration | `cd server && node --test tests/routes/teachers.test.js` | ✅ | ✅ green |
| 02-02-01 | 02 | 1 | TEACH-01 | T-02-10 | requireAuth + requireOwnerOrAdmin on dashboard | integration | `cd server && node --test tests/routes/teachers.test.js` | ✅ | ✅ green |
| 02-02-01 | 02 | 1 | TEACH-02 | — | N/A | integration | `cd server && node --test tests/routes/teachers.test.js` | ✅ | ✅ green |
| 02-02-02 | 02 | 1 | TEACH-03 | T-02-07 | Verify student belongs to teacher via JOIN before PATCH | integration | `cd server && node --test tests/routes/teachers.test.js` | ✅ | ✅ green |
| 02-02-02 | 02 | 1 | TEACH-04 | T-02-08 | PUT profile only allows first_name/last_name (no email/role) | integration | `cd server && node --test tests/routes/teachers.test.js` | ✅ | ✅ green |
| 02-02-02 | 02 | 1 | TEACH-05 | — | Merged with TEACH-02 | integration | `cd server && node --test tests/routes/teachers.test.js` | ✅ | ✅ green |
| 02-03-01 | 03 | 2 | SETT-01 | T-02-11 | redact() on all responses, never return raw api_key | integration | `cd server && node --test tests/routes/settings.test.js` | ✅ | ✅ green |
| 02-03-01 | 03 | 2 | SETT-02 | T-02-12 | Fernet/AES-256-GCM encrypt before storage, zod validation on body | integration | `cd server && node --test tests/routes/settings.test.js` | ✅ | ✅ green |
| 02-03-01 | 03 | 2 | SETT-03 | — | 501 stub | integration | `cd server && node --test tests/routes/settings.test.js` | ✅ | ✅ green |
| 02-03-01 | 03 | 2 | SETT-04 | — | Model field in PUT body | integration | `cd server && node --test tests/routes/settings.test.js` | ✅ | ✅ green |
| 02-03-01 | 03 | 2 | SETT-05 | — | Database storage | integration | `cd server && node --test tests/routes/settings.test.js` | ✅ | ✅ green |
| 02-03-02 | 03 | 2 | ADMIN-01 | T-02-14 | requireRole('admin') on all routes, institution-scoped | integration | `cd server && node --test tests/routes/admin.test.js` | ✅ | ✅ green |
| 02-03-02 | 03 | 2 | ADMIN-02 | T-02-15 | Admin role required | integration | `cd server && node --test tests/routes/admin.test.js` | ✅ | ✅ green |
| 02-03-02 | 03 | 2 | ADMIN-03 | — | N/A | integration | `cd server && node --test tests/routes/admin.test.js` | ✅ | ✅ green |
| 02-03-02 | 03 | 2 | ADMIN-04 | — | 501 stub | integration | `cd server && node --test tests/routes/admin.test.js` | ✅ | ✅ green |
| — | — | — | CRYPTO | T-02-13 | Encrypt/decrypt round-trip, redact masks correctly | unit | `cd server && node --test tests/crypto.test.js` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. node:test framework is built-in to Node.js 18+. No additional installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-session LLM config persistence after server restart | SETT-05 | Requires server restart between store and retrieve | 1. Start server, PUT /api/teachers/1/llm-config 2. Restart server 3. GET /api/teachers/1/llm-config → verify redacted key present |
| Provider deactivation across server restarts | SETT-02 | Requires server restart to verify is_active flag persisted | 1. PUT two providers for same teacher 2. Restart server 3. GET llm-config → verify only latest is active |

---

## Validation Audit 2026-05-12

| Metric | Count |
|--------|-------|
| Gaps found | 5 |
| Resolved | 5 |
| Escalated | 0 |

### Gap Details

1. **TEACH-03** — Missing test for PATCH with non-existent cluster_id (→ 404) and student not in teacher's classes (→ 404). **Resolved:** Added 2 tests to teachers.test.js.
2. **TEACH-04** — Missing test for PUT profile with empty first_name/last_name validation (→ 400). **Resolved:** Added 3 tests to teachers.test.js.
3. **SETT-01** — Missing test for cross-tenant LLM config access (→ 403). **Resolved:** Added 2 tests to settings.test.js.
4. **SETT-02** — Missing test for PUT LLM config with missing required fields (→ 400). **Resolved:** Added 2 tests to settings.test.js.
5. **CRYPTO** — No unit tests for encrypt/decrypt/redact functions. **Resolved:** Created crypto.test.js with 12 tests.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none needed — existing infra)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-12