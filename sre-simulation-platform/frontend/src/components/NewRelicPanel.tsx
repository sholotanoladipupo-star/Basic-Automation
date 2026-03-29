import { useState, useMemo } from 'react'
import { SystemState } from '../types'

interface Props { systemState: SystemState | null }

const NR_NAV = [
  { id: 'apm', label: 'APM & Services' },
  { id: 'infra', label: 'Infrastructure' },
]

// Tiny SVG sparkline
function Spark({ values, color, h = 28 }: { values: number[]; color: string; h?: number }) {
  const max = Math.max(...values, 1)
  const w = 100
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 2)}`).join(' ')
  return (
    <svg width={w} height={h} className="w-full">
      <defs>
        <linearGradient id={`g-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${pts} ${w},${h}`}
        fill={`url(#g-${color.replace('#', '')})`}
      />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function hist(base: number, count = 20, noise = 15) {
  return Array.from({ length: count }, (_, i) =>
    Math.max(0, base + Math.sin(i * 0.6) * noise + (Math.random() * noise * 0.5))
  )
}

// Generate spike+recovery trend: flat → spike at incidentAt → recovery at recoverAt
function spikeHist(base: number, spike: number, count: number, incidentAt: number, recoverAt: number, noise = 0) {
  return Array.from({ length: count }, (_, i) => {
    const frac = i / (count - 1)
    let val: number
    if (frac < incidentAt) val = base
    else if (frac < recoverAt) val = base + (spike - base) * ((frac - incidentAt) / (recoverAt - incidentAt)) * 2
    else val = base + (spike - base) * Math.max(0, 1 - (frac - recoverAt) / (1 - recoverAt))
    return Math.max(0, val + (Math.random() - 0.5) * noise)
  })
}

// Drill-down chart panel for a single KPI
function KpiDrillDown({ label, unit, color, values, timeLabels, onClose }: {
  label: string; unit: string; color: string; values: number[]; timeLabels: string[]; onClose: () => void
}) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 600; const h = 120
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 4)}`
  ).join(' ')
  return (
    <div className="bg-[#12131a] border border-[#2d2f45] rounded p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#d4d4d4] font-bold text-[11px] uppercase tracking-widest">{label} — Trend</span>
        <button onClick={onClose} className="text-[#555] hover:text-[#d4d4d4] text-[11px] transition-colors">✕ Close</button>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 100 }}>
        <defs>
          <linearGradient id={`kpi-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#kpi-${label})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[9px] text-[#555] mt-1">
        {timeLabels.filter((_, i) => i % Math.ceil(timeLabels.length / 6) === 0).map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-[10px]">
        <span className="text-[#555]">Min: <span style={{ color }}>{min.toFixed(2)}{unit}</span></span>
        <span className="text-[#555]">Max: <span style={{ color }}>{max.toFixed(2)}{unit}</span></span>
        <span className="text-[#555]">Avg: <span style={{ color }}>{(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)}{unit}</span></span>
      </div>
    </div>
  )
}

interface ServiceDetailProps {
  service: NonNullable<SystemState>['services'][string]
  onBack: () => void
}

function ServiceDetail({ service, onBack }: ServiceDetailProps) {
  const [tab, setTab] = useState<'summary' | 'transactions' | 'errors' | 'infrastructure'>('summary')
  const [drillDown, setDrillDown] = useState<string | null>(null)
  const [txWindow, setTxWindow] = useState<'1h' | '6h' | '24h'>('1h')

  const errPct = (service.error_rate * 100)
  const errColor = errPct > 10 ? '#f85149' : errPct > 2 ? '#d29922' : '#00b4a0'
  const latColor = service.p99_latency_ms > 2000 ? '#f85149' : service.p99_latency_ms > 500 ? '#d29922' : '#00b4a0'

  const pointCount = txWindow === '1h' ? 24 : txWindow === '6h' ? 36 : 48
  // Spike starts at 30% of time window, recovers at 70% — incident pattern
  const errTrendValues = useMemo(() =>
    spikeHist(0.5, errPct, pointCount, 0.3, 0.7, 0.2),
    [errPct, pointCount]
  )
  const apdexTrendValues = useMemo(() => {
    const baseApdex = service.status === 'down' ? 0.05 : service.status === 'degraded' ? 0.54 : 0.97
    return spikeHist(0.97, baseApdex, pointCount, 0.3, 0.7, 0.02).map(v => Math.min(1, Math.max(0, v)))
  }, [service.status, pointCount])

  const txTimeLabels = useMemo(() => {
    const now = new Date()
    const hours = txWindow === '1h' ? 1 : txWindow === '6h' ? 6 : 24
    return Array.from({ length: pointCount }, (_, i) => {
      const t = new Date(now.getTime() - (hours * 3600000) * (1 - i / (pointCount - 1)))
      return t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    })
  }, [txWindow, pointCount])

  const errHist = useMemo(() => hist(errPct, 20, errPct * 0.4), [errPct])
  const latHist = useMemo(() => hist(service.p99_latency_ms, 20, service.p99_latency_ms * 0.2), [service.p99_latency_ms])
  const throughputHist = useMemo(() => hist(service.status === 'down' ? 0 : service.status === 'degraded' ? 120 : 850, 20, 80), [service.status])

  const p95 = Math.round(service.p99_latency_ms * 0.82)
  const apdexVal = service.status === 'down' ? 0 : service.status === 'degraded' ? 0.54 : 0.96
  const apdex = apdexVal.toFixed(2)
  const throughput = service.status === 'down' ? 0 : service.status === 'degraded' ? 134 : 847

  return (
    <div className="flex flex-col h-full">
      {/* Back + header */}
      <div className="bg-[#1a1d2e] border-b border-[#2d2f45] px-4 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="text-[#00b4a0] hover:text-[#00d4bf] text-[11px] transition-colors">← All Services</button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: service.status === 'healthy' ? '#00b4a0' : service.status === 'degraded' ? '#d29922' : '#f85149' }} />
          <span className="text-[#d4d4d4] font-bold">{service.name}</span>
        </div>
        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded ${
          service.status === 'down' ? 'bg-[#2a0a0a] text-[#f85149]'
          : service.status === 'degraded' ? 'bg-[#2a1e00] text-[#d29922]'
          : 'bg-[#0a2a20] text-[#00b4a0]'
        }`}>{service.status.toUpperCase()}</span>
      </div>

      {/* Sub-tabs */}
      <div className="bg-[#1a1d2e] border-b border-[#2d2f45] flex">
        {(['summary', 'transactions', 'errors', 'infrastructure'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[11px] capitalize border-b-2 transition-colors ${
              tab === t ? 'text-[#00b4a0] border-[#00b4a0]' : 'text-[#555] border-transparent hover:text-[#d4d4d4]'
            }`}
          >{t}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'summary' && (
          <div className="space-y-4">
            {/* KPI tiles */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Apdex Score', value: apdex, color: parseFloat(apdex) > 0.85 ? '#00b4a0' : parseFloat(apdex) > 0.7 ? '#d29922' : '#f85149', clickable: true },
                { label: 'Error Rate', value: `${errPct.toFixed(2)}%`, color: errColor, clickable: true },
                { label: 'Throughput', value: `${throughput} rpm`, color: '#d4d4d4', clickable: false },
                { label: 'p99 Latency', value: `${service.p99_latency_ms}ms`, color: latColor, clickable: false },
              ].map(k => (
                <div key={k.label}
                  onClick={() => k.clickable && setDrillDown(drillDown === k.label ? null : k.label)}
                  className={`bg-[#12131a] border rounded p-2.5 transition-colors ${
                    k.clickable ? 'cursor-pointer hover:border-[#00b4a0]/50 border-[#2d2f45]' : 'border-[#2d2f45]'
                  } ${drillDown === k.label ? 'border-[#00b4a0]' : ''}`}>
                  <div className="text-[#666] text-[9px] uppercase tracking-widest mb-1 flex items-center gap-1">
                    {k.label} {k.clickable && <span className="text-[#555]">↓</span>}
                  </div>
                  <div className="text-sm font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
            {/* Drill-down panel */}
            {drillDown === 'Apdex Score' && (
              <KpiDrillDown label="Apdex Score" unit="" color={parseFloat(apdex) > 0.85 ? '#00b4a0' : '#f85149'}
                values={apdexTrendValues} timeLabels={txTimeLabels} onClose={() => setDrillDown(null)} />
            )}
            {drillDown === 'Error Rate' && (
              <KpiDrillDown label="Error Rate" unit="%" color={errColor}
                values={errTrendValues} timeLabels={txTimeLabels} onClose={() => setDrillDown(null)} />
            )}

            {/* Charts */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#12131a] border border-[#2d2f45] rounded p-3">
                <div className="text-[#666] text-[10px] mb-2">Response Time (ms)</div>
                <Spark values={latHist} color={latColor} />
                <div className="mt-1 flex justify-between text-[10px] text-[#555]">
                  <span>p95: <span className="text-[#d4d4d4]">{p95}ms</span></span>
                  <span>p99: <span style={{ color: latColor }}>{service.p99_latency_ms}ms</span></span>
                </div>
              </div>
              <div className="bg-[#12131a] border border-[#2d2f45] rounded p-3">
                <div className="text-[#666] text-[10px] mb-2">Error Rate (%)</div>
                <Spark values={errHist} color={errColor} />
                <div className="mt-1 text-[10px] text-[#555]">
                  Current: <span style={{ color: errColor }}>{errPct.toFixed(2)}%</span>
                </div>
              </div>
              <div className="bg-[#12131a] border border-[#2d2f45] rounded p-3">
                <div className="text-[#666] text-[10px] mb-2">Throughput (rpm)</div>
                <Spark values={throughputHist} color="#8ab4f8" />
                <div className="mt-1 text-[10px] text-[#555]">
                  Current: <span className="text-[#8ab4f8]">{throughput} rpm</span>
                </div>
              </div>
            </div>

            {/* Open incidents */}
            {service.status !== 'healthy' && (
              <div className="bg-[#1a1d2e] border border-[#f85149]/40 rounded p-3">
                <div className="text-[#f85149] font-bold text-[11px] mb-1">● Open Incident</div>
                <div className="text-[#d4d4d4] text-[11px]">
                  {service.status === 'down'
                    ? `${service.name} is down — all pods returning 5xx errors`
                    : `${service.name} is degraded — elevated error rate and latency`}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'transactions' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[#666] text-[10px] uppercase tracking-widest">Top Transactions</div>
              <div className="flex items-center gap-1">
                <span className="text-[#555] text-[10px] mr-1">Window:</span>
                {(['1h', '6h', '24h'] as const).map(w => (
                  <button key={w} onClick={() => setTxWindow(w)}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      txWindow === w ? 'bg-[#00b4a0] text-[#12131a] font-bold' : 'bg-[#1a1d2e] border border-[#2d2f45] text-[#666] hover:text-[#d4d4d4]'
                    }`}>{w}
                  </button>
                ))}
              </div>
            </div>
            {[
              { name: `POST /api/v1/${service.name.replace('-service', '')}/create`, calls: 1243, avgMs: Math.round(service.p99_latency_ms * 0.6), errPct: errPct * 0.8 },
              { name: `GET /api/v1/${service.name.replace('-service', '')}/list`, calls: 3891, avgMs: Math.round(service.p99_latency_ms * 0.35), errPct: errPct * 0.4 },
              { name: `PUT /api/v1/${service.name.replace('-service', '')}/update`, calls: 547, avgMs: Math.round(service.p99_latency_ms * 0.8), errPct: errPct * 1.2 },
              { name: `DELETE /api/v1/${service.name.replace('-service', '')}/remove`, calls: 89, avgMs: Math.round(service.p99_latency_ms * 0.5), errPct: errPct * 0.3 },
              { name: `GET /api/v1/${service.name.replace('-service', '')}/health`, calls: 12490, avgMs: 2, errPct: 0 },
            ].map((tx, i) => {
              const sparkData = spikeHist(tx.avgMs * 0.8, tx.avgMs, pointCount, 0.3, 0.7, tx.avgMs * 0.1)
              const latC = tx.avgMs > 2000 ? '#f85149' : tx.avgMs > 500 ? '#d29922' : '#00b4a0'
              return (
                <div key={i} className="bg-[#12131a] border border-[#2d2f45] hover:border-[#00b4a0]/30 rounded p-2.5 text-[11px] cursor-pointer transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[#8ab4f8] truncate flex-1 font-mono text-[10px]">{tx.name}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px] items-center">
                    <div><span className="text-[#555]">Calls: </span><span className="text-[#d4d4d4]">{tx.calls.toLocaleString()}</span></div>
                    <div><span className="text-[#555]">Avg: </span><span style={{ color: latC }}>{tx.avgMs}ms</span></div>
                    <div><span className="text-[#555]">Errors: </span><span style={{ color: tx.errPct > 5 ? '#f85149' : '#d4d4d4' }}>{Math.max(0, tx.errPct).toFixed(1)}%</span></div>
                    <div className="w-20"><Spark values={sparkData} color={latC} h={20} /></div>
                  </div>
                </div>
              )
            })}
            <div className="text-[#555] text-[10px] mt-2 text-center">
              Showing {txWindow} window · Spike visible around incident start
            </div>
          </div>
        )}

        {tab === 'errors' && (
          <div className="space-y-2">
            <div className="text-[#666] text-[10px] uppercase tracking-widest mb-3">Error Inbox</div>
            {service.status === 'healthy' && errPct < 2 ? (
              <div className="text-center text-[#555] py-10 text-[11px]">No active errors</div>
            ) : (
              [
                { count: Math.floor(errPct * 120), msg: `upstream connect error or disconnect/reset before headers`, fingerprint: 'ERR-001' },
                { count: Math.floor(errPct * 45), msg: `context deadline exceeded (5000ms)`, fingerprint: 'ERR-002' },
                { count: Math.floor(errPct * 22), msg: `failed to acquire Redis lock after 3 retries`, fingerprint: 'ERR-003' },
              ].filter(e => e.count > 0).map((err, i) => (
                <div key={i} className="bg-[#12131a] border border-[#f85149]/40 rounded p-3 text-[11px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#f85149] font-bold text-[10px]">{err.fingerprint}</span>
                    <span className="text-[#555] text-[10px]">{err.count} occurrences</span>
                  </div>
                  <div className="text-[#d4d4d4]">{err.msg}</div>
                  <div className="text-[#555] text-[10px] mt-1">{service.name} · last seen just now</div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'infrastructure' && (
          <div className="space-y-3 text-[11px]">
            <div className="text-[#666] text-[10px] uppercase tracking-widest mb-3">Container Metrics</div>
            {Array.from({ length: service.status === 'down' ? 0 : service.status === 'degraded' ? 1 : 3 }, (_, i) => {
              const cpu = (service.status === 'degraded' ? 78 : 22) + i * 5
              const mem = (service.status === 'degraded' ? 81 : 35) + i * 8
              return (
                <div key={i} className="bg-[#12131a] border border-[#2d2f45] rounded p-3">
                  <div className="text-[#8ab4f8] mb-2">Container {i + 1} — {service.name}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[['CPU', cpu], ['Memory', mem]].map(([label, val]) => {
                      const v = Number(val)
                      const c = v > 85 ? '#f85149' : v > 60 ? '#d29922' : '#00b4a0'
                      return (
                        <div key={String(label)}>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-[#555]">{label} Usage</span>
                            <span style={{ color: c }} className="font-bold">{v}%</span>
                          </div>
                          <div className="w-full bg-[#1a1d2e] rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${v}%`, backgroundColor: c }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {service.status === 'down' && (
              <div className="text-center text-[#555] py-8">No running containers</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function NewRelicPanel({ systemState }: Props) {
  const [activeTab, setActiveTab] = useState('apm')
  const [selectedService, setSelectedService] = useState<string | null>(null)

  const services = systemState ? Object.values(systemState.services) : []
  const databases = systemState?.infrastructure.databases ?? []
  const caches = systemState?.infrastructure.caches ?? []

  const svc = selectedService ? systemState?.services[selectedService] : null

  if (svc) {
    return (
      <div className="flex flex-col h-full bg-[#12131a] font-mono text-xs text-[#d4d4d4] overflow-hidden">
        <div className="bg-[#1a1d2e] border-b border-[#2d2f45] px-4 py-2 flex items-center gap-3 flex-shrink-0">
          <div className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[11px]" style={{ background: 'linear-gradient(135deg, #00b4a0 0%, #0078bf 100%)' }}>NR</div>
          <span className="text-[#d4d4d4] font-medium">New Relic One</span>
          <span className="text-[#555] text-[10px]">· moniepoint-production</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ServiceDetail service={svc} onBack={() => setSelectedService(null)} />
        </div>
      </div>
    )
  }

  const degradedCount = services.filter(s => s.status !== 'healthy').length

  return (
    <div className="flex flex-col h-full bg-[#12131a] font-mono text-xs text-[#d4d4d4] overflow-hidden">
      {/* NR top bar */}
      <div className="bg-[#1a1d2e] border-b border-[#2d2f45] px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[11px]" style={{ background: 'linear-gradient(135deg, #00b4a0 0%, #0078bf 100%)' }}>NR</div>
          <span className="text-[#d4d4d4] font-medium">New Relic One</span>
          <span className="text-[#555] text-[10px]">· moniepoint-production</span>
        </div>
        <span className={`font-bold text-[10px] ${degradedCount > 0 ? 'text-[#f85149]' : 'text-[#00b4a0]'}`}>
          {degradedCount > 0 ? `⚠ ${degradedCount} service${degradedCount > 1 ? 's' : ''} degraded` : '✓ All services healthy'}
        </span>
      </div>

      {/* Tab bar */}
      <div className="bg-[#1a1d2e] border-b border-[#2d2f45] flex flex-shrink-0">
        {NR_NAV.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-[11px] border-b-2 transition-colors ${
              activeTab === tab.id ? 'text-[#00b4a0] border-[#00b4a0]' : 'text-[#666] border-transparent hover:text-[#d4d4d4]'
            }`}
          >{tab.label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {activeTab === 'apm' && (
          <>
            <div className="text-[#888] text-[10px] uppercase tracking-widest mb-3">Services — click to drill down</div>
            {services.map(svc => {
              const errPct = (svc.error_rate * 100)
              const errColor = errPct > 10 ? '#f85149' : errPct > 2 ? '#d29922' : '#00b4a0'
              const latColor = svc.p99_latency_ms > 2000 ? '#f85149' : svc.p99_latency_ms > 500 ? '#d29922' : '#d4d4d4'
              return (
                <div
                  key={svc.name}
                  onClick={() => setSelectedService(svc.name)}
                  className="bg-[#1a1d2e] border border-[#2d2f45] hover:border-[#00b4a0]/50 rounded p-3 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#d4d4d4] font-bold">{svc.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        svc.status === 'down' ? 'bg-[#2a0a0a] text-[#f85149]'
                        : svc.status === 'degraded' ? 'bg-[#2a1e00] text-[#d29922]'
                        : 'bg-[#0a2a20] text-[#00b4a0]'
                      }`}>{svc.status.toUpperCase()}</span>
                      <span className="text-[#555] text-[10px]">→</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-[10px]">
                    <div>
                      <div className="text-[#555] mb-0.5">Error Rate</div>
                      <span className="font-bold tabular-nums" style={{ color: errColor }}>{errPct.toFixed(1)}%</span>
                    </div>
                    <div>
                      <div className="text-[#555] mb-0.5">p99 Latency</div>
                      <span className="font-bold tabular-nums" style={{ color: latColor }}>{svc.p99_latency_ms}ms</span>
                    </div>
                    <div>
                      <div className="text-[#555] mb-0.5">Throughput</div>
                      <span className="font-bold tabular-nums text-[#d4d4d4]">
                        {svc.status === 'down' ? '0' : svc.status === 'degraded' ? '134' : '847'} rpm
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {activeTab === 'infra' && (
          <>
            <div className="text-[#888] text-[10px] uppercase tracking-widest mb-3">Infrastructure — click to drill down</div>
            {[...caches, ...databases].map((item, i) => (
              <div
                key={i}
                onClick={() => {/* could extend drill-down to infra too */}}
                className="bg-[#1a1d2e] border border-[#2d2f45] rounded p-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[#d4d4d4] font-bold">{item.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    item.status === 'down' ? 'bg-[#2a0a0a] text-[#f85149]'
                    : item.status === 'degraded' ? 'bg-[#2a1e00] text-[#d29922]'
                    : 'bg-[#0a2a20] text-[#00b4a0]'
                  }`}>{item.status.toUpperCase()}</span>
                </div>
                {'hit_rate' in item && (
                  <div className="text-[10px] text-[#888]">Hit rate: <span className="text-[#d4d4d4]">{(item.hit_rate * 100).toFixed(0)}%</span></div>
                )}
                {'connection_count' in item && (
                  <div className="text-[10px] text-[#888]">Connections: <span className="text-[#d4d4d4]">{item.connection_count}/{item.max_connections}</span></div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
