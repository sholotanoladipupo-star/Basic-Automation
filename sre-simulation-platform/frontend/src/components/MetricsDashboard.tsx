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

function StatusDot({ status }: { status: 'healthy' | 'degraded' | 'down' }) {
  const colors = { healthy: '#3fb950', degraded: '#d29922', down: '#f85149' }
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1"
      style={{ backgroundColor: colors[status] }}
    />
  )
}

function MetricBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="w-full bg-[#0d1117] rounded-full h-1.5 mt-1">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export default function MetricsDashboard({ systemState, availableDashboards, dashboardData, onQueryDashboard }: MetricsDashboardProps) {
  const services = systemState ? Object.values(systemState.services) : []
  const caches = systemState?.infrastructure.caches ?? []
  const databases = systemState?.infrastructure.databases ?? []

  return (
    <div className="flex flex-col h-full bg-[#0d1117] font-mono text-xs overflow-y-auto">
      {/* Dashboard selector */}
      <div className="flex-shrink-0 p-3 bg-[#161b22] border-b border-[#30363d]">
        <div className="text-xs text-[#8b949e] uppercase tracking-widest mb-2">Dashboards</div>
        <div className="flex flex-wrap gap-2">
          {availableDashboards.map(d => (
            <button
              key={d.id}
              onClick={() => onQueryDashboard(d.id)}
              className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] hover:border-[#58a6ff] text-[#e6edf3] text-xs px-3 py-1.5 rounded transition-colors"
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-4">
        {/* Live Service Health */}
        <div>
          <div className="text-[#8b949e] uppercase tracking-widest mb-2">Service Health — Live</div>
          <div className="grid grid-cols-1 gap-2">
            {services.map(svc => (
              <div key={svc.name} className="bg-[#161b22] border border-[#30363d] rounded p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <StatusDot status={svc.status} />
                    <span className="text-[#e6edf3] font-bold">{svc.name}</span>
                  </div>
                  <span className="text-[#8b949e]">{svc.status}</span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2 text-[#8b949e]">
                  <div>
                    <span>error_rate: </span>
                    <span className={svc.error_rate > 0.1 ? 'text-[#f85149]' : svc.error_rate > 0.02 ? 'text-[#d29922]' : 'text-[#3fb950]'}>
                      {(svc.error_rate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span>p99: </span>
                    <span className={svc.p99_latency_ms > 5000 ? 'text-[#f85149]' : svc.p99_latency_ms > 1000 ? 'text-[#d29922]' : 'text-[#e6edf3]'}>
                      {svc.p99_latency_ms}ms
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cache status */}
        {caches.length > 0 && (
          <div>
            <div className="text-[#8b949e] uppercase tracking-widest mb-2">Cache</div>
            {caches.map(cache => (
              <div key={cache.name} className="bg-[#161b22] border border-[#30363d] rounded p-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <StatusDot status={cache.status} />
                  <span className="text-[#e6edf3] font-bold">{cache.name}</span>
                  <span className="ml-auto text-[#8b949e]">{cache.status}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#8b949e]">hit_rate</span>
                    <span className={cache.hit_rate < 0.5 ? 'text-[#f85149]' : 'text-[#3fb950]'}>{(cache.hit_rate * 100).toFixed(0)}%</span>
                  </div>
                  <MetricBar value={cache.hit_rate * 100} max={100} color={cache.hit_rate < 0.5 ? '#f85149' : '#3fb950'} />
                  <div className="flex justify-between mt-1">
                    <span className="text-[#8b949e]">memory</span>
                    <span className="text-[#e6edf3]">{cache.memory_used_mb} / {cache.memory_total_mb} MB</span>
                  </div>
                  <MetricBar value={cache.memory_used_mb} max={cache.memory_total_mb} color="#58a6ff" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Database status */}
        {databases.length > 0 && (
          <div>
            <div className="text-[#8b949e] uppercase tracking-widest mb-2">Databases</div>
            {databases.map(db => (
              <div key={db.name} className="bg-[#161b22] border border-[#30363d] rounded p-2 mb-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <StatusDot status={db.status} />
                  <span className="text-[#e6edf3] font-bold">{db.name}</span>
                  <span className="ml-auto text-[#8b949e]">{db.status}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#8b949e]">connections</span>
                    <span className={db.connection_count / db.max_connections > 0.8 ? 'text-[#f85149]' : 'text-[#e6edf3]'}>
                      {db.connection_count} / {db.max_connections}
                    </span>
                  </div>
                  <MetricBar value={db.connection_count} max={db.max_connections} color={db.connection_count / db.max_connections > 0.8 ? '#f85149' : '#3fb950'} />
                  <div className="flex justify-between mt-1">
                    <span className="text-[#8b949e]">query p99</span>
                    <span className={db.query_latency_ms > 1000 ? 'text-[#f85149]' : 'text-[#e6edf3]'}>
                      {db.query_latency_ms === 999999 ? '∞' : `${db.query_latency_ms}ms`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Queried dashboard metrics */}
        {Object.entries(dashboardData).map(([id, dash]) => (
          <div key={id}>
            <div className="text-[#8b949e] uppercase tracking-widest mb-2">{dash.name}</div>
            <div className="bg-[#161b22] border border-[#30363d] rounded p-2 space-y-1">
              {dash.metrics.map((m, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[#8b949e]">{m.service}.{m.metric}</span>
                  <span className="text-[#e6edf3]">{m.value} {m.unit}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
