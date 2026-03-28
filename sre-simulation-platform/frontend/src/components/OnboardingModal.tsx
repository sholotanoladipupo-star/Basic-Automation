interface OnboardingModalProps {
  onDismiss: () => void
  scenarioName: string
  timeLimitMinutes: number
}

const glossary = [
  { term: 'ACK', full: 'Acknowledge', desc: 'Confirm you have seen an alert. Does NOT mean it is resolved — just that someone is on it.' },
  { term: 'SEV1', full: 'Severity 1', desc: 'Critical — revenue loss, full outage, immediate all-hands response required.' },
  { term: 'SEV2', full: 'Severity 2', desc: 'Major degradation — significant customer impact, response within minutes.' },
  { term: 'SEV3', full: 'Severity 3', desc: 'Minor issue — limited impact, response within the hour.' },
  { term: 'Escalate', full: 'Escalation', desc: 'Bring in more people (senior SRE, manager). Use when you\'re stuck or impact is growing.' },
  { term: 'Runbook', full: 'Runbook', desc: 'Step-by-step recovery procedure for known failure modes. Always check before guessing.' },
  { term: 'Postmortem', full: 'Post-Incident Review', desc: 'Written analysis of what happened, why, and how to prevent it. Filed after resolution.' },
]

const panels = [
  { icon: '🚨', name: 'Alerts (left)', desc: 'Live PagerDuty-style alert feed. ACK each alert to confirm receipt. New alerts will speak aloud.' },
  { icon: '⌨', name: 'Terminal (centre)', desc: 'Run kubectl, redis-cli, psql, curl and other commands. Arrow-Up recalls history. Press Enter to run.' },
  { icon: '📊', name: 'Dashboards', desc: 'Live service health grid + metric charts. Click a dashboard button to load it. Always check this first.' },
  { icon: '📋', name: 'Logs', desc: 'Fetch service logs with optional grep filter. Start with redis-primary and order-service.' },
  { icon: '📖', name: 'Runbooks', desc: 'Pre-written recovery procedures. Redis Recovery runbook contains the exact fix for this scenario.' },
  { icon: '⚙', name: 'Incident Panel (right)', desc: 'Declare severity, escalate, call runbooks, and mark the incident resolved when services are healthy.' },
  { icon: '💬', name: 'Comms (bottom right)', desc: 'Slack-like messaging. Post updates to #incidents so stakeholders know the status.' },
]

export default function OnboardingModal({ onDismiss, scenarioName, timeLimitMinutes }: OnboardingModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg max-w-2xl w-full my-4 font-mono text-xs">
        {/* Header */}
        <div className="p-5 border-b border-[#30363d]">
          <div className="text-[#3fb950] uppercase tracking-widest text-xs mb-1">Simulation Brief</div>
          <h2 className="text-[#e6edf3] text-lg font-bold">{scenarioName}</h2>
          <div className="text-[#8b949e] mt-1">
            You have <span className="text-[#d29922] font-bold">{timeLimitMinutes} minutes</span> to investigate and resolve.
            Your every action is scored. Read this brief — it will save time.
          </div>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Glossary */}
          <section>
            <div className="text-[#8b949e] uppercase tracking-widest mb-2">Glossary</div>
            <div className="grid grid-cols-1 gap-1.5">
              {glossary.map(g => (
                <div key={g.term} className="flex gap-3 items-start bg-[#0d1117] rounded p-2">
                  <span className="text-[#3fb950] font-bold w-14 flex-shrink-0">{g.term}</span>
                  <span className="text-[#8b949e] w-28 flex-shrink-0">{g.full}</span>
                  <span className="text-[#e6edf3]">{g.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Panels */}
          <section>
            <div className="text-[#8b949e] uppercase tracking-widest mb-2">Interface Panels</div>
            <div className="grid grid-cols-1 gap-1.5">
              {panels.map(p => (
                <div key={p.name} className="flex gap-3 items-start bg-[#0d1117] rounded p-2">
                  <span className="text-lg flex-shrink-0 w-8">{p.icon}</span>
                  <span className="text-[#58a6ff] font-bold w-36 flex-shrink-0">{p.name}</span>
                  <span className="text-[#e6edf3]">{p.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Scoring */}
          <section>
            <div className="text-[#8b949e] uppercase tracking-widest mb-2">Scoring (passing: 65/100)</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { dim: 'Incident Coordination', weight: '25%', hints: 'Severity timing, Slack updates, escalation' },
                { dim: 'Incident Resolution', weight: '35%', hints: 'Correct diagnosis, remediation, speed' },
                { dim: 'Technical Depth', weight: '25%', hints: 'kubectl, redis-cli, runbooks, breadth' },
                { dim: 'Observability Usage', weight: '15%', hints: 'Dashboards, logs, alert acknowledgement' },
              ].map(d => (
                <div key={d.dim} className="bg-[#0d1117] rounded p-2">
                  <div className="text-[#e6edf3] font-bold">{d.dim} <span className="text-[#d29922]">{d.weight}</span></div>
                  <div className="text-[#8b949e] mt-0.5">{d.hints}</div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#30363d]">
          <button
            onClick={onDismiss}
            className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-3 rounded border border-[#2ea043] transition-colors text-sm tracking-wide"
          >
            ▶ I UNDERSTAND — START INVESTIGATING
          </button>
          <div className="text-[#484f58] text-center mt-2">Your timer starts when you click the button above.</div>
        </div>
      </div>
    </div>
  )
}
