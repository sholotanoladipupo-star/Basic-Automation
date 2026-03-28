import { useState, useEffect, useRef } from 'react'
import { SessionInfo } from '../types'

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')
  .replace('wss://', 'https://')

interface SQLQuestion {
  id: string
  title: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  question_type: 'write' | 'fix' | 'identify'
  starter_query: string
  schema_hint: string
  hint: string
  time_limit_seconds: number
}

interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
  error?: string
  truncated?: boolean
}

interface ScoreResult {
  score: number
  rating: 'Good' | 'Managing' | 'Learning'
  solution_query: string
  candidate_result: { columns: string[]; rows: Record<string, unknown>[]; row_count: number; error?: string }
  scorecard: {
    dimensions: {
      query_correctness: { score: number; max: number }
      syntax_accuracy: { score: number; max: number }
      result_completeness: { score: number; max: number }
    }
    timeline_highlights: string[]
    postmortem_summary: string
  }
}

interface SchemaTable {
  columns: { name: string; type: string }[]
  sample_rows: Record<string, unknown>[]
}

interface Props {
  sessionInfo: SessionInfo
}

function ratingColor(rating: string) {
  if (rating === 'Good') return 'text-[#3fb950]'
  if (rating === 'Managing') return 'text-[#d29922]'
  return 'text-[#f85149]'
}

function ratingBorder(rating: string) {
  if (rating === 'Good') return 'border-[#3fb950]'
  if (rating === 'Managing') return 'border-[#d29922]'
  return 'border-[#f85149]'
}

export default function SQLSimulation({ sessionInfo }: Props) {
  const [question, setQuestion] = useState<SQLQuestion | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<QueryResult | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [schema, setSchema] = useState<Record<string, SchemaTable> | null>(null)
  const [activeSchemaTable, setActiveSchemaTable] = useState<string | null>(null)
  const [schemaOpen, setSchemaOpen] = useState(true)
  const [syntaxOpen, setSyntaxOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Enforce minimum 8-minute time limit
  const timeLimit = Math.max(question?.time_limit_seconds ?? 480, 480)
  const remaining = Math.max(0, timeLimit - elapsed)
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const timedOut = remaining === 0 && !submitted

  useEffect(() => {
    if (!sessionInfo.question_id) { setLoadError('No question assigned. Contact your assessor.'); return }
    fetch(`${API_BASE}/sql/questions/${sessionInfo.question_id}`)
      .then(r => r.json())
      .then((q: SQLQuestion) => {
        setQuestion(q)
        setQuery(q.starter_query ?? '')
      })
      .catch(() => setLoadError('Failed to load question. Please refresh.'))

    // Load schema browser in background
    fetch(`${API_BASE}/sql/schema`)
      .then(r => r.json())
      .then((s: Record<string, SchemaTable>) => {
        setSchema(s)
        setActiveSchemaTable(Object.keys(s)[0] ?? null)
      })
      .catch(() => { /* schema browser is optional */ })
  }, [sessionInfo.question_id])

  useEffect(() => {
    if (!question || submitted || timedOut) return
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [question, submitted, timedOut])

  // Auto-submit on timeout
  useEffect(() => {
    if (timedOut && !submitted && question) {
      if (timerRef.current) clearInterval(timerRef.current)
      handleSubmit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut])

  async function handleRun() {
    if (!query.trim() || running) return
    setRunning(true); setRunResult(null)
    try {
      const res = await fetch(`${API_BASE}/sql/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query })
      })
      setRunResult(await res.json() as QueryResult)
    } catch (err) {
      setRunResult({ columns: [], rows: [], row_count: 0, error: String(err) })
    } finally {
      setRunning(false)
    }
  }

  async function handleSubmit() {
    if (!query.trim() || submitted || !question) return
    if (timerRef.current) clearInterval(timerRef.current)
    setRunning(true)
    setSubmitError('')
    try {
      const res = await fetch(`${API_BASE}/sql/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: sessionInfo.session_id, question_id: question.id, query })
      })
      const data = await res.json() as ScoreResult & { error?: string }
      if (!res.ok || data.error) {
        setSubmitError(data.error ?? `Server error (${res.status})`)
        return
      }
      setScoreResult(data)
      setSubmitted(true)
    } catch (err) {
      setSubmitError('Submit failed: ' + String(err))
    } finally {
      setRunning(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#f85149] font-mono text-sm">{loadError}</div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#8b949e] font-mono text-sm animate-pulse">Loading question…</div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0d1117] font-mono text-xs flex flex-col">
      {/* Submission confirmation — candidates see only this, no scores */}
      {submitted && (
        <div className="bg-[#0f2a1a] border-b border-[#3fb950] px-4 py-3 text-center flex-shrink-0">
          <span className="text-[#3fb950] font-bold text-sm">✓ Exercise Submitted</span>
          <span className="text-[#8b949e] text-xs block mt-0.5">Your answers have been recorded. Your assessor will review your results.</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[#58a6ff] font-bold text-sm">SQL Readiness Assessment</span>
          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
            question.difficulty === 'easy' ? 'border-[#3fb950] text-[#3fb950]'
            : question.difficulty === 'medium' ? 'border-[#d29922] text-[#d29922]'
            : 'border-[#f85149] text-[#f85149]'
          }`}>{question.difficulty}</span>
          <span className="text-[#484f58] capitalize">{question.question_type === 'fix' ? 'Fix the Query' : question.question_type === 'identify' ? 'Identify the Issue' : 'Write a Query'}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-sm font-bold tabular-nums ${remaining < 120 ? 'text-[#f85149] animate-pulse' : remaining < 300 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
            {timedOut ? 'TIME UP' : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
          </div>
          <button onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="text-[#484f58] hover:text-[#8b949e] transition-colors text-sm px-1">
            {isFullscreen ? '✕FS' : '⛶'}
          </button>
        </div>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Question + Schema Browser */}
        <div className="w-2/5 border-r border-[#30363d] overflow-y-auto flex flex-col">
          <div className="p-5 space-y-4">
            <div>
              <div className="text-[#e6edf3] text-sm font-bold mb-2">{question.title}</div>
              <div className="text-[#8b949e] leading-relaxed whitespace-pre-wrap">{question.description}</div>
            </div>

            {question.hint && (
              <div>
                <button
                  onClick={() => setShowHint(!showHint)}
                  className="text-[#d29922] hover:text-[#e3b341] transition-colors underline"
                >
                  {showHint ? 'Hide hint' : 'Show hint'}
                </button>
                {showHint && (
                  <div className="mt-2 bg-[#161b22] border border-[#d29922] rounded p-3 text-[#d29922] leading-relaxed">
                    {question.hint}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SQL Syntax Reference */}
          <div className="border-t border-[#30363d]">
            <button
              onClick={() => setSyntaxOpen(o => !o)}
              className="w-full px-5 py-2.5 flex items-center justify-between text-[#484f58] uppercase tracking-widest hover:text-[#8b949e] transition-colors"
            >
              <span>SQL Syntax Reference</span>
              <span className="text-[10px]">{syntaxOpen ? '▲' : '▼'}</span>
            </button>
            {syntaxOpen && (
              <div className="px-5 pb-4 space-y-3 text-[11px]">
                {[
                  { label: 'SELECT', code: 'SELECT col1, col2\nFROM table\nWHERE condition\nORDER BY col ASC\nLIMIT 10;' },
                  { label: 'JOIN', code: 'SELECT a.id, b.name\nFROM a\nINNER JOIN b ON a.id = b.a_id\nLEFT JOIN c ON a.id = c.a_id;' },
                  { label: 'GROUP BY / HAVING', code: 'SELECT dept, COUNT(*) as cnt, AVG(salary)\nFROM employees\nGROUP BY dept\nHAVING COUNT(*) > 5;' },
                  { label: 'Subquery', code: 'SELECT name FROM employees\nWHERE salary > (\n  SELECT AVG(salary) FROM employees\n);' },
                  { label: 'CASE', code: 'SELECT name,\n  CASE\n    WHEN salary > 80000 THEN \'Senior\'\n    WHEN salary > 50000 THEN \'Mid\'\n    ELSE \'Junior\'\n  END AS level\nFROM employees;' },
                  { label: 'Date functions', code: 'WHERE hire_date >= NOW() - INTERVAL \'1 year\'\nAND EXTRACT(YEAR FROM hire_date) = 2023\nAND DATE_TRUNC(\'month\', hire_date) = \'2023-01-01\'' },
                  { label: 'String functions', code: "LOWER(col), UPPER(col)\nCONCAT(col1, ' ', col2)\nLIKE '%pattern%'\nCOALESCE(col, 'default')" },
                  { label: 'Window functions', code: 'SELECT name, salary,\n  RANK() OVER (ORDER BY salary DESC) as rank,\n  SUM(salary) OVER (PARTITION BY dept) as dept_total\nFROM employees;' },
                ].map(({ label, code }) => (
                  <div key={label}>
                    <div className="text-[#58a6ff] font-bold text-[10px] uppercase tracking-widest mb-1">{label}</div>
                    <pre className="bg-[#0d1117] border border-[#1c2128] rounded p-2 text-[#8b949e] text-[10px] whitespace-pre overflow-x-auto">{code}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schema Browser */}
          {schema && (
            <div className="border-t border-[#30363d]">
              <button
                onClick={() => setSchemaOpen(o => !o)}
                className="w-full px-5 py-2.5 flex items-center justify-between text-[#484f58] uppercase tracking-widest hover:text-[#8b949e] transition-colors"
              >
                <span>Schema Browser</span>
                <span className="text-[10px]">{schemaOpen ? '▲' : '▼'}</span>
              </button>
              {schemaOpen && (
                <div className="px-3 pb-4">
                  {/* Table selector tabs */}
                  <div className="flex gap-1 mb-3 flex-wrap">
                    {Object.keys(schema).map(t => (
                      <button
                        key={t}
                        onClick={() => setActiveSchemaTable(t)}
                        className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                          activeSchemaTable === t
                            ? 'border-[#58a6ff] text-[#58a6ff] bg-[#1c2128]'
                            : 'border-[#30363d] text-[#484f58] hover:border-[#8b949e] hover:text-[#8b949e]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {activeSchemaTable && schema[activeSchemaTable] && (
                    <div>
                      {/* Columns */}
                      <div className="mb-2">
                        <div className="text-[#484f58] uppercase tracking-widest text-[9px] mb-1">Columns</div>
                        <div className="flex flex-wrap gap-1">
                          {schema[activeSchemaTable].columns.map(c => (
                            <span key={c.name} className="px-1.5 py-0.5 bg-[#1c2128] border border-[#30363d] rounded text-[#79c0ff] text-[10px]">
                              {c.name} <span className="text-[#484f58]">{c.type.replace('character varying', 'text').replace('timestamp with time zone', 'timestamptz')}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Sample rows */}
                      {schema[activeSchemaTable].sample_rows.length > 0 && (
                        <div>
                          <div className="text-[#484f58] uppercase tracking-widest text-[9px] mb-1">Sample rows (5)</div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="text-[#484f58] border-b border-[#30363d]">
                                  {schema[activeSchemaTable].columns.map(c => (
                                    <th key={c.name} className="text-left px-1.5 py-1 font-normal whitespace-nowrap">{c.name}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {schema[activeSchemaTable].sample_rows.map((row, i) => (
                                  <tr key={i} className="border-b border-[#1c2128] hover:bg-[#161b22]">
                                    {schema[activeSchemaTable].columns.map(c => (
                                      <td key={c.name} className="px-1.5 py-1 text-[#8b949e] whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis">
                                        {String(row[c.name] ?? '')}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Editor + Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Query Editor */}
          <div className="flex-1 flex flex-col border-b border-[#30363d] min-h-0">
            <div className="px-4 py-2 border-b border-[#30363d] flex items-center justify-between bg-[#161b22]">
              <span className="text-[#8b949e] uppercase tracking-widest">Query Editor</span>
              <div className="flex gap-2">
                <button
                  onClick={handleRun}
                  disabled={running || submitted || timedOut || !query.trim()}
                  className="bg-[#0d419d] hover:bg-[#1158c7] disabled:bg-[#161b22] disabled:text-[#484f58] text-white px-4 py-1 rounded border border-[#388bfd] disabled:border-[#30363d] transition-all"
                >
                  {running ? '▶ Running…' : '▶ Run'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={running || submitted || timedOut || !query.trim()}
                  className="bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold px-4 py-1 rounded border border-[#2ea043] disabled:border-[#30363d] transition-all"
                >
                  {submitted ? '✓ Submitted' : 'Submit'}
                </button>
              </div>
            </div>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={submitted || timedOut}
              spellCheck={false}
              className="flex-1 bg-[#0d1117] text-[#e6edf3] resize-none p-4 text-sm font-mono focus:outline-none disabled:opacity-60"
              placeholder="-- Write your SQL query here"
              onKeyDown={e => {
                if (e.key === 'Tab') { e.preventDefault(); setQuery(q => q + '    ') }
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun() }
              }}
            />
            <div className="px-4 py-1.5 bg-[#161b22] text-[#484f58] text-[10px] border-t border-[#30363d]">
              Ctrl+Enter to run · Submit when ready
            </div>
          </div>

          {/* Results */}
          <div className="h-64 overflow-auto bg-[#0d1117]">
            {timedOut && !submitted && (
              <div className="p-4 text-center">
                <div className="text-[#f85149] font-bold text-sm mb-1">⏱ Time is up!!</div>
                <div className="text-[#8b949e] text-xs">Your query has been auto-submitted.</div>
              </div>
            )}

            {submitError && (
              <div className="p-4 bg-[#1c0a0a] border-b border-[#f85149] text-[#f85149]">
                <div className="font-bold mb-1">Submit Error</div>
                <div>{submitError}</div>
              </div>
            )}

            {submitted && (
              <div className="p-8 text-center">
                <div className="text-[#3fb950] text-3xl mb-3">✓</div>
                <div className="text-[#e6edf3] font-bold text-sm">Exercise Submitted</div>
                <div className="text-[#8b949e] text-xs mt-1">Your assessor will review your results.</div>
              </div>
            )}

            {!submitted && runResult && (
              <div className="p-3">
                {runResult.error ? (
                  <div className="text-[#f85149] bg-[#1c0a0a] border border-[#f85149] rounded p-3">
                    <div className="text-[#f85149] font-bold mb-1">Error</div>
                    <pre className="whitespace-pre-wrap text-[11px]">{runResult.error}</pre>
                  </div>
                ) : (
                  <>
                    <div className="text-[#3fb950] mb-2">
                      {runResult.row_count} row{runResult.row_count !== 1 ? 's' : ''} returned
                      {runResult.truncated && <span className="text-[#d29922] ml-2">(truncated to 100)</span>}
                    </div>
                    {runResult.columns.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-[#484f58] border-b border-[#30363d]">
                              {runResult.columns.map(c => <th key={c} className="text-left px-2 py-1 font-normal">{c}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {runResult.rows.map((row, i) => (
                              <tr key={i} className="border-b border-[#1c2128] hover:bg-[#161b22]">
                                {runResult.columns.map(c => (
                                  <td key={c} className="px-2 py-1 text-[#e6edf3]">{String(row[c] ?? '')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {!submitted && !runResult && !submitError && (
              <div className="p-4 text-[#484f58] text-center">
                Run your query to see results here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
