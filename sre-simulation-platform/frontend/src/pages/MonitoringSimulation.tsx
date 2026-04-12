import { useState, useEffect, useRef } from 'react'
import { SessionInfo } from '../types'
import CountdownTimer from '../components/CountdownTimer'
import FeedbackForm from '../components/FeedbackForm'

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')

// ── Palette items ──────────────────────────────────────────────────────────
interface PaletteItem {
  id: string
  type: 'datasource' | 'dashboard' | 'alert_rule' | 'notification_policy' | 'contact_point'
  label: string
  icon: string
  desc: string
  color: string
}

const PALETTE: PaletteItem[] = [
  { id: 'prometheus',       type: 'datasource',          label: 'Prometheus',         icon: '⬡',  desc: 'Metrics scraping & storage',    color: '#e6522c' },
  { id: 'loki',             type: 'datasource',          label: 'Loki',               icon: '📋', desc: 'Log aggregation',               color: '#f2a900' },
  { id: 'tempo',            type: 'datasource',          label: 'Tempo',              icon: '🔗', desc: 'Distributed tracing',           color: '#5194f0' },
  { id: 'cloud-monitoring', type: 'datasource',          label: 'Cloud Monitoring',   icon: '☁',  desc: 'GCP native metrics',            color: '#4285f4' },
  { id: 'grafana-dash',     type: 'dashboard',           label: 'Grafana Dashboard',  icon: '📊', desc: 'Visualization & panels',        color: '#f46800' },
  { id: 'alert-rule',       type: 'alert_rule',          label: 'Alert Rule',         icon: '⚡', desc: 'Threshold-based alert',         color: '#d29922' },
  { id: 'recording-rule',   type: 'alert_rule',          label: 'Recording Rule',     icon: '📝', desc: 'Pre-computed metric query',     color: '#d29922' },
  { id: 'notif-policy',     type: 'notification_policy', label: 'Routing Policy',     icon: '🔀', desc: 'Group & route alerts',          color: '#58a6ff' },
  { id: 'inhibition',       type: 'notification_policy', label: 'Inhibition Rule',    icon: '🚫', desc: 'Suppress downstream noise',     color: '#58a6ff' },
  { id: 'pagerduty',        type: 'contact_point',       label: 'PagerDuty',          icon: '📟', desc: 'On-call paging',                color: '#3fb950' },
  { id: 'slack-notif',      type: 'contact_point',       label: 'Slack',              icon: '💬', desc: 'Channel notifications',         color: '#3fb950' },
  { id: 'opsgenie',         type: 'contact_point',       label: 'OpsGenie',           icon: '🔔', desc: 'Alert management platform',    color: '#3fb950' },
]

const PALETTE_GROUPS: { type: PaletteItem['type']; label: string }[] = [
  { type: 'datasource',          label: 'Data Sources' },
  { type: 'dashboard',           label: 'Visualization' },
  { type: 'alert_rule',          label: 'Alert Rules' },
  { type: 'notification_policy', label: 'Routing' },
  { type: 'contact_point',       label: 'Contact Points' },
]

// ── Pipeline stages ────────────────────────────────────────────────────────
interface PipelineStage {
  id: string
  label: string
  sublabel: string
  accepts: PaletteItem['type'][]
  maxItems: number
  hint: string
  borderColor: string
  bgColor: string
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'collection',    label: 'Data Collection',  sublabel: 'Sources & Telemetry',
    accepts: ['datasource'],          maxItems: 3,
    hint: 'Where does your telemetry come from?',
    borderColor: '#e6522c', bgColor: '#e6522c14',
  },
  {
    id: 'visualization', label: 'Visualization',    sublabel: 'Dashboards & Panels',
    accepts: ['dashboard'],           maxItems: 1,
    hint: 'How do engineers observe the system?',
    borderColor: '#f46800', bgColor: '#f4680014',
  },
  {
    id: 'detection',     label: 'Alert Detection',  sublabel: 'Rules & Thresholds',
    accepts: ['alert_rule'],          maxItems: 3,
    hint: 'What conditions trigger an alert?',
    borderColor: '#d29922', bgColor: '#d2992214',
  },
  {
    id: 'routing',       label: 'Alert Routing',    sublabel: 'Policies & Inhibitions',
    accepts: ['notification_policy'], maxItems: 2,
    hint: 'How do you group, route, and suppress?',
    borderColor: '#58a6ff', bgColor: '#58a6ff14',
  },
  {
    id: 'notification',  label: 'Notification',     sublabel: 'Contact Points',
    accepts: ['contact_point'],       maxItems: 3,
    hint: 'Who gets paged and through which channel?',
    borderColor: '#3fb950', bgColor: '#3fb95014',
  },
]

// ── Other types ────────────────────────────────────────────────────────────
interface SubQuestion {
  id: string
  prompt: string
  type: string
  placeholder: string
}

interface MonitoringQuestion {
  id: string
  title: string
  scenario: string
  difficulty: 'easy' | 'medium' | 'hard'
  time_limit_seconds: number
  sub_questions: SubQuestion[]
}

interface ScoreResult {
  score: number
  rating: 'Good' | 'Managing' | 'Learning'
  scorecard: {
    dimensions: Record<string, { score: number; max: number }>
    timeline_highlights: string[]
    postmortem_summary: string
  }
  sub_scores: { id: string; score: number; reference_answer: string }[]
}

interface Props { sessionInfo: SessionInfo }

const STEP_META: Record<string, { icon: string; label: string }> = {
  datasource:          { icon: '⬡',  label: 'Data Sources' },
  alert_rule:          { icon: '⚡', label: 'Alert Rules' },
  contact_point:       { icon: '📣', label: 'Contact Points' },
  notification_policy: { icon: '🔀', label: 'Notification Policies' },
  metrics:             { icon: '📊', label: 'Key Metrics' },
  alerting:            { icon: '🔔', label: 'Alerting Strategy' },
  investigation:       { icon: '🔍', label: 'Investigation Steps' },
  sli_slo:             { icon: '🎯', label: 'SLI / SLO' },
  error_budget:        { icon: '⏱', label: 'Error Budget' },
  alert_fatigue:       { icon: '🧹', label: 'Alert Hygiene' },
  dashboard:           { icon: '📈', label: 'Dashboard Design' },
  k8s_metrics:         { icon: '☸',  label: 'K8s Metrics' },
  logging:             { icon: '📋', label: 'Logging Strategy' },
  tracing:             { icon: '🔗', label: 'Distributed Tracing' },
  runbook:             { icon: '📖', label: 'Runbook' },
}

// ── Pipeline Design phase ──────────────────────────────────────────────────
interface PipelineDesignProps {
  scenario: string
  title: string
  pipelineLayout: Record<string, string[]>
  setPipelineLayout: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  onContinue: () => void
}

function PipelineDesign({ scenario, title, pipelineLayout, setPipelineLayout, onContinue }: PipelineDesignProps) {
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)
  const draggingRef = useRef<string | null>(null)

  const placedIds = new Set(Object.values(pipelineLayout).flat())

  function handleDragStart(e: React.DragEvent, itemId: string) {
    draggingRef.current = itemId
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, slotId: string) {
    e.preventDefault()
    const item = PALETTE.find(p => p.id === draggingRef.current)
    const slot = PIPELINE_STAGES.find(s => s.id === slotId)
    if (item && slot && slot.accepts.includes(item.type)) {
      e.dataTransfer.dropEffect = 'move'
      setDragOverSlot(slotId)
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
  }

  function handleDragLeave() { setDragOverSlot(null) }

  function handleDrop(e: React.DragEvent, slotId: string) {
    e.preventDefault()
    setDragOverSlot(null)
    const itemId = draggingRef.current
    draggingRef.current = null
    if (!itemId) return
    const item = PALETTE.find(p => p.id === itemId)
    const slot = PIPELINE_STAGES.find(s => s.id === slotId)
    if (!item || !slot || !slot.accepts.includes(item.type)) return
    const current = pipelineLayout[slotId] || []
    if (current.length >= slot.maxItems || current.includes(itemId)) return
    setPipelineLayout(l => ({ ...l, [slotId]: [...l[slotId], itemId] }))
  }

  function removeFromSlot(slotId: string, itemId: string) {
    setPipelineLayout(l => ({ ...l, [slotId]: l[slotId].filter(id => id !== itemId) }))
  }

  const totalPlaced = Object.values(pipelineLayout).flat().length
  const canContinue = totalPlaced >= 4

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: palette */}
      <div className="w-52 bg-[#111217] border-r border-[#2d2f3a] flex flex-col flex-shrink-0 overflow-y-auto">
        <div className="p-3 border-b border-[#2d2f3a]">
          <div className="text-[#888] uppercase tracking-widest text-[10px] mb-0.5">Components</div>
          <div className="text-[#555] text-[9px]">Drag onto the pipeline →</div>
        </div>
        <div className="flex-1 py-2 px-2 space-y-3">
          {PALETTE_GROUPS.map(group => {
            const items = PALETTE.filter(p => p.type === group.type)
            return (
              <div key={group.type}>
                <div className="text-[#484f58] uppercase tracking-widest text-[9px] mb-1.5 px-1">{group.label}</div>
                <div className="space-y-1">
                  {items.map(item => {
                    const isPlaced = placedIds.has(item.id)
                    return (
                      <div
                        key={item.id}
                        draggable={!isPlaced}
                        onDragStart={e => handleDragStart(e, item.id)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[11px] transition-all select-none ${
                          isPlaced
                            ? 'border-[#2d2f3a] text-[#484f58] bg-[#1a1c22] opacity-40 cursor-default'
                            : 'border-[#30363d] text-[#c9d1d9] bg-[#161b22] cursor-grab hover:border-[#484f58] active:cursor-grabbing'
                        }`}
                        style={!isPlaced ? { borderColor: `${item.color}40` } : undefined}
                      >
                        <span className="text-sm flex-shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <div className="font-bold truncate" style={!isPlaced ? { color: item.color } : undefined}>{item.label}</div>
                          <div className="text-[9px] text-[#484f58] truncate">{item.desc}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: canvas */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
        {/* Scenario reminder */}
        <div className="px-5 py-3 border-b border-[#2d2f3a] bg-[#111217] flex-shrink-0">
          <div className="text-[#f46800] text-[10px] uppercase tracking-widest mb-0.5">Challenge — {title}</div>
          <div className="text-[#8b949e] text-[11px] leading-relaxed line-clamp-2">{scenario.slice(0, 220)}…</div>
        </div>

        {/* Pipeline stages */}
        <div className="flex-1 overflow-auto p-5">
          <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-4">
            Build your monitoring pipeline — drag the right components into each stage
          </div>
          <div className="flex gap-2 min-w-max">
            {PIPELINE_STAGES.map((stage, si) => {
              const placed = (pipelineLayout[stage.id] || []).map(id => PALETTE.find(p => p.id === id)!)
              const isOver = dragOverSlot === stage.id
              return (
                <div key={stage.id} className="flex items-center gap-2">
                  {/* Stage box */}
                  <div
                    onDragOver={e => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, stage.id)}
                    className="w-36 rounded-lg border-2 transition-all"
                    style={{
                      borderColor: isOver ? stage.borderColor : `${stage.borderColor}60`,
                      background: isOver ? stage.bgColor : '#161b22',
                      boxShadow: isOver ? `0 0 12px ${stage.borderColor}40` : 'none',
                    }}
                  >
                    {/* Stage header */}
                    <div className="px-3 py-2 border-b" style={{ borderColor: `${stage.borderColor}30` }}>
                      <div className="font-bold text-[11px]" style={{ color: stage.borderColor }}>{stage.label}</div>
                      <div className="text-[#484f58] text-[9px]">{stage.sublabel}</div>
                    </div>

                    {/* Drop zone */}
                    <div className="p-2 min-h-[100px] space-y-1.5">
                      {placed.map(item => item && (
                        <div
                          key={item.id}
                          className="flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] group"
                          style={{ borderColor: `${item.color}50`, background: `${item.color}10` }}
                        >
                          <span className="text-xs">{item.icon}</span>
                          <span className="flex-1 truncate font-bold" style={{ color: item.color }}>{item.label}</span>
                          <button
                            onClick={() => removeFromSlot(stage.id, item.id)}
                            className="text-[#484f58] hover:text-[#f85149] opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                          >×</button>
                        </div>
                      ))}
                      {placed.length < stage.maxItems && (
                        <div
                          className="rounded border border-dashed px-2 py-2 text-center"
                          style={{ borderColor: `${stage.borderColor}30`, color: `${stage.borderColor}60` }}
                        >
                          <div className="text-[9px]">{isOver ? 'Drop here' : stage.hint}</div>
                        </div>
                      )}
                    </div>

                    {/* Capacity indicator */}
                    <div className="px-3 py-1.5 border-t" style={{ borderColor: `${stage.borderColor}20` }}>
                      <div className="flex gap-1">
                        {Array.from({ length: stage.maxItems }).map((_, ci) => (
                          <div
                            key={ci}
                            className="h-1 flex-1 rounded-full"
                            style={{ background: ci < placed.length ? stage.borderColor : '#21262d' }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Arrow between stages */}
                  {si < PIPELINE_STAGES.length - 1 && (
                    <div className="text-[#30363d] text-lg flex-shrink-0">→</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Validation hint */}
          <div className="mt-5 flex items-center gap-3">
            <div className="text-[#484f58] text-[11px]">
              {totalPlaced === 0
                ? 'Start by dragging a data source into the first stage'
                : totalPlaced < 4
                ? `${totalPlaced} component${totalPlaced !== 1 ? 's' : ''} placed — add at least ${4 - totalPlaced} more to continue`
                : `${totalPlaced} components placed ✓`
              }
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2d2f3a] bg-[#111217] flex items-center justify-between flex-shrink-0">
          <div className="text-[#484f58] text-[11px]">
            Design your full observability pipeline, then answer conceptual questions
          </div>
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className="px-6 py-2 bg-[#f46800] hover:bg-[#ff7a00] disabled:bg-[#21262d] disabled:text-[#484f58] text-white font-bold rounded transition-all text-[11px]"
          >
            Continue to Questions →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MonitoringSimulation({ sessionInfo }: Props) {
  const [question, setQuestion]         = useState<MonitoringQuestion | null>(null)
  const [loadError, setLoadError]       = useState('')
  const [answers, setAnswers]           = useState<Record<string, string>>({})
  const [saved, setSaved]               = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting]     = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [scoreResult, setScoreResult]   = useState<ScoreResult | null>(null)
  const [timedOut, setTimedOut]         = useState(false)
  const [activeIdx, setActiveIdx]       = useState(0)
  const [showTimeUpModal, setShowTimeUpModal] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [phase, setPhase]               = useState<'pipeline' | 'questions'>('pipeline')
  const [pipelineLayout, setPipelineLayout] = useState<Record<string, string[]>>(
    Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, []]))
  )
  const autoSubmittedRef  = useRef(false)

  const timeLimit = question?.time_limit_seconds ?? (sessionInfo.time_limit_minutes * 60)

  useEffect(() => {
    if (!sessionInfo.question_id) { setLoadError('No question assigned. Contact your assessor.'); return }
    fetch(`${API_BASE}/monitoring/questions/${sessionInfo.question_id}`)
      .then(r => r.json())
      .then((q: MonitoringQuestion) => {
        setQuestion(q)
        const init: Record<string, string> = {}
        q.sub_questions.forEach(sq => { init[sq.id] = '' })
        setAnswers(init)
      })
      .catch(() => setLoadError('Failed to load question. Please refresh.'))
  }, [sessionInfo.question_id])

  function handleTimerExpire() {
    if (autoSubmittedRef.current || submitted) return
    autoSubmittedRef.current = true
    setTimedOut(true)
    setShowTimeUpModal(true)
    doSubmit()
  }

  async function doSubmit() {
    if (!question || submitting || submitted) return
    setSubmitting(true)
    try {
      // include pipeline design as a special answer
      const pipelineAnswer = JSON.stringify(pipelineLayout)
      const answerList = [
        { id: 'pipeline_design', answer: pipelineAnswer },
        ...question.sub_questions.map(sq => ({ id: sq.id, answer: answers[sq.id] ?? '' })),
      ]
      const res = await fetch(`${API_BASE}/monitoring/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: sessionInfo.session_id, question_id: question.id, answers: answerList })
      })
      const data = await res.json() as ScoreResult
      setScoreResult(data)
      setSubmitted(true)
      setShowTimeUpModal(false)
      setShowFeedback(true)
    } catch (err) {
      alert('Submit failed: ' + String(err))
    } finally {
      setSubmitting(false)
    }
  }

  function handleSaveStep() {
    const subQ = question?.sub_questions[activeIdx]
    if (!subQ) return
    setSaved(s => ({ ...s, [subQ.id]: true }))
    if (question && activeIdx < question.sub_questions.length - 1) {
      setActiveIdx(i => i + 1)
    }
  }

  function handleProceedToQuestions() {
    setPipelineLayout(l => l)   // freeze layout
    setPhase('questions')
  }

  if (loadError) return (
    <div className="min-h-screen bg-[#111217] flex items-center justify-center">
      <div className="text-[#f85149] font-mono text-sm">{loadError}</div>
    </div>
  )

  if (!question) return (
    <div className="min-h-screen bg-[#111217] flex items-center justify-center">
      <div className="text-[#8b949e] font-mono text-sm animate-pulse">Loading question…</div>
    </div>
  )

  const subQ     = question.sub_questions[activeIdx]
  const subScore = scoreResult?.sub_scores.find(s => s.id === subQ?.id)

  return (
    <div className="min-h-screen bg-[#111217] font-mono text-xs flex flex-col">

      {showFeedback && <FeedbackForm sessionId={sessionInfo.session_id} onDone={() => setShowFeedback(false)} />}
      {/* Submission banner */}
      {submitted && (
        <div className="bg-[#0f2a1a] border-b border-[#3fb950] px-4 py-3 text-center flex-shrink-0">
          <span className="text-[#3fb950] font-bold text-sm">✓ Exercise Submitted</span>
          <span className="text-[#8b949e] text-xs block mt-0.5">Your answers have been recorded. Your assessor will review your results.</span>
        </div>
      )}

      {/* Time-up modal */}
      {showTimeUpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1f2028] border border-[#f85149] rounded-lg p-8 text-center max-w-sm">
            <div className="text-[#f85149] text-2xl font-bold mb-2">⏱ Time is up!</div>
            <div className="text-[#8b949e] mb-4">Submitting your answers automatically…</div>
            <div className="text-[#484f58] animate-pulse">Saving…</div>
          </div>
        </div>
      )}

      {/* Grafana-style top bar */}
      <div className="bg-[#1a1c22] border-b border-[#2d2f3a] px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded bg-[#f46800] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">G</div>
          <span className="text-[#e0e0e0] font-bold flex-shrink-0">Grafana</span>
          <span className="text-[#555] flex-shrink-0">›</span>
          <span className="text-[#aaa] flex-shrink-0">{phase === 'pipeline' ? 'Pipeline Design' : 'Observability Exercise'}</span>
          <span className="text-[#555] flex-shrink-0">›</span>
          <span className="text-[#e0e0e0] truncate">{question.title}</span>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Phase indicator */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPhase('pipeline')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${phase === 'pipeline' ? 'bg-[#f46800] text-white' : 'text-[#555] hover:text-[#888]'}`}
            >1 Design</button>
            <span className="text-[#333] text-[10px]">→</span>
            <button
              onClick={() => { if (Object.values(pipelineLayout).flat().length >= 4) setPhase('questions') }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${phase === 'questions' ? 'bg-[#f46800] text-white' : 'text-[#555] hover:text-[#888]'}`}
            >2 Questions</button>
          </div>
          <span className="text-[#333]">|</span>
          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
            question.difficulty === 'easy' ? 'border-[#3fb950] text-[#3fb950]'
            : question.difficulty === 'medium' ? 'border-[#d29922] text-[#d29922]'
            : 'border-[#f85149] text-[#f85149]'
          }`}>{question.difficulty}</span>
          {timedOut ? (
            <span className="text-[#f85149] font-bold text-sm font-mono">TIME UP</span>
          ) : (
            <CountdownTimer totalSeconds={timeLimit} paused={submitted} onExpire={handleTimerExpire} />
          )}
        </div>
      </div>

      {/* Phase: Pipeline design */}
      {phase === 'pipeline' && (
        <PipelineDesign
          scenario={question.scenario}
          title={question.title}
          pipelineLayout={pipelineLayout}
          setPipelineLayout={setPipelineLayout}
          onContinue={handleProceedToQuestions}
        />
      )}

      {/* Phase: Text questions */}
      {phase === 'questions' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Grafana-style left sidebar */}
          <div className="w-52 bg-[#1a1c22] border-r border-[#2d2f3a] flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-[#2d2f3a]">
              <div className="text-[#888] uppercase tracking-widest text-[10px]">Exercise Sections</div>
            </div>
            {/* Pipeline summary in sidebar */}
            <div className="p-3 border-b border-[#2d2f3a]">
              <div className="text-[#555] text-[9px] uppercase tracking-widest mb-2">Your Pipeline</div>
              {PIPELINE_STAGES.map(stage => {
                const placed = (pipelineLayout[stage.id] || []).map(id => PALETTE.find(p => p.id === id)!)
                return (
                  <div key={stage.id} className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: placed.length ? stage.borderColor : '#2d2f3a' }} />
                    <span className="text-[9px] truncate" style={{ color: placed.length ? '#8b949e' : '#484f58' }}>
                      {stage.label}: {placed.length ? placed.map(p => p?.label).join(', ') : 'empty'}
                    </span>
                  </div>
                )
              })}
              <button
                onClick={() => setPhase('pipeline')}
                className="mt-2 text-[9px] text-[#f46800] hover:underline"
              >← Edit pipeline</button>
            </div>
            <nav className="flex-1 py-1 overflow-y-auto">
              {question.sub_questions.map((sq, i) => {
                const meta    = STEP_META[sq.type] ?? { icon: '○', label: sq.type }
                const isDone  = saved[sq.id] || (submitted && (answers[sq.id] ?? '').trim().length > 0)
                const isActive= activeIdx === i
                const hasAnswer=(answers[sq.id] ?? '').trim().length > 0
                const ss      = scoreResult?.sub_scores.find(s => s.id === sq.id)
                return (
                  <button
                    key={sq.id}
                    onClick={() => setActiveIdx(i)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                      isActive ? 'bg-[#2d2f3a] border-l-2 border-[#f46800]' : 'hover:bg-[#22242e] border-l-2 border-transparent'
                    }`}
                  >
                    <span className="text-sm">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`truncate text-[11px] ${isActive ? 'text-[#e0e0e0]' : 'text-[#aaa]'}`}>{meta.label}</div>
                    </div>
                    {isDone || ss ? (
                      <span className="text-[#3fb950] text-xs">✓</span>
                    ) : hasAnswer ? (
                      <span className="w-2 h-2 rounded-full bg-[#f46800] flex-shrink-0" />
                    ) : null}
                  </button>
                )
              })}
            </nav>

            {!submitted && (
              <div className="p-3 border-t border-[#2d2f3a]">
                <div className="text-[#555] text-[10px] mb-2">
                  {question.sub_questions.filter(sq => (answers[sq.id] ?? '').trim().length > 0).length}/{question.sub_questions.length} answered
                </div>
                <button
                  onClick={doSubmit}
                  disabled={submitting}
                  className="w-full bg-[#f46800] hover:bg-[#ff7a00] disabled:bg-[#2d2f3a] disabled:text-[#555] text-white font-bold py-2 rounded transition-all text-[11px]"
                >
                  {submitting ? 'Saving…' : 'Save & Submit'}
                </button>
              </div>
            )}
            {submitted && (
              <div className="p-3 border-t border-[#2d2f3a] text-center">
                <div className="text-[#3fb950] text-xs font-bold">✓ Submitted</div>
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Scenario context panel */}
            <div className="w-72 border-r border-[#2d2f3a] overflow-y-auto flex-shrink-0 bg-[#111217]">
              <div className="p-4 border-b border-[#2d2f3a]">
                <div className="text-[#f46800] text-[10px] uppercase tracking-widest mb-1">Incident Context</div>
                <div className="text-[#e0e0e0] font-bold text-sm mb-3">{question.title}</div>
                <div className="text-[#8b949e] leading-relaxed whitespace-pre-wrap text-[11px]">{question.scenario}</div>
              </div>
              <div className="p-4">
                <div className="text-[#555] uppercase tracking-widest text-[10px] mb-3">Exercise Steps</div>
                <div className="space-y-2.5">
                  {question.sub_questions.map((sq, i) => {
                    const meta   = STEP_META[sq.type] ?? { icon: '○', label: sq.type }
                    const isDone = saved[sq.id] || (answers[sq.id] ?? '').trim().length >= 10
                    return (
                      <button
                        key={sq.id}
                        onClick={() => setActiveIdx(i)}
                        className={`w-full flex items-center gap-2 text-[11px] text-left transition-colors ${isDone ? 'text-[#3fb950]' : activeIdx === i ? 'text-[#f46800]' : 'text-[#555] hover:text-[#888]'}`}
                      >
                        <span>{isDone ? '✓' : `${i + 1}.`}</span>
                        <span>{meta.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Active question editor */}
            {subQ && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-[#2d2f3a] bg-[#1a1c22] flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{STEP_META[subQ.type]?.icon ?? '○'}</span>
                    <span className="text-[#aaa] uppercase tracking-widest text-[10px]">{STEP_META[subQ.type]?.label ?? subQ.type}</span>
                    <span className="ml-auto text-[#484f58] text-[10px]">Question {activeIdx + 1} of {question.sub_questions.length}</span>
                  </div>
                  <div className="text-[#e0e0e0] leading-relaxed text-sm">{subQ.prompt}</div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                  <textarea
                    key={subQ.id}
                    value={answers[subQ.id] ?? ''}
                    onChange={e => setAnswers(a => ({ ...a, [subQ.id]: e.target.value }))}
                    disabled={submitted || timedOut}
                    spellCheck={false}
                    placeholder={subQ.placeholder || `Answer here…`}
                    className="flex-1 bg-[#111217] text-[#e0e0e0] resize-none p-5 text-sm font-mono focus:outline-none disabled:opacity-60 placeholder:text-[#30363d]"
                    onKeyDown={e => {
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        setAnswers(a => ({ ...a, [subQ.id]: (a[subQ.id] ?? '') + '  ' }))
                      }
                    }}
                  />

                  {/* Reference answer after submit */}
                  {submitted && subScore && (
                    <div className="border-t border-[#2d2f3a] bg-[#1a1c22] overflow-y-auto max-h-64 flex-shrink-0">
                      <div className="p-4 grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[#555] uppercase tracking-widest text-[10px] mb-2">Your Answer</div>
                          <pre className="text-[#8b949e] text-[11px] bg-[#111217] border border-[#2d2f3a] rounded p-3 whitespace-pre-wrap overflow-x-auto min-h-[60px]">{answers[subQ.id] || '(no answer)'}</pre>
                        </div>
                        <div>
                          <div className="text-[#555] uppercase tracking-widest text-[10px] mb-2">Reference Answer</div>
                          <pre className="text-[#79c0ff] text-[11px] bg-[#111217] border border-[#2d2f3a] rounded p-3 whitespace-pre-wrap overflow-x-auto min-h-[60px]">{subScore.reference_answer || 'N/A'}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Nav / Save & Continue */}
                {!submitted && (
                  <div className="p-4 border-t border-[#2d2f3a] bg-[#1a1c22] flex items-center justify-between flex-shrink-0">
                    <button
                      onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                      disabled={activeIdx === 0}
                      className="px-4 py-1.5 rounded border border-[#2d2f3a] text-[#8b949e] hover:text-[#e0e0e0] disabled:opacity-40 transition-colors"
                    >← Back</button>
                    <div className="flex items-center gap-3">
                      <span className="text-[#555] text-[10px]">{(answers[subQ.id] ?? '').length} chars</span>
                      <button
                        onClick={handleSaveStep}
                        disabled={(answers[subQ.id] ?? '').trim().length < 5}
                        className="bg-[#f46800] hover:bg-[#ff7a00] disabled:bg-[#2d2f3a] disabled:text-[#555] text-white font-bold px-5 py-1.5 rounded transition-all text-[11px]"
                      >
                        {activeIdx < question.sub_questions.length - 1 ? 'Save & Continue →' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
