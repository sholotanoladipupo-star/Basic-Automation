import { useState } from 'react'
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
  const [activeTab, setActiveTab] = useState<'topics' | 'consumers' | 'brokers' | 'messages'>('topics')
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
        {(['topics', 'consumers', 'brokers', 'messages'] as const).map(tab => (
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
