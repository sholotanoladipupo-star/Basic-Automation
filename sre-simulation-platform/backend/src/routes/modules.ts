/**
 * REST routes for SQL and Monitoring modules.
 * Mounted at /sql and /monitoring in index.ts.
 * Admin question management also lives here (protected by x-admin-key).
 */
import { Router, Request, Response, NextFunction } from 'express'
import { pool } from '../db/client'
import { executeQuery, scoreQueryResult, sqlRating } from '../sql-executor'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function aiPostmortem(prompt: string): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
    const block = msg.content[0]
    return block.type === 'text' ? block.text.trim() : ''
  } catch {
    return ''
  }
}

const ADMIN_KEY = process.env.ADMIN_KEY || 'sre-admin-2024'
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) { res.status(401).json({ error: 'Unauthorized' }); return }
  next()
}

// ─── SQL ────────────────────────────────────────────────────────────────────

export const sqlRouter = Router()

/** Run a query against the sandbox schema (no auth — candidates use this) */
sqlRouter.post('/execute', async (req, res) => {
  const { query } = req.body as { query?: string }
  if (!query?.trim()) { res.status(400).json({ error: 'query required' }); return }
  try {
    const result = await executeQuery(query)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

/** Schema browser — returns table columns + 5 sample rows for each sandbox table */
sqlRouter.get('/schema', async (_req, res) => {
  const tables = ['departments', 'employees', 'projects', 'project_assignments', 'incidents']
  try {
    const result: Record<string, { columns: { name: string; type: string }[]; sample_rows: Record<string, unknown>[] }> = {}
    for (const table of tables) {
      const cols = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'sql_sandbox' AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
      )
      const rows = await pool.query(`SELECT * FROM sql_sandbox.${table} LIMIT 5`)
      result[table] = {
        columns: cols.rows.map((c: Record<string, string>) => ({ name: c.column_name, type: c.data_type })),
        sample_rows: rows.rows
      }
    }
    res.json(result)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

/** Get a question by id (candidate view — no answer revealed) */
sqlRouter.get('/questions/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, description, difficulty, question_type, starter_query, schema_hint, hint, time_limit_seconds FROM sql_questions WHERE id = $1`,
      [req.params.id]
    )
    if (!r.rows[0]) { res.status(404).json({ error: 'Question not found' }); return }
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

/** Submit final answer — scores + saves attempt */
sqlRouter.post('/submit', async (req, res) => {
  const { session_id, question_id, query } = req.body as { session_id?: string; question_id?: string; query?: string }
  if (!session_id || !question_id || !query) { res.status(400).json({ error: 'session_id, question_id, query required' }); return }
  try {
    const qr = await pool.query(`SELECT expected_output, solution_query FROM sql_questions WHERE id = $1`, [question_id])
    if (!qr.rows[0]) { res.status(404).json({ error: 'Question not found' }); return }

    const solutionQuery = (qr.rows[0].solution_query ?? '') as string
    const storedExpected = qr.rows[0].expected_output as { columns: string[]; rows: Record<string, unknown>[] }

    // Run candidate and solution queries in parallel
    const [result, solutionResult] = await Promise.all([
      executeQuery(query),
      solutionQuery.trim() ? executeQuery(solutionQuery) : Promise.resolve(null)
    ])

    // Score against live solution result if available, fall back to stored expected_output
    const expected = (solutionResult && !solutionResult.error)
      ? { columns: solutionResult.columns, rows: solutionResult.rows }
      : storedExpected
    const score = scoreQueryResult(result, expected)
    const rating = sqlRating(score)

    await pool.query(
      `INSERT INTO sql_attempts (session_id, question_id, candidate_query, result, score, rating) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [session_id, question_id, query, JSON.stringify(result), score, rating]
    )

    // Update session score
    await pool.query(`UPDATE sessions SET overall_score = $1, ended_at = NOW(), status = 'completed' WHERE id = $2`, [score, session_id])

    // Build scorecard with AI postmortem
    const aiPrompt = `You are an SRE hiring assessor reviewing a SQL exercise submission.
Score: ${score}/100 (${rating})
Candidate query:
${query}
${result.error ? `Error: ${result.error}` : `Returned ${result.rows?.length ?? 0} rows, columns: ${result.columns?.join(', ')}`}
Expected: ${expected ? `${(expected.rows ?? []).length} rows` : 'unknown'}

Write 2-3 concise sentences of specific, actionable feedback for the candidate covering what they got right and what to improve. Be direct and constructive.`

    const fallbackPostmortem = score >= 80 ? 'Strong SQL skills demonstrated.' : score >= 50 ? 'Core SQL knowledge present. Practice JOINs and aggregations.' : 'SQL fundamentals need more work. Review JOIN syntax and WHERE conditions.'
    const postmortem = (await aiPostmortem(aiPrompt)) || fallbackPostmortem

    const scorecard = {
      session_id,
      overall_score: score,
      module_type: 'sql',
      rating,
      result,
      dimensions: {
        query_correctness: { score: Math.round(score * 0.6), max: 60 },
        syntax_accuracy:   { score: result.error ? 0 : Math.round(score * 0.2), max: 20 },
        result_completeness: { score: Math.round(score * 0.2), max: 20 },
      },
      timeline_highlights: score >= 80 ? ['Correct result returned', 'Query executed without errors'] : score >= 50 ? ['Query executed', 'Some results matched'] : ['Query had issues'],
      postmortem_summary: postmortem
    }

    await pool.query(
      `INSERT INTO scorecards (session_id, overall_score, dimensions, timeline_highlights, postmortem)
       VALUES ($1,$2,$3,$4,$5)`,
      [session_id, score, JSON.stringify(scorecard.dimensions), JSON.stringify(scorecard.timeline_highlights), scorecard.postmortem_summary]
    )

    res.json({ score, rating, scorecard, solution_query: solutionQuery, candidate_result: result })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin CRUD for SQL questions
sqlRouter.get('/admin/questions', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT id, title, difficulty, question_type, time_limit_seconds, created_at FROM sql_questions ORDER BY created_at DESC`)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

sqlRouter.post('/admin/questions', requireAdmin, async (req, res) => {
  const { title, description, difficulty, question_type, starter_query, expected_output, solution_query, schema_hint, hint, time_limit_seconds } = req.body as Record<string, unknown>
  try {
    const r = await pool.query(
      `INSERT INTO sql_questions (title, description, difficulty, question_type, starter_query, expected_output, solution_query, schema_hint, hint, time_limit_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, description, difficulty ?? 'medium', question_type ?? 'write', starter_query ?? '', JSON.stringify(expected_output ?? {}), solution_query ?? '', schema_hint ?? '', hint ?? '', time_limit_seconds ?? 300]
    )
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

sqlRouter.delete('/admin/questions/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM sql_questions WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin: view attempts for a question
sqlRouter.get('/admin/attempts', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.id, a.session_id, a.score, a.rating, a.submitted_at, s.candidate_name, q.title
       FROM sql_attempts a
       JOIN sessions s ON s.id = a.session_id
       JOIN sql_questions q ON q.id = a.question_id
       ORDER BY a.submitted_at DESC LIMIT 100`
    )
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// ─── MONITORING ──────────────────────────────────────────────────────────────

export const monitoringRouter = Router()

/** Get a question (candidate view — reference answers hidden) */
monitoringRouter.get('/questions/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, scenario, difficulty, time_limit_seconds,
        (SELECT jsonb_agg(jsonb_build_object('id',sq->>'id','prompt',sq->>'prompt','type',sq->>'type','placeholder',sq->>'placeholder'))
         FROM jsonb_array_elements(sub_questions) sq) AS sub_questions
       FROM monitoring_questions WHERE id = $1`,
      [req.params.id]
    )
    if (!r.rows[0]) { res.status(404).json({ error: 'Question not found' }); return }
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

/** Score keywords in a text answer */
function scoreMonitoringAnswer(answer: string, required: string[], bonus: string[]): number {
  const lower = answer.toLowerCase()
  const reqMatched = required.filter(k => lower.includes(k.toLowerCase())).length
  const bonusMatched = bonus.filter(k => lower.includes(k.toLowerCase())).length
  const reqScore = required.length > 0 ? (reqMatched / required.length) * 65 : 65
  const bonusScore = bonus.length > 0 ? (bonusMatched / bonus.length) * 35 : 0
  return Math.round(reqScore + bonusScore)
}

/** Submit monitoring answers */
monitoringRouter.post('/submit', async (req, res) => {
  const { session_id, question_id, answers } = req.body as { session_id?: string; question_id?: string; answers?: { id: string; answer: string }[] }
  if (!session_id || !question_id || !answers) { res.status(400).json({ error: 'session_id, question_id, answers required' }); return }
  try {
    const qr = await pool.query(`SELECT sub_questions FROM monitoring_questions WHERE id = $1`, [question_id])
    if (!qr.rows[0]) { res.status(404).json({ error: 'Question not found' }); return }

    const subQuestions = qr.rows[0].sub_questions as { id: string; required_keywords: string[]; bonus_keywords: string[]; reference_answer: string }[]
    const scored = answers.map(a => {
      const sq = subQuestions.find(s => s.id === a.id)
      if (!sq) return { id: a.id, score: 0, reference_answer: '' }
      const score = scoreMonitoringAnswer(a.answer, sq.required_keywords ?? [], sq.bonus_keywords ?? [])
      return { id: a.id, score, reference_answer: sq.reference_answer }
    })

    const overallScore = Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
    const rating = sqlRating(overallScore)

    await pool.query(
      `INSERT INTO monitoring_attempts (session_id, question_id, answers, score, rating, dimension_scores)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [session_id, question_id, JSON.stringify(answers), overallScore, rating, JSON.stringify(scored)]
    )

    await pool.query(`UPDATE sessions SET overall_score = $1, ended_at = NOW(), status = 'completed' WHERE id = $2`, [overallScore, session_id])

    // AI postmortem
    const qaSummary = answers.map((a, i) => {
      const sq = subQuestions[i]
      const s = scored.find(x => x.id === a.id)
      return `Q: ${sq?.id ?? a.id}\nAnswer: ${a.answer}\nScore: ${s?.score ?? 0}/100`
    }).join('\n\n')

    const aiPrompt = `You are an SRE hiring assessor reviewing a monitoring/observability exercise.
Overall score: ${overallScore}/100 (${rating})

Candidate answers:
${qaSummary}

Write 2-3 concise sentences of specific, actionable feedback covering their observability knowledge strengths and areas to improve. Be direct and constructive.`

    const fallbackPostmortem = overallScore >= 80 ? 'Strong observability skills.' : overallScore >= 50 ? 'Good fundamentals. Practice PromQL syntax and alert design patterns.' : 'Review PromQL basics, SLOs, and alerting principles.'
    const postmortem = (await aiPostmortem(aiPrompt)) || fallbackPostmortem

    const scorecard = {
      session_id, overall_score: overallScore, module_type: 'monitoring', rating,
      dimensions: Object.fromEntries(scored.map((s, i) => [`question_${i + 1}`, { score: s.score, max: 100 }])),
      timeline_highlights: overallScore >= 80 ? ['Correct PromQL expressions', 'Proper alerting strategy used'] : overallScore >= 50 ? ['Partial answers provided', 'Core concepts present'] : ['Needs more work'],
      postmortem_summary: postmortem,
      sub_scores: scored
    }

    await pool.query(
      `INSERT INTO scorecards (session_id, overall_score, dimensions, timeline_highlights, postmortem)
       VALUES ($1,$2,$3,$4,$5)`,
      [session_id, overallScore, JSON.stringify(scorecard.dimensions), JSON.stringify(scorecard.timeline_highlights), scorecard.postmortem_summary]
    )

    res.json({ score: overallScore, rating, scorecard, sub_scores: scored })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin CRUD for monitoring questions
monitoringRouter.get('/admin/questions', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT id, title, difficulty, time_limit_seconds, created_at FROM monitoring_questions ORDER BY created_at DESC`)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

monitoringRouter.post('/admin/questions', requireAdmin, async (req, res) => {
  const { title, scenario, difficulty, sub_questions, time_limit_seconds } = req.body as Record<string, unknown>
  try {
    const r = await pool.query(
      `INSERT INTO monitoring_questions (title, scenario, difficulty, sub_questions, time_limit_seconds) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, scenario, difficulty ?? 'medium', JSON.stringify(sub_questions ?? []), time_limit_seconds ?? 600]
    )
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

monitoringRouter.delete('/admin/questions/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM monitoring_questions WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

/** Seed default monitoring questions */
monitoringRouter.post('/admin/seed', requireAdmin, async (_req, res) => {
  const seeds = [
    {
      title: 'Design Monitoring for a Payment Service Outage',
      scenario: `Your payment-service has just experienced a 45-minute P1 outage. Error rates hit 85%, p99 latency exceeded 8s, and 1,200 transactions failed. Post-incident, engineering leadership has asked you to design a comprehensive monitoring and alerting strategy to detect and respond to similar issues in under 5 minutes next time.\n\nSystem context:\n- payment-service (Node.js, 6 pods)\n- PostgreSQL primary + 1 read replica\n- Redis cache (session/rate-limit data)\n- Kafka topic: payment-events\n- Upstream: Stripe API, bank gateway\n- Metrics available: Prometheus + Grafana, logs in Cloud Logging`,
      difficulty: 'hard',
      sub_questions: [
        { id: 'datasource', prompt: 'Design your Grafana data source and dashboard panels. Which metrics would you track on the payment-service dashboard? List at least 5 panels with the PromQL query or metric name, and the alert threshold for each.', type: 'datasource', placeholder: 'e.g.\nPanel: Payment Error Rate\nQuery: rate(http_requests_total{service="payment-service",status=~"5.."}[5m]) / rate(http_requests_total{service="payment-service"}[5m])\nThreshold: > 5% → WARNING, > 15% → CRITICAL\n\nPanel: DB Connection Pool...' },
        { id: 'alert_rule', prompt: 'Write 3 alert rules using Grafana Alerting or Prometheus AlertManager. For each rule specify: metric/expression, evaluation interval, for-duration (how long before it fires), severity, and the message template.', type: 'alert_rule', placeholder: 'Alert 1: PaymentServiceHighErrorRate\nExpression: ...\nFor: 2m\nSeverity: critical\nMessage: ...\n\nAlert 2: ...' },
        { id: 'contact_point', prompt: 'Define your contact points and notification routing. Where should P1 alerts go (PagerDuty? Slack? OpsGenie?)? How do you avoid alert fatigue? Describe your escalation chain if the primary on-call does not acknowledge within 5 minutes.', type: 'contact_point', placeholder: 'Contact points:\n- P1 (critical): PagerDuty → on-call engineer → 5min escalation to EM\n- P2 (warning): #payments-alerts Slack channel\n\nEscalation policy: ...' },
        { id: 'notification_policy', prompt: 'Design the notification policy including grouping, repeat interval, and inhibition rules. How would you suppress downstream alert noise when the upstream cause (e.g., DB down) is already alerting?', type: 'notification_policy', placeholder: 'Group by: [service, severity]\nGroup wait: 30s\nRepeat interval: 4h\n\nInhibition rule: suppress payment-service alerts when postgres-primary is already DOWN\n...' },
      ],
      time_limit_seconds: 720,
    },
    {
      title: 'SLO Design — Checkout Service Reliability',
      scenario: `You are the SRE responsible for the checkout-service, which handles the final step of the purchase funnel. The business requires 99.9% monthly availability. Currently you have no SLOs defined and no error budget policy.\n\nSystem context:\n- checkout-service processes ~2,000 requests/minute at peak\n- 3 pods in prod, 1 in staging\n- Dependencies: payment-service, order-service, inventory-service\n- Current uptime: ~99.6% (measured by ops team doing manual checks)\n- No synthetic monitoring exists`,
      difficulty: 'medium',
      sub_questions: [
        { id: 'datasource', prompt: 'Define the SLI (Service Level Indicator) for checkout-service. What exactly will you measure? Write the PromQL or metric expression. Explain why you chose this SLI over alternatives (latency vs. availability vs. error rate).', type: 'datasource', placeholder: 'SLI: Availability\nDefinition: proportion of checkout requests that return HTTP 2xx within 2s\nPromQL: sum(rate(checkout_requests_total{status=~"2.."}[5m])) / sum(rate(checkout_requests_total[5m]))\n\nWhy: ...' },
        { id: 'alert_rule', prompt: 'Design two burn-rate alerts for your SLO: a fast-burn alert (detects rapid error budget consumption) and a slow-burn alert (detects gradual leaks). Include the burn rate multiplier, look-back window, and alert threshold for each.', type: 'alert_rule', placeholder: 'Fast burn: 14.4x burn rate over 1h → pages immediately\nExpression: ...\n\nSlow burn: 3x burn rate over 6h → creates ticket\nExpression: ...' },
        { id: 'contact_point', prompt: 'What is your error budget policy? If 100% of the monthly error budget is consumed in week 1, what happens? Define freeze conditions, freeze duration, and which team/role makes the call to freeze deployments.', type: 'contact_point', placeholder: 'Error budget policy:\n- 0–50% consumed: normal operations\n- 50–75% consumed: increased release scrutiny, EM notified\n- 75–100% consumed: freeze new deployments, focus on reliability\n- >100% consumed: incident declared, post-incident review mandatory\n\nDecision maker: ...' },
        { id: 'notification_policy', prompt: 'Design your SLO dashboard in Grafana. List the 4 panels you would include with their queries. How do you communicate remaining error budget to stakeholders (weekly report? Slack bot?).', type: 'notification_policy', placeholder: 'Dashboard panels:\n1. Current SLO compliance (30-day rolling): ...\n2. Error budget remaining (%): ...\n3. Burn rate (1h / 6h): ...\n4. SLI trend (7d): ...\n\nStakeholder communication: ...' },
      ],
      time_limit_seconds: 600,
    },
    {
      title: 'Alert Triage — Noisy Alert Investigation',
      scenario: `You are the on-call SRE. At 2:17 AM you receive 23 simultaneous PagerDuty alerts across 8 services. Your Grafana is flooded with red panels. You need to triage and determine the blast radius, find the root cause, and silence noise while working the incident.\n\nAlerts fired (all within 60 seconds):\n- api-gateway: HTTP 5xx rate 42%\n- payment-service: DB connection refused\n- user-service: DB connection refused\n- order-service: DB connection refused\n- checkout-service: DB connection refused\n- analytics-service: DB connection refused\n- postgres-primary: connection_count 198/200\n- redis-primary: HEALTH_OK (Redis is fine)\n\nYour monitoring stack: Prometheus, Grafana Alerting, PagerDuty`,
      difficulty: 'hard',
      sub_questions: [
        { id: 'datasource', prompt: 'Within the first 2 minutes, which alert do you investigate first and why? What PromQL query would you run immediately to confirm your hypothesis? What does the dependency graph tell you about the blast radius?', type: 'datasource', placeholder: 'First alert I investigate: postgres-primary connection_count\nWhy: all DB connection refused alerts from 5 different services point to a common cause...\n\nImmediate PromQL: pg_stat_database_numbackends / pg_settings_max_connections * 100\n\nBlast radius: ...' },
        { id: 'alert_rule', prompt: 'This alert storm was caused by a single root cause (DB connection pool exhausted). How would you redesign your alerting rules to prevent alert storms? Write an inhibition rule that would have suppressed the 5 downstream "DB connection refused" alerts when postgres-primary is the root cause.', type: 'alert_rule', placeholder: 'Inhibition rule:\n- Source alert: PostgresPrimaryDown or PostgresConnectionsExhausted\n- Target alerts: *ServiceDBConnectionRefused for all services\n- Match labels: cluster, environment\n\nResult: only 1 alert fires instead of 6...' },
        { id: 'contact_point', prompt: 'While working the incident, you need to silence the 5 downstream service alerts so they stop paging the on-call team while you work on the root cause. How do you create a targeted silence in Grafana Alerting without silencing future legitimate alerts? Write the silence matchers.', type: 'contact_point', placeholder: 'Silence matchers:\n- alertname =~ ".*DBConnectionRefused"\n- service =~ "payment-service|user-service|order-service|checkout-service|analytics-service"\n- NOT matcher: alertname = "PostgresPrimaryConnectionsExhausted"\n\nDuration: 90 minutes\nComment: Working root cause — DB pool exhaustion' },
        { id: 'notification_policy', prompt: 'Post-incident: what monitoring improvements would prevent this from happening again? Propose 2 new alert rules and 1 Grafana dashboard change that give you earlier warning before the connection pool reaches 100%.', type: 'notification_policy', placeholder: 'New alerts:\n1. PostgresConnectionPoolWarning: connections > 70% → warning (gives 15-30min buffer)\n2. PostgresConnectionPoolCritical: connections > 90% + rate increasing → critical\n\nDashboard change: Add connection pool gauge with warning/critical bands...' },
      ],
      time_limit_seconds: 600,
    },
  ]

  try {
    let inserted = 0
    for (const seed of seeds) {
      // Skip if a question with same title already exists
      const existing = await pool.query(`SELECT id FROM monitoring_questions WHERE title = $1`, [seed.title])
      if (existing.rows.length > 0) continue
      await pool.query(
        `INSERT INTO monitoring_questions (title, scenario, difficulty, sub_questions, time_limit_seconds) VALUES ($1,$2,$3,$4,$5)`,
        [seed.title, seed.scenario, seed.difficulty, JSON.stringify(seed.sub_questions), seed.time_limit_seconds]
      )
      inserted++
    }
    res.json({ ok: true, inserted, skipped: seeds.length - inserted })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// ---------------------------------------------------------------------------
// POST /warroom/respond — Claude-powered NPC response for War Room calls
// ---------------------------------------------------------------------------
export const warroomRouter = Router()
warroomRouter.post('/respond', async (req: Request, res: Response) => {
  try {
    const {
      scenario_name,
      services_down,
      services_degraded,
      conversation,
      next_speaker,
      exchange_index,
    } = req.body as {
      scenario_name: string
      services_down: string[]
      services_degraded: string[]
      conversation: Array<{ speaker: string; text: string }>
      next_speaker: 'alex' | 'sarah'
      exchange_index: number
    }

    const conversationText = conversation
      .map(e => {
        const name =
          e.speaker === 'alex' ? 'Alex Chen (EM)' :
          e.speaker === 'sarah' ? 'Sarah O. (TL)' :
          'SRE On-Call'
        return `${name}: ${e.text}`
      })
      .join('\n')

    const incidentContext = [
      services_down.length > 0 ? `Services DOWN: ${services_down.join(', ')}` : '',
      services_degraded.length > 0 ? `Services DEGRADED: ${services_degraded.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    const isFirstExchange = exchange_index === 0

    const alexPersona = isFirstExchange
      ? `You are Alex Chen, Engineering Manager. This is your opening statement joining the war room. Ask for a quick status update — what's happening, what's the blast radius, and are customers affected? Be direct. 2 sentences max.`
      : `You are Alex Chen, Engineering Manager. Based on what the SRE just said, ask focused executive-level follow-up questions: business impact, customer count affected, ETA to resolution, whether VP escalation is needed. Be empathetic but decisive. 2-3 sentences.`

    const sarahPersona = isFirstExchange
      ? `You are Sarah O., Team Lead. Based on the SRE's first status update, probe deeper on the technical investigation: what data have they looked at, what's their hypothesis, what have they already ruled out? Be collaborative and technical. 2-3 sentences.`
      : `You are Sarah O., Team Lead. Based on the full conversation, give a closing statement: acknowledge the SRE's plan, confirm the team will stay on standby, set a next check-in expectation, and be encouraging. 2 sentences.`

    const persona = next_speaker === 'alex' ? alexPersona : sarahPersona

    const prompt = `You are in a live war room call during a production incident at a Nigerian fintech company.

INCIDENT: ${scenario_name || 'Production Incident'}
${incidentContext}

CONVERSATION SO FAR:
${conversationText || '(call just started)'}

${persona}

Rules:
- Stay fully in character
- Be realistic and professional, like an actual engineering leader
- Do NOT start with "I understand" or "Thank you" or any filler acknowledgement
- Do NOT repeat back what was said to you
- Get straight to your question or statement
- Keep it conversational, not scripted`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const text =
      msg.content[0].type === 'text'
        ? msg.content[0].text.trim()
        : next_speaker === 'alex'
        ? "What's the current status and customer impact?"
        : 'Walk me through what you\'ve investigated so far.'

    res.json({ text })
  } catch (err) {
    console.error('warroom/respond error:', err)
    // Graceful fallback so the call doesn't die on API error
    const { next_speaker } = req.body as { next_speaker: string }
    res.json({
      text:
        next_speaker === 'alex'
          ? "Quick status — what's the blast radius and do we have customer impact?"
          : "What does the data show so far? Walk me through your investigation.",
    })
  }
})
