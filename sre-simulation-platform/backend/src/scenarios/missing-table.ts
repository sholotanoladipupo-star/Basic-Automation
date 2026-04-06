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
    scenario_id: 'missing-table',
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

export function getMissingTableScenario(sessionId: string): ScenarioTemplate {
  const initial = buildInitialState(sessionId)
  rebuildMetrics(initial)

  return {
    id: 'missing-table',
    name: 'Payment Processing Errors',
    difficulty: 'junior',
    description: 'A migration script accidentally ran DROP TABLE payment_methods in production. The payment-service is throwing SQL errors on every transaction attempt.',
    topology_description: `E-commerce platform on Kubernetes (prod-us-east-1, 12 nodes).
Services: api-gateway, auth-service, user-service, payment-service, order-service, analytics-service, notification-service, checkout-service.
Database: postgres-primary. The payment_methods table was accidentally dropped by a faulty migration script (migration_042_add_payment_index.sql contained DROP TABLE payment_methods instead of CREATE INDEX).
Cache: redis-primary (healthy).
Root cause: payment_methods table missing from payments database. Every INSERT, SELECT, and UPDATE against payment_methods throws "ERROR: relation 'payment_methods' does not exist".`,
    initial_system_state: initial,
    failure_sequence: [
      {
        trigger_at_minutes: 0,
        description: 'payment-service goes down — every transaction throws table-not-found SQL error',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['payment-service'].status = 'down'
          s.services['payment-service'].error_rate = 1.0
          s.services['payment-service'].p99_latency_ms = 0

          s.active_incidents.push({
            id: uuidv4(),
            root_cause: "payment_methods table was dropped by migration_042_add_payment_index.sql — relation 'payment_methods' does not exist",
            visible_symptoms: [
              "payment-service: 100% error rate — SQL ERROR: relation 'payment_methods' does not exist",
              'payment-service: 0/3 pods healthy (all returning 500 on every request)',
              'All payment transactions failing immediately',
            ],
            blast_radius: ['payment-service'],
            injected_at: s.sim_time,
          })

          const alert = makeAlert('sev1', 'payment-service', "payment-service: DOWN. SQL ERROR on every request: relation 'payment_methods' does not exist. All transactions failing. Possible missing migration or dropped table.", s.sim_time)
          s.services['payment-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 3,
        description: 'order-service degrades as payment calls fail — order completion rate drops to zero',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['order-service'].status = 'degraded'
          s.services['order-service'].error_rate = 0.70
          s.services['order-service'].p99_latency_ms = 4500
          s.services['api-gateway'].error_rate = 0.28
          s.services['api-gateway'].p99_latency_ms = 1500

          const alert = makeAlert('sev1', 'order-service', 'order-service: 70% error rate. Payment step in checkout flow failing — all orders requiring payment cannot complete.', s.sim_time)
          s.services['order-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push(
            'order-service: 70% error rate — payment step failing for all new orders',
            'api-gateway: 28% error rate — checkout and order endpoints returning 500',
          )
          s.active_incidents[0].blast_radius.push('order-service', 'api-gateway')
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 6,
        description: 'DB query latency becomes effectively infinite — all queries to payment tables failing instantly',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.infrastructure.databases[0].query_latency_ms = 999999
          s.infrastructure.databases[0].status = 'degraded'
          s.services['checkout-service'].status = 'degraded'
          s.services['checkout-service'].error_rate = 0.65
          s.services['checkout-service'].p99_latency_ms = 3000

          const alert = makeAlert('sev1', 'postgres-primary', 'postgres-primary: query_latency_ms at maximum — all queries targeting payment_methods table failing with immediate error. Schema integrity compromised.', s.sim_time)
          s.infrastructure.databases[0].connection_count = 8
          s.active_incidents[0].visible_symptoms.push(
            'postgres-primary: effective query latency infinite — payment_methods queries return immediate error',
            'checkout-service: 65% error rate — payment processing unavailable',
          )
          s.active_incidents[0].blast_radius.push('checkout-service')
          return rebuildMetrics(s)
        },
      },
    ],
    expected_root_cause: "Migration script migration_042_add_payment_index.sql accidentally contained DROP TABLE payment_methods instead of CREATE INDEX. The payment_methods table no longer exists in the production database, causing all payment-service queries to fail with SQL error: relation 'payment_methods' does not exist.",
    expected_resolution_steps: [
      'kubectl logs payment-service-xxx to confirm SQL error: relation payment_methods does not exist',
      'Connect to postgres-primary: kubectl exec -it postgres-primary-xxx -- psql -U postgres payments',
      'Confirm table is missing: \\dt payment_methods (returns no rows)',
      'Check migration history: SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5',
      'Identify bad migration: migration_042_add_payment_index.sql — review git history for the DROP TABLE',
      'Restore from backup: pg_restore or apply last known-good snapshot of payment_methods schema + data',
      'Or recreate schema from migration history and restore data from point-in-time backup',
      'Verify table is back: \\dt payment_methods shows table exists',
      'kubectl rollout restart deployment/payment-service to clear error state',
      'Verify payment-service error rate drops to baseline',
    ],
    available_runbooks: [
      {
        id: 'rb-missing-table-001',
        title: 'Missing DB Table / Schema Corruption Runbook',
        content: `# Missing DB Table Investigation Runbook

## When to use
A service is throwing SQL errors like "relation does not exist" or "table not found".

## Step 1 — Confirm the error in service logs
\`\`\`bash
kubectl logs -l app=payment-service -n prod | grep -i "relation\\|table\\|does not exist"
\`\`\`

## Step 2 — Check DB schema directly
\`\`\`bash
kubectl exec -it <postgres-pod> -n prod -- psql -U postgres payments -c "\\dt"
# Look for payment_methods in the table list
kubectl exec -it <postgres-pod> -n prod -- psql -U postgres payments -c "\\dt payment_methods"
\`\`\`

## Step 3 — Check migration history
\`\`\`bash
kubectl exec -it <postgres-pod> -n prod -- psql -U postgres payments \\
  -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;"
\`\`\`

## Step 4 — Identify the bad migration
\`\`\`bash
# Find migration file in git
git log --oneline -- migrations/
git show HEAD:migrations/migration_042_add_payment_index.sql
# Look for accidental DROP TABLE statements
\`\`\`

## Step 5 — Restore from backup
\`\`\`bash
# Option A: Point-in-time restore (preferred for production)
# Use cloud console (AWS RDS, Cloud SQL) to restore to T-10min snapshot

# Option B: Restore just the table from pg_dump backup
pg_restore -h <host> -U postgres -d payments -t payment_methods /backups/payments_latest.dump

# Option C: Recreate table from schema (if no data loss acceptable)
psql -U postgres payments < migrations/initial_schema.sql
\`\`\`

## Step 6 — Restart payment-service
\`\`\`bash
kubectl rollout restart deployment/payment-service -n prod
kubectl rollout status deployment/payment-service -n prod -w
\`\`\`

## Prevention
- Never run migrations directly in production without a dry-run review step
- Gate migrations with a CI check that flags DROP TABLE statements for human approval
- Require migration peer review for all schema changes`,
      },
      {
        id: 'rb-incident-001',
        title: 'Incident Response Runbook',
        content: `# Incident Response Runbook\n\n## Severity\n- SEV1: Full outage, revenue impact\n- SEV2: Degraded, partial failures\n\n## Steps\n1. Acknowledge page (< 5 min)\n2. Declare severity\n3. Post to #incidents: what's affected, hypothesis\n4. Investigate → fix → verify\n5. Update every 15 min\n6. Resolve + schedule postmortem`,
      },
    ],
    available_dashboards: [
      { id: 'dash-db', name: 'Database Schema & Query Health', services: ['postgres-primary', 'payment-service'] },
      { id: 'dash-services', name: 'Service Error Rates & Latency', services: ['api-gateway', 'payment-service', 'order-service', 'checkout-service'] },
      { id: 'dash-overview', name: 'System Overview', services: ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'order-service', 'analytics-service', 'notification-service', 'checkout-service'] },
    ],
    passing_score: 55,
    time_limit_minutes: 15,
  }
}

export function checkMissingTableResolution(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  const isDbAction = lower.includes('psql') || lower.includes('pg_restore') || lower.includes('restore') || lower.includes('migration')
  const isK8sRestart = lower.includes('kubectl') && lower.includes('rollout restart')
  const isTableAction = lower.includes('payment_methods') || lower.includes('schema')
  return (isDbAction && isTableAction) || isK8sRestart
}
