# SRE Simulation Platform — Technical Documentation

## Overview

A real-time incident simulation platform for assessing SRE on-call readiness. Candidates are placed inside a live production environment, paged with a siren alert, and must diagnose and resolve an infrastructure cascade failure within 10 minutes. Every action is recorded and scored automatically.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Candidate Browser                    │
│   React 18 + TypeScript + Vite 5 + Tailwind CSS          │
│                                                           │
│   Home → [enter name] → Simulation (fullscreen)          │
│   ├── AlertPanel       left sidebar                       │
│   ├── Terminal         kubectl / redis-cli / psql         │
│   ├── MetricsDashboard service health + charts            │
│   ├── LogViewer        service log search                 │
│   ├── RunbookViewer    recovery procedures                │
│   ├── IncidentPanel    severity / escalate / resolve      │
│   └── CommsPanel       #incidents Slack-like comms        │
│                                                           │
│   Admin → [admin key] → Assignments + Results tabs        │
└─────────────────────┬────────────────────────────────────┘
                      │ WebSocket (ws://)
┌─────────────────────▼────────────────────────────────────┐
│                    Node.js Backend                        │
│   Express + ws library on single HTTP server             │
│                                                           │
│   WebSocket orchestrator                                  │
│   ├── start_session  → look up assignment → begin timer  │
│   ├── run_command    → DB lookup → synthetic response    │
│   ├── query_dashboard → live SystemState metrics         │
│   ├── read_logs      → DB lookup                         │
│   ├── declare_severity / escalate / resolve_incident     │
│   └── 30s ticker → apply failure steps / recovery        │
│                                                           │
│   REST API                                               │
│   ├── GET  /health                                       │
│   ├── GET  /sessions                                     │
│   ├── GET  /sessions/:id/scorecard                       │
│   ├── GET  /admin/assignments  [x-admin-key]             │
│   ├── POST /admin/assignments  [x-admin-key]             │
│   └── DEL  /admin/assignments/:id  [x-admin-key]        │
└─────────────────────┬────────────────────────────────────┘
                      │ pg (connection pool)
┌─────────────────────▼────────────────────────────────────┐
│                  Neon PostgreSQL                          │
│                                                           │
│  sessions           active/completed simulation runs     │
│  session_assignments admin assigns scenario to candidate  │
│  event_logs         every action timestamped             │
│  state_snapshots    SystemState JSON every 30s           │
│  scorecards         final evaluation per session         │
│  command_responses  pre-seeded terminal outputs          │
└──────────────────────────────────────────────────────────┘
```

---

## Database Schema

### `sessions`
| Column | Type | Description |
|---|---|---|
| id | UUID PK | Session identifier |
| candidate_name | TEXT | Name entered on login |
| scenario_id | TEXT | e.g. `cache-db-cascade` |
| scenario_name | TEXT | Display name |
| started_at | TIMESTAMPTZ | Session start |
| ended_at | TIMESTAMPTZ | Session end (null if active) |
| overall_score | INTEGER | 0–100 final score |
| status | TEXT | `active`, `completed`, `time_limit`, `abandoned` |

### `session_assignments`
| Column | Type | Description |
|---|---|---|
| id | UUID PK | Assignment identifier |
| candidate_name | TEXT | Name to match on login (case-insensitive) |
| scenario_id | TEXT | Scenario to assign |
| created_at | TIMESTAMPTZ | When admin assigned |
| used_at | TIMESTAMPTZ | When candidate logged in |
| status | TEXT | `pending` → `used` |

### `command_responses`
| Column | Type | Description |
|---|---|---|
| command_pattern | TEXT | ILIKE match on command string |
| state_condition | TEXT | `always`, `redis_down`, `db_overloaded`, `services_degraded`, `db_down` |
| stdout | TEXT | Full terminal output |
| exit_code | INTEGER | 0 = success |
| priority | INTEGER | Higher = preferred when multiple match |

### `scorecards`
| Column | Type | Description |
|---|---|---|
| session_id | UUID FK | Links to session |
| overall_score | INTEGER | Weighted 0–100 |
| dimensions | JSONB | Per-dimension scores |
| timeline_highlights | JSONB | String array of good actions |
| postmortem | TEXT | Narrative summary |

---

## Simulation Engine

### Failure Timeline (scenario: Redis Cache → DB Cascade)

```
T+0:00   Redis goes down        → pods CrashLoopBackOff, hit_rate = 0
T+0:30   DB connection flood    → postgres connections > 300, latency spikes
T+1:30   Services degrade       → order-service / product-service 45% error rate
T+4:00   DB goes down           → if redis still down, postgres overwhelmed
```

All steps are encoded as `FailureStep[]` in `scenarios/cache-db-cascade.ts` with a `trigger_at_minutes` field. A 30-second ticker in `orchestrator.ts` advances `sim_time_offset_seconds` and applies steps when elapsed minutes cross the threshold.

### Command Response Lookup

All terminal commands resolve from the `command_responses` table — no AI API calls.

```typescript
// 1. Derive current state conditions
const conditions = getStateConditions(systemState)
// → ['always', 'redis_down', 'db_overloaded']

// 2. Query DB for best matching response
SELECT stdout, exit_code, latency_ms FROM command_responses
WHERE $command ILIKE '%' || command_pattern || '%'
  AND state_condition = ANY($conditions)
ORDER BY priority DESC, LENGTH(command_pattern) DESC
LIMIT 1
```

If no match, a generic "command not found" fallback is returned.

### Recovery Flow

When a candidate runs `kubectl rollout restart statefulset/redis-primary`, `orchestrator.ts` detects it via `checkResolutionAttempt()` and sets `recovery_ticks = 1`. The ticker then calls `applyRecoveryTick()` every 30 seconds:

```
tick 1: Redis → degraded (hit_rate 20%)
tick 2: Redis → healthy (hit_rate 70%), DB connections drop
tick 3: Redis fully healthy, DB latency normalises
tick 4: All services → healthy, error rates drop
```

---

## Scoring (Deterministic — No AI)

All baselines are **0**. Every point is earned through specific actions.

| Dimension | Weight | Key Signals |
|---|---|---|
| Incident Coordination | 25% | Severity declared within 2min (+20), Slack messages (+8 each), escalation (+11), resolve (+10) |
| Incident Resolution | 35% | Redis commands run (+25 max), correct rollout restart (+32), resolved (+25 + speed bonus) |
| Technical Depth | 25% | kubectl breadth, redis-cli, runbooks opened, remediation quality |
| Observability Usage | 15% | Dashboards queried (+30 max), logs fetched, alerts acknowledged |

**Passing score: 65/100**

---

## Admin / Candidate Flow

```
ADMIN                              CANDIDATE
  │                                    │
  ├── Go to /home → click "Admin"      │
  ├── Enter admin key                  │
  ├── Assign scenario to "Jane Smith"  │
  │   → DB: session_assignments        │
  │                                    │
  │                            ├── Go to /home
  │                            ├── Enter "Jane Smith"
  │                            ├── WS start_session
  │                            │   Backend looks up assignment
  │                            │   → Simulation starts
  │                            │   → Siren plays
  │                            │   → Onboarding modal
  │                            │
  ├── Results tab shows score  ├── Resolves or time expires
  │   with scorecard details   ├── Scorecard shown
```

If a candidate logs in with a name that has no pending assignment, they see:
> "No simulation assigned for 'Michael'. Ask your assessor to assign you a scenario first."

---

## Alert Sound

Uses **Web Audio API** to guarantee reliable playback (unlike `<audio>` or `speechSynthesis` which are blocked outside user-gesture contexts).

```typescript
// Unlocked on button click (user gesture)
audioCtx = new AudioContext()
audioCtx.resume()

// Siren: oscillator sweeps 400→1100 Hz twice (wee-woo style)
osc.frequency: 400 → 1100 → 400 → 1100 over 1.4 seconds
osc.type: 'sawtooth'  // harsh, attention-grabbing timbre

// Speech synthesis appended as secondary layer
speechSynthesis.speak("PagerDuty Alert. Redis pod CrashLoopBackOff...")
```

---

## Deployment

### Frontend → Vercel

**Live URL:** `https://frontend-flax-tau-39.vercel.app`

- Auto-detected as Vite project
- Build command: `npm run build`
- Output: `dist/`
- SPA rewrites in `vercel.json` route all paths to `index.html`

**Environment variable (set in Vercel dashboard):**
```
VITE_WS_URL = wss://<your-railway-backend-url>
```

### Backend → Railway

**Status:** Token provided (`81a3ed99-...`) appears to be a project ID rather than a personal API token. Personal tokens are generated at `railway.app/account/tokens`.

**Manual Railway setup (5 minutes):**

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select `sholotanoladipupo-star/Basic-Automation`
3. Set **Root Directory**: `sre-simulation-platform/backend`
4. Railway auto-detects Node.js. Start command: `npm run build && npm start`
5. Add environment variables:
   ```
   DATABASE_URL   = postgresql://neondb_owner:npg_fMNuR6z5ErpX@ep-proud-star-adwgyj7o-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ADMIN_KEY      = <choose a strong key, share only with assessors>
   FRONTEND_URL   = https://frontend-flax-tau-39.vercel.app
   ```
6. Once deployed, copy the Railway domain (e.g. `sre-sim.railway.app`)
7. Go to Vercel → Project → Settings → Environment Variables
8. Set `VITE_WS_URL = wss://sre-sim.railway.app`
9. Redeploy Vercel: `vercel --prod --token <token> --scope dipos-projects-7433b82a`

**After Railway is live, also run the seed script to populate command responses:**
```bash
# From your local machine or Railway shell
cd sre-simulation-platform/backend
DATABASE_URL="<neon-url>" npx ts-node src/db/seed.ts
```

---

## Running Locally

```bash
# 1. Install dependencies
cd sre-simulation-platform
npm run install:all

# 2. Configure backend
cd backend
cp .env.example .env
# Edit .env with real DATABASE_URL

# 3. Initialise DB + seed command responses
npm run db:init
npm run db:seed

# 4. Start backend (port 3001)
npm run dev

# 5. Start frontend (port 5173)
cd ../frontend
npm run dev
```

---

## Repository Structure

```
sre-simulation-platform/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── evaluator.ts      deterministic scoring engine
│   │   │   └── simulator.ts      DB-backed command response lookup
│   │   ├── db/
│   │   │   ├── client.ts         pg connection pool
│   │   │   ├── init.ts           schema migrations (idempotent)
│   │   │   └── seed.ts           ~35 pre-defined command responses
│   │   ├── scenarios/
│   │   │   └── cache-db-cascade.ts  failure timeline + initial state
│   │   ├── index.ts              Express + WebSocket server
│   │   ├── orchestrator.ts       session lifecycle + ticker
│   │   └── types.ts              shared interfaces
│   ├── railway.json              Railway deploy config
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── AlertPanel.tsx      PagerDuty-style alert feed
    │   │   ├── Terminal.tsx        command input + history
    │   │   ├── MetricsDashboard.tsx live service health
    │   │   ├── LogViewer.tsx       service log search
    │   │   ├── RunbookViewer.tsx   recovery runbooks
    │   │   ├── IncidentPanel.tsx   severity / escalate / resolve
    │   │   ├── CommsPanel.tsx      Slack-like comms
    │   │   └── OnboardingModal.tsx glossary + instructions
    │   ├── hooks/
    │   │   └── useSimulation.ts    WebSocket state machine + audio
    │   ├── pages/
    │   │   ├── Home.tsx            candidate login
    │   │   ├── Admin.tsx           admin portal (assign + results)
    │   │   ├── Simulation.tsx      main simulation UI
    │   │   ├── ScoreCardPage.tsx   post-session scorecard
    │   │   └── SessionHistory.tsx  all past sessions
    │   └── App.tsx                 screen router
    └── vercel.json                 Vercel config
```

---

## Technology Choices

| Concern | Choice | Reason |
|---|---|---|
| Real-time comms | WebSocket (ws) | Bi-directional, low-latency; Vercel doesn't support persistent WS natively |
| Command simulation | Neon DB lookup | No AI API credits needed; deterministic, fast, reproducible |
| Scoring | Deterministic algorithm | Eliminates LLM hallucination in grading; auditable |
| Audio | Web Audio API | Only API that works from non-user-gesture event contexts after initial unlock |
| State management | React useState + WS | No Redux needed; single simulation state machine in useSimulation.ts |
| Styling | Tailwind CSS v3 | Utility-first; dark GitHub-style theme without custom CSS |
| DB | Neon (serverless Postgres) | Serverless, auto-scale, branching, free tier |

---

*Built March 2026 · GitHub: `sholotanoladipupo-star/Basic-Automation`*
