# ADAPT Docker Start Guide

Clone → configure → run → explore every feature.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) v2.20+ (included with Docker Desktop 4.22+)
- Git
- `jq` (optional — used in bash API examples below)
- An [OpenRouter API key](https://openrouter.ai/keys) (free tiers available)

---

## 1. Clone and configure

```bash
git clone https://github.com/your-org/ADAPT.git
cd ADAPT
cp .env.docker.example .env
```

Edit `.env` and set two secrets. Generate each with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run the command **twice** so you get two different 64-character hex strings. Paste them into `.env`:

```
JWT_SECRET=a1b2c3d4e5f6...your-first-64-char-hex
ENCRYPTION_KEY=f6e5d4c3b2a1...your-second-64-char-hex
```

Optional `.env` values:

| Variable | Default | What it does |
|---|---|---|
| `ADAPT_PORT` | `80` | Host port for the web UI (use `ADAPT_PORT=8080` if port 80 is taken) |
| `ADAPT_GEMINI_API_KEY` | — | Fallback Gemini key for a second LLM provider |
| `ADAPT_EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Embedding model (only matters with `--profile rag`) |
| `ADAPT_SECRET_KEY` | auto | Fernet key, leave blank to auto-generate |

> **Note:** The server only uses per-teacher LLM configs set via the Settings UI. There is no global fallback API key environment variable.

The root `.env` is already in `.gitignore` — you can't accidentally commit it.

---

## 2. Build and start

### Core app (no RAG — recommended for first run)

```bash
docker compose up --build -d
```

This builds and starts three containers:

| Container | Role |
|---|---|
| `nginx` | Serves the React frontend on port 80, reverse-proxies `/api/` to the server |
| `server` | Express 5 API + SQLite database |
| `embed-server` | *Not started* (only with `rag` profile) |
| `chromadb` | *Not started* (only with `rag` profile) |

### With RAG pipeline (knowledge base retrieval)

```bash
docker compose --profile rag up --build -d
```

Adds two more containers for vector search:

| Container | Port | Role |
|---|---:|---|
| `embed-server` | `9876` | Embeds text with `all-MiniLM-L6-v2` |
| `chromadb` | `8000` | Stores KB chunk vectors |

The embed-server downloads an ~80 MB model on first use. After the RAG containers are up, ingest the bundled KB documents into ChromaDB:

```bash
docker compose --profile rag run --rm server node scripts/ingest_kbs.js --reset
```

`--reset` deletes and rebuilds the mapped KB collections before inserting chunks, which avoids stale or duplicate vectors.

### Check that everything is running

```bash
docker compose ps
docker compose logs server    # should show "Server running on port 3000"
```

The server has a health check that hits `GET /api` every 15 seconds. It stays unhealthy until the SQLite database is initialized (first startup takes ~5 seconds).

---

## 3. Log in

Open **http://localhost** in your browser.

Use the seeded admin account:

| Field | Value |
|---|---|
| Email | `rchen@lincoln.edu` |
| Password | `admin123` |

This account belongs to Lincoln Elementary (Springfield District) and has the `admin` role.

---

## 4. Feature walkthrough

### 4.1 Dashboard

The dashboard shows:
- **Metric cards** — learner profiles (clusters), lesson drafts, knowledge bases, student count
- **Recent lesson drafts** — cards linking to each workspace (will be empty on first run)
- **Student roster** — all students with their cluster assignments

The **"Plan a Lesson"** button takes you directly to the personalization wizard.

### 4.2 Settings → Add your LLM API key

Before you can generate lesson plans, ADAPT needs an LLM provider. Each teacher configures their own key through the UI.

1. Click **Settings** in the sidebar
2. Select **OpenRouter** as the provider
3. Choose one of the recommended OpenRouter free models: `nvidia/nemotron-3-super-120b-a12b:free` or `google/gemma-4-31b-it:free`. Select **Other** only if you want to type a different OpenRouter model ID.
4. Paste your **OpenRouter API key**
5. Click **Save**

The key is encrypted with AES-256-GCM before being stored in the database. The API returns only a redacted version (first 3 + last 4 characters).

**Supported providers**: `openrouter`, `openai`, `anthropic`.

### 4.3 Lesson Library

Browse the three pre-loaded CS lessons:

| Title | Grade | Topic |
|---|---|---|
| Agent Lion: ScratchJr | K-2 | Sequencing & Algorithms |
| Acorn Was a Little Wild | K-1 | Algorithms with BeeBots |
| Sharing Culture: Algorithms | 2-3 | Algorithms |

- Use the **search bar** to filter by title, topic, or standard
- Click any lesson to view its details

### 4.4 My Classes

View your classes, student rosters, and learner profile assignments.

- Each class shows enrolled students with their cluster badges
- Use the dropdown next to a student to **reassign their learner profile**
- Changes save immediately

**The 7 seeded learner profiles**:

| Profile | Description |
|---|---|
| Below Grade | 1st grade reading level or below |
| On Grade | 2nd grade reading level |
| Above Grade | 3rd grade+ reading level |
| Native Spanish Speaker | Spanish L1, <1 year in country |
| Attention Issues | Hyperactive, impulsive, struggles to focus |
| Indigenous Student | Native American heritage |
| Urban Cluster | Black, low-SES, on grade level |

### 4.5 Personalize (Generate a lesson plan)

The 4-step wizard is the core feature. It uses RAG (Retrieval-Augmented Generation) to adapt a base lesson for a specific learner profile.

**Step 1 — Select a lesson**: Click any lesson card. Use the search bar if needed.

**Step 2 — Pick a learner profile**: Click one of the 7 profiles. Each shows its student count and linked knowledge base count.

**Step 3 — Review RAG sources**: Knowledge bases are grouped by category (Personalization, Pedagogy). Each profile has pre-assigned KBs. Toggle checkboxes to include/exclude specific sources for this generation. Defaults:

- **Below/Above Grade**: UDL General, UDL CS, Academic Readiness, Tiering Lessons
- **On Grade**: UDL General, UDL CS
- **Spanish MLL**: UDL General, UDL CS, MLL, CRP
- **Attention Issues**: UDL General, UDL CS, IEP, Neurodiversity
- **Indigenous**: UDL General, UDL CS, CRP
- **Urban Cluster**: UDL General, UDL CS, CRP

**Step 4 — Generate**: Click **"Generate lesson draft"**. A progress bar shows:
1. Retrieving KB chunks
2. Building prompt
3. Calling the LLM (via OpenRouter)
4. Rendering HTML

The generated plan opens automatically in the **Workspace**.

### 4.6 Workspace

The workspace is a 3-panel view for reviewing and iterating on lesson plans.

**Left panel — Draft history**:
- Each "Generate" or "Refine" call creates an immutable version
- The **current draft** is marked with a "current" pill
- Click any version to preview it
- Versions show their creation time, provider, and refinement instruction

**Center panel — Rendered preview**:
- Shows the full lesson plan as rendered HTML
- If a version has a parent, click **"Show redline vs previous"** to see a word-level diff (additions in green, removals in strikethrough red)

**Right panel — Refine**:
- Enter natural-language instructions for revision (e.g. "Make the unplugged activity easier for multilingual learners and add a Spanish family note")
- Click **"Create New Version"** — this re-runs the full RAG pipeline with the previous version as context
- Quick-suggestion buttons (`Make it simpler`, `Add more examples`, etc.) pre-fill common requests
- Each refine call creates a new immutable version

**Right panel — Finalize**:
- **"Download Final HTML"** saves the rendered plan as an HTML file for printing or sharing
- **"Open Printable Lesson"** opens a print-optimized view
- Use the browser's Print dialog (Ctrl+P / Cmd+P) to save as PDF

**Right panel — Teacher Feedback**:
- Rate each version 1–5 stars
- Add an optional note
- Feedback is stored in `adaptation_feedback` table for future analysis

**Version management**:
- View any past version by clicking it in the timeline
- **"Rollback to this version"** makes an older version the current draft (without deleting later versions)
- Rolled-back versions remain in the timeline for future reference

### 4.7 Knowledge Bases (KB Browser)

Browse the 16 pre-loaded knowledge bases grouped by category:

| Category | KBs |
|---|---|
| Personalization | UDL (General), UDL (CS), CRP, MLL, IEP, SEL, Neurodiversity |
| Pedagogy | Scaffolding, Academic Readiness, Tiering Lessons, Differentiation, CS Pedagogy, CS Content, Danielson, AI-TPACK, SAMR |

Each KB has a description and source URL. The **right panel** lets you tune which KBs are assigned to each learner profile. Changes save immediately and affect future RAG retrievals.

### 4.8 Admin pages (admin role only)

Since you're logged in as Robert Chen (admin), you have access to:

**Admin Dashboard** (`/admin`):
- Institution-wide metrics (teachers, classes, students, adaptations)
- Teacher table with class and student counts
- Class overview with grade bands and top clusters
- Cluster distribution across the institution

**Admin → Teachers** (`/admin/teachers`):
- View all teachers at the institution
- Teacher details: email, class count, student count, adaptation count

**Admin → Classes** (`/admin/classes`):
- View all classes across the institution
- Class details: teacher, grade band, student count, enrolled learner profiles

---

## 5. Run the test suite

Tests run inside the server container:

```bash
docker compose exec server npm test
```

This runs 129+ Vitest tests across:

- **Authentication** — register, login, refresh, logout, token expiry
- **Authorization** — role-based access control, owner-or-admin middleware
- **Lessons** — listing, pagination, search, single-lesson lookup
- **Clusters** — listing, KB assignments
- **Adaptations** — generate, refine, versioning, rollback, feedback
- **Settings** — LLM provider CRUD, encryption/decryption
- **Admin** — institution overview, teacher listing
- **File edits** — source file listing and AI editing

For coverage:

```bash
docker compose exec server npm run test:coverage
```

---

## 6. API testing (curl)

You can also interact with the API directly. Here are a few examples:

### Login

```bash
curl -s http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rchen@lincoln.edu","password":"admin123"}' | jq .
```

Save the token:

```bash
TOKEN=$(curl -s http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rchen@lincoln.edu","password":"admin123"}' | jq -r '.accessToken')
```

### List lessons

```bash
curl -s http://localhost/api/lessons \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### View dashboard

```bash
curl -s http://localhost/api/teachers/4/dashboard \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### List clusters

```bash
curl -s http://localhost/api/clusters \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Save LLM config

```bash
curl -s -X PUT http://localhost/api/teachers/4/llm-config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider":"openrouter","model":"nvidia/nemotron-3-super-120b-a12b:free","api_key":"sk-or-v1-your-key-here"}' | jq .
```

### Generate an adaptation

```bash
curl -s -X POST http://localhost/api/adapt \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lesson_id":1,"cluster_id":4,"kb_ids":[1,2,3,4],"include_student_context":true}' | jq .
```

### View current health

```bash
curl -s http://localhost/api/health | jq .
```

---

## 7. Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker compose up` fails with "port 80 already in use" | Another service uses port 80 | `ADAPT_PORT=8080 docker compose up -d` |
| Server health check keeps failing | `JWT_SECRET` or `ENCRYPTION_KEY` not set in `.env` | Generate and set both values, then `docker compose up --build -d` |
| "No LLM configured" when generating | No API key set in Settings | Go to Settings → paste your OpenRouter key, or configure it per-teacher via the API |
| "ENCRYPTION_KEY not set" | `ENCRYPTION_KEY` is empty or invalid | Generate a 64-char hex string and restart |
| Redline diff shows nothing | The first version has no parent | Only versions 2+ show diffs against their parent |
| Blank iframe in workspace | The version's rendered_html is empty | Check `docker compose logs server` for generation errors |

---

## 8. Reset everything

To wipe the database and start fresh:

```bash
docker compose down -v
docker compose up --build -d
```

The `-v` flag removes the named volumes (`server-data`, `chroma-data`). On next startup, `adapt-database.sql` runs again, re-creating all tables and seed data. You'll need to re-enter your OpenRouter API key in Settings.

---

## 9. Reference: Seed data summary

### Accounts

| Teacher | Email | Institution | Role |
|---|---|---|---|
| Maria Hernandez | `mhernandez@lincoln.edu` | Lincoln Elementary | teacher |
| James Walker | `jwalker@riverside.edu` | Riverside Academy | teacher |
| Priya Sharma | `psharma@maplewood.edu` | Maplewood K-8 | teacher |
| **Robert Chen** | **rchen@lincoln.edu** | **Lincoln Elementary** | **admin** |

The admin password (`admin123`) is set at runtime by the seed script. All teacher accounts start without a password — they'd use the setup-password flow.

### Institutions

| Name | Type | District |
|---|---|---|
| Lincoln Elementary | Elementary | Springfield District |
| Riverside Academy | K-8 | Riverside District |
| Maplewood K-8 | K-8 | Maplewood District |

### Lessons

| # | Title | Grade | Standard |
|---|---|---|---|
| 1 | Agent Lion: ScratchJr | K-2 | 1A-AP-10 |
| 2 | Acorn Was a Little Wild | K-1 | 1A-AP-08 |
| 3 | Sharing Culture: Algorithms | 2-3 | 1A-AP-11 |

### Pre-generated adaptations (viewable in dashboard)

| Lesson | Teacher | Cluster | KBs used |
|---|---|---|---|
| Agent Lion → MLL adaptation | Maria Hernandez | Native Spanish Speaker | UDL, CRP, MLL |
| Agent Lion → Below grade | Maria Hernandez | Below Grade | UDL, Academic Readiness, Tiering |
| Acorn BeeBots → Attention | Maria Hernandez | Attention Issues | UDL, IEP, Neurodiversity |
| Sharing Culture → Indigenous | James Walker | Indigenous Student | UDL, CRP |
