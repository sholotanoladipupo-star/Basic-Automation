/**
 * Cognitive assessment routes.
 * Mounted at /cognitive in index.ts.
 */
import { Router, Request, Response, NextFunction } from 'express'
import { pool } from '../db/client'
import { sqlRating } from '../sql-executor'

const ADMIN_KEY = process.env.ADMIN_KEY || 'sre-admin-2024'
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) { res.status(401).json({ error: 'Unauthorized' }); return }
  next()
}

export const cognitiveRouter = Router()

/** Get all questions for a cognitive set (candidate view — correct answers hidden) */
cognitiveRouter.get('/questions', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, question, question_type, options, difficulty, category, time_limit_seconds
       FROM cognitive_questions WHERE title LIKE '[SEED]%' ORDER BY created_at ASC`
    )
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

/** Submit all answers for the cognitive assessment */
cognitiveRouter.post('/submit', async (req, res) => {
  const { session_id, answers } = req.body as {
    session_id?: string
    answers?: { question_id: string; answer: string }[]
  }
  if (!session_id || !answers?.length) {
    res.status(400).json({ error: 'session_id and answers required' }); return
  }
  try {
    // Fetch all questions to grade
    const ids = answers.map(a => a.question_id)
    const qr = await pool.query(
      `SELECT id, correct_answer, explanation, title, question FROM cognitive_questions WHERE id = ANY($1)`,
      [ids]
    )
    const qMap = new Map(qr.rows.map(q => [q.id as string, q]))

    const graded = answers.map(a => {
      const q = qMap.get(a.question_id)
      if (!q) return { question_id: a.question_id, answer: a.answer, correct: false, correct_answer: '', explanation: '', title: '' }
      const correct = a.answer.trim().toLowerCase() === (q.correct_answer as string).trim().toLowerCase()
      return {
        question_id: a.question_id,
        title: q.title as string,
        question: q.question as string,
        answer: a.answer,
        correct,
        correct_answer: q.correct_answer as string,
        explanation: q.explanation as string,
      }
    })

    const correctCount = graded.filter(g => g.correct).length
    const score = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0
    const rating = sqlRating(score)

    await pool.query(
      `INSERT INTO cognitive_attempts (session_id, answers, score, rating) VALUES ($1,$2,$3,$4)`,
      [session_id, JSON.stringify(answers), score, rating]
    )

    await pool.query(
      `UPDATE sessions SET overall_score = $1, ended_at = NOW(), status = 'completed' WHERE id = $2`,
      [score, session_id]
    )

    const scorecard = {
      session_id,
      overall_score: score,
      module_type: 'cognitive',
      rating,
      correct: correctCount,
      total: answers.length,
      graded,
      postmortem_summary: score >= 80
        ? 'Strong logical reasoning demonstrated. Quick, accurate thinking under time pressure.'
        : score >= 50
        ? 'Good reasoning foundation. Review numerical patterns and logical deduction techniques.'
        : 'Work on logical reasoning and numerical thinking. Practice pattern recognition questions.',
    }

    await pool.query(
      `INSERT INTO scorecards (session_id, overall_score, dimensions, timeline_highlights, postmortem)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        session_id, score,
        JSON.stringify({ logical_reasoning: { score: Math.round(score * 0.5), max: 50 }, numerical_accuracy: { score: Math.round(score * 0.5), max: 50 } }),
        JSON.stringify([`${correctCount}/${answers.length} questions answered correctly`]),
        scorecard.postmortem_summary
      ]
    )

    res.json({ score, rating, scorecard, graded })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// Admin CRUD
cognitiveRouter.get('/admin/questions', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM cognitive_questions ORDER BY created_at ASC`)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

cognitiveRouter.get('/admin/attempts', requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.id, a.session_id, a.score, a.rating, a.answers, a.submitted_at, s.candidate_name
       FROM cognitive_attempts a
       JOIN sessions s ON s.id = a.session_id
       ORDER BY a.submitted_at DESC LIMIT 100`
    )
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})
