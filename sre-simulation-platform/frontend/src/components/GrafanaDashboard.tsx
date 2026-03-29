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
      </div>
    </div>
  )
}

function txWindow_placeholder(rpm: number) {
  const diff = rpm > 1000 ? '+3%' : rpm > 400 ? '-67%' : '-85%'
  return diff
}
