import Anthropic from '@anthropic-ai/sdk'
import { SessionEvent, ScenarioTemplate, Scorecard } from '../types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runEvaluator(
  sessionId: string,
  candidateName: string,
  scenario: ScenarioTemplate,
  eventLog: SessionEvent[],
  durationMinutes: number
): Promise<Scorecard> {
  const base = scoreLocally(sessionId, candidateName, scenario, eventLog, durationMinutes)
  try {
    return await enhanceWithAI(base, candidateName, scenario, eventLog, durationMinutes)
  } catch (err) {
    console.error('AI evaluation failed, using deterministic scorecard:', err)
    return base
  }
}

async function enhanceWithAI(
  base: Scorecard,
  candidateName: string,
  scenario: ScenarioTemplate,
  events: SessionEvent[],
  durationMinutes: number
): Promise<Scorecard> {
  const ofType = (t: string) => events.filter(e => e.type === t)

  const commands = ofType('command_run').map(e => String((e.payload as Record<string, unknown>).cmd ?? ''))
  const slacks = ofType('slack_sent').map(e => ({
    channel: String((e.payload as Record<string, unknown>).channel ?? ''),
    message: String((e.payload as Record<string, unknown>).message ?? '')
  }))
  const dashboards = ofType('dashboard_viewed').map(e => String((e.payload as Record<string, unknown>).dashboard_id ?? ''))
  const logs = ofType('logs_queried').map(e => String((e.payload as Record<string, unknown>).service ?? ''))
  const runbooks = ofType('runbook_called').map(e => String((e.payload as Record<string, unknown>).id ?? ''))
  const escalations = ofType('escalation_triggered').map(e => String((e.payload as Record<string, unknown>).to ?? ''))
  const severityEvent = ofType('severity_declared')[0]
  const resolved = ofType('incident_resolved').length > 0

  const eventSummary = [
    `Commands run (${commands.length}): ${commands.join(', ') || 'none'}`,
    `Slack messages (${slacks.length}): ${slacks.map(s => `[${s.channel}] ${s.message}`).join(' | ') || 'none'}`,
    `Dashboards viewed (${dashboards.length}): ${dashboards.join(', ') || 'none'}`,
    `Log queries (${logs.length}): ${logs.join(', ') || 'none'}`,
    `Runbooks used (${runbooks.length}): ${runbooks.join(', ') || 'none'}`,
    `Escalations (${escalations.length}): ${escalations.join(', ') || 'none'}`,
    severityEvent
      ? `Severity declared: ${String((severityEvent.payload as Record<string, unknown>).severity ?? '')} at ${String((severityEvent.payload as Record<string, unknown>).minutes_elapsed ?? '?')} minutes`
      : 'No severity declared',
    `Incident resolved: ${resolved ? `Yes, in ${durationMinutes} minutes` : 'No — time limit reached'}`,
    `Overall score: ${base.overall_score}/100`
  ].join('\n')

  const prompt = `You are an expert SRE assessor writing a post-incident evaluation for a candidate's technical assessment.

Scenario: ${scenario.name}
Description: ${scenario.description}
Expected root cause: ${scenario.expected_root_cause}
Expected resolution steps: ${scenario.expected_resolution_steps.join('; ')}

Candidate: ${candidateName}
Session duration: ${durationMinutes} minutes (limit: ${scenario.time_limit_minutes} minutes)

What the candidate did:
${eventSummary}

Deterministic dimension scores:
- Coordination: ${base.dimensions.coordination.score}/100
- Resolution: ${base.dimensions.resolution.score}/100
- Technical Depth: ${base.dimensions.technical_depth.score}/100
- Observability: ${base.dimensions.observability.score}/100

Write a JSON response with this exact structure:
{
  "coordination_notes": "2-3 sentences of specific, honest feedback on their coordination and communication actions",
  "resolution_notes": "2-3 sentences on whether they found the root cause and executed the right fix",
  "technical_depth_notes": "2-3 sentences on the quality and breadth of their technical investigation",
  "observability_notes": "2-3 sentences on how well they used dashboards, logs, and monitoring signals",
  "postmortem": "A 150-200 word postmortem narrative covering: what the scenario was, what the candidate did well, what they missed, and one key takeaway for their SRE growth. Be direct and specific — reference actual commands or actions they took or didn't take."
}

Be honest and specific. Reference actual commands and actions. Do not be generic.`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in AI response')

  const ai = JSON.parse(jsonMatch[0]) as {
    coordination_notes: string
    resolution_notes: string
    technical_depth_notes: string
    observability_notes: string
    postmortem: string
  }

  return {
    ...base,
    dimensions: {
      coordination: { score: base.dimensions.coordination.score, notes: ai.coordination_notes },
      resolution: { score: base.dimensions.resolution.score, notes: ai.resolution_notes },
      technical_depth: { score: base.dimensions.technical_depth.score, notes: ai.technical_depth_notes },
      observability: { score: base.dimensions.observability.score, notes: ai.observability_notes }
    },
    postmortem: ai.postmortem
  }
}

// ─── Deterministic scoring — baselines start at 0, every point must be earned ─

function scoreLocally(
  sessionId: string,
  candidateName: string,
  scenario: ScenarioTemplate,
  events: SessionEvent[],
  durationMinutes: number
): Scorecard {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

  const ofType = (t: string) => events.filter(e => e.type === t)
  const commands: string[] = ofType('command_run').map(e => String((e.payload as Record<string, unknown>).cmd ?? '').toLowerCase())
  const slacks = ofType('slack_sent')
  const dashboards = ofType('dashboard_viewed')
  const logs = ofType('logs_queried')
  const runbooks = ofType('runbook_called')
  const escalations = ofType('escalation_triggered')
  const remediation = ofType('remediation_attempted')
  const resolved = ofType('incident_resolved').length > 0
  const severityEvent = ofType('severity_declared')[0]
  const ackEvent = ofType('page_acknowledged')[0]

  const redisCommandCount = commands.filter(c => c.includes('redis')).length
  const dbCommandCount = commands.filter(c => c.includes('psql') || c.includes('postgres') || c.includes('pg_')).length
  const kubectlCount = commands.filter(c => c.includes('kubectl')).length
  const hasCorrectRemediation = remediation.length > 0
  const totalCommands = commands.length

  function simMinutes(event: SessionEvent | undefined): number {
    if (!event) return 999
    const base = new Date('2024-01-15T14:00:00Z').getTime()
    const ts = new Date(event.sim_ts).getTime()
    return Math.max(0, (ts - base) / 60000)
  }

  const severityMinutes = simMinutes(severityEvent)

  // ── COORDINATION (25%) — starts at 0 ──────────────────────────────────────
  let coordination = 0

  if (severityEvent) {
    const sev = String((severityEvent.payload as Record<string, unknown>).severity ?? '')
    coordination += (sev === 'sev1' || sev === 'sev2') ? 20 : 10
    // Timing bonus: fast declaration shows situational awareness
    if (severityMinutes <= 2) coordination += 20
    else if (severityMinutes <= 4) coordination += 12
    else if (severityMinutes <= 6) coordination += 5
  }
  if (ackEvent) coordination += 15
  // Slack: meaningful communication earns points, not just spamming
  coordination += Math.min(slacks.length * 8, 24)
  if (escalations.length > 0) coordination += 11
  if (resolved) coordination += 10

  coordination = clamp(coordination)

  // ── RESOLUTION (35%) — starts at 0 ────────────────────────────────────────
  let resolution = 0

  // Redis investigation — the key insight
  if (redisCommandCount >= 3) resolution += 25
  else if (redisCommandCount >= 2) resolution += 18
  else if (redisCommandCount >= 1) resolution += 10

  // DB investigation (expected — cascade is visible there)
  if (dbCommandCount >= 1) resolution += 8

  // Correct remediation (actually tried to restart redis)
  if (hasCorrectRemediation) resolution += 32

  // Incident resolved
  if (resolved) {
    resolution += 25
    // Speed bonus against 10-minute clock
    if (durationMinutes <= 4) resolution += 10
    else if (durationMinutes <= 6) resolution += 6
    else if (durationMinutes <= 8) resolution += 3
  }

  resolution = clamp(resolution)

  // ── TECHNICAL DEPTH (25%) — starts at 0 ───────────────────────────────────
  let technical = 0

  if (kubectlCount >= 4) technical += 22
  else if (kubectlCount >= 2) technical += 14
  else if (kubectlCount >= 1) technical += 8

  if (redisCommandCount >= 2) technical += 18
  else if (redisCommandCount >= 1) technical += 10

  if (dbCommandCount >= 2) technical += 12
  else if (dbCommandCount >= 1) technical += 6

  // Runbook usage
  if (runbooks.length >= 2) technical += 18
  else if (runbooks.length === 1) technical += 10

  // Command breadth (shows systematic thinking)
  if (totalCommands >= 8) technical += 10
  else if (totalCommands >= 5) technical += 5

  if (hasCorrectRemediation) technical += 10

  technical = clamp(technical)

  // ── OBSERVABILITY (15%) — starts at 0 ─────────────────────────────────────
  let observability = 0

  if (dashboards.length >= 3) observability += 30
  else if (dashboards.length === 2) observability += 20
  else if (dashboards.length === 1) observability += 12

  if (logs.length >= 3) observability += 30
  else if (logs.length === 2) observability += 20
  else if (logs.length === 1) observability += 10

  if (ackEvent) observability += 20

  const logServices = logs.map(e => String((e.payload as Record<string, unknown>).service ?? '').toLowerCase())
  if (logServices.some(s => s.includes('redis'))) observability += 12
  if (logServices.some(s => s.includes('order') || s.includes('postgres'))) observability += 8

  observability = clamp(observability)

  // ── OVERALL ───────────────────────────────────────────────────────────────
  const overall = clamp(Math.round(
    coordination * 0.25 +
    resolution * 0.35 +
    technical * 0.25 +
    observability * 0.15
  ))

  // ── TIMELINE HIGHLIGHTS ───────────────────────────────────────────────────
  const highlights: Scorecard['timeline_highlights'] = []

  function fmtTs(e: SessionEvent): string {
    const base = new Date('2024-01-15T14:00:00Z').getTime()
    const elapsed = Math.max(0, new Date(e.sim_ts).getTime() - base) / 1000
    const m = Math.floor(elapsed / 60)
    const s = Math.floor(elapsed % 60)
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  if (ackEvent) highlights.push({ ts: fmtTs(ackEvent), event: 'Alert acknowledged', quality: simMinutes(ackEvent) <= 1 ? 'excellent' : 'good' })
  const firstRedis = ofType('command_run').find(e => String((e.payload as Record<string, unknown>).cmd ?? '').toLowerCase().includes('redis'))
  if (firstRedis) {
    const m = simMinutes(firstRedis)
    highlights.push({ ts: fmtTs(firstRedis), event: 'Investigated Redis', quality: m <= 2 ? 'excellent' : m <= 4 ? 'good' : 'okay' })
  }
  if (severityEvent) highlights.push({ ts: fmtTs(severityEvent), event: `Declared ${String((severityEvent.payload as Record<string,unknown>).severity ?? '').toUpperCase()}`, quality: severityMinutes <= 2 ? 'excellent' : severityMinutes <= 5 ? 'good' : 'okay' })
  if (runbooks[0]) highlights.push({ ts: fmtTs(runbooks[0]), event: 'Consulted runbook', quality: 'good' })
  if (remediation[0]) highlights.push({ ts: fmtTs(remediation[0]), event: 'Redis recovery initiated', quality: 'excellent' })
  const resEvent = ofType('incident_resolved')[0]
  if (resEvent) highlights.push({ ts: fmtTs(resEvent), event: 'Incident resolved', quality: durationMinutes <= 5 ? 'excellent' : durationMinutes <= 8 ? 'good' : 'okay' })

  highlights.sort((a, b) => a.ts.localeCompare(b.ts))

  return {
    session_id: sessionId,
    overall_score: overall,
    dimensions: {
      coordination: { score: coordination, notes: buildCoordinationNotes(severityMinutes, slacks.length, escalations.length, resolved) },
      resolution: { score: resolution, notes: buildResolutionNotes(redisCommandCount, hasCorrectRemediation, resolved, durationMinutes) },
      technical_depth: { score: technical, notes: buildTechnicalNotes(kubectlCount, redisCommandCount, runbooks.length, totalCommands, hasCorrectRemediation) },
      observability: { score: observability, notes: buildObservabilityNotes(dashboards.length, logs.length, logServices) }
    },
    timeline_highlights: highlights,
    postmortem: buildPostmortem({ candidateName, durationMinutes, resolved, overall, redisCommandCount, kubectlCount, totalCommands, slackCount: slacks.length, dashboardCount: dashboards.length, logCount: logs.length, runbookCount: runbooks.length, hasCorrectRemediation, severityMinutes, scenario })
  }
}

function buildCoordinationNotes(sevMin: number, slackCount: number, escalations: number, resolved: boolean): string {
  const parts: string[] = []
  if (sevMin < 999) {
    parts.push(sevMin <= 2 ? 'Severity declared very quickly — excellent incident awareness.' : sevMin <= 5 ? `Severity declared at ${Math.round(sevMin)}m — acceptable, but faster is better.` : `Severity declaration was delayed to ${Math.round(sevMin)} minutes — this should happen within 2 minutes of paging.`)
  } else {
    parts.push('No severity was declared. This is a critical coordination step — without it, stakeholders have no SLA and the incident is invisible to management.')
  }
  if (slackCount >= 3) parts.push('Strong stakeholder communication — regular updates kept the team informed.')
  else if (slackCount >= 1) parts.push(`${slackCount} Slack message(s) sent. Aim for updates every 2-3 minutes during a SEV incident.`)
  else parts.push('No Slack updates were sent. Communication is essential — even a brief "investigating redis" message matters.')
  if (escalations > 0) parts.push('Escalation triggered appropriately.')
  if (resolved) parts.push('Incident successfully resolved.')
  return parts.join(' ')
}

function buildResolutionNotes(redisCmds: number, remediated: boolean, resolved: boolean, duration: number): string {
  const parts: string[] = []
  if (redisCmds >= 2) parts.push('Redis was correctly identified and investigated as the root cause of the cascade.')
  else if (redisCmds === 1) parts.push('Redis was checked once — more thorough investigation was needed (logs, cluster info, memory usage).')
  else parts.push('Redis was not investigated via CLI. The cache hit rate alert was the primary signal pointing directly to Redis.')
  if (remediated) parts.push('Redis recovery was initiated — triggering the system recovery sequence.')
  else parts.push('No redis restart command was issued. The fix is: kubectl rollout restart statefulset/redis-primary -n cache.')
  if (resolved) parts.push(`Incident resolved in ${duration} minutes (limit: 10). ${duration <= 5 ? 'Outstanding speed.' : duration <= 7 ? 'Good pace.' : 'Within limit but room to improve speed.'}`)
  else parts.push('Incident was not resolved before the session ended.')
  return parts.join(' ')
}

function buildTechnicalNotes(kubectl: number, redis: number, runbooks: number, total: number, _remediated: boolean): string {
  const parts: string[] = []
  if (kubectl >= 3) parts.push('Strong kubectl usage — pods, events, and logs were checked systematically.')
  else if (kubectl >= 1) parts.push(`${kubectl} kubectl command(s) run. Checking pods, events (-n cache), and logs is the baseline investigation.`)
  else parts.push('No kubectl commands were run — checking pod status is a fundamental first step in K8s incident response.')
  if (redis >= 2) parts.push('Redis CLI used effectively to inspect cache state.')
  if (runbooks >= 1) parts.push(`${runbooks} runbook(s) consulted — good use of documented procedures.`)
  else parts.push('No runbooks consulted. The Redis Recovery runbook was available and contains the exact restart steps.')
  if (total < 4) parts.push('Very few commands run overall — more systematic investigation is expected.')
  return parts.join(' ')
}

function buildObservabilityNotes(dashboards: number, logs: number, logServices: string[]): string {
  const parts: string[] = []
  if (dashboards >= 2) parts.push('Good dashboard coverage — multiple system views checked.')
  else if (dashboards === 1) parts.push('One dashboard checked. The Cache & DB dashboard would have shown redis hit_rate=0% and DB connection spike immediately.')
  else parts.push('No dashboards viewed. Opening the Cache & DB dashboard would have revealed the root cause within seconds.')
  if (logs >= 2) parts.push('Logs queried across multiple services.')
  else if (logs === 1) parts.push('Logs checked for one service.')
  else parts.push('No log queries run. Redis logs show the OOM kill; order-service logs show the ECONNREFUSED cascade.')
  if (logServices.some(s => s.includes('redis'))) parts.push('Redis logs specifically checked — this is the right signal to follow.')
  return parts.join(' ')
}

interface PostmortemArgs {
  candidateName: string; durationMinutes: number; resolved: boolean; overall: number
  redisCommandCount: number; kubectlCount: number; totalCommands: number
  slackCount: number; dashboardCount: number; logCount: number; runbookCount: number
  hasCorrectRemediation: boolean; severityMinutes: number; scenario: ScenarioTemplate
}

function buildPostmortem(a: PostmortemArgs): string {
  const lines: string[] = []
  lines.push(`Session Postmortem — ${a.candidateName}`)
  lines.push(`Scenario: ${a.scenario.name} | Duration: ${a.durationMinutes}m | Outcome: ${a.resolved ? 'RESOLVED ✓' : 'NOT RESOLVED ✗'} | Score: ${a.overall}/100`)
  lines.push(``)
  lines.push(`What happened:`)
  lines.push(`Redis primary crashed (OOM) causing every cache-dependent service to hammer PostgreSQL directly. The DB connection pool flooded within 30 seconds, service error rates spiked at 90 seconds, and without intervention the database itself would have crashed at 4 minutes.`)
  lines.push(``)
  lines.push(`What went well:`)
  const pos: string[] = []
  if (a.redisCommandCount >= 2) pos.push('Redis identified and inspected as the root cause.')
  if (a.hasCorrectRemediation) pos.push('Correct recovery action executed (redis restart).')
  if (a.resolved) pos.push(`Incident resolved in ${a.durationMinutes} minutes.`)
  if (a.slackCount >= 2) pos.push('Stakeholder communication maintained throughout.')
  if (a.dashboardCount >= 2) pos.push('Multiple dashboards used for situational awareness.')
  if (a.runbookCount >= 1) pos.push('Runbooks consulted for structured approach.')
  if (a.kubectlCount >= 3) pos.push('Strong kubectl investigation of cluster state.')
  if (a.severityMinutes <= 2) pos.push('Severity declared promptly.')
  if (pos.length === 0) pos.push('Engineer engaged with the incident and attempted investigation.')
  pos.forEach(p => lines.push(`• ${p}`))
  lines.push(``)
  lines.push(`Areas for improvement:`)
  const imp: string[] = []
  if (a.redisCommandCount === 0) imp.push('Redis was never checked via CLI — the ECONNREFUSED alert is a direct pointer to check redis-cli ping and kubectl get pods -n cache.')
  if (!a.hasCorrectRemediation) imp.push('No restart command issued. kubectl rollout restart statefulset/redis-primary -n cache is the recovery action.')
  if (a.slackCount === 0) imp.push('Zero Slack communication. Even one message ("investigating redis alert") keeps stakeholders informed.')
  if (a.severityMinutes === 999) imp.push('No severity declared. On SEV1 impacts, this should happen within 90 seconds of first alert.')
  if (a.dashboardCount === 0) imp.push('No dashboards opened. Cache & DB dashboard would have shown hit_rate=0% immediately.')
  if (a.logCount === 0) imp.push('No log queries run. kubectl logs redis-primary-0 -n cache --previous reveals the OOM kill event.')
  if (!a.resolved) imp.push('Practice the redis→db cascade pattern: identify OOM via events, restart statefulset, monitor recovery.')
  if (imp.length === 0) imp.push('Continue with chaos scenarios to build speed under pressure.')
  imp.forEach(p => lines.push(`• ${p}`))
  lines.push(``)
  lines.push(`Key lesson: Cache failures are silent amplifiers. Redis going down doesn't immediately error — it silently routes all cache reads to the database, exhausting connections in under 30 seconds. Always check cache status when you see unexpected DB latency or connection count spikes.`)
  return lines.join('\n')
}
