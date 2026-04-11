import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { SystemState } from '../types'

interface GCPConsoleProps { systemState: SystemState | null; onScaleService?: (service: string, replicas: number) => void }

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
const LOG_MSGS: Record<string, string[]> = {
  INFO: [
    `GET /api/v1/health 200 OK 3ms`, `POST /api/v1/transactions 201 Created 18ms`,
    `Processed 847 events in batch`, `Cache hit ratio: 94.2%`,
    `DB connection pool: 12/100 active`, `Heartbeat OK — upstream services reachable`,
    `Metrics flushed to Prometheus endpoint`, `Config reload completed — 0 changes detected`,
    `JWT validated for user_id=usr_48291 (1ms)`, `GET /api/v2/accounts/bal 200 OK 7ms`,
    `Kafka consumer lag: 0 — partition 3 fully caught up`, `S3 presigned URL generated for upload_id=f9a2c`,
    `gRPC call to payment-processor:50051 OK (22ms)`, `Rate limit check: 840/1000 tokens used`,
    `Trace exported to Cloud Trace — spans=14`, `Serving request from cache: /feed 200 (0ms)`,
    `Session renewed for user_id=usr_77231 — TTL reset to 3600s`, `Health check /readyz returned 200 in 1ms`,
    `Distributed lock acquired: lock:checkout:ord_9123 (TTL=30s)`, `Batch job completed: 2048 records processed in 1.2s`,
    `Outgoing webhook delivered to partner_id=ptnr_442 — 200 OK`, `Feature flag 'new_checkout_flow' = true for user_id=usr_11029`,
    `Auto-scaling: 2→3 replicas triggered (CPU 72%)`, `Config value refreshed: payment.retry_limit = 3`,
  ],
  DEBUG: [
    `Entering handler: TransactionController.create`, `SQL query executed: SELECT * FROM accounts WHERE id=$1 [3ms]`,
    `Cache key lookup: session:usr_48291 → HIT`, `gRPC interceptor: req_id=74f2b9`,
    `Span started: checkout.process_payment`, `Rate limiter bucket: 850/1000 tokens remaining`,
    `Health check: /readyz returned 200 in 1ms`, `Middleware chain: auth → ratelimit → handler (total 4ms)`,
    `DB pool checkout: conn_id=84 leased (pool free: 88/100)`, `Serializing response: 1.2KB JSON`,
    `Cache write: key=user:profile:usr_48291 TTL=300s`, `Tracing: child span created span_id=9f3a2b`,
    `gRPC dial to redis-service:6379 established`, `Feature flag evaluated: rollout=22% → user in`,
    `Request ID assigned: req_id=a9f2c3d7`, `Unmarshalling body: 384 bytes`,
  ],
  WARN: [
    `Response time p99 exceeded 2000ms (got 3241ms)`, `DB connection pool at 71% capacity (71/100)`,
    `Redis cache miss rate elevated: 28%`, `Memory usage at 73%`,
    `Retry 2/3 for downstream call`, `Slow query detected (>500ms)`,
    `Goroutine count spike: 1820 (threshold: 1500)`, `Circuit breaker half-open — test request sent`,
    `Disk usage at 81% on /var/log`, `Consumer lag growing: partition 2 = 1420 msgs`,
    `Upstream latency high: payment-processor p99=1800ms`, `JWT expiry imminent — refresh token issued`,
    `gRPC deadline approaching: 400ms remaining`, `Retry exhausted — falling back to degraded response`,
    `Connection pool queue depth: 12 waiting`, `Slow GC pause: 140ms (threshold: 100ms)`,
    `TLS cert expiry in 14 days — renewal needed`, `Read replica lag: 480ms (threshold: 300ms)`,
  ],
  ERROR: [
    `upstream connect error or disconnect/reset before headers`, `context deadline exceeded after 5000ms`,
    `failed to acquire distributed lock after 3 retries`, `pq: deadlock detected — rolling back transaction`,
    `EOF on Redis connection — reconnecting`, `gRPC status UNAVAILABLE from payment-processor:50051`,
    `dial tcp: connection refused 10.0.0.5:5432`, `http: panic serving — recovered, 500 returned`,
    `failed to publish to Kafka topic=transactions: leader not available`, `Redis SETEX failed: READONLY — replica lag`,
    `SQL: ERROR 1213 (40001): Deadlock found`, `Webhook delivery failed (502): partner_id=ptnr_442`,
    `goroutine leak detected: 840 goroutines (threshold: 500)`, `OOM: runtime memory allocation failed`,
    `Cloud Storage upload failed: ServiceUnavailable — retry 3/3`, `Response body read error: unexpected EOF`,
  ],
  FATAL: [
    `panic: runtime error: nil pointer dereference`, `connection refused — localhost:5432`,
    `OOMKilled — container exceeded memory limit`, `failed to connect to Redis: connection refused`,
    `unrecoverable error in main goroutine — exiting`, `signal: killed — container OOM`,
    `failed to open DB connection after 5 attempts — shutting down`, `stack overflow in request handler — process dying`,
    `SIGTERM received — graceful shutdown failed after 30s`, `panic: concurrent map write detected`,
  ],
}

function pickLevel(status: string): string {
  const r = Math.random()
  if (status === 'down') return r < 0.45 ? 'FATAL' : r < 0.8 ? 'ERROR' : 'WARN'
  if (status === 'degraded') return r < 0.25 ? 'ERROR' : r < 0.5 ? 'WARN' : r < 0.72 ? 'INFO' : 'DEBUG'
  return r < 0.42 ? 'INFO' : r < 0.72 ? 'DEBUG' : r < 0.88 ? 'WARN' : r < 0.97 ? 'ERROR' : 'FATAL'
}

function generateSingleLog(service: string, status: string): { time: string; level: string; msg: string } {
  const level = pickLevel(status)
  const pool = LOG_MSGS[level] ?? LOG_MSGS.INFO
  return {
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    level,
    msg: `[${service}] ${pool[Math.floor(Math.random() * pool.length)]}`,
  }
}

function generateLogs(service: string, status: string, minutes: number): { time: string; level: string; msg: string }[] {
  const now = Date.now()
  const count = Math.min(minutes * 12, 200)
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(now - (count - i) * (minutes * 60000 / count))
    const level = pickLevel(status)
    const pool = LOG_MSGS[level] ?? LOG_MSGS.INFO
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

// --- Log histogram ---
interface HistogramProps { logs: { time: string; level: string }[] }
function LogHistogram({ logs }: HistogramProps) {
  const BUCKETS = 10
  const now = Date.now()
  // Build minute-buckets for last 10 minutes
  const buckets = Array.from({ length: BUCKETS }, (_, i) => {
    const bucketStart = now - (BUCKETS - i) * 60000
    const bucketEnd = bucketStart + 60000
    const label = new Date(bucketStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    let errors = 0, warns = 0, infos = 0
    for (const l of logs) {
      // Parse time HH:MM:SS back to ms (approximate, same day)
      const parts = l.time.split(':').map(Number)
      if (parts.length < 3) continue
      const d = new Date(); d.setHours(parts[0], parts[1], parts[2], 0)
      const t = d.getTime()
      if (t >= bucketStart && t < bucketEnd) {
        if (l.level === 'ERROR' || l.level === 'FATAL') errors++
        else if (l.level === 'WARN') warns++
        else infos++
      }
    }
    return { label, errors, warns, infos }
  })
  const maxVal = Math.max(1, ...buckets.map(b => b.errors + b.warns + b.infos))

  return (
    <div className="bg-[#1e1f22] border border-[#3c4043] rounded p-3 mb-3">
      <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">Log Volume — Last 10 min</div>
      <div className="flex items-end gap-1 h-16">
        {buckets.map((b, i) => {
          const total = b.errors + b.warns + b.infos
          const pct = total / maxVal
          const errPct = b.errors / Math.max(1, total)
          const warnPct = b.warns / Math.max(1, total)
          return (
            <div key={i} className="flex-1 flex flex-col justify-end items-stretch gap-0 group relative" title={`${b.label} — ${b.errors} errors, ${b.warns} warns, ${b.infos} info`}>
              <div style={{ height: `${pct * 52}px` }} className="flex flex-col justify-end overflow-hidden rounded-sm">
                <div style={{ height: `${errPct * 100}%` }} className="bg-[#f85149] min-h-[1px]" />
                <div style={{ height: `${warnPct * 100}%` }} className="bg-[#d29922] min-h-[1px]" />
                <div style={{ flex: 1 }} className="bg-[#3fb950]/40 min-h-[1px]" />
              </div>
              <div className="text-[8px] text-[#484f58] text-center mt-0.5 hidden group-hover:block absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">{b.label}</div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#f85149]"/><span className="text-[#9aa0a6] text-[9px]">error/fatal</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#d29922]"/><span className="text-[#9aa0a6] text-[9px]">warn</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#3fb950]/40"/><span className="text-[#9aa0a6] text-[9px]">info/debug</span></div>
      </div>
    </div>
  )
}

// --- Scale state ---
interface ScaleEntry { desired: number; current: number; isScaling: boolean }

// --- Pod detail (individual pod view) ---
interface PodViewProps { podName: string; status: string; svcStatus: string; onBack: () => void }
function PodView({ podName, status, svcStatus, onBack }: PodViewProps) {
  const [logRange, setLogRange] = useState(5)
  const [logFilter, setLogFilter] = useState<string | null>(null)
  const [pinned, setPinned] = useState<Set<number>>(new Set())
  const [streamedLogs, setStreamedLogs] = useState<{ time: string; level: string; msg: string }[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  const baseLogs = useMemo(() => generateLogs(podName, svcStatus, logRange), [podName, svcStatus, logRange])

  // Stream a new log line every 3s
  useEffect(() => {
    const iv = setInterval(() => {
      setStreamedLogs(prev => [...prev.slice(-200), generateSingleLog(podName, svcStatus)])
    }, 3000)
    return () => clearInterval(iv)
  }, [podName, svcStatus])

  // Auto-scroll to bottom as new logs arrive
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [streamedLogs])

  const allLogs = useMemo(() => [...baseLogs, ...streamedLogs], [baseLogs, streamedLogs])
  const filtered = logFilter ? allLogs.filter(l => l.level === logFilter) : allLogs
  const pinnedEntries = [...pinned].map(i => ({ ...allLogs[i], pinIdx: i }))
  const displayed = [
    ...pinnedEntries.map(e => ({ time: '📌', level: e.level, msg: e.msg, origIdx: e.pinIdx })),
    ...filtered.map((l, i) => ({ ...l, origIdx: i })).filter(l => !pinned.has(l.origIdx)),
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-[#3c4043] bg-[#292a2d] flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-[#8ab4f8] hover:text-[#e8eaed] text-[11px]">← Pod</button>
        <div className="flex-1 min-w-0">
          <div className="text-[#e8eaed] text-sm font-medium font-mono">{podName}</div>
          <div className="text-[#9aa0a6] text-[10px]">Container logs · <span className="text-[#3fb950]">● live</span></div>
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
          {pinned.size > 0 && <button onClick={() => setPinned(new Set())} className="text-[9px] text-[#484f58] hover:text-[#f85149] ml-auto">clear {pinned.size} pin(s)</button>}
        </div>
        <div className="bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[calc(100vh-200px)] overflow-y-auto">
          {displayed.map((l, i) => (
            <div key={i} className={`flex gap-2 leading-relaxed group ${l.time === '📌' ? 'bg-[#1a1400] border-l-2 border-[#d29922] pl-1' : ''}`}>
              <span className="text-[#484f58] flex-shrink-0 w-16">{l.time}</span>
              <span className="font-bold flex-shrink-0 w-10" style={{ color: LEVEL_COLOR[l.level] ?? '#6b7280' }}>{l.level}</span>
              <span className="text-[#e8eaed] break-all flex-1">{l.msg}</span>
              {l.time !== '📌' && (
                <button onClick={() => setPinned(p => { const n = new Set(p); n.has(l.origIdx) ? n.delete(l.origIdx) : n.add(l.origIdx); return n })}
                  className="opacity-0 group-hover:opacity-100 text-[#484f58] hover:text-[#d29922] flex-shrink-0 transition-opacity text-[11px]" title="Pin log line">📌</button>
              )}
            </div>
          ))}
          <div ref={logEndRef} />
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
  const [pinned, setPinned] = useState<Set<number>>(new Set())
  const [streamedLogs, setStreamedLogs] = useState<{ time: string; level: string; msg: string }[]>([])
  const [scaleInput, setScaleInput] = useState(String(scale.desired))
  const [selectedPodIdx, setSelectedPodIdx] = useState<number | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const baseLogs = useMemo(() => generateLogs(name, status, logRange), [name, status, logRange])

  useEffect(() => {
    if (tab !== 'logs') return
    const iv = setInterval(() => {
      setStreamedLogs(prev => [...prev.slice(-300), generateSingleLog(name, status)])
    }, 3000)
    return () => clearInterval(iv)
  }, [tab, name, status])

  useEffect(() => { if (tab === 'logs') logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [streamedLogs, tab])

  const allLogs = useMemo(() => [...baseLogs, ...streamedLogs], [baseLogs, streamedLogs])
  const filtered = logFilter ? allLogs.filter(l => l.level === logFilter) : allLogs
  const pinnedEntries = [...pinned].map(i => ({ ...allLogs[i], pinIdx: i }))
  const displayed = [
    ...pinnedEntries.map(e => ({ time: '📌', level: e.level, msg: e.msg, origIdx: e.pinIdx })),
    ...filtered.map((l, i) => ({ ...l, origIdx: i })).filter(l => !pinned.has(l.origIdx)),
  ]
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
              <span className="text-[#9aa0a6] text-[10px] ml-2">Filter:</span>
              {['INFO','DEBUG','WARN','ERROR','FATAL'].map(lvl => (
                <button key={lvl} onClick={() => setLogFilter(logFilter === lvl ? null : lvl)}
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all ${logFilter === lvl ? 'opacity-100 scale-105' : 'opacity-50 hover:opacity-80'}`}
                  style={{ color: LEVEL_COLOR[lvl], borderColor: LEVEL_COLOR[lvl], backgroundColor: logFilter === lvl ? `${LEVEL_COLOR[lvl]}22` : 'transparent' }}>{lvl}
                </button>
              ))}
              <span className="text-[#3fb950] text-[9px] ml-1">● live</span>
              {pinned.size > 0 && <button onClick={() => setPinned(new Set())} className="text-[9px] text-[#484f58] hover:text-[#f85149] ml-auto">clear {pinned.size} pin(s)</button>}
            </div>
            <div className="bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[400px] overflow-y-auto">
              {displayed.map((l, i) => (
                <div key={i} className={`flex gap-2 leading-relaxed group ${l.time === '📌' ? 'bg-[#1a1400] border-l-2 border-[#d29922] pl-1' : ''}`}>
                  <span className="text-[#484f58] flex-shrink-0 w-16">{l.time}</span>
                  <span className="font-bold flex-shrink-0 w-10" style={{ color: LEVEL_COLOR[l.level] ?? '#6b7280' }}>{l.level}</span>
                  <span className="text-[#e8eaed] break-all flex-1">{l.msg}</span>
                  {l.time !== '📌' && (
                    <button onClick={() => setPinned(p => { const n = new Set(p); n.has(l.origIdx) ? n.delete(l.origIdx) : n.add(l.origIdx); return n })}
                      className="opacity-0 group-hover:opacity-100 text-[#484f58] hover:text-[#d29922] flex-shrink-0 text-[11px] transition-opacity" title="Pin log line">📌</button>
                  )}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Cloud SQL Panel ---
const SQL_DBS: Record<string, string[]> = {
  'payments-db':  ['payments_db', 'audit_db', 'reporting_db'],
  'postgres-primary': ['payments_db', 'orders_db', 'users_db'],
  'user-db':      ['users_db', 'sessions_db'],
  'orders-db':    ['orders_db', 'inventory_db'],
}
const SLOW_QUERIES = [
  { query: 'SELECT * FROM transactions WHERE account_id = ? AND status = ?', avg: '2840ms', calls: 1423, rows: 84200, plan: 'Seq Scan (missing index)' },
  { query: 'UPDATE accounts SET balance = balance - ? WHERE id = ?', avg: '1200ms', calls: 8712, rows: 1, plan: 'Index Scan on accounts_pkey' },
  { query: 'SELECT COUNT(*) FROM payment_methods WHERE user_id IN (SELECT id FROM users WHERE ...)', avg: '3100ms', calls: 412, rows: 1, plan: 'Nested Loop / Hash Join' },
  { query: 'DELETE FROM sessions WHERE expires_at < NOW()', avg: '890ms', calls: 24, rows: 120400, plan: 'Seq Scan on sessions' },
  { query: 'SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 100', avg: '450ms', calls: 5623, rows: 100, plan: 'Sort + Seq Scan (no index on created_at)' },
]

function CloudSQLPanel({ databases }: { databases: { name: string; status: string; connection_count: number; max_connections: number; query_latency_ms: number }[] }) {
  const [selectedDb, setSelectedDb] = useState<string | null>(null)
  const [sqlTab, setSqlTab] = useState<'overview' | 'databases' | 'queryinsights' | 'systeminsights'>('overview')

  const db = databases.find(d => d.name === selectedDb) ?? databases[0] ?? null

  if (!db) return (
    <div className="p-4 text-[#9aa0a6] text-xs">No Cloud SQL instances found.</div>
  )

  const connPct = db.connection_count / db.max_connections
  const memUsedMb = db.status === 'down' ? 800 : db.status === 'degraded' ? 6800 : 3200
  const memTotalMb = 8192
  const memPct = memUsedMb / memTotalMb
  const diskUsedGb = db.status === 'degraded' ? 180 : 95
  const diskTotalGb = 500
  const cpuPct = db.status === 'down' ? 0 : db.status === 'degraded' ? 87 : 32

  return (
    <div className="flex flex-col h-full">
      {/* Instance selector */}
      <div className="px-4 pt-3 pb-0">
        <div className="text-[#e8eaed] text-sm font-medium mb-1">Cloud SQL — Instances</div>
        <div className="flex gap-2 mb-3 flex-wrap">
          {databases.map(d => (
            <button key={d.name} onClick={() => { setSelectedDb(d.name); setSqlTab('overview') }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors ${
                (selectedDb ?? databases[0]?.name) === d.name
                  ? 'bg-[#8ab4f8] text-[#202124] border-[#8ab4f8] font-bold'
                  : 'bg-[#292a2d] border-[#3c4043] text-[#9aa0a6] hover:border-[#8ab4f8]/40'
              }`}>
              <span className={`mr-1 ${d.status === 'down' ? 'text-[#f85149]' : d.status === 'degraded' ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>●</span>
              {d.name}
            </button>
          ))}
        </div>
        {/* Sub-tabs */}
        <div className="flex border-b border-[#3c4043] mb-0">
          {([['overview','Overview'],['databases','Databases'],['queryinsights','Query Insights'],['systeminsights','System Insights']] as const).map(([t, l]) => (
            <button key={t} onClick={() => setSqlTab(t)}
              className={`px-3 py-1.5 text-[10px] border-b-2 transition-colors -mb-px ${sqlTab === t ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-[#e8eaed]'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sqlTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {/* Connection pool */}
              <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2">Connections</div>
                <div className={`text-lg font-bold tabular-nums ${connPct > 0.85 ? 'text-[#f85149]' : connPct > 0.6 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
                  {db.connection_count} <span className="text-[#9aa0a6] text-xs font-normal">/ {db.max_connections}</span>
                </div>
                <div className="h-1.5 bg-[#3c4043] rounded mt-2 overflow-hidden">
                  <div className="h-full rounded transition-all" style={{ width: `${connPct * 100}%`, background: connPct > 0.85 ? '#f85149' : connPct > 0.6 ? '#d29922' : '#3fb950' }} />
                </div>
                <div className="text-[#9aa0a6] text-[9px] mt-1">{(connPct * 100).toFixed(0)}% utilization</div>
              </div>
              {/* Query latency */}
              <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2">Query p99 Latency</div>
                <div className={`text-lg font-bold tabular-nums ${db.query_latency_ms > 2000 ? 'text-[#f85149]' : db.query_latency_ms > 500 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
                  {db.query_latency_ms === 999999 ? '∞' : `${db.query_latency_ms}ms`}
                </div>
                <div className="text-[#9aa0a6] text-[9px] mt-1">p50: {Math.round(db.query_latency_ms * 0.4)}ms · p95: {Math.round(db.query_latency_ms * 0.85)}ms</div>
              </div>
              {/* Memory */}
              <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2">Memory</div>
                <div className={`text-lg font-bold tabular-nums ${memPct > 0.85 ? 'text-[#f85149]' : memPct > 0.7 ? 'text-[#d29922]' : 'text-[#e8eaed]'}`}>
                  {(memUsedMb / 1024).toFixed(1)} <span className="text-[#9aa0a6] text-xs font-normal">GB / {memTotalMb / 1024} GB</span>
                </div>
                <div className="h-1.5 bg-[#3c4043] rounded mt-2 overflow-hidden">
                  <div className="h-full rounded transition-all" style={{ width: `${memPct * 100}%`, background: memPct > 0.85 ? '#f85149' : memPct > 0.7 ? '#d29922' : '#8ab4f8' }} />
                </div>
                <div className="text-[#9aa0a6] text-[9px] mt-1">{(memPct * 100).toFixed(0)}% used</div>
              </div>
              {/* Disk */}
              <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2">Storage</div>
                <div className="text-lg font-bold tabular-nums text-[#e8eaed]">
                  {diskUsedGb} <span className="text-[#9aa0a6] text-xs font-normal">GB / {diskTotalGb} GB</span>
                </div>
                <div className="h-1.5 bg-[#3c4043] rounded mt-2 overflow-hidden">
                  <div className="h-full bg-[#8ab4f8] rounded" style={{ width: `${(diskUsedGb / diskTotalGb) * 100}%` }} />
                </div>
                <div className="text-[#9aa0a6] text-[9px] mt-1">{((diskUsedGb / diskTotalGb) * 100).toFixed(0)}% used · SSD</div>
              </div>
            </div>
            {/* Instance info */}
            <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3 text-[10px] space-y-1.5">
              <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2">Primary Instance</div>
              {[
                ['Instance ID', db.name],
                ['Database version', 'PostgreSQL 15.4'],
                ['Machine type', 'db-custom-4-8192'],
                ['Region', 'us-central1-c'],
                ['Public IP', 'Disabled'],
                ['Private IP', '10.128.0.5'],
                ['Maintenance window', 'Sunday 02:00 UTC'],
                ['Status', db.status.toUpperCase()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[#9aa0a6]">{k}</span>
                  <span className={`font-mono ${k === 'Status' ? (db.status === 'down' ? 'text-[#f85149]' : db.status === 'degraded' ? 'text-[#d29922]' : 'text-[#3fb950]') : 'text-[#e8eaed]'}`}>{v}</span>
                </div>
              ))}
            </div>
            {/* Read replica */}
            <div className="bg-[#1e1f22] border border-[#3c4043] rounded p-3 text-[10px] space-y-1.5 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest">Read Replica</div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${db.status === 'degraded' ? 'bg-[#d29922]/20 text-[#d29922]' : 'bg-[#3fb950]/10 text-[#3fb950]'}`}>
                  {db.status === 'degraded' ? 'REPLICATION LAG' : 'IN SYNC'}
                </span>
              </div>
              {[
                ['Instance ID', `${db.name}-replica`],
                ['Type', 'Read replica'],
                ['Region', 'us-central1-f'],
                ['Private IP', db.status === 'degraded' ? '10.128.0.43' : '10.128.0.22'],
                ['Replication lag', db.status === 'degraded' ? '480 ms ⚠' : '12 ms'],
                ['Status', db.status === 'down' ? 'STOPPED' : 'RUNNABLE'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[#9aa0a6]">{k}</span>
                  <span className={`font-mono ${
                    k === 'Status' && db.status === 'down' ? 'text-[#f85149]' :
                    k === 'Replication lag' && db.status === 'degraded' ? 'text-[#d29922]' :
                    'text-[#e8eaed]'
                  }`}>{v}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {sqlTab === 'databases' && (
          <div>
            <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-3">Databases in {db.name}</div>
            <div className="bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden">
              <table className="w-full text-[10px]">
                <thead className="bg-[#1e1f22] border-b border-[#3c4043]">
                  <tr>
                    <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Database</th>
                    <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Owner</th>
                    <th className="text-right px-3 py-2 text-[#9aa0a6] font-normal">Size</th>
                    <th className="text-right px-3 py-2 text-[#9aa0a6] font-normal">Tables</th>
                  </tr>
                </thead>
                <tbody>
                  {(SQL_DBS[db.name] ?? ['payments_db', 'audit_db']).map((dbName, i) => (
                    <tr key={i} className="border-b border-[#3c4043] last:border-0 hover:bg-[#1e1f22]">
                      <td className="px-3 py-2 text-[#8ab4f8] font-mono">{dbName}</td>
                      <td className="px-3 py-2 text-[#9aa0a6]">postgres</td>
                      <td className="px-3 py-2 text-right text-[#e8eaed]">{[24, 8, 3, 61, 14][i] ?? 5} GB</td>
                      <td className="px-3 py-2 text-right text-[#e8eaed]">{[42, 18, 7, 95, 23][i] ?? 12}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sqlTab === 'queryinsights' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest">Top Queries by Avg Latency</div>
              <span className={`text-[9px] font-bold ${db.status !== 'healthy' ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>
                {db.status !== 'healthy' ? '⚠ Slow queries detected' : '✓ Normal'}
              </span>
            </div>
            <div className="space-y-2">
              {SLOW_QUERIES.map((q, i) => (
                <div key={i} className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <code className="text-[#e8eaed] text-[9px] break-all flex-1">{q.query}</code>
                    <span className={`text-[9px] font-bold flex-shrink-0 ${parseFloat(q.avg) > 2000 ? 'text-[#f85149]' : parseFloat(q.avg) > 800 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>{q.avg}</span>
                  </div>
                  <div className="flex gap-4 text-[9px] text-[#9aa0a6]">
                    <span>Calls: <span className="text-[#e8eaed]">{q.calls.toLocaleString()}</span></span>
                    <span>Rows scanned: <span className="text-[#e8eaed]">{q.rows.toLocaleString()}</span></span>
                    <span className="text-[#d29922] flex-1 truncate">⚡ {q.plan}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sqlTab === 'systeminsights' && (
          <div className="space-y-4">
            {/* CPU chart */}
            <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
              <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-3">CPU Utilization (last 30m)</div>
              <svg viewBox="0 0 300 60" className="w-full" style={{ height: 60 }}>
                {(() => {
                  const vals = Array.from({ length: 30 }, (_, i) => {
                    const base = cpuPct
                    return Math.max(0, Math.min(100, base + Math.sin(i * 0.8) * 12 + (Math.random() * 8 - 4)))
                  })
                  const pts = vals.map((v, i) => `${(i / 29) * 300},${60 - (v / 100) * 56}`).join(' ')
                  return (
                    <>
                      <defs>
                        <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={cpuPct > 80 ? '#f85149' : '#8ab4f8'} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={cpuPct > 80 ? '#f85149' : '#8ab4f8'} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon points={`0,60 ${pts} 300,60`} fill="url(#cpuGrad)" />
                      <polyline points={pts} fill="none" stroke={cpuPct > 80 ? '#f85149' : '#8ab4f8'} strokeWidth="1.5" />
                    </>
                  )
                })()}
              </svg>
              <div className="flex justify-between text-[8px] text-[#484f58] mt-1">
                <span>-30m</span><span>-20m</span><span>-10m</span><span>now</span>
              </div>
              <div className="text-[#e8eaed] text-xs font-bold mt-1">{cpuPct}% <span className="text-[#9aa0a6] font-normal text-[9px]">avg</span></div>
            </div>
            {/* Memory chart */}
            <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
              <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-3">Memory Usage (last 30m)</div>
              <div className="space-y-1.5 text-[10px]">
                {[
                  { label: 'Total RAM', value: `${memTotalMb / 1024} GB`, bar: 100, color: '#3c4043' },
                  { label: 'Buffer Pool', value: `${((memUsedMb * 0.6) / 1024).toFixed(1)} GB`, bar: 60, color: '#8ab4f8' },
                  { label: 'OS Cache', value: `${((memUsedMb * 0.25) / 1024).toFixed(1)} GB`, bar: 25, color: '#3fb950' },
                  { label: 'WAL Buffers', value: `${((memUsedMb * 0.05) / 1024).toFixed(1)} GB`, bar: 5, color: '#d29922' },
                  { label: 'Free', value: `${((memTotalMb - memUsedMb) / 1024).toFixed(1)} GB`, bar: ((memTotalMb - memUsedMb) / memTotalMb) * 100, color: '#555' },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="text-[#9aa0a6] w-24 flex-shrink-0">{r.label}</span>
                    <div className="flex-1 h-2 bg-[#1e1f22] rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${r.bar}%`, background: r.color }} />
                    </div>
                    <span className="text-[#e8eaed] w-16 text-right">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* I/O */}
            <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
              <div className="text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2">I/O & Locks</div>
              <div className="grid grid-cols-3 gap-3 text-[10px]">
                {[
                  { label: 'Read IOPS', value: db.status === 'degraded' ? '4200' : '1100' },
                  { label: 'Write IOPS', value: db.status === 'degraded' ? '8800' : '2300' },
                  { label: 'Active Locks', value: db.status === 'degraded' ? '47' : '3' },
                ].map(m => (
                  <div key={m.label}>
                    <div className="text-[#9aa0a6] mb-0.5">{m.label}</div>
                    <span className={`font-bold ${parseInt(m.value) > 5000 || m.label === 'Active Locks' && parseInt(m.value) > 10 ? 'text-[#f85149]' : 'text-[#e8eaed]'}`}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Main GCPConsole ---
export default function GCPConsole({ systemState, onScaleService }: GCPConsoleProps) {
  const [activeSection, setActiveSection] = useState('gke')
  const [selectedDeploy, setSelectedDeploy] = useState<{ name: string; status: string; kind: 'service' | 'cache' | 'database'; extra?: Record<string, unknown> } | null>(null)
  const [scaleMap, setScaleMap] = useState<Record<string, ScaleEntry>>({})
  const [globalLogRange, setGlobalLogRange] = useState(15)
  const [globalFilter, setGlobalFilter] = useState<string | null>(null)

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
    // Immediately notify backend — system state updates in real time
    onScaleService?.(name, targetReplicas)

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
  }, [onScaleService])

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
  const [streamedGlobal, setStreamedGlobal] = useState<{ time: string; level: string; msg: string; svc: string }[]>([])
  const [pinnedGlobalIdx, setPinnedGlobalIdx] = useState<Set<number>>(new Set())
  const globalLogEndRef = useRef<HTMLDivElement>(null)

  const baseGlobalLogs = useMemo(() => {
    const all: { time: string; level: string; msg: string; svc: string }[] = []
    for (const svc of allServices.slice(0, 12)) {
      const logs = generateLogs(svc.name, svc.status, globalLogRange)
      all.push(...logs.map(l => ({ ...l, svc: svc.name })))
    }
    return all.sort((a, b) => a.time.localeCompare(b.time))
  }, [allServices, globalLogRange])

  // Stream new global log lines every 2s
  useEffect(() => {
    if (activeSection !== 'logging') return
    const svcList = allServices.slice(0, 12)
    const iv = setInterval(() => {
      const svc = svcList[Math.floor(Math.random() * svcList.length)]
      if (!svc) return
      setStreamedGlobal(prev => [...prev.slice(-500), { ...generateSingleLog(svc.name, svc.status), svc: svc.name }])
    }, 2000)
    return () => clearInterval(iv)
  }, [activeSection, allServices])

  // Auto-scroll global log to bottom
  useEffect(() => {
    if (activeSection === 'logging') globalLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamedGlobal, activeSection])

  const allGlobalLogs = useMemo(() => [...baseGlobalLogs, ...streamedGlobal], [baseGlobalLogs, streamedGlobal])
  const filteredGlobal = globalFilter ? allGlobalLogs.filter(l => l.level === globalFilter) : allGlobalLogs
  const pinnedGlobalEntries = [...pinnedGlobalIdx].map(i => ({ ...allGlobalLogs[i], pinIdx: i }))
  const displayedGlobal = [
    ...pinnedGlobalEntries.map(e => ({ time: '📌', level: e.level, msg: e.msg, svc: e.svc, origIdx: e.pinIdx })),
    ...filteredGlobal.map((l, i) => ({ ...l, origIdx: i })).filter(l => !pinnedGlobalIdx.has(l.origIdx)),
  ]

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
          <CloudSQLPanel databases={databases} />
        )}

        {activeSection === 'logging' && (
          <div className="p-4 space-y-3">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="text-[#e8eaed] text-sm font-medium">Cloud Logging — Log Explorer</div>
                <span className="text-[#3fb950] text-[10px]">● live streaming</span>
              </div>
              <div className="text-[#9aa0a6] text-[10px] mb-3">Resource: GKE Container · Project: moniepoint-prod · {allGlobalLogs.length} entries</div>
            </div>
            <LogHistogram logs={allGlobalLogs} />
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
              {pinnedGlobalIdx.size > 0 && <button onClick={() => setPinnedGlobalIdx(new Set())} className="text-[9px] text-[#484f58] hover:text-[#f85149] ml-auto">clear {pinnedGlobalIdx.size} pin(s)</button>}
            </div>
            <div className="bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[calc(100vh-240px)] overflow-y-auto">
              {displayedGlobal.map((l, i) => (
                <div key={i} className={`flex gap-2 leading-relaxed group ${l.time === '📌' ? 'bg-[#1a1400] border-l-2 border-[#d29922] pl-1' : ''}`}>
                  <span className="text-[#484f58] flex-shrink-0 w-16">{l.time}</span>
                  <span className="font-bold flex-shrink-0 w-10" style={{ color: LEVEL_COLOR[l.level] ?? '#6b7280' }}>{l.level}</span>
                  {l.svc && <span className="text-[#8ab4f8] flex-shrink-0 w-28 truncate">{l.svc}</span>}
                  <span className="text-[#e8eaed] break-all flex-1">{l.msg.replace(l.svc ? `[${l.svc}] ` : '', '')}</span>
                  {l.time !== '📌' && (
                    <button onClick={() => setPinnedGlobalIdx(p => { const n = new Set(p); n.has(l.origIdx) ? n.delete(l.origIdx) : n.add(l.origIdx); return n })}
                      className="opacity-0 group-hover:opacity-100 text-[#484f58] hover:text-[#d29922] flex-shrink-0 transition-opacity text-[11px]" title="Pin log line">📌</button>
                  )}
                </div>
              ))}
              <div ref={globalLogEndRef} />
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
