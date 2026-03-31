import { useState } from 'react'
import { SystemState } from '../types'

interface Props { systemState: SystemState | null }

// Derive fake CPU/mem from service status
function cpuPct(status: string) {
  if (status === 'down') return 2
  if (status === 'degraded') return 78 + Math.floor(Math.random() * 15)
  return 18 + Math.floor(Math.random() * 20)
}
function memPct(status: string) {
  if (status === 'down') return 5
  if (status === 'degraded') return 82 + Math.floor(Math.random() * 12)
  return 30 + Math.floor(Math.random() * 25)
}

function Bar({ pct, warn = 60, crit = 85 }: { pct: number; warn?: number; crit?: number }) {
  const color = pct >= crit ? '#f85149' : pct >= warn ? '#ff7c21' : '#3fb950'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-[#1a1d2b] rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] tabular-nums w-7 text-right" style={{ color }}>{pct}%</span>
    </div>
  )
}

// Tiny sparkline using SVG
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const w = 80, h = 24
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function sampleHistory(base: number, count = 12) {
  return Array.from({ length: count }, (_, i) =>
    Math.max(0, Math.min(100, base + (Math.sin(i * 0.8) * 12) + (Math.random() * 8 - 4)))
  )
}

function CollapsibleRow({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-[#1e2030] hover:bg-[#252838] border border-[#2c3235] text-[11px] text-[#9fa8be] font-medium transition-colors"
      >
        <span className="text-[#ff7c21]">{open ? '▼' : '▶'}</span>
        <span className="uppercase tracking-widest text-[10px]">{title}</span>
        <div className="flex-1 h-px bg-[#2c3235] ml-2" />
      </button>
      {open && <div className="border-x border-b border-[#2c3235]">{children}</div>}
    </div>
  )
}

function StatCard({ label, value, sub, color = '#e6edf3' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#1a1d2b] border border-[#2c3235] rounded p-2.5 min-w-0">
      <div className="text-[9px] text-[#6b7280] uppercase tracking-widest mb-1">{label}</div>
      <div className="text-lg font-bold tabular-nums leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-[#6b7280] mt-0.5">{sub}</div>}
    </div>
  )
}

export default function GrafanaDashboard({ systemState }: Props) {
  const services = systemState ? Object.values(systemState.services) : []
  const caches = systemState?.infrastructure.caches ?? []
  const databases = systemState?.infrastructure.databases ?? []
  const clusters = systemState?.infrastructure.clusters ?? []

  const now = new Date()
  const timeLabel = `Last 5 minutes — ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`

  if (!systemState) {
    return (
      <div className="h-full bg-[#111217] flex items-center justify-center text-[#6b7280] text-xs font-mono">
        Waiting for system state…
      </div>
    )
  }

  return (
    <div className="h-full bg-[#111217] font-mono text-xs text-[#9fa8be] overflow-y-auto">
      {/* Grafana top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#2c3235] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#ff7c21">
              <circle cx="12" cy="12" r="10" fill="none" stroke="#ff7c21" strokeWidth="2"/>
              <path d="M12 6v6l4 2" stroke="#ff7c21" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-[#e6edf3] font-medium text-[11px]">Grafana</span>
          <span className="text-[#484f58] text-[10px]">/ moniepoint-prod / SRE Overview</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-[#ff7c21]">⏱ {timeLabel}</span>
          <span className="text-[#3fb950]">● Live</span>
        </div>
      </div>

      <div className="p-3 space-y-1">
        {/* Summary stat row */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <StatCard
            label="Services Total"
            value={String(services.length)}
            color="#e6edf3"
          />
          <StatCard
            label="Healthy"
            value={String(services.filter(s => s.status === 'healthy').length)}
            color="#3fb950"
          />
          <StatCard
            label="Degraded"
            value={String(services.filter(s => s.status === 'degraded').length)}
            color="#ff7c21"
          />
          <StatCard
            label="Down"
            value={String(services.filter(s => s.status === 'down').length)}
            color="#f85149"
          />
        </div>

        {/* Row 1: Kubernetes Pod Health */}
        <CollapsibleRow title="Kubernetes Pod Health" defaultOpen={true}>
          <div className="p-3 space-y-2">
            {/* Cluster summary */}
            {clusters.map(c => (
              <div key={c.name} className="flex items-center justify-between bg-[#1a1d2b] border border-[#2c3235] rounded px-3 py-1.5 text-[11px]">
                <span className="text-[#8ab4f8]">☸ {c.name}</span>
                <span className={`font-bold ${c.healthy_nodes === c.nodes ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                  {c.healthy_nodes}/{c.nodes} nodes ready
                </span>
              </div>
            ))}

            {/* Pod table */}
            <div className="bg-[#1a1d2b] border border-[#2c3235] rounded overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-[#111217] border-b border-[#2c3235]">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-[#6b7280] font-normal">Deployment</th>
                    <th className="text-left px-3 py-1.5 text-[#6b7280] font-normal">Pods</th>
                    <th className="text-left px-3 py-1.5 text-[#6b7280] font-normal">Status</th>
                    <th className="text-left px-3 py-1.5 text-[#6b7280] font-normal">Restarts</th>
                    <th className="text-left px-3 py-1.5 text-[#6b7280] font-normal">CPU</th>
                    <th className="text-left px-3 py-1.5 text-[#6b7280] font-normal">Memory</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(svc => {
                    const pods = svc.status === 'down' ? '0/3' : svc.status === 'degraded' ? '1/3' : '3/3'
                    const restarts = svc.status === 'down' ? 12 : svc.status === 'degraded' ? 3 : 0
                    const cpu = cpuPct(svc.status)
                    const mem = memPct(svc.status)
                    const statusColor = svc.status === 'down' ? '#f85149' : svc.status === 'degraded' ? '#ff7c21' : '#3fb950'
                    const statusLabel = svc.status === 'down' ? 'CrashLoopBackOff' : svc.status === 'degraded' ? 'Running (degraded)' : 'Running'
                    return (
                      <tr key={svc.name} className="border-b border-[#2c3235] last:border-0 hover:bg-[#1e2030]">
                        <td className="px-3 py-2 text-[#8ab4f8]">{svc.name}</td>
                        <td className="px-3 py-2">{pods}</td>
                        <td className="px-3 py-2 font-bold" style={{ color: statusColor }}>{statusLabel}</td>
                        <td className="px-3 py-2" style={{ color: restarts > 5 ? '#f85149' : restarts > 0 ? '#ff7c21' : '#9fa8be' }}>{restarts}</td>
                        <td className="px-3 py-2 w-28"><Bar pct={cpu} /></td>
                        <td className="px-3 py-2 w-28"><Bar pct={mem} /></td>
                      </tr>
                    )
                  })}
                  {caches.map(c => {
                    const cpu = cpuPct(c.status)
                    const mem = Math.round((c.memory_used_mb / c.memory_total_mb) * 100)
                    return (
                      <tr key={c.name} className="border-b border-[#2c3235] last:border-0 hover:bg-[#1e2030]">
                        <td className="px-3 py-2 text-[#8ab4f8]">{c.name}</td>
                        <td className="px-3 py-2">1/1</td>
                        <td className="px-3 py-2 font-bold" style={{ color: c.status === 'healthy' ? '#3fb950' : c.status === 'degraded' ? '#ff7c21' : '#f85149' }}>
                          {c.status === 'healthy' ? 'Running' : c.status === 'degraded' ? 'Running (degraded)' : 'CrashLoopBackOff'}
                        </td>
                        <td className="px-3 py-2 text-[#9fa8be]">0</td>
                        <td className="px-3 py-2 w-28"><Bar pct={cpu} /></td>
                        <td className="px-3 py-2 w-28"><Bar pct={mem} crit={90} warn={75} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CollapsibleRow>

        {/* Row 2: System Resource Overview */}
        <CollapsibleRow title="System Resource Overview" defaultOpen={true}>
          <div className="p-3 space-y-3">
            {/* Service CPU + memory sparklines */}
            <div className="grid grid-cols-2 gap-3">
              {services.map(svc => {
                const cpu = cpuPct(svc.status)
                const mem = memPct(svc.status)
                const cpuHist = sampleHistory(cpu)
                const memHist = sampleHistory(mem)
                const cpuColor = cpu >= 85 ? '#f85149' : cpu >= 60 ? '#ff7c21' : '#3fb950'
                const memColor = mem >= 85 ? '#f85149' : mem >= 60 ? '#ff7c21' : '#3fb950'
                return (
                  <div key={svc.name} className="bg-[#1a1d2b] border border-[#2c3235] rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#e6edf3] font-bold text-[11px]">{svc.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        svc.status === 'down' ? 'bg-[#2a0a0a] text-[#f85149]'
                        : svc.status === 'degraded' ? 'bg-[#2a1800] text-[#ff7c21]'
                        : 'bg-[#0f2a1a] text-[#3fb950]'
                      }`}>{svc.status.toUpperCase()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-[#6b7280]">CPU</span>
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: cpuColor }}>{cpu}%</span>
                        </div>
                        <Sparkline values={cpuHist} color={cpuColor} />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-[#6b7280]">MEM</span>
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: memColor }}>{mem}%</span>
                        </div>
                        <Sparkline values={memHist} color={memColor} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Database panels */}
            {databases.length > 0 && (
              <div>
                <div className="text-[9px] text-[#6b7280] uppercase tracking-widest mb-2">Databases</div>
                <div className="grid grid-cols-2 gap-2">
                  {databases.map(db => {
                    const connPct = Math.round((db.connection_count / db.max_connections) * 100)
                    const qColor = db.query_latency_ms > 2000 ? '#f85149' : db.query_latency_ms > 500 ? '#ff7c21' : '#3fb950'
                    return (
                      <div key={db.name} className="bg-[#1a1d2b] border border-[#2c3235] rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[#e6edf3] font-bold text-[11px]">{db.name}</span>
                          <span className={`text-[10px] font-bold`} style={{ color: db.status === 'healthy' ? '#3fb950' : db.status === 'degraded' ? '#ff7c21' : '#f85149' }}>
                            {db.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div>
                            <div className="text-[9px] text-[#6b7280] mb-0.5">Connections ({db.connection_count}/{db.max_connections})</div>
                            <Bar pct={connPct} warn={70} crit={90} />
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-[#6b7280]">Query p99</span>
                            <span className="font-bold tabular-nums" style={{ color: qColor }}>
                              {db.query_latency_ms === 999999 ? '∞' : `${db.query_latency_ms}ms`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Cache panels */}
            {caches.length > 0 && (
              <div>
                <div className="text-[9px] text-[#6b7280] uppercase tracking-widest mb-2">Cache Layer</div>
                <div className="grid grid-cols-2 gap-2">
                  {caches.map(cache => {
                    const memPct2 = Math.round((cache.memory_used_mb / cache.memory_total_mb) * 100)
                    const hitColor = cache.hit_rate < 0.3 ? '#f85149' : cache.hit_rate < 0.7 ? '#ff7c21' : '#3fb950'
                    const hitHist = sampleHistory(Math.round(cache.hit_rate * 100))
                    return (
                      <div key={cache.name} className="bg-[#1a1d2b] border border-[#2c3235] rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[#e6edf3] font-bold text-[11px]">{cache.name}</span>
                          <span style={{ color: cache.status === 'healthy' ? '#3fb950' : cache.status === 'degraded' ? '#ff7c21' : '#f85149' }} className="text-[10px] font-bold">
                            {cache.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] text-[#6b7280]">Hit Rate</span>
                              <span className="text-[10px] font-bold" style={{ color: hitColor }}>{Math.round(cache.hit_rate * 100)}%</span>
                            </div>
                            <Sparkline values={hitHist} color={hitColor} />
                          </div>
                          <div>
                            <div className="text-[9px] text-[#6b7280] mb-0.5">Memory</div>
                            <Bar pct={memPct2} warn={75} crit={90} />
                            <div className="text-[9px] text-[#6b7280] mt-0.5">{cache.memory_used_mb}/{cache.memory_total_mb} MB</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </CollapsibleRow>

        {/* Row 3: Business Performance */}
        <CollapsibleRow title="Business Performance" defaultOpen={true}>
          <div className="p-3 space-y-3">
            {(() => {
              const isDown = systemState ? Object.values(systemState.services).some(s => s.status === 'down') : false
              const isDegraded = systemState ? Object.values(systemState.services).some(s => s.status === 'degraded') : false
              const successRate = isDown ? 61.2 : isDegraded ? 84.7 : 99.4
              const rpm = isDown ? 183 : isDegraded ? 412 : 1247
              const pendingTx = isDown ? 3842 : isDegraded ? 1203 : 47
              const avgRespMs = isDown ? 4821 : isDegraded ? 1834 : 142
              const ordersToday = isDown ? 2341 : isDegraded ? 5102 : 12847
              const productsPurchased = isDown ? 3109 : isDegraded ? 6843 : 18293

              const successColor = successRate > 95 ? '#3fb950' : successRate > 80 ? '#ff7c21' : '#f85149'
              const rpmColor = '#8ab4f8'
              const pendingColor = pendingTx > 1000 ? '#f85149' : pendingTx > 200 ? '#ff7c21' : '#3fb950'
              const respColor = avgRespMs > 2000 ? '#f85149' : avgRespMs > 500 ? '#ff7c21' : '#3fb950'

              const successHist = Array.from({ length: 20 }, (_, i) =>
                Math.max(0, Math.min(100, successRate + Math.sin(i * 0.7) * (isDown ? 15 : isDegraded ? 6 : 1.5) + (Math.random() * 3 - 1.5)))
              )
              const rpmHist = Array.from({ length: 20 }, (_, i) =>
                Math.max(0, rpm + Math.sin(i * 0.5) * rpm * 0.15 + (Math.random() * rpm * 0.08))
              )
              const pendingHist = Array.from({ length: 20 }, (_, i) =>
                Math.max(0, pendingTx + Math.sin(i * 0.9) * pendingTx * 0.3 + (Math.random() * pendingTx * 0.1))
              )

              return (
                <>
                  {/* Stat tiles row */}
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      { label: 'Success Rate', value: `${successRate.toFixed(1)}%`, color: successColor, sub: isDown ? 'CRITICAL' : isDegraded ? 'DEGRADED' : 'HEALTHY' },
                      { label: 'Requests/min', value: rpm.toLocaleString(), color: rpmColor, sub: `${txWindow_placeholder(rpm)} vs avg` },
                      { label: 'Pending Txns', value: pendingTx.toLocaleString(), color: pendingColor, sub: pendingTx > 1000 ? 'QUEUE BACKUP' : 'NOMINAL' },
                      { label: 'Avg Response', value: `${avgRespMs}ms`, color: respColor, sub: avgRespMs > 2000 ? 'SLO BREACH' : avgRespMs > 500 ? 'WARNING' : 'GOOD' },
                      { label: 'Orders Today', value: ordersToday.toLocaleString(), color: '#e6edf3', sub: 'since midnight' },
                      { label: 'Products Sold', value: productsPurchased.toLocaleString(), color: '#e6edf3', sub: 'since midnight' },
                    ].map(tile => (
                      <div key={tile.label} className="bg-[#111217] border border-[#2c3235] rounded p-2.5">
                        <div className="text-[#555] text-[9px] uppercase tracking-widest mb-1">{tile.label}</div>
                        <div className="text-base font-bold tabular-nums leading-none mb-1" style={{ color: tile.color }}>{tile.value}</div>
                        <div className="text-[9px]" style={{ color: tile.color }}>{tile.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Sparkline charts */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#111217] border border-[#2c3235] rounded p-3">
                      <div className="text-[#555] text-[10px] mb-1.5">Success Rate (%) — Last 20min</div>
                      <Sparkline values={successHist} color={successColor} />
                      <div className="flex justify-between text-[9px] mt-1">
                        <span className="text-[#555]">Min: <span style={{ color: successColor }}>{Math.min(...successHist).toFixed(1)}%</span></span>
                        <span className="text-[#555]">Now: <span style={{ color: successColor }}>{successRate.toFixed(1)}%</span></span>
                      </div>
                    </div>
                    <div className="bg-[#111217] border border-[#2c3235] rounded p-3">
                      <div className="text-[#555] text-[10px] mb-1.5">Requests Per Minute</div>
                      <Sparkline values={rpmHist} color={rpmColor} />
                      <div className="flex justify-between text-[9px] mt-1">
                        <span className="text-[#555]">Min: <span style={{ color: rpmColor }}>{Math.round(Math.min(...rpmHist))}</span></span>
                        <span className="text-[#555]">Now: <span style={{ color: rpmColor }}>{rpm}</span></span>
                      </div>
                    </div>
                    <div className="bg-[#111217] border border-[#2c3235] rounded p-3">
                      <div className="text-[#555] text-[10px] mb-1.5">Pending Transactions</div>
                      <Sparkline values={pendingHist} color={pendingColor} />
                      <div className="flex justify-between text-[9px] mt-1">
                        <span className="text-[#555]">Peak: <span style={{ color: pendingColor }}>{Math.round(Math.max(...pendingHist))}</span></span>
                        <span className="text-[#555]">Now: <span style={{ color: pendingColor }}>{pendingTx}</span></span>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </CollapsibleRow>

        {/* MySQL Database row */}
        <MySQLRow systemState={systemState} />
      </div>
    </div>
  )
}

function txWindow_placeholder(rpm: number) {
  const diff = rpm > 1000 ? '+3%' : rpm > 400 ? '-67%' : '-85%'
  return diff
}

// ─── MySQL Database Monitoring Row ──────────────────────────────────────────

const TIME_RANGES = ['1m', '2m', '5m', '15m', '1h', '3h', '6h', '24h'] as const
type MysqlTimeRange = typeof TIME_RANGES[number]

function slowQueriesForRange(range: MysqlTimeRange, isDegraded: boolean): number {
  const base = isDegraded ? 14 : 1
  const multiplier: Record<MysqlTimeRange, number> = { '1m': 1, '2m': 2, '5m': 5, '15m': 9, '1h': 22, '3h': 47, '6h': 81, '24h': 180 }
  return isDegraded ? Math.round(base * (multiplier[range] * 0.6 + Math.random() * 3)) : Math.floor(Math.random() * 2)
}

function slowQuerySeries(range: MysqlTimeRange, isDegraded: boolean, count = 20) {
  // Spike starts ~40% in (incident onset) if degraded
  return Array.from({ length: count }, (_, i) => {
    const frac = i / (count - 1)
    if (!isDegraded) return Math.random() * 0.5
    if (frac < 0.35) return Math.random() * 1.5
    if (frac < 0.55) return 12 + Math.random() * 8   // spike
    return 10 + Math.random() * 6                     // sustained high
  })
}

function fmtTime(d: Date, range: MysqlTimeRange): string {
  if (range === '1m' || range === '2m' || range === '5m' || range === '15m') {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function MySQLRow({ systemState }: { systemState: SystemState | null }) {
  const [range, setRange] = useState<MysqlTimeRange>('5m')
  const [open, setOpen] = useState(false)

  const dbs = systemState?.infrastructure.databases ?? []
  const isDegraded = dbs.some(d => d.status === 'degraded' || d.status === 'down')
  const isDown = dbs.every(d => d.status === 'down') && dbs.length > 0

  const now = new Date()
  const dbStatus = isDown ? 'down' : isDegraded ? 'degraded' : 'healthy'

  const cpu = isDown ? 1 : isDegraded ? 88 : 22
  const mem = isDown ? 3 : isDegraded ? 91 : 45
  const disk = isDegraded ? 74 : 52
  const activeConns = isDown ? 0 : isDegraded ? 498 : 42
  const slowCount = slowQueriesForRange(range, isDegraded)
  const series = slowQuerySeries(range, isDegraded)

  // Generate slow query rows
  const activeSlowQueries = isDegraded ? [
    { duration: '00:04:23', query: 'SELECT o.*, p.name, p.sku FROM orders o JOIN products p ON o.product_id = p.id WHERE o.status = \'pending\' AND o.created_at > NOW() - INTERVAL \'1 hour\'', db: 'moniepoint_prod', user: 'app_user', rows: 48203 },
    { duration: '00:03:47', query: 'UPDATE wallets SET balance = balance - ? WHERE user_id IN (SELECT user_id FROM pending_transactions WHERE created_at < NOW() - INTERVAL \'30 min\')', db: 'moniepoint_prod', user: 'txn_worker', rows: 12041 },
    { duration: '00:03:12', query: 'SELECT COUNT(*) FROM audit_logs WHERE action = \'payment_attempt\' AND timestamp BETWEEN ? AND ? GROUP BY user_id HAVING count > 5', db: 'moniepoint_prod', user: 'analytics', rows: 892440 },
    { duration: '00:02:58', query: 'SELECT * FROM sessions s JOIN session_events se ON s.id = se.session_id WHERE s.started_at > NOW() - INTERVAL \'1 day\'', db: 'moniepoint_prod', user: 'app_user', rows: 312000 },
  ] : []

  const slowQueryHistory = isDegraded ? [
    { started: new Date(now.getTime() - 8 * 60000), duration: '00:08:14', query: 'ANALYZE TABLE orders', db: 'moniepoint_prod', user: 'root' },
    { started: new Date(now.getTime() - 22 * 60000), duration: '00:01:52', query: 'SELECT * FROM transactions WHERE amount > 10000 ORDER BY created_at DESC', db: 'moniepoint_prod', user: 'report_svc' },
    { started: new Date(now.getTime() - 41 * 60000), duration: '00:00:47', query: 'UPDATE product_inventory SET stock_count = stock_count - 1 WHERE id IN (...)', db: 'moniepoint_prod', user: 'inventory_worker' },
  ] : [
    { started: new Date(now.getTime() - 180 * 60000), duration: '00:00:12', query: 'OPTIMIZE TABLE session_logs', db: 'moniepoint_prod', user: 'root' },
  ]

  const rangeMs: Record<MysqlTimeRange, number> = { '1m': 60000, '2m': 120000, '5m': 300000, '15m': 900000, '1h': 3600000, '3h': 10800000, '6h': 21600000, '24h': 86400000 }

  const chartLabels = [0, 0.25, 0.5, 0.75, 1].map(frac => {
    const t = new Date(now.getTime() - rangeMs[range] * (1 - frac))
    return fmtTime(t, range)
  })

  const maxSeries = Math.max(...series, 1)
  const w = 500, h = 60
  const sparkPts = series.map((v, i) =>
    `${(i / (series.length - 1)) * w},${h - (v / maxSeries) * (h - 4)}`
  ).join(' ')
  const fillPts = `0,${h} ${sparkPts} ${w},${h}`
  const sparkColor = isDegraded ? '#f85149' : '#3fb950'

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-[#1e2030] hover:bg-[#252838] border border-[#2c3235] text-[11px] text-[#9fa8be] font-medium transition-colors"
      >
        <span className="text-[#ff7c21]">{open ? '▼' : '▶'}</span>
        <span className="uppercase tracking-widest text-[10px]">MySQL Database</span>
        {isDegraded && <span className="text-[10px] text-[#f85149] font-bold animate-pulse ml-1">● DEGRADED</span>}
        <div className="flex-1 h-px bg-[#2c3235] ml-2" />
        <span className="text-[9px] text-[#484f58]">moniepoint-mysql-prod</span>
      </button>

      {open && (
        <div className="border-x border-b border-[#2c3235] p-3 space-y-4 bg-[#111217]">
          {/* Time range selector */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[#484f58] text-[10px] mr-2">Time range:</span>
            {TIME_RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                  range === r
                    ? 'bg-[#ff7c21]/20 border-[#ff7c21] text-[#ff7c21]'
                    : 'border-[#2c3235] text-[#484f58] hover:text-[#9fa8be]'
                }`}
              >
                {r}
              </button>
            ))}
            <span className="ml-auto text-[#484f58] text-[10px]">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          {/* Server stat tiles */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'CPU Utilization', value: `${cpu}%`, color: cpu >= 85 ? '#f85149' : cpu >= 60 ? '#ff7c21' : '#3fb950' },
              { label: 'Memory Usage', value: `${mem}%`, color: mem >= 85 ? '#f85149' : mem >= 70 ? '#ff7c21' : '#3fb950' },
              { label: 'Disk Usage', value: `${disk}%`, color: disk >= 85 ? '#f85149' : disk >= 70 ? '#ff7c21' : '#3fb950' },
              { label: 'Active Connections', value: String(activeConns), color: activeConns >= 450 ? '#f85149' : activeConns >= 300 ? '#ff7c21' : '#3fb950' },
            ].map(t => (
              <div key={t.label} className="bg-[#1a1d2b] border border-[#2c3235] rounded p-2.5">
                <div className="text-[9px] text-[#6b7280] uppercase tracking-widest mb-1">{t.label}</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: t.color }}>{t.value}</div>
                <div className="text-[9px] mt-0.5" style={{ color: t.color }}>{dbStatus.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {/* Slow query sparkline with time axis */}
          <div className="bg-[#1a1d2b] border border-[#2c3235] rounded p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-[#6b7280] text-[10px] uppercase tracking-widest">Slow Queries / sec</div>
              <div className={`text-sm font-bold tabular-nums ${isDegraded ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>{slowCount} total in {range}</div>
            </div>
            <svg width="100%" viewBox={`0 0 ${w} ${h + 20}`} preserveAspectRatio="none" className="overflow-visible">
              <defs>
                <linearGradient id="mysql-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={fillPts} fill="url(#mysql-grad)" />
              <polyline points={sparkPts} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinejoin="round" />
              {/* Time axis labels */}
              {chartLabels.map((label, i) => (
                <text
                  key={i}
                  x={(i / (chartLabels.length - 1)) * w}
                  y={h + 16}
                  textAnchor={i === 0 ? 'start' : i === chartLabels.length - 1 ? 'end' : 'middle'}
                  fontSize="8"
                  fill="#484f58"
                >
                  {label}
                </text>
              ))}
            </svg>
          </div>

          {/* Running slow queries table */}
          <div>
            <div className="text-[#6b7280] text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
              Running Slow Queries
              {activeSlowQueries.length > 0 && (
                <span className="text-[#f85149] font-bold animate-pulse">{activeSlowQueries.length} active</span>
              )}
            </div>
            {activeSlowQueries.length === 0 ? (
              <div className="bg-[#1a1d2b] border border-[#2c3235] rounded p-3 text-[#484f58] text-[10px] text-center">
                ✓ No slow queries currently running
              </div>
            ) : (
              <div className="bg-[#1a1d2b] border border-[#2c3235] rounded overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-[#2c3235] text-[#484f58]">
                      <th className="text-left px-3 py-1.5">Duration</th>
                      <th className="text-left px-3 py-1.5">Query</th>
                      <th className="text-left px-3 py-1.5">DB</th>
                      <th className="text-left px-3 py-1.5">User</th>
                      <th className="text-right px-3 py-1.5">Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSlowQueries.map((q, i) => (
                      <tr key={i} className="border-b border-[#2c3235] last:border-0 hover:bg-[#252838]">
                        <td className="px-3 py-1.5 text-[#f85149] font-bold tabular-nums whitespace-nowrap">{q.duration}</td>
                        <td className="px-3 py-1.5 text-[#9fa8be] max-w-xs truncate font-mono" title={q.query}>{q.query}</td>
                        <td className="px-3 py-1.5 text-[#58a6ff]">{q.db}</td>
                        <td className="px-3 py-1.5 text-[#d29922]">{q.user}</td>
                        <td className="px-3 py-1.5 text-[#484f58] text-right tabular-nums">{q.rows.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Slow query history */}
          <div>
            <div className="text-[#6b7280] text-[10px] uppercase tracking-widest mb-2">Slow Query History</div>
            <div className="bg-[#1a1d2b] border border-[#2c3235] rounded overflow-hidden">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-[#2c3235] text-[#484f58]">
                    <th className="text-left px-3 py-1.5">Started At</th>
                    <th className="text-left px-3 py-1.5">Duration</th>
                    <th className="text-left px-3 py-1.5">Query</th>
                    <th className="text-left px-3 py-1.5">User</th>
                  </tr>
                </thead>
                <tbody>
                  {slowQueryHistory.map((q, i) => (
                    <tr key={i} className="border-b border-[#2c3235] last:border-0 hover:bg-[#252838]">
                      <td className="px-3 py-1.5 text-[#484f58] tabular-nums whitespace-nowrap">{fmtTime(q.started, range)}</td>
                      <td className="px-3 py-1.5 text-[#d29922] tabular-nums whitespace-nowrap">{q.duration}</td>
                      <td className="px-3 py-1.5 text-[#9fa8be] max-w-xs truncate font-mono" title={q.query}>{q.query}</td>
                      <td className="px-3 py-1.5 text-[#484f58]">{q.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
