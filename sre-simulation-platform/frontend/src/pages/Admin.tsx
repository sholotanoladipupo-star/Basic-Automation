import { useState, useEffect } from 'react'

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')

const SCENARIOS = [
  { id: 'cache-db-cascade', name: 'Redis Cache → DB Cascade', difficulty: 'SENIOR', timeLimit: 10 },
  { id: 'network-partition', name: 'Network Partition & Split Brain', difficulty: 'STAFF', timeLimit: 15, disabled: true },
  { id: 'memory-leak', name: 'Gradual Memory Leak', difficulty: 'MID', timeLimit: 12, disabled: true },
  { id: 'deployment-rollout', name: 'Bad Deployment Rollout', difficulty: 'MID', timeLimit: 10, disabled: true },
]

interface Assignment {
  id: string
  candidate_name: string
  scenario_id: string
  created_at: string
  used_at: string | null
  status: 'pending' | 'used'
}

interface Session {
  id: string
  candidate_name: string
  scenario_name: string | null
  scenario_id: string
  started_at: string
  ended_at: string | null
  overall_score: number | null
  status: string
}

interface Scorecard {
  overall_score: number
  dimensions: {
    incident_coordination: { score: number; max: number }
    incident_resolution: { score: number; max: number }
    technical_depth: { score: number; max: number }
    observability_usage: { score: number; max: number }
  }
  timeline_highlights: string[]
  postmortem: string
}

interface AdminProps {
  onBack: () => void
}

type Tab = 'assign' | 'results'

export default function Admin({ onBack }: AdminProps) {
  const [adminKey, setAdminKey] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<Tab>('assign')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [scorecardCache, setScorecardCache] = useState<Record<string, Scorecard>>({})
  const [candidateName, setCandidateName] = useState('')
  const [scenarioId, setScenarioId] = useState('cache-db-cascade')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    try {
      const res = await fetch(`${API_BASE}/admin/assignments`, {
        headers: { 'x-admin-key': adminKey }
      })
      if (res.status === 401) { setAuthError('Invalid admin key'); return }
      setAssignments(await res.json() as Assignment[])
      setAuthed(true)
    } catch {
      setAuthError('Could not reach backend')
    }
  }

  async function loadAssignments() {
    try {
      const res = await fetch(`${API_BASE}/admin/assignments`, { headers: { 'x-admin-key': adminKey } })
      setAssignments(await res.json() as Assignment[])
    } catch { /* ignore */ }
  }

  async function loadSessions() {
    try {
      const res = await fetch(`${API_BASE}/sessions`)
      setSessions(await res.json() as Session[])
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!authed) return
    loadSessions()
    const interval = setInterval(() => { loadAssignments(); loadSessions() }, 15_000)
    return () => clearInterval(interval)
  }, [authed])

  async function loadScorecard(sessionId: string) {
    if (scorecardCache[sessionId]) {
      setExpandedSession(expandedSession === sessionId ? null : sessionId)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/scorecard`)
      if (res.ok) {
        const sc = await res.json() as Scorecard
        setScorecardCache(c => ({ ...c, [sessionId]: sc }))
      }
    } catch { /* ignore */ }
    setExpandedSession(expandedSession === sessionId ? null : sessionId)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!candidateName.trim()) return
    setCreating(true); setCreateError(''); setCreateSuccess('')
    try {
      const res = await fetch(`${API_BASE}/admin/assignments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ candidate_name: candidateName.trim(), scenario_id: scenarioId })
      })
      if (!res.ok) {
        setCreateError(((await res.json()) as { error: string }).error)
      } else {
        setCandidateName('')
        setCreateSuccess(`✓ Assigned "${candidateName.trim()}" to ${SCENARIOS.find(s => s.id === scenarioId)?.name}`)
        await loadAssignments()
      }
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`${API_BASE}/admin/assignments/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } })
      await loadAssignments()
    } catch { /* ignore */ }
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  }

  function scoreColor(score: number) {
    if (score >= 65) return 'text-[#3fb950]'
    if (score >= 45) return 'text-[#d29922]'
    return 'text-[#f85149]'
  }

  return (
    <div className="min-h-screen bg-[#0d1117] font-mono text-xs px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="text-[#58a6ff] hover:text-[#79c0ff] transition-colors">← Back</button>
          <div>
            <h1 className="text-[#e6edf3] text-xl font-bold">Admin Panel</h1>
            <div className="text-[#8b949e] mt-0.5">Manage assignments and view candidate results</div>
          </div>
        </div>

        {!authed ? (
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 max-w-sm mx-auto">
            <div className="text-[#8b949e] uppercase tracking-widest mb-4">Admin Authentication</div>
            <form onSubmit={handleAuth} className="space-y-4">
              <input
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                placeholder="Admin key"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#3fb950] transition-colors"
                autoFocus
              />
              {authError && <div className="text-[#f85149]">✗ {authError}</div>}
              <button type="submit" className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 rounded border border-[#2ea043] transition-colors">
                Sign In
              </button>
            </form>
            <div className="text-[#484f58] mt-3 text-center">
              Default key: <code className="text-[#8b949e]">sre-admin-2024</code><br />
              Set <code>ADMIN_KEY</code> env var to change
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Tabs */}
            <div className="flex border-b border-[#30363d]">
              {([['assign', '📋 Assignments'], ['results', '🏆 Results']] as [Tab, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`px-5 py-2.5 text-xs border-b-2 transition-colors ${tab === id ? 'border-[#3fb950] text-[#e6edf3]' : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── ASSIGNMENTS TAB ── */}
            {tab === 'assign' && (
              <div className="space-y-5">
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                  <div className="text-[#8b949e] uppercase tracking-widest mb-4">New Assignment</div>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                      <label className="block text-[#8b949e] mb-1.5">Candidate Name</label>
                      <input
                        type="text"
                        value={candidateName}
                        onChange={e => setCandidateName(e.target.value)}
                        placeholder="Exact name candidate will use to log in"
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#3fb950] transition-colors"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[#8b949e] mb-1.5">Scenario</label>
                      <div className="space-y-2">
                        {SCENARIOS.map(s => (
                          <label key={s.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                            s.disabled ? 'opacity-40 cursor-not-allowed border-[#30363d]'
                            : scenarioId === s.id ? 'border-[#3fb950] bg-[#0d1117]'
                            : 'border-[#30363d] hover:border-[#484f58]'}`}>
                            <input type="radio" name="scenario" value={s.id} checked={scenarioId === s.id} onChange={() => !s.disabled && setScenarioId(s.id)} disabled={s.disabled} className="accent-[#3fb950]" />
                            <span className="text-[#e6edf3] flex-1">{s.name}</span>
                            <span className="text-[#8b949e]">{s.timeLimit}min</span>
                            {s.disabled && <span className="text-[#484f58] text-[10px]">COMING SOON</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                    {createError && <div className="text-[#f85149]">✗ {createError}</div>}
                    {createSuccess && <div className="text-[#3fb950]">{createSuccess}</div>}
                    <button type="submit" disabled={!candidateName.trim() || creating}
                      className="bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold py-2 px-6 rounded border border-[#2ea043] disabled:border-[#30363d] transition-all">
                      {creating ? 'Assigning...' : '+ Assign Scenario'}
                    </button>
                  </form>
                </div>

                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest">
                    Assignments ({assignments.length})
                  </div>
                  {assignments.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#484f58]">No assignments yet</div>
                  ) : (
                    <table className="w-full">
                      <thead><tr className="text-[#484f58] border-b border-[#30363d]">
                        <th className="text-left px-4 py-2">Candidate</th>
                        <th className="text-left px-4 py-2">Scenario</th>
                        <th className="text-left px-4 py-2">Created</th>
                        <th className="text-left px-4 py-2">Status</th>
                        <th className="px-4 py-2"></th>
                      </tr></thead>
                      <tbody>
                        {assignments.map(a => (
                          <tr key={a.id} className="border-b border-[#30363d] last:border-0 hover:bg-[#1c2128] transition-colors">
                            <td className="px-4 py-2.5 text-[#e6edf3] font-bold">{a.candidate_name}</td>
                            <td className="px-4 py-2.5 text-[#8b949e]">{SCENARIOS.find(s => s.id === a.scenario_id)?.name ?? a.scenario_id}</td>
                            <td className="px-4 py-2.5 text-[#484f58]">{fmt(a.created_at)}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${a.status === 'pending' ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#484f58] text-[#484f58]'}`}>
                                {a.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {a.status === 'pending' && (
                                <button onClick={() => handleDelete(a.id)} className="text-[#484f58] hover:text-[#f85149] transition-colors" title="Delete">✕</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── RESULTS TAB ── */}
            {tab === 'results' && (
              <div className="space-y-3">
                {sessions.length === 0 ? (
                  <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-12 text-center text-[#484f58]">
                    No completed sessions yet
                  </div>
                ) : sessions.map(session => {
                  const sc = scorecardCache[session.id]
                  const isExpanded = expandedSession === session.id
                  const score = session.overall_score
                  const passed = score !== null && score >= 65
                  return (
                    <div key={session.id} className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#1c2128] transition-colors"
                        onClick={() => loadScorecard(session.id)}
                      >
                        {/* Score ring */}
                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                          score === null ? 'border-[#30363d] text-[#484f58]'
                          : passed ? 'border-[#3fb950] text-[#3fb950]'
                          : 'border-[#f85149] text-[#f85149]'
                        }`}>
                          {score ?? '—'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[#e6edf3] font-bold">{session.candidate_name}</span>
                            {score !== null && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${passed ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#f85149] text-[#f85149]'}`}>
                                {passed ? 'PASS' : 'FAIL'}
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              session.status === 'active' ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#30363d] text-[#484f58]'
                            }`}>
                              {session.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-[#8b949e] mt-0.5">{session.scenario_name ?? session.scenario_id}</div>
                        </div>

                        <div className="text-right text-[#484f58] flex-shrink-0">
                          <div>{fmt(session.started_at)}</div>
                          {session.ended_at && <div className="mt-0.5">{fmt(session.ended_at)}</div>}
                        </div>
                        <span className="text-[#484f58] ml-1">{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {isExpanded && sc && (
                        <div className="border-t border-[#30363d] px-4 py-4 bg-[#0d1117] space-y-4">
                          {/* Dimension bars */}
                          <div>
                            <div className="text-[#8b949e] uppercase tracking-widest mb-2">Score Breakdown</div>
                            <div className="space-y-2">
                              {[
                                { label: 'Incident Coordination', key: 'incident_coordination', weight: '25%' },
                                { label: 'Incident Resolution', key: 'incident_resolution', weight: '35%' },
                                { label: 'Technical Depth', key: 'technical_depth', weight: '25%' },
                                { label: 'Observability Usage', key: 'observability_usage', weight: '15%' },
                              ].map(d => {
                                const dim = sc.dimensions[d.key as keyof typeof sc.dimensions]
                                const pct = dim ? Math.round((dim.score / dim.max) * 100) : 0
                                return (
                                  <div key={d.key}>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-[#8b949e]">{d.label} <span className="text-[#484f58]">({d.weight})</span></span>
                                      <span className={scoreColor(pct)}>{dim?.score ?? 0}/{dim?.max ?? 100}</span>
                                    </div>
                                    <div className="h-1.5 bg-[#161b22] rounded overflow-hidden">
                                      <div className={`h-full rounded ${pct >= 65 ? 'bg-[#3fb950]' : pct >= 40 ? 'bg-[#d29922]' : 'bg-[#f85149]'}`}
                                        style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {sc.timeline_highlights?.length > 0 && (
                            <div>
                              <div className="text-[#8b949e] uppercase tracking-widest mb-2">Timeline Highlights</div>
                              <div className="space-y-1">
                                {sc.timeline_highlights.map((h, i) => (
                                  <div key={i} className="flex gap-2"><span className="text-[#3fb950]">✓</span><span className="text-[#e6edf3]">{h}</span></div>
                                ))}
                              </div>
                            </div>
                          )}

                          {sc.postmortem && (
                            <div>
                              <div className="text-[#8b949e] uppercase tracking-widest mb-2">Postmortem</div>
                              <div className="text-[#e6edf3] leading-relaxed bg-[#161b22] rounded p-3 border border-[#30363d]">{sc.postmortem}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {isExpanded && !sc && session.status !== 'active' && (
                        <div className="border-t border-[#30363d] px-4 py-4 bg-[#0d1117] text-[#484f58] text-center">
                          No scorecard available yet
                        </div>
                      )}

                      {isExpanded && session.status === 'active' && (
                        <div className="border-t border-[#30363d] px-4 py-4 bg-[#0d1117] text-[#3fb950] text-center">
                          ● Session in progress…
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
