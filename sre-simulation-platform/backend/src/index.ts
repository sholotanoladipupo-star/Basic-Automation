import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import { handleConnection } from './orchestrator'
import { initDb } from './db/init'
import { pool } from './db/client'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
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
      'SELECT id, candidate_name, scenario_id, created_at, used_at, status FROM session_assignments ORDER BY created_at DESC LIMIT 100'
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Admin: create assignment
app.post('/admin/assignments', requireAdmin, async (req, res) => {
  const { candidate_name, scenario_id } = req.body as { candidate_name?: string; scenario_id?: string }
  if (!candidate_name || !scenario_id) {
    res.status(400).json({ error: 'candidate_name and scenario_id required' })
    return
  }
  try {
    const result = await pool.query(
      'INSERT INTO session_assignments (candidate_name, scenario_id) VALUES ($1, $2) RETURNING *',
      [candidate_name.trim(), scenario_id]
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
    res.json(result.rows[0])
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
