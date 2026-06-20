# SRE Simulation Platform — Documentation

> **Live URLs**
> - Frontend: https://sre-simulator-system.vercel.app
> - Backend API: https://sre-sim-backend.onrender.com
> - Health check: https://sre-sim-backend.onrender.com/health

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Assessment Modules](#2-assessment-modules)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Database Schema](#5-database-schema)
6. [Backend API Reference](#6-backend-api-reference)
7. [Frontend Components](#7-frontend-components)
8. [Admin Workflow](#8-admin-workflow)
9. [Scoring System](#9-scoring-system)
10. [Deployment Guide](#10-deployment-guide)
11. [Environment Variables](#11-environment-variables)

---

## 1. Product Overview

The SRE Simulation Platform is a technical interview tool that assesses Site Reliability Engineering candidates across four distinct modules. Admins assign a candidate to a specific module before the interview. The candidate logs in by name, completes the assessment under a timer, and receives an instant scorecard.

### Key Design Goals

- **Realistic scenarios** — not quiz trivia. Candidates face production-like incidents, broken SQL, live Grafana-style dashboards, and real logic puzzles with SRE context.
- **Live execution** — SQL queries run against a real PostgreSQL sandbox. Answers are scored against actual query results, not static expected outputs.
- **Zero setup for candidates** — candidates only need a name and a browser. No accounts, no installs.
- **Admin control** — assessors pick the scenario and module for each candidate. Candidates cannot choose their own test.

---

## 2. Assessment Modules

### 2.1 Incident Simulation

The candidate is dropped into a live production incident. The terminal emulates real kubectl/gcloud output. Alerts fire in real time. The candidate must diagnose and resolve the incident before the timer runs out.

**Scenarios available:**
| ID | Name | Focus Area |
|----|------|------------|
| `cache-db-cascade` | Redis Cache → DB Cascade Failure | Cache eviction, connection pool, cascading failure |
| `db-slow-queries` | Database Slow Queries — Connection Pool Exhaustion | PostgreSQL, connection limits, query optimisation |
| `spanner-high-utilization` | Cloud Spanner CPU Spike — Hot Key Hotspot | Spanner internals, hot key detection, backoff |
| `pod-crashloop` | checkout-service CrashLoopBackOff | Kubernetes, pod debugging, config/OOM issues |

**How it works:**
1. WebSocket connection established between browser and backend.
2. Backend sends `session_started` with initial alert state.
3. Candidate types commands into terminal; backend evaluates against a scripted response database (`command_responses` table) and returns realistic stdout.
4. System state evolves over time — services recover or degrade based on scenario scripts.
5. Candidate sends `resolve_incident` when they believe the issue is fixed.
6. Backend scores the session and sends a `scorecard` message.

**Scored dimensions:**
- Coordination (Slack communication, escalation)
- Resolution (correct root cause identified, fix applied)
- Technical Depth (right commands, right sequence)
- Observability (dashboards, logs, runbooks consulted)

---

### 2.2 SQL Readiness Assessment

The candidate is given a SQL problem to solve against a live PostgreSQL sandbox schema. They write and run queries interactively before submitting their final answer.

**Question types:**
- `write` — write a query from scratch to match a specification
- `fix` — a broken query with syntax/logic errors; candidate corrects it
- `identify` — analyse a query and explain what is wrong

**Sandbox schema (5 tables):**
```
sql_sandbox.departments    — id, name, budget, location
sql_sandbox.employees      — id, name, department_id, role, salary, hire_date, manager_id, is_active
sql_sandbox.projects       — id, name, department_id, status, start_date, end_date, budget
sql_sandbox.project_assignments — employee_id, project_id, role, start_date
sql_sandbox.incidents      — id, title, severity, service, reported_by, resolved_by, opened_at, resolved_at, root_cause
```

**Seeded questions (5):**
1. Employee Department Lookup (easy, write)
2. Average Salary by Department (medium, write)
3. Fix the Broken Query (medium, fix)
4. Employees on Multiple Projects (hard, write)
5. SEV1 Incident Resolution Times (hard, write)

**Scoring:**
| Result | Score |
|--------|-------|
| Query ran, correct columns + all rows match | 100 |
| Correct columns, ≥80% rows match | 80 |
| Correct columns, ≥50% rows match | 60 |
| Correct columns, wrong rows | 45 |
| Query ran, wrong columns | 20 |
| Query error / not submitted | 0 |

Scoring is tolerant of numeric formatting differences (e.g. `95000.00` = `95000`) and column order. Candidate's query is compared against the live result of running the `solution_query` at submission time, not a stale stored value.

---

### 2.3 Monitoring & Observability Design

The candidate is presented with a real-world incident or monitoring scenario and must answer structured sub-questions. The UI is styled like Grafana to provide a realistic context.

**Scenario types (scenario-based troubleshooting):**
1. **Alert Firing But Dashboard Looks Normal** — diagnosing false-positive alerts, stale metrics, misconfigured thresholds
2. **Service Latency Spike — Metrics vs Reality** — Spanner lock contention, SLO burn rate communication, correlated investigation
3. **Disk Alert Firing — But Disk Metrics Look Fine** — inode exhaustion, stale Prometheus scrapes, node lifecycle

**Sub-question types:**
| Type | Icon | Description |
|------|------|-------------|
| `investigation` | 🔍 | Root cause analysis, investigation steps |
| `alert_rule` | ⚡ | Alert rule configuration, thresholds |
| `mitigation` | 🛠 | Immediate remediation steps |
| `postmortem` | 📋 | Process improvements, preventing recurrence |
| `communication` | 💬 | Stakeholder updates, incident comms |
| `datasource` | ⬡ | Grafana data source configuration |
| `alerting` | ⚡ | Alert rule definition |
| `dashboard` | 📊 | Dashboard panel design |

**Scoring:** Keyword matching against `required_keywords` (must have) and `bonus_keywords` (extra credit). Score per question = (required matches / required total) × 80 + bonus points up to 20. Overall = average across all sub-questions.

---

### 2.4 Cognitive Assessment

A timed quiz of logical reasoning and numerical problems with SRE context. Tests whether the candidate can think quantitatively under pressure.

**Question types:**
- `multiple_choice` — select from A/B/C/D options
- `numerical` — type a numerical answer

**Categories:**
- `numerical_reasoning` — arithmetic, percentages, load distribution
- `logical_reasoning` — boolean logic, sequence problems, constraint satisfaction
- `sre_maths` — SLO/error budget calculation, burn rate, MTTD/MTTR

**Seeded questions (10):**
1. Age Sum Problem (easy, numerical)
2. Server Load Distribution (easy, numerical)
3. SLO Error Budget Calculation — 99.95% SLO in minutes (medium, numerical)
4. Incident Response Time — average + 25% reduction target (medium, numerical)
5. Cache Hit Rate Impact (easy, numerical)
6. Alert Logic Pattern — AND/OR boolean conditions (medium, multiple_choice)
7. Deployment Pipeline Ordering — constraint satisfaction (medium, multiple_choice)
8. Network Throughput Bottleneck — pipeline bottleneck identification (easy, numerical)
9. On-Call Rotation Logic — modular arithmetic (medium, multiple_choice)
10. Burn Rate Alert Threshold — SRE burn rate maths (hard, numerical)

**Scoring:** Exact string match (case-insensitive) per question. Score = (correct / total) × 100.

---

## 3. System Architecture

```
┌────────────────────────────────────────────────────┐
│                  Candidate Browser                  │
│  React SPA (Vercel)                                 │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Incident    │  │  SQL     │  │  Monitoring   │  │
│  │  Simulation  │  │  Editor  │  │  (Grafana UI) │  │
│  └──────┬──────┘  └────┬─────┘  └──────┬────────┘  │
│         │ WebSocket    │ REST          │ REST        │
└─────────┼─────────────┼───────────────┼─────────────┘
          │             │               │
┌─────────▼─────────────▼───────────────▼─────────────┐
│             Express + WebSocket Server (Render)       │
│                                                       │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Orchestrator │  │ SQL      │  │ Monitoring /   │  │
│  │ (WS handler) │  │ Router   │  │ Cognitive      │  │
│  └──────┬───────┘  └────┬─────┘  └──────┬─────────┘  │
│         │               │               │              │
│  ┌──────▼───────────────▼───────────────▼──────────┐  │
│  │            PostgreSQL (Neon)                     │  │
│  │  sessions · scorecards · sql_questions           │  │
│  │  monitoring_questions · cognitive_questions      │  │
│  │  sql_sandbox schema (live query execution)       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Request Flows

**Incident module:**
```
Browser  →  WS: start_session
Backend  ←  WS: session_started (scenario state, alerts)
Browser  →  WS: run_command {cmd: "kubectl get pods"}
Backend  ←  WS: command_response {stdout, exit_code}
Browser  →  WS: resolve_incident
Backend  ←  WS: session_ended → scorecard
```

**SQL / Monitoring / Cognitive modules:**
```
Browser  →  WS: start_session
Backend  ←  WS: session_started {module_type, question_id}
Browser  →  REST POST /sql/execute     (run query live)
Browser  →  REST POST /sql/submit      (final submission + scoring)
Backend  ←  REST 200 {score, rating, scorecard, solution_query}
```

---

## 4. Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool |
| Tailwind CSS | 3 | Styling (dark GitHub-style theme) |
| WebSocket (native) | — | Incident simulation real-time connection |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 4 | HTTP server |
| ws | 8 | WebSocket server |
| pg (node-postgres) | 8 | PostgreSQL driver |
| TypeScript | 5 | Type safety |

### Infrastructure
| Service | Provider | Purpose |
|---------|----------|---------|
| Frontend hosting | Vercel | Static SPA + CDN |
| Backend hosting | Render | Node.js web service |
| Database | Neon (PostgreSQL) | Serverless PostgreSQL |
| Source control | GitHub | `sholotanoladipupo-star/Basic-Automation` |

---

## 5. Database Schema

### `sessions`
Tracks every candidate session regardless of module type.
```sql
id              UUID PRIMARY KEY
candidate_name  TEXT NOT NULL
scenario_id     TEXT NOT NULL          -- 'cache-db-cascade', 'sql', 'monitoring', etc.
scenario_name   TEXT                   -- Human-readable name
module_type     TEXT DEFAULT 'incident' -- 'incident'|'sql'|'monitoring'|'cognitive'
started_at      TIMESTAMPTZ DEFAULT NOW()
ended_at        TIMESTAMPTZ
overall_score   INTEGER                -- 0–100
status          TEXT DEFAULT 'active'  -- 'active'|'completed'|'abandoned'
```

### `session_assignments`
Admin pre-assigns a candidate to a specific module and question before they log in.
```sql
id              UUID PRIMARY KEY
candidate_name  TEXT NOT NULL
scenario_id     TEXT DEFAULT 'cache-db-cascade'
module_type     TEXT DEFAULT 'incident'
question_id     UUID                   -- Foreign key to sql/monitoring question
created_at      TIMESTAMPTZ DEFAULT NOW()
used_at         TIMESTAMPTZ
status          TEXT DEFAULT 'pending' -- 'pending'|'used'
```

### `scorecards`
Stores the final evaluation for any completed session.
```sql
id                  UUID PRIMARY KEY
session_id          UUID REFERENCES sessions(id)
overall_score       INTEGER
dimensions          JSONB   -- {dimension_name: {score, max}} or {score, notes}
timeline_highlights JSONB   -- array of strings
postmortem          TEXT
created_at          TIMESTAMPTZ DEFAULT NOW()
```

### `sql_questions`
```sql
id              UUID PRIMARY KEY
title           TEXT NOT NULL
description     TEXT NOT NULL          -- Markdown, shown to candidate
difficulty      TEXT DEFAULT 'medium'  -- 'easy'|'medium'|'hard'
question_type   TEXT DEFAULT 'write'   -- 'write'|'fix'|'identify'
starter_query   TEXT DEFAULT ''        -- Pre-filled in editor
expected_output JSONB DEFAULT '{}'     -- {columns, rows} computed at seed time
solution_query  TEXT DEFAULT ''        -- Correct query run live at submission
schema_hint     TEXT DEFAULT ''        -- Table definitions hint
hint            TEXT DEFAULT ''        -- Optional hint shown on request
time_limit_seconds INTEGER DEFAULT 300
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### `sql_attempts`
```sql
id              UUID PRIMARY KEY
session_id      UUID REFERENCES sessions(id)
question_id     UUID REFERENCES sql_questions(id)
candidate_query TEXT NOT NULL
result          JSONB    -- {columns, rows, error}
score           INTEGER
rating          TEXT     -- 'Good'|'Managing'|'Learning'
submitted_at    TIMESTAMPTZ DEFAULT NOW()
```

### `monitoring_questions`
```sql
id              UUID PRIMARY KEY
title           TEXT NOT NULL
scenario        TEXT NOT NULL          -- Context paragraph shown to candidate
difficulty      TEXT DEFAULT 'medium'
sub_questions   JSONB DEFAULT '[]'     -- Array of SubQuestion objects
time_limit_seconds INTEGER DEFAULT 600
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**SubQuestion JSON shape:**
```json
{
  "id": "q1",
  "type": "investigation",
  "prompt": "What do you do first?",
  "placeholder": "Step 1: ...",
  "required_keywords": ["logs", "kubectl"],
  "bonus_keywords": ["pg_stat_activity"],
  "reference_answer": "Full model answer shown after submission"
}
```

### `monitoring_attempts`
```sql
id              UUID PRIMARY KEY
session_id      UUID REFERENCES sessions(id)
question_id     UUID REFERENCES monitoring_questions(id)
answers         JSONB    -- [{id, answer}]
score           INTEGER
rating          TEXT
dimension_scores JSONB
submitted_at    TIMESTAMPTZ DEFAULT NOW()
```

### `cognitive_questions`
```sql
id              UUID PRIMARY KEY
title           TEXT NOT NULL
question        TEXT NOT NULL
question_type   TEXT DEFAULT 'numerical'  -- 'numerical'|'multiple_choice'
options         JSONB                     -- null or ["A","B","C","D"]
correct_answer  TEXT NOT NULL
explanation     TEXT NOT NULL DEFAULT ''
difficulty      TEXT DEFAULT 'medium'     -- 'easy'|'medium'|'hard'
category        TEXT DEFAULT 'numerical_reasoning'
time_limit_seconds INTEGER DEFAULT 60
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### `cognitive_attempts`
```sql
id              UUID PRIMARY KEY
session_id      UUID REFERENCES sessions(id)
answers         JSONB    -- [{question_id, answer}]
score           INTEGER
rating          TEXT
submitted_at    TIMESTAMPTZ DEFAULT NOW()
```

### `command_responses`
Pre-scripted terminal responses for incident simulation.
```sql
id               UUID PRIMARY KEY
scenario_id      TEXT DEFAULT 'global'
command_pattern  TEXT NOT NULL    -- Regex or literal match
state_condition  TEXT DEFAULT 'always'  -- Condition on system state
stdout           TEXT NOT NULL
exit_code        INTEGER DEFAULT 0
latency_ms       INTEGER DEFAULT 120
priority         INTEGER DEFAULT 0
```

### `event_logs` / `state_snapshots`
Audit trail for incident sessions. Every action and state change is recorded for post-session review.

---

## 6. Backend API Reference

### Base URL
`https://sre-sim-backend.onrender.com`

### Authentication
Admin endpoints require header: `x-admin-key: <ADMIN_KEY>` (default: `sre-admin-2024`)

---

### WebSocket — Incident Module

**Connect:** `wss://sre-sim-backend.onrender.com`

#### Client → Server messages

| Type | Payload | Description |
|------|---------|-------------|
| `start_session` | `{candidate_name}` | Begin session lookup + scenario setup |
| `run_command` | `{cmd}` | Execute a terminal command |
| `query_dashboard` | `{dashboard_id}` | Fetch dashboard metrics |
| `read_logs` | `{service, filter?}` | Fetch service logs |
| `call_runbook` | `{id}` | Open a runbook |
| `send_slack` | `{channel, message}` | Send a Slack message |
| `declare_severity` | `{severity}` | Declare SEV1/2/3 |
| `escalate` | `{to, message}` | Escalate to a person |
| `resolve_incident` | `{}` | Trigger resolution + scoring |

#### Server → Client messages

| Type | Payload | Description |
|------|---------|-------------|
| `session_started` | `{session_id, candidate_name, scenario_name, module_type, question_id, time_limit_minutes, initial_alerts, ...}` | Session ready |
| `command_response` | `{stdout, exit_code, latency_ms}` | Terminal output |
| `state_update` | `SystemState` | Updated system metrics |
| `new_alert` | `Alert` | New alert fired |
| `session_ended` | `{reason, duration_minutes}` | Time up or resolved |
| `scorecard` | `Scorecard` | Final evaluation |
| `error` | `{message}` | Error (e.g. no assignment found) |

---

### REST — SQL Module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/sql/execute` | None | Run a SELECT query against sandbox |
| `GET` | `/sql/schema` | None | Get table schema + 5 sample rows |
| `GET` | `/sql/questions/:id` | None | Get question (no answer) |
| `POST` | `/sql/submit` | None | Submit final query for scoring |
| `GET` | `/sql/admin/questions` | Admin | List all SQL questions |
| `POST` | `/sql/admin/questions` | Admin | Create a new SQL question |
| `DELETE` | `/sql/admin/questions/:id` | Admin | Delete a SQL question |

**POST /sql/execute** — body: `{query: string}` — returns `{columns, rows, row_count, error?, truncated?}`

**POST /sql/submit** — body: `{session_id, question_id, query}` — returns `{score, rating, scorecard, solution_query, candidate_result, graded}`

---

### REST — Monitoring Module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/monitoring/questions/:id` | None | Get question + sub-questions |
| `POST` | `/monitoring/submit` | None | Submit all answers for scoring |
| `GET` | `/monitoring/admin/questions` | Admin | List all monitoring questions |
| `POST` | `/monitoring/admin/questions` | Admin | Create monitoring question |
| `DELETE` | `/monitoring/admin/questions/:id` | Admin | Delete monitoring question |

**POST /monitoring/submit** — body: `{session_id, question_id, answers: [{id, answer}]}` — returns `{score, rating, scorecard, graded}`

---

### REST — Cognitive Module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/cognitive/questions` | None | Get all cognitive questions (no correct answers) |
| `POST` | `/cognitive/submit` | None | Submit all answers for scoring |
| `GET` | `/cognitive/admin/questions` | Admin | List all questions including answers |
| `GET` | `/cognitive/admin/attempts` | Admin | List all candidate attempts |

**POST /cognitive/submit** — body: `{session_id, answers: [{question_id, answer}]}` — returns `{score, rating, correct, total, graded, scorecard}`

---

### REST — Session Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/sessions` | None | List last 50 sessions |
| `GET` | `/sessions/:id/scorecard` | None | Get scorecard for a session |
| `GET` | `/admin/assignments` | Admin | List all assignments |
| `POST` | `/admin/assignments` | Admin | Create an assignment |
| `DELETE` | `/admin/assignments/:id` | Admin | Delete a pending assignment |
| `POST` | `/admin/seed-questions` | Admin | Seed all questions from seed file |
| `GET` | `/health` | None | Health check |

**POST /admin/assignments** — body:
```json
{
  "candidate_name": "Alice",
  "module_type": "incident|sql|monitoring|cognitive",
  "scenario_id": "cache-db-cascade",   // incident only
  "question_id": "<uuid>"              // sql/monitoring only
}
```

---

## 7. Frontend Components

```
src/
├── App.tsx                      — Root router: home|simulation|history|admin
├── types.ts                     — Shared TypeScript interfaces
├── hooks/
│   ├── useSimulation.ts         — WebSocket state machine (TypeScript)
│   └── useSimulation.js         — JavaScript build output
├── pages/
│   ├── Home.tsx                 — Login page (candidate name entry)
│   ├── Simulation.tsx           — Incident simulation UI (terminal, alerts, panels)
│   ├── SQLSimulation.tsx        — SQL editor + schema browser + score review
│   ├── MonitoringSimulation.tsx — Grafana-style monitoring UI
│   ├── CognitiveSimulation.tsx  — Quiz-style cognitive test UI
│   ├── ScoreCardPage.tsx        — Incident scorecard display
│   ├── SessionHistory.tsx       — Past sessions list
│   └── Admin.tsx                — Admin panel (assign, manage questions, results)
└── components/
    ├── AlertPanel.js
    ├── CommsPanel.js
    ├── IncidentPanel.js
    ├── LogViewer.js
    ├── MetricsDashboard.js
    ├── OnboardingModal.js
    ├── RunbookViewer.js
    └── Terminal.js
```

### Key UI Patterns

**Theme:** Dark GitHub-inspired (`#0d1117` background, `#e6edf3` text, green/amber/red for Good/Managing/Learning).

**Routing:** No React Router. State machine in `useSimulation` drives which page renders. `appScreen` state (`home|history|admin`) handles non-simulation screens.

**Module dispatch in App.tsx:**
```tsx
if (moduleType === 'sql')        return <SQLSimulation />
if (moduleType === 'monitoring') return <MonitoringSimulation />
if (moduleType === 'cognitive')  return <CognitiveSimulation />
return <Simulation />  // incident
```

**Rating system:**
| Score | Rating | Color |
|-------|--------|-------|
| ≥ 80 | Good | Green `#3fb950` |
| ≥ 50 | Managing | Amber `#d29922` |
| < 50 | Learning | Red `#f85149` |

---

## 8. Admin Workflow

### Step-by-step: assigning a candidate

1. Open the app → click **Admin**
2. Enter admin key (`sre-admin-2024` default, or `ADMIN_KEY` env var)
3. On the **Assign** tab:
   - Enter exact candidate name (case-insensitive match at login)
   - Select module type: **Incident** / **SQL Readiness** / **Monitoring Design** / **Cognitive Test**
   - For Incident: select one of the 4 scenarios
   - For SQL/Monitoring: select a specific question from the list
   - For Cognitive: no selection needed (all questions shown automatically)
4. Click **+ Assign** — assignment appears in the list with `PENDING` status
5. Candidate logs in with their name → assignment is consumed (`USED`)

### Viewing results

- **Results tab** in Admin panel: all sessions with scores and rating
- Click any session row to expand the scorecard breakdown
- Dimensions, timeline highlights, and postmortem summary are shown

### Seeding questions

Questions are seeded once per environment. To seed (or re-seed) all questions:
```bash
curl -X POST https://sre-sim-backend.onrender.com/admin/seed-questions \
  -H "x-admin-key: sre-admin-2024"
```
This seeds: 5 SQL questions, 3 monitoring scenarios, 10 cognitive questions.

---

## 9. Scoring System

### SQL Scoring (`scoreQueryResult`)

Compares candidate result rows against expected rows (from live solution query execution):
- Row comparison is order-independent (uses Set intersection)
- Column names normalised to lowercase
- Numeric values normalised via `parseFloat` (`"95000.00"` = `"95000"`)
- Column key order normalised before JSON stringify

### Monitoring Scoring (keyword matching)

Per sub-question:
```
required_score = matched_required_keywords / total_required × 80
bonus_score    = min(matched_bonus_keywords × 5, 20)
question_score = required_score + bonus_score  (max 100)
```
Overall = average of all sub-question scores.

### Cognitive Scoring

```
question_score = exact_match(candidate_answer, correct_answer) ? 1 : 0
overall = (sum of correct) / total × 100
```
Comparison is case-insensitive, trimmed. Numerical answers must match exactly after trim (e.g. `"21.6"` must equal `"21.6"`).

### Incident Scoring

Evaluated at resolution time by analysing the event log:
- Commands run at the right time
- Correct services investigated
- Proper communication steps (Slack, escalation)
- Time to resolution

---

## 10. Deployment Guide

### Prerequisites
- Node.js 18+
- PostgreSQL (Neon recommended for serverless)

### Local Development

```bash
# Backend
cd sre-simulation-platform/backend
cp .env.example .env      # add DATABASE_URL, ADMIN_KEY
npm install
npm run dev               # ts-node-dev, port 3001

# Frontend
cd sre-simulation-platform/frontend
cp .env.example .env      # add VITE_WS_URL=ws://localhost:3001
npm install
npm run dev               # Vite, port 5173
```

### Production Deployment

**Backend → Render:**
- Service type: Web Service
- Root directory: `sre-simulation-platform/backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment variables: `DATABASE_URL`, `ADMIN_KEY`, `FRONTEND_URL`

**Frontend → Vercel:**
- Root directory: `sre-simulation-platform/frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_WS_URL`
- GitHub repo linked: `sholotanoladipupo-star/Basic-Automation` (auto-deploys on push to `main`)

### First-time DB setup

The backend runs `initDb()` on startup — all tables are created automatically. Then seed questions:
```bash
curl -X POST <backend-url>/admin/seed-questions \
  -H "x-admin-key: <ADMIN_KEY>"
```

---

## 11. Environment Variables

### Backend (Render)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Neon PostgreSQL connection string |
| `ADMIN_KEY` | No | `sre-admin-2024` | Admin panel password |
| `FRONTEND_URL` | No | `*` | Allowed CORS origin(s). Comma-separated for multiple. Set to `https://sre-simulator-system.vercel.app` in production. |
| `PORT` | No | `3001` | HTTP/WS server port |

### Frontend (Vercel)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_WS_URL` | Yes | `ws://localhost:3001` | Backend WebSocket URL. Set to `wss://sre-sim-backend.onrender.com` in production. |

> **CORS note:** When `FRONTEND_URL` is set, the backend enables `credentials: true` on CORS responses. When unset (wildcard `*`), credentials are disabled. This is required because `credentials: true` and `origin: '*'` is invalid per the CORS spec.
