import { useState } from 'react'

const API = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')

interface Session {
  id: string
  candidate_name: string
  scenario_name: string
  started_at: string
  ended_at: string | null
  overall_score: number | null
  status: string
  module_type: string
}

interface Props {
  onBack: () => void
}

export default function CandidatePortal({ onBack }: Props) {
  const [name, setName] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [scorecard, setScorecard] = useState<Record<string, unknown> | null>(null)
  const [scorecardLoading, setScorecardLoading] = useState(false)
  const [benchmark, setBenchmark] = useState<{ percentile: number; avg_score: number; total_attempts: number } | null>(null)
  const [annotations, setAnnotations] = useState<{ id: string; text: string; created_at: string }[]>([])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    setSessions([])
    setSearched(false)
    setExpandedId(null)
    setScorecard(null)
    try {
      const r = await fetch(`${API}/sessions`)
      const all: Session[] = await r.json()
      const mine = all.filter(s => s.candidate_name.toLowerCase() === name.trim().toLowerCase())
      setSessions(mine)
      setSearched(true)
    } catch {
      setError('Failed to load sessions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleViewScorecard(sessionId: string) {
    if (expandedId === sessionId) { setExpandedId(null); setScorecard(null); setBenchmark(null); setAnnotations([]); return }
    setExpandedId(sessionId)
    setScorecard(null)
    setScorecardLoading(true)
    try {
      const r = await fetch(`${API}/sessions/${sessionId}/scorecard`)
      if (r.ok) setScorecard(await r.json())
      // Fetch benchmark data
      fetch(`${API}/sessions/${sessionId}/benchmark`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setBenchmark(d as { percentile: number; avg_score: number; total_attempts: number }) })
        .catch(() => {})
      // Fetch assessor annotations (if any exist, show them in debrief)
      fetch(`${API}/sessions/${sessionId}/annotations-public`)
        .then(r => r.ok ? r.json() : [])
        .then(d => { if (Array.isArray(d)) setAnnotations(d as { id: string; text: string; created_at: string }[]) })
        .catch(() => {})
    } catch { /* silent */ } finally {
      setScorecardLoading(false)
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  }

  function scoreColor(score: number | null) {
    if (score == null) return '#484f58'
    if (score >= 70) return '#3fb950'
    if (score >= 50) return '#d29922'
    return '#f85149'
  }

  return (
    <div className="min-h-screen bg-[#0d1117] font-mono text-xs text-[#e6edf3] p-4">
      {/* Header */}
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="text-[#484f58] hover:text-[#e6edf3] transition-colors text-sm">← Back</button>
          <h1 className="text-[#3fb950] font-bold text-base tracking-tight">Candidate Portal</h1>
        </div>

        {/* Search */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
          <div className="text-[#8b949e] text-[11px] mb-3">Enter your name to view your simulation history and results.</div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name (as registered)"
              className="flex-1 bg-[#0d1117] border border-[#30363d] text-[#e6edf3] px-3 py-2 rounded focus:outline-none focus:border-[#58a6ff] font-mono text-xs"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 text-white font-bold rounded transition-colors text-xs"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </form>
          {error && <div className="mt-2 text-[#f85149] text-[11px]">{error}</div>}
        </div>

        {/* Results */}
        {searched && (
          <div>
            {sessions.length === 0 ? (
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center text-[#484f58]">
                No sessions found for "{name}". Check your name spelling or ask your assessor.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-1">
                  {sessions.length} session{sessions.length !== 1 ? 's' : ''} found for "{name}"
                </div>
                {sessions.map(s => (
                  <div key={s.id} className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
                    {/* Session row */}
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-[#e6edf3] font-bold text-[13px] truncate">{s.scenario_name}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[#484f58] text-[10px]">{fmtDate(s.started_at)}</span>
                          <span className="text-[#30363d]">·</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{
                            color: s.status === 'completed' ? '#3fb950' : '#d29922',
                            borderColor: s.status === 'completed' ? '#3fb95040' : '#d2992240',
                            background: s.status === 'completed' ? '#0f2a1a' : '#2a1e00',
                          }}>
                            {s.status}
                          </span>
                          <span className="text-[10px] text-[#484f58] bg-[#21262d] px-1.5 py-0.5 rounded">
                            {s.module_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: scoreColor(s.overall_score) }}>
                            {s.overall_score ?? '—'}
                          </div>
                          <div className="text-[9px] text-[#484f58]">/ 100</div>
                        </div>
                        {s.overall_score != null && (
                          <button
                            onClick={() => handleViewScorecard(s.id)}
                            className={`px-3 py-1.5 rounded border text-[10px] font-bold transition-colors ${expandedId === s.id ? 'bg-[#58a6ff]/20 border-[#58a6ff]/60 text-[#58a6ff]' : 'bg-[#21262d] border-[#30363d] text-[#8b949e] hover:text-[#e6edf3]'}`}
                          >
                            {expandedId === s.id ? 'Hide' : 'View Debrief'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded scorecard */}
                    {expandedId === s.id && (
                      <div className="border-t border-[#30363d] bg-[#0d1117] px-5 py-4">
                        {scorecardLoading ? (
                          <div className="text-[#484f58] text-center py-4">Loading results…</div>
                        ) : scorecard ? (
                          <div className="space-y-4">
                            {/* AI feedback */}
                            {typeof scorecard.postmortem === 'string' && scorecard.postmortem ? (
                              <div className="bg-[#161b22] border border-[#58a6ff]/20 rounded-lg p-4">
                                <div className="text-[#58a6ff] font-bold text-[10px] uppercase tracking-widest mb-2">🤖 AI Assessor Feedback</div>
                                <p className="text-[#c9d1d9] text-[11px] leading-relaxed">{scorecard.postmortem as string}</p>
                              </div>
                            ) : null}
                            {/* Dimension breakdown */}
                            {scorecard.dimensions != null && (() => {
                              const dims = Object.entries(scorecard.dimensions as Record<string, { score: number; notes?: string }>)
                              const n = dims.length
                              if (n === 0) return null

                              // SVG radar chart
                              const size = 180
                              const cx = size / 2, cy = size / 2, r = 70
                              const levels = [20, 40, 60, 80, 100]

                              function angleFor(i: number) { return (i / n) * 2 * Math.PI - Math.PI / 2 }
                              function pointAt(angle: number, radius: number) {
                                return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`
                              }

                              const spokePoints = dims.map((_, i) => ({ angle: angleFor(i), label: dims[i][0] }))
                              const dataPath = dims.map(([, d], i) => pointAt(angleFor(i), (d.score / 100) * r)).join(' ')

                              return (
                                <div>
                                  <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-3">Performance Breakdown</div>
                                  <div className="flex gap-4 items-start">
                                    {/* Radar chart */}
                                    <div className="flex-shrink-0">
                                      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                                        {/* Level rings */}
                                        {levels.map(pct => {
                                          const pts = dims.map((_, i) => pointAt(angleFor(i), (pct / 100) * r)).join(' ')
                                          return <polygon key={pct} points={pts} fill="none" stroke="#30363d" strokeWidth="0.5" />
                                        })}
                                        {/* Spokes */}
                                        {spokePoints.map(({ angle, label }, i) => (
                                          <g key={i}>
                                            <line x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)} stroke="#30363d" strokeWidth="0.5" />
                                            <text
                                              x={cx + (r + 14) * Math.cos(angle)}
                                              y={cy + (r + 14) * Math.sin(angle)}
                                              textAnchor="middle" dominantBaseline="middle"
                                              fontSize="8" fill="#8b949e"
                                              style={{ fontFamily: 'monospace' }}
                                            >
                                              {label.replace(/_/g, ' ').split(' ').map((w: string) => w[0]?.toUpperCase() + w.slice(1)).join(' ')}
                                            </text>
                                          </g>
                                        ))}
                                        {/* Data polygon */}
                                        <polygon points={dataPath} fill="#3fb950" fillOpacity="0.15" stroke="#3fb950" strokeWidth="1.5" />
                                        {/* Data points */}
                                        {dims.map(([, d], i) => (
                                          <circle key={i} cx={cx + (d.score / 100) * r * Math.cos(angleFor(i))} cy={cy + (d.score / 100) * r * Math.sin(angleFor(i))} r="3" fill="#3fb950" />
                                        ))}
                                      </svg>
                                    </div>
                                    {/* Dimension cards */}
                                    <div className="flex-1 grid grid-cols-1 gap-2">
                                      {dims.map(([key, dim]) => (
                                        <div key={key} className="bg-[#161b22] border border-[#30363d] rounded-lg p-2.5">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[#8b949e] text-[10px] capitalize">{key.replace(/_/g, ' ')}</span>
                                            <span className="font-bold text-[11px]" style={{ color: scoreColor(dim.score) }}>{dim.score}/100</span>
                                          </div>
                                          <div className="h-1 bg-[#21262d] rounded overflow-hidden">
                                            <div className="h-full rounded" style={{ width: `${dim.score}%`, background: scoreColor(dim.score) }} />
                                          </div>
                                          {dim.notes && <p className="text-[#484f58] text-[10px] mt-1 leading-relaxed">{dim.notes}</p>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                            {/* Pass/fail badge */}
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${(scorecard.overall_score as number) >= 70 ? 'bg-[#3fb950]/20 text-[#3fb950] border-[#3fb950]/40' : 'bg-[#f85149]/20 text-[#f85149] border-[#f85149]/40'}`}>
                                {(scorecard.overall_score as number) >= 70 ? '✓ PASS' : '✗ FAIL'} — passing score: 70
                              </span>
                              {(scorecard.duration_minutes as number) > 0 && (
                                <span className="px-3 py-1 rounded-full text-[11px] bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                                  ⏱ {scorecard.duration_minutes as number} min
                                </span>
                              )}
                            </div>
                            {/* Benchmark comparison */}
                            {benchmark && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1 rounded-full text-[11px] bg-[#0d2a40] text-[#58a6ff] border border-[#58a6ff]/40">
                                  📊 Top {100 - benchmark.percentile}% — scored higher than {benchmark.percentile}% of candidates
                                </span>
                                <span className="px-3 py-1 rounded-full text-[11px] bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                                  Avg: {benchmark.avg_score}/100 across {benchmark.total_attempts} attempts
                                </span>
                              </div>
                            )}
                            {/* Assessor annotations */}
                            {annotations.length > 0 && (
                              <div className="bg-[#1a1600] border border-[#d29922]/30 rounded-lg p-4">
                                <div className="text-[#d29922] font-bold text-[10px] uppercase tracking-widest mb-2">📝 Assessor Notes</div>
                                <div className="space-y-2">
                                  {annotations.map(a => (
                                    <p key={a.id} className="text-[#c9d1d9] text-[11px] leading-relaxed">{a.text}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[#484f58] text-center py-2">No detailed scorecard available.</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
