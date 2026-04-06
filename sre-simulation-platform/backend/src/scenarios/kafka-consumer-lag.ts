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
    scenario_id: 'kafka-consumer-lag',
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

export function getKafkaConsumerLagScenario(sessionId: string): ScenarioTemplate {
  const initial = buildInitialState(sessionId)
  rebuildMetrics(initial)

  return {
    id: 'kafka-consumer-lag',
    name: 'Event Processing Degradation',
    difficulty: 'senior',
    description: 'A code regression in the transaction-processor service causes it to process messages 50x slower. Consumer lag on the transactions topic has grown to 2M+ messages.',
    topology_description: `E-commerce platform on Kubernetes (prod-us-east-1, 12 nodes).
Services: api-gateway, auth-service, user-service, payment-service, order-service, analytics-service, notification-service, checkout-service.
Message bus: Kafka cluster — topics: transactions, order-events, notifications.
Database: postgres-primary (healthy at start).
Cache: redis-primary (healthy).
Root cause: A code regression introduced an N+1 DB query in transaction-processor's message handler. Processing time went from 4ms/message to 200ms/message. Consumer group "transaction-processor-cg" has a lag of 2,100,000 messages on the transactions topic and is falling further behind at ~100k messages/minute.`,
    initial_system_state: initial,
    failure_sequence: [
      {
        trigger_at_minutes: 0,
        description: 'analytics-service consuming stale data — transaction events delayed by hours in Kafka backlog',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['analytics-service'].status = 'degraded'
          s.services['analytics-service'].error_rate = 0.30
          s.services['analytics-service'].p99_latency_ms = 8000

          s.active_incidents.push({
            id: uuidv4(),
            root_cause: 'N+1 DB query regression in transaction-processor v2.4.2 — message processing 50x slower, consumer lag 2.1M messages on transactions topic',
            visible_symptoms: [
              'Kafka consumer group transaction-processor-cg: lag 2,100,000 messages on transactions topic',
              'transaction-processor: processing 200ms/message (was 4ms) — N+1 query executing SELECT per transaction item',
              'analytics-service: reporting stale data — receiving events hours behind real-time',
            ],
            blast_radius: ['analytics-service'],
            injected_at: s.sim_time,
          })

          const alert = makeAlert('sev2', 'analytics-service', 'analytics-service: Consumer lag on transactions topic at 2,100,000 messages. Data in dashboards is 3+ hours stale. transaction-processor throughput severely degraded.', s.sim_time)
          s.services['analytics-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 2,
        description: 'notification-service degrading — webhook and email notifications delayed by growing Kafka backlog',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['notification-service'].status = 'degraded'
          s.services['notification-service'].error_rate = 0.45
          s.services['notification-service'].p99_latency_ms = 12000

          const alert = makeAlert('sev2', 'notification-service', 'notification-service: Outgoing webhooks and order confirmation emails delayed 4+ hours. Consumer lag growing — notifications-cg processing backed up messages from Kafka.', s.sim_time)
          s.services['notification-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push(
            'notification-service: 45% error rate — webhook delivery timeouts as downstream systems reject stale events',
            'Order confirmation emails delayed 4+ hours (customer-visible)',
          )
          s.active_incidents[0].blast_radius.push('notification-service')
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 4,
        description: 'order-service degrading — order confirmation flow depends on transaction-processor acknowledgement',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['order-service'].status = 'degraded'
          s.services['order-service'].error_rate = 0.35
          s.services['order-service'].p99_latency_ms = 6000
          s.services['api-gateway'].error_rate = 0.15
          s.services['api-gateway'].p99_latency_ms = 800

          const alert = makeAlert('sev1', 'order-service', 'order-service: Order confirmation flow degraded. 35% of orders stuck in "processing" state waiting for transaction-processor Kafka consumer to catch up. Backlog now 2.5M messages.', s.sim_time)
          s.services['order-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push(
            'order-service: 35% of orders stuck in processing — waiting for transaction events',
            'Kafka transactions topic lag now 2,500,000 — still growing',
            'api-gateway: 15% elevated error rate on order status endpoints',
          )
          s.active_incidents[0].blast_radius.push('order-service', 'api-gateway')
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 7,
        description: 'DB connection pool exhausted — N+1 queries from transaction-processor holding connections open',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.infrastructure.databases[0].connection_count = 198
          s.infrastructure.databases[0].query_latency_ms = 4500
          s.infrastructure.databases[0].status = 'degraded'

          const alert = makeAlert('sev1', 'postgres-primary', 'postgres-primary: connection_count at 198/200 (max_connections - 2). N+1 queries from transaction-processor holding DB connections open. New connections being rejected. All services at risk.', s.sim_time)
          s.active_incidents[0].visible_symptoms.push(
            'postgres-primary: 198/200 connections in use — connection pool near exhaustion',
            'New DB connections being queued/rejected — cascading risk to all services',
            'DB query_latency_ms: 4500ms — heavy contention from N+1 SELECT storm',
          )
          s.active_incidents[0].blast_radius.push('postgres-primary')
          return rebuildMetrics(s)
        },
      },
    ],
    expected_root_cause: 'Code regression in transaction-processor v2.4.2 introduced an N+1 DB query: for each Kafka message, the handler executes one SELECT per transaction line item instead of a single batched query. Processing time increased from 4ms to 200ms per message (50x). Consumer group lag grew to 2.1M+ messages on the transactions topic, cascading to analytics, notifications, and order confirmations.',
    expected_resolution_steps: [
      'Check Kafka consumer lag: kubectl exec -it kafka-xxx -- kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group transaction-processor-cg',
      'Identify slow consumer: kubectl top pods -l app=transaction-processor',
      'Check transaction-processor logs: kubectl logs -l app=transaction-processor | grep -i "slow\\|query\\|latency"',
      'Profile DB queries: kubectl exec postgres-xxx -- psql -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10"',
      'Confirm N+1 pattern: look for repeated SELECT queries per message in transaction-processor logs',
      'Deploy hotfix: kubectl set image deployment/transaction-processor processor=transaction-processor:v2.4.3-hotfix',
      'Verify processing rate recovers: watch kubectl exec kafka-xxx -- kafka-consumer-groups.sh --describe --group transaction-processor-cg',
      'If lag too large to catch up naturally: reset consumer group to recent offset after hotfix: kubectl exec kafka-xxx -- kafka-consumer-groups.sh --reset-offsets --to-datetime 2024-01-15T13:50:00Z --group transaction-processor-cg --topic transactions --execute',
      'Monitor DB connection count drops back to baseline',
    ],
    available_runbooks: [
      {
        id: 'rb-kafka-lag-001',
        title: 'Kafka Consumer Lag Investigation Runbook',
        content: `# Kafka Consumer Lag Investigation Runbook

## When to use
Kafka consumer group lag is growing. Downstream services receiving stale or delayed data.

## Step 1 — Measure the lag
\`\`\`bash
kubectl exec -it <kafka-pod> -n prod -- \\
  kafka-consumer-groups.sh --bootstrap-server localhost:9092 \\
  --describe --group transaction-processor-cg
# Look at LAG column — should be near 0 for a healthy consumer
\`\`\`

## Step 2 — Identify which consumer is slow
\`\`\`bash
kubectl top pods -l app=transaction-processor -n prod
kubectl logs -l app=transaction-processor -n prod | tail -100
# Look for: slow processing times, DB errors, N+1 patterns
\`\`\`

## Step 3 — Check DB query performance
\`\`\`bash
kubectl exec -it <postgres-pod> -n prod -- psql -U postgres \\
  -c "SELECT query, calls, mean_exec_time, rows FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
# N+1 pattern: same query appearing thousands of times with low rows-per-call
\`\`\`

## Step 4 — Deploy hotfix
\`\`\`bash
# Roll back to last known-good version
kubectl rollout undo deployment/transaction-processor -n prod

# OR deploy specific hotfix image
kubectl set image deployment/transaction-processor \\
  processor=transaction-processor:v2.4.3-hotfix -n prod
kubectl rollout status deployment/transaction-processor -n prod -w
\`\`\`

## Step 5 — Monitor recovery
\`\`\`bash
# Watch lag shrink
watch -n 5 'kubectl exec <kafka-pod> -n prod -- kafka-consumer-groups.sh \\
  --bootstrap-server localhost:9092 --describe --group transaction-processor-cg'
\`\`\`

## Step 6 — Reset offsets if lag is unrecoverable
\`\`\`bash
# Only if lag is too large and data can be skipped or re-ingested from source
kubectl exec <kafka-pod> -n prod -- kafka-consumer-groups.sh \\
  --bootstrap-server localhost:9092 \\
  --reset-offsets --to-latest \\
  --group transaction-processor-cg --topic transactions --execute
\`\`\`

## Prevention
- Alert when consumer lag exceeds 100k messages for > 5 minutes
- Add DB query performance tests to transaction-processor CI pipeline
- Use pg_stat_statements monitoring to detect N+1 regressions post-deploy`,
      },
      {
        id: 'rb-incident-001',
        title: 'Incident Response Runbook',
        content: `# Incident Response Runbook\n\n## Severity\n- SEV1: Full outage, revenue impact\n- SEV2: Degraded, partial failures\n\n## Steps\n1. Acknowledge page (< 5 min)\n2. Declare severity\n3. Post to #incidents: what's affected, hypothesis\n4. Investigate → fix → verify\n5. Update every 15 min\n6. Resolve + schedule postmortem`,
      },
    ],
    available_dashboards: [
      { id: 'dash-kafka', name: 'Kafka Consumer Group Lag', services: ['analytics-service', 'notification-service', 'order-service'] },
      { id: 'dash-db', name: 'Database Connections & Query Performance', services: ['postgres-primary'] },
      { id: 'dash-services', name: 'Service Error Rates & Latency', services: ['api-gateway', 'order-service', 'analytics-service', 'notification-service'] },
      { id: 'dash-overview', name: 'System Overview', services: ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'order-service', 'analytics-service', 'notification-service', 'checkout-service'] },
    ],
    passing_score: 65,
    time_limit_minutes: 20,
  }
}

export function checkKafkaConsumerLagResolution(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  const isKafkaAction = lower.includes('kafka-consumer-groups') || lower.includes('consumer-group') ||
    lower.includes('reset-offsets') || lower.includes('kafka')
  const isK8sAction = lower.includes('kubectl') && (
    lower.includes('rollout') || lower.includes('set image') || lower.includes('logs')
  )
  return isKafkaAction || isK8sAction
}
