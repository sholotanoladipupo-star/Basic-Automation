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
    'checkout-service.error_rate': s.services['checkout-service']?.error_rate ?? 0,
    'checkout-service.p99_latency_ms': s.services['checkout-service']?.p99_latency_ms ?? 0,
    'inventory-service.error_rate': s.services['inventory-service']?.error_rate ?? 0,
    'inventory-service.p99_latency_ms': s.services['inventory-service']?.p99_latency_ms ?? 0,
    'notification-service.error_rate': s.services['notification-service']?.error_rate ?? 0,
    'notification-service.p99_latency_ms': s.services['notification-service']?.p99_latency_ms ?? 0,
    'postgres-primary.connection_count': s.infrastructure.databases[0]?.connection_count ?? 0,
    'postgres-primary.query_latency_ms': s.infrastructure.databases[0]?.query_latency_ms ?? 0,
    'cluster.healthy_nodes': s.infrastructure.clusters[0]?.healthy_nodes ?? 0,
  }
  return s
}

function buildInitialState(sessionId: string): SystemState {
  return {
    session_id: sessionId,
    scenario_id: 'pod-crashloop',
    sim_time: '2024-01-15T14:00:00Z',
    services: {
      'api-gateway': { name: 'api-gateway', status: 'healthy', error_rate: 0.01, p99_latency_ms: 40, dependencies: ['checkout-service', 'inventory-service', 'notification-service'], current_alerts: [] },
      'checkout-service': { name: 'checkout-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 65, dependencies: ['postgres-primary', 'inventory-service'], current_alerts: [] },
      'inventory-service': { name: 'inventory-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 35, dependencies: ['postgres-primary'], current_alerts: [] },
      'notification-service': { name: 'notification-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 50, dependencies: ['postgres-primary'], current_alerts: [] },
    },
    active_incidents: [],
    resolved_incidents: [],
    infrastructure: {
      clusters: [{ name: 'prod-us-east-1', nodes: 6, healthy_nodes: 6 }],
      databases: [
        { name: 'postgres-primary', status: 'healthy', connection_count: 38, max_connections: 200, query_latency_ms: 12 },
      ],
      caches: [{ name: 'redis-primary', status: 'healthy', hit_rate: 0.90, memory_used_mb: 1900, memory_total_mb: 4096 }],
      external_deps: [
        { name: 'stripe-api', status: 'healthy', latency_ms: 180 },
        { name: 'sendgrid-api', status: 'healthy', latency_ms: 90 },
      ],
    },
    metrics_snapshot: {},
  }
}

export function getPodCrashLoopScenario(sessionId: string): ScenarioTemplate {
  const initial = buildInitialState(sessionId)
  rebuildMetrics(initial)

  return {
    id: 'pod-crashloop',
    name: 'checkout-service Pods in CrashLoopBackOff',
    difficulty: 'senior',
    description: 'A bad ConfigMap change during a routine config rotation introduced an invalid DATABASE_URL environment variable for checkout-service. All 3 checkout-service pods are in CrashLoopBackOff. Checkout is completely unavailable and the cluster is burning through restart backoffs.',
    topology_description: `E-commerce platform on Kubernetes (prod-us-east-1, 6 nodes).
Services: api-gateway, checkout-service (3 replicas), inventory-service, notification-service.
Database: postgres-primary (healthy — the pods can't even connect to read config).
Cache: redis-primary (healthy).
Root cause: ConfigMap "checkout-service-config" was updated with DATABASE_URL pointing to wrong host (postgres-primary.db.svc.cluster.local vs postgres-primary.default.svc.cluster.local). Pods crash on startup with "connection refused".`,
    initial_system_state: initial,
    failure_sequence: [
      {
        trigger_at_minutes: 0,
        description: 'All checkout-service pods enter CrashLoopBackOff',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['checkout-service'].status = 'down'
          s.services['checkout-service'].error_rate = 1.0
          s.services['checkout-service'].p99_latency_ms = 0
          s.services['api-gateway'].error_rate = 0.35
          s.services['api-gateway'].p99_latency_ms = 8000

          s.active_incidents.push({
            id: uuidv4(),
            root_cause: 'ConfigMap checkout-service-config has invalid DATABASE_URL — pods crash on startup with connection refused',
            visible_symptoms: [
              'checkout-service: 0/3 pods Running (all CrashLoopBackOff)',
              'api-gateway error rate 35% (checkout upstream unavailable)',
              'kubectl get pods shows RESTARTS count climbing every 30s',
            ],
            blast_radius: ['checkout-service', 'api-gateway'],
            injected_at: s.sim_time,
          })

          const alert = makeAlert('sev1', 'checkout-service', 'checkout-service: ALL PODS CrashLoopBackOff. 0/3 replicas available. Checkout completely unavailable. Immediate action required.', s.sim_time)
          s.services['checkout-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 1,
        description: 'API gateway showing 503s to users, inventory requests failing',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['api-gateway'].error_rate = 0.55
          s.services['api-gateway'].p99_latency_ms = 12000
          s.services['inventory-service'].error_rate = 0.12
          s.services['inventory-service'].status = 'degraded'
          const alert = makeAlert('sev1', 'api-gateway', 'api-gateway: 55% of checkout requests returning 503. Kubernetes restart backoff increasing for checkout pods.', s.sim_time)
          s.services['api-gateway'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push('api-gateway 503 rate 55%', 'Pod restart backoff: 30s → 1min → 2min → 4min...')
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 3,
        description: 'Pods in 5-minute backoff — recovery window shrinking',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          // Pods are now in long backoff, adding urgency
          s.services['api-gateway'].error_rate = 0.65
          const alert = makeAlert('sev2', 'checkout-service', 'checkout-service: Pod restarts > 10. Kubernetes applying 5-minute CrashLoopBackOff delay between restart attempts. Fix and force-recreate pods needed.', s.sim_time)
          s.services['checkout-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
    ],
    expected_root_cause: 'ConfigMap checkout-service-config was updated with an invalid DATABASE_URL (wrong namespace in service hostname). Pods fail to start because they cannot connect to the database, causing CrashLoopBackOff.',
    expected_resolution_steps: [
      'kubectl describe pod checkout-service-xxx to see crash reason',
      'kubectl logs checkout-service-xxx --previous to see startup error',
      'kubectl describe configmap checkout-service-config to find bad DATABASE_URL',
      'kubectl edit configmap checkout-service-config — fix DATABASE_URL to correct hostname',
      'kubectl rollout restart deployment/checkout-service to force pods to pick up new config',
      'kubectl rollout status deployment/checkout-service -w to verify pods come up',
      'Verify checkout error rate drops to baseline',
      'Resolve incident',
    ],
    available_runbooks: [
      {
        id: 'rb-crashloop-001',
        title: 'Pod CrashLoopBackOff Runbook',
        content: `# Pod CrashLoopBackOff Investigation Runbook

## When to use
One or more pods are in CrashLoopBackOff — they start, crash, restart, crash again.

## Step 1 — Get pod status and restart count
\`\`\`bash
kubectl get pods -n prod
kubectl get pods -n prod -l app=checkout-service
\`\`\`

## Step 2 — Describe the crashing pod
\`\`\`bash
kubectl describe pod <pod-name> -n prod
\`\`\`
Look for: **Last State**, **Reason**, **Exit Code**, **Events** section.

## Step 3 — Read the crash logs
\`\`\`bash
# Previous container logs (before the crash)
kubectl logs <pod-name> -n prod --previous

# Current container output (may be empty if crashes immediately)
kubectl logs <pod-name> -n prod
\`\`\`

Common crash causes:
- **Exit Code 1**: Application error (check logs for stack trace)
- **Exit Code 137**: OOM killed (check memory limits)
- **Exit Code 2**: Misuse of command (config or entrypoint issue)
- **Connection refused**: Bad host/port in config

## Step 4 — Check ConfigMaps and Secrets
\`\`\`bash
kubectl describe configmap checkout-service-config -n prod
kubectl get configmap checkout-service-config -n prod -o yaml
\`\`\`

## Step 5 — Fix the config
\`\`\`bash
# Edit configmap directly
kubectl edit configmap checkout-service-config -n prod

# OR patch specific key
kubectl patch configmap checkout-service-config -n prod \\
  --patch '{"data": {"DATABASE_URL": "postgres://postgres-primary.default.svc.cluster.local:5432/app"}}'
\`\`\`

## Step 6 — Force pod restart after config fix
\`\`\`bash
kubectl rollout restart deployment/checkout-service -n prod
kubectl rollout status deployment/checkout-service -n prod -w
\`\`\`

## Step 7 — Verify
\`\`\`bash
kubectl get pods -n prod -l app=checkout-service
# Should show: 3/3 Running, RESTARTS unchanged
\`\`\`

## Prevention
- Use admission controllers or config validation in CI to catch bad env vars before deploy
- Alert on CrashLoopBackOff within 2 minutes via PagerDuty`,
      },
      {
        id: 'rb-incident-001',
        title: 'Incident Response Runbook',
        content: `# Incident Response Runbook\n\n## Severity\n- SEV1: Full outage, revenue impact\n- SEV2: Degraded, partial failures\n\n## Steps\n1. Acknowledge page (< 5 min)\n2. Declare severity\n3. Post to #incidents: what's affected, hypothesis\n4. Investigate → fix → verify\n5. Update every 15 min\n6. Resolve + schedule postmortem`,
      },
    ],
    available_dashboards: [
      { id: 'dash-k8s', name: 'Kubernetes Pod Health', services: ['checkout-service', 'inventory-service', 'notification-service'] },
      { id: 'dash-services', name: 'Service Error Rates & Latency', services: ['api-gateway', 'checkout-service', 'inventory-service', 'notification-service'] },
      { id: 'dash-overview', name: 'System Overview', services: ['api-gateway', 'checkout-service', 'inventory-service', 'notification-service', 'postgres-primary'] },
    ],
    passing_score: 65,
    time_limit_minutes: 15,
  }
}

export function checkPodCrashLoopResolution(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  const isK8s = lower.includes('kubectl')
  const isFixAction = lower.includes('rollout restart') || lower.includes('edit configmap') ||
    lower.includes('patch configmap') || lower.includes('apply') ||
    lower.includes('delete pod') || lower.includes('checkout-service')
  return isK8s && isFixAction
}
