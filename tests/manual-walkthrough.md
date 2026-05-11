# Manual Browser Walkthrough

> Prerequisite: server running at `http://localhost:8000` with `python start_server.py`.

---

## 1. Login

Open [http://localhost:8000/app/login.html](http://localhost:8000/app/login.html).

- You should see 4 seeded teachers: Maria Hernandez, James Walker, Priya Sharma, Robert Chen.
- Click **Maria Hernandez**.
- You should land on the teacher dashboard.

---

## 2. Dashboard

Expected:
- Welcome heading with Maria's institution and class metrics.
- Metric cards: learner profiles, lesson drafts, knowledge bases, students.
- Recent lesson drafts that link to the lesson workspace.
- Students/support profiles overview.
- Sidebar: Dashboard, My Classes, Lesson Library, Knowledge Bases, Plan a Lesson.
- Admin link is hidden for regular teachers.
- Sidebar footer shows the teacher name, Settings, and Log out.

---

## 3. My Classes

Click **My Classes**.

Expected:
- Classes with nested rosters.
- Each student has their current learner/support profile.
- A profile dropdown and **Save** button are available per student.

Update check:
1. Change one student's profile dropdown.
2. Click **Save**.
3. You should see a success toast.
4. The roster reloads with the updated profile.

Backend route exercised:
- `PATCH /api/teachers/:teacher_id/students/:student_id`

This matters because future RAG lesson drafts use the selected learner profile and its mapped KB IDs.

---

## 4. Lesson Library

Click **Lesson Library**.

Expected:
- Base lessons are listed: Agent Lion, Acorn Was a Little Wild, Sharing Culture.
- Search filters by title, topic, or standard.
- Clicking a lesson opens `personalize.html?lesson_id=...` with that lesson preselected.
- The **AI edit source file** panel lets the teacher choose a lesson source file (`.docx`, `.pptx`, or `.pdf`), optionally choose a learner profile for RAG context, enter an edit instruction, and download the generated copy.

Source-file edit check:
1. Choose **Agent Lion: ScratchJr**.
2. Choose `Agent Lion_ ScratchJr_K-2.docx`, the slideshow PPTX, or the worksheet PDF.
3. Enter an instruction such as "Translate this lesson into Spanish while preserving classroom directions."
4. Click **Create Edited Copy**.
5. If an LLM key or `ADAPT_GEMINI_API_KEY` fallback is configured, a copied edited file downloads. The original source file remains unchanged.

Backend routes exercised:
- `GET /api/lessons/:lesson_id/source-files`
- `POST /api/lessons/:lesson_id/edit-source-file`
- `GET /api/lesson-file-edits/:filename`

Note: DOCX and PPTX copies edit existing text runs, so hyperlinks and font formatting are preserved where possible. PDF copies are regenerated as text-based PDFs rather than exact-layout edits.

---

## 5. Knowledge Bases

Click **Knowledge Bases**.

Expected:
- KB resources are grouped by category.
- Each resource shows its KB ID.
- Search filters by name, description, category, or KB ID.
- The right panel lets the teacher choose a learner profile and edit which KB IDs are mapped to that profile.

Update check:
1. Pick a learner profile in the right panel.
2. Toggle one or more KB IDs.
3. Click **Save KB Mapping**.
4. You should see a success toast.

Backend routes exercised:
- `GET /api/knowledge-bases`
- `GET /api/clusters/:cluster_id/kbs`
- `PUT /api/clusters/:cluster_id/kbs`

---

## 6. Plan a Lesson

Click **Plan a Lesson**.

Expected 4-step flow:
1. **Select lesson**: choose a base lesson.
2. **Learner profile**: choose the group of students you are planning for.
3. **RAG sources**: review the KB IDs linked to that profile and toggle sources if needed.
4. **Draft**: generate the first lesson draft.

Step 4 calls:
- `POST /api/adapt`

On success:
- Redirects to `results.html?adapted_id=...`

On missing LLM key:
- Shows an error and links to Settings.

---

## 7. Settings

Click **Settings** in the sidebar footer.

Expected:
- Provider dropdown: Gemini, OpenRouter, HuggingFace.
- Optional model text input.
- API key password input.
- Save and Test connection buttons.
- Existing keys are only shown redacted.
- Page notes that `ADAPT_GEMINI_API_KEY` can be set in the project environment as a local fallback.

Backend routes exercised:
- `GET /api/teachers/:teacher_id/llm-config`
- `PUT /api/teachers/:teacher_id/llm-config`
- `POST /api/teachers/:teacher_id/llm-config/test`

---

## 8. Lesson Workspace

Open a recent draft from the dashboard, or generate a new draft from Plan a Lesson.

Expected:
- Header shows lesson workspace ID, version count, and current draft version.
- Top actions:
  - **Show redline vs previous**
  - **Rollback to this version** when previewing a non-current version
  - **Finalize: Download HTML**
  - **Open Print View**
- Left panel shows draft history.
- Center panel renders the selected lesson version as HTML in an iframe.
- Right panel contains the RAG refinement textbox, suggestion chips, finalize buttons, and teacher feedback.

Iteration check:
1. Type a revision request such as "Add a Spanish family note and simplify the warm-up."
2. Click **Create New Version**.
3. A new version should appear in the timeline and become the current preview.
4. Toggle redline to compare with the parent version.

Backend routes exercised:
- `GET /api/adaptations/:adapted_id`
- `GET /api/adaptations/:adapted_id/versions/:version_id`
- `POST /api/adaptations/:adapted_id/refine`
- `POST /api/adaptations/:adapted_id/rollback`
- `POST /api/adaptations/:adapted_id/feedback`

---

## 9. Finalize: Print and Export

From the lesson workspace:

- **Open Print View** opens `print.html?adapted_id=...&version_id=...&auto=1`, loads the selected rendered HTML, and triggers the browser print dialog. Use the browser's Save as PDF option.
- **Finalize: Download HTML** fetches `/api/adaptations/.../export.html` and downloads the selected version as a self-contained `.html` file.

Backend routes exercised:
- `GET /api/adaptations/:adapted_id/versions/:version_id/print`
- `GET /api/adaptations/:adapted_id/versions/:version_id/export.html`

Current MVP finalization is HTML-first. Separate Word/PDF/PowerPoint material exports are deferred.

---

## 10. Admin

Log in as **Robert Chen** to see admin pages:
- Admin Overview
- Admin Teachers
- Admin Classes

Log in as Maria, James, or Priya:
- Admin links should be hidden.

---

## 11. Error States

| Scenario | Expected |
|---|---|
| API request without `X-Teacher-Id` where required | 401 |
| Access another teacher's adaptation | 403 |
| Rollback a non-existent version | 404 |
| Rating outside 1-5 | 422 |
| Refine without an LLM key or env fallback | 400 with "No LLM configured" |
| Unknown lesson/profile ID | 404 |
| Open `results.html` without `adapted_id` | `missing adapted_id` |

---

## 12. Seeded Data Reference

| Entity | Count | Notes |
|---|---:|---|
| Institutions | 3 | Lincoln Elementary, Riverside Academy, Maplewood K-8 |
| Teachers | 4 | Maria, James, Priya, Robert |
| Learner profiles/student clusters | 7 | Below/On/Above Grade, Spanish MLL, Attention, Indigenous, Urban |
| Students | 12 | Distributed across seeded classes |
| KBs | 16 | Personalization + Pedagogy |
| Base lessons | 3 | Agent Lion, Acorn, Sharing Culture |
| Sample adapted lessons | 4 | Pre-seeded with v1 versions |

Generating a new draft requires a teacher LLM key or the `ADAPT_GEMINI_API_KEY` environment fallback. Seeded sample drafts are viewable without a key.
