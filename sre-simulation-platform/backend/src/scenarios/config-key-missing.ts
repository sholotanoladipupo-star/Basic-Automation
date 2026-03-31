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
    scenario_id: 'config-key-missing',
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

export function getConfigKeyMissingScenario(sessionId: string): ScenarioTemplate {
  const initial = buildInitialState(sessionId)
  rebuildMetrics(initial)

  return {
    id: 'config-key-missing',
    name: 'Missing Config Key — REDIS_AUTH_TOKEN Not Set',
    difficulty: 'junior',
    description: 'A new deployment of checkout-service is missing the REDIS_AUTH_TOKEN environment variable in the ConfigMap. Pods start but immediately fail on first Redis operation.',
    topology_description: `E-commerce platform on Kubernetes (prod-us-east-1, 12 nodes).
Services: api-gateway, auth-service, user-service, payment-service, order-service, analytics-service, notification-service, checkout-service.
Cache: redis-primary (AUTH enabled — requires token).
Database: postgres-primary (healthy).
Root cause: checkout-service v1.9.0 was deployed with a new ConfigMap that omitted REDIS_AUTH_TOKEN. When pods start and attempt the first Redis connection, Redis rejects the unauthenticated connection with NOAUTH Authentication required. Pods are running but every request fails at the cache layer.`,
    initial_system_state: initial,
    failure_sequence: [
      {
        trigger_at_minutes: 0,
        description: 'checkout-service pods start but immediately fail all requests — Redis auth failure on every operation',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['checkout-service'].status = 'down'
          s.services['checkout-service'].error_rate = 1.0
          s.services['checkout-service'].p99_latency_ms = 0

          s.active_incidents.push({
            id: uuidv4(),
            root_cause: 'REDIS_AUTH_TOKEN missing from checkout-service ConfigMap in production namespace — Redis rejecting all connections with NOAUTH error',
            visible_symptoms: [
              'checkout-service: 100% error rate — Redis NOAUTH: Authentication required on every request',
              'checkout-service pods: Running (not crashing) but returning 500 on all endpoints',
              'kubectl logs checkout-service-xxx: "RedisError: NOAUTH Authentication required"',
            ],
            blast_radius: ['checkout-service'],
            injected_at: s.sim_time,
          })

          const alert = makeAlert('sev1', 'checkout-service', 'checkout-service: DOWN. All requests returning 500. Redis error: NOAUTH Authentication required. Check REDIS_AUTH_TOKEN in ConfigMap.', s.sim_time)
          s.services['checkout-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 1,
        description: 'Cache hit rate collapses — checkout-service unable to read or write any cache entries',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.infrastructure.caches[0].hit_rate = 0.02
          s.infrastructure.caches[0].status = 'degraded'

          const alert = makeAlert('sev2', 'redis-primary', 'redis-primary: Cache hit_rate collapsed to 0.02. checkout-service unable to authenticate — all cache reads and writes failing. Other services beginning to experience cache miss pressure.', s.sim_time)
          s.active_incidents[0].visible_symptoms.push(
            'redis-primary: cache hit_rate dropped from 0.92 to 0.02 — checkout-service cache ops all failing',
            'Cache miss pressure beginning to affect DB read load',
          )
          s.active_incidents[0].blast_radius.push('redis-primary')
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 4,
        description: 'order-service and payment-service degrade due to cache unavailability increasing DB load',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['order-service'].status = 'degraded'
          s.services['order-service'].error_rate = 0.25
          s.services['order-service'].p99_latency_ms = 3500
          s.services['payment-service'].status = 'degraded'
          s.services['payment-service'].error_rate = 0.20
          s.services['payment-service'].p99_latency_ms = 2800
          s.services['api-gateway'].error_rate = 0.30
          s.services['api-gateway'].p99_latency_ms = 1800
          s.infrastructure.databases[0].connection_count = 95
          s.infrastructure.databases[0].query_latency_ms = 380

          const alert = makeAlert('sev1', 'order-service', 'order-service: 25% error rate. Cache unavailable — falling back to direct DB reads. DB connection count rising to 95. payment-service also degraded (20% error rate).', s.sim_time)
          s.services['order-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push(
            'order-service: 25% error rate — cache miss fallback overloading DB',
            'payment-service: 20% error rate — session cache unavailable',
            'api-gateway: 30% error rate — checkout and order flows failing',
            'postgres-primary: connection_count at 95, query_latency_ms at 380ms',
          )
          s.active_incidents[0].blast_radius.push('order-service', 'payment-service', 'api-gateway')
          return rebuildMetrics(s)
        },
      },
    ],
    expected_root_cause: 'REDIS_AUTH_TOKEN environment variable was omitted from the checkout-service ConfigMap during the v1.9.0 deployment. Redis is configured to require authentication (requirepass). Every Redis operation from checkout-service fails with NOAUTH error, causing all checkout requests to return 500.',
    expected_resolution_steps: [
      'kubectl get pods -l app=checkout-service -n prod to confirm pods are Running but unhealthy',
      'kubectl logs checkout-service-xxx -n prod to find NOAUTH Redis error',
      'kubectl describe pod checkout-service-xxx -n prod to list environment variables and confirm REDIS_AUTH_TOKEN is absent',
      'kubectl describe configmap checkout-service-config -n prod to confirm missing key',
      'kubectl get secret redis-auth -n prod -o yaml to retrieve the correct token value',
      'kubectl patch configmap checkout-service-config -n prod --patch adding REDIS_AUTH_TOKEN key',
      'kubectl rollout restart deployment/checkout-service -n prod',
      'kubectl rollout status deployment/checkout-service -n prod -w',
      'Verify checkout-service error rate drops to baseline',
      'Verify redis-primary hit_rate recovers',
    ],
    available_runbooks: [
      {
        id: 'rb-config-missing-001',
        title: 'Missing ConfigMap Key Runbook',
        content: `# Missing ConfigMap Key Investigation Runbook

## When to use
A service is returning errors immediately after a new deployment. Pods are Running but all requests fail.

## Step 1 — Check pod logs for startup errors
\`\`\`bash
kubectl logs -l app=checkout-service -n prod | head -50
# Look for: env var undefined, Redis NOAUTH, connection refused, missing config
\`\`\`

## Step 2 — List all env vars in the running pod
\`\`\`bash
kubectl describe pod <pod-name> -n prod | grep -A 50 "Environment:"
# Or get the full env:
kubectl exec <pod-name> -n prod -- env | sort
\`\`\`

## Step 3 — Check the ConfigMap
\`\`\`bash
kubectl get configmap checkout-service-config -n prod -o yaml
# Compare against expected keys from deployment manifest or staging ConfigMap
\`\`\`

## Step 4 — Get the missing value from Secrets
\`\`\`bash
kubectl get secrets -n prod
kubectl get secret redis-auth -n prod -o jsonpath='{.data.REDIS_AUTH_TOKEN}' | base64 -d
\`\`\`

## Step 5 — Add the missing key to ConfigMap
\`\`\`bash
kubectl patch configmap checkout-service-config -n prod \\
  --patch '{"data": {"REDIS_AUTH_TOKEN": "<token-value>"}}'

# Verify the patch
kubectl get configmap checkout-service-config -n prod -o yaml | grep REDIS_AUTH
\`\`\`

## Step 6 — Restart the deployment to pick up new config
\`\`\`bash
kubectl rollout restart deployment/checkout-service -n prod
kubectl rollout status deployment/checkout-service -n prod -w
\`\`\`

## Step 7 — Verify
\`\`\`bash
kubectl logs -l app=checkout-service -n prod | tail -20
# Should show successful Redis connections, no NOAUTH errors
\`\`\`

## Prevention
- Add a startup config validation step to checkout-service that lists required env vars and fails fast with a clear error if any are missing
- Use a CI diff check that compares ConfigMap keys between staging and production before every deploy`,
      },
      {
        id: 'rb-incident-001',
        title: 'Incident Response Runbook',
        content: `# Incident Response Runbook\n\n## Severity\n- SEV1: Full outage, revenue impact\n- SEV2: Degraded, partial failures\n\n## Steps\n1. Acknowledge page (< 5 min)\n2. Declare severity\n3. Post to #incidents: what's affected, hypothesis\n4. Investigate → fix → verify\n5. Update every 15 min\n6. Resolve + schedule postmortem`,
      },
    ],
    available_dashboards: [
      { id: 'dash-cache', name: 'Redis Cache Health & Hit Rate', services: ['redis-primary', 'checkout-service'] },
      { id: 'dash-services', name: 'Service Error Rates & Latency', services: ['api-gateway', 'checkout-service', 'order-service', 'payment-service'] },
      { id: 'dash-overview', name: 'System Overview', services: ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'order-service', 'analytics-service', 'notification-service', 'checkout-service'] },
    ],
    passing_score: 55,
    time_limit_minutes: 15,
  }
}

export function checkConfigKeyMissingResolution(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  const isK8s = lower.includes('kubectl')
  const isFixAction = lower.includes('patch configmap') || lower.includes('edit configmap') ||
    lower.includes('rollout restart') || lower.includes('redis_auth_token') ||
    lower.includes('checkout-service-config')
  return isK8s && isFixAction
}
