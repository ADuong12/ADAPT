# Phase 4: React Frontend - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the full React SPA frontend with all 12 pages: auth (login, register, first-login password setup), dashboard, lesson personalization (stepper wizard), adaptation workspace (version timeline + preview + refine/export), my classes, lesson library, knowledge base browser, settings (LLM config), and print/export. Replaces the static HTML prototype with a modern React app that talks to the existing Express API.

</domain>

<decisions>
## Implementation Decisions

### Component Architecture
- **D-01:** Use shared layout component with React Router `<Outlet />` pattern. A top-level `AppLayout` component renders sidebar + navigation + main content area, keeping each page component focused on content only.
- **D-02:** Page-per-file organization — one file per page (Dashboard, Settings, Workspace, etc.) with sub-components defined in the same file. Simpler for 12 pages, mirrors the prototype's one-file-per-page structure.
- **D-03:** Plain CSS with custom properties. The prototype's existing `style.css` with CSS variables (`--bg`, `--accent`, `--radius`, `--font`, etc.) carries forward directly. Global stylesheet for shared styles + per-page CSS where needed.
- **D-04:** React-only state management (useState, useReducer, useContext). No external state library. Auth state managed via AuthContext. Each page fetches and manages its own data independently — matches the prototype's per-page state pattern.

### Data Fetching Pattern
- **D-05:** Custom `useApi` hook wrapping fetch + JWT auth header injection + error handling. Direct React port of the prototype's `ADAPT_API.request()` pattern. Lightweight, no external dependencies, easy to understand.
- **D-06:** Data fetching via useEffect + useApi on page mount. Simple and predictable pattern. Pages handle their own loading/error states.
- **D-07:** Page-level data fetching — each page fetches its own data independently. No shared data cache or prefetching across pages. Matches the prototype where each HTML page loads its own data.

### Auth Flow & Routing
- **D-08:** React Router v6 with BrowserRouter. All 12 prototype pages map to routes (e.g., `/dashboard`, `/settings`, `/personalize`, `/workspace/:adaptedId`).
- **D-09:** AuthContext provides user + token. `ProtectedRoute` wrapper redirects to `/login` if no token. `AdminRoute` checks role. Mirrors the prototype's `requireLogin()` + admin link hiding.
- **D-10:** JWT tokens stored in localStorage — matching the prototype's `authToken`, `teacherId`, `teacherRole`, `teacherName` keys. No httpOnly cookies or backend cookie changes needed.

### Adaptation Workspace UX
- **D-11:** Workspace layout mirrors the prototype's 3-column grid: version timeline (left), rendered HTML preview (center), refine + feedback panel (right). CSS grid with responsive single-column fallback below 1100px.
- **D-12:** Adapted lesson preview rendered inside a sandboxed iframe (`sandbox="allow-same-origin"`). Isolates lesson plan CSS from the app, prevents style bleed — exact match of prototype pattern.
- **D-13:** Lesson personalization flow uses a multi-step stepper wizard (select lesson → pick cluster → review KB sources → generate). Matches the prototype's `personalize.html` 4-step flow exactly.

### the agent's Discretion
- File structure within `src/` (pages vs components vs hooks subdirectories)
- Whether to extract shared UI elements (Card, Badge, MetricBar) into reusable components or keep inline
- Toast notification implementation (simple div vs library)
- Error boundary placement and error page design
- Loading state design (spinners, skeletons, or placeholder text)
- Whether the first-login password setup page reuses the login form or has its own component
- Print page implementation (dedicated route vs modal)
- Admin pages layout (shared admin layout vs individual pages)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Static HTML Prototype (reference implementation for all 12 pages)
- `adapt-frontend-prototype-echristian-aduong/api.js` — Shared fetch wrapper with JWT auth, token management, error handling
- `adapt-frontend-prototype-echristian-aduong/auth.js` — Auth gate: redirect if no token, sidebar footer with user name, logout
- `adapt-frontend-prototype-echristian-aduong/style.css` — Full CSS design system with custom properties, component classes, responsive breakpoints
- `adapt-frontend-prototype-echristian-aduong/login.html` — Login + register toggle form, localStorage token storage, redirect to dashboard
- `adapt-frontend-prototype-echristian-aduong/dashboard.html` — Teacher dashboard: metrics, recent adaptations, student roster
- `adapt-frontend-prototype-echristian-aduong/personalize.html` — Multi-step wizard: lesson selection → cluster → KB sources → generate
- `adapt-frontend-prototype-echristian-aduong/results.html` — Workspace: version timeline, iframe preview, refine, feedback, diff, rollback, export
- `adapt-frontend-prototype-echristian-aduong/settings.html` — LLM provider config form with save/test
- `adapt-frontend-prototype-echristian-aduong/my-classes.html` — Class roster with student cluster assignment editing
- `adapt-frontend-prototype-echristian-aduong/lesson-library.html` — Lesson listing + search + AI source file editing
- `adapt-frontend-prototype-echristian-aduong/kb-browser.html` — KB listing + cluster-to-KB mapping editor
- `adapt-frontend-prototype-echristian-aduong/print.html` — Print preview with iframe and browser print()
- `adapt-frontend-prototype-echristian-aduong/admin-dashboard.html` — Admin overview
- `adapt-frontend-prototype-echristian-aduong/admin-classes.html` — Admin classes view
- `adapt-frontend-prototype-echristian-aduong/admin-teachers.html` — Admin teachers list

### Express Server (API integration)
- `server/src/routes/index.js` — Route registration pattern (all `/api/*` endpoints)
- `server/src/middleware/auth.js` — JWT requireAuth middleware (token validation)
- `server/src/middleware/rbac.js` — requireRole and requireOwnerOrAdmin middleware

### Database Schema
- `adapt-database.sql` — Full DDL for all tables (lesson, student, cluster, adapted_lesson, etc.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api.js` (prototype): Complete fetch wrapper with JWT auth header injection, token management (`authToken()`, `teacherId()`, `teacherRole()`), error parsing. Direct port target for `useApi` hook.
- `auth.js` (prototype): Auth gate pattern — redirect to login if no token, sidebar footer with user info, logout via `localStorage.clear()`. Maps directly to React AuthContext + ProtectedRoute.
- `style.css` (prototype): Full CSS design system with CSS custom properties (`--bg`, `--surface`, `--text`, `--accent`, `--radius`, `--font`, `--font-display`, `--sidebar-width`, etc.) plus component classes (`.card`, `.badge`, `.check-row`, `.metric`, `.pill`, `.step-wrap`, `.progress-bar`, `.toast`, etc.). Copy-port baseline, then convert to per-page CSS imports.

### Established Patterns
- Sidebar navigation: 6 nav items (Dashboard, My Classes, Lesson Library, Knowledge Bases, Plan a Lesson, Admin) with active state highlighting. Admin link hidden for non-admin roles.
- Page titles: `.page-title` + `.page-subtitle` pattern at top of each page
- Toast notifications: Fixed-position toast at bottom-right with success/error styling. Used across all pages.
- Form elements: Consistent `.form-row` pattern with label + input/select/textarea
- API error handling: Parse JSON error responses, show in toast or inline status

### Integration Points
- All API endpoints are under `/api/*` — the React app proxies to Express in development
- JWT token from `/api/auth/login` and `/api/auth/register` responses (`accessToken` + `user` object)
- `/api/auth/me` returns current user profile (used in prototype to get `teacherName`)
- Teacher-scoped endpoints use `teacherId` from JWT (not from URL params)
- Admin endpoints require `role === 'admin'`
- Adaptation workspace: `/api/adapt`, `/api/adaptations/:id`, `/api/adaptations/:id/refine`, `/api/adaptations/:id/versions/:vId`, rollback, feedback, export, print
- Source file editing: `/api/lessons/:id/edit-source-file`, `/api/lessons/:id/source-files`

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the prototype reference — the React app should replicate the prototype's page structure, navigation flow, and user interactions faithfully.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-React Frontend*
*Context gathered: 2026-05-13*