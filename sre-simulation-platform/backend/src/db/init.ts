import { pool } from './client'

export async function initDb(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_name TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        overall_score INTEGER,
        status TEXT DEFAULT 'active'
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS event_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        ts TIMESTAMPTZ DEFAULT NOW(),
        sim_ts TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload JSONB DEFAULT '{}',
        state_snapshot_id UUID
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS state_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        captured_at TIMESTAMPTZ DEFAULT NOW(),
        state JSONB NOT NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS scorecards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        overall_score INTEGER,
        dimensions JSONB,
        timeline_highlights JSONB,
        postmortem TEXT
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS command_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scenario_id TEXT NOT NULL DEFAULT 'global',
        command_pattern TEXT NOT NULL,
        state_condition TEXT NOT NULL DEFAULT 'always',
        stdout TEXT NOT NULL,
        exit_code INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 120,
        priority INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS session_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_name TEXT NOT NULL,
        scenario_id TEXT NOT NULL DEFAULT 'cache-db-cascade',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        used_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'pending'
      )
    `)

    // Add scenario_name column to sessions if it doesn't exist
    await client.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scenario_name TEXT NOT NULL DEFAULT 'Redis Cache → DB Cascade'`)

    await client.query(`CREATE INDEX IF NOT EXISTS idx_event_logs_session ON event_logs(session_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_state_snapshots_session ON state_snapshots(session_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scorecards_session ON scorecards(session_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cmd_responses_pattern ON command_responses(command_pattern)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_assignments_candidate ON session_assignments(candidate_name)`)

    console.log('Database schema initialized successfully')
  } finally {
    client.release()
  }
}

// Run directly: ts-node src/db/init.ts
if (require.main === module) {
  initDb()
    .then(() => { pool.end(); process.exit(0) })
    .catch((err) => { console.error(err); pool.end(); process.exit(1) })
}
