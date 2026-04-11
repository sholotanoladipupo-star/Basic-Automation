# SRE Simulation Platform — Design Document

## Overview

A single-company internal platform for evaluating, training, and upskilling Site Reliability Engineers through AI-driven incident simulations. Three AI subsystems form a closed autonomous loop: a scenario engine that generates incidents, a system simulator that plays the broken environment, and an evaluator that scores every engineer action in real time.

---

## Goals

- Replace theoretical SRE interviews with realistic incident simulations
- Provide on-call readiness validation before engineers join rotation
- Enable continuous skill development through repeatable, evolving scenarios
- Generate structured, objective evaluation reports across all skill areas

---

## AI Architecture — The Core Loop

Three AI agents run concurrently during every simulation session:

```
AI Scenario Engine
      │
      │  injects failure into system state
      ▼
AI System Simulator  ◄──── Engineer actions (commands, queries, escalations)
      │
      │  observable outputs (logs, metrics, alerts)
      ▼
Engineer Interface
      │
      │  all actions logged with timestamps
      ▼
AI Evaluator  ──────────── generates scoring + postmortem
      │
      │  feedback into scenario evolution (optional)
      └──────────────────► AI Scenario Engine
```

### AI Scenario Engine

**Role:** Generates and evolves incidents during a session.

**Implementation approach:**
- Maintain a library of curated scenario *templates* (e.g. cache stampede, disk exhaustion, deployment rollout bug, cascading API failure)
- At session start, instantiate the template with randomised parameters (service names, error rates, timing, blast radius) so no two sessions are identical
- During the session, evolve the scenario based on engineer behaviour: if the engineer correctly isolates a degraded service, begin partial recovery; if they miss a dependency, expand the cascade
- Pass the current `SystemState` object as context on each scenario engine call so evolution decisions are coherent

**System prompt structure:**
```
You are an SRE scenario engine. You manage the incident state for a simulation.
Current system topology: {topology}
Current incident state: {incident_state}
Engineer actions so far: {action_log}
Your job: decide whether to evolve the incident, inject a new failure, or hold steady.
Respond only with a JSON patch to the system state.
```

**Outputs:** A JSON patch to `SystemState` on each turn.

---

### AI System Simulator

**Role:** Plays the broken production environment. Responds to every engineer command with realistic, contextually accurate fake output.

**This is the hardest component.** It must maintain coherent internal state — what services are degraded, what would be visible in logs at any given timestamp, what metrics would a dashboard show — and stay in character across an entire session.

**Implementation approach:**
- The simulator receives the full `SystemState` on every turn
- Engineer inputs are structured commands: `run_command(cmd)`, `query_dashboard(dashboard_id)`, `read_logs(service, filter)`, `call_runbook(id)`, `send_slack(channel, message)`
- The simulator responds with realistic fake output appropriate to the current incident state
- It must never "break character" — logs must be temporally consistent, metrics must match the stated degradation level, `kubectl` outputs must reflect the simulated cluster state

**System prompt structure:**
```
You are a production environment simulator. You represent a real but broken system.
Current system topology: {topology}
Current incident state: {incident_state}
Current simulated time: {sim_time}
Respond ONLY with what the real system would output. No meta-commentary.
Output format: { "stdout": "...", "exit_code": 0, "latency_ms": 120 }
```

**Key rules:**
- Logs must contain realistic noise alongside the signal
- Commands not relevant to the incident return normal healthy output
- Remediation attempts should produce partial progress if the engineer is on the right track
- Never reveal the root cause directly — let it be discoverable

---

### AI Evaluator

**Role:** Observes the full session event log and scores engineer behaviour against a structured rubric.

**Implementation approach:**
- Runs asynchronously — not in the hot path of the simulation
- Receives the complete `EventLog` at session end (or periodically for live coaching mode)
- Scores across four dimensions (see rubric below)
- Generates a structured JSON scorecard plus a prose postmortem

**Evaluation rubric:**

| Dimension | Weight | What it measures |
|---|---|---|
| Incident coordination | 25% | Severity declaration timing, stakeholder communication, escalation decisions |
| Incident resolution | 35% | Time to root cause, correct diagnosis, minimal blast radius changes |
| Technical depth | 25% | Tools used, understanding of system dependencies, automation applied |
| Observability usage | 15% | Dashboard coverage, log query quality, alert interpretation accuracy |

**System prompt structure:**
```
You are an SRE evaluation engine. Score the following simulation session.
Scenario: {scenario_description}
Expected root cause: {expected_root_cause}
Expected resolution path: {expected_path}
Event log: {event_log}
Rubric: {rubric_json}
Respond with a JSON scorecard and a prose postmortem (max 400 words).
```

**Scorecard schema:**
```json
{
  "session_id": "uuid",
  "overall_score": 82,
  "dimensions": {
    "coordination": { "score": 78, "notes": "..." },
    "resolution": { "score": 88, "notes": "..." },
    "technical_depth": { "score": 80, "notes": "..." },
    "observability": { "score": 75, "notes": "..." }
  },
  "timeline_highlights": [
    { "ts": "00:02:10", "event": "Logs inspected", "quality": "good" },
    { "ts": "00:04:00", "event": "Root cause identified", "quality": "excellent" }
  ],
  "postmortem": "..."
}
```

---

## Data Models

### SystemState

The shared object passed to all three AI agents on every turn. This is the single source of truth for what the simulated environment looks like at any moment.

```typescript
interface SystemState {
  session_id: string
  scenario_id: string
  sim_time: string               // ISO timestamp in simulation time
  
  services: Record<string, ServiceState>
  
  active_incidents: Incident[]
  resolved_incidents: Incident[]
  
  infrastructure: {
    clusters: ClusterState[]
    databases: DatabaseState[]
    caches: CacheState[]
    external_deps: ExternalDepState[]
  }
  
  metrics_snapshot: Record<string, number>  // service -> current error rate / latency / CPU
}

interface ServiceState {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  error_rate: number             // 0.0 - 1.0
  p99_latency_ms: number
  dependencies: string[]
  current_alerts: Alert[]
}

interface Incident {
  id: string
  root_cause: string             // hidden from engineer, used by evaluator
  visible_symptoms: string[]     // what the engineer can observe
  blast_radius: string[]         // which services are affected
  injected_at: string
  resolved_at?: string
}
```

---

### EventLog

Append-only log of everything the engineer does during the session. Used by the evaluator and stored for session replay.

```typescript
interface EventLog {
  session_id: string
  events: SessionEvent[]
}

interface SessionEvent {
  id: string
  ts: string                    // ISO wall clock time
  sim_ts: string                // simulated time
  type: EventType
  payload: Record<string, unknown>
  system_state_snapshot_id: string   // pointer to state at this moment
}

type EventType =
  | 'alert_received'
  | 'page_acknowledged'
  | 'command_run'
  | 'dashboard_viewed'
  | 'logs_queried'
  | 'runbook_called'
  | 'slack_sent'
  | 'severity_declared'
  | 'escalation_triggered'
  | 'remediation_attempted'
  | 'incident_resolved'
  | 'postmortem_submitted'
```

---

### ScenarioTemplate

```typescript
interface ScenarioTemplate {
  id: string
  name: string
  difficulty: 'junior' | 'senior' | 'chaos'
  
  topology: ServiceTopology         // the simulated system graph
  failure_sequence: FailureEvent[]  // ordered list of failures to inject
  
  expected_root_cause: string
  expected_resolution_steps: string[]
  
  available_runbooks: Runbook[]
  available_dashboards: Dashboard[]
  
  passing_score: number             // minimum score to mark as passed
  time_limit_minutes: number
}

interface FailureEvent {
  trigger_at_minutes: number        // or trigger on engineer_action
  trigger_on?: string               // e.g. "if engineer_has_not_checked_cache_metrics"
  type: 'service_down' | 'latency_spike' | 'error_rate_increase' | 'disk_full' | 'network_partition'
  target_service: string
  parameters: Record<string, unknown>
}
```

---

## Platform Components

### 1. Simulation Orchestrator

Central coordinator for session lifecycle. Responsibilities:

- Create and hydrate a new `SystemState` from a `ScenarioTemplate`
- Maintain the event bus connecting all three AI agents
- Route engineer commands to the AI Simulator and return responses
- Trigger the AI Scenario Engine on each turn to decide on state evolution
- Persist event log entries in append-only storage
- Enforce session time limits and handle timeouts

**Suggested stack:** Node.js / TypeScript server, WebSocket connection to the engineer interface for real-time event streaming.

### 2. Engineer Interface

The UI the candidate or trainee actually uses. Must simulate a realistic production environment:

- **Alert / paging panel** — simulated PagerDuty-style alerts with severity and description
- **Terminal** — accepts freeform commands, routes to AI Simulator
- **Metrics dashboards** — pre-built charts populated by `metrics_snapshot` in SystemState
- **Log viewer** — search interface that sends queries to AI Simulator
- **Runbook viewer** — read-only access to scenario runbooks
- **Incident management panel** — declare severity, add timeline updates, escalate, resolve
- **Slack-like comms panel** — send messages (evaluated for communication quality)

### 3. Scenario Library

Static storage for `ScenarioTemplate` records. Start with these archetypes:

**Junior scenarios:**
- High CPU on a single service
- Disk space exhaustion
- Single service OOM restart loop
- Misconfigured health check causing false alerts

**Senior scenarios:**
- Redis cache cluster failure causing DB overload cascade
- Payments API degradation due to third-party dependency timeout
- Deployment rollout introducing a subtle memory leak
- Multi-region network partition

**Chaos scenarios:**
- Simultaneous database failover + cache miss storm + CDN degradation
- Silent data corruption with no direct alerts
- Cascading failure across 5+ services with misleading red herring metrics

### 4. Session Storage

- `sessions` table: session metadata, candidate, scenario, start/end time, overall score
- `event_logs` table: all `SessionEvent` records, indexed by session_id and timestamp
- `state_snapshots` table: periodic `SystemState` snapshots for session replay
- `scorecards` table: evaluator output per session

### 5. Evaluation Pipeline

- Triggered on session end (or on-demand for live coaching)
- Pulls event log + scenario template from storage
- Calls AI Evaluator with full context
- Parses and validates scorecard JSON
- Writes scorecard to storage
- Generates PDF/HTML report for reviewer

---

## Scenario Difficulty Progression

```
On-call readiness check
    ↓
Junior scenario (single service, runbook-guided)
    ↓
Mid-level scenario (two-service cascade, some ambiguity)
    ↓
Senior scenario (multi-system cascade, architectural decisions required)
    ↓
Chaos scenario (simultaneous failures, red herrings, multi-team coordination)
```

Engineers must pass at their level before joining on-call rotation.

---

## Skill Area → Evaluation Mapping

| Skill Area | Primary Events Evaluated | Evaluator Focus |
|---|---|---|
| Incident coordination | `severity_declared`, `escalation_triggered`, `slack_sent`, `page_acknowledged` | Timing, appropriateness, communication clarity |
| Incident resolution | `remediation_attempted`, `incident_resolved`, `command_run` | Correct root cause identification, minimal unnecessary changes |
| Technical depth | `command_run`, `runbook_called`, `logs_queried` | Tool selection, understanding of dependencies, automation awareness |
| Observability design | `dashboard_viewed`, `logs_queried`, alert interaction | Coverage, query quality, proactive vs reactive monitoring |

---

## LLM Usage Summary

| Agent | Model | Latency requirement | Call frequency |
|---|---|---|---|
| AI System Simulator | Claude Sonnet | < 2s (in hot path) | Every engineer action |
| AI Scenario Engine | Claude Sonnet | < 3s (background) | Every turn or on threshold |
| AI Evaluator | Claude Sonnet | Async, no hard limit | Once per session (or periodic) |

All three agents use the same model for simplicity. System prompts are distinct and versioned per scenario.

**Context window considerations:**
- System Simulator receives: system prompt + current SystemState + last 20 engineer commands + current command. Keep SystemState compact.
- Scenario Engine receives: system prompt + current SystemState + full action log summary. Summarise action log rather than passing raw events.
- Evaluator receives: system prompt + scenario template + full event log. This will be the longest context — budget ~8k tokens for a 60-minute session.

---

## Implementation Phases

### Phase 1 — Core simulation loop (MVP)
- One hardcoded senior scenario (cache/DB cascade)
- AI System Simulator responding to terminal commands
- Basic engineer interface: terminal + log viewer + alert panel
- Static evaluation (post-session, rubric-based scoring)
- Session event logging

### Phase 2 — Scenario engine + dynamic evolution
- AI Scenario Engine with 5 scenario templates
- Dynamic incident evolution based on engineer behaviour
- Junior + senior difficulty tiers
- Structured scorecard output

### Phase 3 — Full platform
- Full scenario library (10+ templates)
- Live coaching mode (evaluator runs periodically, hints available on request)
- Session replay UI
- Candidate comparison dashboards
- On-call readiness gate (engineers must pass to join rotation)

### Phase 4 — Scale + chaos
- AI-generated scenario variants (LLM creates novel failures from topology graph)
- Multi-engineer sessions (simulated team incidents)
- Automated postmortem generation
- Chaos scenario library

---

## Open Design Questions

1. **System state granularity** — how frequently should state snapshots be taken for replay fidelity vs storage cost?
2. **Simulator consistency** — how do we prevent the AI Simulator from contradicting itself across a long session? Consider keeping a rolling summary of simulator outputs as part of its context.
3. **Rubric calibration** — scores need calibration against real engineers before using for hiring decisions. Build a calibration dataset from internal SRE team sessions.
4. **Scenario fairness** — AI-generated parameters must not inadvertently make scenarios harder for candidates unfamiliar with specific tech stacks. Templates should be stack-agnostic where possible.
5. **Cheating / gaming** — candidates could share session structures. Scenario Engine's parameterisation should be sufficient to make each session unique, but consider flagging anomalously fast root cause identification.
