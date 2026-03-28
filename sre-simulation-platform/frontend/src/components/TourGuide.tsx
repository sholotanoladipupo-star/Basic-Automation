interface TourStep {
  title: string
  description: string
  arrow: 'left' | 'right' | 'top' | 'bottom'
  position: string // Tailwind positioning classes for the tooltip card
}

const TOUR_STEPS: TourStep[] = [
  {
    title: '🚨 Alerts Panel',
    description: 'Live PagerDuty-style alert feed. Every alert shows its severity (SEV1/2/3) and timestamp relative to session start (T+mm:ss). Click ACK to acknowledge — this scores you on coordination. New alerts will sound a siren.',
    arrow: 'right',
    position: 'left-[280px] top-24',
  },
  {
    title: '⌨ Terminal',
    description: 'Your primary investigation tool. Run any Linux/Kubernetes command — kubectl, redis-cli, psql, curl, df, top, journalctl. Arrow-Up recalls history. Ctrl+Enter also runs a command. Commands are evaluated against the live system state.',
    arrow: 'bottom',
    position: 'left-1/2 -translate-x-1/2 top-20',
  },
  {
    title: '📊 Dashboards Tab',
    description: 'Click a dashboard button to load live service metrics — error rates, latency, cache hit rate, DB connections. The service health grid updates in real-time. Always open dashboards early — they tell you where to look.',
    arrow: 'bottom',
    position: 'left-1/2 -translate-x-1/2 top-20',
  },
  {
    title: '📋 Logs Tab',
    description: 'Query logs from any service. Select the service, add an optional grep filter, and click Fetch. Logs show timestamps and are colour-coded by severity. Redis and order-service logs usually reveal the root cause first.',
    arrow: 'bottom',
    position: 'left-1/2 -translate-x-1/2 top-20',
  },
  {
    title: '⚙ Incident Panel (right)',
    description: 'Declare severity (SEV1/2/3) within 2 minutes — this is weighted heavily. Escalate to on-call leads if stuck. Open runbooks for step-by-step guidance. Click Resolve when all services are healthy.',
    arrow: 'left',
    position: 'right-[280px] top-24',
  },
  {
    title: '💬 Comms Panel',
    description: 'Post Slack updates to #incidents and #oncall. Stakeholders need to know what\'s happening — even brief updates ("investigating redis", "restarting cache primary") earn coordination points. Aim for one message every 2-3 minutes.',
    arrow: 'left',
    position: 'right-[280px] bottom-32',
  },
  {
    title: '🌐 GCP Console Tab',
    description: 'A simulated Google Cloud Console showing your cluster\'s GKE workloads, Cloud SQL instances, and IAM. Use this to cross-reference pod status, check instance health, and view infrastructure-level signals.',
    arrow: 'bottom',
    position: 'left-1/2 -translate-x-1/2 top-20',
  },
  {
    title: '📈 New Relic Tab',
    description: 'Simulated APM showing service throughput, error rates, and transaction traces. Use it to identify which service degraded first and trace errors to their upstream source.',
    arrow: 'bottom',
    position: 'left-1/2 -translate-x-1/2 top-20',
  },
]

interface TourGuideProps {
  onFinish: () => void
}

export default function TourGuide({ onFinish }: TourGuideProps) {
  const [step, setStep] = useState(0)

  const current = TOUR_STEPS[step]
  const isLast = step === TOUR_STEPS.length - 1

  return (
    <>
      {/* Dim overlay */}
      <div className="fixed inset-0 bg-black/60 z-40 pointer-events-none" />

      {/* Tour card */}
      <div className={`fixed z-50 ${current.position} w-80 bg-[#161b22] border border-[#58a6ff] rounded-lg shadow-2xl font-mono text-xs`}>
        {/* Progress bar */}
        <div className="h-1 bg-[#21262d] rounded-t-lg overflow-hidden">
          <div
            className="h-full bg-[#58a6ff] transition-all duration-300"
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-4">
          {/* Step counter */}
          <div className="text-[#484f58] text-[10px] uppercase tracking-widest mb-2">
            Step {step + 1} of {TOUR_STEPS.length}
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

// Must import useState at top — add it here
import { useState } from 'react'
