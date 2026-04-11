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

    const fallbackPostmortem = overallScore >= 80 ? 'Strong observability and alerting design skills.' : overallScore >= 50 ? 'Good fundamentals. Focus on alert hierarchy, inhibition rules, and SLO error budget policies.' : 'Review SLO design principles, alert fatigue patterns, and observability layering (metrics → logs → traces).'
    const postmortem = (await aiPostmortem(aiPrompt)) || fallbackPostmortem

    const scorecard = {
      session_id, overall_score: overallScore, module_type: 'monitoring', rating,
      dimensions: Object.fromEntries(scored.map((s, i) => [`question_${i + 1}`, { score: s.score, max: 100 }])),
      timeline_highlights: overallScore >= 80 ? ['Strong alerting strategy', 'Good SLO/error budget understanding'] : overallScore >= 50 ? ['Core concepts present', 'Some gaps in alerting design'] : ['Needs more work on observability fundamentals'],
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
      scenario: `Your payment-service has just experienced a 45-minute P1 outage. Error rates hit 85%, p99 latency exceeded 8s, and 1,200 transactions failed. Post-incident, engineering leadership has asked you to design a comprehensive monitoring and alerting strategy to detect and respond to similar issues in under 5 minutes next time.\n\nSystem context:\n- payment-service (Node.js, 6 pods)\n- PostgreSQL primary + 1 read replica\n- Redis cache (session/rate-limit data)\n- Kafka topic: payment-events\n- Upstream: Stripe API, bank gateway\n- Stack: Prometheus + Grafana, logs in Cloud Logging`,
      difficulty: 'hard',
      sub_questions: [
        {
          id: 'metrics', type: 'metrics',
          prompt: 'List the 5 most critical metrics you would monitor for the payment service. For each metric describe: (1) what it measures, (2) the alert threshold that would trigger a warning and a critical alert, and (3) why this metric matters for payment reliability. Do not write code — answer conceptually.',
          placeholder: 'Metric 1: HTTP error rate\nWhat it measures: percentage of requests returning 5xx status codes\nWarning threshold: > 5% for 2 minutes\nCritical threshold: > 15% for 1 minute\nWhy it matters: directly indicates failed payment attempts affecting customers\n\nMetric 2: ...',
          required_keywords: ['error rate', 'latency', 'threshold', 'warning', 'critical'],
          bonus_keywords: ['p99', 'connection', 'pool', 'db', 'stripe', 'kafka'],
          reference_answer: 'Key metrics: HTTP 5xx error rate (alert >5% warn, >15% critical), p99 latency (alert >2s warn, >5s critical), DB connection pool utilisation (alert >75% warn, >90% critical), Kafka consumer lag (alert >10k messages), Stripe API error rate (alert >2%). Each metric provides an early signal at a different layer of the payment stack.',
        },
        {
          id: 'alerting', type: 'alerting',
          prompt: 'Design 3 alerts for the payment service. For each alert specify: (1) the condition that triggers it, (2) how long the condition must persist before the alert fires (for-duration), (3) severity level (P1/P2/P3), and (4) who gets notified and how. Focus on the design — no code required.',
          placeholder: 'Alert 1: PaymentHighErrorRate\nCondition: error rate exceeds 15% on payment-service\nFor duration: 1 minute (fast — revenue impact)\nSeverity: P1\nNotify: On-call engineer via PagerDuty immediately; #payments-incidents Slack\n\nAlert 2: ...',
          required_keywords: ['p1', 'severity', 'pagerduty', 'escalat', 'duration'],
          bonus_keywords: ['p2', 'slack', 'for duration', 'acknowledge', 'on-call'],
          reference_answer: 'Three well-designed alerts: (1) High error rate >15% for 1m → P1 → PagerDuty + Slack. (2) DB connection pool >85% for 3m → P2 → Slack + ticket. (3) p99 latency >3s for 5m → P2 → Slack. For-duration prevents flapping. P1 pages on-call immediately; P2 creates a ticket/Slack notification to avoid 3AM wakeups for non-critical issues.',
        },
        {
          id: 'alert_fatigue', type: 'alert_fatigue',
          prompt: 'When the PostgreSQL primary went down, 5 services all fired "DB connection refused" alerts simultaneously — creating 23 pages in 60 seconds. How would you redesign the alerting to produce 1 page instead of 23? Explain: (1) what an inhibition rule is and how you would use it here, (2) how you would group alerts, and (3) your repeat-interval strategy.',
          placeholder: 'Inhibition rule: when postgres-primary fires a "connections exhausted" or "down" alert, suppress all downstream "DB connection refused" alerts from other services\nThis means only 1 alert pages on-call instead of 5+\n\nGrouping: group all payment-service alerts into a single notification per evaluation cycle...\n\nRepeat interval: re-notify every 4h if the incident is unresolved, not every 15 minutes...',
          required_keywords: ['inhibit', 'suppress', 'group', 'root cause', 'downstream'],
          bonus_keywords: ['repeat interval', 'silence', 'noise', 'matchers', 'label'],
          reference_answer: 'Inhibition rule: when postgres-primary alert is firing, inhibit all "DBConnectionRefused" alerts from other services (match on cluster/environment labels). Grouping: group by [service, severity] with group_wait=30s to batch simultaneous alerts. Repeat interval: 4h so resolved issues stop paging. Result: 1 alert for the root cause instead of 23 symptom alerts.',
        },
        {
          id: 'investigation', type: 'investigation',
          prompt: 'Walk through your first 5 minutes of incident response. Which alert do you open first and why? How do you determine the blast radius? What is the first action you take to start mitigating? Describe your decision-making process step by step.',
          placeholder: 'Minute 0: PagerDuty fires — I open the Grafana alerting dashboard\nFirst alert I look at: postgres-primary connection pool — because 5 services showing "DB connection refused" all share the same DB, so the common cause is almost certainly there\n\nMinute 1: Check DB connection pool panel — confirm it is at 198/200 connections\nBlast radius: payment, user, order, checkout, analytics services all affected...\n\nMinute 2: Declare P1, notify EM in Slack, start incident channel...',
          required_keywords: ['blast radius', 'root cause', 'first', 'triage', 'escalat'],
          bonus_keywords: ['dependency', 'correlation', 'timeline', 'postmortem', 'slack'],
          reference_answer: 'Triage order: check the alert that best explains the others — postgres-primary connection pool. Confirm with a DB metrics panel. Blast radius = all services with DB dependency. Immediately declare P1, open incident Slack channel, notify EM. First mitigation: identify runaway queries consuming connections (kill long-running queries, or restart the pod that holds connections). Do not restart the DB — that risks data loss.',
        },
      ],
      time_limit_seconds: 900,
    },
    {
      title: 'SLO Design — Checkout Service Reliability',
      scenario: `You are the SRE responsible for the checkout-service, which handles the final step of the purchase funnel. The business requires 99.9% monthly availability. Currently you have no SLOs defined and no error budget policy.\n\nSystem context:\n- checkout-service processes ~2,000 requests/minute at peak\n- 3 pods in production, 1 in staging\n- Dependencies: payment-service, order-service, inventory-service\n- Current measured uptime: ~99.6% (manual checks)\n- No synthetic monitoring in place`,
      difficulty: 'medium',
      sub_questions: [
        {
          id: 'sli_slo', type: 'sli_slo',
          prompt: 'Define an SLI and SLO for the checkout service. (1) What exactly will you measure as your SLI? (2) What is your SLO target? (3) Why did you choose this metric over alternatives — latency vs. availability vs. error rate? (4) What does 99.9% availability mean in minutes of allowed downtime per month?',
          placeholder: 'SLI: Availability — proportion of checkout requests that complete successfully (HTTP 2xx) within an acceptable time window\n\nSLO target: 99.9% of requests succeed over a rolling 30-day window\n\nWhy availability over latency: for a checkout flow, a slow response is frustrating but a failed transaction loses a sale. Availability is the primary user-facing reliability signal.\n\n99.9% = 43.8 minutes of downtime allowed per month',
          required_keywords: ['sli', 'slo', 'availability', '99.9', 'measure'],
          bonus_keywords: ['error rate', 'latency', 'rolling', '43 minutes', 'window'],
          reference_answer: 'SLI: proportion of checkout requests returning 2xx within 3 seconds. SLO: 99.9% over 30-day rolling window = 43.8 min downtime/month. Availability chosen over latency because a failed checkout loses a transaction (direct revenue impact); a slow checkout is bad UX but recoverable. Latency SLO can be added as a secondary SLO.',
        },
        {
          id: 'error_budget', type: 'error_budget',
          prompt: 'Your checkout service has a 99.9% monthly SLO. Explain your error budget policy — what changes in team behaviour at 25%, 50%, 75%, and 100% error budget consumption? Who owns the decision to freeze deployments? What happens after 100% is consumed?',
          placeholder: 'Error budget = 0.1% of monthly requests allowed to fail = ~43.8 minutes of downtime equivalent\n\n0–25% consumed: normal operations, deploy freely\n25–50% consumed: EM gets a weekly report; start reviewing release risk\n50–75% consumed: increased PR scrutiny, staging validation required for all releases\n75–100% consumed: deployment freeze — only reliability fixes allowed; EM + CTO notified\n>100% consumed: mandatory P1 post-incident review, external audit of reliability backlog\n\nDecision to freeze: Engineering Manager in agreement with SRE lead',
          required_keywords: ['error budget', 'freeze', 'deploy', 'consumed', 'policy'],
          bonus_keywords: ['em', 'reliability', 'postmortem', 'review', 'stakeholder'],
          reference_answer: 'Error budget = 43.8 min/month. Policy: <50% consumed = normal; 50–75% = heightened release scrutiny; 75–100% = deployment freeze, reliability work only; >100% = mandatory post-incident review, executive escalation. Decision owner: EM + SRE lead jointly. The policy must be written down and agreed before an incident, not negotiated during one.',
        },
        {
          id: 'alerting', type: 'alerting',
          prompt: 'What is a burn-rate alert? Design a fast-burn and a slow-burn alert for your checkout SLO. Explain: (1) what each one detects, (2) when each one fires, and (3) why you need both. You do not need to write code.',
          placeholder: 'Burn rate = how fast you are consuming your error budget relative to normal\nA 1x burn rate uses exactly 100% of budget over the SLO window.\nA 14.4x burn rate consumes 1 hour of budget in 5 minutes — critically bad.\n\nFast-burn alert: detects rapid budget consumption\nCondition: burn rate > 14.4x over the last 1 hour\nSeverity: P1, page on-call immediately\nDetects: major outages where you will burn through all budget in < 2 hours\n\nSlow-burn alert: detects gradual leaks\nCondition: burn rate > 3x over the last 6 hours\nSeverity: P2, Slack notification\nDetects: subtle degradation that would exhaust budget over 5 days\n\nWhy both: fast-burn misses slow leaks; slow-burn is too late to catch sudden outages.',
          required_keywords: ['burn rate', 'fast', 'slow', 'budget', 'detect'],
          bonus_keywords: ['14.4', 'p1', 'p2', 'window', '6 hour', '1 hour'],
          reference_answer: 'Fast-burn: >14.4x burn rate over 1h → P1 page (detects outages that consume all budget in <2h). Slow-burn: >3x burn rate over 6h → P2 Slack (detects gradual degradation). Both needed because fast-burn has a short window (misses slow drift) and slow-burn reacts too slowly for sudden outages. Together they cover the full severity spectrum.',
        },
        {
          id: 'dashboard', type: 'dashboard',
          prompt: 'Design your SLO dashboard for the checkout service. List the 4 most important panels, what each one shows, and why each panel is important. Also describe how you communicate remaining error budget to non-technical stakeholders (e.g. product managers, executives).',
          placeholder: 'Panel 1: SLO Compliance (30-day rolling)\nShows: current SLO % vs 99.9% target line\nWhy: immediate "are we meeting our SLO?" answer\n\nPanel 2: Error Budget Remaining (%)\nShows: % of monthly error budget left, with colour bands (green/amber/red)\nWhy: at-a-glance health for release decisions\n\nPanel 3: Burn Rate (1h and 6h)\nShows: current burn rate on two windows\nWhy: early warning before budget is consumed\n\nPanel 4: SLI Trend (7-day)\nShows: daily error rate vs SLO target\nWhy: see patterns (weekends better? release days worse?)\n\nStakeholder communication: automated weekly Slack message with plain-English summary ("We used 12% of our monthly reliability budget this week")',
          required_keywords: ['slo', 'error budget', 'panel', 'stakeholder', 'communicate'],
          bonus_keywords: ['burn rate', 'trend', 'weekly', 'slack', 'executive'],
          reference_answer: '4 key panels: (1) 30-day SLO compliance gauge vs target, (2) error budget remaining % with red/amber/green bands, (3) dual burn-rate chart (1h + 6h windows), (4) SLI trend (7d) showing pattern over releases. Stakeholder comms: weekly automated Slack report in plain English — percentage budget used, what caused consumption, current health status. Executives do not read dashboards; they read summaries.',
        },
      ],
      time_limit_seconds: 720,
    },
    {
      title: 'Alert Triage — 23 Alerts at 2 AM',
      scenario: `You are the on-call SRE. At 2:17 AM you receive 23 simultaneous PagerDuty alerts across 8 services. Your Grafana is flooded with red panels. You need to triage and determine the blast radius, find the root cause, and silence noise while working the incident.\n\nAlerts fired (all within 60 seconds):\n- api-gateway: HTTP 5xx rate 42%\n- payment-service: DB connection refused\n- user-service: DB connection refused\n- order-service: DB connection refused\n- checkout-service: DB connection refused\n- analytics-service: DB connection refused\n- postgres-primary: connection_count 198/200\n- redis-primary: HEALTH_OK (Redis is fine)\n\nMonitoring stack: Prometheus, Grafana Alerting, PagerDuty`,
      difficulty: 'hard',
      sub_questions: [
        {
          id: 'investigation', type: 'investigation',
          prompt: 'You wake up to 23 PagerDuty alerts. Describe your triage methodology. Which alert do you look at first and why? How do you determine the root cause and blast radius within 2 minutes? What do you communicate and to whom?',
          placeholder: 'I open the alerts and look for the alert that best explains the others.\npostgres-primary: connection_count 198/200 is the root cause — 5 services all showing "DB connection refused" means they cannot connect to the same database.\n\nBlast radius: all services with a DB dependency are affected. Redis is healthy so cache-only paths are fine.\n\nWithin 1 minute: declare P1, open #incident channel, message EM that I am investigating a DB connection pool exhaustion.\n\nWithin 2 minutes: check which queries or connections are consuming the pool (look at DB slow query log, active connections)...',
          required_keywords: ['root cause', 'postgres', 'connection', 'blast radius', 'triage'],
          bonus_keywords: ['redis', 'dependency', 'explain', 'declare', 'p1'],
          reference_answer: 'Look at postgres-primary first — it is the only alert that explains all 5 downstream "DB connection refused" alerts. Blast radius = all services with DB dependency (payment, user, order, checkout, analytics). Redis healthy so any cache-only reads still work. Communicate: declare P1, open incident channel, notify EM, start timeline. Do not acknowledge and ignore downstream alerts — they are noise from one root cause.',
        },
        {
          id: 'alert_fatigue', type: 'alert_fatigue',
          prompt: '5 services are all showing "DB connection refused" because of one root cause. While you work the incident, how do you silence the downstream service alerts without accidentally silencing future legitimate alerts? What matchers would you use and what precautions do you take?',
          placeholder: 'I create a targeted Grafana silence:\n\nMatchers:\n- alertname matches ".*DBConnectionRefused" (regex)\n- service matches "payment-service|user-service|order-service|checkout-service|analytics-service"\n- environment = "production"\n\nExclusion: I do NOT silence "postgres-primary" alerts — that is the root cause I am actively working.\n\nDuration: 2 hours (enough to resolve, not so long it silences real future alerts)\nComment: "Working DB pool exhaustion — root cause is postgres-primary. Silence downstream noise."\n\nPrecaution: set an expiry time and add a comment so any SRE who picks this up understands why the silence exists.',
          required_keywords: ['silence', 'matchers', 'downstream', 'duration', 'root cause'],
          bonus_keywords: ['regex', 'label', 'comment', 'expiry', 'postgres'],
          reference_answer: 'Create a Grafana silence with matchers: alertname=~".*DBConnectionRefused" AND service=~"payment-service|user-service|..." for 90-120 minutes with a descriptive comment. Crucially: do NOT silence postgres-primary alerts. Precautions: (1) set expiry time, never indefinite; (2) always add a comment explaining why; (3) do not use broad matchers like service=~".*" which would silence future real alerts.',
        },
        {
          id: 'alerting', type: 'alerting',
          prompt: 'Post-incident: redesign the alerting so this scenario produces 1 alert instead of 23. Describe the alert hierarchy you would create using inhibition rules. What does the alerting flow look like after your redesign?',
          placeholder: 'Redesigned alert hierarchy:\n\n1. postgres-primary connection pool alert (root cause detector)\n   - Fires when: pool > 90% for 2 minutes\n   - Severity: P1\n   - This is the ONLY alert that pages on-call for DB issues\n\n2. Inhibition rule:\n   - When: "postgres-primary" alert is firing\n   - Suppress: any alert with label db_dependent = true across all services\n   - Result: downstream "DB connection refused" alerts are silenced automatically while the root cause is firing\n\n3. Service-level DB alerts remain configured but are INHIBITED by the root cause alert\n   They still appear in Grafana (so you can see them) but do not page\n\nResult: 1 PagerDuty notification instead of 23',
          required_keywords: ['inhibit', 'hierarchy', 'root cause', 'suppress', 'label'],
          bonus_keywords: ['label', 'match', 'source', 'target', '1 alert'],
          reference_answer: 'Inhibition rule: source=postgres-primary-alert firing → inhibit all alerts with label db_dependent=true. Each service alert gets the label db_dependent=true. Result: only postgres-primary pages. Service-level alerts remain visible in Grafana for context but do not generate notifications. This is alerting by causality — only the root cause should page; symptoms are informational.',
        },
        {
          id: 'metrics', type: 'metrics',
          prompt: 'What leading-indicator metrics would have given you early warning before the DB connection pool hit 100%? Describe 2 metrics that would have given you 15–30 minutes of advance warning — without generating false positives during normal operations.',
          placeholder: 'Leading indicator 1: DB connection pool utilisation at 70%\nWhy: at normal load we use ~40% of connections. Crossing 70% is unusual and gives ~15-30 min before hitting the limit during a traffic spike.\nThreshold: warn at 70%, critical at 85% (not 95% — that is too late).\nFalse positive risk: low if baseline is well understood; can refine with time-of-day awareness.\n\nLeading indicator 2: Rate of increase of active connections\nWhy: a sudden spike in connection acquisition rate (even if current pool % is OK) predicts exhaustion\nThis catches runaway connection leaks before they hit the ceiling.\nThreshold: warn if connections growing by >20 per minute consistently for 5 minutes',
          required_keywords: ['leading', 'warn', 'threshold', 'early', 'connection'],
          bonus_keywords: ['70%', 'rate', 'spike', 'baseline', 'false positive'],
          reference_answer: 'Leading indicators: (1) Pool utilisation at 70% — normal is ~40%, so 70% is an early warning with 15-30min buffer before exhaustion. Set warning at 70%, critical at 85%. (2) Connection acquisition rate — alert if new connections/min increases sharply (runaway leak detector). Both avoid false positives by alerting on deviation from baseline, not absolute thresholds alone.',
        },
      ],
      time_limit_seconds: 720,
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
