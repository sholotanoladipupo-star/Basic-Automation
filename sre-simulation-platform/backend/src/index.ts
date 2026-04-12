import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import { handleConnection } from './orchestrator'
import { initDb } from './db/init'
import { pool } from './db/client'
import { sqlRouter, monitoringRouter, warroomRouter } from './routes/modules'
import { cognitiveRouter } from './routes/cognitive'
import { postmortemRouter } from './routes/postmortem'
import { automationRouter } from './routes/automation'
import { runSeed } from './db/seed-questions'

const app = express()

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : null

app.use(cors({
  origin: allowedOrigins
    ? (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true)
        else cb(new Error('Not allowed by CORS'))
      }
    : '*',
  credentials: !!allowedOrigins
}))
app.use(express.json())

const ADMIN_KEY = process.env.ADMIN_KEY || 'sre-admin-2024'

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

app.use('/sql', sqlRouter)
app.use('/monitoring', monitoringRouter)
app.use('/cognitive', cognitiveRouter)
app.use('/postmortem', postmortemRouter)
app.use('/automation', automationRouter)
app.use('/warroom', warroomRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/sessions', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, candidate_name, scenario_id, scenario_name, started_at, ended_at, overall_score, status FROM sessions ORDER BY started_at DESC LIMIT 50'
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Admin: list all assignments
app.get('/admin/assignments', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, candidate_name, scenario_id, module_type, question_id, created_at, used_at, status FROM session_assignments ORDER BY created_at DESC LIMIT 100'
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Admin: create assignment
app.post('/admin/assignments', requireAdmin, async (req, res) => {
  const { candidate_name, scenario_id, module_type, question_id, is_practice, time_limit_minutes, pass_threshold } = req.body as Record<string, string | undefined>
  if (!candidate_name) { res.status(400).json({ error: 'candidate_name required' }); return }
  const mt = module_type ?? 'incident'
  if (mt !== 'incident' && mt !== 'cognitive' && !question_id) {
    res.status(400).json({ error: 'question_id required for sql/monitoring/postmortem/automation modules' }); return
  }
  try {
    const result = await pool.query(
      'INSERT INTO session_assignments (candidate_name, scenario_id, module_type, question_id, is_practice, time_limit_minutes, pass_threshold) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [candidate_name.trim(), scenario_id ?? 'cache-db-cascade', mt, question_id ?? null, is_practice === 'true', time_limit_minutes ? Number(time_limit_minutes) : null, pass_threshold ? Number(pass_threshold) : 70]
    )
    res.json(result.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin: delete assignment
app.delete('/admin/assignments/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM session_assignments WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Admin: reset assignment back to pending
app.patch('/admin/assignments/:id/reset', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE session_assignments SET status = 'pending', used_at = NULL WHERE id = $1 RETURNING *`,
      [req.params.id]
    )
    if (!r.rows[0]) { res.status(404).json({ error: 'Not found' }); return }
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin: full results dashboard — sessions + scores
app.get('/admin/results', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id, s.candidate_name, s.scenario_id, s.scenario_name,
        s.started_at, s.ended_at, s.overall_score, s.status,
        s.module_type,
        sc.postmortem,
        ROUND(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60)::int AS duration_minutes
      FROM sessions s
      LEFT JOIN scorecards sc ON sc.session_id = s.id
      WHERE s.status = 'completed' OR s.ended_at IS NOT NULL
      ORDER BY s.started_at DESC
      LIMIT 200
    `)
    // Aggregate stats
    const rows = result.rows
    const scores = rows.filter(r => r.overall_score != null).map(r => Number(r.overall_score))
    const avg  = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    const p50  = scores.length ? scores.sort((a, b) => a - b)[Math.floor(scores.length * 0.5)] : null
    const pass = scores.filter(s => s >= 70).length
    res.json({ sessions: rows, stats: { total: rows.length, avg_score: avg, p50_score: p50, pass_count: pass, fail_count: scores.length - pass } })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Public percentile rank (candidate debrief — no sensitive data exposed)
app.get('/percentile/:score', async (req, res) => {
  try {
    const score = Number(req.params.score)
    const result = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN overall_score < $1 THEN 1 END) as below
      FROM sessions WHERE status = 'completed' AND overall_score IS NOT NULL
    `, [score])
    const { total, below } = result.rows[0]
    const pct = Number(total) > 1 ? Math.round((Number(below) / Number(total)) * 100) : null
    res.json({ percentile: pct, total: Number(total) })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin: percentile rank for a given score
app.get('/admin/percentile/:score', requireAdmin, async (req, res) => {
  try {
    const score = Number(req.params.score)
    const result = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN overall_score < $1 THEN 1 END) as below
      FROM sessions WHERE status = 'completed' AND overall_score IS NOT NULL
    `, [score])
    const { total, below } = result.rows[0]
    const pct = total > 1 ? Math.round((Number(below) / Number(total)) * 100) : null
    res.json({ percentile: pct, total: Number(total) })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin: session event log (command replay)
app.get('/admin/sessions/:id/events', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT event_type, payload, ts AS created_at FROM event_logs WHERE session_id = $1 ORDER BY ts ASC`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Post-session feedback (candidate-submitted, no auth needed)
app.post('/sessions/:id/feedback', async (req, res) => {
  const { rating, comment } = req.body as { rating?: number; comment?: string }
  if (!rating || rating < 1 || rating > 5) { res.status(400).json({ error: 'rating 1-5 required' }); return }
  try {
    await pool.query(
      `INSERT INTO session_feedback (session_id, rating, comment) VALUES ($1, $2, $3)`,
      [req.params.id, rating, comment ?? '']
    )
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin: view all feedback
app.get('/admin/feedback', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT f.id, f.rating, f.comment, f.created_at, s.candidate_name, s.module_type, s.scenario_name
      FROM session_feedback f JOIN sessions s ON s.id = f.session_id
      ORDER BY f.created_at DESC LIMIT 200
    `)
    const rows = r.rows
    const avg = rows.length ? (rows.reduce((a, b) => a + Number(b.rating), 0) / rows.length).toFixed(1) : null
    res.json({ feedback: rows, avg_rating: avg })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Hint request during incident simulation (deducts 5 pts from final score)
app.post('/sessions/:id/hint', async (req, res) => {
  try {
    const sr = await pool.query(`SELECT hints_used FROM sessions WHERE id = $1`, [req.params.id])
    if (!sr.rows[0]) { res.status(404).json({ error: 'Session not found' }); return }
    const used = Number(sr.rows[0].hints_used)
    if (used >= 3) { res.status(400).json({ error: 'Maximum 3 hints per session' }); return }
    await pool.query(`UPDATE sessions SET hints_used = hints_used + 1 WHERE id = $1`, [req.params.id])
    res.json({ hints_used: used + 1, hints_remaining: 2 - used, penalty_per_hint: 5 })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin: seed questions (one-time setup)
app.post('/admin/seed-questions', requireAdmin, async (_req, res) => {
  try {
    await runSeed()
    res.json({ ok: true, message: 'Questions seeded successfully' })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.get('/sessions/:id/scorecard', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM scorecards WHERE session_id = $1',
      [req.params.id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Scorecard not found' })
      return
    }
    const raw = result.rows[0]
    const dims = raw.dimensions ?? {}
    const getScore = (...keys: string[]) => {
      for (const k of keys) {
        if (dims[k]?.score != null) return dims[k].score
      }
      return 0
    }
    const getNotes = (...keys: string[]) => {
      for (const k of keys) {
        if (dims[k]?.notes) return dims[k].notes
      }
      return ''
    }

    // Fetch session for duration
    const sessionRow = await pool.query(
      'SELECT started_at, ended_at FROM sessions WHERE id = $1',
      [req.params.id]
    )
    let duration_minutes = 0
    if (sessionRow.rows[0]?.ended_at && sessionRow.rows[0]?.started_at) {
      const ms = new Date(sessionRow.rows[0].ended_at).getTime() - new Date(sessionRow.rows[0].started_at).getTime()
      duration_minutes = Math.round(ms / 60000)
    }

    const overallScore = raw.overall_score ?? 0
    const scorecard: Record<string, unknown> = {
      ...raw,
      total_score: overallScore,
      passing_score: 70,
      passed: overallScore >= 70,
      duration_minutes,
      incident_coordination: getScore('coordination', 'incident_coordination'),
      incident_resolution: getScore('resolution', 'incident_resolution'),
      technical_depth: getScore('technical_depth'),
      observability_usage: getScore('observability', 'observability_usage'),
      coordination_notes: getNotes('coordination', 'incident_coordination'),
      resolution_notes: getNotes('resolution', 'incident_resolution'),
      technical_notes: getNotes('technical_depth'),
      observability_notes: getNotes('observability', 'observability_usage'),
      highlights: Array.isArray(raw.timeline_highlights) ? raw.timeline_highlights : [],
      improvements: [],
      postmortem_summary: raw.postmortem ?? '',
    }

    // Enrich with candidate_query + question details from sql_attempts if this is a SQL session
    const sqlAttempt = await pool.query(
      'SELECT candidate_query, score, rating, question_id FROM sql_attempts WHERE session_id = $1 ORDER BY submitted_at DESC LIMIT 1',
      [req.params.id]
    )
    if (sqlAttempt.rows[0]) {
      scorecard.candidate_query = sqlAttempt.rows[0].candidate_query
      scorecard.sql_score = sqlAttempt.rows[0].score
      scorecard.sql_rating = sqlAttempt.rows[0].rating
      scorecard.module_type = 'sql'
      // Extract SQL-specific dimension scores for detailed breakdown
      const rawDims = raw.dimensions ?? {}
      scorecard.syntax_accuracy = rawDims.syntax_accuracy?.score ?? 0
      scorecard.query_correctness = rawDims.query_correctness?.score ?? 0
      scorecard.result_completeness = rawDims.result_completeness?.score ?? 0
      // Fetch the SQL question details for side-by-side view
      if (sqlAttempt.rows[0].question_id) {
        const sqlQ = await pool.query(
          'SELECT title, description, schema_hint, starter_query, expected_output, solution_query FROM sql_questions WHERE id = $1',
          [sqlAttempt.rows[0].question_id]
        )
        if (sqlQ.rows[0]) {
          scorecard.sql_question = sqlQ.rows[0]
        }
      }
    } else {
      scorecard.module_type = 'incident'
    }
    // Enrich with monitoring answers if this is a monitoring session
    const monAttempt = await pool.query(
      'SELECT answers FROM monitoring_attempts WHERE session_id = $1 ORDER BY submitted_at DESC LIMIT 1',
      [req.params.id]
    )
    if (monAttempt.rows[0]) {
      scorecard.monitoring_answers = monAttempt.rows[0].answers
    }
    res.json(scorecard)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ── Candidate event logging (tab-switch / copy-paste audit) ──────────────────
app.post('/sessions/:id/events', async (req, res) => {
  const { event_type, payload } = req.body as { event_type?: string; payload?: object }
  if (!event_type) { res.status(400).json({ error: 'event_type required' }); return }
  try {
    const result = await pool.query(
      `INSERT INTO event_logs (id, session_id, sim_ts, event_type, payload)
       VALUES (gen_random_uuid(), $1, NOW()::text, $2, $3)
       RETURNING id`,
      [req.params.id, event_type, JSON.stringify(payload ?? {})]
    )
    res.json({ ok: true, id: result.rows[0].id })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// ── Admin: pause / resume session ────────────────────────────────────────────
app.patch('/admin/sessions/:id/pause', requireAdmin, async (req, res) => {
  const { paused } = req.body as { paused?: boolean }
  if (typeof paused !== 'boolean') { res.status(400).json({ error: 'paused (boolean) required' }); return }
  try {
    const r = await pool.query(
      `UPDATE sessions SET paused = $1 WHERE id = $2 RETURNING id`,
      [paused, req.params.id]
    )
    if (!r.rows[0]) { res.status(404).json({ error: 'Session not found' }); return }
    res.json({ ok: true, paused })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// ── Admin: assessor annotations ───────────────────────────────────────────────
app.post('/admin/sessions/:id/annotations', requireAdmin, async (req, res) => {
  const { text } = req.body as { text?: string }
  if (!text || !text.trim()) { res.status(400).json({ error: 'text required' }); return }
  try {
    const r = await pool.query(
      `INSERT INTO session_annotations (session_id, text) VALUES ($1, $2)
       RETURNING id, session_id, text, created_at`,
      [req.params.id, text.trim()]
    )
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

app.get('/admin/sessions/:id/annotations', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, session_id, text, created_at FROM session_annotations
       WHERE session_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    )
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// ── Public annotations (candidate-facing, shown in candidate portal debrief) ──
app.get('/sessions/:id/annotations-public', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, text, created_at FROM session_annotations WHERE session_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    )
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// ── Comparative benchmark (candidate-facing, no auth) ─────────────────────────
app.get('/sessions/:id/benchmark', async (req, res) => {
  try {
    const sessionRes = await pool.query(
      `SELECT overall_score, scenario_name, status FROM sessions WHERE id = $1`,
      [req.params.id]
    )
    const session = sessionRes.rows[0]
    if (!session) { res.status(404).json({ error: 'Session not found' }); return }
    if (session.status !== 'completed' || session.overall_score == null) {
      res.status(404).json({ error: 'Session not completed' }); return
    }
    const candidateScore = Number(session.overall_score)
    const statsRes = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN overall_score < $1 THEN 1 END) AS ranked_below
       FROM sessions
       WHERE scenario_name = $2 AND status = 'completed' AND overall_score IS NOT NULL`,
      [candidateScore, session.scenario_name]
    )
    const { total, ranked_below } = statsRes.rows[0]
    const totalNum = Number(total)
    const rankNum = totalNum - Number(ranked_below)   // 1-based rank (1 = best)
    const percentile = totalNum > 1 ? Math.round((Number(ranked_below) / totalNum) * 100) : null
    const avgRes = await pool.query(
      `SELECT ROUND(AVG(overall_score))::int AS avg_score
       FROM sessions
       WHERE scenario_name = $1 AND status = 'completed' AND overall_score IS NOT NULL`,
      [session.scenario_name]
    )
    res.json({
      scenario_name: session.scenario_name,
      total_attempts: totalNum,
      rank: rankNum,
      percentile,
      avg_score: avgRes.rows[0]?.avg_score ?? null,
      candidate_score: candidateScore,
    })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

const server = createServer(app)

const wss = new WebSocketServer({ server })
wss.on('connection', handleConnection)

const PORT = Number(process.env.PORT) || 3001

async function main(): Promise<void> {
  await initDb()
  server.listen(PORT, () => {
    console.log(`SRE Simulation backend running on port ${PORT}`)
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`)
    console.log(`Health check: http://localhost:${PORT}/health`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
