import { SystemState, MetricPoint } from '../types'

interface DashboardEntry {
  name: string
  metrics: MetricPoint[]
}

interface MetricsDashboardProps {
  systemState: SystemState | null
  availableDashboards: { id: string; name: string }[]
  dashboardData: Record<string, DashboardEntry>
  onQueryDashboard: (id: string) => void
}

function statusColor(status: 'healthy' | 'degraded' | 'down') {
  if (status === 'healthy') return '#3fb950'
  if (status === 'degraded') return '#d29922'
  return '#f85149'
}

function statusBg(status: 'healthy' | 'degraded' | 'down') {
  if (status === 'healthy') return 'bg-[#0f2a1a] border-[#3fb950]'
  if (status === 'degraded') return 'bg-[#2a1e00] border-[#d29922]'
  return 'bg-[#2a0a0a] border-[#f85149]'
}

function MetricBar({ value, max, warn, crit }: { value: number; max: number; warn: number; crit: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = value >= crit ? '#f85149' : value >= warn ? '#d29922' : '#3fb950'
  return (
    <div className="w-full bg-[#0d1117] rounded h-1.5 mt-1">
      <div className="h-1.5 rounded transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

function MetricValue({ value, unit, warn, crit }: { value: number | string; unit: string; warn?: number; crit?: number }) {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  let color = 'text-[#e6edf3]'
  if (!isNaN(num) && crit !== undefined && warn !== undefined) {
    color = num >= crit ? 'text-[#f85149]' : num >= warn ? 'text-[#d29922]' : 'text-[#3fb950]'
  }
  return <span className={`font-bold tabular-nums ${color}`}>{value}{unit}</span>
}

export default function MetricsDashboard({ systemState, availableDashboards, dashboardData, onQueryDashboard }: MetricsDashboardProps) {
  const services = systemState ? Object.values(systemState.services) : []
  const caches = systemState?.infrastructure.caches ?? []
  const databases = systemState?.infrastructure.databases ?? []

  return (
    <div className="flex flex-col h-full bg-[#0d1117] font-mono text-xs overflow-y-auto">

      {/* Dashboard load buttons */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="text-[10px] text-[#484f58] uppercase tracking-widest mb-2">Load Dashboard</div>
        <div className="flex flex-wrap gap-1.5">
          {availableDashboards.map(d => (
            <button
              key={d.id}
              onClick={() => onQueryDashboard(d.id)}
              className="bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-[#58a6ff] text-[#8b949e] hover:text-[#e6edf3] text-[11px] px-2.5 py-1 rounded transition-colors"
            >
              📊 {d.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-4">

        {/* Service Health Grid */}
        {services.length > 0 && (
          <section>
            <div className="text-[10px] text-[#484f58] uppercase tracking-widest mb-2 flex items-center gap-2">
              <span>Service Health</span>
              <span className="text-[#3fb950]">● LIVE</span>
            </div>
            <div className="space-y-1.5">
              {services.map(svc => (
                <div key={svc.name} className={`border rounded p-2.5 ${statusBg(svc.status)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#e6edf3]">{svc.name}</span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ color: statusColor(svc.status), border: `1px solid ${statusColor(svc.status)}` }}>
                      {svc.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>
                      <div className="text-[#484f58] text-[10px] mb-0.5">Error Rate</div>
                      <MetricValue value={(svc.error_rate * 100).toFixed(1)} unit="%" warn={5} crit={20} />
                      <MetricBar value={svc.error_rate * 100} max={100} warn={5} crit={20} />
                    </div>
                    <div>
                      <div className="text-[#484f58] text-[10px] mb-0.5">p99 Latency</div>
                      <MetricValue value={svc.p99_latency_ms} unit="ms" warn={1000} crit={5000} />
                      <MetricBar value={svc.p99_latency_ms} max={10000} warn={1000} crit={5000} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cache Section */}
        {caches.length > 0 && (
          <section>
            <div className="text-[10px] text-[#484f58] uppercase tracking-widest mb-2">Cache Layer</div>
            {caches.map(cache => (
              <div key={cache.name} className={`border rounded p-2.5 mb-1.5 ${statusBg(cache.status)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[#e6edf3]">{cache.name}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ color: statusColor(cache.status), border: `1px solid ${statusColor(cache.status)}` }}>
                    {cache.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <div>
                    <div className="text-[#484f58] text-[10px] mb-0.5">Hit Rate</div>
                    <MetricValue value={(cache.hit_rate * 100).toFixed(0)} unit="%" warn={70} crit={30} />
                    <div className="w-full bg-[#0d1117] rounded h-1.5 mt-1">
                      <div className="h-1.5 rounded transition-all duration-500"
                        style={{ width: `${Math.min(100, cache.hit_rate * 100)}%`, backgroundColor: cache.hit_rate < 0.3 ? '#f85149' : cache.hit_rate < 0.7 ? '#d29922' : '#3fb950' }} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[#484f58] text-[10px] mb-0.5">Memory</div>
                    <span className="font-bold text-[#e6edf3]">{cache.memory_used_mb}<span className="text-[#484f58] font-normal">/{cache.memory_total_mb} MB</span></span>
                    <MetricBar value={cache.memory_used_mb} max={cache.memory_total_mb} warn={80} crit={95} />
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Database Section */}
        {databases.length > 0 && (
          <section>
            <div className="text-[10px] text-[#484f58] uppercase tracking-widest mb-2">Databases</div>
            {databases.map(db => (
              <div key={db.name} className={`border rounded p-2.5 mb-1.5 ${statusBg(db.status)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[#e6edf3]">{db.name}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ color: statusColor(db.status), border: `1px solid ${statusColor(db.status)}` }}>
                    {db.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <div>
                    <div className="text-[#484f58] text-[10px] mb-0.5">Connections</div>
                    <span className="font-bold">
                      <MetricValue value={db.connection_count} unit="" warn={db.max_connections * 0.7} crit={db.max_connections * 0.9} />
                      <span className="text-[#484f58] font-normal">/{db.max_connections}</span>
                    </span>
                    <MetricBar value={db.connection_count} max={db.max_connections} warn={70} crit={90} />
                  </div>
                  <div>
                    <div className="text-[#484f58] text-[10px] mb-0.5">Query p99</div>
                    <MetricValue value={db.query_latency_ms === 999999 ? '∞' : db.query_latency_ms} unit={db.query_latency_ms === 999999 ? '' : 'ms'} warn={500} crit={2000} />
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Queried dashboard data */}
        {Object.entries(dashboardData).map(([id, dash]) => (
          <section key={id}>
            <div className="text-[10px] text-[#484f58] uppercase tracking-widest mb-2">{dash.name}</div>
            <div className="bg-[#161b22] border border-[#30363d] rounded overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#30363d] bg-[#0d1117]">
                    <th className="text-left px-3 py-1.5 text-[#484f58] font-normal">Metric</th>
                    <th className="text-right px-3 py-1.5 text-[#484f58] font-normal">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.metrics.map((m, i) => (
                    <tr key={i} className="border-b border-[#1c2128] last:border-0 hover:bg-[#1c2128]">
                      <td className="px-3 py-1.5 text-[#8b949e]">{m.service} <span className="text-[#484f58]">·</span> {m.metric}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#e6edf3] tabular-nums">{m.value}<span className="text-[#484f58] font-normal ml-0.5 text-[10px]">{m.unit}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {services.length === 0 && caches.length === 0 && databases.length === 0 && Object.keys(dashboardData).length === 0 && (
          <div className="text-[#484f58] text-center py-12 italic">
            Waiting for system state…
          </div>
        )}
      </div>
    </div>
  )
}
