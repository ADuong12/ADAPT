# ADAPT Local Development Start Guide

Set up ADAPT on your machine with Node.js, test every feature, and get the RAG pipeline running — without Docker.

---

## Prerequisites

| Tool | Version | Check command | Required? |
|---|---|---|---|
| Node.js | 18+ | `node --version` | **Yes** |
| npm | 9+ | `npm --version` | **Yes** |
| Python | 3.10+ | `python --version` | RAG only* |
| Git | any | `git --version` | **Yes** |
| OpenRouter API key | — | [openrouter.ai/keys](https://openrouter.ai/keys) | **Yes** |
| `jq` | any | `jq --version` | Optional — used in bash API examples |
| Build tools | — | — | See note below |

\* Python is required for RAG (ChromaDB + embed server). It may also be needed for the `better-sqlite3` native compilation during `npm install` if a prebuilt binary isn't available for your platform.

**Build tools note:** `better-sqlite3` compiles a native module on install. Most platforms have prebuilt binaries, but if `npm install` in `server/` fails with a build error, ensure you have Python, make, and a C++ compiler (Linux/macOS) or Visual Studio Build Tools (Windows). See the troubleshooting table for details.

---

## 1. Clone and install

=== "PowerShell"

    ```powershell
    git clone https://github.com/your-org/ADAPT.git
    cd ADAPT

    Set-Location server; npm install; Set-Location ..

    Set-Location client; npm install; Set-Location ..
    ```

=== "Bash"

    ```bash
    git clone https://github.com/your-org/ADAPT.git
    cd ADAPT

    cd server && npm install && cd ..

    cd client && npm install && cd ..
    ```

`npm install` in `server/` also compiles the `better-sqlite3` native module — this can take a minute on first run.

---

## 2. Configure environment

The server reads `.env` from the `server/` directory.

=== "PowerShell"

    ```powershell
    Copy-Item server/.env.example server/.env
    ```

=== "Bash"

    ```bash
    cp server/.env.example server/.env
    ```

Then edit `server/.env`. For local development, the defaults work out of the box:

```
PORT=3000
NODE_ENV=development
JWT_SECRET=dev-secret-change-in-production
ENCRYPTION_KEY=
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

**For a real test** you should set proper secrets. Generate each with:

=== "PowerShell"

    ```powershell
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```

=== "Bash"

    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```

Run it **twice**, paste the first output as `JWT_SECRET` and the second as `ENCRYPTION_KEY`:

```
JWT_SECRET=a1b2c3d4e5f6...first-64-char-hex
ENCRYPTION_KEY=f6e5d4c3b2a1...second-64-char-hex
```

### What each variable does

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | No (dev) | `dev-secret-change-in-production` | Signs JWT access tokens. Change for anything beyond local testing. |
| `ENCRYPTION_KEY` | Yes | — | 64-char hex string for AES-256-GCM encryption of stored LLM API keys. Must be set to save keys in Settings. |
| `PORT` | No | `3000` | Backend HTTP port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed origins. `null` origin is added automatically in dev mode. |

| `CHROMA_URL` | No | `http://localhost:8000` | ChromaDB server URL (RAG only) |
| `EMBED_SERVER_URL` | No | `http://127.0.0.1:9876/embed` | Python embedding server URL (RAG only) |

> **Note:** The server only uses per-teacher LLM configs set via the Settings UI. There is no global fallback API key environment variable.

---

## 3. Start the backend

=== "PowerShell"

    ```powershell
    Set-Location server; npm run dev
    ```

=== "Bash"

    ```bash
    cd server && npm run dev
    ```

You should see:

```
ADAPT server running on http://localhost:3000
Environment: development
```

On first startup, `server/src/db/init.js` reads `adapt-database.sql` from the project root and creates all tables + seed data. The admin password is hashed and stored by `server/src/db/seed.js`.

Leave this terminal running. Open a new terminal for the frontend.

---

## 4. Start the frontend

=== "PowerShell"

    ```powershell
    Set-Location client; npm run dev
    ```

=== "Bash"

    ```bash
    cd client && npm run dev
    ```

You should see:

```
VITE v8.x.x  ready in ...ms

➜  Local:   http://localhost:5173/
```

The Vite dev server on port 5173 automatically proxies `/api/*` requests to the backend on port 3000 (configured in `client/vite.config.js`).

Open **http://localhost:5173** in your browser.

---

## 5. Log in or register

### Option A: Log in with the seeded admin

The database comes pre-loaded with an admin account:

| Field | Value |
|---|---|
| Email | `rchen@lincoln.edu` |
| Password | `admin123` |

Enter these on the sign-in page. You'll land on the Dashboard.

### Option B: Register a brand-new teacher

1. On the sign-in page, click **"Sign up"**
2. Enter your **full name**, **email**, and a **password** (8+ characters)
3. Click **"Create account"**
4. You're logged in automatically and land on the Dashboard

New accounts are assigned the `teacher` role and institution ID 1 (Lincoln Elementary).

### Option C: Set a password for a seeded teacher

The three seeded teacher accounts (Maria Hernandez, James Walker, Priya Sharma) start without passwords. To use one:

1. On the sign-in page, click **"Set up password"**
2. Enter the seeded email (e.g. `mhernandez@lincoln.edu`)
3. The system confirms the account needs setup
4. Choose a password (8+ characters) and confirm it
5. You're logged in automatically

### Seeded accounts reference

| Name | Email | Institution | Role | Has password? |
|---|---|---|---|---|
| Maria Hernandez | `mhernandez@lincoln.edu` | Lincoln Elementary | teacher | No — use setup-password |
| James Walker | `jwalker@riverside.edu` | Riverside Academy | teacher | No — use setup-password |
| Priya Sharma | `psharma@maplewood.edu` | Maplewood K-8 | teacher | No — use setup-password |
| Robert Chen | `rchen@lincoln.edu` | Lincoln Elementary | admin | Yes — `admin123` |

---

## 6. Feature walkthrough

All URLs below use `localhost:5173` (the Vite dev server).

### 6.1 Dashboard

Shows:
- **Metric cards** — learner profiles, lesson drafts, knowledge bases, student count
- **Recent lesson drafts** — cards linking to each workspace (may show 4 pre-seeded adaptations for the admin)
- **Student roster** — all students with their cluster badges

Click **"Plan a Lesson"** to jump to the personalization wizard.

### 6.2 Settings — Add your LLM API key

Before generating any lesson plans, you need an LLM provider:

1. Click **Settings** in the sidebar
2. Select **OpenRouter** as the provider
3. Choose one of the recommended OpenRouter free models: `nvidia/nemotron-3-super-120b-a12b:free` or `google/gemma-4-31b-it:free`. Select **Other** only if you want to type a different OpenRouter model ID.
4. Paste your **OpenRouter API key** from [openrouter.ai/keys](https://openrouter.ai/keys)
5. Click **Save**

Your key is encrypted with AES-256-GCM before storage. The UI shows only a redacted version.

**Supported providers**: `openrouter`, `openai`, `anthropic`.

> If you see "ENCRYPTION_KEY not set" when saving, go back to step 2 and make sure `ENCRYPTION_KEY` is set in `server/.env`, then restart the backend.

### 6.3 Lesson Library

Browse the three pre-loaded CS lessons:

| Title | Grade | Topic | Standard |
|---|---|---|---|
| Agent Lion: ScratchJr | K-2 | Sequencing & Algorithms | 1A-AP-10 |
| Acorn Was a Little Wild | K-1 | Algorithms with BeeBots | 1A-AP-08 |
| Sharing Culture: Algorithms | 2-3 | Algorithms | 1A-AP-11 |

Use the **search bar** to filter by title, topic, or standard.

### 6.4 My Classes

View your classes and student rosters. Each student has a learner profile (cluster) badge.

- Use the dropdown next to a student to **reassign their profile**
- Changes save immediately

**The 7 seeded learner profiles**:

| Profile | Description | Linked KBs |
|---|---|---|
| Below Grade | 1st grade reading level or below | UDL General, UDL CS, Academic Readiness, Tiering |
| On Grade | 2nd grade reading level | UDL General, UDL CS |
| Above Grade | 3rd grade+ reading level | UDL General, UDL CS, Academic Readiness, Tiering |
| Native Spanish Speaker | Spanish L1, <1 year in country | UDL General, UDL CS, MLL, CRP |
| Attention Issues | ADHD, struggles to focus | UDL General, UDL CS, IEP, Neurodiversity |
| Indigenous Student | Native American heritage | UDL General, UDL CS, CRP |
| Urban Cluster | Black, low-SES, on grade level | UDL General, UDL CS, CRP |

### 6.5 Personalize (Generate a lesson plan)

The 4-step RAG wizard:

**Step 1 — Select a lesson**: Click a lesson card. Search to filter.

**Step 2 — Pick a learner profile**: Click one of the 7 profiles. Each shows student count and KB count.

**Step 3 — Review RAG sources**: Toggle which knowledge bases to include for this generation. Defaults match the profile's standard assignments.

**Step 4 — Generate**: Click **"Generate lesson draft"**. Progress stages:
1. Retrieving KB chunks
2. Building prompt
3. Calling the LLM
4. Rendering HTML

> **Without RAG running** (no ChromaDB/embed-server): Generation still works — step 1 returns zero chunks and the LLM relies on KB names only. The plan is less context-rich but still functional.

You're automatically redirected to the **Workspace**.

### 6.6 Workspace

3-panel view for reviewing and iterating on lesson plans:

**Left — Draft history**:
- Each Generate or Refine call creates an immutable version
- The **current draft** is marked with a "current" pill
- Click any version to preview it

**Center — Rendered preview**:
- Full lesson plan as rendered HTML in an iframe
- Click **"Show redline vs previous"** to see a word-level diff (green additions, red strikethrough removals) — only available for version 2+

**Right — Refine**:
- Enter natural-language instructions (e.g. "Add a Spanish family note and simplify the unplugged activity")
- Click **"Create New Version"** — re-runs RAG + LLM with the previous version as context
- Quick-suggestion buttons: `Make it simpler`, `Add more examples`, `Focus on visual learners`

**Right — Finalize**:
- **"Download Final HTML"** — saves the rendered plan as an `.html` file
- **"Open Printable Lesson"** — opens a print-optimized view; use Ctrl+P / Cmd+P to save as PDF

**Right — Teacher Feedback**:
- Rate each version 1–5 stars
- Add an optional note
- Feedback is stored for future analysis

**Version management**:
- View any past version by clicking it in the timeline
- **"Rollback to this version"** — makes an older version the current draft (later versions remain in history)

### 6.7 Knowledge Bases (KB Browser)

Browse the 16 pre-loaded KBs grouped by category:

| Category | KBs |
|---|---|
| Personalization | UDL (General), UDL (CS), CRP, MLL, IEP, SEL, Neurodiversity |
| Pedagogy | Scaffolding, Academic Readiness, Tiering, Differentiation, CS Pedagogy, CS Content, Danielson, AI-TPACK, SAMR |

The **right panel** lets you tune which KBs are assigned to each learner profile. Click **"Save KB Mapping"** after making changes. This affects future RAG retrievals for that profile.

### 6.8 Admin pages (admin role only)

Logged in as Robert Chen (admin), you see extra sidebar links:

- **Admin Dashboard** — institution-wide metrics, teacher table, class overview, cluster distribution
- **Admin → Teachers** — all teachers with class/student counts
- **Admin → Classes** — all classes with grade bands and learner profile breakdowns

---

## 7. Set up RAG locally (optional but recommended)

Without RAG, lesson generation works but receives zero KB context chunks — the LLM only sees KB names. With RAG, it gets actual retrieved text passages for richer plans.

This requires three running services: **ChromaDB** (vector store), **embed server** (Python), and **KB ingestion** (one-time).

### 7.1 Install Python dependencies

=== "PowerShell"

    ```powershell
    # Install CPU-only PyTorch first (~200 MB) — avoids the full ~2 GB CUDA package
    pip install torch --index-url https://download.pytorch.org/whl/cpu
    pip install -r embed-server/requirements.txt chromadb opentelemetry-instrumentation-fastapi
    ```

=== "Bash"

    ```bash
    # Install CPU-only PyTorch first (~200 MB) — avoids the full ~2 GB CUDA package
    pip install torch --index-url https://download.pytorch.org/whl/cpu
    pip install -r embed-server/requirements.txt chromadb opentelemetry-instrumentation-fastapi
    ```

This installs `torch` (CPU), `flask`, `sentence-transformers`, ChromaDB, and the OpenTelemetry FastAPI dependency needed by the Chroma local server on Windows. The embedding model downloads on first use.

### 7.2 Start ChromaDB

Use the Python `chroma` CLI. Keep this terminal open while testing RAG:

=== "PowerShell"

    ```powershell
    chroma run --path .\chroma_data --host 127.0.0.1 --port 8000
    ```

=== "Bash"

    ```bash
    chroma run --path ./chroma_data --host 127.0.0.1 --port 8000
    ```

Verify it responds before continuing:

PowerShell:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/v2/heartbeat
```

Bash:

```bash
curl http://127.0.0.1:8000/api/v2/heartbeat
```

Leave ChromaDB running. Open a new terminal for the next step.

### 7.3 Start the embedding server

=== "PowerShell"

    ```powershell
    python server/src/services/rag/embed_server.py
    ```

=== "Bash"

    ```bash
    python server/src/services/rag/embed_server.py
    ```

You should see:

```
Starting embedding server on port 9876
Loading embedding model: all-MiniLM-L6-v2
Model loaded (dimension=384)
```

The model loads lazily. Trigger it once before ingestion:

PowerShell:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:9876/embed -Method Post -ContentType "application/json" -Body '{"texts":["test sentence"]}'
```

Bash:

```bash
curl -X POST http://127.0.0.1:9876/embed -H "Content-Type: application/json" -d '{"texts":["test sentence"]}'
```

The first model load can take a minute. Leave the embed server running.

### 7.4 Ingest KB documents into ChromaDB

This is a one-time step that chunks the KB files, embeds them, and stores them in ChromaDB.

=== "PowerShell"

    ```powershell
    node scripts/ingest_kbs.js --reset
    ```

=== "Bash"

    ```bash
    node scripts/ingest_kbs.js --reset
    ```

You should see output like:

```
Ingesting 5 file(s) into ChromaDB...

[UDL (General)] kb_id=1
  Reading KB_UDL_Table_accessible.pdf...
  Chunks: 7
  Embedding batch 1/1...
  Done — kb_1 now has 7 chunks

[UDL (CS)] kb_id=2
  Reading KB_udlg3-graphicorganizer-digital-numbers-a11y.pdf...
  Chunks: 2
  Embedding batch 1/1...
  Done — kb_2 now has 2 chunks

...

Ingestion complete.
```

To ingest only a single KB:

=== "PowerShell"

    ```powershell
    node scripts/ingest_kbs.js --kb-id 4
    ```

=== "Bash"

    ```bash
    node scripts/ingest_kbs.js --kb-id 4
    ```

The script maps files from `Knowledge Bases/` to KB IDs using a built-in mapping. To add new KB documents, edit the `FILE_MAP` object at the top of `scripts/ingest_kbs.js`.

Use `--reset` when you want a clean re-ingest. It deletes and rebuilds the mapped KB collections before inserting chunks, which avoids duplicate or stale chunks after changing source files.

Current file mapping:

| File | KB ID | KB Name |
|---|---|---|
| `KB_UDL_Table_accessible.pdf` | 1 | UDL (General) |
| `KB_udlg3-graphicorganizer-digital-numbers-a11y.pdf` | 2 | UDL (CS) |
| `KB_CRP.txt` | 3 | CRP |
| `P_Spanish-MLL.txt` | 4 | MLL |
| `KB_mll combined.pdf` | 4 | MLL |

### 7.5 Verify RAG is working

With all three services running (server on :3000, embed-server on :9876, ChromaDB on :8000), go through the Personalize wizard again. This time in Step 4, the generation should:

- Show "Retrieving KB chunks..." and actually find chunks
- Include cited KB passages in the generated plan
- Log the chunk metadata in the `rag_context_log` table

You can also verify via curl:

=== "PowerShell"

    ```powershell
    # Check embed server health
    Invoke-RestMethod -Uri http://127.0.0.1:9876/health

    # Test embedding a single text
    Invoke-RestMethod -Uri http://127.0.0.1:9876/embed -Method Post -ContentType "application/json" -Body '{"texts":["test sentence"]}'
    ```

=== "Bash"

    ```bash
    # Check embed server health
    curl http://127.0.0.1:9876/health

    # Test embedding a single text
    curl -X POST http://127.0.0.1:9876/embed -H "Content-Type: application/json" -d '{"texts":["test sentence"]}'
    ```

---

## 8. Run the test suite

=== "PowerShell"

    ```powershell
    Set-Location server; npm test
    ```

=== "Bash"

    ```bash
    cd server && npm test
    ```

This runs 129+ Vitest tests covering auth, authorization, lessons, clusters, adaptations, versioning, settings, admin, and file edits. All tests are in-process (no external services needed).

For coverage:

=== "PowerShell"

    ```powershell
    Set-Location server; npm run test:coverage
    ```

=== "Bash"

    ```bash
    cd server && npm run test:coverage
    ```

Watch mode (re-runs on file changes):

=== "PowerShell"

    ```powershell
    Set-Location server; npm run test:watch
    ```

=== "Bash"

    ```bash
    cd server && npm run test:watch
    ```

---

## 9. API testing with curl

All of these hit the Vite proxy at `localhost:5173` (which forwards to the backend on :3000). You can also use `localhost:3000` directly.

### Login and save token

=== "PowerShell"

    ```powershell
    $body = '{"email":"rchen@lincoln.edu","password":"admin123"}'
    $resp = Invoke-RestMethod -Uri http://localhost:5173/api/auth/login -Method Post -ContentType "application/json" -Body $body
    $TOKEN = $resp.accessToken
    ```

=== "Bash"

    ```bash
    TOKEN=$(curl -s http://localhost:5173/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"rchen@lincoln.edu","password":"admin123"}' | jq -r '.accessToken')
    ```

### Register a new account

=== "PowerShell"

    ```powershell
    $body = '{"name":"Test Teacher","email":"test@example.com","password":"password123"}'
    Invoke-RestMethod -Uri http://localhost:5173/api/auth/register -Method Post -ContentType "application/json" -Body $body
    ```

=== "Bash"

    ```bash
    curl -s http://localhost:5173/api/auth/register \
      -H "Content-Type: application/json" \
      -d '{"name":"Test Teacher","email":"test@example.com","password":"password123"}' | jq .
    ```

### List lessons

=== "PowerShell"

    ```powershell
    Invoke-RestMethod -Uri http://localhost:5173/api/lessons -Headers @{Authorization="Bearer $TOKEN"}
    ```

=== "Bash"

    ```bash
    curl -s http://localhost:5173/api/lessons \
      -H "Authorization: Bearer $TOKEN" | jq .
    ```

### View dashboard

=== "PowerShell"

    ```powershell
    Invoke-RestMethod -Uri http://localhost:5173/api/teachers/4/dashboard -Headers @{Authorization="Bearer $TOKEN"}
    ```

=== "Bash"

    ```bash
    curl -s http://localhost:5173/api/teachers/4/dashboard \
      -H "Authorization: Bearer $TOKEN" | jq .
    ```

### Save LLM config

=== "PowerShell"

    ```powershell
    $body = '{"provider":"openrouter","model":"nvidia/nemotron-3-super-120b-a12b:free","api_key":"sk-or-v1-your-key"}'
    Invoke-RestMethod -Uri http://localhost:5173/api/teachers/4/llm-config -Method Put -ContentType "application/json" -Headers @{Authorization="Bearer $TOKEN"} -Body $body
    ```

=== "Bash"

    ```bash
    curl -s -X PUT http://localhost:5173/api/teachers/4/llm-config \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"provider":"openrouter","model":"nvidia/nemotron-3-super-120b-a12b:free","api_key":"sk-or-v1-your-key"}' | jq .
    ```

### Generate an adaptation

=== "PowerShell"

    ```powershell
    $body = '{"lesson_id":1,"cluster_id":4,"kb_ids":[1,2,3,4],"include_student_context":true}'
    Invoke-RestMethod -Uri http://localhost:5173/api/adapt -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $TOKEN"} -Body $body
    ```

=== "Bash"

    ```bash
    curl -s -X POST http://localhost:5173/api/adapt \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"lesson_id":1,"cluster_id":4,"kb_ids":[1,2,3,4],"include_student_context":true}' | jq .
    ```

### Health check

=== "PowerShell"

    ```powershell
    Invoke-RestMethod -Uri http://localhost:5173/api/health
    ```

=== "Bash"

    ```bash
    curl -s http://localhost:5173/api/health | jq .
    ```

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm install` fails in `server/` | `better-sqlite3` native build fails | Install `python3`, `make`, and a C++ compiler (Windows: `npm install --vs2022` or use [windows-build-tools](https://github.com/nicerthantom/windows-build-tools)) |
| "ENCRYPTION_KEY not set" when saving LLM key | `ENCRYPTION_KEY` is empty in `server/.env` | Generate a 64-char hex string and set it, then restart the server |
| "No LLM configured" when generating | No API key in Settings or env | Go to Settings and paste your OpenRouter key |
| Frontend shows blank / connection refused | Backend not running on :3000 | Start the backend first: `cd server && npm run dev` |
| API calls from frontend return 401 | JWT expired (15 min lifetime) | Log out and log back in, or refresh via the `/api/auth/refresh` endpoint |
| Embed server fails to start | `sentence-transformers` not installed | `pip install -r embed-server/requirements.txt` |
| ChromaDB connection errors | ChromaDB not running on :8000 | Start it: `chroma run --path ./chroma_data --host 127.0.0.1 --port 8000` |
| Ingestion script fails | Embed server or ChromaDB not running | Start both before running `node scripts/ingest_kbs.js --reset` |
| Port 3000 or 5173 already in use | Another process is using the port | Change `PORT` in `server/.env`, or kill the process using the port |

---

## 11. Reset the database

Delete the SQLite file and restart the backend — `init.js` re-runs `adapt-database.sql` from scratch:

=== "PowerShell"

    ```powershell
    Remove-Item adapt.db -ErrorAction SilentlyContinue
    Set-Location server; npm run dev
    ```

=== "Bash"

    ```bash
    rm -f adapt.db
    cd server && npm run dev
    ```

If you also want to reset ChromaDB:

=== "PowerShell"

    ```powershell
    Remove-Item -Recurse -Force chroma_data -ErrorAction SilentlyContinue
    ```

=== "Bash"

    ```bash
    rm -rf chroma_data
    ```

Then re-run the ingest script after starting ChromaDB again.

---

## 12. Summary of running services

| Service | Port | Start command | Required? |
|---|---|---|---|
| Express backend | 3000 | `cd server && npm run dev` | **Yes** |
| Vite frontend | 5173 | `cd client && npm run dev` | **Yes** |
| ChromaDB | 8000 | `chroma run --path ./chroma_data --host 127.0.0.1 --port 8000` | RAG only |
| Embed server | 9876 | `python server/src/services/rag/embed_server.py` | RAG only |

For the minimal setup (no RAG), you need **2 terminals**: backend + frontend. For full RAG, you need **4 terminals**: backend, frontend, ChromaDB, embed server. Then run the ingest script once.
