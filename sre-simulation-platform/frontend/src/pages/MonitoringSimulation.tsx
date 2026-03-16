import { useState, useEffect, useRef } from 'react'
import { SessionInfo } from '../types'

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')

interface SubQuestion {
  id: string
  prompt: string
  type: 'datasource' | 'alert_rule' | 'contact_point' | 'notification_policy'
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

interface SubScore {
  id: string
  score: number
  reference_answer: string
}

interface ScoreResult {
  score: number
  rating: 'Good' | 'Managing' | 'Learning'
  scorecard: {
    dimensions: Record<string, { score: number; max: number }>
    timeline_highlights: string[]
    postmortem_summary: string
  }
  sub_scores: SubScore[]
}

interface Props {
  sessionInfo: SessionInfo
}

const STEP_META: Record<string, { icon: string; label: string }> = {
  datasource:            { icon: '⬡', label: 'Data Sources' },
  alert_rule:            { icon: '⚡', label: 'Alert Rules' },
  contact_point:         { icon: '📣', label: 'Contact Points' },
  notification_policy:   { icon: '🔀', label: 'Notification Policies' },
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

export default function MonitoringSimulation({ sessionInfo }: Props) {
  const [question, setQuestion] = useState<MonitoringQuestion | null>(null)
  const [loadError, setLoadError] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [activeIdx, setActiveIdx] = useState(0)
  const [showTimeUpModal, setShowTimeUpModal] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoSubmittedRef = useRef(false)

  const timeLimit = question?.time_limit_seconds ?? (sessionInfo.time_limit_minutes * 60)
  const remaining = Math.max(0, timeLimit - elapsed)
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

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

  useEffect(() => {
    if (!question || submitted) return
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [question, submitted])

  useEffect(() => {
    if (remaining === 0 && !submitted && !autoSubmittedRef.current && question) {
      autoSubmittedRef.current = true
      setShowTimeUpModal(true)
      if (timerRef.current) clearInterval(timerRef.current)
      doSubmit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining])

  async function doSubmit() {
    if (!question || submitting || submitted) return
    if (timerRef.current) clearInterval(timerRef.current)
    setSubmitting(true)
    try {
      const answerList = question.sub_questions.map(sq => ({ id: sq.id, answer: answers[sq.id] ?? '' }))
      const res = await fetch(`${API_BASE}/monitoring/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: sessionInfo.session_id, question_id: question.id, answers: answerList })
      })
      const data = await res.json() as ScoreResult
      setScoreResult(data)
      setSubmitted(true)
      setShowTimeUpModal(false)
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

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#111217] flex items-center justify-center">
        <div className="text-[#f85149] font-mono text-sm">{loadError}</div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-[#111217] flex items-center justify-center">
        <div className="text-[#8b949e] font-mono text-sm animate-pulse">Loading question…</div>
      </div>
    )
  }

  const subQ = question.sub_questions[activeIdx]
  const subScore = scoreResult?.sub_scores.find(s => s.id === subQ?.id)

  return (
    <div className="min-h-screen bg-[#111217] font-mono text-xs flex flex-col">
      {/* Time-up modal */}
      {showTimeUpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1f2028] border border-[#f85149] rounded-lg p-8 text-center max-w-sm">
            <div className="text-[#f85149] text-2xl font-bold mb-2">Time's Up!</div>
            <div className="text-[#8b949e] mb-4">Your answers are being submitted automatically…</div>
            <div className="text-[#484f58] animate-pulse">Submitting…</div>
          </div>
        </div>
      )}

      {/* Grafana-style top bar */}
      <div className="bg-[#1a1c22] border-b border-[#2d2f3a] px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded bg-[#f46800] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">G</div>
          <span className="text-[#e0e0e0] font-bold flex-shrink-0">Grafana</span>
          <span className="text-[#555] flex-shrink-0">›</span>
          <span className="text-[#aaa] flex-shrink-0">Alerting</span>
          <span className="text-[#555] flex-shrink-0">›</span>
          <span className="text-[#e0e0e0] truncate">{question.title}</span>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
            question.difficulty === 'easy' ? 'border-[#3fb950] text-[#3fb950]'
            : question.difficulty === 'medium' ? 'border-[#d29922] text-[#d29922]'
            : 'border-[#f85149] text-[#f85149]'
          }`}>{question.difficulty}</span>
          <div className={`text-sm font-bold tabular-nums ${remaining < 120 ? 'text-[#f85149] animate-pulse' : remaining < 300 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
            {remaining === 0 ? 'TIME UP' : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Grafana-style left sidebar */}
        <div className="w-52 bg-[#1a1c22] border-r border-[#2d2f3a] flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-[#2d2f3a]">
            <div className="text-[#888] uppercase tracking-widest text-[10px]">Alerting Config</div>
          </div>
          <nav className="flex-1 py-1 overflow-y-auto">
            {question.sub_questions.map((sq, i) => {
              const meta = STEP_META[sq.type] ?? { icon: '○', label: sq.type }
              const isDone = saved[sq.id] || (submitted && (answers[sq.id] ?? '').trim().length > 0)
              const isActive = activeIdx === i
              const hasAnswer = (answers[sq.id] ?? '').trim().length > 0
              const ss = scoreResult?.sub_scores.find(s => s.id === sq.id)
              return (
                <button
                  key={sq.id}
                  onClick={() => setActiveIdx(i)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                    isActive
                      ? 'bg-[#2d2f3a] border-l-2 border-[#f46800]'
                      : 'hover:bg-[#22242e] border-l-2 border-transparent'
                  }`}
                >
                  <span className="text-sm">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`truncate text-[11px] ${isActive ? 'text-[#e0e0e0]' : 'text-[#aaa]'}`}>{meta.label}</div>
                  </div>
                  {ss ? (
                    <span className={`text-[10px] font-bold ${ss.score >= 80 ? 'text-[#3fb950]' : ss.score >= 50 ? 'text-[#d29922]' : 'text-[#f85149]'}`}>{ss.score}</span>
                  ) : isDone ? (
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
                {question.sub_questions.filter(sq => (answers[sq.id] ?? '').trim().length > 0).length}/{question.sub_questions.length} configured
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

          {submitted && scoreResult && (
            <div className="p-3 border-t border-[#2d2f3a]">
              <div className="text-[#555] text-[10px] mb-1">Overall Score</div>
              <div className={`text-lg font-bold ${ratingColor(scoreResult.rating)}`}>{scoreResult.rating}</div>
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold mt-2 ${ratingBorder(scoreResult.rating)} ${ratingColor(scoreResult.rating)}`}>
                {scoreResult.score}
              </div>
            </div>
          )}
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Scenario context panel */}
          <div className="w-72 border-r border-[#2d2f3a] overflow-y-auto flex-shrink-0 bg-[#111217]">
            <div className="p-4 border-b border-[#2d2f3a]">
              <div className="text-[#f46800] text-[10px] uppercase tracking-widest mb-1">Incident Context</div>
              <div className="text-[#e0e0e0] font-bold text-sm mb-3">{question.title}</div>
              <div className="text-[#8b949e] leading-relaxed whitespace-pre-wrap text-[11px]">{question.scenario}</div>
            </div>
            <div className="p-4">
              <div className="text-[#555] uppercase tracking-widest text-[10px] mb-3">Configuration Steps</div>
              <div className="space-y-2.5">
                {question.sub_questions.map((sq, i) => {
                  const meta = STEP_META[sq.type] ?? { icon: '○', label: sq.type }
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

          {/* Active step editor */}
          {subQ && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-[#2d2f3a] bg-[#1a1c22] flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{STEP_META[subQ.type]?.icon ?? '○'}</span>
                  <span className="text-[#aaa] uppercase tracking-widest text-[10px]">{STEP_META[subQ.type]?.label ?? subQ.type}</span>
                  <span className="ml-auto px-1.5 py-0.5 rounded border border-[#2d2f3a] text-[#555] text-[10px] uppercase">{subQ.type}</span>
                </div>
                <div className="text-[#e0e0e0] leading-relaxed text-sm">{subQ.prompt}</div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <textarea
                  key={subQ.id}
                  value={answers[subQ.id] ?? ''}
                  onChange={e => setAnswers(a => ({ ...a, [subQ.id]: e.target.value }))}
                  disabled={submitted || remaining === 0}
                  spellCheck={false}
                  placeholder={subQ.placeholder || `Configure ${subQ.type} here…`}
                  className="flex-1 bg-[#111217] text-[#e0e0e0] resize-none p-5 text-sm font-mono focus:outline-none disabled:opacity-60"
                  onKeyDown={e => {
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      setAnswers(a => ({ ...a, [subQ.id]: (a[subQ.id] ?? '') + '  ' }))
                    }
                  }}
                />

                {/* Reference answer reveal after submit */}
                {submitted && subScore && (
                  <div className="border-t border-[#2d2f3a] bg-[#1a1c22] overflow-y-auto max-h-72 flex-shrink-0">
                    <div className="p-4 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[#555] uppercase tracking-widest text-[10px] mb-2">Your Answer</div>
                        <pre className="text-[#8b949e] text-[11px] bg-[#111217] border border-[#2d2f3a] rounded p-3 whitespace-pre-wrap overflow-x-auto min-h-[60px]">{answers[subQ.id] || '(no answer)'}</pre>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-[#555] uppercase tracking-widest text-[10px]">Reference Answer</div>
                          <span className={`text-sm font-bold ${subScore.score >= 80 ? 'text-[#3fb950]' : subScore.score >= 50 ? 'text-[#d29922]' : 'text-[#f85149]'}`}>{subScore.score}/100</span>
                        </div>
                        <pre className="text-[#79c0ff] text-[11px] bg-[#111217] border border-[#2d2f3a] rounded p-3 whitespace-pre-wrap overflow-x-auto min-h-[60px]">{subScore.reference_answer || 'N/A'}</pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation / Save & Continue */}
              {!submitted && (
                <div className="p-4 border-t border-[#2d2f3a] bg-[#1a1c22] flex items-center justify-between flex-shrink-0">
                  <button
                    onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                    disabled={activeIdx === 0}
                    className="px-4 py-1.5 rounded border border-[#2d2f3a] text-[#8b949e] hover:text-[#e0e0e0] disabled:opacity-40 transition-colors"
                  >
                    ← Back
                  </button>
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

      {/* Score summary bar when submitted */}
      {submitted && scoreResult && (
        <div className="border-t border-[#2d2f3a] bg-[#1a1c22] p-4 flex items-center gap-6 flex-shrink-0">
          <div className="flex-shrink-0">
            <div className="text-[#555] uppercase tracking-widest text-[10px] mb-1">Overall</div>
            <div className={`text-xl font-bold ${ratingColor(scoreResult.rating)}`}>{scoreResult.rating} · {scoreResult.score}/100</div>
          </div>
          <div className="flex-1 text-[#8b949e] text-[11px] leading-relaxed">{scoreResult.scorecard.postmortem_summary}</div>
          <div className="flex gap-2 flex-wrap flex-shrink-0">
            {scoreResult.scorecard.timeline_highlights.map((h, i) => (
              <span key={i} className="px-2 py-1 bg-[#111217] border border-[#2d2f3a] rounded text-[#8b949e] text-[10px]">{h}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
