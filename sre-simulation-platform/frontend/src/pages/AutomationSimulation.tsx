import { useState, useEffect, useRef } from 'react'
import { SessionInfo } from '../types'

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')

interface EvalCriterion {
  label: string
  description: string
}

interface AutomationQuestion {
  id: string
  title: string
  description: string
  task: string
  difficulty: string
  language: string
  starter_code: string
  evaluation_criteria: EvalCriterion[]
  time_limit_seconds: number
}

interface ScoreResult {
  score: number
  rating: string
  feedback: string
  criterion_scores: { label: string; score: number; comment: string }[]
}

interface Props {
  sessionInfo: SessionInfo
}

const LANG_COLORS: Record<string, string> = {
  bash: '#3fb950',
  python: '#58a6ff',
  terraform: '#bc8cff',
  ansible: '#d29922',
  go: '#79c0ff',
}

const LANG_ICONS: Record<string, string> = {
  bash: '$_',
  python: 'py',
  terraform: 'tf',
  ansible: '⚙',
  go: 'go',
}

export default function AutomationSimulation({ sessionInfo }: Props) {
  const [question, setQuestion] = useState<AutomationQuestion | null>(null)
  const [loadError, setLoadError] = useState('')
  const [code, setCode] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [showTimeUpModal, setShowTimeUpModal] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoSubmittedRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const timeLimit = question?.time_limit_seconds ?? (sessionInfo.time_limit_minutes * 60)
  const remaining = Math.max(0, timeLimit - elapsed)
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  useEffect(() => {
    if (!sessionInfo.question_id) { setLoadError('No question assigned. Contact your assessor.'); return }
    fetch(`${API_BASE}/automation/questions/${sessionInfo.question_id}`)
      .then(r => r.json())
      .then((q: AutomationQuestion) => {
        setQuestion(q)
        setCode(q.starter_code ?? '')
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
      const res = await fetch(`${API_BASE}/automation/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionInfo.session_id,
          question_id: question.id,
          code,
        })
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

  const lineCount = code.split('\n').length

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

  const langColor = LANG_COLORS[question.language] ?? '#8b949e'
  const langIcon = LANG_ICONS[question.language] ?? question.language

  return (
    <div className="min-h-screen bg-[#0d1117] font-mono text-xs flex flex-col">
      {submitted && (
        <div className="bg-[#0f2a1a] border-b border-[#3fb950] px-4 py-3 text-center flex-shrink-0">
          <span className="text-[#3fb950] font-bold text-sm">✓ Solution Submitted</span>
          <span className="text-[#8b949e] text-xs block mt-0.5">Your assessor will review your script.</span>
        </div>
      )}

      {showTimeUpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#161b22] border border-[#f85149] rounded-lg p-8 text-center max-w-sm">
            <div className="text-[#f85149] text-2xl font-bold mb-2">⏱ Time is up!</div>
            <div className="text-[#8b949e] mb-4">Submitting your solution automatically…</div>
            <div className="text-[#484f58] animate-pulse">Saving…</div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0"
            style={{ background: langColor, color: '#0d1117' }}>
            {langIcon}
          </div>
          <span className="text-[#e6edf3] font-bold">Automation</span>
          <span className="text-[#484f58]">›</span>
          <span className="text-[#8b949e] truncate max-w-xs">{question.title}</span>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
            style={{ border: `1px solid ${langColor}`, color: langColor }}>
            {question.language}
          </span>
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
        {/* Left panel: task + criteria */}
        <div className="w-80 border-r border-[#30363d] bg-[#0d1117] overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-[#30363d]">
            <div className="text-[#8b949e] text-[10px] uppercase tracking-widest mb-2">Task</div>
            <div className="text-[#e6edf3] font-bold text-sm mb-3">{question.title}</div>
            <div className="text-[#8b949e] leading-relaxed whitespace-pre-wrap text-[11px] mb-4">{question.description}</div>
            <div className="bg-[#161b22] rounded border border-[#30363d] p-3">
              <div className="text-[#d29922] text-[10px] uppercase tracking-widest mb-2">Requirements</div>
              <div className="text-[#e6edf3] leading-relaxed whitespace-pre-wrap text-[11px]">{question.task}</div>
            </div>
          </div>

          {question.evaluation_criteria.length > 0 && (
            <div className="p-4 border-b border-[#30363d]">
              <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-3">Scoring Criteria</div>
              <div className="space-y-2.5">
                {question.evaluation_criteria.map((c, i) => (
                  <div key={i}>
                    <div className="text-[#8b949e] font-bold text-[11px]">{c.label}</div>
                    <div className="text-[#484f58] text-[10px] leading-relaxed mt-0.5">{c.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4">
            <button
              onClick={() => setShowHint(!showHint)}
              className="text-[#58a6ff] hover:text-[#79c0ff] text-[11px] transition-colors"
            >
              {showHint ? '▲ Hide tips' : '▼ Show tips'}
            </button>
            {showHint && (
              <div className="mt-3 bg-[#161b22] rounded border border-[#30363d] p-3 text-[#8b949e] text-[11px] leading-relaxed">
                {question.language === 'bash' && '• Use set -euo pipefail at the top\n• Quote variables: "$VAR"\n• Add comments explaining what each block does\n• Test your exit codes'}
                {question.language === 'python' && '• Use argparse for CLI args\n• Handle exceptions with try/except\n• Add type hints where possible\n• Include a if __name__ == "__main__" guard'}
                {question.language === 'terraform' && '• Always include required_providers block\n• Use variables for configurable values\n• Add description to all variables\n• Include outputs for important values'}
                {question.language === 'ansible' && '• Use become: true only when needed\n• Make tasks idempotent\n• Add tags for selective execution\n• Use handlers for service restarts'}
              </div>
            )}
          </div>
        </div>

        {/* Code editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor header */}
          <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[#8b949e]">solution.{question.language === 'python' ? 'py' : question.language === 'terraform' ? 'tf' : question.language === 'ansible' ? 'yml' : 'sh'}</span>
              <span className="text-[#484f58]">{lineCount} lines</span>
            </div>
            {!submitted && (
              <button
                onClick={doSubmit}
                disabled={submitting || !code.trim()}
                className="bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold px-5 py-1.5 rounded text-[11px] transition-all"
              >
                {submitting ? 'Submitting…' : '▶ Submit Solution'}
              </button>
            )}
          </div>

          {/* Line numbers + editor */}
          <div className="flex flex-1 overflow-hidden">
            {/* Line numbers */}
            <div className="bg-[#0d1117] border-r border-[#21262d] px-2 py-5 select-none flex-shrink-0 overflow-hidden" aria-hidden>
              <div className="text-[#484f58] text-right text-xs leading-6 font-mono">
                {Array.from({ length: Math.max(lineCount, 20) }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              disabled={submitted || remaining === 0}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              className="flex-1 bg-[#0d1117] text-[#e6edf3] resize-none p-5 text-sm font-mono focus:outline-none disabled:opacity-60 leading-6"
              style={{ tabSize: 2 }}
              onKeyDown={e => {
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const ta = e.currentTarget
                  const start = ta.selectionStart
                  const end = ta.selectionEnd
                  const newCode = code.slice(0, start) + '  ' + code.slice(end)
                  setCode(newCode)
                  setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2 }, 0)
                }
              }}
            />
          </div>

          {/* Score panel after submit */}
          {submitted && scoreResult && (
            <div className="border-t border-[#30363d] bg-[#161b22] p-4 flex-shrink-0 max-h-56 overflow-y-auto">
              <div className="flex items-center gap-4 mb-3">
                <div className={`text-2xl font-bold ${scoreResult.score >= 75 ? 'text-[#3fb950]' : scoreResult.score >= 50 ? 'text-[#d29922]' : 'text-[#f85149]'}`}>
                  {scoreResult.score}/100
                </div>
                <div className={`px-2 py-0.5 rounded border text-[10px] font-bold ${scoreResult.rating === 'Good' ? 'border-[#3fb950] text-[#3fb950]' : scoreResult.rating === 'Managing' ? 'border-[#d29922] text-[#d29922]' : 'border-[#f85149] text-[#f85149]'}`}>
                  {scoreResult.rating}
                </div>
              </div>
              <div className="text-[#e6edf3] text-[11px] leading-relaxed mb-3">{scoreResult.feedback}</div>
              {scoreResult.criterion_scores.length > 0 && (
                <div className="space-y-2 mt-3 border-t border-[#30363d] pt-3">
                  {scoreResult.criterion_scores.map((c, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-8 text-right font-bold flex-shrink-0 ${c.score >= 75 ? 'text-[#3fb950]' : c.score >= 50 ? 'text-[#d29922]' : 'text-[#f85149]'}`}>{c.score}</div>
                      <div>
                        <div className="text-[#8b949e] font-bold text-[10px]">{c.label}</div>
                        <div className="text-[#484f58] text-[10px] leading-relaxed">{c.comment}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
