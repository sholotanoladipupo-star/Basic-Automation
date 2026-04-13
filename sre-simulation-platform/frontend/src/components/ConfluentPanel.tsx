import React, { useState } from 'react'
import { SystemState } from '../types'

interface ConfluentPanelProps {
  systemState: SystemState | null
}

const TOPICS = [
  { name: 'transactions', partitions: 12, replication: 3, msgs: 2_847_291, retentionH: 168 },
  { name: 'payment-events', partitions: 8, replication: 3, msgs: 924_412, retentionH: 72 },
  { name: 'user-activity', partitions: 6, replication: 3, msgs: 5_201_887, retentionH: 48 },
  { name: 'order-updates', partitions: 6, replication: 3, msgs: 1_348_022, retentionH: 72 },
  { name: 'notification-queue', partitions: 4, replication: 3, msgs: 88_321, retentionH: 24 },
  { name: 'analytics-events', partitions: 16, replication: 3, msgs: 12_400_910, retentionH: 24 },
  { name: 'audit-log', partitions: 4, replication: 3, msgs: 3_104_220, retentionH: 720 },
  { name: 'dead-letter-queue', partitions: 3, replication: 3, msgs: 4_219, retentionH: 72 },
]

const CONSUMER_GROUPS = [
  { id: 'payment-processor-grp', topic: 'transactions', lag: 0, members: 3 },
  { id: 'analytics-consumer-grp', topic: 'analytics-events', lag: 0, members: 4 },
  { id: 'notification-worker-grp', topic: 'notification-queue', lag: 0, members: 2 },
  { id: 'order-fulfillment-grp', topic: 'order-updates', lag: 0, members: 2 },
  { id: 'audit-logger-grp', topic: 'audit-log', lag: 0, members: 1 },
  { id: 'user-sync-grp', topic: 'user-activity', lag: 0, members: 3 },
]

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function sampleMessages(topic: string, isDown: boolean): Array<{ offset: number; key: string; value: string; ts: string }> {
  if (isDown) return []
  const now = Date.now()
  const samples: Record<string, Array<{ key: string; value: string }>> = {
    transactions: [
      { key: 'txn-8812', value: '{"id":"txn-8812","amount":25000,"currency":"NGN","status":"completed","account_id":"acc-4421","merchant":"POS-Shoprite"}' },
      { key: 'txn-8813', value: '{"id":"txn-8813","amount":5000,"currency":"NGN","status":"pending","account_id":"acc-2290","merchant":"Transfer"}' },
      { key: 'txn-8814', value: '{"id":"txn-8814","amount":150000,"currency":"NGN","status":"completed","account_id":"acc-8891","merchant":"Bank-Wire"}' },
    ],
    'payment-events': [
      { key: 'pay-evt-001', value: '{"event":"payment.initiated","payment_id":"pay-7743","user_id":"usr-2211","amount":12000}' },
      { key: 'pay-evt-002', value: '{"event":"payment.success","payment_id":"pay-7742","amount":8500,"gateway":"Paystack"}' },
    ],
    'dead-letter-queue': [
      { key: 'dlq-txn-8800', value: '{"original_topic":"transactions","error":"NullPointerException: payment_method null","retries":3}' },
      { key: 'dlq-pay-evt-099', value: '{"original_topic":"payment-events","error":"DB connection refused","retries":5}' },
    ],
  }
  const rows = samples[topic] ?? [
    { key: `${topic}-msg-1`, value: `{"event":"sample","topic":"${topic}","ts":${now}}` },
    { key: `${topic}-msg-2`, value: `{"event":"sample","topic":"${topic}","count":2}` },
  ]
  return rows.map((r, i) => ({
    offset: 2_847_288 + i,
    key: r.key,
    value: r.value,
    ts: new Date(now - (rows.length - i) * 1200).toISOString(),
  }))
}

export default function ConfluentPanel({ systemState }: ConfluentPanelProps) {
  const [activeTab, setActiveTab] = useState<'topics' | 'consumers' | 'brokers' | 'messages' | 'schema' | 'dlq'>('topics')
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)

  // Derive Kafka health from systemState
  const kafkaState = systemState?.infrastructure.caches.find(c => c.name === 'kafka') ??
    systemState?.infrastructure.external_deps.find(d => d.name === 'kafka') ?? null

  // Check kafka scenario
  const isKafkaDegraded = (() => {
    const svc = systemState?.services['analytics-service'] ?? systemState?.services['notification-service'] ?? null
    return svc?.status === 'degraded' || svc?.status === 'down'
  })()

  // Compute lag dynamically
  const computedGroups = CONSUMER_GROUPS.map(g => {
    let lag = 0
    if (isKafkaDegraded) {
      if (g.topic === 'analytics-events') lag = 142_880
      else if (g.topic === 'order-updates') lag = 28_440
      else if (g.topic === 'notification-queue') lag = 9_210
    }
    return { ...g, lag }
  })

  const isKafkaDown = kafkaState?.status === 'down'
  const clusterStatus = isKafkaDown ? 'DEGRADED' : isKafkaDegraded ? 'REBALANCING' : 'HEALTHY'
  const clusterColor = isKafkaDown ? '#f85149' : isKafkaDegraded ? '#d29922' : '#3fb950'

  const messages = selectedTopic ? sampleMessages(selectedTopic, isKafkaDown) : []

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-xs font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <span className="text-[#d29922] font-bold text-sm">⚡ Confluent</span>
          <span className="text-[#484f58]">|</span>
          <span className="text-[#8b949e]">prod-kafka-cluster</span>
          <span className="px-2 py-0.5 rounded text-[9px] font-bold" style={{ background: `${clusterColor}20`, color: clusterColor }}>
            {clusterStatus}
          </span>
        </div>
        <div className="text-[10px] text-[#484f58]">
          3 brokers · Kafka 3.5 · us-central1
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex border-b border-[#30363d] bg-[#161b22]">
        {(['topics', 'consumers', 'brokers', 'messages', 'schema', 'dlq'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[11px] capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab ? 'text-[#d29922] border-[#d29922]' : 'text-[#8b949e] border-transparent hover:text-[#e6edf3]'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* TOPICS */}
        {activeTab === 'topics' && (
          <div>
            <div className="text-[#8b949e] text-[10px] uppercase tracking-widest mb-3">Topics ({TOPICS.length})</div>
            <div className="bg-[#161b22] border border-[#30363d] rounded overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-[#0d1117] border-b border-[#30363d]">
                  <tr>
                    <th className="text-left px-3 py-2 text-[#8b949e] font-normal">Topic Name</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal">Partitions</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal">RF</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal">Messages</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal">Retention</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {TOPICS.map(t => (
                    <tr key={t.name} className="border-b border-[#21262d] last:border-0 hover:bg-[#21262d] cursor-pointer"
                      onClick={() => { setSelectedTopic(t.name); setActiveTab('messages') }}>
                      <td className="px-3 py-2">
                        <span className={`font-mono ${t.name === 'dead-letter-queue' ? 'text-[#d29922]' : 'text-[#58a6ff]'}`}>
                          {t.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[#e6edf3]">{t.partitions}</td>
                      <td className="px-3 py-2 text-right text-[#e6edf3]">{t.replication}</td>
                      <td className="px-3 py-2 text-right text-[#e6edf3]">{fmtNum(t.msgs)}</td>
                      <td className="px-3 py-2 text-right text-[#8b949e]">{t.retentionH}h</td>
                      <td className="px-3 py-2 text-right text-[#484f58] text-[10px]">Browse →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONSUMER GROUPS */}
        {activeTab === 'consumers' && (
          <div>
            <div className="text-[#8b949e] text-[10px] uppercase tracking-widest mb-3">Consumer Groups</div>
            <div className="bg-[#161b22] border border-[#30363d] rounded overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-[#0d1117] border-b border-[#30363d]">
                  <tr>
                    <th className="text-left px-3 py-2 text-[#8b949e] font-normal">Group ID</th>
                    <th className="text-left px-3 py-2 text-[#8b949e] font-normal">Topic</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal">Members</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal">Lag</th>
                    <th className="text-right px-3 py-2 text-[#8b949e] font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {computedGroups.map(g => (
                    <tr key={g.id} className="border-b border-[#21262d] last:border-0 hover:bg-[#21262d]">
                      <td className="px-3 py-2 font-mono text-[#e6edf3]">{g.id}</td>
                      <td className="px-3 py-2 text-[#58a6ff]">{g.topic}</td>
                      <td className="px-3 py-2 text-right text-[#e6edf3]">{g.members}</td>
                      <td className={`px-3 py-2 text-right font-bold ${g.lag > 50000 ? 'text-[#f85149]' : g.lag > 5000 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
                        {g.lag === 0 ? '0' : fmtNum(g.lag)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          g.lag > 50000 ? 'bg-[#f85149]/20 text-[#f85149]' :
                          g.lag > 5000 ? 'bg-[#d29922]/20 text-[#d29922]' :
                          'bg-[#3fb950]/10 text-[#3fb950]'
                        }`}>
                          {g.lag > 50000 ? 'HIGH LAG' : g.lag > 5000 ? 'LAGGING' : 'STABLE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isKafkaDegraded && (
              <div className="mt-3 p-3 bg-[#d29922]/10 border border-[#d29922]/30 rounded text-[10px] text-[#d29922]">
                ⚠ Consumer lag detected. analytics-consumer-grp and order-fulfillment-grp are falling behind.
                Check consumer health with: kafka-consumer-groups.sh --describe --group analytics-consumer-grp
              </div>
            )}
            {/* Lag sparklines */}
            <div className="mt-4">
              <div className="text-[#8b949e] text-[10px] uppercase tracking-widest mb-2">Consumer Lag Trend (last 10 min)</div>
              <div className="space-y-2">
                {computedGroups.filter(g => g.lag > 0 || isKafkaDegraded).slice(0, 4).map(g => {
                  // Generate a spike trend for lagging groups
                  const pts = Array.from({ length: 20 }, (_, i) => {
                    if (!isKafkaDegraded) return 0
                    const lag = g.topic === 'analytics-events' ? 142880 : g.topic === 'order-updates' ? 28440 : g.topic === 'notification-queue' ? 9210 : 0
                    return lag > 0 ? Math.max(0, lag * (i / 19) * (0.7 + Math.random() * 0.3)) : 0
                  })
                  const max = Math.max(...pts, 1)
                  const w = 200, h = 30
                  const polyPts = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - (v / max) * (h - 2)}`).join(' ')
                  const lagColor = g.lag > 50000 ? '#f85149' : g.lag > 5000 ? '#d29922' : '#3fb950'
                  return (
                    <div key={g.id} className="flex items-center gap-3 bg-[#161b22] border border-[#30363d] rounded p-2">
                      <div className="w-40 flex-shrink-0">
                        <div className="text-[#e6edf3] text-[10px] font-mono truncate">{g.id.replace('-grp', '')}</div>
                        <div className="text-[#484f58] text-[9px]">{g.topic}</div>
                      </div>
                      <svg width={w} height={h} className="flex-1">
                        <defs>
                          <linearGradient id={`lag-${g.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lagColor} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={lagColor} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <polygon points={`0,${h} ${polyPts} ${w},${h}`} fill={`url(#lag-${g.id})`} />
                        <polyline points={polyPts} fill="none" stroke={lagColor} strokeWidth="1.5" />
                      </svg>
                      <div className="w-20 text-right flex-shrink-0">
                        <div className="font-bold text-[11px]" style={{ color: lagColor }}>{g.lag === 0 ? '0' : fmtNum(g.lag)}</div>
                        <div className="text-[#484f58] text-[9px]">msgs behind</div>
                      </div>
                    </div>
                  )
                })}
                {computedGroups.every(g => g.lag === 0) && (
                  <div className="text-[#3fb950] text-[10px] text-center py-3">✓ All consumer groups at zero lag</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BROKERS */}
        {activeTab === 'brokers' && (
          <div className="space-y-3">
            <div className="text-[#8b949e] text-[10px] uppercase tracking-widest">Brokers (3)</div>
            {[
              { id: 1, host: 'broker-1.kafka.internal', port: 9092, role: 'Leader', cpu: 34, net: '142 MB/s' },
              { id: 2, host: 'broker-2.kafka.internal', port: 9092, role: 'Follower', cpu: isKafkaDegraded ? 78 : 28, net: '98 MB/s' },
              { id: 3, host: 'broker-3.kafka.internal', port: 9092, role: 'Follower', cpu: 31, net: '105 MB/s' },
            ].map(b => (
              <div key={b.id} className="bg-[#161b22] border border-[#30363d] rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-[#58a6ff] font-mono">{b.host}:{b.port}</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${b.role === 'Leader' ? 'bg-[#d29922]/20 text-[#d29922]' : 'bg-[#484f58]/20 text-[#8b949e]'}`}>{b.role}</span>
                  </div>
                  <span className={`text-[9px] font-bold ${isKafkaDown ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>
                    {isKafkaDown ? '● DOWN' : '● ONLINE'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div><span className="text-[#8b949e]">CPU: </span><span className={b.cpu > 70 ? 'text-[#f85149]' : 'text-[#e6edf3]'}>{b.cpu}%</span></div>
                  <div><span className="text-[#8b949e]">Net: </span><span className="text-[#e6edf3]">{b.net}</span></div>
                  <div><span className="text-[#8b949e]">Port: </span><span className="text-[#e6edf3]">{b.port}</span></div>
                </div>
              </div>
            ))}
            <div className="bg-[#161b22] border border-[#30363d] rounded p-3 text-[10px] space-y-1.5">
              <div className="text-[#8b949e] text-[9px] uppercase tracking-widest mb-1">Cluster Metrics</div>
              {[
                ['Kafka version', '3.5.1'],
                ['Active partitions', isKafkaDegraded ? '92 / 96 ⚠' : '96 / 96'],
                ['Under-replicated partitions', isKafkaDegraded ? '4 ⚠' : '0'],
                ['Leader elections (last 1h)', isKafkaDegraded ? '12 ⚠' : '0'],
                ['Zookeeper', 'Connected'],
                ['Message throughput', '8,200 msg/s'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[#8b949e]">{k}</span>
                  <span className={`font-mono ${String(v).includes('⚠') ? 'text-[#d29922]' : 'text-[#e6edf3]'}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MESSAGES BROWSER */}
        {activeTab === 'messages' && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="text-[#8b949e] text-[10px] uppercase tracking-widest">Browse Messages</div>
              <select
                value={selectedTopic ?? ''}
                onChange={e => setSelectedTopic(e.target.value || null)}
                className="ml-auto bg-[#21262d] border border-[#30363d] text-[#e6edf3] text-[11px] px-2 py-1 rounded outline-none"
              >
                <option value="">Select topic…</option>
                {TOPICS.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            {!selectedTopic ? (
              <div className="text-[#484f58] text-center mt-8">Select a topic to browse messages</div>
            ) : isKafkaDown ? (
              <div className="p-4 bg-[#f85149]/10 border border-[#f85149]/30 rounded text-[#f85149] text-[11px]">
                ⚠ Cannot fetch messages — Kafka brokers are unreachable
              </div>
            ) : (
              <div>
                <div className="text-[#8b949e] text-[10px] mb-2">Topic: <span className="text-[#58a6ff]">{selectedTopic}</span> · Latest 3 messages</div>
                <div className="space-y-2">
                  {messages.map((m, i) => (
                    <div key={i} className="bg-[#161b22] border border-[#30363d] rounded p-3 text-[10px]">
                      <div className="flex items-center gap-3 mb-1.5 text-[#484f58]">
                        <span>offset: <span className="text-[#8b949e]">{m.offset}</span></span>
                        <span>key: <span className="text-[#d2a8ff] font-mono">{m.key}</span></span>
                        <span className="ml-auto">{m.ts}</span>
                      </div>
                      <div className="font-mono text-[#e6edf3] bg-[#0d1117] rounded p-2 overflow-x-auto whitespace-pre">
                        {JSON.stringify(JSON.parse(m.value), null, 2)}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedTopic && !isKafkaDown && (
                  <div className="mt-4 border-t border-[#30363d] pt-4">
                    <div className="text-[#8b949e] text-[10px] uppercase tracking-widest mb-2">Produce Test Message</div>
                    <ProduceForm topic={selectedTopic} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SCHEMA REGISTRY */}
        {activeTab === 'schema' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[#8b949e] text-[10px] uppercase tracking-widest">Schema Registry</div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/30">ONLINE</span>
            </div>
            <div className="space-y-2">
              {[
                { subject: 'transactions-value', format: 'AVRO', version: 3, compat: 'BACKWARD', status: isKafkaDegraded ? 'INCOMPATIBLE' : 'OK' },
                { subject: 'payment-events-value', format: 'AVRO', version: 2, compat: 'BACKWARD', status: 'OK' },
                { subject: 'user-activity-value', format: 'PROTOBUF', version: 1, compat: 'FULL', status: 'OK' },
                { subject: 'order-updates-value', format: 'JSON', version: 4, compat: 'NONE', status: isKafkaDegraded ? 'WARNING' : 'OK' },
                { subject: 'analytics-events-value', format: 'AVRO', version: 7, compat: 'BACKWARD', status: 'OK' },
                { subject: 'audit-log-value', format: 'AVRO', version: 1, compat: 'FULL_TRANSITIVE', status: 'OK' },
              ].map(s => (
                <div key={s.subject} className="bg-[#161b22] border border-[#30363d] rounded p-3 text-[10px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#58a6ff] font-mono">{s.subject}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      s.status === 'INCOMPATIBLE' ? 'bg-[#f85149]/20 text-[#f85149]' :
                      s.status === 'WARNING' ? 'bg-[#d29922]/20 text-[#d29922]' :
                      'bg-[#3fb950]/10 text-[#3fb950]'
                    }`}>{s.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[9px]">
                    <div><span className="text-[#484f58]">Format: </span><span className="text-[#d2a8ff]">{s.format}</span></div>
                    <div><span className="text-[#484f58]">Version: </span><span className="text-[#e6edf3]">v{s.version}</span></div>
                    <div><span className="text-[#484f58]">Compat: </span><span className="text-[#e6edf3]">{s.compat}</span></div>
                  </div>
                  {s.status === 'INCOMPATIBLE' && (
                    <div className="mt-2 text-[#f85149] text-[9px]">
                      ⚠ Schema v{s.version} is incompatible with v{s.version - 1}. Consumers expecting old schema will fail to deserialize. This may be causing consumer lag.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DLQ INSPECTOR */}
        {activeTab === 'dlq' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[#8b949e] text-[10px] uppercase tracking-widest">Dead Letter Queue Inspector</div>
              <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${isKafkaDegraded ? 'text-[#f85149] border-[#f85149]/40 bg-[#f85149]/10' : 'text-[#484f58] border-[#30363d]'}`}>
                {isKafkaDegraded ? `${4219 + (isKafkaDegraded ? 312 : 0)} msgs` : '4,219 msgs'}
              </span>
            </div>
            {isKafkaDegraded && (
              <div className="mb-3 p-3 bg-[#f85149]/10 border border-[#f85149]/30 rounded text-[10px] text-[#f85149]">
                ⚠ DLQ message count is growing. New failures are being routed here. Investigate consumer errors before re-processing.
              </div>
            )}
            <div className="space-y-3">
              {[
                { id: 'dlq-001', original_topic: 'transactions', error: 'NullPointerException: payment_method is null at PaymentProcessor.java:284', retries: 3, first_seen: '14:23:11', last_seen: '14:29:44', count: isKafkaDegraded ? 312 : 28 },
                { id: 'dlq-002', original_topic: 'payment-events', error: 'Connection refused: jdbc:postgresql://db-primary:5432/payments — too many clients', retries: 5, first_seen: '14:24:02', last_seen: '14:31:18', count: isKafkaDegraded ? 189 : 12 },
                { id: 'dlq-003', original_topic: 'order-updates', error: 'Schema deserialization error: field "amount_currency" missing in record', retries: 2, first_seen: '14:26:55', last_seen: '14:28:01', count: 7 },
                { id: 'dlq-004', original_topic: 'notification-queue', error: 'Timeout: downstream SMS gateway did not respond within 5000ms', retries: 3, first_seen: '14:27:30', last_seen: '14:30:12', count: isKafkaDegraded ? 47 : 3 },
              ].map(m => (
                <div key={m.id} className="bg-[#161b22] border border-[#30363d] rounded p-3 text-[10px]">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[#d29922] font-mono">{m.original_topic}</span>
                      <span className="text-[#484f58] mx-2">→</span>
                      <span className="text-[#f85149] font-mono text-[9px]">dead-letter-queue</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`font-bold ${m.count > 100 ? 'text-[#f85149]' : m.count > 20 ? 'text-[#d29922]' : 'text-[#8b949e]'}`}>{m.count.toLocaleString()} msgs</div>
                      <div className="text-[#484f58] text-[9px]">{m.first_seen} → {m.last_seen}</div>
                    </div>
                  </div>
                  <div className="bg-[#0d1117] rounded p-2 font-mono text-[9px] text-[#f85149] leading-relaxed break-all">
                    {m.error}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[#484f58] text-[9px]">Retries: {m.retries}/5</span>
                    <button className="ml-auto px-2 py-0.5 rounded border border-[#58a6ff]/40 text-[#58a6ff] text-[9px] hover:bg-[#58a6ff]/10 transition-colors">Re-process</button>
                    <button className="px-2 py-0.5 rounded border border-[#484f58] text-[#484f58] text-[9px] hover:border-[#f85149] hover:text-[#f85149] transition-colors">Discard</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProduceForm({ topic }: { topic: string }) {
  const [key, setKey] = useState(`test-key-${Date.now()}`)
  const [value, setValue] = useState(`{"event":"test","topic":"${topic}","ts":${Date.now()}}`)
  const [sent, setSent] = useState(false)

  function handleProduce(e: React.FormEvent) {
    e.preventDefault()
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <form onSubmit={handleProduce} className="space-y-2 text-[10px]">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[#8b949e] mb-1">Key</div>
          <input value={key} onChange={e => setKey(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] px-2 py-1.5 rounded font-mono text-[10px] focus:outline-none focus:border-[#d29922]" />
        </div>
        <div>
          <div className="text-[#8b949e] mb-1">Partition</div>
          <select className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] px-2 py-1.5 rounded text-[10px] focus:outline-none">
            <option>Auto (round-robin)</option>
            <option>Partition 0</option>
            <option>Partition 1</option>
          </select>
        </div>
      </div>
      <div>
        <div className="text-[#8b949e] mb-1">Value (JSON)</div>
        <textarea value={value} onChange={e => setValue(e.target.value)} rows={3}
          className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] px-2 py-1.5 rounded font-mono text-[10px] focus:outline-none focus:border-[#d29922] resize-none" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit"
          className="px-4 py-1.5 bg-[#d29922]/20 hover:bg-[#d29922]/30 border border-[#d29922]/50 text-[#d29922] rounded text-[10px] font-bold transition-colors">
          ▶ Produce
        </button>
        {sent && <span className="text-[#3fb950] text-[10px]">✓ Message produced to {topic} · offset +1</span>}
      </div>
    </form>
  )
}
