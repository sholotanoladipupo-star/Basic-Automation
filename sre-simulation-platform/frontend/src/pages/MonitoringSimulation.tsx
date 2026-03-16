import { useState, useEffect, useRef } from 'react'
import { SessionInfo } from '../types'

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')

interface SubQuestion {
  id: string
  prompt: string
  type: 'promql' | 'nrql' | 'text' | 'yaml'
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
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [activeQ, setActiveQ] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const timeLimit = question?.time_limit_seconds ?? (sessionInfo.time_limit_minutes * 60)
  const remaining = Math.max(0, timeLimit - elapsed)
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const timedOut = remaining === 0 && !submitted

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
    if (!question || submitted || timedOut) return
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [question, submitted, timedOut])

  async function handleSubmit() {
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
    } catch (err) {
      alert('Submit failed: ' + String(err))
    } finally {
      setSubmitting(false)
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

  const subQ = question.sub_questions[activeQ]
  const subScore = scoreResult?.sub_scores.find(s => s.id === subQ?.id)
  const answeredCount = Object.values(answers).filter(a => a.trim()).length

  return (
    <div className="min-h-screen bg-[#0d1117] font-mono text-xs flex flex-col">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[#58a6ff] font-bold text-sm">Monitoring & Observability Design</span>
          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
            question.difficulty === 'easy' ? 'border-[#3fb950] text-[#3fb950]'
            : question.difficulty === 'medium' ? 'border-[#d29922] text-[#d29922]'
            : 'border-[#f85149] text-[#f85149]'
          }`}>{question.difficulty}</span>
        </div>
        <div className={`text-sm font-bold tabular-nums ${remaining < 120 ? 'text-[#f85149] animate-pulse' : remaining < 300 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
          {timedOut ? 'TIME UP' : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Scenario + nav */}
        <div className="w-2/5 border-r border-[#30363d] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#30363d] overflow-y-auto">
            <div className="text-[#e6edf3] font-bold mb-2">{question.title}</div>
            <div className="text-[#8b949e] leading-relaxed whitespace-pre-wrap">{question.scenario}</div>
          </div>

          {/* Sub-question nav */}
          <div className="p-3 space-y-1.5 overflow-y-auto">
            <div className="text-[#484f58] uppercase tracking-widest mb-2">Questions</div>
            {question.sub_questions.map((sq, i) => {
              const answered = (answers[sq.id] ?? '').trim().length > 0
              const ss = scoreResult?.sub_scores.find(s => s.id === sq.id)
              return (
                <button
                  key={sq.id}
                  onClick={() => setActiveQ(i)}
                  className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                    activeQ === i ? 'border-[#58a6ff] bg-[#1c2128]'
                    : answered ? 'border-[#3fb950] bg-[#0d1117] hover:bg-[#161b22]'
                    : 'border-[#30363d] hover:border-[#484f58]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                      activeQ === i ? 'border-[#58a6ff] text-[#58a6ff]' : answered ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#484f58] text-[#484f58]'
                    }`}>{i + 1}</span>
                    <span className="text-[#8b949e] flex-1 truncate">{sq.prompt.slice(0, 50)}{sq.prompt.length > 50 ? '…' : ''}</span>
                    {ss && <span className={`text-[10px] font-bold ${ss.score >= 80 ? 'text-[#3fb950]' : ss.score >= 50 ? 'text-[#d29922]' : 'text-[#f85149]'}`}>{ss.score}</span>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Submit */}
          {!submitted && (
            <div className="p-3 border-t border-[#30363d] mt-auto">
              <div className="text-[#484f58] mb-2">{answeredCount}/{question.sub_questions.length} answered</div>
              <button
                onClick={handleSubmit}
                disabled={submitting || timedOut}
                className="w-full bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold py-2 rounded border border-[#2ea043] disabled:border-[#30363d] transition-all"
              >
                {submitting ? 'Submitting…' : 'Submit All Answers'}
              </button>
            </div>
          )}

          {/* Overall score */}
          {submitted && scoreResult && (
            <div className="p-4 border-t border-[#30363d] mt-auto">
              <div className={`text-2xl font-bold ${ratingColor(scoreResult.rating)}`}>{scoreResult.rating}</div>
              <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center font-bold text-base mt-2 ${ratingBorder(scoreResult.rating)} ${ratingColor(scoreResult.rating)}`}>
                {scoreResult.score}
              </div>
              <div className="text-[#8b949e] mt-3 leading-relaxed">{scoreResult.scorecard.postmortem_summary}</div>
            </div>
          )}
        </div>

        {/* Right: Active question editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {subQ && (
            <>
              <div className="p-4 border-b border-[#30363d] bg-[#161b22]">
                <div className="flex items-start gap-3">
                  <span className="text-[#58a6ff] font-bold mt-0.5">{activeQ + 1}.</span>
                  <div className="flex-1">
                    <div className="text-[#e6edf3] leading-relaxed">{subQ.prompt}</div>
                    <div className="mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${
                        subQ.type === 'promql' ? 'border-[#58a6ff] text-[#58a6ff]'
                        : subQ.type === 'nrql' ? 'border-[#bc8cff] text-[#bc8cff]'
                        : subQ.type === 'yaml' ? 'border-[#d29922] text-[#d29922]'
                        : 'border-[#484f58] text-[#484f58]'
                      }`}>{subQ.type}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <textarea
                  key={subQ.id}
                  value={answers[subQ.id] ?? ''}
                  onChange={e => setAnswers(a => ({ ...a, [subQ.id]: e.target.value }))}
                  disabled={submitted || timedOut}
                  spellCheck={false}
                  placeholder={subQ.placeholder || `Enter your ${subQ.type} here…`}
                  className="flex-1 bg-[#0d1117] text-[#e6edf3] resize-none p-4 text-sm font-mono focus:outline-none disabled:opacity-60"
                  onKeyDown={e => {
                    if (e.key === 'Tab') { e.preventDefault(); setAnswers(a => ({ ...a, [subQ.id]: (a[subQ.id] ?? '') + '  ' }) ) }
                  }}
                />

                {/* Reference answer reveal after submission */}
                {submitted && subScore && (
                  <div className="border-t border-[#30363d] p-4 bg-[#0d1117] overflow-y-auto max-h-48">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-[#484f58] uppercase tracking-widest text-[10px]">Result</div>
                      <span className={`text-lg font-bold ${subScore.score >= 80 ? 'text-[#3fb950]' : subScore.score >= 50 ? 'text-[#d29922]' : 'text-[#f85149]'}`}>
                        {subScore.score}/100
                      </span>
                    </div>
                    <div className="text-[#484f58] uppercase tracking-widest text-[10px] mb-2">Reference Answer</div>
                    <pre className="text-[#79c0ff] text-[11px] bg-[#161b22] border border-[#30363d] rounded p-3 whitespace-pre-wrap overflow-x-auto">{subScore.reference_answer || 'N/A'}</pre>
                  </div>
                )}
              </div>

              {/* Navigation */}
              {!submitted && (
                <div className="p-3 border-t border-[#30363d] bg-[#161b22] flex justify-between">
                  <button
                    onClick={() => setActiveQ(i => Math.max(0, i - 1))}
                    disabled={activeQ === 0}
                    className="px-4 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] disabled:opacity-40 transition-colors"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setActiveQ(i => Math.min(question.sub_questions.length - 1, i + 1))}
                    disabled={activeQ === question.sub_questions.length - 1}
                    className="px-4 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] disabled:opacity-40 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
