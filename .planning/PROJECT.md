# ADAPT

## What This Is

ADAPT is an AI-Driven Personalized Lesson Planning Tool being rewritten from Python/FastAPI to Node.js/Express 5 + React. It uses RAG and LLMs to adapt K-12 CS lessons for diverse learner clusters. The rewrite replaces the existing Python backend and static HTML frontend with a modern JS stack.

## Core Value

Teachers can generate personalized, RAG-augmented lesson plans adapted for their specific learner clusters — with versioning, refinement, and source file editing.

## Requirements

### Validated

- ✓ FastAPI + SQLite backend with RAG pipeline — existing Python implementation
- ✓ ChromaDB vector store with sentence-transformers embeddings — existing
- ✓ LLM adapters (Gemini, OpenRouter, HuggingFace) — existing
- ✓ Lesson versioning with immutable version chains — existing
- ✓ Source file editing (DOCX, PPTX, PDF) — existing
- ✓ Learner cluster management — existing

### Active

- [ ] Express 5 backend with JWT auth and RBAC
- [ ] All CRUD data endpoints ported with auth enforcement
- [ ] RAG pipeline + OpenRouter LLM adaptation engine
- [ ] React SPA frontend (12 pages)
- [ ] Automated test suite

### Out of Scope

- Mobile app — web-first, mobile later
- Real-time collaboration — not core to lesson adaptation
- Multi-tenant SaaS — single-teacher/school deployment for v1

## Context

- Existing Python/FastAPI codebase in `backend/`, `server/`, `scripts/`
- Static HTML frontend in `adapt-frontend-prototype-echristian-aduong/`
- SQLite database (`adapt.db`) with existing schema
- Knowledge bases in `Knowledge Bases/` directory
- Sample lessons in `Sample Lessons/` directory
- Rewrite targets Node.js/Express 5 + React (Vite)

## Constraints

- **Tech Stack**: Node.js/Express 5 backend, React (Vite) frontend, SQLite DB
- **Auth**: bcryptjs + JWT, AES-256-GCM for API key encryption
- **LLM**: OpenRouter as primary provider (replaces multi-provider Python setup)
- **RAG**: ChromaDB + sentence-transformers (port from Python)
- **Mode**: MVP vertical-slice approach for all phases

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rewrite from Python to Node.js/React | Modernize stack, single language throughout | — Pending |
| Express 5 over Fastify | Express ecosystem maturity, Express 5 async improvements | — Pending |
| OpenRouter as primary LLM | Single provider simplifies config, multi-model access | — Pending |
| SQLite retained | Sufficient for single-school deployment, zero config | — Pending |
| MVP vertical-slice phasing | Each phase delivers working user capability | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-11 after initialization*
