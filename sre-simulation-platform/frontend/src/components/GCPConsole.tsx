import { useState, useMemo } from 'react'
import { SystemState } from '../types'

interface GCPConsoleProps { systemState: SystemState | null }

const GCP_NAV = [
  { id: 'gke', icon: '☸', label: 'Kubernetes Engine' },
  { id: 'cloudsql', icon: '🗄', label: 'Cloud SQL' },
  { id: 'iam', icon: '🔑', label: 'IAM & Admin' },
]

function StatusChip({ status }: { status: string }) {
  const c = status === 'RUNNING' || status === 'healthy'
    ? 'bg-[#0f2a1a] text-[#3fb950] border-[#3fb950]'
    : status === 'ERROR' || status === 'down'
    ? 'bg-[#2a0a0a] text-[#f85149] border-[#f85149]'
    : 'bg-[#2a1e00] text-[#d29922] border-[#d29922]'
  const label = status === 'healthy' ? 'RUNNING'
    : status === 'down' ? 'ERROR'
    : status === 'degraded' ? 'DEGRADED'
    : status.toUpperCase()
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${c}`}>{label}</span>
}

// Generate realistic log lines based on service name, status, and minutes back
function generateLogs(service: string, status: string, minutes: number): { time: string; level: string; msg: string }[] {
  const now = Date.now()
  const lines: { time: string; level: string; msg: string }[] = []
  const count = Math.min(minutes * 4, 60)

  const healthyMsgs = [
    `GET /api/v1/health 200 OK 3ms`,
    `POST /api/v1/transactions 201 Created 18ms`,
    `GET /api/v1/accounts 200 OK 12ms`,
    `Processed 847 events in batch`,
    `Cache hit ratio: 94.2%`,
    `DB connection pool: 12/100 active`,
    `Heartbeat OK — upstream services reachable`,
    `Metrics flushed to Prometheus endpoint`,
  ]
  const degradedMsgs = [
    `WARN: Response time p99 exceeded 2000ms threshold (got 3241ms)`,
    `ERROR: upstream connect error or disconnect/reset before headers. retry attempt 1`,
    `WARN: DB connection pool at 87% capacity (87/100)`,
    `ERROR: context deadline exceeded after 5000ms`,
    `WARN: Redis cache miss rate elevated: 41%`,
    `ERROR: failed to acquire lock after 3 retries`,
    `WARN: Memory usage at 82% — approaching limit`,
    `ERROR: rate limit exceeded for downstream service`,
  ]
  const downMsgs = [
    `FATAL: panic: runtime error: invalid memory address or nil pointer dereference`,
    `ERROR: connection refused — localhost:5432`,
    `FATAL: Failed to start server: address already in use`,
    `ERROR: OOMKilled — container exceeded memory limit`,
    `FATAL: failed to connect to Redis: connection refused`,
    `ERROR: CrashLoopBackOff — restarting container (12 restarts)`,
    `FATAL: unrecoverable error in main goroutine — exiting`,
  ]

  const msgs = status === 'down' ? downMsgs : status === 'degraded' ? degradedMsgs : healthyMsgs

  for (let i = count; i >= 0; i--) {
    const t = new Date(now - i * (minutes * 60000 / count))
    const level = status === 'down' ? 'FATAL' : status === 'degraded' && Math.random() > 0.3 ? 'ERROR' : Math.random() > 0.8 ? 'WARN' : 'INFO'
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
    events.push({ time: new Date(now - 600000).toLocaleTimeString(), type: 'Warning', reason: 'OOMKilling', msg: `Container ${svcName} exceeded memory limit` })
    events.push({ time: new Date(now - 900000).toLocaleTimeString(), type: 'Warning', reason: 'Failed', msg: `Failed to pull image: ImagePullBackOff` })
  } else if (status === 'degraded') {
    events.push({ time: new Date(now - 120000).toLocaleTimeString(), type: 'Warning', reason: 'Unhealthy', msg: `Liveness probe failed: HTTP probe failed with statuscode: 503` })
    events.push({ time: new Date(now - 240000).toLocaleTimeString(), type: 'Warning', reason: 'Unhealthy', msg: `Readiness probe failed: Get "http://...": context deadline exceeded` })
  } else {
    events.push({ time: new Date(now - 3600000).toLocaleTimeString(), type: 'Normal', reason: 'Pulled', msg: `Successfully pulled image` })
    events.push({ time: new Date(now - 3540000).toLocaleTimeString(), type: 'Normal', reason: 'Started', msg: `Started container ${svcName}` })
    events.push({ time: new Date(now - 3480000).toLocaleTimeString(), type: 'Normal', reason: 'Scheduled', msg: `Successfully assigned pod to node` })
  }
  return events
}

interface PodDetailProps {
  name: string
  status: string
  kind: 'service' | 'cache' | 'database'
  extraData?: Record<string, unknown>
  onBack: () => void
}

function PodDetail({ name, status, kind, extraData, onBack }: PodDetailProps) {
  const [tab, setTab] = useState<'overview' | 'observability' | 'events' | 'logs'>('overview')
  const [logRange, setLogRange] = useState(5)
  const logs = useMemo(() => generateLogs(name, status, logRange), [name, status, logRange])
  const events = useMemo(() => generateEvents(name, status), [name, status])

  const pods = status === 'down' ? 0 : status === 'degraded' ? 1 : 3
  const cpuReq = kind === 'service' ? '250m' : '100m'
  const memReq = kind === 'service' ? '512Mi' : '256Mi'

  const levelColor: Record<string, string> = {
    INFO: '#6b7280', WARN: '#d29922', ERROR: '#f85149', FATAL: '#f85149',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Back + header */}
      <div className="px-4 py-2 border-b border-[#3c4043] bg-[#292a2d] flex items-center gap-3">
        <button onClick={onBack} className="text-[#8ab4f8] hover:text-[#e8eaed] text-[11px] transition-colors">← Back</button>
        <div>
          <div className="text-[#e8eaed] text-sm font-medium">{name}</div>
          <div className="text-[#9aa0a6] text-[10px]">Namespace: default · Kind: Deployment</div>
        </div>
        <div className="ml-auto"><StatusChip status={status} /></div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#3c4043] bg-[#292a2d]">
        {(['overview', 'observability', 'events', 'logs'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[11px] capitalize border-b-2 transition-colors ${
              tab === t ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-[#e8eaed]'
            }`}
          >{t}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'overview' && (
          <div className="space-y-3 text-[11px]">
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
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[#9aa0a6] text-[10px]">{k}</div>
                    <div className="text-[#e8eaed] font-medium">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pod list */}
            <div className="bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden">
              <div className="px-3 py-1.5 bg-[#1e1f22] border-b border-[#3c4043] text-[#9aa0a6] text-[10px] uppercase tracking-widest">Pods</div>
              {Array.from({ length: 3 }, (_, i) => {
                const running = i < pods
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-[#3c4043] last:border-0">
                    <span className="text-[#8ab4f8]">{name}-{Math.random().toString(36).slice(2, 7)}-{Math.random().toString(36).slice(2, 6)}</span>
                    <StatusChip status={running ? 'healthy' : 'down'} />
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
            <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">CPU & Memory — Last 30 minutes</div>
            {Array.from({ length: pods || 1 }, (_, i) => {
              const cpu = status === 'down' ? 0 : status === 'degraded' ? 78 + i * 5 : 22 + i * 8
              const mem = status === 'down' ? 0 : status === 'degraded' ? 81 + i * 3 : 35 + i * 10
              const cpuColor = cpu > 80 ? '#f85149' : cpu > 60 ? '#d29922' : '#3fb950'
              const memColor = mem > 85 ? '#f85149' : mem > 70 ? '#d29922' : '#3fb950'
              return (
                <div key={i} className="bg-[#292a2d] border border-[#3c4043] rounded p-3">
                  <div className="text-[#8ab4f8] mb-2">Pod {i + 1}</div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-[#9aa0a6]">CPU Usage</span>
                        <span style={{ color: cpuColor }} className="font-bold">{cpu}%</span>
                      </div>
                      <div className="w-full bg-[#1e1f22] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${cpu}%`, backgroundColor: cpuColor }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-[#9aa0a6]">Memory Usage</span>
                        <span style={{ color: memColor }} className="font-bold">{mem}%</span>
                      </div>
                      <div className="w-full bg-[#1e1f22] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${mem}%`, backgroundColor: memColor }} />
                      </div>
                    </div>
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
            {/* Time range selector */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#9aa0a6] text-[10px]">Time range:</span>
              {[1, 5, 15, 30, 60].map(m => (
                <button
                  key={m}
                  onClick={() => setLogRange(m)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    logRange === m
                      ? 'bg-[#8ab4f8] text-[#202124] font-bold'
                      : 'bg-[#292a2d] border border-[#3c4043] text-[#9aa0a6] hover:text-[#e8eaed]'
                  }`}
                >
                  {m < 60 ? `${m}m` : '1h'}
                </button>
              ))}
            </div>

            {/* Log lines */}
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

export default function GCPConsole({ systemState }: GCPConsoleProps) {
  const [activeSection, setActiveSection] = useState('gke')
  const [selectedPod, setSelectedPod] = useState<{ name: string; status: string; kind: 'service' | 'cache' | 'database'; extra?: Record<string, unknown> } | null>(null)

  const services = systemState ? Object.values(systemState.services) : []
  const caches = systemState?.infrastructure.caches ?? []
  const databases = systemState?.infrastructure.databases ?? []
  const clusters = systemState?.infrastructure.clusters ?? []

  if (selectedPod) {
    return (
      <div className="flex h-full bg-[#202124] font-mono text-xs text-[#e8eaed] overflow-hidden">
        <PodDetail
          name={selectedPod.name}
          status={selectedPod.status}
          kind={selectedPod.kind}
          extraData={selectedPod.extra}
          onBack={() => setSelectedPod(null)}
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
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-[11px] transition-colors ${
                activeSection === item.id ? 'bg-[#1a73e8]/20 text-[#8ab4f8]' : 'text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
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
              <div key={c.name} className="bg-[#292a2d] border border-[#3c4043] rounded p-3 mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#8ab4f8] font-medium">{c.name}</span>
                  <StatusChip status="RUNNING" />
                </div>
                <div className="text-[#9aa0a6] text-[10px]">Nodes: {c.healthy_nodes}/{c.nodes} healthy</div>
              </div>
            ))}

            <div>
              <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">Deployments — click a row to view details</div>
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
                    {services.map(svc => (
                      <tr
                        key={svc.name}
                        onClick={() => setSelectedPod({ name: svc.name, status: svc.status, kind: 'service', extra: { 'Error Rate': `${(svc.error_rate * 100).toFixed(1)}%`, 'p99 Latency': `${svc.p99_latency_ms}ms` } })}
                        className="border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/50 cursor-pointer"
                      >
                        <td className="px-3 py-2 text-[#8ab4f8]">{svc.name}</td>
                        <td className="px-3 py-2 text-[#9aa0a6]">default</td>
                        <td className="px-3 py-2 text-[#9aa0a6]">{svc.status === 'down' ? '0/3' : svc.status === 'degraded' ? '1/3' : '3/3'}</td>
                        <td className="px-3 py-2"><StatusChip status={svc.status} /></td>
                      </tr>
                    ))}
                    {caches.map(c => (
                      <tr
                        key={c.name}
                        onClick={() => setSelectedPod({ name: c.name, status: c.status, kind: 'cache', extra: { 'Hit Rate': `${(c.hit_rate * 100).toFixed(0)}%`, 'Memory': `${c.memory_used_mb}/${c.memory_total_mb} MB` } })}
                        className="border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/50 cursor-pointer"
                      >
                        <td className="px-3 py-2 text-[#8ab4f8]">{c.name}</td>
                        <td className="px-3 py-2 text-[#9aa0a6]">cache</td>
                        <td className="px-3 py-2 text-[#9aa0a6]">{c.status === 'down' ? '0/1' : '1/1'}</td>
                        <td className="px-3 py-2"><StatusChip status={c.status} /></td>
                      </tr>
                    ))}
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
              <div
                key={db.name}
                onClick={() => setSelectedPod({ name: db.name, status: db.status, kind: 'database', extra: { 'Connections': `${db.connection_count}/${db.max_connections}`, 'Query p99': db.query_latency_ms === 999999 ? '∞' : `${db.query_latency_ms}ms`, 'Instance Type': 'db-n1-standard-4' } })}
                className="bg-[#292a2d] border border-[#3c4043] rounded p-3 mb-2 cursor-pointer hover:border-[#8ab4f8]/40"
              >
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

        {/* IAM */}
        {activeSection === 'iam' && (
          <div className="p-4">
            <div className="text-[#e8eaed] text-sm font-medium mb-3">IAM & Admin — Service Accounts</div>
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
