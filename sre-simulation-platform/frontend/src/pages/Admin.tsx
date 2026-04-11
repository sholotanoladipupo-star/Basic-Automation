import { useState, useEffect, useRef } from 'react'

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')

const SCENARIOS = [
  { id: 'cache-db-cascade',         name: 'Redis Cache → DB Cascade',                          difficulty: 'SENIOR', timeLimit: 10 },
  { id: 'db-slow-queries',          name: 'Database Slow Queries — Connection Pool Exhaustion', difficulty: 'SENIOR', timeLimit: 10 },
  { id: 'spanner-high-utilization', name: 'Cloud Spanner Node CPU Spike — Hot Key Hotspot',    difficulty: 'SENIOR', timeLimit: 10 },
  { id: 'pod-crashloop',            name: 'checkout-service Pods in CrashLoopBackOff',          difficulty: 'SENIOR', timeLimit: 10 },
  { id: 'db-replica-ip-change',     name: 'Database Connectivity Issues',                       difficulty: 'MID',    timeLimit: 10 },
  { id: 'missing-table',            name: 'Payment Processing Errors',                          difficulty: 'MID',    timeLimit: 10 },
  { id: 'kafka-consumer-lag',       name: 'Event Processing Degradation',                       difficulty: 'MID',    timeLimit: 10 },
  { id: 'config-key-missing',       name: 'Service Deployment Anomaly',                         difficulty: 'MID',    timeLimit: 10 },
  { id: 'pod-oom-killed',           name: 'Container Resource Pressure',                        difficulty: 'MID',    timeLimit: 10 },
  { id: 'network-policy-block',     name: 'Network Connectivity Anomaly',                       difficulty: 'MID',    timeLimit: 10 },
]

interface Assignment {
  id: string
  candidate_name: string
  scenario_id: string
  module_type: 'incident' | 'sql' | 'monitoring' | 'cognitive'
  question_id: string | null
  created_at: string
  used_at: string | null
  status: 'pending' | 'used'
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

interface SchemaColumn { name: string; type: string }
interface SchemaTable  { columns: SchemaColumn[]; sample_rows: Record<string, unknown>[] }
type SqlSchema = Record<string, SchemaTable>

interface QueryResult { columns: string[]; rows: Record<string, unknown>[]; error?: string; row_count?: number }

interface AdminProps { onBack: () => void }
type Tab = 'assign' | 'sql' | 'monitoring'
type FocusedField = 'starter_query' | 'solution_query' | 'schema_hint'

export default function Admin({ onBack }: AdminProps) {
  const [adminKey, setAdminKey] = useState('')
  const [authed, setAuthed]     = useState(false)
  const [authError, setAuthError] = useState('')
  const [tab, setTab]           = useState<Tab>('assign')

  // Assign tab
  const [assignments, setAssignments]           = useState<Assignment[]>([])
  const [candidateName, setCandidateName]       = useState('')
  const [moduleType, setModuleType]             = useState<'incident' | 'sql' | 'monitoring' | 'cognitive'>('incident')
  const [scenarioId, setScenarioId]             = useState('cache-db-cascade')
  const [selectedQuestionId, setSelectedQuestionId] = useState('')
  const [creating, setCreating]                 = useState(false)
  const [createError, setCreateError]           = useState('')
  const [createSuccess, setCreateSuccess]       = useState('')

  // SQL tab — form
  const [sqlQuestions, setSqlQuestions] = useState<SQLQuestion[]>([])
  const [sqlForm, setSqlForm] = useState({
    title: '', description: '', difficulty: 'medium', question_type: 'write',
    starter_query: '', solution_query: '', expected_output: '{}',
    schema_hint: '', hint: '', time_limit_seconds: '300',
  })
  const [sqlFormError, setSqlFormError]   = useState('')
  const [sqlFormSuccess, setSqlFormSuccess] = useState('')

  // SQL tab — schema browser
  const [sqlSchema, setSqlSchema]       = useState<SqlSchema>({})
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [expandedTable, setExpandedTable] = useState<string | null>('employees')
  const [previewTable, setPreviewTable]   = useState<string | null>(null)
  const [lastFocused, setLastFocused]     = useState<FocusedField>('solution_query')

  // SQL tab — live tester
  const [testResult, setTestResult] = useState<QueryResult | null>(null)
  const [testing, setTesting]       = useState(false)

  // textarea refs for click-to-insert
  const starterQueryRef  = useRef<HTMLTextAreaElement>(null)
  const solutionQueryRef = useRef<HTMLTextAreaElement>(null)
  const schemaHintRef    = useRef<HTMLTextAreaElement>(null)

  // Monitoring tab
  const [monitoringQuestions, setMonitoringQuestions] = useState<MonitoringQuestion[]>([])
  const [monForm, setMonForm] = useState({ title: '', scenario: '', difficulty: 'medium', sub_questions: '', time_limit_seconds: '600' })
  const [monFormError, setMonFormError]     = useState('')
  const [monFormSuccess, setMonFormSuccess] = useState('')

  // ── Loaders ──────────────────────────────────────────────────────────────
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

  async function loadSqlQuestions() {
    try {
      const res = await fetch(`${API_BASE}/sql/admin/questions`, { headers: { 'x-admin-key': adminKey } })
      if (res.ok) setSqlQuestions(await res.json() as SQLQuestion[])
    } catch { /* ignore */ }
  }

  async function loadSqlSchema() {
    if (Object.keys(sqlSchema).length > 0) return
    setSchemaLoading(true)
    try {
      const res = await fetch(`${API_BASE}/sql/schema`)
      if (res.ok) setSqlSchema(await res.json() as SqlSchema)
    } catch { /* ignore */ }
    finally { setSchemaLoading(false) }
  }

  async function loadMonitoringQuestions() {
    try {
      const res = await fetch(`${API_BASE}/monitoring/admin/questions`, { headers: { 'x-admin-key': adminKey } })
      if (res.ok) setMonitoringQuestions(await res.json() as MonitoringQuestion[])
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!authed) return
    loadAssignments(); loadSqlQuestions(); loadMonitoringQuestions()
    const iv = setInterval(() => { loadAssignments() }, 15_000)
    return () => clearInterval(iv)
  }, [authed])

  useEffect(() => {
    if (authed && tab === 'sql') loadSqlSchema()
  }, [authed, tab])

  // ── Insert at cursor ──────────────────────────────────────────────────────
  function insertAtFocused(text: string) {
    const refMap: Record<FocusedField, React.RefObject<HTMLTextAreaElement | null>> = {
      starter_query:  starterQueryRef,
      solution_query: solutionQueryRef,
      schema_hint:    schemaHintRef,
    }
    const ref = refMap[lastFocused]
    const el  = ref?.current
    if (!el) {
      setSqlForm(f => ({ ...f, [lastFocused]: (f[lastFocused as keyof typeof f] as string) + ' ' + text }))
      return
    }
    const start  = el.selectionStart ?? el.value.length
    const end    = el.selectionEnd   ?? el.value.length
    const newVal = el.value.slice(0, start) + text + el.value.slice(end)
    setSqlForm(f => ({ ...f, [lastFocused]: newVal }))
    setTimeout(() => {
      if (ref.current) {
        ref.current.selectionStart = ref.current.selectionEnd = start + text.length
        ref.current.focus()
      }
    }, 0)
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
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
          : moduleType === 'monitoring' ? monitoringQuestions.find(q => q.id === selectedQuestionId)?.title
          : 'Cognitive Test'
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

  async function handleTestQuery() {
    const q = sqlForm.solution_query.trim() || sqlForm.starter_query.trim()
    if (!q) return
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch(`${API_BASE}/sql/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q })
      })
      setTestResult(await res.json() as QueryResult)
    } catch (err) { setTestResult({ columns: [], rows: [], error: String(err) }) }
    finally { setTesting(false) }
  }

  function handleUseAsExpected() {
    if (!testResult || testResult.error) return
    const out = { columns: testResult.columns, rows: testResult.rows }
    setSqlForm(f => ({ ...f, expected_output: JSON.stringify(out, null, 2) }))
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
      setSqlForm({ title: '', description: '', difficulty: 'medium', question_type: 'write', starter_query: '', solution_query: '', expected_output: '{}', schema_hint: '', hint: '', time_limit_seconds: '300' })
      setTestResult(null)
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(iso: string) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  }
  function moduleLabel(mt: string) {
    if (mt === 'sql') return 'SQL'
    if (mt === 'monitoring') return 'MONITORING'
    if (mt === 'cognitive') return 'COGNITIVE'
    return 'INCIDENT'
  }
  function moduleBadgeClass(mt: string) {
    if (mt === 'sql') return 'border-[#58a6ff] text-[#58a6ff]'
    if (mt === 'monitoring') return 'border-[#bc8cff] text-[#bc8cff]'
    if (mt === 'cognitive') return 'border-[#e3b341] text-[#e3b341]'
    return 'border-[#f85149] text-[#f85149]'
  }
  function typeColor(t: string) {
    if (t.includes('int') || t.includes('numeric') || t.includes('float')) return '#58a6ff'
    if (t.includes('text') || t.includes('varchar') || t.includes('char')) return '#3fb950'
    if (t.includes('timestamp') || t.includes('date')) return '#d29922'
    if (t.includes('bool')) return '#f2cc60'
    return '#8b949e'
  }

  const inputCls = "w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors"
  const labelCls = "block text-[#8b949e] mb-1.5 text-xs"
  const focusProps = (field: FocusedField) => ({ onFocus: () => setLastFocused(field) })

  // ── Schema browser sidebar ─────────────────────────────────────────────────
  const TABLE_ORDER = ['departments', 'employees', 'projects', 'project_assignments', 'incidents']

  function SchemaBrowser() {
    return (
      <div className="w-56 flex-shrink-0 bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden flex flex-col self-start sticky top-0">
        <div className="px-3 py-2 border-b border-[#30363d] flex items-center justify-between">
          <div className="text-[#8b949e] uppercase tracking-widest text-[10px]">sql_sandbox schema</div>
          {schemaLoading && <div className="text-[#484f58] text-[10px] animate-pulse">loading…</div>}
        </div>

        <div className="text-[#484f58] text-[10px] px-3 py-1.5 border-b border-[#21262d]">
          Click a table or column to insert at cursor
        </div>

        <div className="overflow-y-auto flex-1">
          {TABLE_ORDER.map(tableName => {
            const tbl = sqlSchema[tableName]
            if (!tbl) return null
            const isExpanded = expandedTable === tableName
            const isPreview  = previewTable === tableName
            return (
              <div key={tableName} className="border-b border-[#21262d] last:border-0">
                {/* Table header */}
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedTable(isExpanded ? null : tableName)}
                    className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-[#161b22] transition-colors text-left"
                  >
                    <span className="text-[#484f58] text-[10px]">{isExpanded ? '▾' : '▸'}</span>
                    <span className="text-[#58a6ff] text-[11px] font-bold font-mono">{tableName}</span>
                    <span className="text-[#484f58] text-[9px] ml-auto">{tbl.columns.length} cols</span>
                  </button>
                  <button
                    onClick={() => insertAtFocused(tableName)}
                    title="Insert table name"
                    className="px-2 py-2 text-[#484f58] hover:text-[#3fb950] transition-colors text-[11px]"
                  >+</button>
                </div>

                {/* Columns */}
                {isExpanded && (
                  <div className="pb-1">
                    {tbl.columns.map(col => (
                      <button
                        key={col.name}
                        onClick={() => insertAtFocused(col.name)}
                        className="w-full flex items-center gap-2 px-5 py-1 hover:bg-[#161b22] transition-colors text-left group"
                        title={`Insert "${col.name}"`}
                      >
                        <span className="text-[#484f58] text-[9px] w-3">⬡</span>
                        <span className="text-[#e6edf3] text-[11px] font-mono flex-1">{col.name}</span>
                        <span className="text-[9px] font-mono" style={{ color: typeColor(col.type) }}>{col.type.replace('character varying', 'varchar').replace('timestamp with time zone', 'timestamptz')}</span>
                      </button>
                    ))}

                    {/* Sample data toggle */}
                    <button
                      onClick={() => setPreviewTable(isPreview ? null : tableName)}
                      className="w-full text-left px-5 py-1 text-[#484f58] hover:text-[#8b949e] text-[10px] transition-colors"
                    >
                      {isPreview ? '▾ Hide preview' : '▸ Preview data'}
                    </button>

                    {isPreview && tbl.sample_rows.length > 0 && (
                      <div className="mx-3 mb-2 overflow-x-auto rounded border border-[#21262d]">
                        <table className="text-[9px] font-mono w-full">
                          <thead>
                            <tr className="border-b border-[#21262d]">
                              {tbl.columns.map(c => (
                                <th key={c.name} className="px-2 py-1 text-[#484f58] text-left whitespace-nowrap">{c.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tbl.sample_rows.slice(0, 3).map((row, ri) => (
                              <tr key={ri} className="border-b border-[#21262d] last:border-0">
                                {tbl.columns.map(c => (
                                  <td key={c.name} className="px-2 py-1 text-[#8b949e] whitespace-nowrap max-w-[80px] truncate">
                                    {row[c.name] === null ? <span className="text-[#484f58]">NULL</span> : String(row[c.name])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {Object.keys(sqlSchema).length === 0 && !schemaLoading && (
            <div className="px-3 py-4 text-[#484f58] text-[11px]">
              Schema not available — seed the DB first via<br />
              <code className="text-[#8b949e]">npm run db:seed-questions</code>
            </div>
          )}
        </div>

        {/* Active field indicator */}
        <div className="px-3 py-2 border-t border-[#21262d] bg-[#161b22]">
          <div className="text-[#484f58] text-[9px] uppercase tracking-widest mb-0.5">Inserting into</div>
          <div className="flex gap-1.5">
            {(['starter_query', 'solution_query', 'schema_hint'] as FocusedField[]).map(f => (
              <button
                key={f}
                onClick={() => setLastFocused(f)}
                className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${lastFocused === f ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#30363d] text-[#484f58] hover:text-[#8b949e]'}`}
              >
                {f === 'starter_query' ? 'starter' : f === 'solution_query' ? 'solution' : 'hint'}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117] font-mono text-xs px-4 py-8">
      <div className="max-w-6xl mx-auto">
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
          </div>
        ) : (
          <div className="space-y-5">
            {/* Tabs */}
            <div className="flex border-b border-[#30363d] overflow-x-auto">
              {([
                ['assign',     '📋 Assign'],
                ['sql',        '🗄 SQL'],
                ['monitoring', '📊 Monitoring'],
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
                        {([
                          ['incident',   'Incident Simulation'],
                          ['sql',        'SQL Readiness'],
                          ['monitoring', 'Monitoring Design'],
                          ['cognitive',  'Cognitive Test'],
                        ] as const).map(([m, label]) => (
                          <button key={m} type="button" onClick={() => { setModuleType(m); setSelectedQuestionId('') }}
                            className={`px-4 py-1.5 rounded border text-xs font-bold transition-colors ${moduleType === m ? 'border-[#3fb950] text-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] text-[#8b949e] hover:border-[#484f58]'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {moduleType === 'incident' && (
                      <div>
                        <label className={labelCls}>Scenario</label>
                        <div className="space-y-2">
                          {SCENARIOS.map(s => (
                            <label key={s.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${scenarioId === s.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`}>
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

                    {moduleType === 'cognitive' && (
                      <div className="bg-[#0d1117] border border-[#e3b341] rounded p-4">
                        <div className="text-[#e3b341] font-bold mb-1">Cognitive Assessment</div>
                        <div className="text-[#8b949e] leading-relaxed">
                          The candidate will be shown all available cognitive questions. No specific question selection needed — the full question bank is used automatically.
                        </div>
                      </div>
                    )}

                    {createError   && <div className="text-[#f85149]">✗ {createError}</div>}
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
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${moduleBadgeClass(a.module_type ?? 'incident')}`}>
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
                {/* Create form + schema browser side-by-side */}
                <div className="flex gap-4 items-start">

                  {/* ── Schema Browser ── */}
                  <SchemaBrowser />

                  {/* ── Question Form ── */}
                  <div className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                    <div className="text-[#8b949e] uppercase tracking-widest mb-4">Create SQL Question</div>
                    <form onSubmit={handleCreateSqlQuestion} className="space-y-3">

                      {/* Title + meta */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className={labelCls}>Title</label>
                          <input value={sqlForm.title} onChange={e => setSqlForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Find top earners by dept" className={inputCls} />
                        </div>
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
                            <option value="write">Write query</option>
                            <option value="fix">Fix broken query</option>
                            <option value="identify">Identify the issue</option>
                          </select>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className={labelCls}>Description — what the candidate sees</label>
                        <textarea value={sqlForm.description} onChange={e => setSqlForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Write a query that returns employees earning above the company average, showing name, department, and salary." className={inputCls + ' resize-none'} />
                      </div>

                      {/* Schema Hint */}
                      <div>
                        <label className={labelCls}>
                          Schema Hint <span className="text-[#484f58] ml-1">(shown to candidate alongside the question — click tables/columns in the browser to insert)</span>
                        </label>
                        <textarea
                          ref={schemaHintRef}
                          value={sqlForm.schema_hint}
                          onChange={e => setSqlForm(f => ({ ...f, schema_hint: e.target.value }))}
                          {...focusProps('schema_hint')}
                          rows={3}
                          placeholder={`employees(id, name, department_id, role, salary, hire_date, manager_id)\ndepartments(id, name, budget, location)\n...`}
                          className={inputCls + ' resize-none font-mono text-[11px]'}
                        />
                      </div>

                      {/* Starter Query */}
                      <div>
                        <label className={labelCls}>
                          Starter Query <span className="text-[#484f58] ml-1">(pre-filled in candidate editor — leave blank for "write" questions)</span>
                        </label>
                        <textarea
                          ref={starterQueryRef}
                          value={sqlForm.starter_query}
                          onChange={e => setSqlForm(f => ({ ...f, starter_query: e.target.value }))}
                          {...focusProps('starter_query')}
                          rows={3}
                          placeholder="SELECT ... FROM employees WHERE ..."
                          className={inputCls + ' resize-none font-mono text-[11px]'}
                        />
                      </div>

                      {/* Solution Query + Test */}
                      <div>
                        <label className={labelCls}>
                          Solution Query <span className="text-[#484f58] ml-1">(used for live scoring — run it to auto-fill expected output)</span>
                        </label>
                        <textarea
                          ref={solutionQueryRef}
                          value={sqlForm.solution_query}
                          onChange={e => setSqlForm(f => ({ ...f, solution_query: e.target.value }))}
                          {...focusProps('solution_query')}
                          rows={4}
                          placeholder="SELECT e.name, d.name as department, e.salary&#10;FROM employees e&#10;JOIN departments d ON d.id = e.department_id&#10;WHERE e.salary > (SELECT AVG(salary) FROM employees)&#10;ORDER BY e.salary DESC"
                          className={inputCls + ' resize-none font-mono text-[11px]'}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={handleTestQuery}
                            disabled={testing || (!sqlForm.solution_query.trim() && !sqlForm.starter_query.trim())}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#58a6ff]/10 hover:bg-[#58a6ff]/20 border border-[#58a6ff]/40 text-[#58a6ff] rounded text-[11px] font-bold disabled:opacity-40 transition-all"
                          >
                            {testing ? '⏳ Running…' : '▶ Run Query'}
                          </button>
                          {testResult && !testResult.error && (
                            <button
                              type="button"
                              onClick={handleUseAsExpected}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3fb950]/10 hover:bg-[#3fb950]/20 border border-[#3fb950]/40 text-[#3fb950] rounded text-[11px] font-bold transition-all"
                            >
                              ← Use as Expected Output
                            </button>
                          )}
                        </div>

                        {/* Test result preview */}
                        {testResult && (
                          <div className="mt-2 rounded border border-[#30363d] overflow-hidden">
                            {testResult.error ? (
                              <div className="px-3 py-2 bg-[#2a0a0a] text-[#f85149] text-[11px]">
                                ✗ {testResult.error}
                              </div>
                            ) : (
                              <>
                                <div className="px-3 py-1.5 bg-[#0f2a1a] border-b border-[#30363d] text-[#3fb950] text-[10px]">
                                  ✓ {testResult.row_count ?? testResult.rows.length} row{(testResult.row_count ?? testResult.rows.length) !== 1 ? 's' : ''} returned
                                </div>
                                <div className="overflow-x-auto max-h-40">
                                  <table className="w-full text-[10px] font-mono">
                                    <thead>
                                      <tr className="border-b border-[#30363d]">
                                        {testResult.columns.map(c => (
                                          <th key={c} className="px-3 py-1.5 text-left text-[#484f58] whitespace-nowrap">{c}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {testResult.rows.slice(0, 8).map((row, ri) => (
                                        <tr key={ri} className="border-b border-[#21262d] last:border-0 hover:bg-[#1c2128]">
                                          {testResult.columns.map(c => (
                                            <td key={c} className="px-3 py-1 text-[#8b949e] whitespace-nowrap">
                                              {row[c] === null ? <span className="text-[#484f58]">NULL</span> : String(row[c])}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {testResult.rows.length > 8 && (
                                  <div className="px-3 py-1 text-[#484f58] text-[10px] border-t border-[#21262d]">…{testResult.rows.length - 8} more rows</div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expected Output */}
                      <div>
                        <label className={labelCls}>
                          Expected Output (JSON) <span className="text-[#484f58] ml-1">— auto-filled when you click "Use as Expected Output"</span>
                        </label>
                        <textarea
                          value={sqlForm.expected_output}
                          onChange={e => setSqlForm(f => ({ ...f, expected_output: e.target.value }))}
                          rows={3}
                          className={inputCls + ' resize-none font-mono text-[11px]'}
                        />
                      </div>

                      {/* Hint + time */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Hint (shown on request)</label>
                          <textarea value={sqlForm.hint} onChange={e => setSqlForm(f => ({ ...f, hint: e.target.value }))} rows={2} placeholder="Optional hint…" className={inputCls + ' resize-none'} />
                        </div>
                        <div>
                          <label className={labelCls}>Time Limit (seconds)</label>
                          <input type="number" value={sqlForm.time_limit_seconds} onChange={e => setSqlForm(f => ({ ...f, time_limit_seconds: e.target.value }))} className={inputCls} />
                        </div>
                      </div>

                      {sqlFormError   && <div className="text-[#f85149]">✗ {sqlFormError}</div>}
                      {sqlFormSuccess && <div className="text-[#3fb950]">{sqlFormSuccess}</div>}
                      <button type="submit" className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all">
                        + Create SQL Question
                      </button>
                    </form>
                  </div>
                </div>

                {/* Questions list */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] flex items-center justify-between">
                    <span className="text-[#8b949e] uppercase tracking-widest">Questions ({sqlQuestions.length})</span>
                    <button
                      onClick={async () => {
                        const r = await fetch(`${API_BASE}/sql/admin/seed`, { method: 'POST', headers: { 'x-admin-key': adminKey } })
                        const data = await r.json() as { inserted: number; skipped: number }
                        await loadSqlQuestions()
                        alert(`Seeded ${data.inserted} question(s). ${data.skipped} already existed.`)
                      }}
                      className="text-[10px] px-3 py-1 rounded border border-[#58a6ff]/40 text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-colors"
                    >⚡ Seed Default Questions</button>
                  </div>
                  {sqlQuestions.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#484f58]">No SQL questions yet. Create one above or seed defaults.</div>
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
                      <textarea value={monForm.scenario} onChange={e => setMonForm(f => ({ ...f, scenario: e.target.value }))} rows={4} placeholder="Describe the system context and what happened…" className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                      <label className={labelCls}>Sub-Questions (JSON array)</label>
                      <div className="text-[#484f58] text-[10px] mb-1.5">
                        {'[{ "id": "q1", "prompt": "...", "type": "metrics|alerting|investigation|sli_slo|error_budget|alert_fatigue|dashboard", "placeholder": "...", "required_keywords": [], "bonus_keywords": [], "reference_answer": "..." }]'}
                      </div>
                      <textarea
                        value={monForm.sub_questions}
                        onChange={e => setMonForm(f => ({ ...f, sub_questions: e.target.value }))}
                        rows={10}
                        placeholder={'[\n  {\n    "id": "metrics",\n    "prompt": "List the 5 most critical metrics for this service…",\n    "type": "metrics",\n    "placeholder": "Metric 1: Error rate…",\n    "required_keywords": ["threshold", "error rate"],\n    "bonus_keywords": ["p99", "latency"],\n    "reference_answer": "Key metrics are…"\n  }\n]'}
                        className={inputCls + ' resize-none font-mono text-[11px]'}
                      />
                    </div>
                    {monFormError   && <div className="text-[#f85149]">✗ {monFormError}</div>}
                    {monFormSuccess && <div className="text-[#3fb950]">{monFormSuccess}</div>}
                    <button type="submit" className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all">
                      + Create Monitoring Question
                    </button>
                  </form>
                </div>

                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] flex items-center justify-between">
                    <span className="text-[#8b949e] uppercase tracking-widest">Questions ({monitoringQuestions.length})</span>
                    <button
                      onClick={async () => {
                        const r = await fetch(`${API_BASE}/monitoring/admin/seed`, { method: 'POST', headers: { 'x-admin-key': adminKey } })
                        const data = await r.json() as { inserted: number; skipped: number }
                        await loadMonitoringQuestions()
                        alert(`Seeded ${data.inserted} question(s). ${data.skipped} already existed.`)
                      }}
                      className="text-[10px] px-3 py-1 rounded border border-[#bc8cff]/40 text-[#bc8cff] hover:bg-[#bc8cff]/10 transition-colors"
                    >⚡ Seed Default Questions</button>
                  </div>
                  {monitoringQuestions.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#484f58]">No monitoring questions yet. Click "Seed Default Questions" to add 3 pre-built questions.</div>
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

          </div>
        )}
      </div>
    </div>
  )
}
