import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { pool } from './db/client'
import { getCacheDatabaseCascadeScenario, checkResolutionAttempt } from './scenarios/cache-db-cascade'
import { getDbSlowQueriesScenario, checkDbSlowQueriesResolution } from './scenarios/db-slow-queries'
import { getSpannerHighUtilizationScenario, checkSpannerResolution } from './scenarios/spanner-high-utilization'
import { getPodCrashLoopScenario, checkPodCrashLoopResolution } from './scenarios/pod-crashloop'
import { runSimulator } from './agents/simulator'
import { runEvaluator } from './agents/evaluator'
import {
  ClientMessage, ServerMessage, SessionState, SystemState, SessionEvent
} from './types'

// In-memory session store keyed by session_id
const sessions = new Map<string, SessionState>()

// Track SQL/monitoring session IDs so we can mark them abandoned on disconnect
const sqlMonitoringSessions = new Set<string>()

// Attach session_id to ws object
interface SREWebSocket extends WebSocket {
  sessionId?: string
}

export function handleConnection(ws: SREWebSocket): void {
  console.log('New WebSocket connection')

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientMessage
      await routeMessage(ws, msg)
    } catch (err) {
      console.error('Message error:', err)
      sendMessage(ws, { type: 'error', payload: { message: 'Invalid message format' } })
    }
  })

  ws.on('close', async () => {
    console.log('WebSocket closed', ws.sessionId)
    if (ws.sessionId) {
      const session = sessions.get(ws.sessionId)
      if (session && !session.resolved) {
        // Incident session: clean up ticker and mark abandoned
        if (session.ticker) clearInterval(session.ticker)
        await pool.query(
          'UPDATE sessions SET ended_at = NOW(), status = $1 WHERE id = $2',
          ['abandoned', ws.sessionId]
        )
        sessions.delete(ws.sessionId)
      } else if (sqlMonitoringSessions.has(ws.sessionId)) {
        // SQL/monitoring session: mark abandoned if they disconnected before submitting
        await pool.query(
          'UPDATE sessions SET ended_at = NOW(), status = $1 WHERE id = $2 AND ended_at IS NULL',
          ['abandoned', ws.sessionId]
        )
        sqlMonitoringSessions.delete(ws.sessionId)
      }
    }
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err)
  })
}

async function routeMessage(ws: SREWebSocket, msg: ClientMessage): Promise<void> {
  switch (msg.type) {
    case 'start_session':
      await handleStartSession(ws, msg.payload)
      break
    case 'run_command':
      await handleRunCommand(ws, msg.payload)
      break
    case 'query_dashboard':
      await handleQueryDashboard(ws, msg.payload)
      break
    case 'read_logs':
      await handleReadLogs(ws, msg.payload)
      break
    case 'call_runbook':
      await handleCallRunbook(ws, msg.payload)
      break
    case 'send_slack':
      await handleSendSlack(ws, msg.payload)
      break
    case 'declare_severity':
      await handleDeclareSeverity(ws, msg.payload)
      break
    case 'escalate':
      await handleEscalate(ws, msg.payload)
      break
    case 'resolve_incident':
      await handleResolveIncident(ws)
      break
    default:
      sendMessage(ws, { type: 'error', payload: { message: `Unknown message type` } })
  }
}

async function handleStartSession(ws: SREWebSocket, payload: { candidate_name: string }): Promise<void> {
  const sessionId = uuidv4()
  ws.sessionId = sessionId

  // Look up admin-assigned scenario for this candidate
  const assignmentResult = await pool.query(
    `SELECT id, scenario_id, module_type, question_id FROM session_assignments
     WHERE LOWER(candidate_name) = LOWER($1) AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    [payload.candidate_name]
  )

  if (!assignmentResult.rows[0]) {
    sendMessage(ws, {
      type: 'error',
      payload: { message: `No simulation assigned for "${payload.candidate_name}". Ask your assessor to assign you a scenario first.` }
    })
    ws.close()
    return
  }

  const assignment = assignmentResult.rows[0] as { id: string; scenario_id: string; module_type: string; question_id: string | null }
  const moduleType = (assignment.module_type ?? 'incident') as 'incident' | 'sql' | 'monitoring'
  const questionId = assignment.question_id ?? null

  // Mark assignment used
  await pool.query(
    `UPDATE session_assignments SET status = 'used', used_at = NOW() WHERE id = $1`,
    [assignment.id]
  )

  // SQL / Monitoring modules: create session + send start message, no incident ticker
  if (moduleType === 'sql' || moduleType === 'monitoring') {
    const moduleName = moduleType === 'sql' ? 'SQL Readiness Assessment' : 'Monitoring & Observability Design'
    await pool.query(
      'INSERT INTO sessions (id, candidate_name, scenario_id, scenario_name, status) VALUES ($1, $2, $3, $4, $5)',
      [sessionId, payload.candidate_name, assignment.scenario_id ?? moduleType, moduleName, 'active']
    )
    // Track so WS close handler can mark session abandoned if they leave without submitting
    sqlMonitoringSessions.add(sessionId)
    sendMessage(ws, {
      type: 'session_started',
      payload: {
        session_id: sessionId,
        scenario_name: moduleName,
        difficulty: 'senior',
        time_limit_minutes: 15,
        module_type: moduleType,
        question_id: questionId,
        initial_alerts: [],
        available_runbooks: [],
        available_dashboards: []
      }
    })
    return
  }

  // Incident simulation flow — route to correct scenario
  const scenarioId = assignment.scenario_id ?? 'cache-db-cascade'
  const scenario =
    scenarioId === 'db-slow-queries' ? getDbSlowQueriesScenario(sessionId) :
    scenarioId === 'spanner-high-utilization' ? getSpannerHighUtilizationScenario(sessionId) :
    scenarioId === 'pod-crashloop' ? getPodCrashLoopScenario(sessionId) :
    getCacheDatabaseCascadeScenario(sessionId)

  // Apply step 0 (t=0 failure) immediately
  let initialState = { ...scenario.initial_system_state, session_id: sessionId }
  const step0 = scenario.failure_sequence[0]
  initialState = step0.apply(initialState)

  // Persist session to DB
  await pool.query(
    'INSERT INTO sessions (id, candidate_name, scenario_id, scenario_name, status) VALUES ($1, $2, $3, $4, $5)',
    [sessionId, payload.candidate_name, scenario.id, scenario.name, 'active']
  )

  const snapshotId = await saveSnapshot(sessionId, initialState)

  const session: SessionState = {
    session_id: sessionId,
    candidate_name: payload.candidate_name,
    scenario,
    system_state: initialState,
    event_log: [],
    started_at: new Date(),
    sim_time_offset_seconds: 0,
    resolved: false,
    applied_steps: new Set([0]),
    recovery_ticks: 0
  }

  sessions.set(sessionId, session)

  // Collect initial alerts from services
  const initialAlerts = Object.values(initialState.services)
    .flatMap(s => s.current_alerts)

  sendMessage(ws, {
    type: 'session_started',
    payload: {
      session_id: sessionId,
      scenario_name: scenario.name,
      difficulty: scenario.difficulty,
      time_limit_minutes: scenario.time_limit_minutes,
      module_type: 'incident',
      question_id: null,
      initial_alerts: initialAlerts,
      available_runbooks: scenario.available_runbooks.map(r => ({ id: r.id, title: r.title })),
      available_dashboards: scenario.available_dashboards.map(d => ({ id: d.id, name: d.name }))
    }
  })

  // Send initial alerts as separate new_alert messages so the UI pings
  for (const alert of initialAlerts) {
    sendMessage(ws, { type: 'new_alert', payload: alert })
  }

  // Log the initial alert_received event
  await logEvent(session, 'alert_received', { alerts: initialAlerts, snapshot_id: snapshotId })

  // Start the session ticker (every 30 seconds real time = 30 seconds sim time)
  session.ticker = setInterval(() => tickSession(ws, sessionId), 30_000)
}

async function tickSession(ws: SREWebSocket, sessionId: string): Promise<void> {
  const session = sessions.get(sessionId)
  if (!session || session.resolved) return

  session.sim_time_offset_seconds += 30

  // Advance sim_time
  const simBase = new Date('2024-01-15T14:00:00Z')
  simBase.setSeconds(simBase.getSeconds() + session.sim_time_offset_seconds)
  session.system_state.sim_time = simBase.toISOString()

  const minutesElapsed = session.sim_time_offset_seconds / 60

  // Check time limit
  if (minutesElapsed >= session.scenario.time_limit_minutes) {
    await endSession(ws, session, 'time_limit')
    return
  }

  // Apply failure steps
  let stateChanged = false
  for (let i = 1; i < session.scenario.failure_sequence.length; i++) {
    if (session.applied_steps.has(i)) continue
    const step = session.scenario.failure_sequence[i]
    if (minutesElapsed >= step.trigger_at_minutes) {
      console.log(`Applying failure step ${i}: ${step.description}`)
      const newState = step.apply(session.system_state)
      session.system_state = newState
      session.applied_steps.add(i)
      stateChanged = true

      // Fire new alerts from newly affected services
      const newAlerts = Object.values(newState.services)
        .flatMap(s => s.current_alerts)
        .filter(a => !session.event_log.some(e => e.payload['alert_id'] === a.id))

      for (const alert of newAlerts) {
        sendMessage(ws, { type: 'new_alert', payload: alert })
        await logEvent(session, 'alert_received', { alert_id: alert.id, service: alert.service })
      }
    }
  }

  // Handle recovery progression
  if (session.recovery_ticks > 0) {
    session.recovery_ticks++
    session.system_state = applyRecoveryTick(session.system_state, session.recovery_ticks)
    stateChanged = true

    if (session.recovery_ticks >= 6) {
      session.recovery_ticks = 0 // Done recovering
    }
  }

  if (stateChanged) {
    await saveSnapshot(sessionId, session.system_state)
    sendMessage(ws, { type: 'state_update', payload: session.system_state })
  }

}

function applyRecoveryTick(state: SystemState, tick: number): SystemState {
  const s = JSON.parse(JSON.stringify(state)) as SystemState

  if (tick === 1) {
    // Redis starts coming back
    s.infrastructure.caches[0].status = 'degraded'
    s.infrastructure.caches[0].hit_rate = 0.2
    s.infrastructure.caches[0].memory_used_mb = 800
  } else if (tick === 2) {
    // Redis healthy, DB starts recovering
    s.infrastructure.caches[0].status = 'healthy'
    s.infrastructure.caches[0].hit_rate = 0.7
    s.infrastructure.caches[0].memory_used_mb = 1800
    s.infrastructure.databases[0].connection_count = Math.max(45, s.infrastructure.databases[0].connection_count - 80)
    s.infrastructure.databases[0].query_latency_ms = Math.max(12, s.infrastructure.databases[0].query_latency_ms - 400)
    if (s.infrastructure.databases[0].connection_count < 100) {
      s.infrastructure.databases[0].status = 'healthy'
    }
  } else if (tick === 3) {
    // Redis fully healthy, DB nearly recovered
    s.infrastructure.caches[0].hit_rate = 0.92
    s.infrastructure.caches[0].memory_used_mb = 2200
    s.infrastructure.databases[0].connection_count = 60
    s.infrastructure.databases[0].query_latency_ms = 25
    s.infrastructure.databases[0].status = 'healthy'
    s.infrastructure.databases[1].connection_count = 25
    s.infrastructure.databases[1].query_latency_ms = 20
    s.infrastructure.databases[1].status = 'healthy'
  } else if (tick >= 4) {
    // Services recover
    s.services['product-service'].status = 'healthy'
    s.services['product-service'].error_rate = 0.02
    s.services['product-service'].p99_latency_ms = 40
    s.services['order-service'].status = 'healthy'
    s.services['order-service'].error_rate = 0.02
    s.services['order-service'].p99_latency_ms = 60
    s.services['payment-service'].status = 'healthy'
    s.services['payment-service'].error_rate = 0.01
    s.services['payment-service'].p99_latency_ms = 90
    s.services['api-gateway'].error_rate = 0.01
    s.services['api-gateway'].p99_latency_ms = 48
  }

  // Rebuild metrics snapshot
  s.metrics_snapshot = {
    'api-gateway.error_rate': s.services['api-gateway']?.error_rate ?? 0,
    'api-gateway.p99_latency_ms': s.services['api-gateway']?.p99_latency_ms ?? 0,
    'product-service.error_rate': s.services['product-service']?.error_rate ?? 0,
    'product-service.p99_latency_ms': s.services['product-service']?.p99_latency_ms ?? 0,
    'order-service.error_rate': s.services['order-service']?.error_rate ?? 0,
    'order-service.p99_latency_ms': s.services['order-service']?.p99_latency_ms ?? 0,
    'payment-service.error_rate': s.services['payment-service']?.error_rate ?? 0,
    'payment-service.p99_latency_ms': s.services['payment-service']?.p99_latency_ms ?? 0,
    'user-service.error_rate': s.services['user-service']?.error_rate ?? 0,
    'user-service.p99_latency_ms': s.services['user-service']?.p99_latency_ms ?? 0,
    'redis-primary.hit_rate': s.infrastructure.caches[0]?.hit_rate ?? 0,
    'redis-primary.memory_used_mb': s.infrastructure.caches[0]?.memory_used_mb ?? 0,
    'postgres-primary.connection_count': s.infrastructure.databases[0]?.connection_count ?? 0,
    'postgres-primary.query_latency_ms': s.infrastructure.databases[0]?.query_latency_ms ?? 0,
    'postgres-replica.connection_count': s.infrastructure.databases[1]?.connection_count ?? 0,
    'postgres-replica.query_latency_ms': s.infrastructure.databases[1]?.query_latency_ms ?? 0
  }

  return s
}

async function handleRunCommand(ws: SREWebSocket, payload: { cmd: string }): Promise<void> {
  const session = getSession(ws)
  if (!session) return

  await logEvent(session, 'command_run', { cmd: payload.cmd })
  sendMessage(ws, { type: 'thinking', payload: { message: 'Simulator processing command...' } })

  // Check for resolution attempt — use scenario-specific checker
  const scenId = session.scenario.id
  const isResolution =
    scenId === 'db-slow-queries' ? checkDbSlowQueriesResolution(payload.cmd) :
    scenId === 'spanner-high-utilization' ? checkSpannerResolution(payload.cmd) :
    scenId === 'pod-crashloop' ? checkPodCrashLoopResolution(payload.cmd) :
    checkResolutionAttempt(payload.cmd)

  if (isResolution) {
    const target = scenId === 'db-slow-queries' ? 'postgres-primary' :
      scenId === 'spanner-high-utilization' ? 'spanner-primary' :
      scenId === 'pod-crashloop' ? 'checkout-service' : 'redis-primary'
    await logEvent(session, 'remediation_attempted', { cmd: payload.cmd, target })
    if (session.recovery_ticks === 0) {
      session.recovery_ticks = 1
    }
  }

  const response = await runSimulator(payload.cmd, session.system_state)

  // Update event log with response
  const lastEvent = session.event_log[session.event_log.length - 1]
  if (lastEvent && lastEvent.type === 'command_run') {
    lastEvent.payload = { ...lastEvent.payload, stdout: response.stdout, exit_code: response.exit_code }
  }

  sendMessage(ws, { type: 'command_response', payload: response })
}

async function handleQueryDashboard(ws: SREWebSocket, payload: { dashboard_id: string }): Promise<void> {
  const session = getSession(ws)
  if (!session) return

  await logEvent(session, 'dashboard_viewed', { dashboard_id: payload.dashboard_id })

  const dashboard = session.scenario.available_dashboards.find(d => d.id === payload.dashboard_id)
  if (!dashboard) {
    sendMessage(ws, { type: 'error', payload: { message: `Dashboard ${payload.dashboard_id} not found` } })
    return
  }

  const state = session.system_state
  const metrics = []

  for (const svcName of dashboard.services) {
    const svc = state.services[svcName]
    if (svc) {
      metrics.push({ service: svcName, metric: 'error_rate', value: Math.round(svc.error_rate * 1000) / 10, unit: '%' })
      metrics.push({ service: svcName, metric: 'p99_latency_ms', value: svc.p99_latency_ms, unit: 'ms' })
    }
    if (svcName === 'redis-primary') {
      const cache = state.infrastructure.caches[0]
      if (cache) {
        metrics.push({ service: 'redis-primary', metric: 'hit_rate', value: Math.round(cache.hit_rate * 100), unit: '%' })
        metrics.push({ service: 'redis-primary', metric: 'memory_used_mb', value: cache.memory_used_mb, unit: 'MB' })
      }
    }
    if (svcName === 'postgres-primary') {
      const db = state.infrastructure.databases[0]
      if (db) {
        metrics.push({ service: 'postgres-primary', metric: 'connection_count', value: db.connection_count, unit: 'conn' })
        metrics.push({ service: 'postgres-primary', metric: 'query_latency_ms', value: db.query_latency_ms, unit: 'ms' })
      }
    }
  }

  sendMessage(ws, { type: 'dashboard_response', payload: { dashboard_id: payload.dashboard_id, name: dashboard.name, metrics } })
}

async function handleReadLogs(ws: SREWebSocket, payload: { service: string; filter?: string }): Promise<void> {
  const session = getSession(ws)
  if (!session) return

  await logEvent(session, 'logs_queried', { service: payload.service, filter: payload.filter })
  sendMessage(ws, { type: 'thinking', payload: { message: `Fetching logs for ${payload.service}...` } })

  const syntheticCmd = `journalctl -u ${payload.service} --since "10 minutes ago"${payload.filter ? ` | grep "${payload.filter}"` : ''} | tail -50`
  const response = await runSimulator(syntheticCmd, session.system_state)

  const lines = response.stdout.split('\n').filter(l => l.trim())
  sendMessage(ws, { type: 'log_response', payload: { lines } })
}

async function handleCallRunbook(ws: SREWebSocket, payload: { id: string }): Promise<void> {
  const session = getSession(ws)
  if (!session) return

  await logEvent(session, 'runbook_called', { id: payload.id })

  const runbook = session.scenario.available_runbooks.find(r => r.id === payload.id)
  if (!runbook) {
    sendMessage(ws, { type: 'error', payload: { message: `Runbook ${payload.id} not found` } })
    return
  }

  sendMessage(ws, { type: 'runbook_response', payload: { id: runbook.id, title: runbook.title, content: runbook.content } })
}

async function handleSendSlack(ws: SREWebSocket, payload: { channel: string; message: string }): Promise<void> {
  const session = getSession(ws)
  if (!session) return

  await logEvent(session, 'slack_sent', { channel: payload.channel, message: payload.message })
  sendMessage(ws, { type: 'slack_ack', payload: { channel: payload.channel, ts: new Date().toISOString() } })
}

async function handleDeclareSeverity(ws: SREWebSocket, payload: { severity: 'sev1' | 'sev2' | 'sev3' }): Promise<void> {
  const session = getSession(ws)
  if (!session) return

  const minutesElapsed = session.sim_time_offset_seconds / 60
  session.severity_declared = payload.severity
  await logEvent(session, 'severity_declared', { severity: payload.severity, minutes_elapsed: minutesElapsed })
  sendMessage(ws, { type: 'state_update', payload: session.system_state })
}

async function handleEscalate(ws: SREWebSocket, payload: { to: string; message: string }): Promise<void> {
  const session = getSession(ws)
  if (!session) return

  await logEvent(session, 'escalation_triggered', { to: payload.to, message: payload.message })
  sendMessage(ws, { type: 'slack_ack', payload: { channel: `@${payload.to}`, ts: new Date().toISOString() } })
}

async function handleResolveIncident(ws: SREWebSocket): Promise<void> {
  const session = getSession(ws)
  if (!session || session.resolved) return

  session.resolved = true
  if (session.ticker) clearInterval(session.ticker)

  const durationMinutes = Math.round((Date.now() - session.started_at.getTime()) / 60_000)

  // Mark incident resolved in state
  if (session.system_state.active_incidents[0]) {
    const incident = session.system_state.active_incidents[0]
    incident.resolved_at = new Date().toISOString()
    session.system_state.resolved_incidents.push(incident)
    session.system_state.active_incidents = []
  }

  await logEvent(session, 'incident_resolved', { duration_minutes: durationMinutes })

  await pool.query(
    'UPDATE sessions SET ended_at = NOW(), status = $1 WHERE id = $2',
    ['completed', session.session_id]
  )

  sendMessage(ws, { type: 'session_ended', payload: { reason: 'resolved', duration_minutes: durationMinutes } })

  // Run evaluator async
  runEvaluator(
    session.session_id,
    session.candidate_name,
    session.scenario,
    session.event_log,
    durationMinutes
  ).then(async (scorecard) => {
    await pool.query(
      'UPDATE sessions SET overall_score = $1 WHERE id = $2',
      [scorecard.overall_score, session.session_id]
    )
    await pool.query(
      `INSERT INTO scorecards (session_id, overall_score, dimensions, timeline_highlights, postmortem)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.session_id,
        scorecard.overall_score,
        JSON.stringify(scorecard.dimensions),
        JSON.stringify(scorecard.timeline_highlights),
        scorecard.postmortem
      ]
    )
    sendMessage(ws, { type: 'scorecard', payload: scorecard })
    sessions.delete(session.session_id)
  }).catch(err => {
    console.error('Evaluator failed:', err)
    sendMessage(ws, { type: 'error', payload: { message: 'Evaluation failed — please review manually.' } })
  })
}

async function endSession(ws: SREWebSocket, session: SessionState, reason: 'time_limit' | 'resolved' | 'manual'): Promise<void> {
  session.resolved = true
  if (session.ticker) clearInterval(session.ticker)

  const durationMinutes = Math.round((Date.now() - session.started_at.getTime()) / 60_000)

  await pool.query(
    'UPDATE sessions SET ended_at = NOW(), status = $1 WHERE id = $2',
    [reason === 'time_limit' ? 'time_limit' : 'completed', session.session_id]
  )

  sendMessage(ws, { type: 'session_ended', payload: { reason, duration_minutes: durationMinutes } })

  // Still evaluate even if time ran out
  runEvaluator(session.session_id, session.candidate_name, session.scenario, session.event_log, durationMinutes)
    .then(async (scorecard) => {
      await pool.query('UPDATE sessions SET overall_score = $1 WHERE id = $2', [scorecard.overall_score, session.session_id])
      await pool.query(
        `INSERT INTO scorecards (session_id, overall_score, dimensions, timeline_highlights, postmortem) VALUES ($1, $2, $3, $4, $5)`,
        [session.session_id, scorecard.overall_score, JSON.stringify(scorecard.dimensions), JSON.stringify(scorecard.timeline_highlights), scorecard.postmortem]
      )
      sendMessage(ws, { type: 'scorecard', payload: scorecard })
      sessions.delete(session.session_id)
    })
    .catch(console.error)
}

// Helpers

function getSession(ws: SREWebSocket): SessionState | null {
  if (!ws.sessionId) {
    sendMessage(ws, { type: 'error', payload: { message: 'No active session. Send start_session first.' } })
    return null
  }
  const session = sessions.get(ws.sessionId)
  if (!session) {
    sendMessage(ws, { type: 'error', payload: { message: 'Session not found.' } })
    return null
  }
  return session
}

function sendMessage(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

async function logEvent(session: SessionState, type: SessionEvent['type'], payload: Record<string, unknown>): Promise<void> {
  const event: SessionEvent = {
    id: uuidv4(),
    ts: new Date().toISOString(),
    sim_ts: session.system_state.sim_time,
    type,
    payload,
    system_state_snapshot_id: ''
  }
  session.event_log.push(event)

  try {
    await pool.query(
      'INSERT INTO event_logs (id, session_id, ts, sim_ts, event_type, payload) VALUES ($1, $2, NOW(), $3, $4, $5)',
      [event.id, session.session_id, event.sim_ts, event.type, JSON.stringify(event.payload)]
    )
  } catch (err) {
    console.error('Failed to persist event:', err)
  }
}

async function saveSnapshot(sessionId: string, state: SystemState): Promise<string> {
  const id = uuidv4()
  try {
    await pool.query(
      'INSERT INTO state_snapshots (id, session_id, state) VALUES ($1, $2, $3)',
      [id, sessionId, JSON.stringify(state)]
    )
  } catch (err) {
    console.error('Failed to save snapshot:', err)
  }
  return id
}
