import { Router, Request, Response, NextFunction } from 'express'
import { pool } from '../db/client'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ADMIN_KEY = process.env.ADMIN_KEY || 'sre-admin-2024'
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) { res.status(401).json({ error: 'Unauthorized' }); return }
  next()
}

function sqlRating(score: number): string {
  if (score >= 80) return 'Good'
  if (score >= 50) return 'Managing'
  return 'Learning'
}

export const automationRouter = Router()

/** Get question (candidate view) */
automationRouter.get('/questions/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, description, task, difficulty, language, starter_code, evaluation_criteria, time_limit_seconds
       FROM automation_questions WHERE id = $1`,
      [req.params.id]
    )
    if (!r.rows[0]) { res.status(404).json({ error: 'Question not found' }); return }
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

/** Submit code for AI evaluation */
automationRouter.post('/submit', async (req, res) => {
  const { session_id, question_id, code } = req.body as {
    session_id?: string
    question_id?: string
    code?: string
  }
  if (!session_id || !question_id || code === undefined) {
    res.status(400).json({ error: 'session_id, question_id, code required' }); return
  }
  try {
    const qr = await pool.query(
      `SELECT title, task, language, evaluation_criteria FROM automation_questions WHERE id = $1`,
      [question_id]
    )
    if (!qr.rows[0]) { res.status(404).json({ error: 'Question not found' }); return }
    const q = qr.rows[0] as {
      title: string
      task: string
      language: string
      evaluation_criteria: { label: string; description: string }[]
    }

    const criteriaText = (q.evaluation_criteria ?? [])
      .map((c, i) => `${i + 1}. ${c.label}: ${c.description}`)
      .join('\n')

    const prompt = `You are an expert SRE/DevOps engineer evaluating an automation script written by a candidate.

Task: ${q.title}
Language: ${q.language}
Requirements:
${q.task}

Evaluation criteria:
${criteriaText || '- Correctness\n- Best practices\n- Error handling\n- Readability'}

Candidate's code:
\`\`\`${q.language}
${code || '(no code submitted)'}
\`\`\`

Score the candidate's solution. Do NOT execute the code — evaluate based on logic, correctness, and quality.

Respond with valid JSON only:
{
  "overall": <0-100>,
  "feedback": "<2-3 sentence assessment>",
  "criterion_scores": [
    { "label": "<criterion name>", "score": <0-100>, "comment": "<brief specific comment>" }
  ]
}`

    let score = 35
    let feedback = 'Solution submitted. Review the requirements and ensure error handling is included.'
    let criterionScores: { label: string; score: number; comment: string }[] = []

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          overall: number
          feedback: string
          criterion_scores: { label: string; score: number; comment: string }[]
        }
        score = Math.min(100, Math.max(0, parsed.overall ?? 35))
        feedback = parsed.feedback ?? feedback
        criterionScores = parsed.criterion_scores ?? []
      }
    } catch { /* use fallbacks */ }

    const rating = sqlRating(score)

    await pool.query(
      `INSERT INTO automation_attempts (session_id, question_id, candidate_code, score, rating, feedback, criterion_scores)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [session_id, question_id, code, score, rating, feedback, JSON.stringify(criterionScores)]
    )

    await pool.query(
      `UPDATE sessions SET overall_score = $1, ended_at = NOW(), status = 'completed' WHERE id = $2`,
      [score, session_id]
    )

    await pool.query(
      `INSERT INTO scorecards (session_id, overall_score, dimensions, timeline_highlights, postmortem)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        session_id, score,
        JSON.stringify({ automation: { score, max: 100 } }),
        JSON.stringify(['Automation script submitted']),
        feedback,
      ]
    )

    res.json({ score, rating, feedback, criterion_scores: criterionScores })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin CRUD
automationRouter.get('/admin/questions', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT id, title, difficulty, language, time_limit_seconds, created_at FROM automation_questions ORDER BY created_at DESC`)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

automationRouter.post('/admin/questions', requireAdmin, async (req, res) => {
  const { title, description, task, difficulty, language, starter_code, evaluation_criteria, time_limit_seconds } = req.body as Record<string, unknown>
  try {
    const r = await pool.query(
      `INSERT INTO automation_questions (title, description, task, difficulty, language, starter_code, evaluation_criteria, time_limit_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, description, task, difficulty ?? 'medium', language ?? 'bash', starter_code ?? '', JSON.stringify(evaluation_criteria ?? []), time_limit_seconds ?? 900]
    )
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

automationRouter.delete('/admin/questions/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM automation_questions WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})
