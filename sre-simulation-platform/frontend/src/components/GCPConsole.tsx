import { useState, useMemo, useCallback } from 'react'
import { SystemState } from '../types'

interface GCPConsoleProps {
  systemState: SystemState | null
  onExpand?: () => void
  expanded?: boolean
}

const GCP_NAV = [
  { id: 'gke', icon: '☸', label: 'Kubernetes Engine' },
  { id: 'cloudsql', icon: '🗄', label: 'Cloud SQL' },
  { id: 'logging', icon: '📋', label: 'Cloud Logging' },
  { id: 'iam', icon: '🔑', label: 'IAM & Admin' },
]

// Extra static microservices that always appear (non-incident related)
const STATIC_SERVICES = [
  { name: 'api-gateway', status: 'healthy', error_rate: 0.001, p99_latency_ms: 8 },
  { name: 'auth-service', status: 'healthy', error_rate: 0.002, p99_latency_ms: 12 },
  { name: 'user-service', status: 'healthy', error_rate: 0.001, p99_latency_ms: 15 },
  { name: 'notification-service', status: 'healthy', error_rate: 0.003, p99_latency_ms: 22 },
  { name: 'fraud-detection', status: 'healthy', error_rate: 0.001, p99_latency_ms: 45 },
  { name: 'order-service', status: 'healthy', error_rate: 0.002, p99_latency_ms: 18 },
  { name: 'inventory-service', status: 'healthy', error_rate: 0.001, p99_latency_ms: 11 },
  { name: 'analytics-service', status: 'healthy', error_rate: 0.004, p99_latency_ms: 35 },
  { name: 'kyc-service', status: 'healthy', error_rate: 0.001, p99_latency_ms: 28 },
  { name: 'config-service', status: 'healthy', error_rate: 0.0, p99_latency_ms: 4 },
]

function StatusChip({ status }: { status: string }) {
  const c =
    status === 'RUNNING' || status === 'healthy' || status === 'Running'
      ? 'bg-[#0f2a1a] text-[#3fb950] border-[#3fb950]'
      : status === 'ERROR' || status === 'down' || status === 'CrashLoopBackOff'
      ? 'bg-[#2a0a0a] text-[#f85149] border-[#f85149]'
      : status === 'Terminating'
      ? 'bg-[#2a1e00] text-[#d29922] border-[#d29922]'
      : 'bg-[#2a1e00] text-[#d29922] border-[#d29922]'
  const label =
    status === 'healthy' ? 'RUNNING'
    : status === 'down' ? 'ERROR'
    : status === 'degraded' ? 'DEGRADED'
    : status.toUpperCase()
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${c}`}>{label}</span>
}

// Diverse log generation: INFO/DEBUG/WARN/ERROR/FATAL mix
function generateLogs(service: string, status: string, minutes: number): { time: string; level: string; msg: string }[] {
  const now = Date.now()
  const count = Math.min(minutes * 5, 80)

  const allMessages: Record<string, string[]> = {
    INFO: [
      `GET /api/v1/health 200 OK 3ms`,
      `POST /api/v1/transactions 201 Created 18ms`,
      `GET /api/v1/accounts 200 OK 12ms`,
      `Processed 847 events in batch`,
      `Cache hit ratio: 94.2%`,
      `DB connection pool: 12/100 active`,
      `Heartbeat OK — upstream services reachable`,
      `Metrics flushed to Prometheus endpoint`,
      `Config reload completed — 0 changes detected`,
      `gRPC dial to downstream service: OK (14ms)`,
      `Scheduled job completed: cleanup_expired_tokens`,
      `JWT validated for user_id=usr_48291 (1ms)`,
      `Feature flag evaluation: dark_launch_v2=false`,
    ],
    DEBUG: [
      `Entering handler: TransactionController.create`,
      `SQL query executed: SELECT * FROM accounts WHERE id=$1 [3ms]`,
      `Cache key lookup: session:usr_48291 → HIT`,
      `gRPC interceptor: req_id=74f2b9 method=/svc.PaymentService/Process`,
      `Retry attempt 1/3 for idempotency key idem_0293ba`,
      `Span started: checkout.process_payment trace_id=a3f8e1`,
      `Unmarshalling JSON payload: 1024 bytes`,
      `Rate limiter bucket: 850/1000 tokens remaining`,
      `Goroutine pool: 14/200 workers active`,
      `Health check: /readyz returned 200 in 1ms`,
    ],
    WARN: [
      `Response time p99 exceeded 2000ms threshold (got 3241ms)`,
      `DB connection pool at 71% capacity (71/100)`,
      `Redis cache miss rate elevated: 28%`,
      `Memory usage at 73% — approaching limit`,
      `Retry 2/3 for downstream call to payment-processor`,
      `Slow query detected (>500ms): SELECT * FROM transactions WHERE created_at > $1`,
      `Circuit breaker half-open — testing upstream availability`,
      `TLS certificate expires in 14 days`,
      `Goroutine count spike: 1820 (threshold: 1500)`,
      `Config value missing: BATCH_SIZE, using default 100`,
    ],
    ERROR: [
      `upstream connect error or disconnect/reset before headers`,
      `context deadline exceeded after 5000ms`,
      `failed to acquire distributed lock after 3 retries`,
      `rate limit exceeded for downstream service: 429 Too Many Requests`,
      `pq: deadlock detected — rolling back transaction`,
      `EOF on Redis connection — reconnecting`,
      `failed to unmarshal response: unexpected token`,
      `gRPC status UNAVAILABLE from payment-processor:50051`,
      `HTTP 503 from fraud-detection — fallback activated`,
    ],
    FATAL: [
      `panic: runtime error: invalid memory address or nil pointer dereference`,
      `connection refused — localhost:5432`,
      `Failed to start server: address already in use`,
      `OOMKilled — container exceeded memory limit`,
      `failed to connect to Redis: connection refused`,
      `CrashLoopBackOff — restarting container (12 restarts)`,
      `unrecoverable error in main goroutine — exiting`,
    ],
  }

  const lines: { time: string; level: string; msg: string }[] = []

  for (let i = count; i >= 0; i--) {
    const t = new Date(now - i * (minutes * 60000 / count))

    let level: string
    if (status === 'down') {
      const r = Math.random()
      level = r < 0.5 ? 'FATAL' : r < 0.8 ? 'ERROR' : 'WARN'
    } else if (status === 'degraded') {
      const r = Math.random()
      level = r < 0.3 ? 'ERROR' : r < 0.5 ? 'WARN' : r < 0.65 ? 'INFO' : r < 0.8 ? 'DEBUG' : 'WARN'
    } else {
      const r = Math.random()
      level = r < 0.45 ? 'INFO' : r < 0.75 ? 'DEBUG' : r < 0.88 ? 'WARN' : 'ERROR'
    }

    const msgs = allMessages[level] ?? allMessages.INFO
    lines.push({
      time: t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level,
      msg: `[${service}] ` + msgs[Math.floor(Math.random() * msgs.length)],
    })
  }
  return lines
}

function generateEvents(svcName: string, status: string): { time: string; type: string; reason: string; msg: string }[] {
  const now = Date.now()
  const events = []
  if (status === 'down') {
    events.push({ time: new Date(now - 300000).toLocaleTimeString(), type: 'Warning', reason: 'BackOff', msg: `Back-off restarting failed container ${svcName}` })
    events.push({ time: new Date(now - 600000).toLocaleTimeString(), type: 'Warning', reason: 'OOMKilling', msg: `Container ${svcName} exceeded memory limit (512Mi)` })
    events.push({ time: new Date(now - 720000).toLocaleTimeString(), type: 'Warning', reason: 'Failed', msg: `Failed to pull image: ImagePullBackOff` })
    events.push({ time: new Date(now - 900000).toLocaleTimeString(), type: 'Warning', reason: 'Killing', msg: `Stopping container ${svcName} due to liveness probe failure` })
  } else if (status === 'degraded') {
    events.push({ time: new Date(now - 120000).toLocaleTimeString(), type: 'Warning', reason: 'Unhealthy', msg: `Liveness probe failed: HTTP probe failed with statuscode: 503` })
    events.push({ time: new Date(now - 240000).toLocaleTimeString(), type: 'Warning', reason: 'Unhealthy', msg: `Readiness probe failed: Get "http://...": context deadline exceeded` })
    events.push({ time: new Date(now - 360000).toLocaleTimeString(), type: 'Normal', reason: 'Pulled', msg: `Successfully pulled image (previous restart)` })
  } else {
    events.push({ time: new Date(now - 3600000).toLocaleTimeString(), type: 'Normal', reason: 'Pulled', msg: `Successfully pulled image gcr.io/moniepoint-prod/${svcName}:latest` })
    events.push({ time: new Date(now - 3540000).toLocaleTimeString(), type: 'Normal', reason: 'Started', msg: `Started container ${svcName}` })
    events.push({ time: new Date(now - 3480000).toLocaleTimeString(), type: 'Normal', reason: 'Scheduled', msg: `Successfully assigned pod to node gke-node-pool-abc123` })
  }
  return events
}

interface ScaleState { status: 'Terminating' | 'CrashLoopBackOff'; restartCount: number }

interface PodDetailProps {
  name: string
  status: string
  kind: 'service' | 'cache' | 'database'
  extraData?: Record<string, unknown>
  scaleState?: ScaleState
  onBack: () => void
  onScaleDown: () => void
}

function PodDetail({ name, status, kind, extraData, scaleState, onBack, onScaleDown }: PodDetailProps) {
  const [tab, setTab] = useState<'overview' | 'observability' | 'events' | 'logs'>('overview')
  const [logRange, setLogRange] = useState(5)
  const effectiveStatus = scaleState ? scaleState.status : status
  const logs = useMemo(() => generateLogs(name, effectiveStatus === 'CrashLoopBackOff' ? 'down' : effectiveStatus, logRange), [name, effectiveStatus, logRange])
  const events = useMemo(() => generateEvents(name, effectiveStatus === 'CrashLoopBackOff' ? 'down' : effectiveStatus), [name, effectiveStatus])

  const pods = effectiveStatus === 'CrashLoopBackOff' || effectiveStatus === 'down' ? 0
    : effectiveStatus === 'Terminating' || status === 'degraded' ? 1 : 3
  const cpuReq = kind === 'service' ? '250m' : '100m'
  const memReq = kind === 'service' ? '512Mi' : '256Mi'

  const levelColor: Record<string, string> = {
    INFO: '#6b7280', DEBUG: '#484f58', WARN: '#d29922', ERROR: '#f85149', FATAL: '#f85149',
  }

  // Stable pod name suffixes
  const podSuffixes = useMemo(() => (
    Array.from({ length: 3 }, (_, i) => {
      const seed = name.charCodeAt(0) * (i + 1) * 31
      const a = ((seed * 1103515245 + 12345) & 0x7fffffff).toString(36).slice(0, 5)
      const b = ((seed * 22695477 + 1) & 0x7fffffff).toString(36).slice(0, 4)
      return `${a}-${b}`
    })
  ), [name])

  return (
    <div className="flex flex-col h-full">
      {/* Back + header */}
      <div className="px-4 py-2 border-b border-[#3c4043] bg-[#292a2d] flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-[#8ab4f8] hover:text-[#e8eaed] text-[11px] transition-colors">← Back</button>
        <div className="flex-1 min-w-0">
          <div className="text-[#e8eaed] text-sm font-medium">{name}</div>
          <div className="text-[#9aa0a6] text-[10px]">Namespace: default · Kind: Deployment</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={effectiveStatus} />
          {!scaleState && (
            <button
              onClick={onScaleDown}
              className="text-[10px] px-2 py-0.5 rounded border border-[#f85149]/50 text-[#f85149] hover:bg-[#2a0a0a] transition-colors"
            >
              ↓ Scale Down
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#3c4043] bg-[#292a2d] flex-shrink-0">
        {(['overview', 'observability', 'events', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-[11px] capitalize border-b-2 transition-colors ${
              tab === t ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-[#e8eaed]'
            }`}>{t}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'overview' && (
          <div className="space-y-3 text-[11px]">
            {scaleState && (
              <div className={`border rounded p-3 text-[11px] ${
                scaleState.status === 'CrashLoopBackOff'
                  ? 'border-[#f85149]/50 bg-[#2a0a0a]'
                  : 'border-[#d29922]/50 bg-[#2a1e00]'
              }`}>
                <div className={`font-bold mb-1 ${scaleState.status === 'CrashLoopBackOff' ? 'text-[#f85149]' : 'text-[#d29922]'}`}>
                  ⚠ {scaleState.status === 'Terminating' ? 'Pod is terminating…' : `CrashLoopBackOff — Restarts: ${scaleState.restartCount}`}
                </div>
                <div className="text-[#9aa0a6]">
                  {scaleState.status === 'Terminating'
                    ? 'Container is shutting down gracefully. Pod will restart after termination period.'
                    : 'Container is crash-looping. Check logs and events for the root cause.'}
                </div>
              </div>
            )}
            <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
              <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">Deployment Info</div>
              <div className="grid grid-cols-2 gap-y-2">
                {[
                  ['Replicas', `${pods}/3`],
                  ['Strategy', 'RollingUpdate'],
                  ['CPU Request', cpuReq],
                  ['Memory Request', memReq],
                  ['Namespace', 'default'],
                  ['Cluster', 'moniepoint-prod-gke'],
                  ...(scaleState ? [['Restart Count', String(scaleState.restartCount)]] : []),
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[#9aa0a6] text-[10px]">{k}</div>
                    <div className={`font-medium ${k === 'Restart Count' && Number(v) > 0 ? 'text-[#f85149]' : 'text-[#e8eaed]'}`}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden">
              <div className="px-3 py-1.5 bg-[#1e1f22] border-b border-[#3c4043] text-[#9aa0a6] text-[10px] uppercase tracking-widest">Pods</div>
              {podSuffixes.map((suffix, i) => {
                const running = i < pods
                const podStatus = scaleState
                  ? (scaleState.status === 'Terminating' && i === 0 ? 'Terminating' : scaleState.status === 'CrashLoopBackOff' ? 'CrashLoopBackOff' : 'Running')
                  : (running ? 'Running' : 'Error')
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-[#3c4043] last:border-0">
                    <span className="text-[#8ab4f8]">{name}-{suffix}</span>
                    <div className="flex items-center gap-2">
                      {scaleState && <span className="text-[#484f58] text-[10px]">restarts: {scaleState.restartCount}</span>}
                      <StatusChip status={podStatus} />
                    </div>
                  </div>
                )
              })}
            </div>

            {extraData && (
              <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">Service Details</div>
                <div className="grid grid-cols-2 gap-y-2">
                  {Object.entries(extraData).map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[#9aa0a6] text-[10px]">{k}</div>
                      <div className="text-[#e8eaed] font-medium">{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'observability' && (
          <div className="space-y-3 text-[11px]">
            <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">CPU &amp; Memory — Last 30 minutes</div>
            {Array.from({ length: pods || 1 }, (_, i) => {
              const cpu = effectiveStatus === 'down' || effectiveStatus === 'CrashLoopBackOff' ? 0
                : effectiveStatus === 'degraded' ? 78 + i * 5 : 22 + i * 8
              const mem = effectiveStatus === 'down' || effectiveStatus === 'CrashLoopBackOff' ? 0
                : effectiveStatus === 'degraded' ? 81 + i * 3 : 35 + i * 10
              const cpuColor = cpu > 80 ? '#f85149' : cpu > 60 ? '#d29922' : '#3fb950'
              const memColor = mem > 85 ? '#f85149' : mem > 70 ? '#d29922' : '#3fb950'
              return (
                <div key={i} className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                  <div className="text-[#8ab4f8] mb-2">Pod {i + 1}</div>
                  <div className="space-y-2">
                    {[['CPU Usage', cpu, cpuColor], ['Memory Usage', mem, memColor]].map(([label, val, color]) => (
                      <div key={String(label)}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-[#9aa0a6]">{label}</span>
                          <span style={{ color: String(color) }} className="font-bold">{val}%</span>
                        </div>
                        <div className="w-full bg-[#1e1f22] rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${val}%`, backgroundColor: String(color) }} />
                        </div>
                      </div>
                    ))}
                  </div>
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
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[#9aa0a6] text-[10px]">Time range:</span>
              {[1, 5, 15, 30, 60].map(m => (
                <button key={m} onClick={() => setLogRange(m)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    logRange === m ? 'bg-[#8ab4f8] text-[#202124] font-bold' : 'bg-[#292a2d] border border-[#3c4043] text-[#9aa0a6] hover:text-[#e8eaed]'
                  }`}>{m < 60 ? `${m}m` : '1h'}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                {['INFO','DEBUG','WARN','ERROR','FATAL'].map(lvl => (
                  <span key={lvl} className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ color: levelColor[lvl] ?? '#9aa0a6', border: `1px solid ${levelColor[lvl] ?? '#3c4043'}` }}>{lvl}</span>
                ))}
              </div>
            </div>
            <div className="bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[400px] overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-2 leading-relaxed">
                  <span className="text-[#484f58] flex-shrink-0">{l.time}</span>
                  <span className="font-bold flex-shrink-0 w-10" style={{ color: levelColor[l.level] ?? '#6b7280' }}>{l.level}</span>
                  <span className="text-[#e8eaed] break-all">{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const levelColor: Record<string, string> = {
  INFO: '#6b7280', DEBUG: '#484f58', WARN: '#d29922', ERROR: '#f85149', FATAL: '#f85149',
}

export default function GCPConsole({ systemState }: GCPConsoleProps) {
  const [activeSection, setActiveSection] = useState('gke')
  const [selectedPod, setSelectedPod] = useState<{ name: string; status: string; kind: 'service' | 'cache' | 'database'; extra?: Record<string, unknown> } | null>(null)
  const [scaledDown, setScaledDown] = useState<Record<string, ScaleState>>({})
  const [globalLogRange, setGlobalLogRange] = useState(15)

  const dynamicServices = systemState ? Object.values(systemState.services) : []
  const caches = systemState?.infrastructure.caches ?? []
  const databases = systemState?.infrastructure.databases ?? []
  const clusters = systemState?.infrastructure.clusters ?? []

  // Merge dynamic + static services, dynamic wins on name conflict
  const dynamicNames = new Set(dynamicServices.map(s => s.name))
  const allServices = [
    ...dynamicServices,
    ...STATIC_SERVICES.filter(s => !dynamicNames.has(s.name)),
  ]

  const handleScaleDown = useCallback((name: string) => {
    setScaledDown(prev => ({ ...prev, [name]: { status: 'Terminating', restartCount: 0 } }))
    // After 2s go to CrashLoopBackOff
    setTimeout(() => {
      setScaledDown(prev => {
        const cur = prev[name]
        if (!cur) return prev
        return { ...prev, [name]: { status: 'CrashLoopBackOff', restartCount: 1 } }
      })
      // Increment restarts
      let count = 1
      const iv = setInterval(() => {
        count++
        setScaledDown(prev => {
          const cur = prev[name]
          if (!cur || cur.status !== 'CrashLoopBackOff') { clearInterval(iv); return prev }
          if (count >= 8) { clearInterval(iv) }
          return { ...prev, [name]: { ...cur, restartCount: count } }
        })
        if (count >= 8) clearInterval(iv)
      }, 3000)
    }, 2000)
  }, [])

  // Global log stream for Cloud Logging section
  const globalLogs = useMemo(() => {
    const all: { time: string; level: string; msg: string; svc: string }[] = []
    for (const svc of allServices.slice(0, 8)) {
      const svcStatus = scaledDown[svc.name]?.status === 'CrashLoopBackOff' ? 'down'
        : scaledDown[svc.name]?.status === 'Terminating' ? 'degraded'
        : svc.status
      const logs = generateLogs(svc.name, svcStatus, globalLogRange)
      all.push(...logs.map(l => ({ ...l, svc: svc.name })))
    }
    return all.sort((a, b) => a.time.localeCompare(b.time))
  }, [allServices, scaledDown, globalLogRange])

  if (selectedPod) {
    return (
      <div className="flex flex-col h-full bg-[#202124] font-mono text-xs text-[#e8eaed] overflow-hidden">
        <PodDetail
          name={selectedPod.name}
          status={selectedPod.status}
          kind={selectedPod.kind}
          extraData={selectedPod.extra}
          scaleState={scaledDown[selectedPod.name]}
          onBack={() => setSelectedPod(null)}
          onScaleDown={() => handleScaleDown(selectedPod.name)}
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
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-[11px] transition-colors ${
                activeSection === item.id ? 'bg-[#1a73e8]/20 text-[#8ab4f8]' : 'text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]'
              }`}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">

        {/* GKE Workloads */}
        {activeSection === 'gke' && (
          <div className="p-4 space-y-4">
            <div>
              <div className="text-[#e8eaed] text-sm font-medium mb-1">Kubernetes Engine — Workloads</div>
              <div className="text-[#9aa0a6] text-[10px] mb-3">Cluster: moniepoint-prod-gke · Region: us-central1</div>
            </div>

            {clusters.map(c => (
              <div key={c.name} className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#8ab4f8] font-medium">{c.name}</span>
                  <StatusChip status="RUNNING" />
                </div>
                <div className="text-[#9aa0a6] text-[10px]">Nodes: {c.healthy_nodes}/{c.nodes} healthy</div>
              </div>
            ))}

            <div>
              <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">
                Deployments ({allServices.length + caches.length}) — click a row to view details
              </div>
              <div className="bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-[#1e1f22] border-b border-[#3c4043]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Name</th>
                      <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Namespace</th>
                      <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Pods</th>
                      <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Restarts</th>
                      <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allServices.map(svc => {
                      const sc = scaledDown[svc.name]
                      const displayStatus = sc ? sc.status : svc.status
                      const pods = sc ? 0 : svc.status === 'down' ? '0/3' : svc.status === 'degraded' ? '1/3' : '3/3'
                      const restarts = sc?.restartCount ?? 0
                      return (
                        <tr key={svc.name}
                          onClick={() => setSelectedPod({ name: svc.name, status: svc.status, kind: 'service', extra: { 'Error Rate': `${((svc.error_rate ?? 0) * 100).toFixed(1)}%`, 'p99 Latency': `${svc.p99_latency_ms}ms` } })}
                          className="border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/50 cursor-pointer">
                          <td className="px-3 py-2 text-[#8ab4f8]">{svc.name}</td>
                          <td className="px-3 py-2 text-[#9aa0a6]">default</td>
                          <td className="px-3 py-2 text-[#9aa0a6]">{sc ? '0/3' : pods}</td>
                          <td className="px-3 py-2">
                            {restarts > 0
                              ? <span className="text-[#f85149] font-bold">{restarts}</span>
                              : <span className="text-[#484f58]">0</span>}
                          </td>
                          <td className="px-3 py-2"><StatusChip status={displayStatus} /></td>
                        </tr>
                      )
                    })}
                    {caches.map(c => {
                      const sc = scaledDown[c.name]
                      const displayStatus = sc ? sc.status : c.status
                      return (
                        <tr key={c.name}
                          onClick={() => setSelectedPod({ name: c.name, status: c.status, kind: 'cache', extra: { 'Hit Rate': `${(c.hit_rate * 100).toFixed(0)}%`, 'Memory': `${c.memory_used_mb}/${c.memory_total_mb} MB` } })}
                          className="border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/50 cursor-pointer">
                          <td className="px-3 py-2 text-[#8ab4f8]">{c.name}</td>
                          <td className="px-3 py-2 text-[#9aa0a6]">cache</td>
                          <td className="px-3 py-2 text-[#9aa0a6]">{sc ? '0/1' : c.status === 'down' ? '0/1' : '1/1'}</td>
                          <td className="px-3 py-2">
                            {(sc?.restartCount ?? 0) > 0
                              ? <span className="text-[#f85149] font-bold">{sc!.restartCount}</span>
                              : <span className="text-[#484f58]">0</span>}
                          </td>
                          <td className="px-3 py-2"><StatusChip status={displayStatus} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Cloud SQL */}
        {activeSection === 'cloudsql' && (
          <div className="p-4 space-y-4">
            <div>
              <div className="text-[#e8eaed] text-sm font-medium mb-1">Cloud SQL — Instances</div>
              <div className="text-[#9aa0a6] text-[10px] mb-3">PostgreSQL 15 · Region: us-central1</div>
            </div>
            {databases.map(db => (
              <div key={db.name}
                onClick={() => setSelectedPod({ name: db.name, status: db.status, kind: 'database', extra: { 'Connections': `${db.connection_count}/${db.max_connections}`, 'Query p99': db.query_latency_ms === 999999 ? '∞' : `${db.query_latency_ms}ms`, 'Instance Type': 'db-n1-standard-4' } })}
                className="bg-[#292a2d] border border-[#3c4043] rounded p-3 mb-2 cursor-pointer hover:border-[#8ab4f8]/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#8ab4f8] font-medium">{db.name}</span>
                  <StatusChip status={db.status} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-[10px]">
                  <div>
                    <div className="text-[#9aa0a6] mb-0.5">Active Connections</div>
                    <span className={`font-bold ${db.connection_count / db.max_connections > 0.85 ? 'text-[#f85149]' : 'text-[#e8eaed]'}`}>
                      {db.connection_count} / {db.max_connections}
                    </span>
                  </div>
                  <div>
                    <div className="text-[#9aa0a6] mb-0.5">Query p99</div>
                    <span className={`font-bold ${db.query_latency_ms > 2000 ? 'text-[#f85149]' : db.query_latency_ms > 500 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
                      {db.query_latency_ms === 999999 ? '∞' : `${db.query_latency_ms}ms`}
                    </span>
                  </div>
                  <div>
                    <div className="text-[#9aa0a6] mb-0.5">Click to view →</div>
                    <span className="text-[#8ab4f8] text-[10px]">Logs · Events</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cloud Logging */}
        {activeSection === 'logging' && (
          <div className="p-4 space-y-3">
            <div>
              <div className="text-[#e8eaed] text-sm font-medium mb-1">Cloud Logging — Log Explorer</div>
              <div className="text-[#9aa0a6] text-[10px] mb-3">Resource: GKE Container · Project: moniepoint-prod</div>
            </div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[#9aa0a6] text-[10px]">Time range:</span>
              {[5, 15, 30, 60].map(m => (
                <button key={m} onClick={() => setGlobalLogRange(m)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    globalLogRange === m ? 'bg-[#8ab4f8] text-[#202124] font-bold' : 'bg-[#292a2d] border border-[#3c4043] text-[#9aa0a6] hover:text-[#e8eaed]'
                  }`}>{m < 60 ? `${m}m` : '1h'}
                </button>
              ))}
              <div className="ml-auto flex gap-1.5 flex-wrap">
                {['INFO','DEBUG','WARN','ERROR','FATAL'].map(lvl => (
                  <span key={lvl} className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ color: levelColor[lvl], border: `1px solid ${levelColor[lvl]}` }}>{lvl}</span>
                ))}
              </div>
            </div>
            <div className="bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[calc(100vh-240px)] overflow-y-auto">
              {globalLogs.map((l, i) => (
                <div key={i} className="flex gap-2 leading-relaxed">
                  <span className="text-[#484f58] flex-shrink-0">{l.time}</span>
                  <span className="font-bold flex-shrink-0 w-10" style={{ color: levelColor[l.level] ?? '#6b7280' }}>{l.level}</span>
                  <span className="text-[#8ab4f8] flex-shrink-0 w-32 truncate">{l.svc}</span>
                  <span className="text-[#e8eaed] break-all">{l.msg.replace(`[${l.svc}] `, '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IAM */}
        {activeSection === 'iam' && (
          <div className="p-4">
            <div className="text-[#e8eaed] text-sm font-medium mb-3">IAM &amp; Admin — Service Accounts</div>
            <div className="bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-[#1e1f22] border-b border-[#3c4043]">
                  <tr>
                    <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Account</th>
                    <th className="text-left px-3 py-2 text-[#9aa0a6] font-normal">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['sre-oncall@moniepoint-prod.iam', 'roles/editor'],
                    ['gke-sa@moniepoint-prod.iam', 'roles/container.nodeServiceAccount'],
                    ['cloud-sql-sa@moniepoint-prod.iam', 'roles/cloudsql.client'],
                    ['monitoring-sa@moniepoint-prod.iam', 'roles/monitoring.viewer'],
                    ['ci-cd-sa@moniepoint-prod.iam', 'roles/storage.admin'],
                  ].map(([acc, role], i) => (
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
