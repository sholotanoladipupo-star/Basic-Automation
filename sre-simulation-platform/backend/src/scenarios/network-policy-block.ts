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
    scenario_id: 'network-policy-block',
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

export function getNetworkPolicyBlockScenario(sessionId: string): ScenarioTemplate {
  const initial = buildInitialState(sessionId)
  rebuildMetrics(initial)

  return {
    id: 'network-policy-block',
    name: 'Network Policy Misconfiguration — Auth to User Service Blocked',
    difficulty: 'chaos',
    description: 'A NetworkPolicy update accidentally removed the ingress rule allowing auth-service to reach user-service. All authentication flows are failing with connection timeout.',
    topology_description: `E-commerce platform on Kubernetes (prod-us-east-1, 12 nodes).
Services: api-gateway, auth-service, user-service, payment-service, order-service, analytics-service, notification-service, checkout-service.
Database: postgres-primary (healthy).
Cache: redis-primary (healthy).
Network: Kubernetes NetworkPolicy enforcement enabled. Services communicate via cluster DNS.
Root cause: A kubectl apply of an updated NetworkPolicy "allow-user-service-ingress" accidentally omitted the ingress rule that permitted traffic from the auth namespace to user-service on port 8080. The policy was applied at 14:00 UTC. All auth-service calls to user-service now silently drop (connection timeout after 30s), not connection refused — making it harder to detect as a networking issue.`,
    initial_system_state: initial,
    failure_sequence: [
      {
        trigger_at_minutes: 0,
        description: 'auth-service requests to user-service begin timing out — NetworkPolicy silently drops packets',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['auth-service'].status = 'degraded'
          s.services['auth-service'].error_rate = 0.55
          s.services['auth-service'].p99_latency_ms = 30000

          s.active_incidents.push({
            id: uuidv4(),
            root_cause: 'NetworkPolicy "allow-user-service-ingress" was patched at 14:00 UTC — the ingress rule permitting auth-service namespace traffic on port 8080 was accidentally removed. Connections silently time out (30s) rather than being refused.',
            visible_symptoms: [
              'auth-service: 55% error rate — requests to user-service timing out after 30s',
              'auth-service: p99_latency_ms at 30000ms (30s timeout) — not connection refused, packets silently dropped',
              'No error in user-service logs — traffic never reaches it (blocked at network layer)',
            ],
            blast_radius: ['auth-service'],
            injected_at: s.sim_time,
          })

          const alert = makeAlert('sev2', 'auth-service', 'auth-service: 55% error rate. Requests to user-service timing out at 30s. Not connection refused — possible network policy or firewall block. Check NetworkPolicy rules.', s.sim_time)
          s.services['auth-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 1,
        description: 'auth-service goes fully down — all auth requests failing after timeout exhaustion, connection pool saturated',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['auth-service'].status = 'down'
          s.services['auth-service'].error_rate = 1.0
          s.services['auth-service'].p99_latency_ms = 30000

          const alert = makeAlert('sev1', 'auth-service', 'auth-service: DOWN. 100% of authentication requests failing. All connections to user-service timing out. Thread pool saturated with 30s hanging requests. No auth flow operational.', s.sim_time)
          s.services['auth-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push(
            'auth-service: DOWN — thread pool saturated, 100% error rate',
            'All login, token refresh, and session validation flows failing',
            'auth-service worker threads exhausted waiting for user-service 30s timeouts to expire',
          )
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 3,
        description: 'api-gateway degrading — all authenticated requests fail as auth-service is unavailable',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['api-gateway'].status = 'degraded'
          s.services['api-gateway'].error_rate = 0.70
          s.services['api-gateway'].p99_latency_ms = 30500

          const alert = makeAlert('sev1', 'api-gateway', 'api-gateway: 70% error rate. All requests requiring authentication returning 503/401. auth-service completely unavailable — cannot validate tokens or authenticate new sessions.', s.sim_time)
          s.services['api-gateway'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push(
            'api-gateway: 70% error rate — all authenticated endpoints failing',
            'Only anonymous/public API routes still functional',
            'User-facing: login page down, dashboard inaccessible, checkout requires auth (failing)',
          )
          s.active_incidents[0].blast_radius.push('api-gateway')
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 6,
        description: 'order-service and payment-service go down — session token validation failing for all requests',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['order-service'].status = 'down'
          s.services['order-service'].error_rate = 1.0
          s.services['order-service'].p99_latency_ms = 0
          s.services['payment-service'].status = 'down'
          s.services['payment-service'].error_rate = 1.0
          s.services['payment-service'].p99_latency_ms = 0
          s.services['api-gateway'].error_rate = 0.95
          s.services['api-gateway'].p99_latency_ms = 32000

          const alert = makeAlert('sev1', 'order-service', 'order-service: DOWN. Session token validation against auth-service failing — all requests rejected as unauthenticated. payment-service also down for same reason. Platform effectively inaccessible to authenticated users.', s.sim_time)
          s.services['order-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push(
            'order-service: DOWN — cannot verify session tokens',
            'payment-service: DOWN — cannot verify session tokens',
            'api-gateway: 95% error rate — platform effectively offline for authenticated users',
            'Blast radius: entire authenticated user surface',
          )
          s.active_incidents[0].blast_radius.push('order-service', 'payment-service')
          return rebuildMetrics(s)
        },
      },
    ],
    expected_root_cause: 'A kubectl apply of NetworkPolicy "allow-user-service-ingress" at 14:00 UTC accidentally removed the ingress fromNamespace rule that permitted traffic from the auth namespace to user-service on port 8080. Kubernetes NetworkPolicy silently drops non-matching traffic (no RST, no ICMP unreachable), causing 30-second connection timeouts instead of immediate errors. This masked the root cause as a network issue rather than an application error.',
    expected_resolution_steps: [
      'kubectl get networkpolicy -n prod to list all policies',
      'kubectl describe networkpolicy allow-user-service-ingress -n prod to inspect current ingress rules',
      'Compare against last known good version: kubectl get networkpolicy allow-user-service-ingress -n prod -o yaml',
      'Test connectivity directly: kubectl exec -it auth-service-xxx -n prod -- curl -v --max-time 5 http://user-service.prod.svc.cluster.local:8080/health',
      'Confirm traffic is dropped (timeout) not refused — confirms NetworkPolicy block rather than app error',
      'Check git history for NetworkPolicy manifests: git log --oneline -- k8s/networkpolicies/allow-user-service-ingress.yaml',
      'Apply corrected NetworkPolicy: kubectl apply -f k8s/networkpolicies/allow-user-service-ingress.yaml (version with auth namespace ingress rule)',
      'Immediately test: kubectl exec auth-service-xxx -- curl --max-time 5 http://user-service:8080/health — should return 200 within seconds',
      'Monitor auth-service error rate drop',
      'kubectl rollout restart deployment/auth-service to clear saturated thread pool',
      'Verify api-gateway, order-service, payment-service recover',
    ],
    available_runbooks: [
      {
        id: 'rb-netpol-001',
        title: 'Kubernetes NetworkPolicy Debugging Runbook',
        content: `# Kubernetes NetworkPolicy Debugging Runbook

## When to use
Service A cannot reach Service B. Connections time out (not refused). No errors in Service B logs — traffic never arrives.

## Key Insight
NetworkPolicy DROPS packets silently. You will see:
- Connection timeout (not "connection refused")
- No errors in the destination service — it never sees the traffic
- Source service logs show timeout errors, not DNS errors

## Step 1 — Identify the pattern
\`\`\`bash
kubectl logs -l app=auth-service -n prod | grep -i "timeout\\|refused\\|user-service"
# Timeouts (not refused) = likely NetworkPolicy block
# Connection refused = port not open, service not running
\`\`\`

## Step 2 — Test connectivity directly
\`\`\`bash
kubectl exec -it <auth-service-pod> -n prod -- \\
  curl -v --max-time 5 http://user-service.prod.svc.cluster.local:8080/health
# Timeout = NetworkPolicy blocking
# 200 OK = connection works fine (look elsewhere)
\`\`\`

## Step 3 — Inspect NetworkPolicies on the destination
\`\`\`bash
kubectl get networkpolicy -n prod
kubectl describe networkpolicy allow-user-service-ingress -n prod
# Look for: ingress rules, podSelector, namespaceSelector
# Missing: fromNamespace auth or podSelector app=auth-service
\`\`\`

## Step 4 — Check what changed recently
\`\`\`bash
kubectl get events -n prod | grep -i networkpolicy
git log --oneline -10 -- k8s/networkpolicies/
\`\`\`

## Step 5 — Apply the corrected NetworkPolicy
\`\`\`bash
# Example corrected policy YAML:
# spec:
#   ingress:
#   - from:
#     - namespaceSelector:
#         matchLabels:
#           name: auth           # <-- this rule was missing
#     ports:
#     - port: 8080

kubectl apply -f k8s/networkpolicies/allow-user-service-ingress.yaml
\`\`\`

## Step 6 — Verify immediately
\`\`\`bash
kubectl exec -it <auth-service-pod> -n prod -- \\
  curl --max-time 5 http://user-service.prod.svc.cluster.local:8080/health
# Should return 200 within milliseconds — NetworkPolicy takes effect immediately
\`\`\`

## Step 7 — Restart affected services to clear backlogged connections
\`\`\`bash
kubectl rollout restart deployment/auth-service -n prod
kubectl rollout status deployment/auth-service -n prod -w
\`\`\`

## Prevention
- Store all NetworkPolicy manifests in git. Apply only via GitOps (ArgoCD/Flux) with review.
- Add a canary check after any NetworkPolicy change: test critical service-to-service paths
- Alert on auth-service timeout errors > 1% — NetworkPolicy issues show up as timeouts not errors`,
      },
      {
        id: 'rb-incident-001',
        title: 'Incident Response Runbook',
        content: `# Incident Response Runbook\n\n## Severity\n- SEV1: Full outage, revenue impact\n- SEV2: Degraded, partial failures\n\n## Steps\n1. Acknowledge page (< 5 min)\n2. Declare severity\n3. Post to #incidents: what's affected, hypothesis\n4. Investigate → fix → verify\n5. Update every 15 min\n6. Resolve + schedule postmortem`,
      },
    ],
    available_dashboards: [
      { id: 'dash-auth', name: 'Auth Service & User Service Connectivity', services: ['auth-service', 'user-service', 'api-gateway'] },
      { id: 'dash-services', name: 'Service Error Rates & Latency', services: ['api-gateway', 'auth-service', 'order-service', 'payment-service'] },
      { id: 'dash-overview', name: 'System Overview', services: ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'order-service', 'analytics-service', 'notification-service', 'checkout-service'] },
    ],
    passing_score: 70,
    time_limit_minutes: 25,
  }
}

export function checkNetworkPolicyBlockResolution(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  const isK8s = lower.includes('kubectl')
  const isNetPol = lower.includes('networkpolicy') || lower.includes('netpol') || lower.includes('network-policy')
  const isConnTest = lower.includes('curl') && (lower.includes('user-service') || lower.includes('auth'))
  const isApplyFix = lower.includes('apply') || lower.includes('patch')
  return isK8s && (isNetPol || isConnTest || isApplyFix)
}
