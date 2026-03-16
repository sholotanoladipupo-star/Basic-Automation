import { v4 as uuidv4 } from 'uuid'
import { ScenarioTemplate, SystemState, Alert } from '../types'

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T
}

function buildInitialState(sessionId: string): SystemState {
  return {
    session_id: sessionId,
    scenario_id: 'cache-db-cascade-v1',
    sim_time: '2024-01-15T14:00:00Z',
    services: {
      'api-gateway': {
        name: 'api-gateway',
        status: 'healthy',
        error_rate: 0.01,
        p99_latency_ms: 45,
        dependencies: ['product-service', 'order-service', 'user-service'],
        current_alerts: []
      },
      'product-service': {
        name: 'product-service',
        status: 'healthy',
        error_rate: 0.01,
        p99_latency_ms: 30,
        dependencies: ['redis-primary', 'postgres-primary'],
        current_alerts: []
      },
      'order-service': {
        name: 'order-service',
        status: 'healthy',
        error_rate: 0.01,
        p99_latency_ms: 55,
        dependencies: ['redis-primary', 'postgres-primary', 'payment-service'],
        current_alerts: []
      },
      'payment-service': {
        name: 'payment-service',
        status: 'healthy',
        error_rate: 0.01,
        p99_latency_ms: 80,
        dependencies: ['postgres-primary', 'stripe-api'],
        current_alerts: []
      },
      'user-service': {
        name: 'user-service',
        status: 'healthy',
        error_rate: 0.01,
        p99_latency_ms: 25,
        dependencies: ['redis-primary', 'postgres-replica'],
        current_alerts: []
      }
    },
    active_incidents: [],
    resolved_incidents: [],
    infrastructure: {
      clusters: [
        { name: 'prod-us-east-1', nodes: 6, healthy_nodes: 6 }
      ],
      databases: [
        {
          name: 'postgres-primary',
          status: 'healthy',
          connection_count: 45,
          max_connections: 200,
          query_latency_ms: 12
        },
        {
          name: 'postgres-replica',
          status: 'healthy',
          connection_count: 20,
          max_connections: 100,
          query_latency_ms: 15
        }
      ],
      caches: [
        {
          name: 'redis-primary',
          status: 'healthy',
          hit_rate: 0.94,
          memory_used_mb: 2400,
          memory_total_mb: 4096
        }
      ],
      external_deps: [
        { name: 'stripe-api', status: 'healthy', latency_ms: 180 },
        { name: 'sendgrid-api', status: 'healthy', latency_ms: 95 }
      ]
    },
    metrics_snapshot: {
      'api-gateway.error_rate': 0.01,
      'api-gateway.p99_latency_ms': 45,
      'product-service.error_rate': 0.01,
      'product-service.p99_latency_ms': 30,
      'order-service.error_rate': 0.01,
      'order-service.p99_latency_ms': 55,
      'payment-service.error_rate': 0.01,
      'payment-service.p99_latency_ms': 80,
      'user-service.error_rate': 0.01,
      'user-service.p99_latency_ms': 25,
      'redis-primary.hit_rate': 0.94,
      'redis-primary.memory_used_mb': 2400,
      'postgres-primary.connection_count': 45,
      'postgres-primary.query_latency_ms': 12,
      'postgres-replica.connection_count': 20,
      'postgres-replica.query_latency_ms': 15
    }
  }
}

function rebuildMetricsSnapshot(state: SystemState): SystemState {
  const s = state
  s.metrics_snapshot = {
    'api-gateway.error_rate': s.services['api-gateway']?.error_rate ?? 0,
    'api-gateway.p99_latency_ms': s.services['api-gateway']?.p99_latency_ms ?? 0,
    'product-service.error_rate': s.services['product-service']?.error_rate ?? 0,
    'product-service.p99_latency_ms': s.services['product-service']?.p99_latency_ms ?? 0,
    'order-service.error_rate': s.services['order-service']?.error_rate ?? 0,
    'order-service.p99_latency_ms': s.services['order-service']?.p99_latency_ms ?? 0,
    'payment-service.error_rate': s.services['payment-service']?.error_rate ?? 0,
    'payment-service.p99_latency_ms': s.services['payment-service']?.p99_latency_ms ?? 0,
    'user-service.error_rate': s.services['user-service']?.error_rate ?? 0,
    'user-service.p99_latency_ms': s.services['user-service']?.p99_latency_ms ?? 0,
    'redis-primary.hit_rate': s.infrastructure.caches[0]?.hit_rate ?? 0,
    'redis-primary.memory_used_mb': s.infrastructure.caches[0]?.memory_used_mb ?? 0,
    'postgres-primary.connection_count': s.infrastructure.databases[0]?.connection_count ?? 0,
    'postgres-primary.query_latency_ms': s.infrastructure.databases[0]?.query_latency_ms ?? 0,
    'postgres-replica.connection_count': s.infrastructure.databases[1]?.connection_count ?? 0,
    'postgres-replica.query_latency_ms': s.infrastructure.databases[1]?.query_latency_ms ?? 0
  }
  return s
}

function makeAlert(severity: 'sev1' | 'sev2' | 'sev3', service: string, message: string, sim_time: string): Alert {
  return {
    id: uuidv4(),
    severity,
    service,
    message,
    fired_at: sim_time,
    acknowledged: false
  }
}

export function getCacheDatabaseCascadeScenario(sessionId: string): ScenarioTemplate {
  const initial = buildInitialState(sessionId)

  return {
    id: 'cache-db-cascade-v1',
    name: 'Redis Cache Failure → Database Cascade',
    difficulty: 'senior',
    description: 'The Redis primary cache cluster has gone down, causing a cache miss storm that is overwhelming the PostgreSQL primary database. Services that depend on the cache are starting to degrade as database connections are exhausted.',
    topology_description: `E-commerce platform running on Kubernetes (prod-us-east-1, 6 nodes).
Services: api-gateway, product-service, order-service, payment-service, user-service.
Cache: redis-primary (Redis 7 cluster, 4096MB).
Databases: postgres-primary (200 max connections), postgres-replica (100 max connections, read replica).
External: stripe-api, sendgrid-api.
Dependencies: product-service, order-service, user-service all depend on redis-primary for session/query caching. All services write/read from postgres-primary. user-service reads from postgres-replica.`,
    initial_system_state: initial,
    failure_sequence: [
      {
        trigger_at_minutes: 0,
        description: 'Redis primary cluster goes down (OOM crash)',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          const redis = s.infrastructure.caches[0]
          redis.status = 'down'
          redis.hit_rate = 0
          redis.memory_used_mb = 0

          const incident = {
            id: uuidv4(),
            root_cause: 'Redis primary cluster crashed due to out-of-memory condition — all cache nodes unreachable on port 6379',
            visible_symptoms: [
              'Redis connection refused on port 6379',
              'Cache hit rate dropped to 0%',
              'PagerDuty alert: redis-primary unreachable'
            ],
            blast_radius: ['product-service', 'order-service', 'user-service', 'postgres-primary'],
            injected_at: s.sim_time
          }
          s.active_incidents.push(incident)

          const alert = makeAlert('sev2', 'redis-primary', 'redis-primary: All cache nodes unreachable. Connection refused on port 6379. Cache hit rate: 0%.', s.sim_time)
          s.services['product-service'].current_alerts.push(alert)

          return rebuildMetricsSnapshot(s)
        }
      },
      {
        trigger_at_minutes: 0.5,
        description: 'DB connection pool flooding from cache miss storm',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          const pgPrimary = s.infrastructure.databases[0]
          const pgReplica = s.infrastructure.databases[1]
          pgPrimary.connection_count = 180
          pgPrimary.query_latency_ms = 850
          pgPrimary.status = 'degraded'
          pgReplica.connection_count = 95
          pgReplica.query_latency_ms = 1200
          pgReplica.status = 'degraded'

          s.services['product-service'].error_rate = 0.15
          s.services['product-service'].p99_latency_ms = 3200
          s.services['product-service'].status = 'degraded'

          const alert = makeAlert('sev2', 'postgres-primary', 'postgres-primary: Connection pool at 90% capacity (180/200). Query p99 latency=850ms. Cache miss storm suspected.', s.sim_time)
          s.services['product-service'].current_alerts.push(alert)

          return rebuildMetricsSnapshot(s)
        }
      },
      {
        trigger_at_minutes: 1.5,
        description: 'Order service degraded, payment service impacted',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['order-service'].status = 'degraded'
          s.services['order-service'].error_rate = 0.45
          s.services['order-service'].p99_latency_ms = 8500
          s.services['payment-service'].error_rate = 0.12
          s.services['payment-service'].p99_latency_ms = 4200
          s.services['payment-service'].status = 'degraded'

          const alert = makeAlert('sev1', 'order-service', 'order-service: Error rate 45%. Orders are failing. Customer impact confirmed. Revenue at risk.', s.sim_time)
          s.services['order-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push('order-service error rate 45%', 'payment-service latency p99=4200ms')

          return rebuildMetricsSnapshot(s)
        }
      },
      {
        trigger_at_minutes: 4,
        description: 'PostgreSQL primary down — max connections exceeded',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          // Only apply if redis is still down
          const redis = s.infrastructure.caches[0]
          if (redis.status !== 'down') return s

          const pgPrimary = s.infrastructure.databases[0]
          pgPrimary.status = 'down'
          pgPrimary.connection_count = 200
          pgPrimary.query_latency_ms = 999999

          s.services['order-service'].status = 'down'
          s.services['order-service'].error_rate = 1.0
          s.services['payment-service'].status = 'degraded'
          s.services['payment-service'].error_rate = 0.8
          s.services['api-gateway'].error_rate = 0.6
          s.services['api-gateway'].p99_latency_ms = 15000

          const alert = makeAlert('sev1', 'postgres-primary', 'postgres-primary: DATABASE DOWN. Max connections exceeded (200/200). All writes failing. IMMEDIATE ACTION REQUIRED.', s.sim_time)
          s.services['order-service'].current_alerts.push(alert)
          s.active_incidents[0].blast_radius.push('api-gateway')

          return rebuildMetricsSnapshot(s)
        }
      }
    ],
    expected_root_cause: 'Redis primary cache cluster crashed (OOM), causing all cache-dependent services to hit PostgreSQL directly, exhausting the connection pool and cascading into full database unavailability.',
    expected_resolution_steps: [
      'Acknowledge the redis-primary alert',
      'Identify redis as the root cause via kubectl/redis-cli',
      'Restart or recover the redis-primary cluster',
      'Monitor postgres connection count dropping as cache warms up',
      'Verify service error rates returning to baseline',
      'Declare incident resolved'
    ],
    available_runbooks: [
      {
        id: 'rb-redis-001',
        title: 'Redis Recovery Runbook',
        content: `# Redis Recovery Runbook

## When to use
Use this runbook when redis-primary is unreachable or showing degraded performance.

## Diagnostic Steps

1. Check Redis cluster status:
\`\`\`
kubectl get pods -n cache -l app=redis
kubectl exec -it redis-primary-0 -n cache -- redis-cli ping
kubectl exec -it redis-primary-0 -n cache -- redis-cli cluster info
\`\`\`

2. Check Redis logs for OOM or crash:
\`\`\`
kubectl logs redis-primary-0 -n cache --previous --tail=100
kubectl describe pod redis-primary-0 -n cache
\`\`\`

3. Check memory usage:
\`\`\`
kubectl exec -it redis-primary-0 -n cache -- redis-cli info memory
\`\`\`

## Recovery Steps

### If OOM crash (most common):
1. Restart the crashed pods:
\`\`\`
kubectl rollout restart statefulset/redis-primary -n cache
\`\`\`

2. Monitor restart:
\`\`\`
kubectl rollout status statefulset/redis-primary -n cache -w
\`\`\`

3. Verify cluster health after restart:
\`\`\`
kubectl exec -it redis-primary-0 -n cache -- redis-cli cluster info
kubectl exec -it redis-primary-0 -n cache -- redis-cli ping
\`\`\`

4. Check cache hit rate recovering (should rise above 80% within 5 minutes as cache warms up).

### If cluster split-brain:
1. Check cluster nodes: \`redis-cli cluster nodes\`
2. Reset cluster if needed: \`redis-cli cluster reset\`
3. Follow cluster re-join procedure in runbook RB-REDIS-002.

## Post-Recovery Checks
- Verify postgres connection count drops below 50
- Verify service error rates return to < 2%
- Add postmortem note about OOM configuration`
      },
      {
        id: 'rb-db-001',
        title: 'Database Connection Pool Runbook',
        content: `# Database Connection Pool Runbook

## When to use
Use when postgres connection count is high or query latency is degraded.

## Diagnostic Steps

1. Check current connections:
\`\`\`
kubectl exec -it postgres-primary-0 -n db -- psql -U postgres -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
\`\`\`

2. Find long-running queries:
\`\`\`
kubectl exec -it postgres-primary-0 -n db -- psql -U postgres -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"
\`\`\`

3. Check if connection pool is from a specific service:
\`\`\`
kubectl exec -it postgres-primary-0 -n db -- psql -U postgres -c "SELECT application_name, count(*) FROM pg_stat_activity GROUP BY application_name ORDER BY count DESC;"
\`\`\`

## Recovery Steps

### Kill idle connections:
\`\`\`
kubectl exec -it postgres-primary-0 -n db -- psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '10 minutes';"
\`\`\`

### Restart PgBouncer (connection pooler) if available:
\`\`\`
kubectl rollout restart deployment/pgbouncer -n db
\`\`\`

## Root Cause Note
High connection counts without increased traffic often indicate a caching layer failure (check Redis status first).`
      },
      {
        id: 'rb-incident-001',
        title: 'Incident Response Runbook',
        content: `# Incident Response Runbook

## Severity Definitions
- **SEV1**: Customer-facing impact, revenue at risk, or data loss. Immediate response required.
- **SEV2**: Degraded performance affecting a subset of users or non-critical systems.
- **SEV3**: Minor issue, no immediate customer impact.

## Escalation Matrix
- SEV1: Page on-call SRE lead + Engineering Manager immediately
- SEV2: Notify #sre-team Slack channel, 15-minute SLA for acknowledgement
- SEV3: Create ticket, handle during business hours

## Incident Response Steps

1. **Acknowledge the page** within 5 minutes
2. **Declare severity** based on customer impact
3. **Notify stakeholders** in #incidents Slack channel:
   - What is affected
   - Estimated customer impact
   - Initial hypothesis
   - Next steps

4. **Investigate** using available dashboards, logs, and runbooks

5. **Update #incidents** every 15 minutes with status

6. **Resolve** once services return to normal
   - Post resolution message with timeline
   - Schedule postmortem within 48 hours

## Communication Template
\`\`\`
[INCIDENT UPDATE - SEV{X}]
Impact: {what is affected}
Customer impact: {estimated % of users affected}
Status: {investigating / identified / mitigating / resolved}
Actions taken: {list of actions}
Next update in: {X} minutes
\`\`\``
      }
    ],
    available_dashboards: [
      {
        id: 'dash-overview',
        name: 'System Overview',
        services: ['api-gateway', 'product-service', 'order-service', 'payment-service', 'user-service', 'redis-primary', 'postgres-primary']
      },
      {
        id: 'dash-cache',
        name: 'Cache & Database Performance',
        services: ['redis-primary', 'postgres-primary', 'postgres-replica']
      },
      {
        id: 'dash-services',
        name: 'Service Error Rates & Latency',
        services: ['api-gateway', 'product-service', 'order-service', 'payment-service', 'user-service']
      }
    ],
    passing_score: 65,
    time_limit_minutes: 10
  }
}

export function checkResolutionAttempt(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  const hasRedis = lower.includes('redis')
  const hasAction = lower.includes('restart') || lower.includes('recover') || lower.includes('start') ||
    lower.includes('fix') || lower.includes('rollout') || lower.includes('kubectl')
  return hasRedis && hasAction
}
