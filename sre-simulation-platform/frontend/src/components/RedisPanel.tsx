import { useState } from 'react'
import { SystemState } from '../types'

interface RedisPanelProps {
  systemState: SystemState | null
}

// Sample keys by namespace
const NAMESPACES = [
  { prefix: 'session:', count: 14820, type: 'string', sample: ['session:usr-2291', 'session:usr-8812', 'session:usr-0044'] },
  { prefix: 'cache:product:', count: 3240, type: 'string', sample: ['cache:product:P001', 'cache:product:P002'] },
  { prefix: 'cache:user:', count: 8812, type: 'hash', sample: ['cache:user:usr-2291', 'cache:user:usr-8812'] },
  { prefix: 'rate:limit:', count: 22100, type: 'string', sample: ['rate:limit:192.168.1.10', 'rate:limit:10.0.0.44'] },
  { prefix: 'lock:', count: 24, type: 'string', sample: ['lock:payment-processor', 'lock:order-fulfillment'] },
  { prefix: 'queue:', count: 4, type: 'list', sample: ['queue:notifications', 'queue:email'] },
  { prefix: 'leaderboard:', count: 3, type: 'zset', sample: ['leaderboard:merchants', 'leaderboard:users'] },
  { prefix: 'config:', count: 42, type: 'hash', sample: ['config:feature-flags', 'config:payment-limits'] },
]

const KEY_VALUES: Record<string, string> = {
  'session:usr-2291': '{"user_id":"usr-2291","name":"Adebayo Okafor","role":"customer","device":"iOS","ttl":3600}',
  'cache:user:usr-2291': '{"id":"usr-2291","email":"adebayo@gmail.com","tier":"premium","kyc":"verified","balance":125000}',
  'cache:product:P001': '{"id":"P001","name":"Instant Transfer","fee":0,"limit":5000000,"enabled":true}',
  'rate:limit:192.168.1.10': '47',
  'lock:payment-processor': '{"holder":"payment-service-pod-abc12","expires":1712880000,"acquired":1712879940}',
  'queue:notifications': '["{"type":"sms","to":"+2348012345678","msg":"Your transfer of ₦25,000 was successful"}"]',
  'config:feature-flags': '{"enable_ussd":true,"enable_qr_pay":true,"max_transfer_daily":10000000,"maintenance_mode":false}',
}

function getRedisInfo(state: SystemState | null): { usedMb: number; maxMb: number; hitRate: number; connectedClients: number; ops: number; status: string; evictedKeys: number } {
  const redisCache = state?.infrastructure.caches.find(c => c.name === 'redis' || c.name === 'redis-primary')
  const status = redisCache?.status ?? 'healthy'
  if (status === 'down') {
    return { usedMb: 0, maxMb: 8192, hitRate: 0, connectedClients: 0, ops: 0, status: 'down', evictedKeys: 0 }
  }
  if (status === 'degraded') {
    return { usedMb: 6800, maxMb: 8192, hitRate: 42, connectedClients: 280, ops: 12400, status: 'degraded', evictedKeys: 1240 }
  }
  return { usedMb: 2840, maxMb: 8192, hitRate: 96, connectedClients: 84, ops: 48200, status: 'healthy', evictedKeys: 0 }
}

export default function RedisPanel({ systemState }: RedisPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'monitor' | 'slowlog' | 'cluster' | 'stats'>('overview')
  const [selectedNs, setSelectedNs] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [cliInput, setCliInput] = useState('')
  const [cliHistory, setCliHistory] = useState<Array<{ cmd: string; out: string }>>([])

  const info = getRedisInfo(systemState)
  const memPct = info.usedMb / info.maxMb
  const statusColor = info.status === 'down' ? '#f85149' : info.status === 'degraded' ? '#d29922' : '#3fb950'

  function runCli(e: React.FormEvent) {
    e.preventDefault()
    const cmd = cliInput.trim()
    if (!cmd) return
    setCliInput('')

    if (info.status === 'down') {
      setCliHistory(h => [...h, { cmd, out: '(error) NOAUTH Redis is down — connection refused' }])
      return
    }

    let out = ''
    const parts = cmd.split(/\s+/)
    const op = parts[0].toUpperCase()
    const key = parts[1] ?? ''

    if (op === 'PING') out = 'PONG'
    else if (op === 'INFO') out = `# Server\nredis_version:7.2.3\nuptime_in_days:14\n\n# Stats\ntotal_commands_processed:${(info.ops * 3600).toLocaleString()}\n\n# Memory\nused_memory_human:${(info.usedMb / 1024).toFixed(2)}G\nmaxmemory_human:${(info.maxMb / 1024).toFixed(0)}G\n\n# Keyspace\ndb0:keys=${NAMESPACES.reduce((s,n)=>s+n.count,0)},expires=18240`
    else if (op === 'DBSIZE') out = String(NAMESPACES.reduce((s, n) => s + n.count, 0))
    else if (op === 'KEYS') out = NAMESPACES.slice(0, 4).flatMap(n => n.sample.slice(0, 2)).join('\n')
    else if (op === 'GET') out = KEY_VALUES[key] ?? `(nil)`
    else if (op === 'TTL') out = key.startsWith('session:') ? '3421' : key.startsWith('lock:') ? '58' : key.startsWith('rate:') ? '12' : '-1'
    else if (op === 'TYPE') out = NAMESPACES.find(n => key.startsWith(n.prefix))?.type ?? 'string'
    else if (op === 'HGETALL') out = key.startsWith('cache:user:') ? `1) "id"\n2) "usr-2291"\n3) "email"\n4) "adebayo@gmail.com"\n5) "tier"\n6) "premium"` : `(empty array)`
    else if (op === 'LLEN') out = key === 'queue:notifications' ? '3' : '0'
    else if (op === 'MEMORY' && parts[1]?.toUpperCase() === 'USAGE') out = `${Math.round(Math.random() * 400 + 200)} bytes`
    else if (op === 'CLIENT' && parts[1]?.toUpperCase() === 'LIST') out = `id=1 addr=10.0.0.2:42811 fd=8 cmd=GET flags=N db=0\nid=2 addr=10.0.0.3:51204 fd=9 cmd=SET flags=N db=0\nid=3 addr=10.0.0.4:38291 fd=10 cmd=HGET flags=N db=0`
    else if (op === 'CONFIG' && parts[1]?.toUpperCase() === 'GET') out = `1) "${parts[2] ?? 'maxmemory'}"\n2) "${info.maxMb}mb"`
    else if (op === 'FLUSHDB' || op === 'FLUSHALL') out = '(error) DENIED — read-only mode in simulator'
    else out = `(error) ERR unknown command '${parts[0]}', or wrong number of arguments`

    setCliHistory(h => [...h, { cmd, out }])
  }

  const selectedNsData = NAMESPACES.find(n => n.prefix === selectedNs)

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-xs font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <span className="text-[#f85149] font-bold text-sm">⬡ Redis</span>
          <span className="text-[#484f58]">|</span>
          <span className="text-[#8b949e]">redis-primary:6379</span>
          <span className="px-2 py-0.5 rounded text-[9px] font-bold" style={{ background: `${statusColor}20`, color: statusColor }}>
            {info.status.toUpperCase()}
          </span>
        </div>
        <div className="text-[10px] text-[#484f58]">
          Redis 7.2.3 · AOF + RDB · us-central1
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#30363d] bg-[#161b22]">
        {(['overview', 'keys', 'monitor', 'slowlog', 'cluster', 'stats'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[11px] capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab ? 'text-[#f85149] border-[#f85149]' : 'text-[#8b949e] border-transparent hover:text-[#e6edf3]'
            }`}>
            {tab === 'monitor' ? 'CLI' : tab === 'cluster' ? 'Cluster' : tab === 'stats' ? 'Stats' : tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#161b22] border border-[#30363d] rounded p-3">
                <div className="text-[#8b949e] text-[9px] uppercase tracking-widest mb-1">Memory Used</div>
                <div className={`text-base font-bold ${memPct > 0.85 ? 'text-[#f85149]' : memPct > 0.7 ? 'text-[#d29922]' : 'text-[#e6edf3]'}`}>
                  {(info.usedMb / 1024).toFixed(2)} GB
                </div>
                <div className="h-1.5 bg-[#21262d] rounded mt-2 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${memPct * 100}%`, background: memPct > 0.85 ? '#f85149' : memPct > 0.7 ? '#d29922' : '#f85149' }} />
                </div>
                <div className="text-[#484f58] text-[9px] mt-1">{(memPct * 100).toFixed(0)}% of {info.maxMb / 1024}GB max</div>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded p-3">
                <div className="text-[#8b949e] text-[9px] uppercase tracking-widest mb-1">Hit Rate</div>
                <div className={`text-base font-bold ${info.hitRate < 50 ? 'text-[#f85149]' : info.hitRate < 80 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
                  {info.hitRate}%
                </div>
                <div className="h-1.5 bg-[#21262d] rounded mt-2 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${info.hitRate}%`, background: info.hitRate < 50 ? '#f85149' : info.hitRate < 80 ? '#d29922' : '#3fb950' }} />
                </div>
                <div className="text-[#484f58] text-[9px] mt-1">Keyspace hits / total lookups</div>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded p-3">
                <div className="text-[#8b949e] text-[9px] uppercase tracking-widest mb-1">Connected Clients</div>
                <div className={`text-base font-bold ${info.connectedClients > 250 ? 'text-[#f85149]' : 'text-[#e6edf3]'}`}>
                  {info.connectedClients}
                </div>
                <div className="text-[#484f58] text-[9px] mt-1">max: 10,000</div>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded p-3">
                <div className="text-[#8b949e] text-[9px] uppercase tracking-widest mb-1">Ops/sec</div>
                <div className="text-base font-bold text-[#e6edf3]">{info.ops.toLocaleString()}</div>
                <div className="text-[#484f58] text-[9px] mt-1">instantaneous_ops</div>
              </div>
            </div>

            {/* Hit/Miss ratio sparkline */}
            <div className="bg-[#161b22] border border-[#30363d] rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[#8b949e] text-[9px] uppercase tracking-widest">Cache Hit Rate Trend (last 10 min)</div>
                <span className={`font-bold text-[11px] ${info.hitRate < 50 ? 'text-[#f85149]' : info.hitRate < 80 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>{info.hitRate}%</span>
              </div>
              {(() => {
                const pts = Array.from({ length: 30 }, (_, i) => {
                  if (info.status === 'degraded') {
                    // Show drop from 96% → 42%
                    const frac = i / 29
                    return frac < 0.4 ? 96 : 96 - (96 - 42) * ((frac - 0.4) / 0.6)
                  }
                  return 94 + Math.sin(i * 0.5) * 2
                })
                const w = 400, h = 40
                const min = Math.min(...pts) - 5, max = Math.max(...pts) + 2
                const polyPts = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - ((v - min) / (max - min)) * (h - 2)}`).join(' ')
                const color = info.hitRate < 50 ? '#f85149' : info.hitRate < 80 ? '#d29922' : '#3fb950'
                return (
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 40 }}>
                    <defs>
                      <linearGradient id="hit-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon points={`0,${h} ${polyPts} ${w},${h}`} fill="url(#hit-grad)" />
                    <polyline points={polyPts} fill="none" stroke={color} strokeWidth="1.5" />
                  </svg>
                )
              })()}
              {info.status === 'degraded' && (
                <div className="text-[#f85149] text-[9px] mt-1">↓ Hit rate dropped from 96% — cache evictions causing misses. Keys being evicted: ~{info.evictedKeys.toLocaleString()}</div>
              )}
            </div>

            {/* Memory fragmentation ratio + eviction policy */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#161b22] border border-[#30363d] rounded p-3">
                <div className="text-[#8b949e] text-[9px] uppercase tracking-widest mb-1">Memory Fragmentation Ratio</div>
                {(() => {
                  const ratio = info.status === 'degraded' ? 2.41 : info.status === 'down' ? 0 : 1.08
                  const color = ratio > 1.5 ? '#f85149' : ratio > 1.2 ? '#d29922' : '#3fb950'
                  return (
                    <>
                      <div className="text-base font-bold" style={{ color }}>{ratio.toFixed(2)}</div>
                      <div className="text-[#484f58] text-[9px] mt-1">
                        {ratio > 1.5 ? '⚠ High fragmentation — consider MEMORY PURGE or restart' : ratio > 1.2 ? 'Moderate fragmentation' : '✓ Healthy'}
                      </div>
                    </>
                  )
                })()}
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded p-3">
                <div className="text-[#8b949e] text-[9px] uppercase tracking-widest mb-1">Eviction Policy</div>
                <div className="text-[#e6edf3] font-mono text-[11px] font-bold">allkeys-lru</div>
                <div className="text-[#484f58] text-[9px] mt-1">
                  Evicted this session: <span className={`font-bold ${info.evictedKeys > 0 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>{info.evictedKeys.toLocaleString()}</span> keys
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="bg-[#161b22] border border-[#30363d] rounded p-3 text-[10px] space-y-1.5">
              <div className="text-[#8b949e] text-[9px] uppercase tracking-widest mb-2">Instance Info</div>
              {[
                ['Role', 'master'],
                ['Persistence', 'AOF enabled · RDB every 300s'],
                ['Eviction policy', info.status === 'degraded' ? 'allkeys-lru (evicting!) ⚠' : 'allkeys-lru'],
                ['Evicted keys', info.evictedKeys === 0 ? '0' : `${info.evictedKeys.toLocaleString()} ⚠`],
                ['Total keys', NAMESPACES.reduce((s, n) => s + n.count, 0).toLocaleString()],
                ['Expired keys', '18,240'],
                ['Keyspace', 'db0'],
                ['Replica', 'redis-replica:6379 (lag: 4ms)'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[#8b949e]">{k}</span>
                  <span className={`font-mono ${String(v).includes('⚠') ? 'text-[#d29922]' : 'text-[#e6edf3]'}`}>{v}</span>
                </div>
              ))}
            </div>

            {info.status === 'degraded' && (
              <div className="p-3 bg-[#d29922]/10 border border-[#d29922]/30 rounded text-[10px] text-[#d29922]">
                ⚠ Memory pressure — evictions occurring. Hit rate degraded. Check for memory leak or oversized keys.
                Run: MEMORY DOCTOR · OBJECT FREQ key · CONFIG GET maxmemory
              </div>
            )}
          </div>
        )}

        {/* KEY BROWSER */}
        {activeTab === 'keys' && (
          <div className="flex h-full min-h-0">
            {/* Namespace list */}
            <div className="w-48 shrink-0 border-r border-[#30363d] p-3 space-y-1 overflow-y-auto">
              <div className="text-[#484f58] text-[9px] uppercase tracking-widest mb-2">Namespaces</div>
              {NAMESPACES.map(ns => (
                <button key={ns.prefix}
                  onClick={() => { setSelectedNs(ns.prefix); setSelectedKey(null) }}
                  className={`w-full text-left px-2 py-1.5 rounded text-[10px] transition-colors ${selectedNs === ns.prefix ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22]'}`}>
                  <span className="text-[#f85149] mr-1">▶</span>
                  <span className="font-mono">{ns.prefix}</span>
                  <span className="text-[#484f58] float-right">{ns.count.toLocaleString()}</span>
                </button>
              ))}
            </div>

            {/* Key list + value */}
            <div className="flex-1 p-3 overflow-y-auto">
              {!selectedNs ? (
                <div className="text-[#484f58] text-center mt-8">Select a namespace to browse keys</div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[#8b949e] text-[9px] uppercase tracking-widest">
                    {selectedNs} · type: <span className="text-[#58a6ff]">{selectedNsData?.type}</span> · {selectedNsData?.count.toLocaleString()} keys
                  </div>
                  {selectedNsData?.sample.map(k => (
                    <div key={k}>
                      <button
                        onClick={() => setSelectedKey(selectedKey === k ? null : k)}
                        className={`w-full text-left px-3 py-2 rounded border text-[11px] font-mono transition-colors ${selectedKey === k ? 'bg-[#21262d] border-[#58a6ff]/40 text-[#58a6ff]' : 'bg-[#161b22] border-[#30363d] text-[#e6edf3] hover:border-[#484f58]'}`}>
                        {k}
                        <span className="float-right text-[#484f58] text-[9px]">
                          {selectedNs.startsWith('session:') || selectedNs.startsWith('lock:') ? 'TTL: ~3600s' : 'TTL: -1 (no expire)'}
                        </span>
                      </button>
                      {selectedKey === k && (
                        <div className="mt-1 p-3 bg-[#0d1117] border border-[#30363d] rounded text-[10px]">
                          <div className="text-[#484f58] mb-1">Value (type: {selectedNsData.type})</div>
                          <pre className="text-[#e6edf3] whitespace-pre-wrap break-all">
                            {KEY_VALUES[k]
                              ? (() => { try { return JSON.stringify(JSON.parse(KEY_VALUES[k]), null, 2) } catch { return KEY_VALUES[k] } })()
                              : `(string) "${k.split(':').pop()}-value-${Math.floor(Math.random() * 9999)}"`}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="text-[#484f58] text-[10px] text-center">
                    Showing {selectedNsData?.sample.length} of {selectedNsData?.count.toLocaleString()} keys
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CLI */}
        {activeTab === 'monitor' && (
          <div className="flex flex-col h-full p-3">
            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[11px] mb-3">
              {cliHistory.length === 0 && (
                <div className="text-[#484f58] text-center mt-4">
                  Redis CLI — try: PING · INFO · DBSIZE · KEYS * · GET session:usr-2291 · TTL lock:payment-processor
                </div>
              )}
              {cliHistory.map((h, i) => (
                <div key={i}>
                  <div className="text-[#f85149]">redis:6379&gt; {h.cmd}</div>
                  <pre className="text-[#e6edf3] whitespace-pre-wrap ml-2">{h.out}</pre>
                </div>
              ))}
            </div>
            <form onSubmit={runCli} className="flex items-center gap-2 border-t border-[#30363d] pt-2">
              <span className="text-[#f85149] shrink-0">redis:6379&gt;</span>
              <input
                type="text"
                value={cliInput}
                onChange={e => setCliInput(e.target.value)}
                className="flex-1 bg-transparent text-[#e6edf3] focus:outline-none caret-[#f85149]"
                placeholder="TYPE COMMAND…"
                autoFocus
                spellCheck={false}
              />
            </form>
          </div>
        )}

        {/* SLOW LOG */}
        {activeTab === 'slowlog' && (
          <div className="p-4">
            <div className="text-[#8b949e] text-[9px] uppercase tracking-widest mb-3">Slow Log (slowlog-log-slower-than: 10ms)</div>
            {info.status === 'healthy' ? (
              <div className="text-[#3fb950] text-center mt-4 text-[10px]">✓ No slow commands in the last hour</div>
            ) : (
              <div className="space-y-2">
                {[
                  { id: 1842, duration: '124ms', cmd: 'KEYS *', client: '10.0.0.2:42811' },
                  { id: 1841, duration: '89ms', cmd: 'SMEMBERS rate:limit:all', client: '10.0.0.5:38912' },
                  { id: 1840, duration: '67ms', cmd: 'DEBUG SLEEP 0', client: '10.0.0.3:51204' },
                  { id: 1839, duration: '58ms', cmd: 'HGETALL cache:user:*', client: '10.0.0.2:42811' },
                ].map(e => (
                  <div key={e.id} className="bg-[#161b22] border border-[#30363d] rounded p-2.5 text-[10px]">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[#484f58]">#{e.id}</span>
                      <span className="text-[#f85149] font-bold">{e.duration}</span>
                      <span className="text-[#8b949e] ml-auto">{e.client}</span>
                    </div>
                    <div className="font-mono text-[#e6edf3]">{e.cmd}</div>
                  </div>
                ))}
                <div className="text-[10px] text-[#d29922] mt-2">
                  ⚠ KEYS * command is O(N) — never use in production. Replace with SCAN.
                </div>
              </div>
            )}
          </div>
        )}

        {/* CLUSTER TAB */}
        {activeTab === 'cluster' && (
          <div className="p-4 space-y-4">
            <div className="text-[#8b949e] text-[10px] uppercase tracking-widest">Redis Cluster Topology</div>

            {/* Primary node */}
            <div className="bg-[#161b22] border border-[#30363d] rounded p-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[#f85149] font-bold">⬡ redis-primary</span>
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-[#d29922]/20 text-[#d29922] font-bold">PRIMARY</span>
                  {info.status === 'down' && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-[#f85149]/20 text-[#f85149] font-bold">DOWN</span>}
                </div>
                <span className="text-[#484f58] text-[10px] font-mono">10.0.1.10:6379</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div><span className="text-[#8b949e]">Memory: </span><span className="text-[#e6edf3]">{(info.usedMb / 1024).toFixed(1)}GB / {info.maxMb / 1024}GB</span></div>
                <div><span className="text-[#8b949e]">Keys: </span><span className="text-[#e6edf3]">49,041</span></div>
                <div><span className="text-[#8b949e]">Clients: </span><span className={info.connectedClients > 250 ? 'text-[#f85149]' : 'text-[#e6edf3]'}>{info.connectedClients}</span></div>
              </div>
            </div>

            {/* Replicas */}
            <div className="text-[#484f58] text-[9px] uppercase tracking-widest">Replicas</div>
            {[
              { name: 'redis-replica-1', ip: '10.0.1.11:6379', lag: info.status === 'degraded' ? '4.2s ⚠' : '2ms', slot: '0-8191', status: info.status === 'down' ? 'DISCONNECTED' : 'CONNECTED' },
              { name: 'redis-replica-2', ip: '10.0.1.12:6379', lag: info.status === 'degraded' ? '8.7s ⚠' : '3ms', slot: '8192-16383', status: info.status === 'down' ? 'DISCONNECTED' : 'CONNECTED' },
            ].map(r => (
              <div key={r.name} className={`bg-[#161b22] border rounded p-3 ${r.status === 'DISCONNECTED' ? 'border-[#f85149]/30' : 'border-[#30363d]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8b949e] font-mono text-[11px]">{r.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.status === 'DISCONNECTED' ? 'bg-[#f85149]/20 text-[#f85149]' : 'bg-[#3fb950]/10 text-[#3fb950]'}`}>{r.status}</span>
                  </div>
                  <span className="text-[#484f58] text-[10px] font-mono">{r.ip}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><span className="text-[#8b949e]">Replication lag: </span><span className={r.lag.includes('⚠') ? 'text-[#d29922]' : 'text-[#3fb950]'}>{r.lag}</span></div>
                  <div><span className="text-[#8b949e]">Hash slots: </span><span className="text-[#e6edf3] font-mono">{r.slot}</span></div>
                </div>
              </div>
            ))}

            {info.status === 'degraded' && (
              <div className="p-3 bg-[#d29922]/10 border border-[#d29922]/30 rounded text-[10px] text-[#d29922]">
                ⚠ Replica lag is high ({'>'}4s). Reads from replicas may return stale data. Consider forcing reads to primary or flushing stale keys.
              </div>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="p-4 space-y-4">
            <div className="text-[#8b949e] text-[10px] uppercase tracking-widest">Command Statistics</div>

            {/* Command breakdown */}
            <div className="bg-[#161b22] border border-[#30363d] rounded overflow-hidden">
              <table className="w-full text-[10px]">
                <thead className="bg-[#0d1117] border-b border-[#30363d]">
                  <tr>
                    <th className="text-left px-3 py-2 text-[#8b949e] font-normal">Command</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal">Calls/s</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal">Avg µs</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal">% CPU</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cmd: 'GET', rate: info.status === 'degraded' ? 8200 : 28400, avg: 42, cpu: info.status === 'degraded' ? 18 : 12 },
                    { cmd: 'SET', rate: info.status === 'degraded' ? 3100 : 11200, avg: 68, cpu: 8 },
                    { cmd: 'HGETALL', rate: info.status === 'degraded' ? 1800 : 4200, avg: 124, cpu: info.status === 'degraded' ? 22 : 9 },
                    { cmd: 'KEYS', rate: info.status === 'degraded' ? 24 : 0, avg: info.status === 'degraded' ? 8200 : 0, cpu: info.status === 'degraded' ? 38 : 0 },
                    { cmd: 'EXPIRE', rate: 2100, avg: 31, cpu: 4 },
                    { cmd: 'DEL', rate: 890, avg: 29, cpu: 2 },
                    { cmd: 'PING', rate: 140, avg: 12, cpu: 1 },
                  ].filter(c => c.rate > 0).map(c => (
                    <tr key={c.cmd} className="border-b border-[#21262d] last:border-0">
                      <td className="px-3 py-2 font-mono text-[#e6edf3] font-bold">{c.cmd}</td>
                      <td className="px-3 py-2 text-right text-[#e6edf3]">{c.rate.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right font-mono ${c.avg > 1000 ? 'text-[#f85149]' : c.avg > 200 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>{c.avg.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right ${c.cpu > 30 ? 'text-[#f85149] font-bold' : 'text-[#e6edf3]'}`}>{c.cpu}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {info.status === 'degraded' && (
              <div className="p-3 bg-[#f85149]/10 border border-[#f85149]/30 rounded text-[10px] text-[#f85149]">
                ⚠ KEYS command detected! This is O(N) and is blocking the event loop. Consuming 38% CPU. Replace with SCAN for production use.
              </div>
            )}

            {/* Memory timeline */}
            <div className="bg-[#161b22] border border-[#30363d] rounded p-3">
              <div className="text-[#8b949e] text-[9px] uppercase tracking-widest mb-2">Memory Usage Trend</div>
              {(() => {
                const pts = Array.from({ length: 24 }, (_, i) => {
                  if (info.status === 'degraded') return 2840 + (i / 23) * (6800 - 2840)
                  return 2840 + Math.sin(i * 0.4) * 120
                })
                const w = 400, h = 50
                const max = Math.max(...pts), min = Math.min(...pts) - 200
                const polyPts = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - ((v - min) / (max - min)) * (h - 2)}`).join(' ')
                const color = info.status === 'degraded' ? '#f85149' : '#58a6ff'
                return (
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 50 }}>
                    <defs>
                      <linearGradient id="mem-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon points={`0,${h} ${polyPts} ${w},${h}`} fill="url(#mem-grad)" />
                    <polyline points={polyPts} fill="none" stroke={color} strokeWidth="1.5" />
                  </svg>
                )
              })()}
              <div className="flex justify-between text-[9px] text-[#484f58] mt-1">
                <span>24 min ago</span><span>Now: {(info.usedMb / 1024).toFixed(2)}GB</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
