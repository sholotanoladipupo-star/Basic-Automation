import { useState } from 'react'

interface IncidentPanelProps {
  severityDeclared: 'sev1' | 'sev2' | 'sev3' | null
  incidentResolved: boolean
  elapsedSeconds: number
  availableRunbooks: { id: string; title: string }[]
  onDeclareSeverity: (s: 'sev1' | 'sev2' | 'sev3') => void
  onEscalate: (to: string, message: string) => void
  onResolveIncident: () => void
  onCallRunbook: (id: string) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function IncidentPanel({
  severityDeclared, incidentResolved, elapsedSeconds,
  availableRunbooks, onDeclareSeverity, onEscalate, onResolveIncident, onCallRunbook
}: IncidentPanelProps) {
  const [escalateTo, setEscalateTo] = useState('')
  const [escalateMsg, setEscalateMsg] = useState('')

  function handleEscalate() {
    if (!escalateTo.trim() || !escalateMsg.trim()) return
    onEscalate(escalateTo.trim(), escalateMsg.trim())
    setEscalateTo('')
    setEscalateMsg('')
  }

  return (
    <div className="flex flex-col bg-[#161b22] border-l border-[#30363d] text-xs font-mono overflow-y-auto">
      {/* Timer */}
      <div className="px-3 py-2 border-b border-[#30363d] flex items-center justify-between">
        <span className="text-[#8b949e] uppercase tracking-widest">Incident</span>
        <span className={`font-bold ${elapsedSeconds > 1800 ? 'text-[#f85149]' : elapsedSeconds > 900 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
          {formatTime(elapsedSeconds)}
        </span>
      </div>

      <div className="p-3 space-y-4">
        {/* Severity declaration */}
        <div>
          <div className="text-[#8b949e] uppercase tracking-widest mb-2">Severity</div>
          {severityDeclared ? (
            <div className={`text-center py-1.5 rounded font-bold ${severityDeclared === 'sev1' ? 'bg-[#f85149] text-white' : severityDeclared === 'sev2' ? 'bg-[#d18616] text-white' : 'bg-[#d29922] text-black'}`}>
              {severityDeclared.toUpperCase()} DECLARED
            </div>
          ) : (
            <div className="flex gap-1.5">
              {(['sev1', 'sev2', 'sev3'] as const).map(sev => (
                <button
                  key={sev}
                  onClick={() => onDeclareSeverity(sev)}
                  className={`flex-1 py-1.5 rounded border font-bold transition-colors ${
                    sev === 'sev1' ? 'border-[#f85149] text-[#f85149] hover:bg-[#f85149] hover:text-white' :
                    sev === 'sev2' ? 'border-[#d18616] text-[#d18616] hover:bg-[#d18616] hover:text-white' :
                    'border-[#d29922] text-[#d29922] hover:bg-[#d29922] hover:text-black'
                  }`}
                >
                  {sev.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Runbooks */}
        {availableRunbooks.length > 0 && (
          <div>
            <div className="text-[#8b949e] uppercase tracking-widest mb-2">Runbooks</div>
            <div className="space-y-1">
              {availableRunbooks.map(rb => (
                <button
                  key={rb.id}
                  onClick={() => onCallRunbook(rb.id)}
                  className="w-full text-left text-[#58a6ff] hover:text-[#79c0ff] hover:bg-[#0d1117] px-2 py-1 rounded transition-colors truncate"
                >
                  📖 {rb.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Escalate */}
        <div>
          <div className="text-[#8b949e] uppercase tracking-widest mb-2">Escalate</div>
          <div className="space-y-1.5">
            <input
              type="text"
              value={escalateTo}
              onChange={e => setEscalateTo(e.target.value)}
              placeholder="To (e.g. sre-lead)"
              className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#58a6ff] font-mono"
            />
            <input
              type="text"
              value={escalateMsg}
              onChange={e => setEscalateMsg(e.target.value)}
              placeholder="Message..."
              className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#58a6ff] font-mono"
            />
            <button
              onClick={handleEscalate}
              disabled={!escalateTo.trim() || !escalateMsg.trim()}
              className="w-full bg-[#21262d] hover:bg-[#30363d] disabled:opacity-40 border border-[#30363d] text-[#e6edf3] text-xs py-1.5 rounded transition-colors"
            >
              Send Escalation
            </button>
          </div>
        </div>

        {/* Resolve */}
        <div>
          <button
            onClick={onResolveIncident}
            disabled={incidentResolved}
            className="w-full bg-[#161b22] hover:bg-[#21262d] disabled:opacity-40 disabled:cursor-not-allowed border border-[#f85149] text-[#f85149] font-bold text-xs py-2 rounded transition-colors"
          >
            {incidentResolved ? '✓ RESOLVED' : '■ MARK AS RESOLVED'}
          </button>
        </div>
      </div>
    </div>
  )
}
