import { useEffect, useState } from 'react'

interface Session {
  id: string
  candidate_name: string
  scenario_id: string
  scenario_name: string | null
  started_at: string
  ended_at: string | null
  status: string
  overall_score: number | null
}

interface TimelineHighlight {
  ts?: string
  event: string
  quality?: 'poor' | 'okay' | 'good' | 'excellent'
}

interface Scorecard {
  session_id: string
  total_score: number
  passing_score: number
  passed: boolean
  duration_minutes: number
  incident_coordination: number
  incident_resolution: number
  technical_depth: number
  observability_usage: number
  coordination_notes?: string
  resolution_notes?: string
  technical_notes?: string
  observability_notes?: string
  highlights: (string | TimelineHighlight)[]
  improvements: string[]
  postmortem_summary: string
  candidate_query?: string
  sql_score?: number
  sql_rating?: string
  sql_question?: { title: string; description: string; schema_hint: string; starter_query: string; expected_output: unknown }
  monitoring_answers?: { id: string; answer: string }[]
  overall_score?: number
  postmortem?: string
}

interface SessionWithScore extends Session {
  scorecard?: Scorecard
}

const WS_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001').replace('ws://', 'http://').replace('wss://', 'https://')
const API_BASE = WS_BASE

interface SessionHistoryProps {
  onBack: () => void
}

const HISTORY_PASSWORD = 'sre-moniepoint-2024'

export default function SessionHistory({ onBack }: SessionHistoryProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [sessions, setSessions] = useState<SessionWithScore[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (passwordInput === HISTORY_PASSWORD) {
      setUnlocked(true)
      setPasswordError(false)
    } else {
      setPasswordError(true)
    }
  }

  useEffect(() => {
    if (!unlocked) return
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/sessions`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: Session[] = await res.json()
        // Fetch scorecards for completed sessions
        const withScores: SessionWithScore[] = await Promise.all(
          data.map(async session => {
            if (session.status === 'ended' || session.status === 'completed' || session.status === 'time_limit') {
              try {
                const sc = await fetch(`${API_BASE}/sessions/${session.id}/scorecard`)
                if (sc.ok) {
                  const scorecard: Scorecard = await sc.json()
                  return { ...session, scorecard }
                }
              } catch {
                // ignore
              }
            }
            return session
          })
        )
        setSessions(withScores)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load sessions')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [unlocked])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium', timeStyle: 'short'
    })
  }

  function scoreColor(score: number, passing: number) {
    if (score >= passing) return 'text-[#3fb950]'
    if (score >= passing * 0.7) return 'text-[#d29922]'
    return 'text-[#f85149]'
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4 font-mono">
        <div className="w-full max-w-sm bg-[#161b22] border border-[#30363d] rounded-lg p-6 space-y-5">
          <div className="text-center">
            <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-2">🔒 Restricted Access</div>
            <h1 className="text-[#e6edf3] text-lg font-bold">Session History</h1>
            <p className="text-[#484f58] text-xs mt-1">Enter the assessor password to continue</p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#3fb950] transition-colors"
            />
            {passwordError && (
              <div className="text-[#f85149] text-xs text-center">✗ Incorrect password</div>
            )}
            <button
              type="submit"
              className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2.5 rounded border border-[#2ea043] transition-all text-sm"
            >
              Unlock
            </button>
          </form>
          <button onClick={onBack} className="w-full text-[#484f58] hover:text-[#8b949e] text-xs text-center transition-colors">
            ← Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117] font-mono text-xs px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="text-[#58a6ff] hover:text-[#79c0ff] transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-[#e6edf3] text-xl font-bold tracking-tight">Session History</h1>
            <div className="text-[#8b949e] mt-0.5">All past simulation runs</div>
          </div>
        </div>

        {loading && (
          <div className="text-[#8b949e] text-center py-16">
            <div className="text-2xl mb-3">◉</div>
            Loading sessions...
          </div>
        )}

        {error && (
          <div className="bg-[#161b22] border border-[#f85149] rounded-lg p-6 text-center text-[#f85149]">
            ✗ {error}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-12 text-center text-[#8b949e]">
            <div className="text-3xl mb-3">📋</div>
            No sessions yet. Start a simulation to see your history here.
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map(session => {
              const sc = session.scorecard
              const isExpanded = expanded === session.id
              return (
                <div
                  key={session.id}
                  className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden"
                >
                  {/* Row header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#1c2128] transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : session.id)}
                  >
                    {/* Score circle */}
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 font-bold ${
                      sc
                        ? sc.passed
                          ? 'border-[#3fb950] text-[#3fb950]'
                          : 'border-[#f85149] text-[#f85149]'
                        : 'border-[#30363d] text-[#484f58]'
                    }`}>
                      {sc ? sc.total_score : '–'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[#e6edf3] font-bold">{session.candidate_name}</span>
                        {sc && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                            sc.passed
                              ? 'border-[#3fb950] text-[#3fb950]'
                              : 'border-[#f85149] text-[#f85149]'
                          }`}>
                            {sc.passed ? 'PASS' : 'FAIL'}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          session.status === 'time_limit' ? 'border-[#d29922] text-[#d29922]'
                          : session.status === 'ended' || session.status === 'completed' ? 'border-[#30363d] text-[#8b949e]'
                          : 'border-[#3fb950] text-[#3fb950]'
                        }`}>
                          {session.status === 'time_limit' ? 'TIME LIMIT'
                           : session.status === 'ended' || session.status === 'completed' ? 'COMPLETED'
                           : session.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[#8b949e] mt-0.5">{session.scenario_name ?? session.scenario_id}</div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-[#8b949e]">{formatDate(session.started_at)}</div>
                      {sc && <div className="text-[#484f58] mt-0.5">{sc.duration_minutes} min</div>}
                    </div>

                    <span className="text-[#484f58] ml-2">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded scorecard */}
                  {isExpanded && sc && (
                    <div className="border-t border-[#30363d] px-4 py-4 bg-[#0d1117] space-y-5">

                      {/* AI Assessment — shown first, prominently */}
                      {(sc.postmortem_summary || sc.postmortem) && (
                        <div className="bg-[#1c2128] border border-[#58a6ff]/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[#58a6ff] text-base">🤖</span>
                            <div className="text-[#58a6ff] font-bold uppercase tracking-widest text-[10px]">AI Assessment</div>
                          </div>
                          <div className="text-[#e6edf3] leading-relaxed text-[11px]">
                            {sc.postmortem_summary || sc.postmortem}
                          </div>
                        </div>
                      )}

                      {/* Score Breakdown */}
                      <div>
                        <div className="text-[#8b949e] uppercase tracking-widest mb-2 text-[10px]">Score Breakdown</div>
                        <div className="space-y-2">
                          {[
                            { label: 'Coordination', score: sc.incident_coordination, weight: 25, notes: sc.coordination_notes },
                            { label: 'Resolution', score: sc.incident_resolution, weight: 35, notes: sc.resolution_notes },
                            { label: 'Technical Depth', score: sc.technical_depth, weight: 25, notes: sc.technical_notes },
                            { label: 'Observability', score: sc.observability_usage, weight: 15, notes: sc.observability_notes },
                          ].map(d => (
                            <div key={d.label} className="bg-[#161b22] rounded p-2.5 border border-[#30363d]">
                              <div className="flex justify-between mb-1">
                                <span className="text-[#8b949e]">{d.label} <span className="text-[#484f58]">({d.weight}%)</span></span>
                                <span className={scoreColor(d.score, 65)}>{d.score}/100</span>
                              </div>
                              <div className="h-1.5 bg-[#0d1117] rounded overflow-hidden mb-1.5">
                                <div
                                  className={`h-full rounded transition-all ${d.score >= 65 ? 'bg-[#3fb950]' : d.score >= 45 ? 'bg-[#d29922]' : 'bg-[#f85149]'}`}
                                  style={{ width: `${d.score}%` }}
                                />
                              </div>
                              {d.notes && <div className="text-[#8b949e] text-[10px] leading-relaxed">{d.notes}</div>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Timeline highlights */}
                      {(sc.highlights?.length ?? 0) > 0 && (
                        <div>
                          <div className="text-[#8b949e] uppercase tracking-widest mb-2 text-[10px]">Timeline Highlights</div>
                          <div className="space-y-1">
                            {sc.highlights.map((h, i) => {
                              const isObj = typeof h === 'object' && h !== null
                              const event = isObj ? (h as TimelineHighlight).event : String(h)
                              const ts = isObj ? (h as TimelineHighlight).ts : undefined
                              const quality = isObj ? (h as TimelineHighlight).quality : undefined
                              const qColor = quality === 'excellent' ? '#3fb950' : quality === 'good' ? '#58a6ff' : quality === 'okay' ? '#d29922' : quality === 'poor' ? '#f85149' : '#3fb950'
                              return (
                                <div key={i} className="flex gap-2 items-start">
                                  <span style={{ color: qColor }} className="flex-shrink-0 mt-0.5">✓</span>
                                  <div>
                                    {ts && <span className="text-[#484f58] text-[10px] mr-2">{ts}</span>}
                                    <span className="text-[#e6edf3]">{event}</span>
                                    {quality && <span className="ml-2 text-[9px] uppercase" style={{ color: qColor }}>[{quality}]</span>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* SQL side-by-side view */}
                      {sc.candidate_query !== undefined && (
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="text-[#8b949e] uppercase tracking-widest text-[10px]">SQL Submission</div>
                            {sc.sql_score !== undefined && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                (sc.sql_score ?? 0) >= 70 ? 'border-[#3fb950] text-[#3fb950]' : (sc.sql_score ?? 0) >= 50 ? 'border-[#d29922] text-[#d29922]' : 'border-[#f85149] text-[#f85149]'
                              }`}>AI Score: {sc.sql_score}/100 · {sc.sql_rating}</span>
                            )}
                          </div>
                          {sc.sql_question && (
                            <div className="mb-3 bg-[#161b22] rounded p-3 border border-[#30363d]">
                              <div className="text-[#58a6ff] font-bold mb-1 text-[11px]">{sc.sql_question.title}</div>
                              <div className="text-[#e6edf3] text-[11px] mb-2">{sc.sql_question.description}</div>
                              {sc.sql_question.schema_hint && (
                                <pre className="text-[#8b949e] text-[10px] bg-[#0d1117] rounded p-2 border border-[#30363d] overflow-x-auto whitespace-pre-wrap font-mono">{sc.sql_question.schema_hint}</pre>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            {sc.sql_question?.starter_query && (
                              <div>
                                <div className="text-[#484f58] text-[10px] mb-1 uppercase">Starter / Expected</div>
                                <pre className="text-[#8b949e] text-[11px] leading-relaxed bg-[#0d1117] rounded p-3 border border-[#30363d] overflow-x-auto whitespace-pre-wrap font-mono h-full">
                                  {sc.sql_question.starter_query}
                                </pre>
                              </div>
                            )}
                            <div className={sc.sql_question?.starter_query ? '' : 'col-span-2'}>
                              <div className="text-[#484f58] text-[10px] mb-1 uppercase">Candidate's Query</div>
                              <pre className="text-[#e6edf3] text-[11px] leading-relaxed bg-[#0d1117] rounded p-3 border border-[#30363d] overflow-x-auto whitespace-pre-wrap font-mono">
                                {sc.candidate_query || <span className="text-[#484f58] italic">No query submitted</span>}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Monitoring answers */}
                      {sc.monitoring_answers && sc.monitoring_answers.length > 0 && (
                        <div>
                          <div className="text-[#8b949e] uppercase tracking-widest mb-2 text-[10px]">Candidate Answers</div>
                          <div className="space-y-2">
                            {sc.monitoring_answers.map((a, i) => (
                              <div key={i} className="bg-[#161b22] rounded p-3 border border-[#30363d]">
                                <div className="text-[#484f58] text-[10px] mb-1 uppercase tracking-widest">{a.id}</div>
                                <div className="text-[#e6edf3] text-[11px] leading-relaxed">{a.answer || <span className="text-[#484f58] italic">No answer provided</span>}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expanded but no scorecard */}
                  {isExpanded && !sc && (
                    <div className="border-t border-[#30363d] px-4 py-4 bg-[#0d1117] text-[#484f58] text-center">
                      No scorecard available — session may still be in progress or ended without resolution.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
