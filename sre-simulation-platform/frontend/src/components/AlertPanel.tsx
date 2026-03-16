import { Alert } from '../types'

interface AlertPanelProps {
  alerts: Alert[]
  onAcknowledge: (alertId: string) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

const SEV_STYLES: Record<string, { badge: string; border: string; label: string }> = {
  sev1: { badge: 'bg-[#f85149] text-white', border: 'border-l-4 border-[#f85149] sev1-pulse', label: 'SEV1' },
  sev2: { badge: 'bg-[#d18616] text-white', border: 'border-l-4 border-[#d18616]', label: 'SEV2' },
  sev3: { badge: 'bg-[#d29922] text-black', border: 'border-l-4 border-[#d29922]', label: 'SEV3' }
}

export default function AlertPanel({ alerts, onAcknowledge }: AlertPanelProps) {
  const unackedCount = alerts.filter(a => !a.acknowledged).length

  return (
    <div className="flex flex-col h-full bg-[#161b22] border-r border-[#30363d]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] flex-shrink-0">
        <span className="text-xs text-[#8b949e] uppercase tracking-widest font-mono">Alerts</span>
        {unackedCount > 0 && (
          <span className="bg-[#f85149] text-white text-xs font-bold px-2 py-0.5 rounded-full font-mono">
            {unackedCount}
          </span>
        )}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-4 text-xs text-[#8b949e] font-mono text-center mt-4">
            No alerts
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {[...alerts].reverse().map(alert => {
              const style = SEV_STYLES[alert.severity] ?? SEV_STYLES.sev3
              return (
                <div
                  key={alert.id}
                  className={`${style.border} ${alert.acknowledged ? 'opacity-50' : ''} bg-[#0d1117] rounded-r p-2 text-xs font-mono`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`${style.badge} text-xs px-1.5 py-0.5 rounded font-bold`}>
                      {style.label}
                    </span>
                    <span className="text-[#484f58]">{timeAgo(alert.fired_at)}</span>
                  </div>
                  <div className="text-[#3fb950] mb-1 font-bold">{alert.service}</div>
                  <div className="text-[#e6edf3] leading-relaxed break-words">{alert.message}</div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => onAcknowledge(alert.id)}
                      className="mt-2 text-xs text-[#58a6ff] hover:text-[#79c0ff] border border-[#30363d] hover:border-[#58a6ff] px-2 py-0.5 rounded transition-colors"
                    >
                      ACK
                    </button>
                  )}
                  {alert.acknowledged && (
                    <span className="mt-1 block text-[#484f58]">✓ acknowledged</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
