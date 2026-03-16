/**
 * REST routes for SQL and Monitoring modules.
 * Mounted at /sql and /monitoring in index.ts.
 * Admin question management also lives here (protected by x-admin-key).
 */
import { Router, Request, Response, NextFunction } from 'express'
import { pool } from '../db/client'
import { executeQuery, scoreQueryResult, sqlRating } from '../sql-executor'

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
    const qr = await pool.query(`SELECT expected_output FROM sql_questions WHERE id = $1`, [question_id])
    if (!qr.rows[0]) { res.status(404).json({ error: 'Question not found' }); return }

    const expected = qr.rows[0].expected_output as { columns: string[]; rows: Record<string, unknown>[] }
    const result = await executeQuery(query)
    const score = scoreQueryResult(result, expected)
    const rating = sqlRating(score)

    await pool.query(
      `INSERT INTO sql_attempts (session_id, question_id, candidate_query, result, score, rating) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [session_id, question_id, query, JSON.stringify(result), score, rating]
    )

    // Update session score
    await pool.query(`UPDATE sessions SET overall_score = $1, ended_at = NOW(), status = 'completed' WHERE id = $2`, [score, session_id])

    // Build scorecard
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
      postmortem_summary: score >= 80 ? 'Strong SQL skills demonstrated.' : score >= 50 ? 'Core SQL knowledge present. Practice JOINs and aggregations.' : 'SQL fundamentals need more work. Review JOIN syntax and WHERE conditions.'
    }

    await pool.query(
      `INSERT INTO scorecards (session_id, overall_score, dimensions, timeline_highlights, postmortem)
       VALUES ($1,$2,$3,$4,$5)`,
      [session_id, score, JSON.stringify(scorecard.dimensions), JSON.stringify(scorecard.timeline_highlights), scorecard.postmortem_summary]
    )

    res.json({ score, rating, scorecard })
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
  const { title, description, difficulty, question_type, starter_query, expected_output, schema_hint, hint, time_limit_seconds } = req.body as Record<string, unknown>
  try {
    const r = await pool.query(
      `INSERT INTO sql_questions (title, description, difficulty, question_type, starter_query, expected_output, schema_hint, hint, time_limit_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, description, difficulty ?? 'medium', question_type ?? 'write', starter_query ?? '', JSON.stringify(expected_output ?? {}), schema_hint ?? '', hint ?? '', time_limit_seconds ?? 300]
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

    const scorecard = {
      session_id, overall_score: overallScore, module_type: 'monitoring', rating,
      dimensions: Object.fromEntries(scored.map((s, i) => [`question_${i + 1}`, { score: s.score, max: 100 }])),
      timeline_highlights: overallScore >= 80 ? ['Correct PromQL expressions', 'Proper alerting strategy used'] : overallScore >= 50 ? ['Partial answers provided', 'Core concepts present'] : ['Needs more work'],
      postmortem_summary: overallScore >= 80 ? 'Strong observability skills.' : overallScore >= 50 ? 'Good fundamentals. Practice PromQL syntax and alert design patterns.' : 'Review PromQL basics, SLOs, and alerting principles.',
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
