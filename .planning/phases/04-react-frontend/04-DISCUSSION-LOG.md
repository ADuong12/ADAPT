# Phase 4: React Frontend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 4-React Frontend
**Areas discussed:** Component Architecture, Data Fetching Pattern, Auth Flow & Routing, Adaptation Workspace UX

---

## Component Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Layout + Outlet | Shared layout with sidebar, pages inject via `<Outlet/>`. Matches prototype's app-layout pattern. | ✓ |
| Per-page layout | Each page manages own layout. Duplicates sidebar logic. | |
| You decide | Agent decides the pattern. | |

**User's choice:** Layout + Outlet
**Notes:** Recommended approach — matches the prototype's repeating sidebar pattern, keeps pages focused on content.

| Option | Description | Selected |
|--------|-------------|----------|
| Page-per-file | One file per page, sub-components inline. Simple for 12 pages. | ✓ |
| Shared + pages split | components/ directory for Card, Badge, etc. More files for simple UI. | |
| You decide | Agent decides. | |

**User's choice:** Page-per-file
**Notes:** Prototype is already one-file-per-page. Keeps things simple.

| Option | Description | Selected |
|--------|-------------|----------|
| Plain CSS | CSS files per component, matches prototype's style.css with custom properties. | ✓ |
| CSS Modules | Scoped styles per component. Adds build dependency. | |
| Tailwind CSS | Utility-first framework. Requires rewriting all prototype styles. | |

**User's choice:** Plain CSS
**Notes:** Prototype's style.css with CSS custom properties carries forward directly.

| Option | Description | Selected |
|--------|-------------|----------|
| React-only state | useState/useReducer/useContext. No external deps. Matches prototype's per-page state. | ✓ |
| Zustand/store | Global store for auth and API cache. Adds dependency. | |
| You decide | Agent decides. | |

**User's choice:** React-only state
**Notes:** 12 pages with no cross-page state beyond auth. Simple and sufficient.

---

## Data Fetching Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Custom useApi hook | Wraps fetch + auth headers + errors. React port of prototype's ADAPT_API. | ✓ |
| React Query | Full caching/refetch library. 60KB+ for 12 simple CRUD pages. | |
| You decide | Agent decides. | |

**User's choice:** Custom useApi hook
**Notes:** Direct React equivalent of the existing ADAPT_API pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| useEffect + useApi | Fetch on mount. Full control, matches prototype. | ✓ |
| Suspense + lazy | Start before render. More complex for marginal gain. | |
| You decide | Agent decides. | |

**User's choice:** useEffect + useApi
**Notes:** Simple and predictable for the page-level data pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Page-level fetching | Each page fetches independently. No cache coordination. | ✓ |
| Prefetch + cache | Shared data cache across pages. Over-fetches for simple pages. | |
| You decide | Agent decides. | |

**User's choice:** Page-level fetching
**Notes:** Matches prototype's per-page data loading pattern exactly.

---

## Auth Flow & Routing

| Option | Description | Selected |
|--------|-------------|----------|
| React Router v6 | BrowserRouter with nested routes. Standard SPA approach. | ✓ |
| Custom router | Build from scratch. Reinvents navigation patterns. | |
| You decide | Agent decides. | |

**User's choice:** React Router v6
**Notes:** Standard approach, all 12 pages map to clean URL routes.

| Option | Description | Selected |
|--------|-------------|----------|
| Context + route wrapper | AuthContext + ProtectedRoute redirect. Mirrors prototype's requireLogin(). | ✓ |
| Per-page auth checks | Each page checks auth in useEffect. Scatters auth logic. | |
| You decide | Agent decides. | |

**User's choice:** Context + route wrapper
**Notes:** Centralized auth logic, mirrors the prototype's global auth.js pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage | Matches prototype exactly. Simple, no backend changes. | ✓ |
| httpOnly cookies | More secure against XSS but requires backend changes for CSRF. | |
| You decide | Agent decides. | |

**User's choice:** localStorage
**Notes:** Prototype already uses localStorage for authToken, teacherId, teacherRole, teacherName.

---

## Adaptation Workspace UX

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror 3-column | Timeline | Preview | Panel — matches prototype results.html. | ✓ |
| Collapsible panels | Single preview with folding side panels. | |
| You decide | Agent decides. | |

**User's choice:** Mirror 3-column
**Notes:** Proven layout from the prototype, exact match with what teachers use.

| Option | Description | Selected |
|--------|-------------|----------|
| iframe sandbox | Render adapted HTML in sandboxed iframe. Isolates styles. | ✓ |
| Inline HTML | Sanitized HTML in a div. Risk of style bleed. | |
| You decide | Agent decides. | |

**User's choice:** iframe sandbox
**Notes:** Matches prototype's `<iframe sandbox="allow-same-origin">` pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Stepper wizard | 4-step wizard matching prototype's personalize.html. | ✓ |
| Single-page form | All selections visible at once. Faster but less guided. | |

**User's choice:** Stepper wizard
**Notes:** Matches the existing 4-step prototype flow exactly.

---

## the agent's Discretion

- File structure within `src/` (pages vs components vs hooks subdirectories)
- Whether to extract shared UI elements into reusable components or keep inline
- Toast notification implementation (simple div vs library)
- Error boundary placement and error page design
- Loading state design (spinners, skeletons, or placeholder text)
- First-login password setup page (reuses login form or has own component)
- Print page implementation (dedicated route vs modal)
- Admin pages layout (shared admin layout vs individual pages)

## Deferred Ideas

None — discussion stayed within phase scope.