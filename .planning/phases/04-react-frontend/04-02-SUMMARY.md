---
phase: 04-react-frontend
plan: 02
subsystem: ui
tags: [react, data-management, classes, lessons, knowledge-bases, settings, print, admin]

# Dependency graph
requires:
  - phase: 04-react-frontend
    provides: Auth infrastructure, useApi hook, CSS design system, AppLayout, LoginPage, SetupPasswordPage, DashboardPage
provides:
  - MyClassesPage with student cluster assignment editing
  - KBBrowserPage with cluster-KB mapping
  - SettingsPage with LLM config form and 501 handling
  - LessonLibraryPage with source file editing
  - PrintPage with sandboxed iframe print preview
  - AdminDashboardPage, AdminTeachersPage, AdminClassesPage
  - App.jsx with all data management routes (except /personalize and /workspace)
  - AuthContext updated with institutionId
affects: [04-react-frontend, 05-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [useSearchParams for query params in PrintPage, institution-scoped admin API calls]

key-files:
  created:
    - client/src/pages/MyClassesPage.jsx
    - client/src/pages/KBBrowserPage.jsx
    - client/src/pages/SettingsPage.jsx
    - client/src/pages/LessonLibraryPage.jsx
    - client/src/pages/PrintPage.jsx
    - client/src/pages/AdminDashboardPage.jsx
    - client/src/pages/AdminTeachersPage.jsx
    - client/src/pages/AdminClassesPage.jsx
  modified:
    - client/src/App.jsx
    - client/src/App.css
    - client/src/auth/AuthContext.jsx

key-decisions:
  - "LessonLibraryPage uses correct /api/file-edits/lessons/:id/sources path (NOT prototype's /api/lessons/:id/source-files)"
  - "SettingsPage handles 501 from test endpoint with 'coming soon' message"
  - "PrintPage uses useSearchParams for adapted_id and version_id query params"
  - "PrintPage uses sandboxed iframe with sandbox='allow-same-origin' and srcDoc per D-12"
  - "Admin pages use institutionId from AuthContext (derived from /api/auth/me)"
  - "AuthContext updated to store institutionId from /api/auth/me profile response"

patterns-established:
  - "Page-level data fetching with Promise.all for parallel API calls"
  - "Saving pattern: disable button → 'Saving...' → API call → toast → reload → re-enable"
  - "Admin page pattern: institution-scoped API calls via user.institutionId"
  - "Print preview pattern: sandboxed iframe with srcDoc for HTML rendering"

requirements-completed: [FE-07, FE-08, FE-09, FE-10]

# Metrics
duration: 15min
completed: 2026-05-13
---

# Phase 4 Plan 2: Data Management Pages Summary

**8 data management pages with real API data, class roster editing, KB mapping, LLM settings, lesson library, print preview, and admin overview**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-13T19:22:48Z
- **Completed:** 2026-05-13T19:37:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Implemented 8 new page components replacing all "coming soon" placeholders (except /personalize and /workspace)
- MyClassesPage: class roster with student cluster assignment editing, PATCH save with toast confirmation
- KBBrowserPage: KB listing with category grouping, cluster-KB mapping editor with save confirmation
- SettingsPage: LLM provider configuration form with save and graceful 501 handling for test endpoint
- LessonLibraryPage: lesson listing with search, source file editing via correct /api/file-edits path
- PrintPage: sandboxed iframe print preview with toolbar, @media print CSS rule
- Admin pages: dashboard overview with metrics and tables, teacher list, class list with cluster badges
- Updated AuthContext to include institutionId from /api/auth/me for admin API calls
- All 8 pages use useApi hook for authenticated API calls with Bearer token

## Task Commits

Each task was committed atomically:

1. **Task 1: MyClassesPage + KBBrowserPage + SettingsPage** - `4a31ff2` (feat)
2. **Task 2: LessonLibraryPage + PrintPage + Admin Pages + App.jsx** - `4755360` (feat)

## Files Created/Modified
- `client/src/pages/MyClassesPage.jsx` - Class roster with editable student cluster assignments
- `client/src/pages/KBBrowserPage.jsx` - KB listing with cluster-KB mapping editor
- `client/src/pages/SettingsPage.jsx` - LLM config form with provider/model/API key, 501 handling
- `client/src/pages/LessonLibraryPage.jsx` - Lesson listing with search and AI source file editing
- `client/src/pages/PrintPage.jsx` - Print preview with sandboxed iframe and browser print()
- `client/src/pages/AdminDashboardPage.jsx` - Institution overview with metrics, teachers, classes
- `client/src/pages/AdminTeachersPage.jsx` - Teacher cards with role badges and stats
- `client/src/pages/AdminClassesPage.jsx` - Class listing with cluster badges
- `client/src/App.jsx` - Replaced placeholder divs with real page components
- `client/src/App.css` - Added @media print rule for print toolbar
- `client/src/auth/AuthContext.jsx` - Added institutionId to user state and localStorage

## Decisions Made
- LessonLibraryPage uses POST `/api/file-edits` (not prototype's `/api/lessons/:id/edit-source-file`) per RESEARCH.md Pitfall #1
- SettingsPage catches 501 from test endpoint and shows "Test connection feature coming soon" per plan
- PrintPage uses `useSearchParams` for query params (`adapted_id`, `version_id`) instead of `useParams`
- Admin pages derive `institutionId` from `user.institutionId` (populated by `/api/auth/me` response)
- All admin routes wrapped in `AdminRoute` component checking `user.role === 'admin'`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added institutionId to AuthContext for admin API calls**
- **Found during:** Task 2 (Admin pages implementation)
- **Issue:** Admin pages require `institutionId` for API calls (`/api/institutions/:id/overview` etc.) but AuthContext didn't include this field
- **Fix:** Updated AuthContext to extract `institution_id` from `/api/auth/me` response and store it as `institutionId` in user state and localStorage
- **Files modified:** client/src/auth/AuthContext.jsx, client/src/pages/AdminDashboardPage.jsx, client/src/pages/AdminTeachersPage.jsx, client/src/pages/AdminClassesPage.jsx
- **Verification:** Admin pages now correctly reference `user.institutionId` instead of fallback to `teacherId`
- **Committed in:** 4755360 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for admin page functionality — admin endpoints require valid institution ID.

## Issues Encountered
None - all pages built and verified without errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data management pages functional with real API calls
- Only /personalize and /workspace routes still have placeholder components (Plan 04-03)
- Auth infrastructure supports institution-scoped admin API calls
- All pages follow useApi hook pattern with Bearer token auth

---
*Phase: 04-react-frontend*
*Completed: 2026-05-13*