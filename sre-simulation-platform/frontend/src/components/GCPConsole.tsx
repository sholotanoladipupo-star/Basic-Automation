import { useState } from 'react'
import { SystemState } from '../types'

interface GCPConsoleProps {
  systemState: SystemState | null
}

const GCP_NAV = [
  { id: 'gke', icon: '☸', label: 'Kubernetes Engine' },
  { id: 'cloudsql', icon: '🗄', label: 'Cloud SQL' },
  { id: 'monitoring', icon: '📊', label: 'Cloud Monitoring' },
  { id: 'logging', icon: '📋', label: 'Cloud Logging' },
  { id: 'iam', icon: '🔑', label: 'IAM & Admin' },
]

function StatusChip({ status }: { status: string }) {
  const c = status === 'RUNNING' || status === 'healthy' ? 'bg-[#0f2a1a] text-[#3fb950] border-[#3fb950]'
    : status === 'ERROR' || status === 'down' ? 'bg-[#2a0a0a] text-[#f85149] border-[#f85149]'
    : 'bg-[#2a1e00] text-[#d29922] border-[#d29922]'
  const label = status === 'healthy' ? 'RUNNING' : status === 'down' ? 'ERROR' : status === 'degraded' ? 'DEGRADED' : status.toUpperCase()
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${c}`}>{label}</span>
}

export default function GCPConsole({ systemState }: GCPConsoleProps) {
  const [activeSection, setActiveSection] = useState('gke')

  const services = systemState ? Object.values(systemState.services) : []
  const caches = systemState?.infrastructure.caches ?? []
  const databases = systemState?.infrastructure.databases ?? []
  const clusters = systemState?.infrastructure.clusters ?? []

  return (
    <div className="flex h-full bg-[#202124] font-mono text-xs text-[#e8eaed] overflow-hidden">
      {/* GCP Left nav */}
      <div className="w-48 bg-[#292a2d] border-r border-[#3c4043] flex flex-col flex-shrink-0">
        {/* GCP Logo bar */}
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
                activeSection === item.id
                  ? 'bg-[#1a73e8]/20 text-[#8ab4f8]'
                  : 'text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]'
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

            {/* Cluster status */}
            {clusters.map(c => (
              <div key={c.name} className="bg-[#292a2d] border border-[#3c4043] rounded p-3 mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#8ab4f8] font-medium">{c.name}</span>
                  <StatusChip status="RUNNING" />
                </div>
                <div className="text-[#9aa0a6] text-[10px]">Nodes: {c.healthy_nodes}/{c.nodes} healthy</div>
              </div>
            ))}

            {/* Service deployments */}
            <div>
              <div className="text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2">Deployments</div>
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
                      <tr key={svc.name} className="border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/30">
                        <td className="px-3 py-2 text-[#8ab4f8]">{svc.name}</td>
                        <td className="px-3 py-2 text-[#9aa0a6]">default</td>
                        <td className="px-3 py-2 text-[#9aa0a6]">{svc.status === 'down' ? '0/3' : svc.status === 'degraded' ? '1/3' : '3/3'}</td>
                        <td className="px-3 py-2"><StatusChip status={svc.status} /></td>
                      </tr>
                    ))}
                    {caches.map(c => (
                      <tr key={c.name} className="border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/30">
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
              <div key={db.name} className="bg-[#292a2d] border border-[#3c4043] rounded p-3 mb-2">
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
                    <div className="text-[#9aa0a6] mb-0.5">Query Latency p99</div>
                    <span className={`font-bold ${db.query_latency_ms > 2000 ? 'text-[#f85149]' : db.query_latency_ms > 500 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
                      {db.query_latency_ms === 999999 ? '∞' : `${db.query_latency_ms}ms`}
                    </span>
                  </div>
                  <div>
                    <div className="text-[#9aa0a6] mb-0.5">Type</div>
                    <span className="text-[#e8eaed]">db-n1-standard-4</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cloud Monitoring */}
        {activeSection === 'monitoring' && (
          <div className="p-4 space-y-4">
            <div className="text-[#e8eaed] text-sm font-medium mb-3">Cloud Monitoring — Service Overview</div>
            {services.map(svc => (
              <div key={svc.name} className="bg-[#292a2d] border border-[#3c4043] rounded p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#8ab4f8] font-medium">{svc.name}</span>
                  <StatusChip status={svc.status} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  <div>
                    <div className="text-[#9aa0a6] mb-0.5">Error Rate (5m)</div>
                    <span className={`font-bold ${svc.error_rate > 0.1 ? 'text-[#f85149]' : svc.error_rate > 0.02 ? 'text-[#d29922]' : 'text-[#3fb950]'}`}>
                      {(svc.error_rate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <div className="text-[#9aa0a6] mb-0.5">Request Latency p99</div>
                    <span className={`font-bold ${svc.p99_latency_ms > 2000 ? 'text-[#f85149]' : svc.p99_latency_ms > 500 ? 'text-[#d29922]' : 'text-[#e8eaed]'}`}>
                      {svc.p99_latency_ms}ms
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cloud Logging */}
        {activeSection === 'logging' && (
          <div className="p-4">
            <div className="text-[#e8eaed] text-sm font-medium mb-3">Cloud Logging — Log Explorer</div>
            <div className="bg-[#292a2d] border border-[#3c4043] rounded p-3 text-[#9aa0a6] text-[11px]">
              <p className="mb-2">Use the <span className="text-[#8ab4f8]">Logs</span> tab in the main terminal panel for real-time service log queries.</p>
              <p>Log sinks configured for: BigQuery, Cloud Storage.</p>
              <p className="mt-2">Project log retention: 30 days.</p>
            </div>
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
                  {['sre-oncall@moniepoint-prod.iam', 'gke-sa@moniepoint-prod.iam', 'cloud-sql-sa@moniepoint-prod.iam'].map((acc, i) => (
                    <tr key={i} className="border-b border-[#3c4043] last:border-0">
                      <td className="px-3 py-2 text-[#8ab4f8]">{acc}</td>
                      <td className="px-3 py-2 text-[#9aa0a6]">{i === 0 ? 'roles/editor' : i === 1 ? 'roles/container.nodeServiceAccount' : 'roles/cloudsql.client'}</td>
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
