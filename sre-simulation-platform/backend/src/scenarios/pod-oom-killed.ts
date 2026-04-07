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
    scenario_id: 'pod-oom-killed',
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

export function getPodOomKilledScenario(sessionId: string): ScenarioTemplate {
  const initial = buildInitialState(sessionId)
  rebuildMetrics(initial)

  return {
    id: 'pod-oom-killed',
    name: 'Container Resource Pressure',
    difficulty: 'senior',
    description: 'A memory leak in payment-service v2.3.1 causes RSS to grow 8MB/min. After 40 minutes, pods exceed their 512Mi limit and are OOMKilled in a continuous restart loop.',
    topology_description: `E-commerce platform on Kubernetes (prod-us-east-1, 12 nodes).
Services: api-gateway, auth-service, user-service, payment-service, order-service, analytics-service, notification-service, checkout-service.
Database: postgres-primary (healthy).
Cache: redis-primary (healthy).
Root cause: payment-service v2.3.1 introduced an unclosed gRPC channel in its payment retry loop. Each failed payment attempt allocates a new gRPC channel but never closes it, causing RSS to grow ~8MB/min. After ~40 minutes RSS exceeds the 512Mi pod memory limit and Kubernetes OOMKills the pod. Pods restart but leak memory again within minutes, creating a continuous kill loop.`,
    initial_system_state: initial,
    failure_sequence: [
      {
        trigger_at_minutes: 0,
        description: 'payment-service pods begin intermittent OOMKill restarts — memory leak in gRPC retry loop',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['payment-service'].status = 'degraded'
          s.services['payment-service'].error_rate = 0.30
          s.services['payment-service'].p99_latency_ms = 4500

          s.active_incidents.push({
            id: uuidv4(),
            root_cause: 'Memory leak in payment-service v2.3.1 — unclosed gRPC channels in retry loop cause RSS to grow 8MB/min, triggering OOMKill at 512Mi limit',
            visible_symptoms: [
              'payment-service: pod RESTARTS count climbing — OOMKilled (Exit Code 137)',
              'kubectl describe pod shows Last State: OOMKilled, memory.usage near 512Mi before each kill',
              'payment-service: 30% error rate — in-flight requests dropped when pod is killed mid-request',
            ],
            blast_radius: ['payment-service'],
            injected_at: s.sim_time,
          })

          const alert = makeAlert('sev2', 'payment-service', 'payment-service: Pod OOMKilled. Exit code 137. RSS approaching 512Mi memory limit. Pods restarting — 30% error rate during restart windows.', s.sim_time)
          s.services['payment-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 3,
        description: 'payment-service enters continuous OOMKill loop — restart backoff kicks in, near-total unavailability',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['payment-service'].status = 'down'
          s.services['payment-service'].error_rate = 0.95
          s.services['payment-service'].p99_latency_ms = 0

          const alert = makeAlert('sev1', 'payment-service', 'payment-service: DOWN. Continuous OOMKill restart loop. Pods restart, leak memory within 3 minutes, get killed again. Restart backoff now active — 0/3 pods available for extended windows.', s.sim_time)
          s.services['payment-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push(
            'payment-service: 0/3 pods Ready — all in CrashLoopBackOff due to OOMKill cycle',
            'kubectl get events: multiple OOMKilling events, memory.usage_bytes hitting 536870912 (512Mi)',
            'Restart backoff: pods unavailable for 2-5 min windows between kill and restart',
          )
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 6,
        description: 'order-service degrades — no payment processing available for new orders',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['order-service'].status = 'degraded'
          s.services['order-service'].error_rate = 0.60
          s.services['order-service'].p99_latency_ms = 5000
          s.services['api-gateway'].status = 'degraded'
          s.services['api-gateway'].error_rate = 0.30
          s.services['api-gateway'].p99_latency_ms = 1600
          s.services['checkout-service'].status = 'degraded'
          s.services['checkout-service'].error_rate = 0.55
          s.services['checkout-service'].p99_latency_ms = 4200

          const alert = makeAlert('sev1', 'order-service', 'order-service: 60% error rate. payment-service unavailable — all orders requiring payment failing at checkout step. Estimated revenue impact accumulating.', s.sim_time)
          s.services['order-service'].current_alerts.push(alert)
          const alertCheckout = makeAlert('sev1', 'checkout-service', 'checkout-service: 55% error rate. Payment processing unavailable — checkout flow broken for majority of users.', s.sim_time)
          s.services['checkout-service'].current_alerts.push(alertCheckout)
          const alertGw = makeAlert('sev2', 'api-gateway', 'api-gateway: 30% error rate. Payment and checkout endpoints returning 503 — payment-service OOMKill loop propagating upstream.', s.sim_time)
          s.services['api-gateway'].current_alerts.push(alertGw)
          s.active_incidents[0].visible_symptoms.push(
            'order-service: 60% error rate — payment step unavailable',
            'checkout-service: 55% error rate — checkout flow broken',
            'api-gateway: 30% error rate — payment and checkout endpoints returning 503',
          )
          s.active_incidents[0].blast_radius.push('order-service', 'checkout-service', 'api-gateway')
          return rebuildMetrics(s)
        },
      },
    ],
    expected_root_cause: 'payment-service v2.3.1 introduced an unclosed gRPC channel in the payment retry logic. Each failed payment attempt leaks a gRPC channel (~8MB RSS). After ~40 minutes the accumulated leak exceeds the 512Mi pod memory limit. Kubernetes OOMKills the pod (Exit Code 137), it restarts, starts leaking again, and the cycle repeats.',
    expected_resolution_steps: [
      'kubectl get pods -l app=payment-service -n prod to see RESTARTS count and OOMKill status',
      'kubectl describe pod payment-service-xxx -n prod — look for Last State: Terminated, Reason: OOMKilled, Exit Code: 137',
      'kubectl top pod -l app=payment-service -n prod to see current memory usage',
      'kubectl get events -n prod | grep -i oom to see OOMKilling events',
      'Check version: kubectl describe deployment payment-service | grep image — confirm v2.3.1 is deployed',
      'Check changelog / git history for v2.3.1 — identify gRPC channel leak in retry loop',
      'Roll back to v2.3.0: kubectl rollout undo deployment/payment-service -n prod',
      'OR increase memory limit temporarily: kubectl patch deployment payment-service -p patch increasing memory limit to 1Gi',
      'kubectl rollout status deployment/payment-service -n prod -w to verify recovery',
      'Verify payment-service error rate drops and RESTARTS stops climbing',
      'File bug for gRPC channel leak and schedule proper fix in v2.3.2',
    ],
    available_runbooks: [
      {
        id: 'rb-oomkill-001',
        title: 'Pod OOMKilled Investigation Runbook',
        content: `# Pod OOMKilled Investigation Runbook

## When to use
Pods are being killed with Exit Code 137. kubectl get pods shows high RESTARTS count. kubectl describe pod shows Last State: OOMKilled.

## Step 1 — Confirm OOMKill
\`\`\`bash
kubectl get pods -l app=payment-service -n prod
# Look for high RESTARTS number

kubectl describe pod <pod-name> -n prod
# Look for:
#   Last State: Terminated
#   Reason: OOMKilled
#   Exit Code: 137
\`\`\`

## Step 2 — Check current memory usage
\`\`\`bash
kubectl top pod -l app=payment-service -n prod
# Compare to limits in deployment spec
kubectl get deployment payment-service -n prod -o jsonpath='{.spec.template.spec.containers[0].resources}'
\`\`\`

## Step 3 — Check OOMKill events
\`\`\`bash
kubectl get events -n prod --sort-by='.lastTimestamp' | grep -i oom
kubectl get events -n prod --field-selector reason=OOMKilling
\`\`\`

## Step 4 — Identify the leak (if time permits)
\`\`\`bash
# Get memory profile from a running pod before it gets killed
kubectl exec <pod-name> -n prod -- curl http://localhost:6060/debug/pprof/heap > heap.prof
go tool pprof heap.prof
# Look for growing allocations from retry/grpc code paths
\`\`\`

## Step 5a — Roll back to last good version
\`\`\`bash
kubectl rollout history deployment/payment-service -n prod
kubectl rollout undo deployment/payment-service -n prod
kubectl rollout status deployment/payment-service -n prod -w
\`\`\`

## Step 5b — Temporarily increase memory limit (if rollback not viable)
\`\`\`bash
kubectl patch deployment payment-service -n prod \\
  --patch '{"spec":{"template":{"spec":{"containers":[{"name":"payment-service","resources":{"limits":{"memory":"1Gi"}}}]}}}}'
kubectl rollout status deployment/payment-service -n prod -w
\`\`\`

## Step 6 — Verify
\`\`\`bash
kubectl get pods -l app=payment-service -n prod
# RESTARTS should stop climbing
kubectl top pod -l app=payment-service -n prod
# Memory should stabilize, not grow continuously
\`\`\`

## Prevention
- Set memory limits AND requests. Alert when pod memory exceeds 80% of limit.
- Add memory leak tests to CI for services handling high-volume retry loops
- Use pprof memory profiling in staging load tests to catch leaks before production`,
      },
      {
        id: 'rb-incident-001',
        title: 'Incident Response Runbook',
        content: `# Incident Response Runbook\n\n## Severity\n- SEV1: Full outage, revenue impact\n- SEV2: Degraded, partial failures\n\n## Steps\n1. Acknowledge page (< 5 min)\n2. Declare severity\n3. Post to #incidents: what's affected, hypothesis\n4. Investigate → fix → verify\n5. Update every 15 min\n6. Resolve + schedule postmortem`,
      },
    ],
    available_dashboards: [
      { id: 'dash-k8s', name: 'Kubernetes Pod Memory & Restart Count', services: ['payment-service', 'order-service'] },
      { id: 'dash-services', name: 'Service Error Rates & Latency', services: ['api-gateway', 'payment-service', 'order-service', 'checkout-service'] },
      { id: 'dash-overview', name: 'System Overview', services: ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'order-service', 'analytics-service', 'notification-service', 'checkout-service'] },
    ],
    passing_score: 65,
    time_limit_minutes: 20,
  }
}

export function checkPodOomKilledResolution(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  const isK8s = lower.includes('kubectl')
  const isFixAction = lower.includes('rollout undo') || lower.includes('rollout restart') ||
    lower.includes('set image') || lower.includes('patch deployment') ||
    lower.includes('payment-service') || lower.includes('oomkill') || lower.includes('memory')
  return isK8s && isFixAction
}
