import { useState } from 'react'

interface TourStep {
  title: string
  description: string
  // Which side of the card the arrow/pointer appears on (toward the element)
  arrowSide: 'left' | 'right' | 'top' | 'bottom'
  position: string // Tailwind positioning classes for the tooltip card
  highlight?: string // Short label for the pulsing pointer badge
}

const TOUR_STEPS: TourStep[] = [
  {
    title: '🚨 Alerts + Incident Panel',
    description: 'Your left sidebar has two sections. Top: live PagerDuty-style alerts — P1 pulses red, click ACK to earn coordination points. Bottom: declare priority (P1/P2/P3) within 2 minutes, open runbooks, and mark the incident resolved.',
    arrowSide: 'left',
    position: 'left-[284px] top-24',
    highlight: '← Left Panel',
  },
  {
    title: '‹ › Collapse Toggle',
    description: 'Click the ‹ tab on the left panel edge to collapse it and give the main content full-screen width. Great for the GCP Console and Grafana dashboard. Click › to expand it back.',
    arrowSide: 'left',
    position: 'left-[284px] top-1/2 -translate-y-1/2',
    highlight: '← Collapse toggle',
  },
  {
    title: '⌨ Terminal',
    description: 'Primary investigation tool. Run kubectl, redis-cli, psql, curl, df, top, journalctl — commands are evaluated against live system state. Arrow-Up recalls history.',
    arrowSide: 'bottom',
    position: 'left-1/2 -translate-x-1/2 top-16',
    highlight: '↓ Terminal Tab',
  },
  {
    title: '📊 Grafana Dashboard',
    description: 'Live service metrics — pod health, Redis metrics, Kafka consumer lag, DB connections, business KPIs. Check Grafana early: the Redis Metrics and Kafka panels reveal the incident pattern fastest.',
    arrowSide: 'bottom',
    position: 'left-1/2 -translate-x-1/2 top-16',
    highlight: '↓ Grafana Tab',
  },
  {
    title: '🌐 GCP Console',
    description: 'Simulated Google Cloud Console. View GKE pod status, scale replicas up/down, inspect pod logs, browse Cloud SQL databases and query insights, check Kubernetes events.',
    arrowSide: 'bottom',
    position: 'left-1/2 -translate-x-1/2 top-16',
    highlight: '↓ GCP Console Tab',
  },
  {
    title: '📈 New Relic APM',
    description: 'APM with service map, transaction traces, error inbox and Apdex scores. The service map shows which upstream/downstream services are affected. Use the time window to find when the spike started.',
    arrowSide: 'bottom',
    position: 'left-1/2 -translate-x-1/2 top-16',
    highlight: '↓ New Relic Tab',
  },
  {
    title: '🗄 DB Console',
    description: 'Run SQL queries against the simulated database. Browse tables, check schemas, and run diagnostic queries. Useful for investigating missing tables, missing columns, or slow query patterns.',
    arrowSide: 'bottom',
    position: 'left-1/2 -translate-x-1/2 top-16',
    highlight: '↓ DB Console Tab',
  },
  {
    title: '💬 Slack — Floating Button',
    description: 'Click the green 💬 button (bottom-right) to open your Slack comms drawer. Post updates to #incidents and #sre-team. Stakeholders need updates every 2-3 minutes — this earns coordination points.',
    arrowSide: 'right',
    position: 'right-20 bottom-32',
    highlight: 'Slack →',
  },
  {
    title: '🚨 Escalate — Floating Button',
    description: 'Click the red 🚨 button to escalate to the engineering manager or team lead. Describe what you\'ve found and what help you need. Good escalations are concise: "payment-service down, root cause: missing ConfigMap key, need infra access to patch".',
    arrowSide: 'right',
    position: 'right-20 bottom-48',
    highlight: 'Escalate →',
  },
]

interface TourGuideProps {
  onFinish: () => void
}

// Renders a triangle arrow on the specified side of the tour card
function ArrowIndicator({ side }: { side: TourStep['arrowSide'] }) {
  const size = 12
  const triangles: Record<TourStep['arrowSide'], React.CSSProperties> = {
    left: {
      position: 'absolute', left: -size, top: '50%', transform: 'translateY(-50%)',
      width: 0, height: 0,
      borderTop: `${size}px solid transparent`,
      borderBottom: `${size}px solid transparent`,
      borderRight: `${size}px solid #58a6ff`,
    },
    right: {
      position: 'absolute', right: -size, top: '50%', transform: 'translateY(-50%)',
      width: 0, height: 0,
      borderTop: `${size}px solid transparent`,
      borderBottom: `${size}px solid transparent`,
      borderLeft: `${size}px solid #58a6ff`,
    },
    top: {
      position: 'absolute', top: -size, left: '50%', transform: 'translateX(-50%)',
      width: 0, height: 0,
      borderLeft: `${size}px solid transparent`,
      borderRight: `${size}px solid transparent`,
      borderBottom: `${size}px solid #58a6ff`,
    },
    bottom: {
      position: 'absolute', bottom: -size, left: '50%', transform: 'translateX(-50%)',
      width: 0, height: 0,
      borderLeft: `${size}px solid transparent`,
      borderRight: `${size}px solid transparent`,
      borderTop: `${size}px solid #58a6ff`,
    },
  }
  return <div style={triangles[side]} />
}

export default function TourGuide({ onFinish }: TourGuideProps) {
  const [step, setStep] = useState(0)

  const current = TOUR_STEPS[step]
  const isLast = step === TOUR_STEPS.length - 1

  return (
    <>
      {/* Dim overlay */}
      <div className="fixed inset-0 bg-black/55 z-40 pointer-events-none" />

      {/* Tour card */}
      <div className={`fixed z-50 ${current.position} w-80 bg-[#161b22] border border-[#58a6ff] rounded-lg shadow-2xl font-mono text-xs`}
           style={{ position: 'fixed' }}>

        {/* Arrow pointer toward the highlighted element */}
        <ArrowIndicator side={current.arrowSide} />

        {/* Progress bar */}
        <div className="h-1 bg-[#21262d] rounded-t-lg overflow-hidden">
          <div
            className="h-full bg-[#58a6ff] transition-all duration-300"
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-4">
          {/* Step counter + highlight badge */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[#484f58] text-[10px] uppercase tracking-widest">
              Step {step + 1} of {TOUR_STEPS.length}
            </div>
            {current.highlight && (
              <div className="text-[#58a6ff] text-[10px] font-bold animate-pulse bg-[#0d1117] px-2 py-0.5 rounded border border-[#58a6ff]/40">
                {current.highlight}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="text-[#e6edf3] font-bold text-sm mb-2">{current.title}</div>

          {/* Description */}
          <p className="text-[#8b949e] leading-relaxed mb-4">{current.description}</p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="text-[#484f58] hover:text-[#8b949e] disabled:opacity-30 transition-colors px-2 py-1"
            >
              ← Back
            </button>

            <div className="flex gap-1">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-[#58a6ff]' : 'bg-[#30363d]'}`}
                />
              ))}
            </div>

            {isLast ? (
              <button
                onClick={onFinish}
                className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold px-4 py-1.5 rounded border border-[#2ea043] transition-colors text-[11px]"
              >
                Start →
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                className="bg-[#0d419d] hover:bg-[#1158c7] text-white font-bold px-4 py-1.5 rounded border border-[#388bfd] transition-colors text-[11px]"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Skip link */}
      <button
        onClick={onFinish}
        className="fixed bottom-6 right-6 z-50 text-[#484f58] hover:text-[#8b949e] text-xs font-mono transition-colors"
      >
        Skip tour
      </button>
    </>
  )
}
