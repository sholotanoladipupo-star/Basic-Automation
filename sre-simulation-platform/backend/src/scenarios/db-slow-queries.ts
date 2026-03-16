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
    'product-service.error_rate': s.services['product-service']?.error_rate ?? 0,
    'product-service.p99_latency_ms': s.services['product-service']?.p99_latency_ms ?? 0,
    'order-service.error_rate': s.services['order-service']?.error_rate ?? 0,
    'order-service.p99_latency_ms': s.services['order-service']?.p99_latency_ms ?? 0,
    'checkout-service.error_rate': s.services['checkout-service']?.error_rate ?? 0,
    'checkout-service.p99_latency_ms': s.services['checkout-service']?.p99_latency_ms ?? 0,
    'payment-service.error_rate': s.services['payment-service']?.error_rate ?? 0,
    'payment-service.p99_latency_ms': s.services['payment-service']?.p99_latency_ms ?? 0,
    'postgres-primary.connection_count': s.infrastructure.databases[0]?.connection_count ?? 0,
    'postgres-primary.query_latency_ms': s.infrastructure.databases[0]?.query_latency_ms ?? 0,
    'postgres-replica.connection_count': s.infrastructure.databases[1]?.connection_count ?? 0,
    'postgres-replica.query_latency_ms': s.infrastructure.databases[1]?.query_latency_ms ?? 0,
  }
  return s
}

function buildInitialState(sessionId: string): SystemState {
  return {
    session_id: sessionId,
    scenario_id: 'db-slow-queries',
    sim_time: '2024-01-15T14:00:00Z',
    services: {
      'api-gateway': { name: 'api-gateway', status: 'healthy', error_rate: 0.01, p99_latency_ms: 42, dependencies: ['checkout-service', 'product-service', 'order-service'], current_alerts: [] },
      'checkout-service': { name: 'checkout-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 60, dependencies: ['postgres-primary', 'payment-service'], current_alerts: [] },
      'product-service': { name: 'product-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 28, dependencies: ['postgres-primary', 'postgres-replica'], current_alerts: [] },
      'order-service': { name: 'order-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 55, dependencies: ['postgres-primary'], current_alerts: [] },
      'payment-service': { name: 'payment-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 75, dependencies: ['postgres-primary'], current_alerts: [] },
    },
    active_incidents: [],
    resolved_incidents: [],
    infrastructure: {
      clusters: [{ name: 'prod-us-east-1', nodes: 6, healthy_nodes: 6 }],
      databases: [
        { name: 'postgres-primary', status: 'healthy', connection_count: 40, max_connections: 200, query_latency_ms: 14 },
        { name: 'postgres-replica', status: 'healthy', connection_count: 18, max_connections: 100, query_latency_ms: 16 },
      ],
      caches: [{ name: 'redis-primary', status: 'healthy', hit_rate: 0.91, memory_used_mb: 2100, memory_total_mb: 4096 }],
      external_deps: [{ name: 'stripe-api', status: 'healthy', latency_ms: 175 }],
    },
    metrics_snapshot: {},
  }
}

export function getDbSlowQueriesScenario(sessionId: string): ScenarioTemplate {
  const initial = buildInitialState(sessionId)
  rebuildMetrics(initial)

  return {
    id: 'db-slow-queries',
    name: 'Database Slow Queries — Connection Pool Exhaustion',
    difficulty: 'senior',
    description: 'A missing index on orders.user_id is causing a full table scan on every checkout query. As traffic grows, queries are queuing up, the connection pool is filling, and checkout is grinding to a halt.',
    topology_description: `E-commerce platform on Kubernetes (prod-us-east-1, 6 nodes).
Services: api-gateway, checkout-service, product-service, order-service, payment-service.
Database: postgres-primary (200 max connections), postgres-replica (100 max, reads only).
Cache: redis-primary (healthy — not the cause this time).
The offending query: SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC — no index on user_id.`,
    initial_system_state: initial,
    failure_sequence: [
      {
        trigger_at_minutes: 0,
        description: 'Slow query detected — checkout DB latency spikes to 4s',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          const pg = s.infrastructure.databases[0]
          pg.query_latency_ms = 4200
          pg.connection_count = 95
          pg.status = 'degraded'
          s.services['checkout-service'].p99_latency_ms = 5800
          s.services['checkout-service'].error_rate = 0.08
          s.services['checkout-service'].status = 'degraded'

          s.active_incidents.push({
            id: uuidv4(),
            root_cause: 'Full table scan on orders table — missing index on user_id column causing query times > 4s',
            visible_symptoms: [
              'postgres-primary query latency p99 = 4200ms',
              'checkout-service p99 = 5800ms',
              'Connection pool at 47% capacity (95/200)',
            ],
            blast_radius: ['checkout-service', 'order-service', 'payment-service'],
            injected_at: s.sim_time,
          })

          const alert = makeAlert('sev2', 'postgres-primary', 'postgres-primary: Query p99 latency=4200ms. Slow query detected — possible missing index or lock contention.', s.sim_time)
          s.services['checkout-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 1,
        description: 'Connection pool at 80% — order-service starts timing out',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.infrastructure.databases[0].connection_count = 160
          s.infrastructure.databases[0].query_latency_ms = 8500
          s.services['order-service'].error_rate = 0.25
          s.services['order-service'].p99_latency_ms = 12000
          s.services['order-service'].status = 'degraded'
          const alert = makeAlert('sev1', 'order-service', 'order-service: Request timeout rate 25%. DB connections 160/200. Queries queuing behind long-running scans.', s.sim_time)
          s.services['order-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push('order-service timeout rate 25%', 'DB connection pool 80% full')
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 2.5,
        description: 'Payment service impacted, checkout error rate 60%',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['checkout-service'].error_rate = 0.6
          s.services['checkout-service'].p99_latency_ms = 30000
          s.services['payment-service'].error_rate = 0.35
          s.services['payment-service'].p99_latency_ms = 25000
          s.services['payment-service'].status = 'degraded'
          s.services['api-gateway'].error_rate = 0.28
          const alert = makeAlert('sev1', 'checkout-service', 'checkout-service: Error rate 60%. Customer checkout FAILING. Revenue impact confirmed.', s.sim_time)
          s.services['checkout-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 5,
        description: 'DB connection pool exhausted — full outage',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          const pg = s.infrastructure.databases[0]
          if (pg.connection_count < 190) return s // already recovering
          pg.connection_count = 200
          pg.status = 'down'
          pg.query_latency_ms = 99999
          s.services['checkout-service'].status = 'down'
          s.services['checkout-service'].error_rate = 1.0
          s.services['order-service'].status = 'down'
          s.services['order-service'].error_rate = 1.0
          s.services['payment-service'].status = 'down'
          s.services['payment-service'].error_rate = 1.0
          const alert = makeAlert('sev1', 'postgres-primary', 'postgres-primary: CONNECTION POOL EXHAUSTED (200/200). All DB writes failing. IMMEDIATE ACTION REQUIRED.', s.sim_time)
          s.services['checkout-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
    ],
    expected_root_cause: 'Missing index on orders.user_id caused full table scans, query latency spiked, connection pool exhausted leading to checkout/order/payment outage.',
    expected_resolution_steps: [
      'Query pg_stat_activity to find long-running queries',
      'Identify the offending query (SELECT * FROM orders WHERE user_id = $1)',
      'Kill blocking queries with pg_terminate_backend(pid)',
      'Create index: CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id)',
      'Verify connection count drops and latency returns to baseline',
      'Resolve incident',
    ],
    available_runbooks: [
      {
        id: 'rb-db-slowquery-001',
        title: 'Slow Query Investigation Runbook',
        content: `# Slow Query Investigation Runbook

## When to use
Query latency is elevated, connection pool is filling up, services are timing out.

## Step 1 — Find slow queries
\`\`\`sql
kubectl exec -it postgres-primary-0 -n db -- psql -U postgres -c "
  SELECT pid, now() - query_start AS duration, state, query
  FROM pg_stat_activity
  WHERE state != 'idle'
    AND query_start < now() - interval '5 seconds'
  ORDER BY duration DESC
  LIMIT 20;"
\`\`\`

## Step 2 — Check for lock contention
\`\`\`sql
kubectl exec -it postgres-primary-0 -n db -- psql -U postgres -c "
  SELECT blocked_locks.pid AS blocked_pid,
         blocking_locks.pid AS blocking_pid,
         blocked_activity.query AS blocked_query,
         blocking_activity.query AS blocking_query
  FROM pg_catalog.pg_locks blocked_locks
  JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
  WHERE NOT blocked_locks.granted;"
\`\`\`

## Step 3 — Kill blocking queries
\`\`\`sql
-- Graceful cancel (allows rollback)
kubectl exec -it postgres-primary-0 -n db -- psql -U postgres -c "SELECT pg_cancel_backend(<pid>);"

-- Force kill (immediate)
kubectl exec -it postgres-primary-0 -n db -- psql -U postgres -c "SELECT pg_terminate_backend(<pid>);"
\`\`\`

## Step 4 — Check missing indexes (EXPLAIN)
\`\`\`sql
kubectl exec -it postgres-primary-0 -n db -- psql -U postgres -c "
  EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 12345 ORDER BY created_at DESC LIMIT 20;"
\`\`\`
Look for: **Seq Scan** on a large table → missing index.

## Step 5 — Create index without downtime
\`\`\`sql
kubectl exec -it postgres-primary-0 -n db -- psql -U postgres -c "
  CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);"
\`\`\`
CONCURRENTLY builds without locking writes. Takes longer but safe for production.

## Recovery Verification
- pg_stat_activity: no queries running > 2s
- Connection count < 50
- checkout-service p99 < 200ms`,
      },
      {
        id: 'rb-incident-001',
        title: 'Incident Response Runbook',
        content: `# Incident Response Runbook\n\n## Severity\n- SEV1: Full outage, revenue impact\n- SEV2: Degraded, partial failures\n- SEV3: No customer impact\n\n## Steps\n1. Acknowledge page (< 5 min)\n2. Declare severity\n3. Post to #incidents: what's affected, hypothesis, next steps\n4. Investigate → mitigate → verify\n5. Update every 15 min\n6. Resolve + schedule postmortem`,
      },
    ],
    available_dashboards: [
      { id: 'dash-db', name: 'Database Performance', services: ['postgres-primary', 'postgres-replica'] },
      { id: 'dash-services', name: 'Service Error Rates & Latency', services: ['api-gateway', 'checkout-service', 'order-service', 'payment-service', 'product-service'] },
      { id: 'dash-overview', name: 'System Overview', services: ['api-gateway', 'checkout-service', 'order-service', 'payment-service', 'product-service', 'postgres-primary'] },
    ],
    passing_score: 65,
    time_limit_minutes: 10,
  }
}

export function checkDbSlowQueriesResolution(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  const isDbAction = lower.includes('psql') || lower.includes('pg_') || lower.includes('postgres')
  const isKillOrIndex = lower.includes('terminate_backend') || lower.includes('cancel_backend') ||
    lower.includes('create index') || lower.includes('idx_orders') || lower.includes('pg_cancel')
  return isDbAction && isKillOrIndex
}
