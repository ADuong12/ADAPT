# Roadmap: ADAPT

## Overview

ADAPT is being rewritten from Python/FastAPI to Node.js/Express 5 + React. The journey starts with a solid authentication and security foundation (Phase 1), then ports all existing CRUD data endpoints with real auth enforcement (Phase 2), then builds the core product value — RAG-augmented LLM adaptation, versioning, and source file editing (Phase 3), then replatforms the entire UI as a React SPA (Phase 4), and finally locks it down with comprehensive automated tests (Phase 5). Each phase delivers a verifiable, user-facing capability — not just a technical layer.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Auth** - Express setup, DB layer, bcryptjs+JWT auth, RBAC, encrypted API key storage
- [x] **Phase 2: Core Data API** - All CRUD endpoints ported with JWT auth enforcement (lessons, clusters, KBs, teachers, admin, settings)
- [x] **Phase 3: Adaptation Engine** - RAG pipeline, OpenRouter LLM, lesson adaptation+versioning, source file editing (DOCX/PPTX/PDF)
- [ ] **Phase 4: React Frontend** - Full React SPA with all 12 pages: auth, dashboard, workspace, settings, classes, library, print/export
- [ ] **Phase 5: Testing + Validation** - Automated test suite covering auth, all endpoints, RAG pipeline, and RBAC

## Phase Details

### Phase 1: Foundation + Auth
**Mode:** mvp
**Goal**: Users can securely register, authenticate, and access role-protected API endpoints
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. User can register a new account with email and password and receive a JWT token
  2. User can log in with credentials and receive a valid JWT token that persists across requests
  3. Seeded teachers can set their password on first login via a dedicated endpoint
  4. Authenticated API routes reject requests without a valid JWT
  5. Teachers can only access their own data; admins can access all data across the system
**Plans**: 3 plans

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Express 5 scaffolding, DB layer, schema init, seed data, register + login endpoints

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — JWT auth middleware, RBAC middleware, protected teacher routes, /api/auth/me

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — AES-256-GCM encryption module, Fernet migration script, error handler, env config

### Phase 2: Core Data API
**Mode:** mvp
**Goal**: All data endpoints return correct, auth-protected responses for lessons, clusters, teachers, settings, and admin
**Depends on**: Phase 1
**Requirements**: LESS-01, LESS-02, LESS-03, LESS-04, CLUS-01, CLUS-02, CLUS-03, CLUS-04, TEACH-01, TEACH-02, TEACH-03, TEACH-04, TEACH-05, SETT-01, SETT-02, SETT-03, SETT-04, SETT-05, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Success Criteria** (what must be TRUE):
  1. User can list, view, and browse lessons and source files via authenticated API
  2. User can manage cluster-KB assignments and browse knowledge bases
  3. Teacher can view their dashboard, see their classes and students, and update student cluster assignments
  4. Teacher can configure and test their LLM provider settings with encrypted API key storage
  5. Admin can view institution-level overview, teacher list, classes, and clusters
**Plans**: 3 plans

Plans:
**Wave 1** *(parallel execution)*
- [x] 02-01-PLAN.md — Lessons CRUD with pagination/search, Clusters CRUD with KB assignments, Knowledge Bases listing
- [x] 02-02-PLAN.md — Teacher dashboard rewrite, classes with nested students, student cluster assignment, profile view/edit

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-03-PLAN.md — LLM config CRUD with Fernet encryption, connection test stub, Admin institution overview endpoints

### Phase 3: Adaptation Engine
**Mode:** mvp
**Goal**: The core product value works end-to-end — teachers can generate, refine, version, and export adapted lesson plans using RAG + LLM, and edit source files
**Depends on**: Phase 2
**Requirements**: RAG-01, RAG-02, RAG-03, LLM-01, LLM-02, RENDER-01, ADAPT-01, ADAPT-02, ADAPT-03, ADAPT-04, ADAPT-05, ADAPT-06, ADAPT-07, ADAPT-08, ADAPT-09, ADAPT-10, SRC-01, SRC-02, SRC-03, SRC-04
**Success Criteria** (what must be TRUE):
  1. User can generate an adapted lesson plan that includes RAG-retrieved context from knowledge bases
  2. User can view adaptation versions, refine with feedback, rollback to previous versions, and submit feedback
  3. User can print and export lesson plan versions as HTML
  4. User can request AI-driven edits on DOCX, PPTX, and PDF source files and download the edited files
  5. Only the owning teacher can access their own adaptations
**Plans**: 3 plans

Plans:
**Wave 1** *(RAG + LLM foundation — required by Wave 2)
- [x] 03-01-PLAN.md — Python embed server, chunker, ChromaDB store, retriever, OpenRouter LLM adapter
**Wave 2** *(parallel execution — both depend on Wave 1)
- [x] 03-02-PLAN.md — Adaptation service (generate+refine), versioning (head pointer), EJS rendering, 9 adaptation routes
- [x] 03-03-PLAN.md — Source editor (DOCX/PPTX/PDF extraction + LLM rewrite + generation), file-edits routes

### Phase 4: React Frontend
**Mode:** mvp
**Goal**: Users interact with the full application through a modern React SPA
**Depends on**: Phase 2, Phase 3 (for adaptation/workspace pages)
**Requirements**: FE-01, FE-02, FE-03, FE-04, FE-05, FE-06, FE-07, FE-08, FE-09, FE-10, FE-11, FE-12
**Success Criteria** (what must be TRUE):
  1. User can log in and register through React pages with protected route enforcement (unauthenticated users redirected)
  2. Seeded teachers are directed to a first-login password setup page on initial access
  3. Teacher can view a dashboard with metrics, class roster, and recent adaptations
  4. Teacher can select a lesson + cluster + KBs to generate an adapted plan, then refine, rollback, provide feedback, and export versions
  5. Teacher can manage classes, browse lessons and knowledge bases, configure LLM settings, and print/export plans
**Plans**: 3 plans

Plans:
**Wave 1** *(auth shell + dashboard — required by Wave 2+)*
- [x] 04-01-PLAN.md — Auth shell: Vite scaffold, CSS port, useApi hook, AuthContext, ProtectedRoute, AdminRoute, AppLayout, LoginPage, SetupPasswordPage, DashboardPage

**Wave 2** *(data management pages — depends on Wave 1)*
- [x] 04-02-PLAN.md — Data pages: MyClassesPage, KBBrowserPage, SettingsPage, LessonLibraryPage, PrintPage, AdminDashboardPage, AdminTeachersPage, AdminClassesPage

**Wave 3** *(adaptation flow — depends on Wave 1)*
- [ ] 04-03-PLAN.md — Adaptation pages: PersonalizePage (4-step stepper wizard), WorkspacePage (3-column workspace with version timeline, iframe preview, refine, feedback, diff, rollback, export)

**UI hint**: yes

### Phase 5: Testing + Validation
**Mode:** mvp
**Goal**: All backend endpoints and auth flows are validated by an automated test suite
**Depends on**: Phase 3
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. All authenticated data endpoints have passing automated test coverage
  2. Auth flows (register, login, JWT validation, RBAC enforcement) pass automated tests
  3. RAG pipeline endpoints are tested with real embedding and retrieval scenarios
  4. Tests run without requiring a separately started server (in-process setup)
**Plans**: 2 plans

Plans:
- [ ] 05-01: Vitest setup, auth flow tests (register, login, JWT, RBAC), all CRUD endpoint tests
- [ ] 05-02: RAG pipeline tests, adaptation workflow integration tests, error handling and edge case coverage

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Auth | 3/3 | ✓ Complete | 2026-05-12 |
| 2. Core Data API | 3/3 | ✓ Complete | 2026-05-12 |
| 3. Adaptation Engine | 3/3 | ✓ Complete | 2026-05-13 |
| 4. React Frontend | 2/3 | ◐ In Progress | - |
| 5. Testing + Validation | 0/2 | Not started | - |
