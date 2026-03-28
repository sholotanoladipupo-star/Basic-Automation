import { useState } from 'react'
import { SystemState } from '../types'

interface NewRelicPanelProps {
  systemState: SystemState | null
}

const NR_NAV = [
  { id: 'apm', label: 'APM & Services' },
  { id: 'infra', label: 'Infrastructure' },
  { id: 'errors', label: 'Errors Inbox' },
  { id: 'traces', label: 'Distributed Tracing' },
]

function HealthBar({ value, max, warn, crit }: { value: number; max: number; warn: number; crit: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = value >= crit ? '#f85149' : value >= warn ? '#d29922' : '#00b4a0'
  return (
    <div className="w-full bg-[#1d2029] rounded-full h-1.5 mt-1">
      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export default function NewRelicPanel({ systemState }: NewRelicPanelProps) {
  const [activeTab, setActiveTab] = useState('apm')
  const services = systemState ? Object.values(systemState.services) : []
  const databases = systemState?.infrastructure.databases ?? []
  const caches = systemState?.infrastructure.caches ?? []

  const totalErrors = services.reduce((sum, s) => sum + s.error_rate, 0)
  const avgLatency = services.length > 0 ? Math.round(services.reduce((sum, s) => sum + s.p99_latency_ms, 0) / services.length) : 0
  const degradedCount = services.filter(s => s.status !== 'healthy').length

  return (
    <div className="flex flex-col h-full bg-[#12131a] font-mono text-xs text-[#d4d4d4] overflow-hidden">
      {/* New Relic top bar */}
      <div className="bg-[#1a1d2e] border-b border-[#2d2f45] px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[11px]" style={{ background: 'linear-gradient(135deg, #00b4a0 0%, #0078bf 100%)' }}>NR</div>
          <span className="text-[#d4d4d4] font-medium">New Relic One</span>
          <span className="text-[#555] text-[10px]">· moniepoint-production</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className={`font-bold ${degradedCount > 0 ? 'text-[#f85149]' : 'text-[#00b4a0]'}`}>
            {degradedCount > 0 ? `⚠ ${degradedCount} service${degradedCount > 1 ? 's' : ''} degraded` : '✓ All services healthy'}
          </span>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="bg-[#1a1d2e] border-b border-[#2d2f45] px-4 py-2 flex gap-4 flex-shrink-0">
        {[
          { label: 'Avg Error Rate', value: `${(totalErrors / Math.max(services.length, 1) * 100).toFixed(1)}%`, bad: totalErrors / Math.max(services.length, 1) > 0.05 },
          { label: 'Avg p99 Latency', value: `${avgLatency}ms`, bad: avgLatency > 1000 },
          { label: 'Services Monitored', value: `${services.length}`, bad: false },
          { label: 'Open Incidents', value: `${systemState?.active_incidents.length ?? 0}`, bad: (systemState?.active_incidents.length ?? 0) > 0 },
        ].map(t => (
          <div key={t.label} className="bg-[#12131a] border border-[#2d2f45] rounded px-3 py-1.5">
            <div className="text-[#666] text-[9px] uppercase tracking-widest mb-0.5">{t.label}</div>
            <div className={`font-bold text-sm tabular-nums ${t.bad ? 'text-[#f85149]' : 'text-[#00b4a0]'}`}>{t.value}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="bg-[#1a1d2e] border-b border-[#2d2f45] flex flex-shrink-0">
        {NR_NAV.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-[11px] border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'text-[#00b4a0] border-[#00b4a0]'
                : 'text-[#666] border-transparent hover:text-[#d4d4d4]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {activeTab === 'apm' && (
          <>
            <div className="text-[#888] text-[10px] uppercase tracking-widest mb-2">Service Performance — Last 5 minutes</div>
            {services.map(svc => (
              <div key={svc.name} className="bg-[#1a1d2e] border border-[#2d2f45] rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#d4d4d4] font-bold">{svc.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    svc.status === 'down' ? 'bg-[#2a0a0a] text-[#f85149]'
                    : svc.status === 'degraded' ? 'bg-[#2a1e00] text-[#d29922]'
                    : 'bg-[#0a2a20] text-[#00b4a0]'
                  }`}>
                    {svc.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div>
                    <div className="text-[#666] text-[10px] mb-0.5">Error Rate</div>
                    <span className={`font-bold tabular-nums ${svc.error_rate > 0.1 ? 'text-[#f85149]' : svc.error_rate > 0.02 ? 'text-[#d29922]' : 'text-[#00b4a0]'}`}>
                      {(svc.error_rate * 100).toFixed(1)}%
                    </span>
                    <HealthBar value={svc.error_rate * 100} max={100} warn={5} crit={20} />
                  </div>
                  <div>
                    <div className="text-[#666] text-[10px] mb-0.5">p99 Latency</div>
                    <span className={`font-bold tabular-nums ${svc.p99_latency_ms > 2000 ? 'text-[#f85149]' : svc.p99_latency_ms > 500 ? 'text-[#d29922]' : 'text-[#d4d4d4]'}`}>
                      {svc.p99_latency_ms}ms
                    </span>
                    <HealthBar value={svc.p99_latency_ms} max={10000} warn={500} crit={2000} />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'infra' && (
          <>
            <div className="text-[#888] text-[10px] uppercase tracking-widest mb-2">Infrastructure Hosts & Services</div>
            {[...caches, ...databases].map((item, i) => (
              <div key={i} className="bg-[#1a1d2e] border border-[#2d2f45] rounded p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#d4d4d4] font-bold">{item.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    item.status === 'down' ? 'bg-[#2a0a0a] text-[#f85149]'
                    : item.status === 'degraded' ? 'bg-[#2a1e00] text-[#d29922]'
                    : 'bg-[#0a2a20] text-[#00b4a0]'
                  }`}>{item.status.toUpperCase()}</span>
                </div>
                {'hit_rate' in item && (
                  <div className="mt-1.5 text-[10px] text-[#888]">Hit rate: <span className="text-[#d4d4d4]">{(item.hit_rate * 100).toFixed(0)}%</span></div>
                )}
                {'connection_count' in item && (
                  <div className="mt-1.5 text-[10px] text-[#888]">Connections: <span className="text-[#d4d4d4]">{item.connection_count}/{item.max_connections}</span></div>
                )}
              </div>
            ))}
          </>
        )}

        {activeTab === 'errors' && (
          <div className="space-y-2">
            <div className="text-[#888] text-[10px] uppercase tracking-widest mb-2">Errors Inbox — Active Incidents</div>
            {(systemState?.active_incidents ?? []).map(inc => (
              <div key={inc.id} className="bg-[#1a1d2e] border border-[#f85149]/40 rounded p-3">
                <div className="text-[#f85149] font-bold mb-1">ACTIVE INCIDENT</div>
                <div className="text-[#d4d4d4] mb-1">{inc.root_cause}</div>
                <div className="text-[#888] text-[10px]">Affected: {inc.blast_radius.join(', ')}</div>
              </div>
            ))}
            {services.filter(s => s.error_rate > 0.05).map(svc => (
              <div key={svc.name} className="bg-[#1a1d2e] border border-[#d29922]/40 rounded p-3">
                <div className="text-[#d29922] font-bold mb-1">{svc.name} — High Error Rate</div>
                <div className="text-[#888] text-[10px]">{(svc.error_rate * 100).toFixed(1)}% errors in last 5m · p99 {svc.p99_latency_ms}ms</div>
              </div>
            ))}
            {systemState?.active_incidents.length === 0 && services.every(s => s.error_rate <= 0.05) && (
              <div className="text-center text-[#555] py-8">No active errors</div>
            )}
          </div>
        )}

        {activeTab === 'traces' && (
          <div className="space-y-2">
            <div className="text-[#888] text-[10px] uppercase tracking-widest mb-2">Distributed Tracing — Recent Traces</div>
            {services.slice(0, 4).map((svc, i) => (
              <div key={i} className="bg-[#1a1d2e] border border-[#2d2f45] rounded p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[#d4d4d4]">POST /api/{svc.name.replace('-service', '')}</span>
                  <span className={`tabular-nums font-bold ${svc.p99_latency_ms > 1000 ? 'text-[#f85149]' : 'text-[#d4d4d4]'}`}>{svc.p99_latency_ms}ms</span>
                </div>
                <div className="flex gap-1 h-3">
                  {[svc.name, 'redis', 'postgres'].map((span, j) => (
                    <div key={j} className="rounded-sm flex-1 text-[8px] flex items-center px-1 overflow-hidden"
                      style={{ backgroundColor: j === 0 ? '#1a3a6e' : j === 1 ? '#1a3a2e' : '#3a1a2e' }}>
                      <span className="text-[#666] truncate">{span}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
