# Requirements: ADAPT

**Defined:** 2026-05-11
**Core Value:** Teachers can generate personalized, RAG-augmented lesson plans adapted for their specific learner clusters

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can register a new account with email and password
- [ ] **AUTH-02**: User can log in with credentials and receive a JWT token
- [ ] **AUTH-03**: Seeded teachers can set password on first login via dedicated endpoint
- [ ] **AUTH-04**: Authenticated API routes reject requests without a valid JWT
- [ ] **AUTH-05**: Teachers can only access their own data (tenant isolation)
- [ ] **AUTH-06**: Admins can access all data across the system

### Security

- [ ] **SEC-01**: API keys are encrypted at rest with AES-256-GCM
- [ ] **SEC-02**: Passwords are hashed with bcryptjs before storage
- [ ] **SEC-03**: JWT tokens expire and can be refreshed
- [ ] **SEC-04**: RBAC middleware enforces role-based access on all routes
- [ ] **SEC-05**: Fernet migration script converts existing encrypted keys

### Lessons

- [ ] **LESS-01**: User can list all lessons with pagination
- [ ] **LESS-02**: User can view a single lesson by ID
- [ ] **LESS-03**: User can browse lesson source files
- [ ] **LESS-04**: User can search/filter lessons

### Clusters

- [ ] **CLUS-01**: User can list all learner clusters
- [ ] **CLUS-02**: User can view cluster details with student list
- [ ] **CLUS-03**: User can manage cluster-KB assignments
- [ ] **CLUS-04**: User can update cluster assignments

### Teachers

- [ ] **TEACH-01**: Teacher can view their dashboard with metrics
- [ ] **TEACH-02**: Teacher can view their classes and students
- [ ] **TEACH-03**: Teacher can update student cluster assignments
- [ ] **TEACH-04**: Teacher can view and edit their profile
- [ ] **TEACH-05**: Teacher can manage their own classes

### Settings

- [ ] **SETT-01**: Teacher can configure LLM provider settings
- [ ] **SETT-02**: Teacher can store encrypted API keys
- [ ] **SETT-03**: Teacher can test LLM connection
- [ ] **SETT-04**: Teacher can select preferred LLM model
- [ ] **SETT-05**: Settings persist across sessions

### Admin

- [ ] **ADMIN-01**: Admin can view institution-level overview
- [ ] **ADMIN-02**: Admin can view teacher list
- [ ] **ADMIN-03**: Admin can view classes and clusters
- [ ] **ADMIN-04**: Admin can manage system-wide settings

### RAG Pipeline

- [ ] **RAG-01**: Knowledge base documents are chunked and embedded
- [ ] **RAG-02**: Chunks are stored in ChromaDB vector store
- [ ] **RAG-03**: Semantic retrieval returns relevant chunks for a query

### LLM

- [ ] **LLM-01**: OpenRouter provider adapter sends prompts and receives responses
- [ ] **LLM-02**: LLM responses are parsed and structured

### Rendering

- [ ] **RENDER-01**: Adapted lesson plans are rendered as formatted HTML via templates

### Adaptation

- [ ] **ADAPT-01**: Teacher can generate an adapted lesson plan using RAG + LLM
- [ ] **ADAPT-02**: Teacher can view adaptation version history
- [ ] **ADAPT-03**: Teacher can refine an adaptation with feedback
- [ ] **ADAPT-04**: Teacher can rollback to a previous version
- [ ] **ADAPT-05**: Teacher can submit feedback on adaptations
- [ ] **ADAPT-06**: Version chain is immutable (head pointer pattern)
- [ ] **ADAPT-07**: Adaptations are scoped to owning teacher only
- [ ] **ADAPT-08**: Teacher can print lesson plan versions as HTML
- [ ] **ADAPT-09**: Teacher can export lesson plan versions
- [ ] **ADAPT-10**: Adaptation uses RAG-retrieved context from knowledge bases

### Source File Editing

- [ ] **SRC-01**: User can upload DOCX source files for AI editing
- [ ] **SRC-02**: User can upload PPTX source files for AI editing
- [ ] **SRC-03**: User can upload PDF source files for extraction
- [ ] **SRC-04**: User can download edited source files

### Frontend

- [ ] **FE-01**: User can log in through React page with protected route enforcement
- [ ] **FE-02**: User can register through React page
- [ ] **FE-03**: Seeded teachers see first-login password setup page
- [ ] **FE-04**: Teacher can view dashboard with metrics, roster, recent adaptations
- [ ] **FE-05**: Teacher can select lesson + cluster + KBs to generate adapted plan
- [ ] **FE-06**: Teacher can refine, rollback, provide feedback, and export in workspace
- [x] **FE-07**: Teacher can manage classes
- [x] **FE-08**: Teacher can browse lessons and knowledge bases
- [x] **FE-09**: Teacher can configure LLM settings
- [x] **FE-10**: Teacher can print and export plans
- [ ] **FE-11**: Unauthenticated users are redirected to login
- [ ] **FE-12**: Shared layout with navigation across all pages

### Testing

- [ ] **TEST-01**: All authenticated data endpoints have passing automated tests
- [ ] **TEST-02**: Auth flows (register, login, JWT, RBAC) pass automated tests
- [ ] **TEST-03**: RAG pipeline endpoints tested with real embedding/retrieval
- [ ] **TEST-04**: Tests run without requiring separately started server

## v2 Requirements

### Notifications

- **NOTF-01**: User receives in-app notifications for adaptation completion
- **NOTF-02**: User receives email for shared lesson plans

### Collaboration

- **COLLAB-01**: Teachers can share lesson plans with colleagues
- **COLLAB-02**: Teachers can fork and modify shared plans

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | Web-first, mobile later |
| Real-time collaboration | Not core to lesson adaptation value |
| Multi-tenant SaaS | Single-school deployment for v1 |
| Video content | Storage/bandwidth costs, defer to v2+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| SEC-05 | Phase 1 | Complete |
| LESS-01 | Phase 2 | Pending |
| LESS-02 | Phase 2 | Pending |
| LESS-03 | Phase 2 | Pending |
| LESS-04 | Phase 2 | Pending |
| CLUS-01 | Phase 2 | Pending |
| CLUS-02 | Phase 2 | Pending |
| CLUS-03 | Phase 2 | Pending |
| CLUS-04 | Phase 2 | Pending |
| TEACH-01 | Phase 2 | Pending |
| TEACH-02 | Phase 2 | Pending |
| TEACH-03 | Phase 2 | Pending |
| TEACH-04 | Phase 2 | Pending |
| TEACH-05 | Phase 2 | Pending |
| SETT-01 | Phase 2 | Pending |
| SETT-02 | Phase 2 | Pending |
| SETT-03 | Phase 2 | Pending |
| SETT-04 | Phase 2 | Pending |
| SETT-05 | Phase 2 | Pending |
| ADMIN-01 | Phase 2 | Pending |
| ADMIN-02 | Phase 2 | Pending |
| ADMIN-03 | Phase 2 | Pending |
| ADMIN-04 | Phase 2 | Pending |
| RAG-01 | Phase 3 | Pending |
| RAG-02 | Phase 3 | Pending |
| RAG-03 | Phase 3 | Pending |
| LLM-01 | Phase 3 | Pending |
| LLM-02 | Phase 3 | Pending |
| RENDER-01 | Phase 3 | Pending |
| ADAPT-01 | Phase 3 | Pending |
| ADAPT-02 | Phase 3 | Pending |
| ADAPT-03 | Phase 3 | Pending |
| ADAPT-04 | Phase 3 | Pending |
| ADAPT-05 | Phase 3 | Pending |
| ADAPT-06 | Phase 3 | Pending |
| ADAPT-07 | Phase 3 | Pending |
| ADAPT-08 | Phase 3 | Pending |
| ADAPT-09 | Phase 3 | Pending |
| ADAPT-10 | Phase 3 | Pending |
| SRC-01 | Phase 3 | Pending |
| SRC-02 | Phase 3 | Pending |
| SRC-03 | Phase 3 | Pending |
| SRC-04 | Phase 3 | Pending |
| FE-01 | Phase 4 | Pending |
| FE-02 | Phase 4 | Pending |
| FE-03 | Phase 4 | Pending |
| FE-04 | Phase 4 | Pending |
| FE-05 | Phase 4 | Pending |
| FE-06 | Phase 4 | Pending |
| FE-07 | Phase 4 | Complete |
| FE-08 | Phase 4 | Complete |
| FE-09 | Phase 4 | Complete |
| FE-10 | Phase 4 | Complete |
| FE-11 | Phase 4 | Pending |
| FE-12 | Phase 4 | Pending |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 5 | Pending |
| TEST-03 | Phase 5 | Pending |
| TEST-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-11*
*Last updated: 2026-05-11 after initial definition*
