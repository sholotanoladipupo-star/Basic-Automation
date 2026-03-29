import { useState, useMemo, useCallback, useEffect } from 'react'
import { SystemState } from '../types'

interface GCPConsoleProps { systemState: SystemState | null }

const GCP_NAV = [
  { id: 'gke',      icon: '☸',  label: 'Kubernetes Engine' },
  { id: 'cloudsql', icon: '🗄', label: 'Cloud SQL' },
  { id: 'logging',  icon: '📋', label: 'Cloud Logging' },
  { id: 'iam',      icon: '🔑', label: 'IAM & Admin' },
]

const STATIC_SERVICES = [
  { name: 'api-gateway',         status: 'healthy', error_rate: 0.001, p99_latency_ms: 8  },
  { name: 'auth-service',        status: 'healthy', error_rate: 0.002, p99_latency_ms: 12 },
  { name: 'user-service',        status: 'healthy', error_rate: 0.001, p99_latency_ms: 15 },
  { name: 'notification-service',status: 'healthy', error_rate: 0.003, p99_latency_ms: 22 },
  { name: 'fraud-detection',     status: 'healthy', error_rate: 0.001, p99_latency_ms: 45 },
  { name: 'order-service',       status: 'healthy', error_rate: 0.002, p99_latency_ms: 18 },
  { name: 'inventory-service',   status: 'healthy', error_rate: 0.001, p99_latency_ms: 11 },
  { name: 'analytics-service',   status: 'healthy', error_rate: 0.004, p99_latency_ms: 35 },
  { name: 'kyc-service',         status: 'healthy', error_rate: 0.001, p99_latency_ms: 28 },
  { name: 'config-service',      status: 'healthy', error_rate: 0.0,   p99_latency_ms: 4  },
]

const LEVEL_COLOR: Record<string, string> = {
  INFO: '#6b7280', DEBUG: '#484f58', WARN: '#d29922', ERROR: '#f85149', FATAL: '#f85149',
}

function podStatus(podIdx: number, current: number, desired: number, isScaling: boolean): string {
  if (!isScaling) return podIdx < current ? 'Running' : 'Terminated'
  if (podIdx < desired && podIdx >= current) return 'ContainerCreating' // scaling up
  if (podIdx >= desired && podIdx < current) return 'Terminating'       // scaling down
  return podIdx < current ? 'Running' : 'Terminated'
}

function StatusChip({ status }: { status: string }) {
  const c =
    status === 'Running' || status === 'healthy' || status === 'RUNNING'
      ? 'bg-[#0f2a1a] text-[#3fb950] border-[#3fb950]'
      : status === 'Terminating'
      ? 'bg-[#2a1e00] text-[#d29922] border-[#d29922]'
      : status === 'ContainerCreating'
      ? 'bg-[#0a1a2a] text-[#58a6ff] border-[#58a6ff]'
      : status === 'down' || status === 'ERROR'
      ? 'bg-[#2a0a0a] text-[#f85149] border-[#f85149]'
      : 'bg-[#2a1e00] text-[#d29922] border-[#d29922]'
  const label =
    status === 'healthy' ? 'RUNNING'
    : status === 'down'  ? 'ERROR'
    : status === 'degraded' ? 'DEGRADED'
    : status.toUpperCase()
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${c}`}>{label}</span>
}

// --- Log generation ---
function generateLogs(service: string, status: string, minutes: number): { time: string; level: string; msg: string }[] {
  const now = Date.now()
  const count = Math.min(minutes * 5, 80)
  const msgs: Record<string, string[]> = {
    INFO:  [`GET /api/v1/health 200 OK 3ms`,`POST /api/v1/transactions 201 Created 18ms`,`Processed 847 events in batch`,`Cache hit ratio: 94.2%`,`DB connection pool: 12/100 active`,`Heartbeat OK — upstream services reachable`,`Metrics flushed to Prometheus endpoint`,`Config reload completed — 0 changes detected`,`JWT validated for user_id=usr_48291 (1ms)`],
    DEBUG: [`Entering handler: TransactionController.create`,`SQL query executed: SELECT * FROM accounts WHERE id=$1 [3ms]`,`Cache key lookup: session:usr_48291 → HIT`,`gRPC interceptor: req_id=74f2b9`,`Span started: checkout.process_payment`,`Rate limiter bucket: 850/1000 tokens remaining`,`Health check: /readyz returned 200 in 1ms`],
    WARN:  [`Response time p99 exceeded 2000ms (got 3241ms)`,`DB connection pool at 71% capacity (71/100)`,`Redis cache miss rate elevated: 28%`,`Memory usage at 73%`,`Retry 2/3 for downstream call`,`Slow query detected (>500ms)`,`Goroutine count spike: 1820 (threshold: 1500)`],
    ERROR: [`upstream connect error or disconnect/reset before headers`,`context deadline exceeded after 5000ms`,`failed to acquire distributed lock after 3 retries`,`pq: deadlock detected — rolling back transaction`,`EOF on Redis connection — reconnecting`,`gRPC status UNAVAILABLE from payment-processor:50051`],
    FATAL: [`panic: runtime error: nil pointer dereference`,`connection refused — localhost:5432`,`OOMKilled — container exceeded memory limit`,`failed to connect to Redis: connection refused`,`unrecoverable error in main goroutine — exiting`],
  }
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(now - (count - i) * (minutes * 60000 / count))
    let level: string
    if (status === 'down') { const r = Math.random(); level = r < 0.5 ? 'FATAL' : r < 0.8 ? 'ERROR' : 'WARN' }
    else if (status === 'degraded') { const r = Math.random(); level = r < 0.3 ? 'ERROR' : r < 0.55 ? 'WARN' : r < 0.7 ? 'INFO' : 'DEBUG' }
    else { const r = Math.random(); level = r < 0.45 ? 'INFO' : r < 0.75 ? 'DEBUG' : r < 0.88 ? 'WARN' : 'ERROR' }
    const pool = msgs[level] ?? msgs.INFO
    return { time: t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level, msg: `[${service}] ${pool[Math.floor(Math.random() * pool.length)]}` }
  })
}

function generateEvents(svcName: string, status: string) {
  const now = Date.now()
  if (status === 'down') return [
    { time: new Date(now - 300000).toLocaleTimeString(), type: 'Warning', reason: 'BackOff',   msg: `Back-off restarting failed container ${svcName}` },
    { time: new Date(now - 600000).toLocaleTimeString(), type: 'Warning', reason: 'OOMKilling', msg: `Container ${svcName} exceeded memory limit (512Mi)` },
    { time: new Date(now - 900000).toLocaleTimeString(), type: 'Warning', reason: 'Killing',    msg: `Stopping container due to liveness probe failure` },
  ]
  if (status === 'degraded') return [
    { time: new Date(now - 120000).toLocaleTimeString(), type: 'Warning', reason: 'Unhealthy', msg: `Liveness probe failed: HTTP probe failed statuscode: 503` },
    { time: new Date(now - 240000).toLocaleTimeString(), type: 'Warning', reason: 'Unhealthy', msg: `Readiness probe failed: context deadline exceeded` },
  ]
  return [
    { time: new Date(now - 3600000).toLocaleTimeString(), type: 'Normal', reason: 'Pulled',    msg: `Pulled image gcr.io/moniepoint-prod/${svcName}:latest` },
    { time: new Date(now - 3540000).toLocaleTimeString(), type: 'Normal', reason: 'Started',   msg: `Started container ${svcName}` },
    { time: new Date(now - 3480000).toLocaleTimeString(), type: 'Normal', reason: 'Scheduled', msg: `Assigned to node gke-node-pool-abc123` },
  ]
}

// --- Scale state ---
interface ScaleEntry { desired: number; current: number; isScaling: boolean }

// --- Pod detail (individual pod view) ---
interface PodViewProps { podName: string; status: string; svcStatus: string; onBack: () => void }
function PodView({ podName, status, svcStatus, onBack }: PodViewProps) {
  const [logRange, setLogRange] = useState(5)
  const [logFilter, setLogFilter] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string[]>([])
  const logs = useMemo(() => generateLogs(podName, svcStatus, logRange), [podName, svcStatus, logRange])
  const filtered = logFilter ? logs.filter(l => l.level === logFilter) : logs
  const displayed = [...pinned.map(p => ({ time: '📌', level: 'ERROR', msg: p })), ...filtered.filter(l => !pinned.includes(l.msg))]

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-[#3c4043] bg-[#292a2d] flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-[#8ab4f8] hover:text-[#e8eaed] text-[11px]">← Pod</button>
        <div className="flex-1 min-w-0">
          <div className="text-[#e8eaed] text-sm font-medium font-mono">{podName}</div>
          <div className="text-[#9aa0a6] text-[10px]">Container logs</div>
        </div>
        <StatusChip status={status} />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-[#9aa0a6] text-[10px]">Range:</span>
          {[1, 5, 15, 30, 60].map(m => (
            <button key={m} onClick={() => setLogRange(m)} className={`px-2 py-0.5 rounded text-[10px] transition-colors ${logRange === m ? 'bg-[#8ab4f8] text-[#202124] font-bold' : 'bg-[#292a2d] border border-[#3c4043] text-[#9aa0a6]'}`}>{m < 60 ? `${m}m` : '1h'}</button>
          ))}
          <span className="text-[#9aa0a6] text-[10px] ml-2">Filter:</span>
          {['INFO','DEBUG','WARN','ERROR','FATAL'].map(lvl => (
            <button key={lvl} onClick={() => setLogFilter(logFilter === lvl ? null : lvl)}
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${logFilter === lvl ? 'opacity-100' : 'opacity-50'}`}
              style={{ color: LEVEL_COLOR[lvl], borderColor: LEVEL_COLOR[lvl], backgroundColor: logFilter === lvl ? `${LEVEL_COLOR[lvl]}22` : 'transparent' }}>{lvl}
            </button>
          ))}
          {pinned.length > 0 && <button onClick={() => setPinned([])} className="text-[9px] text-[#484f58] hover:text-[#f85149] ml-auto">clear pins</button>}
        </div>
        <div className="bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[calc(100vh-200px)] overflow-y-auto">
          {displayed.map((l, i) => (
            <div key={i} className="flex gap-2 leading-relaxed group">
              <span className="text-[#484f58] flex-shrink-0 w-16">{l.time}</span>
              <span className="font-bold flex-shrink-0 w-10" style={{ color: LEVEL_COLOR[l.level] ?? '#6b7280' }}>{l.level}</span>
              <span className="text-[#e8eaed] break-all flex-1">{l.msg}</span>
              {(l.level === 'ERROR' || l.level === 'FATAL') && l.time !== '📌' && (
                <button onClick={() => setPinned(p => p.includes(l.msg) ? p.filter(x => x !== l.msg) : [...p, l.msg])}
                  className="opacity-0 group-hover:opacity-100 text-[#484f58] hover:text-[#d29922] flex-shrink-0 transition-opacity" title="Pin this error">📌</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Deployment detail ---
interface DeployDetailProps {
  name: string
  status: string
  kind: 'service' | 'cache' | 'database'
  extraData?: Record<string, unknown>
  scale: ScaleEntry
  podSuffixes: string[]
  onBack: () => void
  onScale: (n: number) => void
}

function DeployDetail({ name, status, kind, extraData, scale, podSuffixes, onBack, onScale }: DeployDetailProps) {
  const [tab, setTab] = useState<'overview' | 'observability' | 'events' | 'logs'>('overview')
  const [logRange, setLogRange] = useState(5)
  const [logFilter, setLogFilter] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string[]>([])
  const [scaleInput, setScaleInput] = useState(String(scale.desired))
  const [selectedPodIdx, setSelectedPodIdx] = useState<number | null>(null)

  const logs = useMemo(() => generateLogs(name, status, logRange), [name, status, logRange])
  const filtered = logFilter ? logs.filter(l => l.level === logFilter) : logs
  const displayed = [...pinned.map(p => ({ time: '📌', level: 'ERROR', msg: p })), ...filtered.filter(l => !pinned.includes(l.msg))]
  const events = useMemo(() => generateEvents(name, status), [name, status])
  const cpuReq = kind === 'service' ? '250m' : '100m'
  const memReq = kind === 'service' ? '512Mi' : '256Mi'
  const maxPods = 5
  const allPodSuffixes = [...podSuffixes, ...Array.from({ length: Math.max(0, maxPods - podSuffixes.length) }, (_, i) => `extra-${i}`)]

  if (selectedPodIdx !== null) {
    const pSuffix = allPodSuffixes[selectedPodIdx] ?? `pod-${selectedPodIdx}`
    const pStatus = podStatus(selectedPodIdx, scale.current, scale.desired, scale.isScaling)
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2 border-b border-[#3c4043] bg-[#292a2d] flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setSelectedPodIdx(null)} className="text-[#8ab4f8] hover:text-[#e8eaed] text-[11px]">← {name}</button>
        </div>
        <div className="flex-1 overflow-hidden">
          <PodView podName={`${name}-${pSuffix}`} status={pStatus} svcStatus={status} onBack={() => setSelectedPodIdx(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-[#3c4043] bg-[#292a2d] flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-[#8ab4f8] hover:text-[#e8eaed] text-[11px]">← Back</button>
        <div className="flex-1 min-w-0">
          <div className="text-[#e8eaed] text-sm font-medium">{name}</div>
          <div className="text-[#9aa0a6] text-[10px]">Namespace: default · Kind: Deployment</div>
        </div>
        <StatusChip status={status} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#3c4043] bg-[#292a2d] flex-shrink-0">
        {(['overview', 'observability', 'events', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-[11px] capitalize border-b-2 transition-colors ${tab === t ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-[#e8eaed]'}`}>{t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'overview' && (
          <div className="space-y-3 text-[11px]">
            {/* Scale control */}
            <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
              <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">Scale Deployment</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => { const n = Math.max(0, scale.desired - 1); setScaleInput(String(n)); onScale(n) }}
                    className="w-7 h-7 rounded border border-[#3c4043] text-[#e8eaed] hover:bg-[#3c4043] flex items-center justify-center font-bold text-base transition-colors">−</button>
                  <input type="number" min={0} max={maxPods} value={scaleInput}
                    onChange={e => setScaleInput(e.target.value)}
                    onBlur={e => { const n = Math.max(0, Math.min(maxPods, parseInt(e.target.value) || 0)); setScaleInput(String(n)); onScale(n) }}
                    className="w-12 text-center bg-[#1e1f22] border border-[#3c4043] rounded text-[#e8eaed] py-1 text-[11px]" />
                  <button onClick={() => { const n = Math.min(maxPods, scale.desired + 1); setScaleInput(String(n)); onScale(n) }}
                    className="w-7 h-7 rounded border border-[#3c4043] text-[#e8eaed] hover:bg-[#3c4043] flex items-center justify-center font-bold text-base transition-colors">+</button>
                </div>
                <span className="text-[#9aa0a6] text-[10px]">
                  {scale.isScaling ? `scaling → ${scale.desired}…` : `${scale.current}/${scale.desired} replicas`}
                </span>
                <button onClick={() => { onScale(0); setScaleInput('0') }}
                  className="ml-auto text-[10px] px-2 py-0.5 rounded border border-[#f85149]/50 text-[#f85149] hover:bg-[#2a0a0a] transition-colors">
                  Scale to 0
                </button>
              </div>
            </div>

            {/* Deployment info */}
            <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
              <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">Deployment Info</div>
              <div className="grid grid-cols-2 gap-y-2">
                {[['Desired Replicas', `${scale.desired}`], ['Current Replicas', `${scale.current}`], ['Strategy', 'RollingUpdate'], ['CPU Request', cpuReq], ['Memory Request', memReq], ['Cluster', 'moniepoint-prod-gke']].map(([k, v]) => (
                  <div key={k}><div className="text-[#9aa0a6] text-[10px]">{k}</div><div className="text-[#e8eaed] font-medium">{v}</div></div>
                ))}
              </div>
            </div>

            {/* Pod list — each pod is clickable */}
            <div className="bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden">
              <div className="px-3 py-1.5 bg-[#1e1f22] border-b border-[#3c4043] text-[#9aa0a6] text-[10px] uppercase tracking-widest">
                Pods — click to view container logs
              </div>
              {allPodSuffixes.slice(0, Math.max(scale.desired, scale.current, 1)).map((suffix, i) => {
                const ps = podStatus(i, scale.current, scale.desired, scale.isScaling)
                const isVisible = i < Math.max(scale.desired, scale.current)
                if (!isVisible && scale.desired === 0 && scale.current === 0) return null
                return (
                  <div key={i}
                    onClick={() => setSelectedPodIdx(i)}
                    className="flex items-center justify-between px-3 py-2 border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/50 cursor-pointer transition-colors">
                    <span className="text-[#8ab4f8] font-mono text-[10px]">{name}-{suffix}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#484f58] text-[10px]">→ logs</span>
                      <StatusChip status={ps} />
                    </div>
                  </div>
                )
              })}
              {scale.desired === 0 && scale.current === 0 && (
                <div className="px-3 py-3 text-[#484f58] text-[10px] text-center">Scaled to 0 — no running pods</div>
              )}
            </div>

            {extraData && (
              <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">Service Details</div>
                <div className="grid grid-cols-2 gap-y-2">
                  {Object.entries(extraData).map(([k, v]) => (
                    <div key={k}><div className="text-[#9aa0a6] text-[10px]">{k}</div><div className="text-[#e8eaed] font-medium">{String(v)}</div></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'observability' && (
          <div className="space-y-3 text-[11px]">
            <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">CPU &amp; Memory — Last 30 minutes</div>
            {Array.from({ length: Math.max(scale.current, 1) }, (_, i) => {
              const cpu = status === 'down' ? 0 : status === 'degraded' ? 78 + i * 5 : 22 + i * 8
              const mem = status === 'down' ? 0 : status === 'degraded' ? 81 + i * 3 : 35 + i * 10
              const cpuColor = cpu > 80 ? '#f85149' : cpu > 60 ? '#d29922' : '#3fb950'
              const memColor = mem > 85 ? '#f85149' : mem > 70 ? '#d29922' : '#3fb950'
              return (
                <div key={i} className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                  <div className="text-[#8ab4f8] mb-2">Pod {i + 1}</div>
                  {[['CPU Usage', cpu, cpuColor], ['Memory Usage', mem, memColor]].map(([label, val, color]) => (
                    <div key={String(label)} className="mb-2">
                      <div className="flex justify-between text-[10px] mb-1"><span className="text-[#9aa0a6]">{label}</span><span style={{ color: String(color) }} className="font-bold">{val}%</span></div>
                      <div className="w-full bg-[#1e1f22] rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{ width: `${val}%`, backgroundColor: String(color) }} /></div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'events' && (
          <div className="space-y-2 text-[11px]">
            <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">Kubernetes Events</div>
            {events.map((ev, i) => (
              <div key={i} className={`border rounded p-2.5 ${ev.type === 'Warning' ? 'border-[#f85149]/40 bg-[#2a0a0a]/40' : 'border-[#3c4043] bg-[#292a2d]'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-bold text-[10px] ${ev.type === 'Warning' ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>{ev.type}</span>
                  <span className="text-[#9aa0a6] text-[10px]">{ev.time}</span>
                </div>
                <div className="text-[#8ab4f8] mb-0.5">Reason: {ev.reason}</div>
                <div className="text-[#e8eaed]">{ev.msg}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'logs' && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[#9aa0a6] text-[10px]">Range:</span>
              {[1, 5, 15, 30, 60].map(m => (
                <button key={m} onClick={() => setLogRange(m)} className={`px-2 py-0.5 rounded text-[10px] transition-colors ${logRange === m ? 'bg-[#8ab4f8] text-[#202124] font-bold' : 'bg-[#292a2d] border border-[#3c4043] text-[#9aa0a6]'}`}>{m < 60 ? `${m}m` : '1h'}</button>
              ))}
              <span className="text-[#9aa0a6] text-[10px] ml-2">Filter (click level):</span>
              {['INFO','DEBUG','WARN','ERROR','FATAL'].map(lvl => (
                <button key={lvl} onClick={() => setLogFilter(logFilter === lvl ? null : lvl)}
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all ${logFilter === lvl ? 'opacity-100 scale-105' : 'opacity-50 hover:opacity-80'}`}
                  style={{ color: LEVEL_COLOR[lvl], borderColor: LEVEL_COLOR[lvl], backgroundColor: logFilter === lvl ? `${LEVEL_COLOR[lvl]}22` : 'transparent' }}>{lvl}
                </button>
              ))}
              {pinned.length > 0 && <button onClick={() => setPinned([])} className="text-[9px] text-[#484f58] hover:text-[#f85149] ml-auto">clear {pinned.length} pin(s)</button>}
            </div>
            <div className="bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[400px] overflow-y-auto">
              {displayed.map((l, i) => (
                <div key={i} className="flex gap-2 leading-relaxed group">
                  <span className="text-[#484f58] flex-shrink-0 w-16">{l.time}</span>
                  <span className="font-bold flex-shrink-0 w-10" style={{ color: LEVEL_COLOR[l.level] ?? '#6b7280' }}>{l.level}</span>
                  <span className="text-[#e8eaed] break-all flex-1">{l.msg}</span>
                  {(l.level === 'ERROR' || l.level === 'FATAL') && l.time !== '📌' && (
                    <button onClick={() => setPinned(p => p.includes(l.msg) ? p.filter(x => x !== l.msg) : [...p, l.msg])}
                      className="opacity-0 group-hover:opacity-100 text-[#484f58] hover:text-[#d29922] flex-shrink-0 text-[11px] transition-opacity" title="Pin error">📌</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Main GCPConsole ---
export default function GCPConsole({ systemState }: GCPConsoleProps) {
  const [activeSection, setActiveSection] = useState('gke')
  const [selectedDeploy, setSelectedDeploy] = useState<{ name: string; status: string; kind: 'service' | 'cache' | 'database'; extra?: Record<string, unknown> } | null>(null)
  const [scaleMap, setScaleMap] = useState<Record<string, ScaleEntry>>({})
  const [globalLogRange, setGlobalLogRange] = useState(15)
  const [globalFilter, setGlobalFilter] = useState<string | null>(null)
  const [pinnedGlobal, setPinnedGlobal] = useState<string[]>([])

  const dynamicServices = systemState ? Object.values(systemState.services) : []
  const caches = systemState?.infrastructure.caches ?? []
  const databases = systemState?.infrastructure.databases ?? []
  const clusters = systemState?.infrastructure.clusters ?? []
  const dynamicNames = new Set(dynamicServices.map(s => s.name))
  const allServices = [...dynamicServices, ...STATIC_SERVICES.filter(s => !dynamicNames.has(s.name))]

  // Default scale entry for a service
  function getScale(name: string, status: string): ScaleEntry {
    if (scaleMap[name]) return scaleMap[name]
    const def = status === 'down' ? 0 : status === 'degraded' ? 1 : 3
    return { desired: def, current: def, isScaling: false }
  }

  const handleScale = useCallback((name: string, targetReplicas: number) => {
    setScaleMap(prev => {
      const cur = prev[name] ?? { desired: 3, current: 3, isScaling: false }
      if (cur.desired === targetReplicas) return prev
      return { ...prev, [name]: { desired: targetReplicas, current: cur.current, isScaling: true } }
    })
    // Animate current toward desired
    const STEP_MS = 800
    const stepFn = (steps: number, direction: 'up' | 'down') => {
      let done = 0
      const iv = setInterval(() => {
        done++
        setScaleMap(prev => {
          const c = prev[name]
          if (!c) { clearInterval(iv); return prev }
          const next = direction === 'up' ? c.current + 1 : c.current - 1
          const reached = direction === 'up' ? next >= c.desired : next <= c.desired
          if (reached || done >= steps) {
            clearInterval(iv)
            return { ...prev, [name]: { ...c, current: c.desired, isScaling: false } }
          }
          return { ...prev, [name]: { ...c, current: next } }
        })
      }, STEP_MS)
    }
    setScaleMap(prev => {
      const c = prev[name]
      if (!c) return prev
      const diff = Math.abs(c.current - targetReplicas)
      const dir = targetReplicas > c.current ? 'up' : 'down'
      if (diff > 0) setTimeout(() => stepFn(diff, dir), 0)
      return prev
    })
  }, [])

  // Stable pod suffixes per service name
  const podSuffixes = useCallback((name: string) => (
    Array.from({ length: 5 }, (_, i) => {
      const seed = name.charCodeAt(0) * (i + 1) * 31
      const a = ((seed * 1103515245 + 12345) & 0x7fffffff).toString(36).slice(0, 5)
      const b = ((seed * 22695477 + 1) & 0x7fffffff).toString(36).slice(0, 4)
      return `${a}-${b}`
    })
  ), [])

  // Global logs
  const globalLogs = useMemo(() => {
    const all: { time: string; level: string; msg: string; svc: string }[] = []
    for (const svc of allServices.slice(0, 8)) {
      const logs = generateLogs(svc.name, svc.status, globalLogRange)
      all.push(...logs.map(l => ({ ...l, svc: svc.name })))
    }
    return all.sort((a, b) => a.time.localeCompare(b.time))
  }, [allServices, globalLogRange])

  const filteredGlobal = globalFilter ? globalLogs.filter(l => l.level === globalFilter) : globalLogs
  const displayedGlobal = [...pinnedGlobal.map(p => ({ time: '📌', level: 'ERROR', msg: p, svc: '' })), ...filteredGlobal.filter(l => !pinnedGlobal.includes(l.msg))]

  if (selectedDeploy) {
    const sc = getScale(selectedDeploy.name, selectedDeploy.status)
    return (
      <div className="flex flex-col h-full bg-[#202124] font-mono text-xs text-[#e8eaed] overflow-hidden">
        <DeployDetail
          name={selectedDeploy.name}
          status={selectedDeploy.status}
          kind={selectedDeploy.kind}
          extraData={selectedDeploy.extra}
          scale={sc}
          podSuffixes={podSuffixes(selectedDeploy.name)}
          onBack={() => setSelectedDeploy(null)}
          onScale={(n) => handleScale(selectedDeploy.name, n)}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-[#202124] font-mono text-xs text-[#e8eaed] overflow-hidden">
      {/* Left nav */}
      <div className="w-48 bg-[#292a2d] border-r border-[#3c4043] flex flex-col flex-shrink-0">
        <div className="px-3 py-2.5 border-b border-[#3c4043] flex items-center gap-2">
          <div className="w-5 h-5 rounded-sm flex items-center justify-center bg-white text-[10px] font-bold" style={{ color: '#4285F4' }}>G</div>
          <span className="text-[#e8eaed] text-[11px] font-medium">Google Cloud</span>
        </div>
        <div className="px-3 py-1.5 border-b border-[#3c4043]">
          <div className="text-[#9aa0a6] text-[10px] mb-0.5">Project</div>
          <div className="text-[#e8eaed] text-[11px] font-medium truncate">moniepoint-prod</div>
        </div>
        <nav className="flex-1 py-1 overflow-y-auto">
          {GCP_NAV.map(item => (
            <button key={item.id} onClick={() => setActiveSection(item.id)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-[11px] transition-colors ${activeSection === item.id ? 'bg-[#1a73e8]/20 text-[#8ab4f8]' : 'text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]'}`}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">

        {activeSection === 'gke' && (
          <div className="p-4 space-y-4">
            <div>
              <div className="text-[#e8eaed] text-sm font-medium mb-1">Kubernetes Engine — Workloads</div>
              <div className="text-[#9aa0a6] text-[10px] mb-3">Cluster: moniepoint-prod-gke · Region: us-central1</div>
            </div>
            {clusters.map(c => (
              <div key={c.name} className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                <div className="flex items-center justify-between mb-1"><span className="text-[#8ab4f8] font-medium">{c.name}</span><StatusChip status="RUNNING" /></div>
                <div className="text-[#9aa0a6] text-[10px]">Nodes: {c.healthy_nodes}/{c.nodes} healthy</div>
              </div>
            ))}
            <div>
              <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">Deployments ({allServices.length + caches.length}) — click row to manage</div>
              <div className="bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-[#1e1f22] border-b border-[#3c4043]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Name</th>
                      <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Namespace</th>
                      <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Pods</th>
                      <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allServices.map(svc => {
                      const sc = getScale(svc.name, svc.status)
                      const displayStatus = sc.isScaling ? (sc.desired < sc.current ? 'Terminating' : 'ContainerCreating') : svc.status
                      return (
                        <tr key={svc.name}
                          onClick={() => setSelectedDeploy({ name: svc.name, status: svc.status, kind: 'service', extra: { 'Error Rate': `${((svc.error_rate ?? 0) * 100).toFixed(1)}%`, 'p99 Latency': `${svc.p99_latency_ms}ms` } })}
                          className="border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/50 cursor-pointer">
                          <td className="px-3 py-2 text-[#8ab4f8]">{svc.name}</td>
                          <td className="px-3 py-2 text-[#9aa0a6]">default</td>
                          <td className="px-3 py-2 text-[#9aa0a6]">{sc.current}/{sc.desired}</td>
                          <td className="px-3 py-2"><StatusChip status={displayStatus} /></td>
                        </tr>
                      )
                    })}
                    {caches.map(c => {
                      const sc = getScale(c.name, c.status)
                      return (
                        <tr key={c.name}
                          onClick={() => setSelectedDeploy({ name: c.name, status: c.status, kind: 'cache', extra: { 'Hit Rate': `${(c.hit_rate * 100).toFixed(0)}%`, 'Memory': `${c.memory_used_mb}/${c.memory_total_mb} MB` } })}
                          className="border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/50 cursor-pointer">
                          <td className="px-3 py-2 text-[#8ab4f8]">{c.name}</td>
                          <td className="px-3 py-2 text-[#9aa0a6]">cache</td>
                          <td className="px-3 py-2 text-[#9aa0a6]">{sc.current}/{sc.desired}</td>
                          <td className="px-3 py-2"><StatusChip status={c.status} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'cloudsql' && (
          <div className="p-4 space-y-4">
            <div><div className="text-[#e8eaed] text-sm font-medium mb-1">Cloud SQL — Instances</div><div className="text-[#9aa0a6] text-[10px] mb-3">PostgreSQL 15 · Region: us-central1</div></div>
            {databases.map(db => (
              <div key={db.name}
                onClick={() => setSelectedDeploy({ name: db.name, status: db.status, kind: 'database', extra: { 'Connections': `${db.connection_count}/${db.max_connections}`, 'Query p99': db.query_latency_ms === 999999 ? '∞' : `${db.query_latency_ms}ms` } })}
                className="bg-[#292a2d] border border-[#3c4043] rounded p-3 mb-2 cursor-pointer hover:border-[#8ab4f8]/40">
                <div className="flex items-center justify-between mb-2"><span className="text-[#8ab4f8] font-medium">{db.name}</span><StatusChip status={db.status} /></div>
                <div className="grid grid-cols-3 gap-3 text-[10px]">
                  <div><div className="text-[#9aa0a6] mb-0.5">Active Connections</div><span className={`font-bold ${db.connection_count / db.max_connections > 0.85 ? 'text-[#f85149]' : 'text-[#e8eaed]'}`}>{db.connection_count} / {db.max_connections}</span></div>
                  <div><div className="text-[#9aa0a6] mb-0.5">Query p99</div><span className={`font-bold ${db.query_latency_ms > 2000 ? 'text-[#f85149]' : db.query_latency_ms > 500 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>{db.query_latency_ms === 999999 ? '∞' : `${db.query_latency_ms}ms`}</span></div>
                  <div><div className="text-[#9aa0a6] mb-0.5">Click to view →</div><span className="text-[#8ab4f8] text-[10px]">Logs · Events</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'logging' && (
          <div className="p-4 space-y-3">
            <div><div className="text-[#e8eaed] text-sm font-medium mb-1">Cloud Logging — Log Explorer</div><div className="text-[#9aa0a6] text-[10px] mb-3">Resource: GKE Container · Project: moniepoint-prod</div></div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[#9aa0a6] text-[10px]">Range:</span>
              {[5, 15, 30, 60].map(m => (
                <button key={m} onClick={() => setGlobalLogRange(m)} className={`px-2 py-0.5 rounded text-[10px] transition-colors ${globalLogRange === m ? 'bg-[#8ab4f8] text-[#202124] font-bold' : 'bg-[#292a2d] border border-[#3c4043] text-[#9aa0a6]'}`}>{m < 60 ? `${m}m` : '1h'}</button>
              ))}
              <span className="text-[#9aa0a6] text-[10px] ml-2">Filter:</span>
              {['INFO','DEBUG','WARN','ERROR','FATAL'].map(lvl => (
                <button key={lvl} onClick={() => setGlobalFilter(globalFilter === lvl ? null : lvl)}
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all ${globalFilter === lvl ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                  style={{ color: LEVEL_COLOR[lvl], borderColor: LEVEL_COLOR[lvl], backgroundColor: globalFilter === lvl ? `${LEVEL_COLOR[lvl]}22` : 'transparent' }}>{lvl}
                </button>
              ))}
              {pinnedGlobal.length > 0 && <button onClick={() => setPinnedGlobal([])} className="text-[9px] text-[#484f58] hover:text-[#f85149] ml-auto">clear {pinnedGlobal.length} pin(s)</button>}
            </div>
            <div className="bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[calc(100vh-240px)] overflow-y-auto">
              {displayedGlobal.map((l, i) => (
                <div key={i} className="flex gap-2 leading-relaxed group">
                  <span className="text-[#484f58] flex-shrink-0 w-16">{l.time}</span>
                  <span className="font-bold flex-shrink-0 w-10" style={{ color: LEVEL_COLOR[l.level] ?? '#6b7280' }}>{l.level}</span>
                  {l.svc && <span className="text-[#8ab4f8] flex-shrink-0 w-32 truncate">{l.svc}</span>}
                  <span className="text-[#e8eaed] break-all flex-1">{l.msg.replace(l.svc ? `[${l.svc}] ` : '', '')}</span>
                  {(l.level === 'ERROR' || l.level === 'FATAL') && l.time !== '📌' && (
                    <button onClick={() => setPinnedGlobal(p => p.includes(l.msg) ? p.filter(x => x !== l.msg) : [...p, l.msg])}
                      className="opacity-0 group-hover:opacity-100 text-[#484f58] hover:text-[#d29922] flex-shrink-0 transition-opacity" title="Pin error">📌</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'iam' && (
          <div className="p-4">
            <div className="text-[#e8eaed] text-sm font-medium mb-3">IAM &amp; Admin — Service Accounts</div>
            <div className="bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-[#1e1f22] border-b border-[#3c4043]"><tr>
                  <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Account</th>
                  <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Role</th>
                </tr></thead>
                <tbody>
                  {[['sre-oncall@moniepoint-prod.iam','roles/editor'],['gke-sa@moniepoint-prod.iam','roles/container.nodeServiceAccount'],['cloud-sql-sa@moniepoint-prod.iam','roles/cloudsql.client'],['monitoring-sa@moniepoint-prod.iam','roles/monitoring.viewer'],['ci-cd-sa@moniepoint-prod.iam','roles/storage.admin']].map(([acc,role],i)=>(
                    <tr key={i} className="border-b border-[#3c4043] last:border-0">
                      <td className="px-3 py-2 text-[#8ab4f8]">{acc}</td>
                      <td className="px-3 py-2 text-[#9aa0a6]">{role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
