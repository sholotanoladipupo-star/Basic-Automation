import { useState, useMemo } from 'react'
import { SystemState } from '../types'

interface Props { systemState: SystemState | null }

const NR_NAV = [
  { id: 'apm', label: 'APM & Services' },
  { id: 'servicemap', label: 'Service Map' },
  { id: 'traces', label: 'Distributed Traces' },
  { id: 'errors', label: 'Error Inbox' },
  { id: 'slo', label: 'SLO / Burn Rate' },
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
          <TxTab service={service} errPct={errPct} txWindow={txWindow} setTxWindow={setTxWindow}
            pointCount={pointCount} txTimeLabels={txTimeLabels} />
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

// ─── Transaction tab with time axis + clickable P90 breakdown ───────────────

interface TxTabProps {
  service: NonNullable<SystemState>['services'][string]
  errPct: number
  txWindow: '1h' | '6h' | '24h'
  setTxWindow: (w: '1h' | '6h' | '24h') => void
  pointCount: number
  txTimeLabels: string[]
}

function TxBreakdown({ tx, errPct, onClose }: { tx: { name: string; avgMs: number; calls: number }; errPct: number; onClose: () => void }) {
  const p90 = Math.round(tx.avgMs * 1.35)
  const p95 = Math.round(tx.avgMs * 1.55)
  const p99 = Math.round(tx.avgMs * 2.1)
  const apdex = tx.avgMs < 500 ? ((1 + (tx.avgMs < 2000 ? 0.5 : 0)) / 2).toFixed(2) : (tx.avgMs < 2000 ? 0.7 : 0.3).toFixed(2)
  const latC = tx.avgMs > 2000 ? '#f85149' : tx.avgMs > 500 ? '#d29922' : '#00b4a0'
  // Segment breakdown: DB, external, app code
  const dbPct = errPct > 5 ? 72 : 35
  const extPct = 8
  const appPct = 100 - dbPct - extPct
  return (
    <div className="bg-[#0d0e17] border border-[#00b4a0]/40 rounded p-4 mt-2 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[#00b4a0] font-bold text-[11px] uppercase tracking-widest">Transaction Detail</div>
        <button onClick={onClose} className="text-[#555] hover:text-[#d4d4d4] text-[11px] transition-colors">✕</button>
      </div>
      <div className="text-[#8ab4f8] font-mono text-[10px] truncate">{tx.name}</div>

      {/* Latency percentiles */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Avg', val: `${tx.avgMs}ms`, color: latC },
          { label: 'P90', val: `${p90}ms`, color: p90 > 2000 ? '#f85149' : p90 > 500 ? '#d29922' : '#00b4a0' },
          { label: 'P95', val: `${p95}ms`, color: p95 > 2000 ? '#f85149' : p95 > 500 ? '#d29922' : '#00b4a0' },
          { label: 'P99', val: `${p99}ms`, color: p99 > 2000 ? '#f85149' : p99 > 500 ? '#d29922' : '#00b4a0' },
        ].map(s => (
          <div key={s.label} className="bg-[#12131a] border border-[#2d2f45] rounded p-2 text-center">
            <div className="text-[#555] text-[9px] mb-0.5">{s.label}</div>
            <div className="font-bold text-[11px]" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Apdex + calls */}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="bg-[#12131a] border border-[#2d2f45] rounded p-2">
          <div className="text-[#555] text-[9px] mb-0.5">Apdex</div>
          <div className={`font-bold ${parseFloat(apdex) > 0.85 ? 'text-[#00b4a0]' : parseFloat(apdex) > 0.7 ? 'text-[#d29922]' : 'text-[#f85149]'}`}>{apdex}</div>
        </div>
        <div className="bg-[#12131a] border border-[#2d2f45] rounded p-2">
          <div className="text-[#555] text-[9px] mb-0.5">Total Calls</div>
          <div className="text-[#d4d4d4] font-bold">{tx.calls.toLocaleString()}</div>
        </div>
        <div className="bg-[#12131a] border border-[#2d2f45] rounded p-2">
          <div className="text-[#555] text-[9px] mb-0.5">Error Rate</div>
          <div className={`font-bold ${errPct > 5 ? 'text-[#f85149]' : 'text-[#d4d4d4]'}`}>{Math.max(0, errPct).toFixed(1)}%</div>
        </div>
      </div>

      {/* Call breakdown bar */}
      <div>
        <div className="text-[#555] text-[9px] mb-1.5 uppercase tracking-widest">Time Breakdown</div>
        <div className="flex h-4 rounded overflow-hidden">
          <div style={{ width: `${dbPct}%`, backgroundColor: errPct > 5 ? '#f85149' : '#2a5298' }} title={`Database: ${dbPct}%`} />
          <div style={{ width: `${extPct}%`, backgroundColor: '#8ab4f8' }} title={`External: ${extPct}%`} />
          <div style={{ width: `${appPct}%`, backgroundColor: '#00b4a0' }} title={`App code: ${appPct}%`} />
        </div>
        <div className="flex gap-4 mt-1.5 text-[9px]">
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: errPct > 5 ? '#f85149' : '#2a5298' }}/>Database {dbPct}%</span>
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1 bg-[#8ab4f8]"/>External {extPct}%</span>
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1 bg-[#00b4a0]"/>App code {appPct}%</span>
        </div>
        {errPct > 5 && (
          <div className="text-[#f85149] text-[10px] mt-1.5">⚠ High DB time — possible slow query or connection pool exhaustion</div>
        )}
      </div>
    </div>
  )
}

function TxTab({ service, errPct, txWindow, setTxWindow, pointCount, txTimeLabels }: TxTabProps) {
  const [openTx, setOpenTx] = useState<number | null>(null)
  const transactions = [
    { name: `POST /api/v1/${service.name.replace('-service', '')}/create`, calls: 1243, avgMs: Math.round(service.p99_latency_ms * 0.6), errPct: errPct * 0.8 },
    { name: `GET /api/v1/${service.name.replace('-service', '')}/list`, calls: 3891, avgMs: Math.round(service.p99_latency_ms * 0.35), errPct: errPct * 0.4 },
    { name: `PUT /api/v1/${service.name.replace('-service', '')}/update`, calls: 547, avgMs: Math.round(service.p99_latency_ms * 0.8), errPct: errPct * 1.2 },
    { name: `DELETE /api/v1/${service.name.replace('-service', '')}/remove`, calls: 89, avgMs: Math.round(service.p99_latency_ms * 0.5), errPct: errPct * 0.3 },
    { name: `GET /api/v1/${service.name.replace('-service', '')}/health`, calls: 12490, avgMs: 2, errPct: 0 },
  ]

  // Pick 5 evenly spaced time labels for the sparkline axis
  const axisLabels = [0, 0.25, 0.5, 0.75, 1].map(frac => {
    const idx = Math.round(frac * (txTimeLabels.length - 1))
    return txTimeLabels[idx]
  })
  const showAxis = txWindow === '6h' || txWindow === '24h'

  return (
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

      {transactions.map((tx, i) => {
        const sparkData = spikeHist(tx.avgMs * 0.8, tx.avgMs, pointCount, 0.3, 0.7, tx.avgMs * 0.1)
        const latC = tx.avgMs > 2000 ? '#f85149' : tx.avgMs > 500 ? '#d29922' : '#00b4a0'
        const isOpen = openTx === i
        return (
          <div key={i} className="space-y-0">
            <div
              onClick={() => setOpenTx(isOpen ? null : i)}
              className={`bg-[#12131a] border rounded p-2.5 text-[11px] cursor-pointer transition-colors ${
                isOpen ? 'border-[#00b4a0]' : 'border-[#2d2f45] hover:border-[#00b4a0]/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[#8ab4f8] truncate flex-1 font-mono text-[10px]">{tx.name}</span>
                <span className="text-[#555] text-[9px] ml-2">{isOpen ? '▲ collapse' : '▼ detail'}</span>
              </div>
              <div className="grid gap-2 text-[10px]" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                <div><span className="text-[#555]">Calls: </span><span className="text-[#d4d4d4]">{tx.calls.toLocaleString()}</span></div>
                <div><span className="text-[#555]">Avg: </span><span style={{ color: latC }}>{tx.avgMs}ms</span></div>
                <div><span className="text-[#555]">Errors: </span><span style={{ color: tx.errPct > 5 ? '#f85149' : '#d4d4d4' }}>{Math.max(0, tx.errPct).toFixed(1)}%</span></div>
                <div>
                  {/* Sparkline with optional time axis */}
                  <div className="relative">
                    <Spark values={sparkData} color={latC} h={20} />
                    {showAxis && (
                      <div className="flex justify-between text-[8px] text-[#444] mt-0.5">
                        <span>{axisLabels[0]}</span>
                        <span>{axisLabels[2]}</span>
                        <span>{axisLabels[4]}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {isOpen && (
              <TxBreakdown tx={tx} errPct={tx.errPct} onClose={() => setOpenTx(null)} />
            )}
          </div>
        )
      })}

      {showAxis && (
        <div className="bg-[#12131a] border border-[#2d2f45] rounded p-2 text-[10px]">
          <div className="text-[#555] text-[9px] mb-1 uppercase tracking-widest">Time Axis — {txWindow} window</div>
          <div className="flex justify-between text-[#484f58]">
            {axisLabels.map((l, i) => <span key={i}>{l}</span>)}
          </div>
          <div className="h-px bg-[#2d2f45] mt-1" />
          <div className="text-[#484f58] text-[9px] mt-1">Spike visible at {txWindow === '6h' ? 'approx. 2h ago' : 'approx. 7h ago'} — incident onset</div>
        </div>
      )}

      {!showAxis && (
        <div className="text-[#555] text-[10px] mt-2 text-center">
          Showing last {txWindow} · Click any row to see P90/P95/P99 + call breakdown
        </div>
      )}
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

        {activeTab === 'servicemap' && (() => {
          // Static topology — positions fixed, health colors from live state
          const svcMap: Record<string, { x: number; y: number; label: string; type: 'svc' | 'infra' | 'ext' }> = {
            'internet':           { x: 60,  y: 200, label: 'Internet',         type: 'ext' },
            'api-gateway':        { x: 200, y: 200, label: 'api-gateway',      type: 'svc' },
            'payment-service':    { x: 380, y: 100, label: 'payment-service',  type: 'svc' },
            'user-service':       { x: 380, y: 220, label: 'user-service',     type: 'svc' },
            'notification-service':{ x: 380, y: 340, label: 'notif-service',  type: 'svc' },
            'postgres-primary':   { x: 560, y: 80,  label: 'postgres-primary', type: 'infra' },
            'redis-cache':        { x: 560, y: 200, label: 'redis-cache',      type: 'infra' },
            'kafka':              { x: 560, y: 340, label: 'kafka',            type: 'infra' },
          }
          const edges: [string, string][] = [
            ['internet', 'api-gateway'],
            ['api-gateway', 'payment-service'],
            ['api-gateway', 'user-service'],
            ['api-gateway', 'notification-service'],
            ['payment-service', 'postgres-primary'],
            ['user-service', 'postgres-primary'],
            ['user-service', 'redis-cache'],
            ['notification-service', 'kafka'],
          ]
          const W = 660, H = 440
          const R = 28

          function nodeColor(id: string) {
            if (svcMap[id].type === 'ext') return '#4a4a6a'
            if (svcMap[id].type === 'infra') {
              // Match infra from systemState
              const db = databases.find(d => d.name.toLowerCase().includes(id.split('-')[0]))
              const ca = caches.find(c => c.name.toLowerCase().includes(id.split('-')[0]))
              const item = db ?? ca
              if (!item) return '#2d5a3d'
              return item.status === 'down' ? '#5a1a1a' : item.status === 'degraded' ? '#4a3a00' : '#1a4a2d'
            }
            const s = services.find(sv => sv.name.toLowerCase().replace(/[\s_]/g, '-') === id || sv.name === id)
            if (!s) return '#1a2a4a'
            return s.status === 'down' ? '#5a1a1a' : s.status === 'degraded' ? '#4a3a00' : '#1a4a2d'
          }

          function nodeTextColor(id: string) {
            if (svcMap[id].type === 'ext') return '#888'
            if (svcMap[id].type === 'infra') {
              const db = databases.find(d => d.name.toLowerCase().includes(id.split('-')[0]))
              const ca = caches.find(c => c.name.toLowerCase().includes(id.split('-')[0]))
              const item = db ?? ca
              if (!item) return '#00b4a0'
              return item.status === 'down' ? '#f85149' : item.status === 'degraded' ? '#d29922' : '#00b4a0'
            }
            const s = services.find(sv => sv.name.toLowerCase().replace(/[\s_]/g, '-') === id || sv.name === id)
            if (!s) return '#4a90d9'
            return s.status === 'down' ? '#f85149' : s.status === 'degraded' ? '#d29922' : '#00b4a0'
          }

          function edgeColor(from: string, to: string) {
            const tc = nodeTextColor(to)
            return tc === '#f85149' ? '#f85149' : tc === '#d29922' ? '#d29922' : '#2d2f45'
          }

          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#888] text-[10px] uppercase tracking-widest">Service Map — click a node to drill down</span>
                <div className="flex items-center gap-3 text-[9px]">
                  {[['#00b4a0','Healthy'],['#d29922','Degraded'],['#f85149','Down']].map(([c,l]) => (
                    <span key={l} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />{l}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-[#0d0e14] border border-[#2d2f45] rounded overflow-hidden">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 340 }}>
                  {/* Grid lines */}
                  {Array.from({ length: 8 }, (_, i) => (
                    <line key={`h${i}`} x1={0} y1={i * 60} x2={W} y2={i * 60} stroke="#1a1d2e" strokeWidth={1} />
                  ))}
                  {Array.from({ length: 12 }, (_, i) => (
                    <line key={`v${i}`} x1={i * 60} y1={0} x2={i * 60} y2={H} stroke="#1a1d2e" strokeWidth={1} />
                  ))}

                  {/* Edges */}
                  {edges.map(([from, to], i) => {
                    const f = svcMap[from], t = svcMap[to]
                    const ec = edgeColor(from, to)
                    const mx = (f.x + t.x) / 2
                    return (
                      <g key={i}>
                        <path
                          d={`M ${f.x + R} ${f.y} C ${mx} ${f.y} ${mx} ${t.y} ${t.x - R} ${t.y}`}
                          fill="none" stroke={ec} strokeWidth={ec === '#2d2f45' ? 1.5 : 2}
                          strokeDasharray={ec === '#f85149' ? '4 2' : undefined}
                          opacity={0.7}
                        />
                        {/* Arrowhead */}
                        <polygon
                          points={`${t.x - R},${t.y} ${t.x - R - 7},${t.y - 4} ${t.x - R - 7},${t.y + 4}`}
                          fill={ec} opacity={0.7}
                        />
                        {/* Error rate label on degraded/down edges */}
                        {ec !== '#2d2f45' && (() => {
                          const s = services.find(sv => sv.name.toLowerCase().replace(/[\s_]/g,'-') === to || sv.name === to)
                          if (!s) return null
                          const ep = (s.error_rate * 100).toFixed(0)
                          return (
                            <text x={mx} y={(f.y + t.y) / 2 - 4} textAnchor="middle" fill={ec} fontSize={8} fontFamily="monospace">
                              {ep}% err
                            </text>
                          )
                        })()}
                      </g>
                    )
                  })}

                  {/* Nodes */}
                  {Object.entries(svcMap).map(([id, node]) => {
                    const bg = nodeColor(id)
                    const tc = nodeTextColor(id)
                    const isInfra = node.type === 'infra'
                    const isExt = node.type === 'ext'
                    const isClickable = node.type === 'svc'
                    const matchedSvc = services.find(sv => sv.name.toLowerCase().replace(/[\s_]/g,'-') === id || sv.name === id)
                    const isPulsing = matchedSvc && matchedSvc.status === 'down'
                    return (
                      <g key={id}
                        style={{ cursor: isClickable ? 'pointer' : 'default' }}
                        onClick={() => isClickable && matchedSvc && setSelectedService(matchedSvc.name)}
                      >
                        {/* Pulse ring for down services */}
                        {isPulsing && (
                          <circle cx={node.x} cy={node.y} r={R + 8} fill="none" stroke="#f85149" strokeWidth={1.5} opacity={0.4}>
                            <animate attributeName="r" values={`${R+4};${R+14};${R+4}`} dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                          </circle>
                        )}
                        {/* Node shape: rect for infra, circle for services */}
                        {isInfra ? (
                          <rect x={node.x - R} y={node.y - R * 0.7} width={R * 2} height={R * 1.4}
                            rx={4} fill={bg} stroke={tc} strokeWidth={1.5} />
                        ) : (
                          <circle cx={node.x} cy={node.y} r={R} fill={bg} stroke={tc} strokeWidth={isExt ? 1 : 2} strokeDasharray={isExt ? '3 2' : undefined} />
                        )}
                        {/* Icon */}
                        <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize={11} fill={tc}>
                          {isExt ? '🌐' : isInfra
                            ? (id.includes('redis') ? '⚡' : id.includes('kafka') ? '📨' : '🗄')
                            : (id.includes('gateway') ? '🔀' : id.includes('payment') ? '💳' : id.includes('user') ? '👤' : '🔔')}
                        </text>
                        {/* Service name */}
                        <text x={node.x} y={node.y + R + 14} textAnchor="middle" fontSize={9} fill={tc} fontFamily="monospace">
                          {node.label}
                        </text>
                        {/* Status badge */}
                        {matchedSvc && (
                          <text x={node.x} y={node.y + R + 24} textAnchor="middle" fontSize={8} fill={tc} opacity={0.8} fontFamily="monospace">
                            {matchedSvc.status === 'down' ? '● DOWN' : matchedSvc.status === 'degraded' ? '● DEG' : '● OK'}
                          </text>
                        )}
                        {/* p99 on hover — show always for compactness */}
                        {matchedSvc && matchedSvc.status !== 'healthy' && (
                          <text x={node.x} y={node.y + 6} textAnchor="middle" fontSize={8} fill={tc} fontFamily="monospace">
                            {matchedSvc.p99_latency_ms}ms
                          </text>
                        )}
                      </g>
                    )
                  })}

                  {/* Column labels */}
                  {[['Client', 60], ['Gateway', 200], ['Services', 380], ['Infra', 560]].map(([lbl, x]) => (
                    <text key={lbl as string} x={x as number} y={H - 12} textAnchor="middle" fontSize={9} fill="#333" fontFamily="monospace" letterSpacing={1}>
                      {(lbl as string).toUpperCase()}
                    </text>
                  ))}
                </svg>
              </div>

              {/* Quick stats row */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { label: 'Total Services', value: services.length, color: '#d4d4d4' },
                  { label: 'Degraded / Down', value: services.filter(s => s.status !== 'healthy').length, color: services.some(s => s.status !== 'healthy') ? '#f85149' : '#00b4a0' },
                  { label: 'Avg Error Rate', value: services.length ? `${(services.reduce((a, s) => a + s.error_rate, 0) / services.length * 100).toFixed(1)}%` : '—', color: '#d29922' },
                ].map(t => (
                  <div key={t.label} className="bg-[#1a1d2e] border border-[#2d2f45] rounded p-2.5">
                    <div className="text-[#555] text-[9px] uppercase tracking-widest mb-1">{t.label}</div>
                    <div className="font-bold text-sm tabular-nums" style={{ color: t.color }}>{t.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

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

        {activeTab === 'traces' && (() => {
          const svcs = systemState ? Object.entries(systemState.services) : []
          const hasSlow = svcs.some(([, s]) => s.p99_latency_ms > 500)
          const slowSvc = svcs.find(([, s]) => s.p99_latency_ms > 500)
          const traceDuration = slowSvc ? slowSvc[1].p99_latency_ms : 280

          // Simulated trace spans
          const spans = [
            { name: 'api-gateway → payment-service', service: 'api-gateway', start: 0, duration: traceDuration, status: slowSvc ? 'error' : 'ok' },
            { name: 'payment-service DB query', service: 'payment-service', start: 12, duration: slowSvc ? traceDuration - 30 : 180, status: slowSvc ? 'slow' : 'ok' },
            { name: 'redis GET session', service: 'redis', start: 8, duration: slowSvc ? 280 : 4, status: slowSvc && systemState?.infrastructure.caches.find(c => c.name.includes('redis'))?.status !== 'healthy' ? 'slow' : 'ok' },
            { name: 'postgres SELECT payments', service: 'postgres', start: 14, duration: slowSvc ? traceDuration - 40 : 160, status: slowSvc ? 'slow' : 'ok' },
            { name: 'notification-service.notify()', service: 'notification-service', start: traceDuration - 45, duration: 42, status: 'ok' },
          ]
          const totalDur = Math.max(...spans.map(s => s.start + s.duration))

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[#888] text-[10px] uppercase tracking-widest">Distributed Traces — Latest</span>
                {hasSlow && <span className="text-[9px] px-2 py-0.5 rounded bg-[#f85149]/20 text-[#f85149] font-bold">SLOW TRACE DETECTED</span>}
              </div>

              {/* Trace summary cards */}
              <div className="space-y-2">
                {[
                  { id: 'trace-a8f2', root: 'POST /v1/payments', duration: traceDuration, spans: 5, status: hasSlow ? 'error' : 'ok' },
                  { id: 'trace-b3c1', root: 'GET /v1/users/profile', duration: 48, spans: 3, status: 'ok' },
                  { id: 'trace-d9e4', root: 'POST /v1/transactions', duration: hasSlow ? 2100 : 180, spans: 4, status: hasSlow ? 'slow' : 'ok' },
                ].map(t => (
                  <div key={t.id} className={`bg-[#12131a] border rounded p-3 text-[10px] ${t.status === 'error' || t.status === 'slow' ? 'border-[#f85149]/30' : 'border-[#2d2f45]'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'error' ? 'bg-[#f85149]' : t.status === 'slow' ? 'bg-[#d29922]' : 'bg-[#00b4a0]'}`} />
                      <span className="text-[#d4d4d4] font-mono flex-1">{t.root}</span>
                      <span className="text-[#555] font-mono text-[9px]">{t.id}</span>
                      <span className={`font-bold tabular-nums ${t.duration > 1000 ? 'text-[#f85149]' : t.duration > 500 ? 'text-[#d29922]' : 'text-[#00b4a0]'}`}>{t.duration}ms</span>
                      <span className="text-[#555]">{t.spans} spans</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Waterfall for first trace */}
              <div className="bg-[#12131a] border border-[#2d2f45] rounded p-4">
                <div className="text-[#888] text-[9px] uppercase tracking-widest mb-3">Span Waterfall — trace-a8f2 · {traceDuration}ms total</div>
                <div className="space-y-2">
                  {spans.map((span, i) => {
                    const leftPct = (span.start / totalDur) * 100
                    const widthPct = Math.max((span.duration / totalDur) * 100, 1)
                    const color = span.status === 'error' ? '#f85149' : span.status === 'slow' ? '#d29922' : '#00b4a0'
                    return (
                      <div key={i} className="flex items-center gap-3 text-[9px]">
                        <div className="w-44 flex-shrink-0 text-[#9aa0a6] truncate font-mono">{span.name}</div>
                        <div className="flex-1 relative h-5 bg-[#1a1d2e] rounded">
                          <div
                            className="absolute h-full rounded flex items-center px-1.5 overflow-hidden"
                            style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: color, opacity: 0.85 }}
                          >
                            <span className="text-[8px] text-white whitespace-nowrap font-bold">{span.duration}ms</span>
                          </div>
                        </div>
                        <div className="w-12 text-right flex-shrink-0" style={{ color }}>
                          {span.status === 'slow' ? 'SLOW' : span.status === 'error' ? 'ERR' : 'OK'}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {hasSlow && (
                  <div className="mt-3 p-2 bg-[#f85149]/10 border border-[#f85149]/20 rounded text-[9px] text-[#f85149]">
                    ⚠ Bottleneck identified: postgres SELECT is consuming {Math.round(((traceDuration - 40) / traceDuration) * 100)}% of total trace duration. Check slow query log.
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {activeTab === 'errors' && (() => {
          const svcs = systemState ? Object.entries(systemState.services) : []
          const hasErrors = svcs.some(([, s]) => s.error_rate > 0.05)

          const errorGroups = [
            { id: 'ERR-001', fingerprint: 'NullPointerException @ PaymentProcessor:284', count: hasErrors ? 1284 : 3, service: 'payment-service', first: '14:21:08', last: '14:31:44', status: hasErrors ? 'unresolved' : 'resolved' },
            { id: 'ERR-002', fingerprint: 'Connection refused: jdbc:postgresql://db-primary:5432', count: hasErrors ? 892 : 0, service: 'payment-service', first: '14:23:12', last: '14:31:41', status: hasErrors ? 'unresolved' : 'resolved' },
            { id: 'ERR-003', fingerprint: 'TimeoutException: redis-primary:6379 did not respond within 500ms', count: hasErrors ? 441 : 0, service: 'checkout-service', first: '14:22:55', last: '14:31:39', status: hasErrors ? 'unresolved' : 'resolved' },
            { id: 'ERR-004', fingerprint: 'SchemaValidationError: field "amount_currency" missing in payload', count: 7, service: 'notification-service', first: '14:26:01', last: '14:28:12', status: 'investigating' },
            { id: 'ERR-005', fingerprint: 'HTTP 503: upstream payment gateway unavailable', count: hasErrors ? 2100 : 12, service: 'api-gateway', first: '14:20:44', last: '14:31:50', status: hasErrors ? 'unresolved' : 'resolved' },
          ].filter(e => e.count > 0)

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#888] text-[10px] uppercase tracking-widest">Error Inbox</span>
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${hasErrors ? 'bg-[#f85149]/20 text-[#f85149]' : 'bg-[#3fb950]/10 text-[#3fb950]'}`}>
                  {errorGroups.filter(e => e.status === 'unresolved').length} UNRESOLVED
                </span>
              </div>
              <div className="space-y-2">
                {errorGroups.map(err => (
                  <div key={err.id} className={`bg-[#12131a] border rounded p-3 text-[10px] ${err.status === 'unresolved' ? 'border-[#f85149]/30' : err.status === 'investigating' ? 'border-[#d29922]/30' : 'border-[#2d2f45]'}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${err.status === 'unresolved' ? 'bg-[#f85149]/20 text-[#f85149]' : err.status === 'investigating' ? 'bg-[#d29922]/20 text-[#d29922]' : 'bg-[#3fb950]/10 text-[#3fb950]'}`}>
                        {err.status.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[#d4d4d4] text-[10px] leading-relaxed break-all">{err.fingerprint}</div>
                        <div className="flex items-center gap-3 mt-1 text-[9px] text-[#555]">
                          <span className="text-[#8ab4f8]">{err.service}</span>
                          <span>first: {err.first}</span>
                          <span>last: {err.last}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`font-bold tabular-nums text-sm ${err.count > 500 ? 'text-[#f85149]' : err.count > 50 ? 'text-[#d29922]' : 'text-[#d4d4d4]'}`}>{err.count.toLocaleString()}</div>
                        <div className="text-[#555] text-[9px]">occurrences</div>
                      </div>
                    </div>
                  </div>
                ))}
                {errorGroups.length === 0 && <div className="text-[#00b4a0] text-center py-8 text-[11px]">✓ Error inbox is clear</div>}
              </div>
            </div>
          )
        })()}

        {activeTab === 'slo' && (() => {
          const svcs = systemState ? Object.entries(systemState.services) : []
          const hasErrors = svcs.some(([, s]) => s.error_rate > 0.05)

          const slos = [
            { service: 'payment-service', target: 99.9, window: '30d', budgetMins: 43.2, consumed: hasErrors ? 78 : 12, burnRate: hasErrors ? 14.2 : 0.8, metric: 'availability' },
            { service: 'api-gateway', target: 99.95, window: '30d', budgetMins: 21.6, consumed: hasErrors ? 45 : 5, burnRate: hasErrors ? 6.8 : 0.4, metric: 'error_rate < 0.05%' },
            { service: 'checkout-service', target: 99.0, window: '30d', budgetMins: 432, consumed: hasErrors ? 22 : 3, burnRate: hasErrors ? 3.1 : 0.2, metric: 'latency p99 < 500ms' },
            { service: 'user-service', target: 99.5, window: '30d', budgetMins: 216, consumed: 8, burnRate: 0.6, metric: 'availability' },
          ]

          return (
            <div className="space-y-3">
              <div className="text-[#888] text-[10px] uppercase tracking-widest">SLO Dashboard — Error Budget Status</div>
              {slos.map(slo => {
                const isBreaching = slo.burnRate > 2
                const pct = Math.min(slo.consumed, 100)
                const color = pct > 80 ? '#f85149' : pct > 50 ? '#d29922' : '#00b4a0'
                return (
                  <div key={slo.service} className={`bg-[#12131a] border rounded p-4 ${isBreaching ? 'border-[#f85149]/40' : 'border-[#2d2f45]'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-[#d4d4d4] font-bold">{slo.service}</span>
                        <span className="text-[#555] ml-2 text-[9px]">{slo.target}% {slo.metric}</span>
                      </div>
                      {isBreaching && <span className="text-[9px] px-2 py-0.5 rounded bg-[#f85149]/20 text-[#f85149] font-bold animate-pulse">🔥 BURNING FAST</span>}
                    </div>

                    {/* Budget gauge */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[9px] mb-1">
                        <span className="text-[#555]">Error budget consumed ({slo.window})</span>
                        <span style={{ color }} className="font-bold">{pct}%</span>
                      </div>
                      <div className="h-2 bg-[#1a1d2e] rounded overflow-hidden">
                        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <div className="flex justify-between text-[9px] mt-1 text-[#555]">
                        <span>Remaining: {(slo.budgetMins * (1 - pct / 100)).toFixed(1)} min</span>
                        <span>Budget: {slo.budgetMins} min / {slo.window}</span>
                      </div>
                    </div>

                    {/* Burn rate */}
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <div className="text-[#555] text-[9px] mb-0.5">1h burn rate</div>
                        <div className={`font-bold text-lg tabular-nums ${slo.burnRate > 10 ? 'text-[#f85149]' : slo.burnRate > 2 ? 'text-[#d29922]' : 'text-[#00b4a0]'}`}>
                          {slo.burnRate}x
                        </div>
                        <div className="text-[#555] text-[9px]">{slo.burnRate > 1 ? 'consuming budget faster than target' : 'within target'}</div>
                      </div>
                      <div>
                        <div className="text-[#555] text-[9px] mb-0.5">Projected exhaustion</div>
                        <div className={`font-bold ${slo.burnRate > 10 ? 'text-[#f85149]' : 'text-[#d4d4d4]'}`}>
                          {slo.burnRate > 10 ? `~${Math.round(slo.budgetMins * (1 - pct / 100) / (slo.burnRate * 60))}h` : slo.burnRate > 1 ? 'Days' : 'End of window'}
                        </div>
                        <div className="text-[#555] text-[9px]">at current burn rate</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
