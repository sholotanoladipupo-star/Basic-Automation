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

export const postmortemRouter = Router()

/** Get question (candidate view — no scoring rubric) */
postmortemRouter.get('/questions/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, incident_summary, timeline, difficulty, time_limit_seconds FROM postmortem_questions WHERE id = $1`,
      [req.params.id]
    )
    if (!r.rows[0]) { res.status(404).json({ error: 'Question not found' }); return }
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

/** Submit postmortem sections for AI scoring */
postmortemRouter.post('/submit', async (req, res) => {
  const { session_id, question_id, sections } = req.body as {
    session_id?: string
    question_id?: string
    sections?: Record<string, string>
  }
  if (!session_id || !question_id || !sections) {
    res.status(400).json({ error: 'session_id, question_id, sections required' }); return
  }
  try {
    const qr = await pool.query(
      `SELECT title, incident_summary FROM postmortem_questions WHERE id = $1`,
      [question_id]
    )
    if (!qr.rows[0]) { res.status(404).json({ error: 'Question not found' }); return }
    const { title, incident_summary } = qr.rows[0] as { title: string; incident_summary: string }

    // Build scoring prompt
    const sectionText = Object.entries(sections)
      .map(([k, v]) => `### ${k}\n${v || '(no answer)'}`)
      .join('\n\n')

    const prompt = `You are an expert SRE hiring assessor evaluating a postmortem document written by a candidate.

Incident: ${title}
${incident_summary}

Candidate's postmortem document:
${sectionText}

Score each section from 0-100 and provide a single overall score (0-100). Evaluate on:
- summary (0-100): clarity of impact, detection, and resolution
- root_cause (0-100): depth of root cause analysis, identifying underlying vs. triggering causes
- timeline (0-100): completeness, proper timestamps, logical sequence
- action_items (0-100): specificity, ownership, prioritisation, preventive value
- lessons (0-100): reflection quality, systemic thinking, team learning

Respond with valid JSON only, in this format:
{
  "overall": <number>,
  "section_scores": { "summary": <n>, "root_cause": <n>, "timeline": <n>, "action_items": <n>, "lessons": <n> },
  "feedback": "<2-3 sentence overall assessment, specific and constructive>"
}`

    let score = 40
    let feedback = 'Document submitted. Focus on specific root causes and ownable action items.'
    const section_scores: Record<string, number> = { summary: 40, root_cause: 40, timeline: 40, action_items: 40, lessons: 40 }

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          overall: number
          section_scores: Record<string, number>
          feedback: string
        }
        score = Math.min(100, Math.max(0, parsed.overall ?? 40))
        Object.assign(section_scores, parsed.section_scores ?? {})
        feedback = parsed.feedback ?? feedback
      }
    } catch { /* use fallbacks */ }

    const rating = sqlRating(score)

    await pool.query(
      `INSERT INTO postmortem_attempts (session_id, question_id, sections, score, rating) VALUES ($1,$2,$3,$4,$5)`,
      [session_id, question_id, JSON.stringify(sections), score, rating]
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
        JSON.stringify(Object.fromEntries(Object.entries(section_scores).map(([k, v]) => [k, { score: v, max: 100 }]))),
        JSON.stringify(['Postmortem document submitted']),
        feedback,
      ]
    )

    res.json({ score, rating, feedback, section_scores })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin CRUD
postmortemRouter.get('/admin/questions', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT id, title, difficulty, time_limit_seconds, created_at FROM postmortem_questions ORDER BY created_at DESC`)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

postmortemRouter.post('/admin/questions', requireAdmin, async (req, res) => {
  const { title, incident_summary, timeline, difficulty, time_limit_seconds } = req.body as Record<string, unknown>
  try {
    const r = await pool.query(
      `INSERT INTO postmortem_questions (title, incident_summary, timeline, difficulty, time_limit_seconds)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, incident_summary, JSON.stringify(timeline ?? []), difficulty ?? 'medium', time_limit_seconds ?? 1800]
    )
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

postmortemRouter.delete('/admin/questions/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM postmortem_questions WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})
