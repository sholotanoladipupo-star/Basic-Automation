import { pool } from './db/client'

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
  error?: string
  truncated?: boolean
}

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY|pg_read_file|pg_ls_dir|lo_)\b/i

export function isSafeQuery(sql: string): boolean {
  const trimmed = sql.trim()
  if (!trimmed.match(/^(SELECT|WITH)\s/i)) return false
  if (FORBIDDEN.test(trimmed)) return false
  return true
}

export async function executeQuery(sql: string): Promise<QueryResult> {
  if (!isSafeQuery(sql)) {
    return { columns: [], rows: [], row_count: 0, error: 'Only SELECT statements are allowed. INSERT/UPDATE/DELETE/DROP are not permitted.' }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL search_path TO sql_sandbox, public")
    await client.query("SET LOCAL statement_timeout = '5000'")

    const result = await client.query(sql)
    await client.query('ROLLBACK')

    const columns = result.fields.map(f => f.name)
    const rows = result.rows.slice(0, 100)
    return { columns, rows, row_count: result.rowCount ?? rows.length, truncated: result.rows.length > 100 }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return { columns: [], rows: [], row_count: 0, error: err instanceof Error ? err.message : String(err) }
  } finally {
    client.release()
  }
}

export function scoreQueryResult(
  candidate: QueryResult,
  expected: { columns: string[]; rows: Record<string, unknown>[] }
): number {
  if (candidate.error) return 0

  const normCols = (cols: string[]) => cols.map(c => c.toLowerCase()).sort().join(',')
  if (normCols(candidate.columns) !== normCols(expected.columns)) return 20 // partial: ran without error

  if (candidate.rows.length !== expected.rows.length) {
    // Partial credit: right shape, wrong data
    return 45
  }

  const stringify = (row: Record<string, unknown>) =>
    JSON.stringify(Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase(), String(v ?? '').trim().toLowerCase()])
    ))

  const candidateSet = new Set(candidate.rows.map(stringify))
  const expectedSet = new Set(expected.rows.map(stringify))
  const matched = [...expectedSet].filter(r => candidateSet.has(r)).length
  const pct = matched / expected.rows.length

  if (pct === 1) return 100
  if (pct >= 0.8) return 80
  if (pct >= 0.5) return 60
  return 35
}

export function sqlRating(score: number): 'Good' | 'Managing' | 'Learning' {
  if (score >= 80) return 'Good'
  if (score >= 50) return 'Managing'
  return 'Learning'
}
