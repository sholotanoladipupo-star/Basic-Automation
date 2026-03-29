import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import { handleConnection } from './orchestrator'
import { initDb } from './db/init'
import { pool } from './db/client'
import { sqlRouter, monitoringRouter } from './routes/modules'
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
  const { candidate_name, scenario_id, module_type, question_id } = req.body as Record<string, string | undefined>
  if (!candidate_name) {
    res.status(400).json({ error: 'candidate_name required' })
    return
  }
  const mt = module_type ?? 'incident'
  if (mt !== 'incident' && mt !== 'cognitive' && !question_id) {
    res.status(400).json({ error: 'question_id required for sql/monitoring/postmortem/automation modules' })
    return
  }
  try {
    const result = await pool.query(
      'INSERT INTO session_assignments (candidate_name, scenario_id, module_type, question_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [candidate_name.trim(), scenario_id ?? 'cache-db-cascade', mt, question_id ?? null]
    )
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
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
    const scorecard = result.rows[0]
    // Enrich with candidate_query from sql_attempts if this is a SQL session
    const sqlAttempt = await pool.query(
      'SELECT candidate_query, score, rating FROM sql_attempts WHERE session_id = $1 ORDER BY submitted_at DESC LIMIT 1',
      [req.params.id]
    )
    if (sqlAttempt.rows[0]) {
      scorecard.candidate_query = sqlAttempt.rows[0].candidate_query
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
