import { v4 as uuidv4 } from 'uuid'
import { ScenarioTemplate, SystemState, Alert } from '../types'

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T
}

function makeAlert(severity: 'sev1' | 'sev2' | 'sev3', service: string, message: string, sim_time: string): Alert {
  return { id: uuidv4(), severity, service, message, fired_at: sim_time, acknowledged: false }
}

function rebuildMetrics(state: SystemState): SystemState {
  const s = state
  s.metrics_snapshot = {
    'api-gateway.error_rate': s.services['api-gateway']?.error_rate ?? 0,
    'api-gateway.p99_latency_ms': s.services['api-gateway']?.p99_latency_ms ?? 0,
    'auth-service.error_rate': s.services['auth-service']?.error_rate ?? 0,
    'auth-service.p99_latency_ms': s.services['auth-service']?.p99_latency_ms ?? 0,
    'user-service.error_rate': s.services['user-service']?.error_rate ?? 0,
    'user-service.p99_latency_ms': s.services['user-service']?.p99_latency_ms ?? 0,
    'payment-service.error_rate': s.services['payment-service']?.error_rate ?? 0,
    'payment-service.p99_latency_ms': s.services['payment-service']?.p99_latency_ms ?? 0,
    'order-service.error_rate': s.services['order-service']?.error_rate ?? 0,
    'order-service.p99_latency_ms': s.services['order-service']?.p99_latency_ms ?? 0,
    'analytics-service.error_rate': s.services['analytics-service']?.error_rate ?? 0,
    'analytics-service.p99_latency_ms': s.services['analytics-service']?.p99_latency_ms ?? 0,
    'notification-service.error_rate': s.services['notification-service']?.error_rate ?? 0,
    'notification-service.p99_latency_ms': s.services['notification-service']?.p99_latency_ms ?? 0,
    'checkout-service.error_rate': s.services['checkout-service']?.error_rate ?? 0,
    'checkout-service.p99_latency_ms': s.services['checkout-service']?.p99_latency_ms ?? 0,
    'postgres-primary.connection_count': s.infrastructure.databases[0]?.connection_count ?? 0,
    'postgres-primary.query_latency_ms': s.infrastructure.databases[0]?.query_latency_ms ?? 0,
    'cluster.healthy_nodes': s.infrastructure.clusters[0]?.healthy_nodes ?? 0,
  }
  return s
}

function buildInitialState(sessionId: string): SystemState {
  return {
    session_id: sessionId,
    scenario_id: 'db-replica-ip-change',
    sim_time: '2024-01-15T14:00:00Z',
    services: {
      'api-gateway': { name: 'api-gateway', status: 'healthy', error_rate: 0.01, p99_latency_ms: 40, dependencies: ['auth-service', 'order-service', 'user-service'], current_alerts: [] },
      'auth-service': { name: 'auth-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 30, dependencies: ['user-service'], current_alerts: [] },
      'user-service': { name: 'user-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 55, dependencies: ['postgres-primary'], current_alerts: [] },
      'payment-service': { name: 'payment-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 80, dependencies: ['postgres-primary'], current_alerts: [] },
      'order-service': { name: 'order-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 70, dependencies: ['postgres-primary', 'payment-service'], current_alerts: [] },
      'analytics-service': { name: 'analytics-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 120, dependencies: ['postgres-primary'], current_alerts: [] },
      'notification-service': { name: 'notification-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 50, dependencies: ['postgres-primary'], current_alerts: [] },
      'checkout-service': { name: 'checkout-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 65, dependencies: ['postgres-primary', 'payment-service'], current_alerts: [] },
    },
    active_incidents: [],
    resolved_incidents: [],
    infrastructure: {
      clusters: [{ name: 'prod-us-east-1', nodes: 12, healthy_nodes: 12 }],
      databases: [
        { name: 'postgres-primary', status: 'healthy', connection_count: 15, max_connections: 200, query_latency_ms: 45 },
      ],
      caches: [{ name: 'redis-primary', status: 'healthy', hit_rate: 0.92, memory_used_mb: 2400, memory_total_mb: 4096 }],
      external_deps: [
        { name: 'stripe-api', status: 'healthy', latency_ms: 180 },
      ],
    },
    metrics_snapshot: {},
  }
}

export function getDbReplicaIpChangeScenario(sessionId: string): ScenarioTemplate {
  const initial = buildInitialState(sessionId)
  rebuildMetrics(initial)

  return {
    id: 'db-replica-ip-change',
    name: 'Database Connectivity Issues',
    difficulty: 'senior',
    description: 'A routine infrastructure change rotated the read replica IP address. Services still pointing to the old IP receive connection refused errors, causing cascading read failures.',
    topology_description: `E-commerce platform on Kubernetes (prod-us-east-1, 12 nodes).
Services: api-gateway, auth-service, user-service, payment-service, order-service, analytics-service, notification-service, checkout-service.
Database: postgres-primary (healthy). Read replica IP was rotated during maintenance; 3 services hardcoded the old IP instead of using the DNS alias.
Cache: redis-primary (healthy).
Root cause: DATABASE_READ_REPLICA_URL env var in order-service, analytics-service, and user-service ConfigMaps still references the old replica IP (10.0.1.45). New replica is at 10.0.1.87. Connection refused on every read query.`,
    initial_system_state: initial,
    failure_sequence: [
      {
        trigger_at_minutes: 0,
        description: 'order-service and analytics-service read queries start failing — connection refused to old replica IP',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['order-service'].status = 'degraded'
          s.services['order-service'].error_rate = 0.45
          s.services['order-service'].p99_latency_ms = 3500
          s.services['analytics-service'].status = 'degraded'
          s.services['analytics-service'].error_rate = 0.80
          s.services['analytics-service'].p99_latency_ms = 5000

          s.active_incidents.push({
            id: uuidv4(),
            root_cause: 'Read replica IP changed; DATABASE_READ_REPLICA_URL in order-service, analytics-service, and user-service ConfigMaps still points to old IP 10.0.1.45',
            visible_symptoms: [
              'order-service: 45% read query errors — connection refused to 10.0.1.45:5432',
              'analytics-service: 80% read query errors — connection refused to 10.0.1.45:5432',
              'DB read replica unreachable from 2 services',
            ],
            blast_radius: ['order-service', 'analytics-service'],
            injected_at: s.sim_time,
          })

          const alert = makeAlert('sev2', 'order-service', 'order-service: Read query error rate 45%. Connection refused to postgres read replica at 10.0.1.45:5432.', s.sim_time)
          s.services['order-service'].current_alerts.push(alert)
          const alert2 = makeAlert('sev2', 'analytics-service', 'analytics-service: Read query error rate 80%. Connection refused to postgres read replica at 10.0.1.45:5432.', s.sim_time)
          s.services['analytics-service'].current_alerts.push(alert2)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 2,
        description: 'user-service goes degraded; DB query latency spikes as services fall back to primary for reads',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['user-service'].status = 'degraded'
          s.services['user-service'].error_rate = 0.40
          s.services['user-service'].p99_latency_ms = 4200
          s.infrastructure.databases[0].query_latency_ms = 8000
          s.infrastructure.databases[0].status = 'degraded'

          const alert = makeAlert('sev1', 'user-service', 'user-service: Read query error rate 40%. Connection refused to postgres read replica. Falling back to primary — DB latency now 8000ms.', s.sim_time)
          s.services['user-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push(
            'user-service: 40% read query errors — connection refused to 10.0.1.45:5432',
            'postgres-primary: query_latency_ms spiked to 8000ms — overloaded by read fallback traffic',
          )
          s.active_incidents[0].blast_radius.push('user-service')
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 5,
        description: 'order-service goes down; DB connection count collapses as services stop retrying',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['order-service'].status = 'down'
          s.services['order-service'].error_rate = 1.0
          s.services['order-service'].p99_latency_ms = 0
          s.services['api-gateway'].error_rate = 0.35
          s.services['api-gateway'].p99_latency_ms = 2000
          s.infrastructure.databases[0].connection_count = 2

          const alert = makeAlert('sev1', 'order-service', 'order-service: DOWN. All read queries failing. Connection pool exhausted retrying old replica IP. DB connection_count dropped to 2.', s.sim_time)
          s.services['order-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push(
            'order-service: DOWN — connection pool exhausted',
            'postgres-primary: connection_count collapsed to 2 (services backing off)',
            'api-gateway: 35% error rate (order upstream unavailable)',
          )
          s.active_incidents[0].blast_radius.push('api-gateway')
          return rebuildMetrics(s)
        },
      },
    ],
    expected_root_cause: 'Read replica IP address changed during infrastructure maintenance. Three services (order-service, analytics-service, user-service) have DATABASE_READ_REPLICA_URL hardcoded to the old IP (10.0.1.45) in their ConfigMaps instead of using the DNS alias. New replica IP is 10.0.1.87.',
    expected_resolution_steps: [
      'kubectl get pods -n prod to identify degraded/down services',
      'kubectl logs order-service-xxx to find "connection refused 10.0.1.45:5432" errors',
      'kubectl describe configmap order-service-config to find hardcoded IP in DATABASE_READ_REPLICA_URL',
      'Verify new replica IP: nslookup postgres-read-replica.db.svc.cluster.local or check RDS/Cloud SQL console',
      'kubectl patch configmap order-service-config --patch with new IP or DNS alias for all 3 services',
      'kubectl patch configmap analytics-service-config --patch with corrected DATABASE_READ_REPLICA_URL',
      'kubectl patch configmap user-service-config --patch with corrected DATABASE_READ_REPLICA_URL',
      'kubectl rollout restart deployment/order-service deployment/analytics-service deployment/user-service',
      'kubectl rollout status to verify pods recover',
      'Verify DB query_latency_ms returns to baseline',
    ],
    available_runbooks: [
      {
        id: 'rb-db-replica-001',
        title: 'DB Read Replica Connectivity Runbook',
        content: `# DB Read Replica Connectivity Runbook

## When to use
Services are failing with "connection refused" on read queries. Write queries to primary succeed.

## Step 1 — Identify affected services
\`\`\`bash
kubectl get pods -n prod
kubectl logs <failing-pod> -n prod | grep -i "connection refused\\|replica\\|read"
\`\`\`

## Step 2 — Find the replica endpoint in ConfigMap
\`\`\`bash
kubectl get configmap -n prod | grep -v kube
kubectl describe configmap <service>-config -n prod | grep REPLICA
\`\`\`

## Step 3 — Verify current replica IP/DNS
\`\`\`bash
# Check DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup postgres-read-replica.db.svc.cluster.local

# Or check cloud console for current replica IP
# AWS RDS: aws rds describe-db-instances --query 'DBInstances[*].Endpoint'
\`\`\`

## Step 4 — Update ConfigMap with correct endpoint
\`\`\`bash
kubectl patch configmap <service>-config -n prod \\
  --patch '{"data": {"DATABASE_READ_REPLICA_URL": "postgres://postgres-read-replica.db.svc.cluster.local:5432/app"}}'
\`\`\`
Repeat for all affected services.

## Step 5 — Restart affected deployments
\`\`\`bash
kubectl rollout restart deployment/order-service deployment/analytics-service deployment/user-service -n prod
kubectl rollout status deployment/order-service -n prod -w
\`\`\`

## Step 6 — Verify
\`\`\`bash
kubectl logs -l app=order-service -n prod | tail -20
# Should show successful DB connections, no "connection refused"
\`\`\`

## Prevention
- Always use DNS aliases (not IPs) for database endpoints in ConfigMaps
- Add a validation step in CI that checks env vars against an allowlist of DNS names (not raw IPs)`,
      },
      {
        id: 'rb-incident-001',
        title: 'Incident Response Runbook',
        content: `# Incident Response Runbook\n\n## Severity\n- SEV1: Full outage, revenue impact\n- SEV2: Degraded, partial failures\n\n## Steps\n1. Acknowledge page (< 5 min)\n2. Declare severity\n3. Post to #incidents: what's affected, hypothesis\n4. Investigate → fix → verify\n5. Update every 15 min\n6. Resolve + schedule postmortem`,
      },
    ],
    available_dashboards: [
      { id: 'dash-db', name: 'Database Connections & Latency', services: ['postgres-primary', 'order-service', 'analytics-service', 'user-service'] },
      { id: 'dash-services', name: 'Service Error Rates & Latency', services: ['api-gateway', 'order-service', 'analytics-service', 'user-service', 'payment-service'] },
      { id: 'dash-overview', name: 'System Overview', services: ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'order-service', 'analytics-service', 'notification-service', 'checkout-service'] },
    ],
    passing_score: 65,
    time_limit_minutes: 20,
  }
}

export function checkDbReplicaIpChangeResolution(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  const isK8s = lower.includes('kubectl')
  const isFixAction = lower.includes('patch configmap') || lower.includes('edit configmap') ||
    lower.includes('rollout restart') || lower.includes('replica') ||
    lower.includes('database_read_replica_url')
  return isK8s && isFixAction
}
