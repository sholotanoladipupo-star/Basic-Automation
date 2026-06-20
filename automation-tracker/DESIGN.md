# SRE Automation Tracker — Design Documentation

## Table of Contents

1. [Purpose & Context](#1-purpose--context)
2. [Application Architecture](#2-application-architecture)
3. [Feature Set](#3-feature-set)
4. [Data Model](#4-data-model)
5. [Dependencies](#5-dependencies)
6. [Infrastructure & Deployment](#6-infrastructure--deployment)
7. [Environment Variables](#7-environment-variables)
8. [Dev Environment Setup](#8-dev-environment-setup)
9. [Runbook — Moving to a Dev Database](#9-runbook--moving-to-a-dev-database)

---

## 1. Purpose & Context

The **SRE Automation Tracker** is an internal performance and initiative tracking tool built for the **Card Payment SRE** team. It provides a single source of truth for all automation initiatives raised under the `CAR-*` Jira project.

### What it tracks

Each initiative represents a discrete automation project — a runbook, a Slack bot, a monitoring setup, a process automation — that reduces toil, improves reliability, or accelerates incident response. Initiatives are associated with one of four sub-teams:

| Team | Focus |
|---|---|
| Card Payment (General) | Cross-cutting concerns, Slack tooling, onboarding, monitoring |
| Transaction Processing | DB playbooks, terminal management, routing, ISW/NIBSS integrations |
| Merchant Settlements | Settlement resets, requeue automation |
| Disputes | Refund corrections, UID reconciliation |

### Why it exists

Before this tool, initiative status lived in Jira comments, spreadsheets, and verbal updates. The tracker provides:

- **Live status visibility** — who owns what, what is in progress vs backlog vs done
- **Delivery accountability** — structured scoring with saved snapshots per period
- **Roadmap view** — a Gantt chart showing initiative timelines and the current date marker
- **Portability** — CSV export for offline reporting and leadership reviews

---

## 2. Application Architecture

### Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.3 |
| UI | React | 18 |
| Database client | `@neondatabase/serverless` | ^0.9.0 |
| Database | PostgreSQL (Neon serverless) | — |
| Hosting | Vercel | — |
| Language | JavaScript (JSX) | — |

### Directory layout

```
automation-tracker/
├── app/
│   ├── layout.js                      # Root HTML shell, page metadata
│   ├── page.js                        # Entry point — renders <AutomationTracker />
│   └── api/
│       └── data/
│           └── [key]/
│               └── route.js           # GET + POST API: reads/writes app_state by key
├── components/
│   └── AutomationTracker.jsx          # Entire UI (815 lines, single component tree)
├── lib/
│   └── db.js                          # Neon SQL client, initDb, getData, setData
├── jsconfig.json                      # Enables @/ path alias → project root
├── next.config.js                     # Next.js config (currently default)
├── package.json
├── .env.example                       # Template for required env vars
└── .env.local                         # Local secrets (gitignored)
```

### Request lifecycle

```
Browser
  │
  ├─ Page load → GET /
  │     └── app/page.js → <AutomationTracker />
  │           └── useEffect on mount
  │                 └── Promise.all([
  │                       GET /api/data/auto-lookups   ← lookup tables
  │                       GET /api/data/auto-v5        ← initiative list
  │                       GET /api/data/auto-jira      ← Jira base URL
  │                     ])
  │
  └─ User action (edit, score, bulk update)
        └── POST /api/data/{key}  body: JSON
              └── app/api/data/[key]/route.js
                    └── lib/db.js → Neon SQL UPSERT → app_state table
```

The app is a **React client component** (`"use client"` on both `page.js` and the tracker component). All state lives in React `useState`. Persistence is fire-and-forget — the UI updates immediately and the POST to the API happens in the background. A `Saved ✓` / `⚠ Save failed` toast is shown in the top bar to surface the result.

---

## 3. Feature Set

### 3.1 Table View

The default view. Columns: checkbox, Jira Key, Initiative Name, Type, Team, Assignee, Status, Impact, actions.

- **Expand row** — click anywhere on a row to reveal a Details tab (description, problem, solution) and a Score tab (criteria ratings + history)
- **Inline edit** — hover a row to reveal Edit and Delete buttons
- **Sort** — by Jira Key, Type, Status, Team, Assignee, or Name
- **Filter bar** — dropdowns for Status, Type, Team, Impact, Assignee; free-text search across name, type, team, assignee, and description

### 3.2 Roadmap / Gantt View

Switched via the `📅 Roadmap` toggle in the top bar. Renders a horizontal Gantt chart:

- Rows sorted by start date
- Bar colour reflects the initiative's current status badge colour
- A red vertical line marks today's date
- Initiatives without both a start and end date are excluded and shown in a warning footer
- Click any bar to open the edit modal

### 3.3 Delivery Scorecard

Accessible via the **★ Score** tab on any expanded row.

- 6 default criteria: Delivery Quality, Automation Correctness, Documentation, On-time Delivery, Reliability & Stability, Reusability
- Each criterion is scored 1–5 via star input
- An average score is computed and shown next to the initiative name in the table
- **Snapshots** — click "Save Snapshot" (with an optional period label like "Q1 2026") to freeze the current scores into a historical record
- **Score trend** — when 2+ snapshots exist, a bar chart renders automatically showing progress over time

### 3.4 Bulk Operations

Check multiple rows (or use the header checkbox to select all filtered) to show the **BulkBar** — a sticky blue ribbon that lets you apply a status to all selected initiatives at once.

### 3.5 CSV Export

The **⬇ Export CSV** button downloads a file named `automation-initiatives-YYYY-MM-DD.csv` containing all initiatives (not just the filtered set) with columns: Jira Key, Initiative, Type, Team, Assignee, Status, Impact, Start Date, End Date, Description, Problem, Solution, Avg Score, Score Notes, Criteria Ratings.

### 3.6 Manage Options

The **🏷️ Manage Options** modal lets you add, edit, and remove items from the four lookup tables: Types, Teams, Statuses, and Impacts. Colour picker included for Types, Statuses, and Impacts. Changes are persisted immediately to the `auto-lookups` key in the database.

### 3.7 Jira Integration

The **⚙️ Jira URL** button sets the base URL for Jira deep links (e.g. `https://yourcompany.atlassian.net/browse`). All Jira Key links in the table and Gantt view open `{jiraBase}/{key}` in a new tab. Saved to the `auto-jira` key in the database.

### 3.8 Stats Bar

Five stat cards at the top of the page, always reflecting the full unfiltered dataset:

| Card | Description |
|---|---|
| Total | All initiatives |
| Completed | Status = "Done", with percentage |
| In Flight | Not "Done" and not "Backlog" |
| Backlog | Status = "Backlog" |
| High Impact | Impact = "High" |

### 3.9 Progress by Team

Below the table, each team gets a card showing done / active / backlog counts and a completion progress bar. Click a team card to filter the table to that team.

---

## 4. Data Model

### PostgreSQL schema

```sql
CREATE TABLE IF NOT EXISTS app_state (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

A single general-purpose key-value store. The entire application state is split across three keys:

### Storage keys

#### `auto-v5` — Initiative list

Array of initiative objects. Each object:

```json
{
  "id": "CAR-228",
  "initiative": "Playbook: Insert International Card Bin",
  "type": "DB Operational Playbook",
  "team": "Transaction Processing",
  "status": "In Progress",
  "impact": "High",
  "assignee": "",
  "description": "...",
  "problem": "...",
  "solution": "...",
  "startDate": "2026-01-10",
  "endDate": "2026-03-31",
  "scores": [
    { "id": "c1", "name": "Delivery Quality", "score": 4 },
    { "id": "c2", "name": "Automation Correctness", "score": 0 }
  ],
  "scoreNotes": "Strong delivery, docs pending",
  "scoreHistory": [
    {
      "id": "abc123",
      "period": "Q1 2026",
      "date": "2026-03-01",
      "avg": "4.0",
      "scores": [...],
      "notes": "..."
    }
  ]
}
```

**Version note:** The key suffix `-v5` is intentional — future schema changes that are incompatible should use a new key (e.g. `auto-v6`) to avoid deserialisation errors on stale data.

#### `auto-lookups` — Lookup tables

```json
{
  "types": [{ "id": "t1", "name": "DB Operational Playbook", "color": "#5b21b6", "bg": "#ede9fe", "border": "#ddd6fe" }],
  "teams": [{ "id": "tm1", "name": "Card Payment (General)" }],
  "statuses": [{ "id": "s1", "name": "Backlog", "color": "#475569", "bg": "#f1f5f9", "border": "#e2e8f0" }],
  "impacts": [{ "id": "i1", "name": "High", "color": "#991b1b", "bg": "#fee2e2", "border": "#fecaca" }]
}
```

#### `auto-jira` — Jira base URL

A plain string: `"https://yourcompany.atlassian.net/browse"`

### Default seed data

On first load, if `auto-v5` is absent from the database, the app seeds itself with **21 pre-defined initiatives** (CAR-181 through CAR-232) using `makeSeed()`. Type is inferred from the initiative name via keyword matching. This seed data is never written until the user makes their first edit.

---

## 5. Dependencies

### 5.1 Neon — Serverless PostgreSQL

**What it is:** Neon is a serverless Postgres provider. Unlike a traditional hosted database, Neon scales to zero when idle and "wakes" on the first query. This makes it cost-effective for low-traffic internal tools and compatible with Vercel's serverless function model.

**Package:** `@neondatabase/serverless` — a Neon-maintained PostgreSQL client optimised for serverless environments. It uses WebSocket or HTTP transport (not the standard TCP connection used by `pg`) which is required because serverless functions cannot maintain long-lived TCP connections.

**How the app connects:**

```
lib/db.js
  │
  ├── import { neon } from "@neondatabase/serverless"
  │
  └── const sql = neon(process.env.DATABASE_URL)
        │
        └── returns a tagged template literal function
              sql`SELECT ...`  →  HTTP/WebSocket request to Neon endpoint
```

The `sql` object is constructed once at module load time from `DATABASE_URL`. In Vercel's serverless model, each function invocation is stateless and the module may be re-initialised per cold start, but Neon's pooler handles connection management transparently.

**Connection string anatomy:**

```
postgresql://neondb_owner:<password>@ep-proud-star-adwgyj7o-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
│            │             │          │                                                          │        │                 │
│            │             │          │                                                          │        │                 └── Mutual TLS binding for security
│            │             │          │                                                          │        └── Encrypt the connection
│            │             │          │                                                          └── Database name
│            │             │          └── Neon pooler hostname (region: us-east-1, c-2 = pooler tier)
│            │             └── Password (keep secret)
│            └── Database user / role
└── Protocol: standard PostgreSQL wire protocol
```

The `-pooler` suffix in the hostname routes through Neon's **connection pooler** (PgBouncer). This is the recommended endpoint for serverless workloads — it prevents exhausting Postgres connections under high concurrency.

**Key: `ep-proud-star-adwgyj7o`** is the Neon endpoint ID. Each Neon project has one or more endpoints (branches can have their own endpoints). The `ep-` prefix identifies it as a Neon compute endpoint.

---

### 5.2 Vercel — Serverless Hosting

**What it is:** Vercel is a deployment platform with native Next.js support. It builds the project and runs API routes as isolated serverless functions (AWS Lambda under the hood) in the `iad1` region (Washington D.C., US East).

**How the build works:**

1. Vercel clones the repo at the committed HEAD
2. It detects Next.js from `package.json`
3. Runs `npm install` then `npm run build` (`next build`)
4. `next build` compiles:
   - `app/page.js` → static HTML + client JS bundle (served as a static asset, ~102 kB first load JS)
   - `app/api/data/[key]/route.js` → a Node.js Lambda function (dynamic, server-rendered on demand)
5. Artefacts are uploaded to Vercel's CDN

**How API routes execute:**

Each request to `/api/data/:key` invokes a fresh Lambda. The Lambda:
1. Imports `lib/db.js` (module initialises the `sql` client using `DATABASE_URL` from Vercel's environment)
2. Calls `initDb()` once per Lambda lifecycle (guarded by the `initialized` flag — note this flag resets on cold starts)
3. Runs the query against Neon via HTTPS

**Environment variable injection:** Vercel injects all configured environment variables as `process.env.*` at runtime. The `DATABASE_URL` set in the Vercel project settings is the only secret needed for the app to function.

**Deployment topology:**

```
GitHub (main branch)
    │
    └── [push] → Vercel CLI deploy or GitHub webhook
                        │
                        ├── Build (iad1 region)
                        │     npm install + next build
                        │
                        └── Production URL
                              https://automation-tracker-nine.vercel.app
                              └── Static assets  → Vercel CDN (global edge)
                              └── /api/** routes → Lambda (iad1)
                                    └── DATABASE_URL → Neon (us-east-1)
```

---

## 6. Infrastructure & Deployment

### Current setup (production)

| Resource | Value |
|---|---|
| GitHub repo | `sholotanoladipupo-star/Basic-Automation` |
| Vercel team | `dipos-projects-7433b82a` |
| Vercel project | `automation-tracker` |
| Production URL | https://automation-tracker-nine.vercel.app |
| Neon project | `ep-proud-star-adwgyj7o` |
| Neon database | `neondb` |
| Neon region | `us-east-1` (AWS) |

### Deploying changes

Currently deployments are triggered manually via CLI from the `automation-tracker/` directory:

```bash
vercel --prod --token <TOKEN> --scope dipos-projects-7433b82a --yes
```

To enable automatic GitHub-triggered deploys on every push to `main`:

1. Go to [vercel.com/dipos-projects-7433b82a/automation-tracker/settings/git](https://vercel.com/dipos-projects-7433b82a/automation-tracker/settings/git)
2. Connect the GitHub repo `sholotanoladipupo-star/Basic-Automation`
3. Set **Root Directory** to `automation-tracker`
4. Save — subsequent pushes to `main` will trigger a production deployment automatically

---

## 7. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Full Neon (or any Postgres) connection string |

### Where it is set

| Environment | Location | File |
|---|---|---|
| Local development | `automation-tracker/.env.local` | Gitignored, never committed |
| Vercel production | Vercel project settings → Environment Variables | Injected at build/runtime |
| Template | `automation-tracker/.env.example` | Committed, no secrets |

### `.env.example`

```
# Get this from your Neon project dashboard → Connection Details
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

## 8. Dev Environment Setup

### Running locally

```bash
cd automation-tracker
npm install
npm run dev
# → http://localhost:5173
```

The local dev server connects to whichever database is specified in `.env.local`. By default this is the **production Neon database** (since `.env.local` was seeded with the production string during initial setup).

> **Warning:** Running local dev against the production database means any edits, deletions, or test data mutations will affect live data. Use a dedicated dev database for day-to-day development.

---

## 9. Runbook — Moving to a Dev Database

When working in a development environment, replace the production `DATABASE_URL` with a connection string pointing to a separate dev database. Here is exactly what changes and what stays the same.

### What changes

| Item | Production | Dev |
|---|---|---|
| `DATABASE_URL` in `.env.local` | Neon production endpoint (`ep-proud-star-*`) | Neon dev endpoint (new branch or project) |
| `DATABASE_URL` in Vercel | Production env var | Preview/dev env var (separate) |
| Data | Live initiative data | Isolated — no risk to production |
| Schema | `app_state` table (auto-created) | Same — `initDb()` runs `CREATE TABLE IF NOT EXISTS` on first request |

### What does NOT change

- All application code (`lib/db.js`, API routes, component) — zero code changes required
- The `@neondatabase/serverless` package — same client, different endpoint
- The table schema — identical DDL
- Vercel build process — identical

### Step-by-step: create a Neon dev database

**Option A — New Neon branch (recommended)**

Neon supports database branching. A branch is an instant, copy-on-write fork of the database that shares no write state with the parent.

1. Log in to [console.neon.tech](https://console.neon.tech)
2. Open your project → **Branches** → **+ New Branch**
3. Name it `dev` or `feature/my-work`
4. Go to the new branch → **Connection Details** → copy the connection string
5. The string will look like:
   ```
   postgresql://neondb_owner:<password>@ep-<new-endpoint-id>-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
6. The only difference from production is the `ep-<endpoint-id>` portion — the user, database name, and region stay the same

**Option B — Separate Neon project**

1. Create a new project in the Neon console
2. Copy the connection string from the new project's **Connection Details**
3. Proceed as below

### Step-by-step: wire the dev database locally

```bash
# Open automation-tracker/.env.local
# Replace the DATABASE_URL value:

DATABASE_URL=postgresql://neondb_owner:<password>@ep-<dev-endpoint>-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

On first `GET /api/data/*`, `initDb()` will run `CREATE TABLE IF NOT EXISTS app_state (...)` — the dev database schema is created automatically. The app will seed itself with the default 21 initiatives on first load since the table will be empty.

### Step-by-step: wire the dev database in Vercel (preview deployments)

To have pull request / preview deployments point to the dev database while production keeps pointing at the production database:

```bash
# Using Vercel CLI (run from automation-tracker/ directory)
vercel env add DATABASE_URL preview main \
  --value "postgresql://..." \
  --token <TOKEN> \
  --scope dipos-projects-7433b82a
```

Or via the Vercel dashboard:

1. Go to **Project Settings → Environment Variables**
2. Find `DATABASE_URL`
3. Add a second entry scoped to **Preview** (all branches, or a specific branch)
4. Paste the dev database connection string

Vercel will now inject the dev `DATABASE_URL` into preview deployments and the production `DATABASE_URL` into production deployments, with no code changes required.

### Summary table

```
┌─────────────────────┬────────────────────────────┬────────────────────────────┐
│                     │ Production                  │ Dev                        │
├─────────────────────┼────────────────────────────┼────────────────────────────┤
│ .env.local          │ ep-proud-star-*             │ ep-<dev-branch>-*          │
│ Vercel env scope    │ Production                  │ Preview                    │
│ Neon endpoint       │ ep-proud-star-adwgyj7o      │ ep-<new-id>                │
│ Database name       │ neondb                      │ neondb (or custom)         │
│ Schema init         │ auto on first request       │ auto on first request      │
│ Code changes        │ none                        │ none                       │
└─────────────────────┴────────────────────────────┴────────────────────────────┘
```

The entire dev/prod environment split is managed purely through the `DATABASE_URL` environment variable. No feature flags, no conditional imports, no code branching.
