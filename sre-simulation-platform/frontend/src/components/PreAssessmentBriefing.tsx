import { SessionInfo } from '../types'

interface Props {
  sessionInfo: SessionInfo
  onReady: () => void
}

const MODULE_META: Record<string, { icon: string; color: string; name: string; tips: string[] }> = {
  incident: {
    icon: '🚨', color: '#f85149', name: 'Incident Response',
    tips: [
      'Use the terminal to run diagnostic commands (kubectl, gcloud, curl, etc.)',
      'Declare severity early — it shows situational awareness',
      'Use Slack channels to communicate status and actions',
      'Check dashboards and logs to correlate symptoms',
      'Run runbooks when relevant, then adapt based on findings',
    ],
  },
  sql: {
    icon: '🗄', color: '#58a6ff', name: 'SQL Readiness',
    tips: [
      'Read the question requirements carefully before writing',
      'Use the schema browser to inspect tables and columns',
      'Run your query first to verify results before submitting',
      'Use Ctrl+Enter to run the query quickly',
      'SQL syntax reference is available in the left panel',
    ],
  },
  monitoring: {
    icon: '📊', color: '#f46800', name: 'Monitoring Design',
    tips: [
      'Phase 1: Design your monitoring pipeline by dragging components',
      'Phase 2: Answer observability questions for the scenario',
      'Think about the full signal chain: metrics → alerts → routing → notification',
      'Consider SLIs, SLOs, and error budgets in your answers',
      'Be specific — vague answers score lower',
    ],
  },
  cognitive: {
    icon: '🧠', color: '#bc8cff', name: 'Cognitive Assessment',
    tips: [
      'Answer all questions — partial credit is given for partial answers',
      'Use the sidebar to navigate between questions',
      'Each question shows suggested time — use it as a guide',
      'For numerical questions, give your best estimate if unsure',
      'You can change your answers before submitting',
    ],
  },
  postmortem: {
    icon: '📄', color: '#d29922', name: 'Postmortem Writing',
    tips: [
      'Write at least 20 words per section for full scoring',
      'Use the incident report and timeline on the left as reference',
      'Be specific about root cause — not just symptoms',
      'Action items need owners, due dates, and measurable outcomes',
      'The AI evaluates clarity, specificity, and completeness',
    ],
  },
  automation: {
    icon: '⚙', color: '#3fb950', name: 'Automation Scripting',
    tips: [
      'Read the task requirements thoroughly before writing code',
      'Use the evaluation criteria to understand what matters most',
      'Include error handling and edge cases in your solution',
      'Add comments to explain your logic — it helps scoring',
      'Tab inserts 2 spaces; use the language tips panel for guidance',
    ],
  },
}

const DIFFICULTY_LABELS = {
  junior: { label: 'Junior', color: '#3fb950', bg: '#0f2a1a' },
  senior: { label: 'Senior', color: '#d29922', bg: '#1f1a0a' },
  chaos:  { label: 'Chaos', color: '#f85149', bg: '#2a0a0a' },
  easy:   { label: 'Easy',  color: '#3fb950', bg: '#0f2a1a' },
  medium: { label: 'Medium', color: '#d29922', bg: '#1f1a0a' },
  hard:   { label: 'Hard',  color: '#f85149', bg: '#2a0a0a' },
}

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function PreAssessmentBriefing({ sessionInfo, onReady }: Props) {
  const meta = MODULE_META[sessionInfo.module_type] ?? MODULE_META.incident
  const diff = DIFFICULTY_LABELS[sessionInfo.difficulty as keyof typeof DIFFICULTY_LABELS] ?? { label: sessionInfo.difficulty, color: '#8b949e', bg: '#1c2128' }

  return (
    <div className="min-h-screen bg-[#0d1117] font-mono flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">{meta.icon}</div>
          <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-1">Assessment Briefing</div>
          <h1 className="text-2xl font-bold text-[#e6edf3] mb-1">{meta.name}</h1>
          <div className="text-[#8b949e] text-sm">
            Hello, <span className="text-[#e6edf3] font-bold">{sessionInfo.candidate_name}</span>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-center">
            <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-1">Time Limit</div>
            <div className="text-[#e6edf3] font-bold text-lg">{formatTime(sessionInfo.time_limit_minutes)}</div>
          </div>
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-center">
            <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-1">Difficulty</div>
            <div className="font-bold text-sm capitalize" style={{ color: diff.color }}>{diff.label}</div>
          </div>
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-center">
            <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-1">Module</div>
            <div className="text-[#e6edf3] font-bold text-xs capitalize">{sessionInfo.module_type}</div>
          </div>
        </div>

        {/* Practice badge */}
        {sessionInfo.is_practice && (
          <div className="mb-5 bg-[#1c1430] border border-[#bc8cff] rounded-lg px-4 py-2.5 flex items-center gap-2.5">
            <span className="text-[#bc8cff] text-lg">🧪</span>
            <div>
              <div className="text-[#bc8cff] font-bold text-xs">Practice Mode</div>
              <div className="text-[#8b949e] text-[11px]">This session is unscored. Use it to explore the format.</div>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-6">
          <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-3">What to expect</div>
          <ul className="space-y-2">
            {meta.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[11px] text-[#8b949e]">
                <span className="text-[#30363d] mt-0.5 flex-shrink-0">▸</span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* General rules */}
        <div className="bg-[#0d1117] border border-[#21262d] rounded-lg px-4 py-3 mb-6 text-[11px] text-[#484f58]">
          <span className="text-[#d29922] font-bold">⚠</span>{' '}
          The timer starts the moment you click <strong className="text-[#8b949e]">I&apos;m Ready</strong>.
          Make sure you&apos;re in a quiet environment with no distractions before proceeding.
        </div>

        {/* CTA */}
        <button
          onClick={onReady}
          className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-3.5 rounded-lg border border-[#2ea043] transition-all text-sm tracking-wide"
        >
          I&apos;m Ready — Start Assessment
        </button>
      </div>
    </div>
  )
}
