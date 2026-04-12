import { useState, useEffect, useRef } from 'react'

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')

const FRONTEND_BASE = window.location.origin

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

// ── Types ─────────────────────────────────────────────────────────────────────
interface Assignment {
  id: string; candidate_name: string; scenario_id: string
  module_type: 'incident' | 'sql' | 'monitoring' | 'cognitive' | 'postmortem' | 'automation'
  question_id: string | null; created_at: string; used_at: string | null
  status: 'pending' | 'used'; is_practice?: boolean; time_limit_minutes?: number | null
  pass_threshold?: number
  active_from?: string | null
  active_until?: string | null
}

interface SQLQuestion {
  id: string; title: string; description?: string; difficulty: string
  question_type: string; time_limit_seconds: number; created_at: string
  starter_query?: string; solution_query?: string; expected_output?: unknown
  schema_hint?: string; hint?: string
}

interface MonitoringQuestion { id: string; title: string; difficulty: string; time_limit_seconds: number; created_at: string }
interface PostmortemQuestion { id: string; title: string; difficulty: string; time_limit_seconds: number; created_at: string }
interface AutomationQuestion { id: string; title: string; difficulty: string; language: string; time_limit_seconds: number; created_at: string }

interface CognitiveQuestion {
  id: string; question: string; type: 'mcq' | 'numerical' | 'logical'
  options: string[]; correct_answer: string; explanation: string
  difficulty: string; points: number; created_at: string
}

interface SessionResult {
  id: string; candidate_name: string; scenario_id: string; scenario_name: string
  started_at: string; ended_at: string; overall_score: number; status: string
  module_type: string; duration_minutes: number; postmortem: string
}

interface ResultStats { total: number; avg_score: number | null; p50_score: number | null; pass_count: number; fail_count: number }

interface SchemaColumn { name: string; type: string }
interface SchemaTable  { columns: SchemaColumn[]; sample_rows: Record<string, unknown>[] }
type SqlSchema = Record<string, SchemaTable>
interface QueryResult { columns: string[]; rows: Record<string, unknown>[]; error?: string; row_count?: number }

interface AdminProps { onBack: () => void }
type Tab = 'assign' | 'results' | 'sql' | 'cognitive' | 'monitoring' | 'postmortem' | 'automation'
type FocusedField = 'starter_query' | 'solution_query' | 'schema_hint'

const BLANK_SQL_FORM = { title: '', description: '', difficulty: 'medium', question_type: 'write', starter_query: '', solution_query: '', expected_output: '{}', schema_hint: '', hint: '', time_limit_seconds: '300' }
const BLANK_COG_FORM = { question: '', type: 'mcq', options: '["Option A","Option B","Option C","Option D"]', correct_answer: '', explanation: '', difficulty: 'medium', points: '10' }
const BLANK_MON_FORM = { title: '', scenario: '', difficulty: 'medium', sub_questions: '', time_limit_seconds: '600' }
const BLANK_PM_FORM  = { title: '', incident_summary: '', timeline: '[]', difficulty: 'medium', time_limit_seconds: '1800' }
const BLANK_AUTO_FORM = { title: '', description: '', task: '', difficulty: 'medium', language: 'bash', starter_code: '', evaluation_criteria: '[]', time_limit_seconds: '900' }

export default function Admin({ onBack }: AdminProps) {
  const [adminKey, setAdminKey]   = useState('')
  const [authed, setAuthed]       = useState(false)
  const [authError, setAuthError] = useState('')
  const [tab, setTab]             = useState<Tab>('assign')

  // ── Assign tab ───────────────────────────────────────────────────────────
  const [assignments, setAssignments]               = useState<Assignment[]>([])
  const [candidateName, setCandidateName]           = useState('')
  const [moduleType, setModuleType]                 = useState<Assignment['module_type']>('incident')
  const [scenarioId, setScenarioId]                 = useState('cache-db-cascade')
  const [selectedQuestionId, setSelectedQuestionId] = useState('')
  const [isPractice, setIsPractice]                 = useState(false)
  const [timeLimitMins, setTimeLimitMins]           = useState('')
  const [passThreshold, setPassThreshold]           = useState('70')
  const [activeFrom, setActiveFrom]                 = useState('')
  const [activeUntil, setActiveUntil]               = useState('')
  const [creating, setCreating]                     = useState(false)
  const [createError, setCreateError]               = useState('')
  const [createSuccess, setCreateSuccess]           = useState('')
  const [copiedLink, setCopiedLink]                 = useState<string | null>(null)
  const [previewSql, setPreviewSql]                 = useState<SQLQuestion | null>(null)

  // ── Results tab ──────────────────────────────────────────────────────────
  const [results, setResults]         = useState<SessionResult[]>([])
  const [resultStats, setResultStats] = useState<ResultStats | null>(null)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [filterModule, setFilterModule] = useState<string>('all')
  const [replayData, setReplayData]   = useState<Record<string, {created_at: string; event_type: string; payload: Record<string, unknown>}[]>>({})
  const [replayLoading, setReplayLoading] = useState<string | null>(null)
  const [replayFlaggedOnly, setReplayFlaggedOnly] = useState(false)

  // Results filtering enhancements
  const [filterPassFail, setFilterPassFail] = useState<'all' | 'pass' | 'fail'>('all')
  const [filterScoreMin, setFilterScoreMin] = useState('')
  const [filterScoreMax, setFilterScoreMax] = useState('')

  // Question preview modal
  const [previewQuestion, setPreviewQuestion] = useState<{ type: string; data: unknown } | null>(null)

  // Pause/resume active sessions
  const [pausingSessions, setPausingSessions] = useState<Set<string>>(new Set())

  // Assessor annotations
  const [annotations, setAnnotations] = useState<Record<string, { id: string; text: string; created_at: string }[]>>({})
  const [annotationText, setAnnotationText] = useState<Record<string, string>>({})
  const [annotationsLoading, setAnnotationsLoading] = useState<string | null>(null)

  // ── SQL tab ──────────────────────────────────────────────────────────────
  const [sqlQuestions, setSqlQuestions] = useState<SQLQuestion[]>([])
  const [sqlForm, setSqlForm]           = useState(BLANK_SQL_FORM)
  const [sqlFormError, setSqlFormError] = useState('')
  const [sqlFormSuccess, setSqlFormSuccess] = useState('')
  const [editingSql, setEditingSql]     = useState<SQLQuestion | null>(null)
  const [sqlSchema, setSqlSchema]       = useState<SqlSchema>({})
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [expandedTable, setExpandedTable] = useState<string | null>('employees')
  const [previewTable, setPreviewTable]   = useState<string | null>(null)
  const [lastFocused, setLastFocused]     = useState<FocusedField>('solution_query')
  const [testResult, setTestResult]       = useState<QueryResult | null>(null)
  const [testing, setTesting]             = useState(false)
  const starterQueryRef  = useRef<HTMLTextAreaElement>(null)
  const solutionQueryRef = useRef<HTMLTextAreaElement>(null)
  const schemaHintRef    = useRef<HTMLTextAreaElement>(null)

  // ── Cognitive tab ────────────────────────────────────────────────────────
  const [cogQuestions, setCogQuestions] = useState<CognitiveQuestion[]>([])
  const [cogForm, setCogForm]           = useState(BLANK_COG_FORM)
  const [cogFormError, setCogFormError] = useState('')
  const [cogFormSuccess, setCogFormSuccess] = useState('')
  const [editingCog, setEditingCog]     = useState<CognitiveQuestion | null>(null)

  // ── Monitoring tab ───────────────────────────────────────────────────────
  const [monitoringQuestions, setMonitoringQuestions] = useState<MonitoringQuestion[]>([])
  const [monForm, setMonForm]           = useState(BLANK_MON_FORM)
  const [monFormError, setMonFormError] = useState('')
  const [monFormSuccess, setMonFormSuccess] = useState('')

  // ── Postmortem tab ────────────────────────────────────────────────────────
  const [pmQuestions, setPmQuestions]   = useState<PostmortemQuestion[]>([])
  const [pmForm, setPmForm]             = useState(BLANK_PM_FORM)
  const [pmFormError, setPmFormError]   = useState('')
  const [pmFormSuccess, setPmFormSuccess] = useState('')
  const [editingPm, setEditingPm]       = useState<PostmortemQuestion | null>(null)

  // ── Automation tab ────────────────────────────────────────────────────────
  const [autoQuestions, setAutoQuestions] = useState<AutomationQuestion[]>([])
  const [autoForm, setAutoForm]           = useState(BLANK_AUTO_FORM)
  const [autoFormError, setAutoFormError] = useState('')
  const [autoFormSuccess, setAutoFormSuccess] = useState('')
  const [editingAuto, setEditingAuto]     = useState<AutomationQuestion | null>(null)

  // ── Loaders ───────────────────────────────────────────────────────────────
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault(); setAuthError('')
    try {
      const res = await fetch(`${API_BASE}/admin/assignments`, { headers: { 'x-admin-key': adminKey } })
      if (res.status === 401) { setAuthError('Invalid admin key'); return }
      setAssignments(await res.json() as Assignment[])
      setAuthed(true)
    } catch { setAuthError('Could not reach backend') }
  }

  async function loadAssignments() {
    try { const r = await fetch(`${API_BASE}/admin/assignments`, { headers: { 'x-admin-key': adminKey } }); setAssignments(await r.json() as Assignment[]) } catch { /* */ }
  }
  async function loadResults() {
    setResultsLoading(true)
    try { const r = await fetch(`${API_BASE}/admin/results`, { headers: { 'x-admin-key': adminKey } }); const d = await r.json() as { sessions: SessionResult[]; stats: ResultStats }; setResults(d.sessions); setResultStats(d.stats) } catch { /* */ }
    finally { setResultsLoading(false) }
  }
  async function loadSqlQuestions() {
    try { const r = await fetch(`${API_BASE}/sql/admin/questions`, { headers: { 'x-admin-key': adminKey } }); if (r.ok) setSqlQuestions(await r.json() as SQLQuestion[]) } catch { /* */ }
  }
  async function loadSqlSchema() {
    if (Object.keys(sqlSchema).length > 0) return
    setSchemaLoading(true)
    try { const r = await fetch(`${API_BASE}/sql/schema`); if (r.ok) setSqlSchema(await r.json() as SqlSchema) } catch { /* */ }
    finally { setSchemaLoading(false) }
  }
  async function loadCogQuestions() {
    try { const r = await fetch(`${API_BASE}/cognitive/admin/questions`, { headers: { 'x-admin-key': adminKey } }); if (r.ok) setCogQuestions(await r.json() as CognitiveQuestion[]) } catch { /* */ }
  }
  async function loadMonitoringQuestions() {
    try { const r = await fetch(`${API_BASE}/monitoring/admin/questions`, { headers: { 'x-admin-key': adminKey } }); if (r.ok) setMonitoringQuestions(await r.json() as MonitoringQuestion[]) } catch { /* */ }
  }
  async function loadPmQuestions() {
    try { const r = await fetch(`${API_BASE}/postmortem/admin/questions`, { headers: { 'x-admin-key': adminKey } }); if (r.ok) setPmQuestions(await r.json() as PostmortemQuestion[]) } catch { /* */ }
  }
  async function loadAutoQuestions() {
    try { const r = await fetch(`${API_BASE}/automation/admin/questions`, { headers: { 'x-admin-key': adminKey } }); if (r.ok) setAutoQuestions(await r.json() as AutomationQuestion[]) } catch { /* */ }
  }

  useEffect(() => {
    if (!authed) return
    loadAssignments(); loadSqlQuestions(); loadMonitoringQuestions(); loadCogQuestions(); loadPmQuestions(); loadAutoQuestions()
    const iv = setInterval(loadAssignments, 15_000)
    return () => clearInterval(iv)
  }, [authed])

  useEffect(() => { if (authed && tab === 'sql') loadSqlSchema() }, [authed, tab])
  useEffect(() => { if (authed && tab === 'results') loadResults() }, [authed, tab])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(iso: string) { return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) }
  function moduleLabel(mt: string) { return ({ sql: 'SQL', monitoring: 'MONITORING', cognitive: 'COGNITIVE', incident: 'INCIDENT', postmortem: 'POSTMORTEM', automation: 'AUTOMATION' }[mt] ?? 'INCIDENT') }
  function moduleBadgeClass(mt: string) { return ({ sql: 'border-[#58a6ff] text-[#58a6ff]', monitoring: 'border-[#bc8cff] text-[#bc8cff]', cognitive: 'border-[#e3b341] text-[#e3b341]', incident: 'border-[#f85149] text-[#f85149]', postmortem: 'border-[#d29922] text-[#d29922]', automation: 'border-[#3fb950] text-[#3fb950]' }[mt] ?? 'border-[#f85149] text-[#f85149]') }
  function scoreColor(s: number) { return s >= 70 ? '#3fb950' : s >= 50 ? '#d29922' : '#f85149' }
  function typeColor(t: string) { return t.includes('int') || t.includes('numeric') ? '#58a6ff' : t.includes('text') || t.includes('char') ? '#3fb950' : t.includes('timestamp') || t.includes('date') ? '#d29922' : '#8b949e' }

  function copyLink(name: string) {
    const url = `${FRONTEND_BASE}/?name=${encodeURIComponent(name)}`
    navigator.clipboard.writeText(url).then(() => { setCopiedLink(name); setTimeout(() => setCopiedLink(null), 2000) })
  }

  function exportCSV() {
    const rows = [['Candidate', 'Module', 'Scenario', 'Score', 'Duration (min)', 'Date', 'Status']]
    results.forEach(r => rows.push([r.candidate_name, r.module_type, r.scenario_name ?? r.scenario_id, String(r.overall_score ?? ''), String(r.duration_minutes ?? ''), r.started_at ? new Date(r.started_at).toISOString() : '', r.status]))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'sre-results.csv'; a.click()
  }

  // ── Schema insert ─────────────────────────────────────────────────────────
  function insertAtFocused(text: string) {
    const refMap: Record<FocusedField, React.RefObject<HTMLTextAreaElement | null>> = { starter_query: starterQueryRef, solution_query: solutionQueryRef, schema_hint: schemaHintRef }
    const el = refMap[lastFocused]?.current
    if (!el) { setSqlForm(f => ({ ...f, [lastFocused]: (f[lastFocused as keyof typeof f] as string) + ' ' + text })); return }
    const s = el.selectionStart ?? el.value.length, e2 = el.selectionEnd ?? el.value.length
    const nv = el.value.slice(0, s) + text + el.value.slice(e2)
    setSqlForm(f => ({ ...f, [lastFocused]: nv }))
    setTimeout(() => { if (refMap[lastFocused]?.current) { refMap[lastFocused].current!.selectionStart = refMap[lastFocused].current!.selectionEnd = s + text.length; refMap[lastFocused].current!.focus() } }, 0)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!candidateName.trim()) return
    if (['sql', 'monitoring', 'postmortem', 'automation'].includes(moduleType) && !selectedQuestionId) { setCreateError('Select a question for this module'); return }
    setCreating(true); setCreateError(''); setCreateSuccess('')
    try {
      const body: Record<string, unknown> = { candidate_name: candidateName.trim(), module_type: moduleType, is_practice: isPractice, pass_threshold: Number(passThreshold) || 70 }
      if (moduleType === 'incident') body.scenario_id = scenarioId
      if (['sql', 'monitoring', 'postmortem', 'automation'].includes(moduleType)) body.question_id = selectedQuestionId
      if (timeLimitMins) body.time_limit_minutes = timeLimitMins
      if (activeFrom) body.active_from = new Date(activeFrom).toISOString()
      if (activeUntil) body.active_until = new Date(activeUntil).toISOString()
      const res = await fetch(`${API_BASE}/admin/assignments`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify(body) })
      if (!res.ok) { setCreateError(((await res.json()) as { error: string }).error) }
      else {
        const name = candidateName.trim()
        setCandidateName(''); setSelectedQuestionId('')
        setActiveFrom(''); setActiveUntil('')
        const lbl = moduleType === 'incident' ? SCENARIOS.find(s => s.id === scenarioId)?.name
          : moduleType === 'sql' ? sqlQuestions.find(q => q.id === selectedQuestionId)?.title
          : moduleType === 'monitoring' ? monitoringQuestions.find(q => q.id === selectedQuestionId)?.title
          : moduleType === 'postmortem' ? pmQuestions.find(q => q.id === selectedQuestionId)?.title
          : moduleType === 'automation' ? autoQuestions.find(q => q.id === selectedQuestionId)?.title
          : 'Cognitive Test'
        setCreateSuccess(`✓ Assigned "${name}" → ${lbl ?? moduleType}${isPractice ? ' (Practice)' : ''}`)
        copyLink(name)
        await loadAssignments()
      }
    } catch (err) { setCreateError(String(err)) }
    finally { setCreating(false) }
  }

  async function handleDeleteAssignment(id: string) {
    try { await fetch(`${API_BASE}/admin/assignments/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } }); await loadAssignments() } catch { /* */ }
  }

  async function handleResetAssignment(id: string) {
    try { await fetch(`${API_BASE}/admin/assignments/${id}/reset`, { method: 'PATCH', headers: { 'x-admin-key': adminKey } }); await loadAssignments() } catch { /* */ }
  }

  async function loadReplay(sessionId: string) {
    if (replayData[sessionId]?.length) return
    setReplayLoading(sessionId)
    try {
      const r = await fetch(`${API_BASE}/admin/sessions/${sessionId}/events`, { headers: { 'x-admin-key': adminKey } })
      if (r.ok) { const events = await r.json() as {created_at: string; event_type: string; payload: Record<string, unknown>}[]; setReplayData(d => ({ ...d, [sessionId]: events })) }
    } catch { /* */ }
    finally { setReplayLoading(null) }
  }

  async function handlePauseSession(sessionId: string, currentlyPaused: boolean) {
    setPausingSessions(s => new Set(s).add(sessionId))
    try {
      await fetch(`${API_BASE}/admin/sessions/${sessionId}/pause`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ paused: !currentlyPaused })
      })
      await loadResults()
    } catch { /* */ } finally {
      setPausingSessions(s => { const n = new Set(s); n.delete(sessionId); return n })
    }
  }

  async function loadAnnotations(sessionId: string) {
    if (annotations[sessionId]) return
    setAnnotationsLoading(sessionId)
    try {
      const r = await fetch(`${API_BASE}/admin/sessions/${sessionId}/annotations`, { headers: { 'x-admin-key': adminKey } })
      if (r.ok) { const data = await r.json() as { id: string; text: string; created_at: string }[]; setAnnotations(d => ({ ...d, [sessionId]: data })) }
    } catch { /* */ } finally { setAnnotationsLoading(null) }
  }

  async function handleAddAnnotation(sessionId: string) {
    const text = (annotationText[sessionId] ?? '').trim()
    if (!text) return
    try {
      await fetch(`${API_BASE}/admin/sessions/${sessionId}/annotations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ text })
      })
      setAnnotationText(t => ({ ...t, [sessionId]: '' }))
      setAnnotations(d => ({ ...d, [sessionId]: undefined as unknown as { id: string; text: string; created_at: string }[] }))
      await loadAnnotations(sessionId)
    } catch { /* */ }
  }

  function duplicateCog(q: CognitiveQuestion) {
    setCogForm({ question: q.question + ' (copy)', type: q.type, options: JSON.stringify(q.options ?? []), correct_answer: q.correct_answer, explanation: q.explanation, difficulty: q.difficulty, points: String(q.points) })
    setEditingCog(null)
    setCogFormError(''); setCogFormSuccess('')
    setTab('cognitive')
    setTimeout(() => document.getElementById('cog-form-top')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  function duplicatePm(q: PostmortemQuestion) {
    setPmForm({ title: q.title + ' (copy)', incident_summary: '', timeline: '[]', difficulty: q.difficulty, time_limit_seconds: String(q.time_limit_seconds) })
    setEditingPm(null)
    setPmFormError(''); setPmFormSuccess('')
    setTimeout(() => document.getElementById('pm-form-top')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  function duplicateAuto(q: AutomationQuestion) {
    setAutoForm({ title: q.title + ' (copy)', description: '', task: '', difficulty: q.difficulty, language: q.language, starter_code: '', evaluation_criteria: '[]', time_limit_seconds: String(q.time_limit_seconds) })
    setEditingAuto(null)
    setAutoFormError(''); setAutoFormSuccess('')
    setTimeout(() => document.getElementById('auto-form-top')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // SQL handlers
  async function handleTestQuery() {
    const q = sqlForm.solution_query.trim() || sqlForm.starter_query.trim(); if (!q) return
    setTesting(true); setTestResult(null)
    try { const r = await fetch(`${API_BASE}/sql/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q }) }); setTestResult(await r.json() as QueryResult) }
    catch (err) { setTestResult({ columns: [], rows: [], error: String(err) }) }
    finally { setTesting(false) }
  }
  function handleUseAsExpected() { if (!testResult || testResult.error) return; setSqlForm(f => ({ ...f, expected_output: JSON.stringify({ columns: testResult.columns, rows: testResult.rows }, null, 2) })) }

  async function handleCreateSqlQuestion(e: React.FormEvent) {
    e.preventDefault(); setSqlFormError(''); setSqlFormSuccess('')
    let eo: unknown = {}; try { eo = JSON.parse(sqlForm.expected_output) } catch { setSqlFormError('Expected output must be valid JSON'); return }
    try {
      const res = await fetch(`${API_BASE}/sql/admin/questions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ ...sqlForm, time_limit_seconds: Number(sqlForm.time_limit_seconds), expected_output: eo }) })
      if (!res.ok) { setSqlFormError(((await res.json()) as { error: string }).error); return }
      setSqlFormSuccess('✓ SQL question created'); setSqlForm(BLANK_SQL_FORM); setTestResult(null); setEditingSql(null); await loadSqlQuestions()
    } catch (err) { setSqlFormError(String(err)) }
  }

  async function handleUpdateSqlQuestion(e: React.FormEvent) {
    e.preventDefault(); if (!editingSql) return; setSqlFormError(''); setSqlFormSuccess('')
    let eo: unknown = {}; try { eo = JSON.parse(sqlForm.expected_output) } catch { setSqlFormError('Expected output must be valid JSON'); return }
    try {
      const res = await fetch(`${API_BASE}/sql/admin/questions/${editingSql.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ ...sqlForm, time_limit_seconds: Number(sqlForm.time_limit_seconds), expected_output: eo }) })
      if (!res.ok) { setSqlFormError(((await res.json()) as { error: string }).error); return }
      setSqlFormSuccess('✓ Question updated'); setEditingSql(null); setSqlForm(BLANK_SQL_FORM); setTestResult(null); await loadSqlQuestions()
    } catch (err) { setSqlFormError(String(err)) }
  }

  function startEditSql(q: SQLQuestion) {
    setEditingSql(q)
    setSqlForm({ title: q.title, description: q.description ?? '', difficulty: q.difficulty, question_type: q.question_type, starter_query: q.starter_query ?? '', solution_query: q.solution_query ?? '', expected_output: typeof q.expected_output === 'string' ? q.expected_output : JSON.stringify(q.expected_output ?? {}, null, 2), schema_hint: q.schema_hint ?? '', hint: q.hint ?? '', time_limit_seconds: String(q.time_limit_seconds) })
    setTestResult(null); setSqlFormError(''); setSqlFormSuccess('')
    setTimeout(() => document.getElementById('sql-form-top')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function handleDeleteSqlQuestion(id: string) { await fetch(`${API_BASE}/sql/admin/questions/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } }); await loadSqlQuestions() }

  // Cognitive handlers
  async function handleCreateCog(e: React.FormEvent) {
    e.preventDefault(); setCogFormError(''); setCogFormSuccess('')
    let opts: unknown = []; try { opts = JSON.parse(cogForm.options) } catch { setCogFormError('Options must be a valid JSON array'); return }
    try {
      const url = editingCog ? `${API_BASE}/cognitive/admin/questions/${editingCog.id}` : `${API_BASE}/cognitive/admin/questions`
      const method = editingCog ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'content-type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ ...cogForm, options: opts, points: Number(cogForm.points) }) })
      if (!res.ok) { setCogFormError(((await res.json()) as { error: string }).error); return }
      setCogFormSuccess(editingCog ? '✓ Question updated' : '✓ Question created'); setCogForm(BLANK_COG_FORM); setEditingCog(null); await loadCogQuestions()
    } catch (err) { setCogFormError(String(err)) }
  }

  function startEditCog(q: CognitiveQuestion) {
    setEditingCog(q); setCogForm({ question: q.question, type: q.type, options: JSON.stringify(q.options ?? []), correct_answer: q.correct_answer, explanation: q.explanation, difficulty: q.difficulty, points: String(q.points) })
    setCogFormError(''); setCogFormSuccess('')
  }

  async function handleDeleteCog(id: string) { await fetch(`${API_BASE}/cognitive/admin/questions/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } }); await loadCogQuestions() }

  // Monitoring handlers
  async function handleCreateMonitoring(e: React.FormEvent) {
    e.preventDefault(); setMonFormError(''); setMonFormSuccess('')
    let subQs: unknown = []; try { subQs = JSON.parse(monForm.sub_questions) } catch { setMonFormError('Sub-questions must be valid JSON array'); return }
    try {
      const res = await fetch(`${API_BASE}/monitoring/admin/questions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ ...monForm, sub_questions: subQs, time_limit_seconds: Number(monForm.time_limit_seconds) }) })
      if (!res.ok) { setMonFormError(((await res.json()) as { error: string }).error); return }
      setMonFormSuccess('✓ Monitoring question created'); setMonForm(BLANK_MON_FORM); await loadMonitoringQuestions()
    } catch (err) { setMonFormError(String(err)) }
  }

  async function handleDeleteMonitoring(id: string) { await fetch(`${API_BASE}/monitoring/admin/questions/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } }); await loadMonitoringQuestions() }

  // Postmortem handlers
  async function handleCreatePm(e: React.FormEvent) {
    e.preventDefault(); setPmFormError(''); setPmFormSuccess('')
    let tl: unknown = []; try { tl = JSON.parse(pmForm.timeline) } catch { setPmFormError('Timeline must be valid JSON array'); return }
    try {
      const url = editingPm ? `${API_BASE}/postmortem/admin/questions/${editingPm.id}` : `${API_BASE}/postmortem/admin/questions`
      const method = editingPm ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'content-type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ ...pmForm, timeline: tl, time_limit_seconds: Number(pmForm.time_limit_seconds) }) })
      if (!res.ok) { setPmFormError(((await res.json()) as { error: string }).error); return }
      setPmFormSuccess(editingPm ? '✓ Updated' : '✓ Created'); setPmForm(BLANK_PM_FORM); setEditingPm(null); await loadPmQuestions()
    } catch (err) { setPmFormError(String(err)) }
  }
  function startEditPm(q: PostmortemQuestion) { setEditingPm(q); setPmForm({ title: q.title, incident_summary: '', timeline: '[]', difficulty: q.difficulty, time_limit_seconds: String(q.time_limit_seconds) }); setPmFormError(''); setPmFormSuccess('') }
  async function handleDeletePm(id: string) { await fetch(`${API_BASE}/postmortem/admin/questions/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } }); await loadPmQuestions() }

  // Automation handlers
  async function handleCreateAuto(e: React.FormEvent) {
    e.preventDefault(); setAutoFormError(''); setAutoFormSuccess('')
    let criteria: unknown = []; try { criteria = JSON.parse(autoForm.evaluation_criteria) } catch { setAutoFormError('Evaluation criteria must be valid JSON array'); return }
    try {
      const url = editingAuto ? `${API_BASE}/automation/admin/questions/${editingAuto.id}` : `${API_BASE}/automation/admin/questions`
      const method = editingAuto ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'content-type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ ...autoForm, evaluation_criteria: criteria, time_limit_seconds: Number(autoForm.time_limit_seconds) }) })
      if (!res.ok) { setAutoFormError(((await res.json()) as { error: string }).error); return }
      setAutoFormSuccess(editingAuto ? '✓ Updated' : '✓ Created'); setAutoForm(BLANK_AUTO_FORM); setEditingAuto(null); await loadAutoQuestions()
    } catch (err) { setAutoFormError(String(err)) }
  }
  function startEditAuto(q: AutomationQuestion) { setEditingAuto(q); setAutoForm({ title: q.title, description: '', task: '', difficulty: q.difficulty, language: q.language, starter_code: '', evaluation_criteria: '[]', time_limit_seconds: String(q.time_limit_seconds) }); setAutoFormError(''); setAutoFormSuccess('') }
  async function handleDeleteAuto(id: string) { await fetch(`${API_BASE}/automation/admin/questions/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } }); await loadAutoQuestions() }

  // ── Schema browser ────────────────────────────────────────────────────────
  const TABLE_ORDER = ['departments', 'employees', 'projects', 'project_assignments', 'incidents']
  const focusProps = (field: FocusedField) => ({ onFocus: () => setLastFocused(field) })
  const inputCls = "w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors"
  const labelCls = "block text-[#8b949e] mb-1.5 text-xs"

  function SchemaBrowser() {
    return (
      <div className="w-52 flex-shrink-0 bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden flex flex-col self-start sticky top-0">
        <div className="px-3 py-2 border-b border-[#30363d] flex items-center justify-between">
          <div className="text-[#8b949e] uppercase tracking-widest text-[10px]">sql_sandbox schema</div>
          {schemaLoading && <div className="text-[#484f58] text-[10px] animate-pulse">loading…</div>}
        </div>
        <div className="text-[#484f58] text-[10px] px-3 py-1.5 border-b border-[#21262d]">Click table/column → insert at cursor</div>
        <div className="overflow-y-auto flex-1">
          {TABLE_ORDER.map(tableName => {
            const tbl = sqlSchema[tableName]; if (!tbl) return null
            const isExpanded = expandedTable === tableName; const isPreview = previewTable === tableName
            return (
              <div key={tableName} className="border-b border-[#21262d] last:border-0">
                <div className="flex items-center">
                  <button onClick={() => setExpandedTable(isExpanded ? null : tableName)} className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-[#161b22] transition-colors text-left">
                    <span className="text-[#484f58] text-[10px]">{isExpanded ? '▾' : '▸'}</span>
                    <span className="text-[#58a6ff] text-[11px] font-bold font-mono">{tableName}</span>
                    <span className="text-[#484f58] text-[9px] ml-auto">{tbl.columns.length} cols</span>
                  </button>
                  <button onClick={() => insertAtFocused(tableName)} title="Insert table name" className="px-2 py-2 text-[#484f58] hover:text-[#3fb950] transition-colors text-[11px]">+</button>
                </div>
                {isExpanded && (
                  <div className="pb-1">
                    {tbl.columns.map(col => (
                      <button key={col.name} onClick={() => insertAtFocused(col.name)} className="w-full flex items-center gap-2 px-5 py-1 hover:bg-[#161b22] transition-colors text-left">
                        <span className="text-[#484f58] text-[9px]">⬡</span>
                        <span className="text-[#e6edf3] text-[11px] font-mono flex-1">{col.name}</span>
                        <span className="text-[9px] font-mono" style={{ color: typeColor(col.type) }}>{col.type.replace('character varying', 'varchar').replace('timestamp with time zone', 'timestamptz')}</span>
                      </button>
                    ))}
                    <button onClick={() => setPreviewTable(isPreview ? null : tableName)} className="w-full text-left px-5 py-1 text-[#484f58] hover:text-[#8b949e] text-[10px] transition-colors">{isPreview ? '▾ Hide preview' : '▸ Preview data'}</button>
                    {isPreview && tbl.sample_rows.length > 0 && (
                      <div className="mx-3 mb-2 overflow-x-auto rounded border border-[#21262d]">
                        <table className="text-[9px] font-mono w-full">
                          <thead><tr className="border-b border-[#21262d]">{tbl.columns.map(c => <th key={c.name} className="px-2 py-1 text-[#484f58] text-left whitespace-nowrap">{c.name}</th>)}</tr></thead>
                          <tbody>{tbl.sample_rows.slice(0, 3).map((row, ri) => <tr key={ri} className="border-b border-[#21262d] last:border-0">{tbl.columns.map(c => <td key={c.name} className="px-2 py-1 text-[#8b949e] whitespace-nowrap max-w-[80px] truncate">{row[c.name] === null ? <span className="text-[#484f58]">NULL</span> : String(row[c.name])}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {Object.keys(sqlSchema).length === 0 && !schemaLoading && <div className="px-3 py-4 text-[#484f58] text-[11px]">Schema not available — seed the DB first.</div>}
        </div>
        <div className="px-3 py-2 border-t border-[#21262d] bg-[#161b22]">
          <div className="text-[#484f58] text-[9px] uppercase tracking-widest mb-0.5">Inserting into</div>
          <div className="flex gap-1.5">
            {(['starter_query', 'solution_query', 'schema_hint'] as FocusedField[]).map(f => <button key={f} onClick={() => setLastFocused(f)} className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${lastFocused === f ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#30363d] text-[#484f58] hover:text-[#8b949e]'}`}>{f === 'starter_query' ? 'starter' : f === 'solution_query' ? 'solution' : 'hint'}</button>)}
          </div>
        </div>
      </div>
    )
  }

  // ── SQL Form ──────────────────────────────────────────────────────────────
  function SqlForm({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent) => void; submitLabel: string }) {
    return (
      <form onSubmit={onSubmit} className="space-y-3" id="sql-form-top">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1"><label className={labelCls}>Title</label><input value={sqlForm.title} onChange={e => setSqlForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Find top earners by dept" className={inputCls} /></div>
          <div><label className={labelCls}>Difficulty</label><select value={sqlForm.difficulty} onChange={e => setSqlForm(f => ({ ...f, difficulty: e.target.value }))} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
          <div><label className={labelCls}>Type</label><select value={sqlForm.question_type} onChange={e => setSqlForm(f => ({ ...f, question_type: e.target.value }))} className={inputCls}><option value="write">Write query</option><option value="fix">Fix broken query</option><option value="identify">Identify issue</option></select></div>
        </div>
        <div><label className={labelCls}>Description</label><textarea value={sqlForm.description} onChange={e => setSqlForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="What should the candidate write?" className={inputCls + ' resize-none'} /></div>
        <div><label className={labelCls}>Schema Hint <span className="text-[#484f58] ml-1">(shown to candidate — click schema browser to insert)</span></label><textarea ref={schemaHintRef} value={sqlForm.schema_hint} onChange={e => setSqlForm(f => ({ ...f, schema_hint: e.target.value }))} {...focusProps('schema_hint')} rows={2} placeholder="employees(id, name, department_id, role, salary…)" className={inputCls + ' resize-none font-mono text-[11px]'} /></div>
        <div><label className={labelCls}>Starter Query <span className="text-[#484f58] ml-1">(pre-filled in candidate editor)</span></label><textarea ref={starterQueryRef} value={sqlForm.starter_query} onChange={e => setSqlForm(f => ({ ...f, starter_query: e.target.value }))} {...focusProps('starter_query')} rows={3} placeholder="SELECT ... FROM employees WHERE ..." className={inputCls + ' resize-none font-mono text-[11px]'} /></div>
        <div>
          <label className={labelCls}>Solution Query <span className="text-[#484f58] ml-1">(run to auto-fill expected output)</span></label>
          <textarea ref={solutionQueryRef} value={sqlForm.solution_query} onChange={e => setSqlForm(f => ({ ...f, solution_query: e.target.value }))} {...focusProps('solution_query')} rows={4} placeholder={`SELECT e.name, d.name as department, e.salary\nFROM employees e\nJOIN departments d ON d.id = e.department_id\nWHERE e.salary > (SELECT AVG(salary) FROM employees)`} className={inputCls + ' resize-none font-mono text-[11px]'} />
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={handleTestQuery} disabled={testing || (!sqlForm.solution_query.trim() && !sqlForm.starter_query.trim())} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#58a6ff]/10 hover:bg-[#58a6ff]/20 border border-[#58a6ff]/40 text-[#58a6ff] rounded text-[11px] font-bold disabled:opacity-40 transition-all">{testing ? '⏳ Running…' : '▶ Run Query'}</button>
            {testResult && !testResult.error && <button type="button" onClick={handleUseAsExpected} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3fb950]/10 hover:bg-[#3fb950]/20 border border-[#3fb950]/40 text-[#3fb950] rounded text-[11px] font-bold transition-all">← Use as Expected Output</button>}
          </div>
          {testResult && (
            <div className="mt-2 rounded border border-[#30363d] overflow-hidden">
              {testResult.error ? <div className="px-3 py-2 bg-[#2a0a0a] text-[#f85149] text-[11px]">✗ {testResult.error}</div> : (
                <>
                  <div className="px-3 py-1.5 bg-[#0f2a1a] border-b border-[#30363d] text-[#3fb950] text-[10px]">✓ {testResult.row_count ?? testResult.rows.length} row{(testResult.row_count ?? testResult.rows.length) !== 1 ? 's' : ''} returned</div>
                  <div className="overflow-x-auto max-h-36"><table className="w-full text-[10px] font-mono"><thead><tr className="border-b border-[#30363d]">{testResult.columns.map(c => <th key={c} className="px-3 py-1.5 text-left text-[#484f58] whitespace-nowrap">{c}</th>)}</tr></thead><tbody>{testResult.rows.slice(0, 8).map((row, ri) => <tr key={ri} className="border-b border-[#21262d] last:border-0 hover:bg-[#1c2128]">{testResult.columns.map(c => <td key={c} className="px-3 py-1 text-[#8b949e] whitespace-nowrap">{row[c] === null ? <span className="text-[#484f58]">NULL</span> : String(row[c])}</td>)}</tr>)}</tbody></table></div>
                  {testResult.rows.length > 8 && <div className="px-3 py-1 text-[#484f58] text-[10px] border-t border-[#21262d]">…{testResult.rows.length - 8} more rows</div>}
                </>
              )}
            </div>
          )}
        </div>
        <div><label className={labelCls}>Expected Output (JSON) <span className="text-[#484f58] ml-1">— auto-filled from "Use as Expected Output"</span></label><textarea value={sqlForm.expected_output} onChange={e => setSqlForm(f => ({ ...f, expected_output: e.target.value }))} rows={3} className={inputCls + ' resize-none font-mono text-[11px]'} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Hint (on request)</label><textarea value={sqlForm.hint} onChange={e => setSqlForm(f => ({ ...f, hint: e.target.value }))} rows={2} placeholder="Optional…" className={inputCls + ' resize-none'} /></div>
          <div><label className={labelCls}>Time Limit (seconds)</label><input type="number" value={sqlForm.time_limit_seconds} onChange={e => setSqlForm(f => ({ ...f, time_limit_seconds: e.target.value }))} className={inputCls} /></div>
        </div>
        {sqlFormError && <div className="text-[#f85149]">✗ {sqlFormError}</div>}
        {sqlFormSuccess && <div className="text-[#3fb950]">{sqlFormSuccess}</div>}
        <div className="flex gap-3">
          <button type="submit" className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all">{submitLabel}</button>
          {editingSql && <button type="button" onClick={() => { setEditingSql(null); setSqlForm(BLANK_SQL_FORM); setTestResult(null) }} className="px-4 py-2 rounded border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors">Cancel</button>}
        </div>
      </form>
    )
  }

  // ── Filtered results ──────────────────────────────────────────────────────
  const filteredResults = results.filter(r => {
    if (filterModule !== 'all' && r.module_type !== filterModule) return false
    if (filterPassFail === 'pass' && (r.overall_score == null || r.overall_score < 70)) return false
    if (filterPassFail === 'fail' && (r.overall_score == null || r.overall_score >= 70)) return false
    if (filterScoreMin && r.overall_score != null && r.overall_score < Number(filterScoreMin)) return false
    if (filterScoreMax && r.overall_score != null && r.overall_score > Number(filterScoreMax)) return false
    return true
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] font-mono text-xs px-4 py-8">
      {/* SQL question preview modal */}
      {previewSql && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewSql(null)}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 max-w-lg w-full space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><span className="text-[#e6edf3] font-bold">{previewSql.title}</span><button onClick={() => setPreviewSql(null)} className="text-[#484f58] hover:text-[#f85149]">✕</button></div>
            <div className="flex gap-2"><span className="text-[10px] px-2 py-0.5 rounded border border-[#30363d] text-[#8b949e] uppercase">{previewSql.difficulty}</span><span className="text-[10px] px-2 py-0.5 rounded border border-[#30363d] text-[#8b949e] uppercase">{previewSql.question_type}</span><span className="text-[10px] px-2 py-0.5 rounded border border-[#30363d] text-[#8b949e]">{Math.round(previewSql.time_limit_seconds / 60)} min</span></div>
            <div className="text-[#c9d1d9] text-sm leading-relaxed">{previewSql.description}</div>
            {previewSql.schema_hint && <div><div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-1">Schema Hint</div><pre className="text-[#8b949e] text-[11px] bg-[#0d1117] rounded border border-[#21262d] p-3 whitespace-pre-wrap">{previewSql.schema_hint}</pre></div>}
            {previewSql.starter_query && <div><div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-1">Starter Query</div><pre className="text-[#58a6ff] text-[11px] bg-[#0d1117] rounded border border-[#21262d] p-3 whitespace-pre-wrap">{previewSql.starter_query}</pre></div>}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="text-[#58a6ff] hover:text-[#79c0ff] transition-colors">← Back</button>
          <div><h1 className="text-[#e6edf3] text-xl font-bold">Admin Panel</h1><div className="text-[#8b949e] mt-0.5">Manage assignments, questions, and results</div></div>
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
              {([['assign','📋 Assign'],['results','📊 Results'],['sql','🗄 SQL'],['cognitive','🧠 Cognitive'],['monitoring','📡 Monitoring'],['postmortem','📄 Postmortem'],['automation','⚙ Automation']] as [Tab,string][]).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} className={`px-5 py-2.5 text-xs whitespace-nowrap border-b-2 transition-colors ${tab === id ? 'border-[#3fb950] text-[#e6edf3]' : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'}`}>{label}</button>
              ))}
            </div>

            {/* ── ASSIGN TAB ── */}
            {tab === 'assign' && (
              <div className="space-y-5">
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                  <div className="text-[#8b949e] uppercase tracking-widest mb-4">New Assignment</div>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div><label className={labelCls}>Candidate Name</label><input type="text" value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="Exact name candidate will use to log in" className={inputCls} autoFocus /></div>
                    <div>
                      <label className={labelCls}>Module Type</label>
                      <div className="flex gap-2 flex-wrap">
                        {(['incident','sql','monitoring','cognitive','postmortem','automation'] as const).map(m => (
                          <button key={m} type="button" onClick={() => { setModuleType(m as typeof moduleType); setSelectedQuestionId('') }} className={`px-4 py-1.5 rounded border text-xs font-bold transition-colors ${moduleType === m ? 'border-[#3fb950] text-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] text-[#8b949e] hover:border-[#484f58]'}`}>{({ incident: 'Incident', sql: 'SQL', monitoring: 'Monitoring', cognitive: 'Cognitive', postmortem: 'Postmortem', automation: 'Automation' }[m])}</button>
                        ))}
                      </div>
                    </div>

                    {moduleType === 'incident' && (
                      <div><label className={labelCls}>Scenario</label>
                        <div className="space-y-2">{SCENARIOS.map(s => <label key={s.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${scenarioId === s.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`}><input type="radio" name="scenario" value={s.id} checked={scenarioId === s.id} onChange={() => setScenarioId(s.id)} className="accent-[#3fb950]" /><span className="text-[#e6edf3] flex-1">{s.name}</span><span className="text-[#8b949e]">{s.timeLimit}min</span></label>)}</div>
                      </div>
                    )}

                    {moduleType === 'sql' && (
                      <div><label className={labelCls}>SQL Question</label>
                        {sqlQuestions.length === 0 ? <div className="text-[#484f58]">No SQL questions yet</div> : (
                          <div className="space-y-1.5">{sqlQuestions.map(q => (
                            <label key={q.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedQuestionId === q.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`}>
                              <input type="radio" name="sql_question" value={q.id} checked={selectedQuestionId === q.id} onChange={() => setSelectedQuestionId(q.id)} className="accent-[#3fb950]" />
                              <span className="text-[#e6edf3] flex-1">{q.title}</span>
                              <span className="text-[#484f58] text-[10px] uppercase">{q.difficulty} · {q.question_type}</span>
                              <button type="button" onClick={e => { e.preventDefault(); setPreviewSql(q) }} className="text-[#58a6ff] text-[10px] hover:underline px-2">Preview</button>
                            </label>
                          ))}</div>
                        )}
                      </div>
                    )}

                    {moduleType === 'monitoring' && (
                      <div><label className={labelCls}>Monitoring Question</label>
                        {monitoringQuestions.length === 0 ? <div className="text-[#484f58]">No monitoring questions yet</div> : (
                          <div className="space-y-1.5">{monitoringQuestions.map(q => (
                            <label key={q.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedQuestionId === q.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`}>
                              <input type="radio" name="mon_question" value={q.id} checked={selectedQuestionId === q.id} onChange={() => setSelectedQuestionId(q.id)} className="accent-[#3fb950]" />
                              <span className="text-[#e6edf3] flex-1">{q.title}</span>
                              <span className="text-[#484f58] text-[10px] uppercase">{q.difficulty}</span>
                            </label>
                          ))}</div>
                        )}
                      </div>
                    )}

                    {moduleType === 'cognitive' && <div className="bg-[#0d1117] border border-[#e3b341] rounded p-4"><div className="text-[#e3b341] font-bold mb-1">Cognitive Assessment</div><div className="text-[#8b949e] leading-relaxed">All {cogQuestions.length} cognitive questions are used automatically.</div></div>}

                    {moduleType === 'postmortem' && (
                      <div><label className={labelCls}>Postmortem Question</label>
                        {pmQuestions.length === 0 ? <div className="text-[#484f58]">No postmortem questions yet — create one in the Postmortem tab</div> : (
                          <div className="space-y-1.5">{pmQuestions.map(q => (
                            <label key={q.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedQuestionId === q.id ? 'border-[#d29922] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`}>
                              <input type="radio" name="pm_question" value={q.id} checked={selectedQuestionId === q.id} onChange={() => setSelectedQuestionId(q.id)} className="accent-[#d29922]" />
                              <span className="text-[#e6edf3] flex-1">{q.title}</span>
                              <span className="text-[#484f58] text-[10px] uppercase">{q.difficulty}</span>
                            </label>
                          ))}</div>
                        )}
                      </div>
                    )}

                    {moduleType === 'automation' && (
                      <div><label className={labelCls}>Automation Question</label>
                        {autoQuestions.length === 0 ? <div className="text-[#484f58]">No automation questions yet — create one in the Automation tab</div> : (
                          <div className="space-y-1.5">{autoQuestions.map(q => (
                            <label key={q.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedQuestionId === q.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`}>
                              <input type="radio" name="auto_question" value={q.id} checked={selectedQuestionId === q.id} onChange={() => setSelectedQuestionId(q.id)} className="accent-[#3fb950]" />
                              <span className="text-[#e6edf3] flex-1">{q.title}</span>
                              <span className="text-[#484f58] text-[10px] mr-2">{q.language}</span>
                              <span className="text-[#484f58] text-[10px] uppercase">{q.difficulty}</span>
                            </label>
                          ))}</div>
                        )}
                      </div>
                    )}

                    {/* Practice mode + time limit + pass threshold */}
                    <div className="flex gap-4 items-end flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={isPractice} onChange={e => setIsPractice(e.target.checked)} className="accent-[#f46800] w-4 h-4" />
                        <span className="text-[#8b949e]">Practice mode <span className="text-[#484f58]">(no scoring)</span></span>
                      </label>
                      <div className="flex-shrink-0">
                        <label className={labelCls}>Time limit (min)</label>
                        <input type="number" value={timeLimitMins} onChange={e => setTimeLimitMins(e.target.value)} placeholder="Default" className={inputCls + ' w-24'} min="1" max="120" />
                      </div>
                      <div className="flex-shrink-0">
                        <label className={labelCls}>Pass threshold (%)</label>
                        <input type="number" value={passThreshold} onChange={e => setPassThreshold(e.target.value)} className={inputCls + ' w-24'} min="0" max="100" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Active From (optional)</label>
                        <input
                          type="datetime-local"
                          value={activeFrom}
                          onChange={e => setActiveFrom(e.target.value)}
                          className={inputCls}
                        />
                        <div className="text-[#484f58] text-[10px] mt-1">Leave blank to activate immediately</div>
                      </div>
                      <div>
                        <label className={labelCls}>Active Until (optional)</label>
                        <input
                          type="datetime-local"
                          value={activeUntil}
                          onChange={e => setActiveUntil(e.target.value)}
                          className={inputCls}
                        />
                        <div className="text-[#484f58] text-[10px] mt-1">Leave blank for no expiry</div>
                      </div>
                    </div>

                    {createError   && <div className="text-[#f85149]">✗ {createError}</div>}
                    {createSuccess && (
                      <div className="flex items-center gap-3">
                        <span className="text-[#3fb950]">{createSuccess}</span>
                        {copiedLink && <span className="text-[#484f58] text-[10px]">✓ Login link copied to clipboard</span>}
                      </div>
                    )}
                    <button type="submit" disabled={!candidateName.trim() || creating} className="bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold py-2 px-6 rounded border border-[#2ea043] disabled:border-[#30363d] transition-all">{creating ? 'Assigning…' : '+ Assign & Copy Link'}</button>
                  </form>
                </div>

                {/* Assignments list */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest">Assignments ({assignments.length})</div>
                  {assignments.length === 0 ? <div className="px-5 py-8 text-center text-[#484f58]">No assignments yet</div> : (
                    <table className="w-full"><thead><tr className="text-[#484f58] border-b border-[#30363d]"><th className="text-left px-4 py-2">Candidate</th><th className="text-left px-4 py-2">Module</th><th className="text-left px-4 py-2">Created</th><th className="text-left px-4 py-2">Status</th><th className="px-4 py-2"></th></tr></thead>
                      <tbody>{assignments.map(a => (
                        <tr key={a.id} className="border-b border-[#30363d] last:border-0 hover:bg-[#1c2128] transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[#e6edf3] font-bold">{a.candidate_name}</span>
                              {a.is_practice && <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#f46800]/50 text-[#f46800]">PRACTICE</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${moduleBadgeClass(a.module_type ?? 'incident')}`}>{moduleLabel(a.module_type ?? 'incident')}</span></td>
                          <td className="px-4 py-2.5 text-[#484f58]">{fmt(a.created_at)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${a.status === 'pending' ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#484f58] text-[#484f58]'}`}>{a.status.toUpperCase()}</span>
                              {(a.active_from || a.active_until) && (
                                <span className="text-[9px] text-[#484f58]">
                                  🕐 {a.active_from ? `from ${fmt(a.active_from)}` : ''}{a.active_from && a.active_until ? ' ' : ''}{a.active_until ? `until ${fmt(a.active_until)}` : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right flex items-center gap-3 justify-end">
                            <button onClick={() => copyLink(a.candidate_name)} className="text-[#58a6ff] text-[10px] hover:underline" title="Copy login link">{copiedLink === a.candidate_name ? '✓ Copied' : '🔗 Link'}</button>
                            {a.status === 'used' && <button onClick={() => handleResetAssignment(a.id)} className="text-[#d29922] hover:text-[#e3b341] text-[10px] transition-colors" title="Reset to pending">↺ Reset</button>}
                            {a.status === 'pending' && <button onClick={() => handleDeleteAssignment(a.id)} className="text-[#484f58] hover:text-[#f85149] transition-colors">✕</button>}
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── RESULTS TAB ── */}
            {tab === 'results' && (
              <div className="space-y-5">
                {/* Stats header */}
                {resultStats && (
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: 'Total Sessions', value: resultStats.total, color: '#e6edf3' },
                      { label: 'Avg Score', value: resultStats.avg_score != null ? `${resultStats.avg_score}/100` : '—', color: resultStats.avg_score != null ? scoreColor(resultStats.avg_score) : '#484f58' },
                      { label: 'Median Score', value: resultStats.p50_score != null ? `${resultStats.p50_score}/100` : '—', color: resultStats.p50_score != null ? scoreColor(resultStats.p50_score) : '#484f58' },
                      { label: 'Passed (≥70)', value: resultStats.pass_count, color: '#3fb950' },
                      { label: 'Failed (<70)', value: resultStats.fail_count, color: resultStats.fail_count > 0 ? '#f85149' : '#484f58' },
                    ].map(s => (
                      <div key={s.label} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-[#484f58] text-[10px] uppercase tracking-widest mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Score distribution chart */}
                {results.length > 0 && (() => {
                  const buckets = [
                    { label: '0–20',  min: 0,  max: 20,  color: '#f85149' },
                    { label: '21–40', min: 21, max: 40,  color: '#f85149' },
                    { label: '41–60', min: 41, max: 60,  color: '#d29922' },
                    { label: '61–80', min: 61, max: 80,  color: '#d29922' },
                    { label: '81–100', min: 81, max: 100, color: '#3fb950' },
                  ]
                  const counts = buckets.map(b => results.filter(r => r.overall_score != null && r.overall_score >= b.min && r.overall_score <= b.max).length)
                  const maxCount = Math.max(...counts, 1)
                  return (
                    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                      <div className="text-[#8b949e] uppercase tracking-widest text-[10px] mb-4">Score Distribution</div>
                      <div className="flex items-end gap-3 h-24">
                        {buckets.map((b, i) => (
                          <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                            <div className="text-[#8b949e] text-[10px] font-bold">{counts[i]}</div>
                            <div className="w-full rounded-t" style={{ height: `${(counts[i] / maxCount) * 72}px`, minHeight: counts[i] > 0 ? 4 : 0, background: b.color, opacity: 0.8 }} />
                            <div className="text-[#484f58] text-[9px] text-center">{b.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] flex items-center justify-between gap-4">
                    <span className="text-[#8b949e] uppercase tracking-widest">Sessions ({filteredResults.length})</span>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {['all', 'incident', 'sql', 'monitoring', 'cognitive', 'postmortem', 'automation'].map(m => (
                          <button key={m} onClick={() => setFilterModule(m)} className={`px-2 py-1 rounded text-[10px] border transition-colors ${filterModule === m ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#30363d] text-[#484f58] hover:text-[#8b949e]'}`}>{m.toUpperCase()}</button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        {(['all', 'pass', 'fail'] as const).map(f => (
                          <button key={f} onClick={() => setFilterPassFail(f)} className={`px-2 py-1 rounded text-[10px] border transition-colors ${filterPassFail === f ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#30363d] text-[#484f58] hover:text-[#8b949e]'}`}>{f.toUpperCase()}</button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[#484f58]">
                        <span>Score:</span>
                        <input type="number" value={filterScoreMin} onChange={e => setFilterScoreMin(e.target.value)} placeholder="min" className="w-12 bg-[#0d1117] border border-[#30363d] rounded px-1 py-0.5 text-[#8b949e] text-[10px] focus:outline-none" />
                        <span>–</span>
                        <input type="number" value={filterScoreMax} onChange={e => setFilterScoreMax(e.target.value)} placeholder="max" className="w-12 bg-[#0d1117] border border-[#30363d] rounded px-1 py-0.5 text-[#8b949e] text-[10px] focus:outline-none" />
                      </div>
                      <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#58a6ff]/10 hover:bg-[#58a6ff]/20 border border-[#58a6ff]/40 text-[#58a6ff] rounded text-[11px] font-bold transition-all">↓ Export CSV</button>
                      <button onClick={loadResults} disabled={resultsLoading} className="text-[10px] px-3 py-1 rounded border border-[#30363d] text-[#484f58] hover:text-[#8b949e] transition-colors">{resultsLoading ? '⏳' : '↻ Refresh'}</button>
                    </div>
                  </div>
                  {resultsLoading && filteredResults.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#484f58] animate-pulse">Loading results…</div>
                  ) : filteredResults.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#484f58]">No completed sessions yet</div>
                  ) : (
                    <table className="w-full">
                      <thead><tr className="text-[#484f58] border-b border-[#30363d]"><th className="text-left px-4 py-2">Candidate</th><th className="text-left px-4 py-2">Module</th><th className="text-left px-4 py-2">Score</th><th className="text-left px-4 py-2">Duration</th><th className="text-left px-4 py-2">Date</th><th className="px-4 py-2"></th></tr></thead>
                      <tbody>
                        {filteredResults.map(r => (
                          <>
                            <tr key={r.id} onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)} className="border-b border-[#30363d] last:border-0 hover:bg-[#1c2128] transition-colors cursor-pointer">
                              <td className="px-4 py-2.5 text-[#e6edf3] font-bold">{r.candidate_name}</td>
                              <td className="px-4 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${moduleBadgeClass(r.module_type)}`}>{moduleLabel(r.module_type)}</span></td>
                              <td className="px-4 py-2.5">
                                {r.overall_score != null ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold tabular-nums" style={{ color: scoreColor(r.overall_score) }}>{r.overall_score}/100</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${r.overall_score >= 70 ? 'border-[#3fb950]/50 text-[#3fb950]' : 'border-[#f85149]/50 text-[#f85149]'}`}>{r.overall_score >= 70 ? 'PASS' : 'FAIL'}</span>
                                  </div>
                                ) : <span className="text-[#484f58]">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-[#484f58]">{r.duration_minutes != null ? `${r.duration_minutes} min` : '—'}</td>
                              <td className="px-4 py-2.5 text-[#484f58]">{r.started_at ? fmt(r.started_at) : '—'}</td>
                              <td className="px-4 py-2.5 text-right text-[#484f58] text-[10px]">{expandedRow === r.id ? '▾' : '▸'}</td>
                            </tr>
                            {expandedRow === r.id && (
                              <tr key={`${r.id}-exp`} className="border-b border-[#30363d] bg-[#0d1117]">
                                <td colSpan={6} className="px-6 py-4 space-y-4">
                                  {r.postmortem && (
                                    <div>
                                      <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-1.5">AI Assessor Feedback</div>
                                      <p className="text-[#8b949e] text-[11px] leading-relaxed">{r.postmortem}</p>
                                    </div>
                                  )}
                                  {/* Session replay */}
                                  <div>
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className="text-[#484f58] text-[10px] uppercase tracking-widest">Session Replay</div>
                                      {!replayData[r.id] && (
                                        <button onClick={() => loadReplay(r.id)} disabled={replayLoading === r.id} className="text-[10px] px-2 py-0.5 rounded border border-[#58a6ff]/40 text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-colors">
                                          {replayLoading === r.id ? '⏳ Loading…' : '▶ Load Events'}
                                        </button>
                                      )}
                                      {replayData[r.id] && replayData[r.id].length > 0 && (
                                        <button
                                          onClick={() => setReplayFlaggedOnly(f => !f)}
                                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${replayFlaggedOnly ? 'border-[#d29922]/60 text-[#d29922] bg-[#d29922]/10' : 'border-[#30363d] text-[#484f58] hover:text-[#8b949e]'}`}
                                        >
                                          ⭐ Flagged only
                                        </button>
                                      )}
                                    </div>
                                    {replayData[r.id] && (
                                      <div className="max-h-56 overflow-y-auto space-y-1 border border-[#21262d] rounded p-2 bg-[#0a0e13]">
                                        {replayData[r.id].length === 0 ? (
                                          <div className="text-[#484f58] text-[10px] text-center py-4">No events recorded for this session.</div>
                                        ) : replayData[r.id].filter(ev => {
                                          if (!replayFlaggedOnly) return true
                                          const cmd = String(ev.payload?.cmd ?? '').toLowerCase()
                                          return (
                                            ev.event_type === 'incident_resolved' ||
                                            ev.event_type === 'severity_declared' ||
                                            ev.event_type === 'remediation_attempted' ||
                                            ev.event_type === 'paste_detected' ||
                                            (ev.event_type === 'command_run' && (
                                              cmd.includes('scale') || cmd.includes('rollout') || cmd.includes('restart') ||
                                              cmd.includes('apply') || cmd.includes('delete') || cmd.includes('patch') ||
                                              cmd.includes('exec') || cmd.includes('fix') || cmd.includes('rollback')
                                            ))
                                          )
                                        }).map((ev, i) => (
                                          <div key={i} className="flex items-start gap-2 text-[10px]">
                                            <span className="text-[#484f58] flex-shrink-0 tabular-nums">{new Date(ev.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                            {(() => {
                                              const cmd = String(ev.payload?.cmd ?? '').toLowerCase()
                                              const isFlagged =
                                                ev.event_type === 'incident_resolved' ||
                                                ev.event_type === 'severity_declared' ||
                                                ev.event_type === 'remediation_attempted' ||
                                                ev.event_type === 'paste_detected' ||
                                                (ev.event_type === 'command_run' && (
                                                  cmd.includes('scale') || cmd.includes('rollout') || cmd.includes('restart') ||
                                                  cmd.includes('apply') || cmd.includes('delete') || cmd.includes('patch') ||
                                                  cmd.includes('exec') || cmd.includes('fix') || cmd.includes('rollback')
                                                ))
                                              return isFlagged ? <span className="flex-shrink-0 text-[10px]" title="High-impact action">⭐</span> : null
                                            })()}
                                            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                              ev.event_type === 'command_run' ? 'bg-[#58a6ff]/20 text-[#58a6ff]' :
                                              ev.event_type === 'alert_received' ? 'bg-[#f85149]/20 text-[#f85149]' :
                                              ev.event_type === 'incident_resolved' ? 'bg-[#3fb950]/20 text-[#3fb950]' :
                                              ev.event_type === 'severity_declared' ? 'bg-[#d29922]/20 text-[#d29922]' :
                                              'bg-[#30363d] text-[#8b949e]'
                                            }`}>{ev.event_type.replace(/_/g, ' ')}</span>
                                            <span className="text-[#8b949e] leading-relaxed truncate flex-1">
                                              {ev.event_type === 'command_run' ? String(ev.payload.cmd ?? '') :
                                               ev.event_type === 'alert_received' ? String(ev.payload.message ?? '') :
                                               ev.event_type === 'slack_sent' ? `#${ev.payload.channel}: ${ev.payload.message}` :
                                               ev.event_type === 'severity_declared' ? String(ev.payload.severity ?? '') :
                                               JSON.stringify(ev.payload).slice(0, 80)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {/* Time per question (cognitive only) */}
                                  {r.module_type === 'cognitive' && replayData[r.id] && (() => {
                                    const timeEvent = replayData[r.id].find(ev => ev.event_type === 'question_time_analytics')
                                    if (!timeEvent) return null
                                    const times = timeEvent.payload?.times as Record<string, number> | undefined
                                    if (!times || Object.keys(times).length === 0) return null
                                    const entries = Object.entries(times).sort(([, a], [, b]) => b - a)
                                    const maxTime = Math.max(...entries.map(([, t]) => t), 1)
                                    return (
                                      <div>
                                        <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-2">Time Per Question</div>
                                        <div className="space-y-1.5 bg-[#0a0e13] border border-[#21262d] rounded p-3">
                                          {entries.map(([qId, secs]) => (
                                            <div key={qId} className="flex items-center gap-2 text-[10px]">
                                              <span className="text-[#484f58] w-28 flex-shrink-0 truncate font-mono">{qId.slice(0, 8)}…</span>
                                              <div className="flex-1 h-1.5 bg-[#21262d] rounded overflow-hidden">
                                                <div className="h-full rounded bg-[#bc8cff]" style={{ width: `${(secs / maxTime) * 100}%` }} />
                                              </div>
                                              <span className="text-[#8b949e] w-12 text-right flex-shrink-0">{secs < 60 ? `${secs}s` : `${Math.floor(secs/60)}m${secs%60}s`}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {/* Assessor annotations */}
                                  <div>
                                    <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-2">Assessor Notes</div>
                                    {!annotations[r.id] && (
                                      <button onClick={() => loadAnnotations(r.id)} disabled={annotationsLoading === r.id}
                                        className="text-[10px] px-2 py-0.5 rounded border border-[#d29922]/40 text-[#d29922] hover:bg-[#d29922]/10 transition-colors">
                                        {annotationsLoading === r.id ? '⏳ Loading…' : '📝 Load Notes'}
                                      </button>
                                    )}
                                    {annotations[r.id] && (
                                      <div className="space-y-2">
                                        {annotations[r.id].length === 0 && <div className="text-[#484f58] text-[10px]">No notes yet.</div>}
                                        {annotations[r.id].map(a => (
                                          <div key={a.id} className="bg-[#1a1600] border border-[#d29922]/30 rounded px-3 py-2">
                                            <div className="text-[#d29922] text-[10px] mb-0.5">{fmt(a.created_at)}</div>
                                            <div className="text-[#c9d1d9] text-[11px] leading-relaxed">{a.text}</div>
                                          </div>
                                        ))}
                                        <div className="flex gap-2 mt-2">
                                          <input
                                            type="text"
                                            value={annotationText[r.id] ?? ''}
                                            onChange={e => setAnnotationText(t => ({ ...t, [r.id]: e.target.value }))}
                                            placeholder="Add a note for the candidate's debrief…"
                                            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-[#e6edf3] text-[11px] focus:outline-none focus:border-[#d29922] transition-colors"
                                            onKeyDown={e => { if (e.key === 'Enter') handleAddAnnotation(r.id) }}
                                          />
                                          <button onClick={() => handleAddAnnotation(r.id)}
                                            className="px-3 py-1.5 bg-[#d29922]/20 hover:bg-[#d29922]/40 border border-[#d29922]/50 text-[#d29922] rounded text-[10px] font-bold transition-colors">
                                            Save
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── SQL TAB ── */}
            {tab === 'sql' && (
              <div className="space-y-5">
                <div className="flex gap-4 items-start">
                  <SchemaBrowser />
                  <div className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                    <div className="text-[#8b949e] uppercase tracking-widest mb-4">{editingSql ? `Editing: ${editingSql.title}` : 'Create SQL Question'}</div>
                    <SqlForm onSubmit={editingSql ? handleUpdateSqlQuestion : handleCreateSqlQuestion} submitLabel={editingSql ? '✓ Save Changes' : '+ Create SQL Question'} />
                  </div>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] flex items-center justify-between">
                    <span className="text-[#8b949e] uppercase tracking-widest">Questions ({sqlQuestions.length})</span>
                    <button onClick={async () => { const r = await fetch(`${API_BASE}/sql/admin/seed`, { method: 'POST', headers: { 'x-admin-key': adminKey } }); const d = await r.json() as { inserted: number; skipped: number }; await loadSqlQuestions(); alert(`Seeded ${d.inserted} question(s). ${d.skipped} already existed.`) }} className="text-[10px] px-3 py-1 rounded border border-[#58a6ff]/40 text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-colors">⚡ Seed Defaults</button>
                  </div>
                  {sqlQuestions.length === 0 ? <div className="px-5 py-8 text-center text-[#484f58]">No SQL questions yet.</div> : (
                    <table className="w-full"><thead><tr className="text-[#484f58] border-b border-[#30363d]"><th className="text-left px-4 py-2">Title</th><th className="text-left px-4 py-2">Difficulty</th><th className="text-left px-4 py-2">Type</th><th className="text-left px-4 py-2">Time</th><th className="px-4 py-2"></th></tr></thead>
                      <tbody>{sqlQuestions.map(q => (
                        <tr key={q.id} className={`border-b border-[#30363d] last:border-0 hover:bg-[#1c2128] ${editingSql?.id === q.id ? 'bg-[#0f2a1a]' : ''}`}>
                          <td className="px-4 py-2.5 text-[#e6edf3]">{q.title}</td>
                          <td className="px-4 py-2.5 text-[#8b949e] uppercase text-[10px]">{q.difficulty}</td>
                          <td className="px-4 py-2.5 text-[#8b949e] uppercase text-[10px]">{q.question_type}</td>
                          <td className="px-4 py-2.5 text-[#484f58]">{Math.round(q.time_limit_seconds / 60)}min</td>
                          <td className="px-4 py-2.5 text-right flex gap-3 justify-end">
                            <button onClick={() => startEditSql(q)} className="text-[#58a6ff] hover:text-[#79c0ff] transition-colors text-[11px]">✏ Edit</button>
                            <button onClick={() => handleDeleteSqlQuestion(q.id)} className="text-[#484f58] hover:text-[#f85149] transition-colors">✕</button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── COGNITIVE TAB ── */}
            {tab === 'cognitive' && (
              <div className="space-y-5">
                <div id="cog-form-top" className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                  <div className="text-[#8b949e] uppercase tracking-widest mb-4">{editingCog ? 'Edit Question' : 'Create Cognitive Question'}</div>
                  <form onSubmit={handleCreateCog} className="space-y-3">
                    <div><label className={labelCls}>Question</label><textarea value={cogForm.question} onChange={e => setCogForm(f => ({ ...f, question: e.target.value }))} rows={3} placeholder="A server processes N requests per second…" className={inputCls + ' resize-none'} /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className={labelCls}>Type</label><select value={cogForm.type} onChange={e => setCogForm(f => ({ ...f, type: e.target.value }))} className={inputCls}><option value="mcq">Multiple Choice</option><option value="numerical">Numerical</option><option value="logical">Logical Reasoning</option></select></div>
                      <div><label className={labelCls}>Difficulty</label><select value={cogForm.difficulty} onChange={e => setCogForm(f => ({ ...f, difficulty: e.target.value }))} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                      <div><label className={labelCls}>Points</label><input type="number" value={cogForm.points} onChange={e => setCogForm(f => ({ ...f, points: e.target.value }))} className={inputCls} /></div>
                    </div>
                    {cogForm.type === 'mcq' && <div><label className={labelCls}>Options (JSON array)</label><textarea value={cogForm.options} onChange={e => setCogForm(f => ({ ...f, options: e.target.value }))} rows={2} placeholder='["Option A","Option B","Option C","Option D"]' className={inputCls + ' resize-none font-mono text-[11px]'} /></div>}
                    <div><label className={labelCls}>Correct Answer</label><input value={cogForm.correct_answer} onChange={e => setCogForm(f => ({ ...f, correct_answer: e.target.value }))} placeholder={cogForm.type === 'mcq' ? 'Option A' : '42'} className={inputCls} /></div>
                    <div><label className={labelCls}>Explanation (shown after submission)</label><textarea value={cogForm.explanation} onChange={e => setCogForm(f => ({ ...f, explanation: e.target.value }))} rows={2} placeholder="The correct answer is… because…" className={inputCls + ' resize-none'} /></div>
                    {cogFormError && <div className="text-[#f85149]">✗ {cogFormError}</div>}
                    {cogFormSuccess && <div className="text-[#3fb950]">{cogFormSuccess}</div>}
                    <div className="flex gap-3">
                      <button type="submit" className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all">{editingCog ? '✓ Save Changes' : '+ Create Question'}</button>
                      {editingCog && <button type="button" onClick={() => { setEditingCog(null); setCogForm(BLANK_COG_FORM) }} className="px-4 py-2 rounded border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors">Cancel</button>}
                    </div>
                  </form>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest">Questions ({cogQuestions.length})</div>
                  {cogQuestions.length === 0 ? <div className="px-5 py-8 text-center text-[#484f58]">No cognitive questions yet.</div> : (
                    <table className="w-full"><thead><tr className="text-[#484f58] border-b border-[#30363d]"><th className="text-left px-4 py-2">Question</th><th className="text-left px-4 py-2">Type</th><th className="text-left px-4 py-2">Difficulty</th><th className="text-left px-4 py-2">Points</th><th className="px-4 py-2"></th></tr></thead>
                      <tbody>{cogQuestions.map(q => (
                        <tr key={q.id} className={`border-b border-[#30363d] last:border-0 hover:bg-[#1c2128] ${editingCog?.id === q.id ? 'bg-[#0f2a1a]' : ''}`}>
                          <td className="px-4 py-2.5 text-[#e6edf3] max-w-xs truncate">{q.question}</td>
                          <td className="px-4 py-2.5 text-[#8b949e] uppercase text-[10px]">{q.type}</td>
                          <td className="px-4 py-2.5 text-[#8b949e] uppercase text-[10px]">{q.difficulty}</td>
                          <td className="px-4 py-2.5 text-[#484f58]">{q.points} pts</td>
                          <td className="px-4 py-2.5 text-right flex gap-3 justify-end">
                            <button onClick={() => duplicateCog(q)} className="text-[#3fb950] hover:text-[#56d364] transition-colors text-[11px]" title="Duplicate">⎘</button>
                            <button onClick={() => startEditCog(q)} className="text-[#58a6ff] hover:text-[#79c0ff] transition-colors text-[11px]">✏ Edit</button>
                            <button onClick={() => handleDeleteCog(q.id)} className="text-[#484f58] hover:text-[#f85149] transition-colors">✕</button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── MONITORING TAB ── */}
            {tab === 'monitoring' && (
              <div className="space-y-5">
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                  <div className="text-[#8b949e] uppercase tracking-widest mb-4">Create Monitoring Question</div>
                  <form onSubmit={handleCreateMonitoring} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelCls}>Title</label><input value={monForm.title} onChange={e => setMonForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Redis Cache Alerting Setup" className={inputCls} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className={labelCls}>Difficulty</label><select value={monForm.difficulty} onChange={e => setMonForm(f => ({ ...f, difficulty: e.target.value }))} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                        <div><label className={labelCls}>Time Limit (sec)</label><input type="number" value={monForm.time_limit_seconds} onChange={e => setMonForm(f => ({ ...f, time_limit_seconds: e.target.value }))} className={inputCls} /></div>
                      </div>
                    </div>
                    <div><label className={labelCls}>Scenario</label><textarea value={monForm.scenario} onChange={e => setMonForm(f => ({ ...f, scenario: e.target.value }))} rows={4} placeholder="Describe the system context…" className={inputCls + ' resize-none'} /></div>
                    <div>
                      <label className={labelCls}>Sub-Questions (JSON array)</label>
                      <div className="text-[#484f58] text-[10px] mb-1.5">{'[{ "id": "metrics", "prompt": "...", "type": "metrics|alerting|investigation|sli_slo|error_budget|alert_fatigue|dashboard", "placeholder": "...", "required_keywords": [], "bonus_keywords": [], "reference_answer": "..." }]'}</div>
                      <textarea value={monForm.sub_questions} onChange={e => setMonForm(f => ({ ...f, sub_questions: e.target.value }))} rows={10} placeholder={'[\n  {\n    "id": "metrics",\n    "prompt": "List the 5 most critical metrics…",\n    "type": "metrics",\n    "placeholder": "Metric 1: Error rate…",\n    "required_keywords": ["threshold","error rate"],\n    "bonus_keywords": ["p99","latency"],\n    "reference_answer": "Key metrics are…"\n  }\n]'} className={inputCls + ' resize-none font-mono text-[11px]'} />
                    </div>
                    {monFormError && <div className="text-[#f85149]">✗ {monFormError}</div>}
                    {monFormSuccess && <div className="text-[#3fb950]">{monFormSuccess}</div>}
                    <button type="submit" className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all">+ Create Monitoring Question</button>
                  </form>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] flex items-center justify-between">
                    <span className="text-[#8b949e] uppercase tracking-widest">Questions ({monitoringQuestions.length})</span>
                    <button onClick={async () => { const r = await fetch(`${API_BASE}/monitoring/admin/seed`, { method: 'POST', headers: { 'x-admin-key': adminKey } }); const d = await r.json() as { inserted: number; skipped: number }; await loadMonitoringQuestions(); alert(`Seeded ${d.inserted} question(s). ${d.skipped} already existed.`) }} className="text-[10px] px-3 py-1 rounded border border-[#bc8cff]/40 text-[#bc8cff] hover:bg-[#bc8cff]/10 transition-colors">⚡ Seed Defaults</button>
                  </div>
                  {monitoringQuestions.length === 0 ? <div className="px-5 py-8 text-center text-[#484f58]">No monitoring questions yet.</div> : (
                    <table className="w-full"><thead><tr className="text-[#484f58] border-b border-[#30363d]"><th className="text-left px-4 py-2">Title</th><th className="text-left px-4 py-2">Difficulty</th><th className="text-left px-4 py-2">Time</th><th className="px-4 py-2"></th></tr></thead>
                      <tbody>{monitoringQuestions.map(q => <tr key={q.id} className="border-b border-[#30363d] last:border-0 hover:bg-[#1c2128]"><td className="px-4 py-2.5 text-[#e6edf3]">{q.title}</td><td className="px-4 py-2.5 text-[#8b949e] uppercase text-[10px]">{q.difficulty}</td><td className="px-4 py-2.5 text-[#484f58]">{Math.round(q.time_limit_seconds / 60)}min</td><td className="px-4 py-2.5 text-right"><button onClick={() => handleDeleteMonitoring(q.id)} className="text-[#484f58] hover:text-[#f85149] transition-colors">✕</button></td></tr>)}</tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
            {/* ── POSTMORTEM TAB ── */}
            {tab === 'postmortem' && (
              <div className="space-y-5">
                <div id="pm-form-top" className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                  <div className="text-[#8b949e] uppercase tracking-widest mb-4">{editingPm ? `Editing: ${editingPm.title}` : 'Create Postmortem Question'}</div>
                  <form onSubmit={handleCreatePm} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelCls}>Title</label><input value={pmForm.title} onChange={e => setPmForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Payment Service Outage" className={inputCls} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className={labelCls}>Difficulty</label><select value={pmForm.difficulty} onChange={e => setPmForm(f => ({ ...f, difficulty: e.target.value }))} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                        <div><label className={labelCls}>Time (sec)</label><input type="number" value={pmForm.time_limit_seconds} onChange={e => setPmForm(f => ({ ...f, time_limit_seconds: e.target.value }))} className={inputCls} /></div>
                      </div>
                    </div>
                    <div><label className={labelCls}>Incident Summary</label><textarea value={pmForm.incident_summary} onChange={e => setPmForm(f => ({ ...f, incident_summary: e.target.value }))} rows={5} placeholder="Describe the incident: what happened, impact, how it was detected and resolved…" className={inputCls + ' resize-none'} /></div>
                    <div>
                      <label className={labelCls}>Timeline (JSON array)</label>
                      <div className="text-[#484f58] text-[10px] mb-1.5">{'[{ "time": "14:32", "description": "Alerts fired for payment service" }]'}</div>
                      <textarea value={pmForm.timeline} onChange={e => setPmForm(f => ({ ...f, timeline: e.target.value }))} rows={6} placeholder={'[\n  { "time": "14:32", "description": "Alerts fired" },\n  { "time": "14:45", "description": "Root cause identified" }\n]'} className={inputCls + ' resize-none font-mono text-[11px]'} />
                    </div>
                    {pmFormError && <div className="text-[#f85149]">✗ {pmFormError}</div>}
                    {pmFormSuccess && <div className="text-[#3fb950]">{pmFormSuccess}</div>}
                    <div className="flex gap-3">
                      <button type="submit" className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all">{editingPm ? '✓ Save Changes' : '+ Create Question'}</button>
                      {editingPm && <button type="button" onClick={() => { setEditingPm(null); setPmForm(BLANK_PM_FORM) }} className="px-4 py-2 rounded border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors">Cancel</button>}
                    </div>
                  </form>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest">Questions ({pmQuestions.length})</div>
                  {pmQuestions.length === 0 ? <div className="px-5 py-8 text-center text-[#484f58]">No postmortem questions yet.</div> : (
                    <table className="w-full"><thead><tr className="text-[#484f58] border-b border-[#30363d]"><th className="text-left px-4 py-2">Title</th><th className="text-left px-4 py-2">Difficulty</th><th className="text-left px-4 py-2">Time</th><th className="px-4 py-2"></th></tr></thead>
                      <tbody>{pmQuestions.map(q => (
                        <tr key={q.id} className={`border-b border-[#30363d] last:border-0 hover:bg-[#1c2128] ${editingPm?.id === q.id ? 'bg-[#0f2a1a]' : ''}`}>
                          <td className="px-4 py-2.5 text-[#e6edf3]">{q.title}</td>
                          <td className="px-4 py-2.5 text-[#8b949e] uppercase text-[10px]">{q.difficulty}</td>
                          <td className="px-4 py-2.5 text-[#484f58]">{Math.round(q.time_limit_seconds / 60)}min</td>
                          <td className="px-4 py-2.5 text-right flex gap-3 justify-end">
                            <button onClick={() => duplicatePm(q)} className="text-[#3fb950] hover:text-[#56d364] transition-colors text-[11px]" title="Duplicate">⎘</button>
                            <button onClick={() => startEditPm(q)} className="text-[#58a6ff] hover:text-[#79c0ff] transition-colors text-[11px]">✏ Edit</button>
                            <button onClick={() => handleDeletePm(q.id)} className="text-[#484f58] hover:text-[#f85149] transition-colors">✕</button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── AUTOMATION TAB ── */}
            {tab === 'automation' && (
              <div className="space-y-5">
                <div id="auto-form-top" className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
                  <div className="text-[#8b949e] uppercase tracking-widest mb-4">{editingAuto ? `Editing: ${editingAuto.title}` : 'Create Automation Question'}</div>
                  <form onSubmit={handleCreateAuto} className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2"><label className={labelCls}>Title</label><input value={autoForm.title} onChange={e => setAutoForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Write a Disk Usage Alert Script" className={inputCls} /></div>
                      <div><label className={labelCls}>Language</label><select value={autoForm.language} onChange={e => setAutoForm(f => ({ ...f, language: e.target.value }))} className={inputCls}><option value="bash">Bash</option><option value="python">Python</option><option value="terraform">Terraform</option><option value="ansible">Ansible</option><option value="go">Go</option></select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelCls}>Difficulty</label><select value={autoForm.difficulty} onChange={e => setAutoForm(f => ({ ...f, difficulty: e.target.value }))} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                      <div><label className={labelCls}>Time (sec)</label><input type="number" value={autoForm.time_limit_seconds} onChange={e => setAutoForm(f => ({ ...f, time_limit_seconds: e.target.value }))} className={inputCls} /></div>
                    </div>
                    <div><label className={labelCls}>Description</label><textarea value={autoForm.description} onChange={e => setAutoForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Brief overview of the question…" className={inputCls + ' resize-none'} /></div>
                    <div><label className={labelCls}>Task / Requirements</label><textarea value={autoForm.task} onChange={e => setAutoForm(f => ({ ...f, task: e.target.value }))} rows={5} placeholder="Detailed requirements the candidate must implement…" className={inputCls + ' resize-none'} /></div>
                    <div><label className={labelCls}>Starter Code</label><textarea value={autoForm.starter_code} onChange={e => setAutoForm(f => ({ ...f, starter_code: e.target.value }))} rows={5} placeholder="#!/bin/bash&#10;# Your script here" className={inputCls + ' resize-none font-mono text-[11px]'} /></div>
                    <div>
                      <label className={labelCls}>Evaluation Criteria (JSON array)</label>
                      <div className="text-[#484f58] text-[10px] mb-1.5">{'[{ "label": "Error Handling", "description": "Proper use of set -e and exit codes" }]'}</div>
                      <textarea value={autoForm.evaluation_criteria} onChange={e => setAutoForm(f => ({ ...f, evaluation_criteria: e.target.value }))} rows={5} placeholder={'[\n  { "label": "Correctness", "description": "Script achieves the stated goal" },\n  { "label": "Error Handling", "description": "Handles failures gracefully" }\n]'} className={inputCls + ' resize-none font-mono text-[11px]'} />
                    </div>
                    {autoFormError && <div className="text-[#f85149]">✗ {autoFormError}</div>}
                    {autoFormSuccess && <div className="text-[#3fb950]">{autoFormSuccess}</div>}
                    <div className="flex gap-3">
                      <button type="submit" className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all">{editingAuto ? '✓ Save Changes' : '+ Create Question'}</button>
                      {editingAuto && <button type="button" onClick={() => { setEditingAuto(null); setAutoForm(BLANK_AUTO_FORM) }} className="px-4 py-2 rounded border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors">Cancel</button>}
                    </div>
                  </form>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest">Questions ({autoQuestions.length})</div>
                  {autoQuestions.length === 0 ? <div className="px-5 py-8 text-center text-[#484f58]">No automation questions yet.</div> : (
                    <table className="w-full"><thead><tr className="text-[#484f58] border-b border-[#30363d]"><th className="text-left px-4 py-2">Title</th><th className="text-left px-4 py-2">Language</th><th className="text-left px-4 py-2">Difficulty</th><th className="text-left px-4 py-2">Time</th><th className="px-4 py-2"></th></tr></thead>
                      <tbody>{autoQuestions.map(q => (
                        <tr key={q.id} className={`border-b border-[#30363d] last:border-0 hover:bg-[#1c2128] ${editingAuto?.id === q.id ? 'bg-[#0f2a1a]' : ''}`}>
                          <td className="px-4 py-2.5 text-[#e6edf3]">{q.title}</td>
                          <td className="px-4 py-2.5 text-[#3fb950] text-[10px] uppercase">{q.language}</td>
                          <td className="px-4 py-2.5 text-[#8b949e] uppercase text-[10px]">{q.difficulty}</td>
                          <td className="px-4 py-2.5 text-[#484f58]">{Math.round(q.time_limit_seconds / 60)}min</td>
                          <td className="px-4 py-2.5 text-right flex gap-3 justify-end">
                            <button onClick={() => duplicateAuto(q)} className="text-[#3fb950] hover:text-[#56d364] transition-colors text-[11px]" title="Duplicate">⎘</button>
                            <button onClick={() => startEditAuto(q)} className="text-[#58a6ff] hover:text-[#79c0ff] transition-colors text-[11px]">✏ Edit</button>
                            <button onClick={() => handleDeleteAuto(q.id)} className="text-[#484f58] hover:text-[#f85149] transition-colors">✕</button>
                          </td>
                        </tr>
                      ))}</tbody>
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
