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
    'catalog-service.error_rate': s.services['catalog-service']?.error_rate ?? 0,
    'catalog-service.p99_latency_ms': s.services['catalog-service']?.p99_latency_ms ?? 0,
    'search-service.error_rate': s.services['search-service']?.error_rate ?? 0,
    'search-service.p99_latency_ms': s.services['search-service']?.p99_latency_ms ?? 0,
    'recommendation-service.error_rate': s.services['recommendation-service']?.error_rate ?? 0,
    'recommendation-service.p99_latency_ms': s.services['recommendation-service']?.p99_latency_ms ?? 0,
    'spanner-primary.cpu_utilization': s.infrastructure.databases[0]?.query_latency_ms ?? 0,
    'spanner-primary.query_latency_ms': s.infrastructure.databases[0]?.query_latency_ms ?? 0,
    'spanner-primary.connection_count': s.infrastructure.databases[0]?.connection_count ?? 0,
  }
  return s
}

function buildInitialState(sessionId: string): SystemState {
  return {
    session_id: sessionId,
    scenario_id: 'spanner-high-utilization',
    sim_time: '2024-01-15T14:00:00Z',
    services: {
      'api-gateway': { name: 'api-gateway', status: 'healthy', error_rate: 0.01, p99_latency_ms: 38, dependencies: ['catalog-service', 'search-service', 'recommendation-service'], current_alerts: [] },
      'catalog-service': { name: 'catalog-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 45, dependencies: ['spanner-primary'], current_alerts: [] },
      'search-service': { name: 'search-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 55, dependencies: ['spanner-primary'], current_alerts: [] },
      'recommendation-service': { name: 'recommendation-service', status: 'healthy', error_rate: 0.01, p99_latency_ms: 90, dependencies: ['spanner-primary'], current_alerts: [] },
    },
    active_incidents: [],
    resolved_incidents: [],
    infrastructure: {
      clusters: [{ name: 'prod-us-central1', nodes: 4, healthy_nodes: 4 }],
      databases: [
        { name: 'spanner-primary', status: 'healthy', connection_count: 120, max_connections: 1000, query_latency_ms: 18 },
      ],
      caches: [{ name: 'memorystore-primary', status: 'healthy', hit_rate: 0.88, memory_used_mb: 3200, memory_total_mb: 8192 }],
      external_deps: [{ name: 'gcs-api', status: 'healthy', latency_ms: 55 }],
    },
    metrics_snapshot: {},
  }
}

export function getSpannerHighUtilizationScenario(sessionId: string): ScenarioTemplate {
  const initial = buildInitialState(sessionId)
  rebuildMetrics(initial)

  return {
    id: 'spanner-high-utilization',
    name: 'Cloud Spanner Node CPU Spike — Hot Key Hotspot',
    difficulty: 'senior',
    description: 'Cloud Spanner node CPU utilization has spiked to 92%. A new feature release deployed a recommendation query that uses a monotonically increasing key (timestamp-prefixed), creating a write hotspot on a single Spanner split. Latency is cascading into the catalog and search services.',
    topology_description: `GCP-hosted product platform running on GKE (prod-us-central1, 4 nodes).
Services: api-gateway, catalog-service, search-service, recommendation-service.
Database: Cloud Spanner instance "prod-catalog" — 3 nodes, schema: products, product_events (hotspot table), recommendations.
Cache: Memorystore for Redis (healthy).
Root cause: recommendation-service v2.1.0 deployed 20 min ago writes to product_events with key format TIMESTAMP_PRODUCTID, concentrating writes on the latest Spanner split.`,
    initial_system_state: initial,
    failure_sequence: [
      {
        trigger_at_minutes: 0,
        description: 'Spanner CPU 92% — catalog latency spikes',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.infrastructure.databases[0].query_latency_ms = 3800
          s.infrastructure.databases[0].status = 'degraded'
          s.services['catalog-service'].p99_latency_ms = 4200
          s.services['catalog-service'].error_rate = 0.06
          s.services['catalog-service'].status = 'degraded'

          s.active_incidents.push({
            id: uuidv4(),
            root_cause: 'Spanner hot key hotspot on product_events table — monotonic timestamp prefix concentrates writes on a single node split, CPU at 92%',
            visible_symptoms: [
              'Spanner CPU utilization 92%',
              'catalog-service p99 latency 4200ms',
              'product_events write throughput degraded',
            ],
            blast_radius: ['catalog-service', 'search-service', 'recommendation-service'],
            injected_at: s.sim_time,
          })

          const alert = makeAlert('sev2', 'spanner-primary', 'spanner-primary: CPU utilization 92% on node us-central1-b. Hot key detected on product_events table. Query latency p99=3800ms.', s.sim_time)
          s.services['catalog-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 1,
        description: 'Search service degraded, recommendation service erroring',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['search-service'].error_rate = 0.18
          s.services['search-service'].p99_latency_ms = 7500
          s.services['search-service'].status = 'degraded'
          s.services['recommendation-service'].error_rate = 0.35
          s.services['recommendation-service'].p99_latency_ms = 9000
          s.services['recommendation-service'].status = 'degraded'
          const alert = makeAlert('sev1', 'search-service', 'search-service: Error rate 18%. Spanner read latency cascading. Product search impacted.', s.sim_time)
          s.services['search-service'].current_alerts.push(alert)
          s.active_incidents[0].visible_symptoms.push('search-service error rate 18%', 'recommendation-service error rate 35%')
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 2.5,
        description: 'API gateway error rate rising — user-facing impact',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          s.services['api-gateway'].error_rate = 0.22
          s.services['api-gateway'].p99_latency_ms = 12000
          s.services['catalog-service'].error_rate = 0.55
          s.services['catalog-service'].p99_latency_ms = 18000
          const alert = makeAlert('sev1', 'api-gateway', 'api-gateway: Error rate 22%. Product browse and search FAILING for users. Revenue impact.', s.sim_time)
          s.services['api-gateway'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
      {
        trigger_at_minutes: 4.5,
        description: 'Spanner node fully saturated — catalog down',
        apply: (state: SystemState): SystemState => {
          const s = deepClone(state)
          if (s.infrastructure.databases[0].status === 'healthy') return s
          s.infrastructure.databases[0].status = 'down'
          s.infrastructure.databases[0].query_latency_ms = 99999
          s.services['catalog-service'].status = 'down'
          s.services['catalog-service'].error_rate = 1.0
          s.services['search-service'].status = 'down'
          s.services['search-service'].error_rate = 1.0
          const alert = makeAlert('sev1', 'spanner-primary', 'spanner-primary: NODE OVERLOADED. Spanner node us-central1-b unresponsive. Catalog and Search DOWN.', s.sim_time)
          s.services['catalog-service'].current_alerts.push(alert)
          return rebuildMetrics(s)
        },
      },
    ],
    expected_root_cause: 'recommendation-service v2.1.0 writes to product_events using a timestamp-prefixed key, creating a hot key hotspot on a single Spanner split, driving node CPU to 92% and cascading into all read-heavy services.',
    expected_resolution_steps: [
      'Check Spanner Key Visualizer or query stats to identify hot key',
      'Roll back recommendation-service to previous version or disable the feature flag',
      'Verify CPU utilization dropping on Spanner node',
      'Long-term fix: use hash prefix or UUID key instead of timestamp prefix',
      'Monitor catalog/search latency returning to baseline',
      'Resolve incident',
    ],
    available_runbooks: [
      {
        id: 'rb-spanner-001',
        title: 'Spanner High CPU / Hot Key Runbook',
        content: `# Cloud Spanner High CPU Runbook

## When to use
Spanner CPU > 70%, query latency spiking, services depending on Spanner degraded.

## Step 1 — Check Spanner metrics (GCP Console or gcloud)
\`\`\`bash
# Check CPU per node
gcloud spanner instances describe prod-catalog --format="json" | jq '.nodeCount'

# Query stats for top CPU queries
gcloud spanner databases execute-sql prod-catalog \\
  --instance=prod-catalog \\
  --sql="SELECT fprint, query_text, avg_cpu_seconds, avg_latency_seconds, execution_count
        FROM spanner_sys.query_stats_top_hour
        ORDER BY avg_cpu_seconds DESC LIMIT 10"
\`\`\`

## Step 2 — Identify hot key table
\`\`\`bash
# Look for tables with high write throughput
gcloud spanner databases execute-sql prod-catalog \\
  --instance=prod-catalog \\
  --sql="SELECT table_name, row_count FROM information_schema.TABLE_STATISTICS
        ORDER BY row_count DESC LIMIT 10"
\`\`\`

## Step 3 — Check recent deployments
\`\`\`bash
kubectl rollout history deployment/recommendation-service -n prod
kubectl describe deployment recommendation-service -n prod | grep -A5 Image
\`\`\`

## Step 4 — Rollback if deployment caused regression
\`\`\`bash
kubectl rollout undo deployment/recommendation-service -n prod
kubectl rollout status deployment/recommendation-service -n prod -w
\`\`\`

## Step 5 — Verify recovery
\`\`\`bash
# CPU should drop below 50% within 2 minutes of rollback
watch -n10 gcloud spanner instances describe prod-catalog
\`\`\`

## Prevention
- Never use monotonic keys (timestamps, auto-increment) as Spanner row keys
- Use UUID or hash prefix to distribute writes across splits
- Enable Spanner Key Visualizer alerts at 70% CPU`,
      },
      {
        id: 'rb-incident-001',
        title: 'Incident Response Runbook',
        content: `# Incident Response Runbook\n\n## Severity\n- SEV1: Full outage, revenue impact\n- SEV2: Degraded, partial failures\n\n## Steps\n1. Acknowledge page (< 5 min)\n2. Declare severity\n3. Post to #incidents: affected services, hypothesis\n4. Investigate → rollback → verify\n5. Update every 15 min\n6. Resolve + schedule postmortem`,
      },
    ],
    available_dashboards: [
      { id: 'dash-spanner', name: 'Spanner Node Utilization', services: ['spanner-primary'] },
      { id: 'dash-services', name: 'Service Error Rates & Latency', services: ['api-gateway', 'catalog-service', 'search-service', 'recommendation-service'] },
      { id: 'dash-overview', name: 'System Overview', services: ['api-gateway', 'catalog-service', 'search-service', 'recommendation-service', 'spanner-primary'] },
    ],
    passing_score: 65,
    time_limit_minutes: 15,
  }
}

export function checkSpannerResolution(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  const isSpanner = lower.includes('spanner') || lower.includes('recommendation-service') || lower.includes('rollout undo') || lower.includes('rollback')
  const isAction = lower.includes('rollout') || lower.includes('undo') || lower.includes('rollback') ||
    lower.includes('kubectl') || lower.includes('gcloud')
  return isSpanner && isAction
}
