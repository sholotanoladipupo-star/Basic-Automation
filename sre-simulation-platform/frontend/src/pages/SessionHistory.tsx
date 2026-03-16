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
  highlights: string[]
  improvements: string[]
  postmortem_summary: string
}

interface SessionWithScore extends Session {
  scorecard?: Scorecard
}

const WS_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001').replace('ws://', 'http://').replace('wss://', 'https://')
const API_BASE = WS_BASE

interface SessionHistoryProps {
  onBack: () => void
}

export default function SessionHistory({ onBack }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<SessionWithScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/sessions`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: Session[] = await res.json()
        // Fetch scorecards for completed sessions
        const withScores: SessionWithScore[] = await Promise.all(
          data.map(async session => {
            if (session.status === 'ended' || session.status === 'completed') {
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
  }, [])

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
                          session.status === 'ended' || session.status === 'completed'
                            ? 'border-[#30363d] text-[#8b949e]'
                            : 'border-[#3fb950] text-[#3fb950]'
                        }`}>
                          {session.status === 'ended' || session.status === 'completed' ? 'ENDED' : session.status.toUpperCase()}
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
                    <div className="border-t border-[#30363d] px-4 py-4 bg-[#0d1117] space-y-4">
                      {/* Dimension bars */}
                      <div>
                        <div className="text-[#8b949e] uppercase tracking-widest mb-2">Score Breakdown</div>
                        <div className="space-y-2">
                          {[
                            { label: 'Incident Coordination', score: sc.incident_coordination, weight: 25 },
                            { label: 'Incident Resolution', score: sc.incident_resolution, weight: 35 },
                            { label: 'Technical Depth', score: sc.technical_depth, weight: 25 },
                            { label: 'Observability Usage', score: sc.observability_usage, weight: 15 },
                          ].map(d => (
                            <div key={d.label}>
                              <div className="flex justify-between mb-1">
                                <span className="text-[#8b949e]">{d.label} <span className="text-[#484f58]">({d.weight}%)</span></span>
                                <span className={scoreColor(d.score, 65)}>{d.score}/100</span>
                              </div>
                              <div className="h-1.5 bg-[#161b22] rounded overflow-hidden">
                                <div
                                  className={`h-full rounded transition-all ${d.score >= 65 ? 'bg-[#3fb950]' : d.score >= 45 ? 'bg-[#d29922]' : 'bg-[#f85149]'}`}
                                  style={{ width: `${d.score}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Highlights */}
                      {sc.highlights.length > 0 && (
                        <div>
                          <div className="text-[#8b949e] uppercase tracking-widest mb-2">What Went Well</div>
                          <div className="space-y-1">
                            {sc.highlights.map((h, i) => (
                              <div key={i} className="flex gap-2 text-[#3fb950]">
                                <span>✓</span>
                                <span className="text-[#e6edf3]">{h}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Improvements */}
                      {sc.improvements.length > 0 && (
                        <div>
                          <div className="text-[#8b949e] uppercase tracking-widest mb-2">Areas to Improve</div>
                          <div className="space-y-1">
                            {sc.improvements.map((imp, i) => (
                              <div key={i} className="flex gap-2">
                                <span className="text-[#d29922]">△</span>
                                <span className="text-[#e6edf3]">{imp}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Postmortem summary */}
                      {sc.postmortem_summary && (
                        <div>
                          <div className="text-[#8b949e] uppercase tracking-widest mb-2">Postmortem Summary</div>
                          <div className="text-[#e6edf3] leading-relaxed bg-[#161b22] rounded p-3 border border-[#30363d]">
                            {sc.postmortem_summary}
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
