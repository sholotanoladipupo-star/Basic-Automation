import { useState } from 'react'

interface LogViewerProps {
  onQuery: (service: string, filter?: string) => void
  logLines: string[]
  availableServices: string[]
  busy: boolean
}

export default function LogViewer({ onQuery, logLines, availableServices, busy }: LogViewerProps) {
  const [selectedService, setSelectedService] = useState(availableServices[0] ?? '')
  const [filter, setFilter] = useState('')

  function handleFetch() {
    if (!selectedService) return
    onQuery(selectedService, filter || undefined)
  }

  function getLineStyle(line: string): string {
    const lower = line.toLowerCase()
    if (lower.includes('error') || lower.includes('fatal') || lower.includes('crit')) return 'text-[#f85149]'
    if (lower.includes('warn')) return 'text-[#d29922]'
    if (lower.includes('info')) return 'text-[#8b949e]'
    return 'text-[#e6edf3]'
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] font-mono text-xs">
      {/* Query bar */}
      <div className="flex-shrink-0 p-3 bg-[#161b22] border-b border-[#30363d] space-y-2">
        <div className="text-xs text-[#8b949e] uppercase tracking-widest mb-2">Log Viewer</div>
        <div className="flex gap-2">
          <select
            value={selectedService}
            onChange={e => setSelectedService(e.target.value)}
            className="bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#3fb950] font-mono flex-1"
          >
            {availableServices.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="grep pattern..."
            className="bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#3fb950] font-mono flex-1"
          />
          <button
            onClick={handleFetch}
            disabled={busy || !selectedService}
            className="bg-[#21262d] hover:bg-[#30363d] disabled:opacity-50 border border-[#30363d] text-[#e6edf3] text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap"
          >
            {busy ? '◉ Loading...' : 'Fetch Logs'}
          </button>
        </div>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {logLines.length === 0 ? (
          <div className="text-[#484f58] italic text-center mt-8">
            Select a service and click Fetch Logs to view log output.
          </div>
        ) : (
          logLines.map((line, i) => {
            // Extract timestamp prefix if present
            const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.Z]+|\w{3}\s+\d{1,2}\s+[\d:]+)(.*)/)
            if (match) {
              return (
                <div key={i} className={getLineStyle(line)}>
                  <span className="text-[#39d353]">{match[1]}</span>
                  {match[2]}
                </div>
              )
            }
            return <div key={i} className={getLineStyle(line)}>{line}</div>
          })
        )}
      </div>
    </div>
  )
}
