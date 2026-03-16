import { useState, useEffect } from 'react'

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')

const SCENARIOS = [
  { id: 'cache-db-cascade', name: 'Redis Cache → DB Cascade', difficulty: 'SENIOR', timeLimit: 10 },
  { id: 'db-slow-queries', name: 'Database Slow Queries — Connection Pool Exhaustion', difficulty: 'SENIOR', timeLimit: 10 },
  { id: 'spanner-high-utilization', name: 'Cloud Spanner Node CPU Spike — Hot Key Hotspot', difficulty: 'SENIOR', timeLimit: 10 },
  { id: 'pod-crashloop', name: 'checkout-service Pods in CrashLoopBackOff', difficulty: 'SENIOR', timeLimit: 10 },
]

interface Assignment {
  id: string
  candidate_name: string
  scenario_id: string
  module_type: 'incident' | 'sql' | 'monitoring'
  question_id: string | null
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
  dimensions: Record<string, { score: number; max: number }>
  timeline_highlights: string[]
  postmortem: string
}

interface SQLQuestion {
  id: string
  title: string
  difficulty: string
  question_type: string
  time_limit_seconds: number
  created_at: string
}

interface MonitoringQuestion {
  id: string
  title: string
  difficulty: string
  time_limit_seconds: number
  created_at: string
}

interface AdminProps {
  onBack: () => void
}

type Tab = 'assign' | 'sql' | 'monitoring' | 'results'

export default function Admin({ onBack }: AdminProps) {
  const [adminKey, setAdminKey] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<Tab>('assign')

  // Assign tab
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [candidateName, setCandidateName] = useState('')
  const [moduleType, setModuleType] = useState<'incident' | 'sql' | 'monitoring'>('incident')
  const [scenarioId, setScenarioId] = useState('cache-db-cascade')
  const [selectedQuestionId, setSelectedQuestionId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  // Results tab
  const [sessions, setSessions] = useState<Session[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [scorecardCache, setScorecardCache] = useState<Record<string, Scorecard>>({})

  // SQL tab
  const [sqlQuestions, setSqlQuestions] = useState<SQLQuestion[]>([])
  const [sqlForm, setSqlForm] = useState({ title: '', description: '', difficulty: 'medium', question_type: 'write', starter_query: '', expected_output: '{}', schema_hint: '', hint: '', time_limit_seconds: '300' })
  const [sqlFormError, setSqlFormError] = useState('')
  const [sqlFormSuccess, setSqlFormSuccess] = useState('')

  // Monitoring tab
  const [monitoringQuestions, setMonitoringQuestions] = useState<MonitoringQuestion[]>([])
  const [monForm, setMonForm] = useState({ title: '', scenario: '', difficulty: 'medium', sub_questions: '', time_limit_seconds: '600' })
  const [monFormError, setMonFormError] = useState('')
  const [monFormSuccess, setMonFormSuccess] = useState('')

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    try {
      const res = await fetch(`${API_BASE}/admin/assignments`, { headers: { 'x-admin-key': adminKey } })
      if (res.status === 401) { setAuthError('Invalid admin key'); return }
      setAssignments(await res.json() as Assignment[])
      setAuthed(true)
    } catch { setAuthError('Could not reach backend') }
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

  async function loadSqlQuestions() {
    try {
      const res = await fetch(`${API_BASE}/sql/admin/questions`, { headers: { 'x-admin-key': adminKey } })
      if (res.ok) setSqlQuestions(await res.json() as SQLQuestion[])
    } catch { /* ignore */ }
  }

  async function loadMonitoringQuestions() {
    try {
      const res = await fetch(`${API_BASE}/monitoring/admin/questions`, { headers: { 'x-admin-key': adminKey } })
      if (res.ok) setMonitoringQuestions(await res.json() as MonitoringQuestion[])
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!authed) return
    loadAssignments(); loadSessions(); loadSqlQuestions(); loadMonitoringQuestions()
    const iv = setInterval(() => { loadAssignments(); loadSessions() }, 15_000)
    return () => clearInterval(iv)
  }, [authed])

  async function loadScorecard(sessionId: string) {
    if (scorecardCache[sessionId]) { setExpandedSession(expandedSession === sessionId ? null : sessionId); return }
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
    if ((moduleType === 'sql' || moduleType === 'monitoring') && !selectedQuestionId) {
      setCreateError('Select a question for this module'); return
    }
    setCreating(true); setCreateError(''); setCreateSuccess('')
    try {
      const body: Record<string, string> = { candidate_name: candidateName.trim(), module_type: moduleType }
      if (moduleType === 'incident') body.scenario_id = scenarioId
      if (moduleType === 'sql' || moduleType === 'monitoring') body.question_id = selectedQuestionId
      const res = await fetch(`${API_BASE}/admin/assignments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        setCreateError(((await res.json()) as { error: string }).error)
      } else {
        setCandidateName(''); setSelectedQuestionId('')
        const modLabel = moduleType === 'incident' ? SCENARIOS.find(s => s.id === scenarioId)?.name
          : moduleType === 'sql' ? sqlQuestions.find(q => q.id === selectedQuestionId)?.title
          : monitoringQuestions.find(q => q.id === selectedQuestionId)?.title
        setCreateSuccess(`✓ Assigned "${candidateName.trim()}" → ${modLabel ?? moduleType}`)
        await loadAssignments()
      }
    } catch (err) { setCreateError(String(err)) }
    finally { setCreating(false) }
  }

  async function handleDeleteAssignment(id: string) {
    try {
      await fetch(`${API_BASE}/admin/assignments/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } })
      await loadAssignments()
    } catch { /* ignore */ }
  }

  async function handleCreateSqlQuestion(e: React.FormEvent) {
    e.preventDefault()
    setSqlFormError(''); setSqlFormSuccess('')
    let expectedOutput: unknown = {}
    try { expectedOutput = JSON.parse(sqlForm.expected_output) } catch { setSqlFormError('Expected output must be valid JSON'); return }
    try {
      const res = await fetch(`${API_BASE}/sql/admin/questions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ ...sqlForm, time_limit_seconds: Number(sqlForm.time_limit_seconds), expected_output: expectedOutput })
      })
      if (!res.ok) { setSqlFormError(((await res.json()) as { error: string }).error); return }
      setSqlFormSuccess('✓ SQL question created')
      setSqlForm({ title: '', description: '', difficulty: 'medium', question_type: 'write', starter_query: '', expected_output: '{}', schema_hint: '', hint: '', time_limit_seconds: '300' })
      await loadSqlQuestions()
    } catch (err) { setSqlFormError(String(err)) }
  }

  async function handleDeleteSqlQuestion(id: string) {
    await fetch(`${API_BASE}/sql/admin/questions/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } })
    await loadSqlQuestions()
  }

  async function handleCreateMonitoringQuestion(e: React.FormEvent) {
    e.preventDefault()
    setMonFormError(''); setMonFormSuccess('')
    let subQs: unknown = []
    try { subQs = JSON.parse(monForm.sub_questions) } catch { setMonFormError('Sub-questions must be valid JSON array'); return }
    try {
      const res = await fetch(`${API_BASE}/monitoring/admin/questions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ title: monForm.title, scenario: monForm.scenario, difficulty: monForm.difficulty, sub_questions: subQs, time_limit_seconds: Number(monForm.time_limit_seconds) })
      })
      if (!res.ok) { setMonFormError(((await res.json()) as { error: string }).error); return }
      setMonFormSuccess('✓ Monitoring question created')
      setMonForm({ title: '', scenario: '', difficulty: 'medium', sub_questions: '', time_limit_seconds: '600' })
      await loadMonitoringQuestions()
    } catch (err) { setMonFormError(String(err)) }
  }

  async function handleDeleteMonitoringQuestion(id: string) {
    await fetch(`${API_BASE}/monitoring/admin/questions/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } })
    await loadMonitoringQuestions()
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  }
  function scoreColor(score: number) {
    if (score >= 80) return 'text-[#3fb950]'
    if (score >= 50) return 'text-[#d29922]'
    return 'text-[#f85149]'
  }
  function ratingLabel(score: number) {
    return score >= 80 ? 'GOOD' : score >= 50 ? 'MANAGING' : 'LEARNING'
  }
  function moduleLabel(mt: string) {
    if (mt === 'sql') return 'SQL'
    if (mt === 'monitoring') return 'MONITORING'
    return 'INCIDENT'
  }

  const inputCls = "w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors"
  const labelCls = "block text-[#8b949e] mb-1.5"

  return (
    <div className="min-h-screen bg-[#0d1117] font-mono text-xs px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="text-[#58a6ff] hover:text-[#79c0ff] transition-colors">← Back</button>
          <div>
            <h1 className="text-[#e6edf3] text-xl font-bold">Admin Panel</h1>
            <div className="text-[#8b949e] mt-0.5">Manage assignments, questions, and view results</div>
          </div>
        </div>

        {!authed ? (
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 max-w-sm mx-auto">
            <div className="text-[#8b949e] uppercase tracking-widest mb-4">Admin Authentication</div>
            <form onSubmit={handleAuth} className="space-y-4">
              <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} placeholder="Admin key" className={inputCls} autoFocus />
              {authError && <div className="text-[#f85149]">✗ {authError}</div>}
              <button type="submit" className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 rounded border border-[#2ea043] transition-colors">Sign In</button>
            </form>
            <div className="text-[#484f58] mt-3 text-center">
              Default key: <code className="text-[#8b949e]">sre-admin-2024</code>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Tabs */}
            <div className="flex border-b border-[#30363d] overflow-x-auto">
              {([
                ['assign', '📋 Assign'],
                ['sql', '🗄 SQL Questions'],
                ['monitoring', '📊 Monitoring Questions'],
                ['results', '🏆 Results'],
              ] as [Tab, string][]).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`px-5 py-2.5 text-xs whitespace-nowrap border-b-2 transition-colors ${tab === id ? 'border-[#3fb950] text-[#e6edf3]' : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── ASSIGN TAB ── */}
            {tab === 'assign' && (
              <div className="space-y-5">
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                  <div className="text-[#8b949e] uppercase tracking-widest mb-4">New Assignment</div>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                      <label className={labelCls}>Candidate Name</label>
                      <input type="text" value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="Exact name candidate will use to log in" className={inputCls} autoFocus />
                    </div>

                    <div>
                      <label className={labelCls}>Module Type</label>
                      <div className="flex gap-2 flex-wrap">
                        {(['incident', 'sql', 'monitoring'] as const).map(m => (
                          <button key={m} type="button" onClick={() => { setModuleType(m); setSelectedQuestionId('') }}
                            className={`px-4 py-1.5 rounded border text-xs font-bold transition-colors ${moduleType === m ? 'border-[#3fb950] text-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] text-[#8b949e] hover:border-[#484f58]'}`}>
                            {m === 'incident' ? 'Incident Simulation' : m === 'sql' ? 'SQL Readiness' : 'Monitoring Design'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {moduleType === 'incident' && (
                      <div>
                        <label className={labelCls}>Scenario</label>
                        <div className="space-y-2">
                          {SCENARIOS.map(s => (
                            <label key={s.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                              scenarioId === s.id ? 'border-[#3fb950] bg-[#0d1117]'
                              : 'border-[#30363d] hover:border-[#484f58]'}`}>
                              <input type="radio" name="scenario" value={s.id} checked={scenarioId === s.id} onChange={() => setScenarioId(s.id)} className="accent-[#3fb950]" />
                              <span className="text-[#e6edf3] flex-1">{s.name}</span>
                              <span className="text-[#8b949e]">{s.timeLimit}min</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {moduleType === 'sql' && (
                      <div>
                        <label className={labelCls}>SQL Question</label>
                        {sqlQuestions.length === 0 ? (
                          <div className="text-[#484f58]">No SQL questions yet — create some in the SQL Questions tab</div>
                        ) : (
                          <div className="space-y-1.5">
                            {sqlQuestions.map(q => (
                              <label key={q.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedQuestionId === q.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`}>
                                <input type="radio" name="sql_question" value={q.id} checked={selectedQuestionId === q.id} onChange={() => setSelectedQuestionId(q.id)} className="accent-[#3fb950]" />
                                <span className="text-[#e6edf3] flex-1">{q.title}</span>
                                <span className="text-[#484f58] text-[10px] uppercase">{q.difficulty} · {q.question_type}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {moduleType === 'monitoring' && (
                      <div>
                        <label className={labelCls}>Monitoring Question</label>
                        {monitoringQuestions.length === 0 ? (
                          <div className="text-[#484f58]">No monitoring questions yet — create some in the Monitoring Questions tab</div>
                        ) : (
                          <div className="space-y-1.5">
                            {monitoringQuestions.map(q => (
                              <label key={q.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedQuestionId === q.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`}>
                                <input type="radio" name="mon_question" value={q.id} checked={selectedQuestionId === q.id} onChange={() => setSelectedQuestionId(q.id)} className="accent-[#3fb950]" />
                                <span className="text-[#e6edf3] flex-1">{q.title}</span>
                                <span className="text-[#484f58] text-[10px] uppercase">{q.difficulty}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {createError && <div className="text-[#f85149]">✗ {createError}</div>}
                    {createSuccess && <div className="text-[#3fb950]">{createSuccess}</div>}
                    <button type="submit" disabled={!candidateName.trim() || creating}
                      className="bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold py-2 px-6 rounded border border-[#2ea043] disabled:border-[#30363d] transition-all">
                      {creating ? 'Assigning…' : '+ Assign'}
                    </button>
                  </form>
                </div>

                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest">Assignments ({assignments.length})</div>
                  {assignments.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#484f58]">No assignments yet</div>
                  ) : (
                    <table className="w-full">
                      <thead><tr className="text-[#484f58] border-b border-[#30363d]">
                        <th className="text-left px-4 py-2">Candidate</th>
                        <th className="text-left px-4 py-2">Module</th>
                        <th className="text-left px-4 py-2">Created</th>
                        <th className="text-left px-4 py-2">Status</th>
                        <th className="px-4 py-2"></th>
                      </tr></thead>
                      <tbody>
                        {assignments.map(a => (
                          <tr key={a.id} className="border-b border-[#30363d] last:border-0 hover:bg-[#1c2128] transition-colors">
                            <td className="px-4 py-2.5 text-[#e6edf3] font-bold">{a.candidate_name}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${a.module_type === 'sql' ? 'border-[#58a6ff] text-[#58a6ff]' : a.module_type === 'monitoring' ? 'border-[#bc8cff] text-[#bc8cff]' : 'border-[#d29922] text-[#d29922]'}`}>
                                {moduleLabel(a.module_type ?? 'incident')}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[#484f58]">{fmt(a.created_at)}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${a.status === 'pending' ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#484f58] text-[#484f58]'}`}>
                                {a.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {a.status === 'pending' && (
                                <button onClick={() => handleDeleteAssignment(a.id)} className="text-[#484f58] hover:text-[#f85149] transition-colors" title="Delete">✕</button>
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

            {/* ── SQL QUESTIONS TAB ── */}
            {tab === 'sql' && (
              <div className="space-y-5">
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                  <div className="text-[#8b949e] uppercase tracking-widest mb-4">Create SQL Question</div>
                  <form onSubmit={handleCreateSqlQuestion} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Title</label>
                        <input value={sqlForm.title} onChange={e => setSqlForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Find employees by dept" className={inputCls} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Difficulty</label>
                          <select value={sqlForm.difficulty} onChange={e => setSqlForm(f => ({ ...f, difficulty: e.target.value }))} className={inputCls}>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Type</label>
                          <select value={sqlForm.question_type} onChange={e => setSqlForm(f => ({ ...f, question_type: e.target.value }))} className={inputCls}>
                            <option value="write">Write</option>
                            <option value="fix">Fix</option>
                            <option value="identify">Identify</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Description</label>
                      <textarea value={sqlForm.description} onChange={e => setSqlForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="What should the candidate do?" className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                      <label className={labelCls}>Starter Query (optional)</label>
                      <textarea value={sqlForm.starter_query} onChange={e => setSqlForm(f => ({ ...f, starter_query: e.target.value }))} rows={3} placeholder="SELECT ..." className={inputCls + ' resize-none font-mono text-[11px]'} />
                    </div>
                    <div>
                      <label className={labelCls}>Expected Output (JSON)</label>
                      <div className="text-[#484f58] text-[10px] mb-1">Format: {'{ "columns": ["col1"], "rows": [{"col1": "val"}] }'}</div>
                      <textarea value={sqlForm.expected_output} onChange={e => setSqlForm(f => ({ ...f, expected_output: e.target.value }))} rows={3} className={inputCls + ' resize-none font-mono text-[11px]'} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Schema Hint</label>
                        <textarea value={sqlForm.schema_hint} onChange={e => setSqlForm(f => ({ ...f, schema_hint: e.target.value }))} rows={3} placeholder="Table definitions..." className={inputCls + ' resize-none font-mono text-[11px]'} />
                      </div>
                      <div>
                        <label className={labelCls}>Hint (shown on request)</label>
                        <textarea value={sqlForm.hint} onChange={e => setSqlForm(f => ({ ...f, hint: e.target.value }))} rows={3} placeholder="Optional hint..." className={inputCls + ' resize-none'} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <label className={labelCls}>Time Limit (seconds)</label>
                        <input type="number" value={sqlForm.time_limit_seconds} onChange={e => setSqlForm(f => ({ ...f, time_limit_seconds: e.target.value }))} className={inputCls + ' w-32'} />
                      </div>
                    </div>
                    {sqlFormError && <div className="text-[#f85149]">✗ {sqlFormError}</div>}
                    {sqlFormSuccess && <div className="text-[#3fb950]">{sqlFormSuccess}</div>}
                    <button type="submit" className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all">
                      + Create SQL Question
                    </button>
                  </form>
                </div>

                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest">Questions ({sqlQuestions.length})</div>
                  {sqlQuestions.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#484f58]">No SQL questions yet. Run <code className="text-[#8b949e]">npm run db:seed-questions</code> on the backend to seed examples.</div>
                  ) : (
                    <table className="w-full">
                      <thead><tr className="text-[#484f58] border-b border-[#30363d]">
                        <th className="text-left px-4 py-2">Title</th>
                        <th className="text-left px-4 py-2">Difficulty</th>
                        <th className="text-left px-4 py-2">Type</th>
                        <th className="text-left px-4 py-2">Time</th>
                        <th className="px-4 py-2"></th>
                      </tr></thead>
                      <tbody>
                        {sqlQuestions.map(q => (
                          <tr key={q.id} className="border-b border-[#30363d] last:border-0 hover:bg-[#1c2128]">
                            <td className="px-4 py-2.5 text-[#e6edf3]">{q.title}</td>
                            <td className="px-4 py-2.5 text-[#8b949e] uppercase text-[10px]">{q.difficulty}</td>
                            <td className="px-4 py-2.5 text-[#8b949e] uppercase text-[10px]">{q.question_type}</td>
                            <td className="px-4 py-2.5 text-[#484f58]">{Math.round(q.time_limit_seconds / 60)}min</td>
                            <td className="px-4 py-2.5 text-right">
                              <button onClick={() => handleDeleteSqlQuestion(q.id)} className="text-[#484f58] hover:text-[#f85149] transition-colors">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── MONITORING QUESTIONS TAB ── */}
            {tab === 'monitoring' && (
              <div className="space-y-5">
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                  <div className="text-[#8b949e] uppercase tracking-widest mb-4">Create Monitoring Question</div>
                  <form onSubmit={handleCreateMonitoringQuestion} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Title</label>
                        <input value={monForm.title} onChange={e => setMonForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Redis Cache Alerting Setup" className={inputCls} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Difficulty</label>
                          <select value={monForm.difficulty} onChange={e => setMonForm(f => ({ ...f, difficulty: e.target.value }))} className={inputCls}>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Time Limit (sec)</label>
                          <input type="number" value={monForm.time_limit_seconds} onChange={e => setMonForm(f => ({ ...f, time_limit_seconds: e.target.value }))} className={inputCls} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Scenario Description</label>
                      <textarea value={monForm.scenario} onChange={e => setMonForm(f => ({ ...f, scenario: e.target.value }))} rows={4} placeholder="Describe the system context..." className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                      <label className={labelCls}>Sub-Questions (JSON array)</label>
                      <div className="text-[#484f58] text-[10px] mb-1.5">
                        {'[{ "id": "q1", "prompt": "...", "type": "promql|nrql|text|yaml", "placeholder": "...", "required_keywords": [], "bonus_keywords": [], "reference_answer": "..." }]'}
                      </div>
                      <textarea value={monForm.sub_questions} onChange={e => setMonForm(f => ({ ...f, sub_questions: e.target.value }))} rows={8}
                        placeholder={'[\n  {\n    "id": "q1",\n    "prompt": "Write a PromQL alert for high error rate",\n    "type": "promql",\n    "placeholder": "rate(http_errors_total[5m])",\n    "required_keywords": ["rate", "5m"],\n    "bonus_keywords": ["by (service)"],\n    "reference_answer": "rate(http_errors_total[5m]) > 0.05"\n  }\n]'}
                        className={inputCls + ' resize-none font-mono text-[11px]'} />
                    </div>
                    {monFormError && <div className="text-[#f85149]">✗ {monFormError}</div>}
                    {monFormSuccess && <div className="text-[#3fb950]">{monFormSuccess}</div>}
                    <button type="submit" className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all">
                      + Create Monitoring Question
                    </button>
                  </form>
                </div>

                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest">Questions ({monitoringQuestions.length})</div>
                  {monitoringQuestions.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#484f58]">No monitoring questions yet. Run <code className="text-[#8b949e]">npm run db:seed-questions</code> on the backend to seed examples.</div>
                  ) : (
                    <table className="w-full">
                      <thead><tr className="text-[#484f58] border-b border-[#30363d]">
                        <th className="text-left px-4 py-2">Title</th>
                        <th className="text-left px-4 py-2">Difficulty</th>
                        <th className="text-left px-4 py-2">Time</th>
                        <th className="px-4 py-2"></th>
                      </tr></thead>
                      <tbody>
                        {monitoringQuestions.map(q => (
                          <tr key={q.id} className="border-b border-[#30363d] last:border-0 hover:bg-[#1c2128]">
                            <td className="px-4 py-2.5 text-[#e6edf3]">{q.title}</td>
                            <td className="px-4 py-2.5 text-[#8b949e] uppercase text-[10px]">{q.difficulty}</td>
                            <td className="px-4 py-2.5 text-[#484f58]">{Math.round(q.time_limit_seconds / 60)}min</td>
                            <td className="px-4 py-2.5 text-right">
                              <button onClick={() => handleDeleteMonitoringQuestion(q.id)} className="text-[#484f58] hover:text-[#f85149] transition-colors">✕</button>
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
                  <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-12 text-center text-[#484f58]">No completed sessions yet</div>
                ) : sessions.map(session => {
                  const sc = scorecardCache[session.id]
                  const isExpanded = expandedSession === session.id
                  const score = session.overall_score
                  const rating = score !== null ? ratingLabel(score) : null
                  return (
                    <div key={session.id} className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#1c2128] transition-colors" onClick={() => loadScorecard(session.id)}>
                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                          score === null ? 'border-[#30363d] text-[#484f58]'
                          : score >= 80 ? 'border-[#3fb950] text-[#3fb950]'
                          : score >= 50 ? 'border-[#d29922] text-[#d29922]'
                          : 'border-[#f85149] text-[#f85149]'
                        }`}>{score ?? '—'}</div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[#e6edf3] font-bold">{session.candidate_name}</span>
                            {rating && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${score! >= 80 ? 'border-[#3fb950] text-[#3fb950]' : score! >= 50 ? 'border-[#d29922] text-[#d29922]' : 'border-[#f85149] text-[#f85149]'}`}>
                                {rating}
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${session.status === 'active' ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#30363d] text-[#484f58]'}`}>
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
                          <div>
                            <div className="text-[#8b949e] uppercase tracking-widest mb-2">Score Breakdown</div>
                            <div className="space-y-2">
                              {Object.entries(sc.dimensions).map(([key, dim]) => {
                                const pct = Math.round((dim.score / dim.max) * 100)
                                const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                                return (
                                  <div key={key}>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-[#8b949e]">{label}</span>
                                      <span className={scoreColor(pct)}>{dim.score}/{dim.max}</span>
                                    </div>
                                    <div className="h-1.5 bg-[#161b22] rounded overflow-hidden">
                                      <div className={`h-full rounded ${pct >= 80 ? 'bg-[#3fb950]' : pct >= 50 ? 'bg-[#d29922]' : 'bg-[#f85149]'}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {sc.timeline_highlights?.length > 0 && (
                            <div>
                              <div className="text-[#8b949e] uppercase tracking-widest mb-2">Highlights</div>
                              <div className="space-y-1">
                                {sc.timeline_highlights.map((h, i) => (
                                  <div key={i} className="flex gap-2"><span className="text-[#3fb950]">✓</span><span className="text-[#e6edf3]">{h}</span></div>
                                ))}
                              </div>
                            </div>
                          )}

                          {sc.postmortem && (
                            <div>
                              <div className="text-[#8b949e] uppercase tracking-widest mb-2">Summary</div>
                              <div className="text-[#e6edf3] leading-relaxed bg-[#161b22] rounded p-3 border border-[#30363d]">{sc.postmortem}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {isExpanded && !sc && session.status !== 'active' && (
                        <div className="border-t border-[#30363d] px-4 py-4 bg-[#0d1117] text-[#484f58] text-center">No scorecard available yet</div>
                      )}
                      {isExpanded && session.status === 'active' && (
                        <div className="border-t border-[#30363d] px-4 py-4 bg-[#0d1117] text-[#3fb950] text-center">● Session in progress…</div>
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
