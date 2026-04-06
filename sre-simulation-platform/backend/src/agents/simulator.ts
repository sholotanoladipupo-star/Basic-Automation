import { pool } from '../db/client'
import { SystemState } from '../types'

export interface SimulatorResponse {
  stdout: string
  exit_code: number
  latency_ms: number
}

function getStateConditions(state: SystemState): string[] {
  const conditions: string[] = ['always']
  const redis = state.infrastructure.caches[0]
  const pgPrimary = state.infrastructure.databases[0]
  const orderSvc = state.services['order-service']
  const checkoutSvc = state.services['checkout-service']

  // Redis conditions (cache-db-cascade)
  if (redis?.status === 'down') conditions.push('redis_down')
  if (redis?.status === 'degraded') conditions.push('redis_recovering', 'redis_down')
  if (redis?.status === 'healthy' && (redis.hit_rate ?? 0) > 0.7) conditions.push('redis_healthy')

  // DB conditions (all scenarios)
  if (pgPrimary?.status === 'down') {
    conditions.push('db_down', 'db_overloaded')
  } else if (pgPrimary && (pgPrimary.connection_count > 100 || pgPrimary.status === 'degraded')) {
    conditions.push('db_overloaded')
  }
  if (pgPrimary && pgPrimary.query_latency_ms > 2000) conditions.push('db_slow_queries')

  // Services degraded
  if (orderSvc?.status === 'down') {
    conditions.push('services_down', 'services_degraded')
  } else if (orderSvc && (orderSvc.status === 'degraded' || orderSvc.error_rate > 0.2)) {
    conditions.push('services_degraded')
  }

  // checkout-service crashloop
  if (checkoutSvc?.status === 'down') conditions.push('checkout_down', 'services_degraded')

  // Spanner scenario
  const spannerDb = state.infrastructure.databases.find(d => d.name === 'spanner-primary')
  if (spannerDb?.status === 'down') conditions.push('spanner_down', 'db_down')
  else if (spannerDb?.status === 'degraded') conditions.push('spanner_degraded')

  // Scenario-specific tag
  if (state.scenario_id) conditions.push(`scenario_${state.scenario_id.replace(/-/g, '_')}`)

  return conditions
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Deterministic short hash from a string (no randomness — same input = same hash) */
function shortHash(seed: string, len = 5): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  const hex = Math.abs(h).toString(16).padStart(8, '0')
  return hex.slice(0, len)
}

const SERVICE_LIST = [
  'api-gateway', 'auth-service', 'user-service', 'payment-service',
  'order-service', 'analytics-service', 'notification-service', 'checkout-service',
]

function allServices(state: SystemState): string[] {
  const fromState = Object.keys(state.services)
  const merged = new Set([...SERVICE_LIST, ...fromState])
  return Array.from(merged)
}

/** Pod name: {service}-{deployHash}-{podHash} */
function podName(svc: string, idx: number): string {
  return `${svc}-${shortHash(svc + 'deploy')}-${shortHash(svc + idx)}`
}

interface PodRow {
  name: string
  ready: string
  status: string
  restarts: number
  age: string
}

function buildPodRows(state: SystemState): PodRow[] {
  const rows: PodRow[] = []
  const services = allServices(state)
  for (const svc of services) {
    const svcState = state.services[svc]
    const svcStatus = svcState?.status ?? 'healthy'
    const ages = ['3d', '3d', '3d']
    for (let i = 0; i < 3; i++) {
      const name = podName(svc, i)
      let status = 'Running'
      let ready = '1/1'
      let restarts = 0
      if (svcStatus === 'down') {
        if (state.scenario_id === 'pod-oom-killed') {
          status = i === 0 ? 'OOMKilled' : 'Terminating'
        } else {
          status = 'CrashLoopBackOff'
          restarts = 8 + i
          ready = '0/1'
        }
      } else if (svcStatus === 'degraded') {
        // One pod is struggling
        if (i === 1) {
          restarts = 4 + Math.floor(shortHash(svc + 'restarts').charCodeAt(0) % 5)
        }
      }
      rows.push({ name, ready, status, restarts, age: ages[i] })
    }
  }
  return rows
}

function fmtPodTable(rows: PodRow[]): string {
  const header = 'NAME                                        READY   STATUS             RESTARTS   AGE'
  const lines = rows.map(r =>
    r.name.padEnd(44) +
    r.ready.padEnd(8) +
    r.status.padEnd(19) +
    String(r.restarts).padEnd(11) +
    r.age
  )
  return [header, ...lines].join('\n')
}

/** Derive scenario-relevant error lines for logs */
function scenarioLogLines(scenario: string, svc: string): string[] {
  const ts = () => {
    const d = new Date()
    return d.toISOString().replace('T', ' ').slice(0, 19)
  }
  switch (scenario) {
    case 'db-replica-ip-change':
      return [
        `${ts()} ERROR [${svc}] Connection refused to 10.0.1.45:5432 (replica)`,
        `${ts()} ERROR [${svc}] Retrying DB connection... attempt 3/5`,
        `${ts()} WARN  [${svc}] Falling back to primary DB — increased load expected`,
      ]
    case 'cache-db-cascade':
      return [
        `${ts()} ERROR [${svc}] Redis connection timeout after 5000ms`,
        `${ts()} WARN  [${svc}] Cache miss storm — all requests hitting Postgres`,
        `${ts()} ERROR [${svc}] DB connection pool exhausted (500/500)`,
      ]
    case 'pod-crashloop':
      return [
        `${ts()} ERROR [${svc}] FATAL: unable to read config /etc/app/config.yaml`,
        `${ts()} ERROR [${svc}] panic: runtime error: invalid memory address`,
        `${ts()} INFO  [${svc}] Container exiting with code 1`,
      ]
    case 'pod-oom-killed':
      return [
        `${ts()} WARN  [${svc}] Heap usage at 94% — GC pressure increasing`,
        `${ts()} ERROR [${svc}] OOMKiller invoked: process killed (rss=2.1Gi, limit=2Gi)`,
        `${ts()} INFO  [${svc}] Container restarting...`,
      ]
    case 'network-policy-block':
      return [
        `${ts()} ERROR [${svc}] dial tcp 10.96.0.12:8080: connect: connection refused`,
        `${ts()} ERROR [${svc}] upstream connect error or disconnect/reset before headers`,
        `${ts()} WARN  [${svc}] NetworkPolicy may be blocking egress to dependent service`,
      ]
    case 'db-slow-queries':
      return [
        `${ts()} WARN  [${svc}] Slow query detected: SELECT * FROM orders WHERE ... (8423ms)`,
        `${ts()} WARN  [${svc}] Query plan: Seq Scan on orders (cost=0..184234 rows=2341432)`,
        `${ts()} ERROR [${svc}] Request timeout after 10s waiting for DB response`,
      ]
    case 'config-key-missing':
      return [
        `${ts()} ERROR [${svc}] Config key 'PAYMENT_PROVIDER_SECRET' not found in ConfigMap`,
        `${ts()} ERROR [${svc}] Application startup failed: missing required configuration`,
        `${ts()} FATAL [${svc}] Exiting: configuration validation error`,
      ]
    case 'spanner-high-utilization':
      return [
        `${ts()} WARN  [${svc}] Cloud Spanner CPU utilization at 92%`,
        `${ts()} ERROR [${svc}] Spanner query latency p99=4200ms (SLO breach)`,
        `${ts()} WARN  [${svc}] Throttling reads due to high Spanner load`,
      ]
    default:
      return []
  }
}

function healthyLogLines(svc: string): string[] {
  const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19)
  return [
    `${ts()} INFO  [${svc}] GET /health 200 OK (2ms)`,
    `${ts()} INFO  [${svc}] Processed request id=req-${shortHash(svc + 'req1')} in 14ms`,
    `${ts()} INFO  [${svc}] DB query completed in 3ms`,
    `${ts()} INFO  [${svc}] Cache hit ratio: 94.2%`,
    `${ts()} INFO  [${svc}] GET /api/v1/status 200 OK (5ms)`,
    `${ts()} INFO  [${svc}] POST /api/v1/event 201 Created (18ms)`,
    `${ts()} INFO  [${svc}] Heartbeat OK`,
    `${ts()} INFO  [${svc}] Metrics exported successfully`,
  ]
}

function serviceLogsOutput(svc: string, state: SystemState): string {
  const svcState = state.services[svc]
  const scenario = state.scenario_id ?? ''
  const lines: string[] = []
  const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

  if (svcState?.status === 'down' || svcState?.status === 'degraded') {
    // A few healthy lines first, then errors
    lines.push(`${ts()} INFO  [${svc}] Starting service...`)
    lines.push(`${ts()} INFO  [${svc}] Connecting to dependencies...`)
    const errLines = scenarioLogLines(scenario, svc)
    if (errLines.length > 0) {
      lines.push(...errLines)
    } else {
      lines.push(`${ts()} ERROR [${svc}] Service unhealthy — error_rate=${((svcState.error_rate ?? 0) * 100).toFixed(1)}%`)
      lines.push(`${ts()} ERROR [${svc}] p99_latency=${svcState.p99_latency_ms}ms`)
    }
    lines.push(`${ts()} WARN  [${svc}] Health check failing`)
    lines.push(`${ts()} ERROR [${svc}] Readiness probe failed`)
  } else {
    lines.push(...healthyLogLines(svc))
  }
  return lines.join('\n')
}

export async function runSimulator(
  command: string,
  systemState: SystemState
): Promise<SimulatorResponse> {
  const conditions = getStateConditions(systemState)
  const cmdLower = command.toLowerCase().trim()

  try {
    const result = await pool.query<{ stdout: string; exit_code: number; latency_ms: number }>(
      `SELECT stdout, exit_code, latency_ms
       FROM command_responses
       WHERE $1 ILIKE '%' || command_pattern || '%'
         AND state_condition = ANY($2::text[])
       ORDER BY priority DESC, LENGTH(command_pattern) DESC
       LIMIT 1`,
      [cmdLower, conditions]
    )
    if (result.rows.length > 0) {
      const row = result.rows[0]
      return { stdout: row.stdout, exit_code: row.exit_code, latency_ms: row.latency_ms }
    }
  } catch (err) {
    console.error('DB lookup error in simulator:', err)
  }

  return localFallback(cmdLower, systemState)
}

// eslint-disable-next-line complexity
function localFallback(cmd: string, state: SystemState): SimulatorResponse {
  const redis = state.infrastructure.caches[0]
  const pgPrimary = state.infrastructure.databases[0]
  const scenario = state.scenario_id ?? ''
  const cluster = state.infrastructure.clusters[0]
  const ok = (stdout: string, latency_ms = 120): SimulatorResponse => ({ stdout, exit_code: 0, latency_ms })
  const err = (stdout: string, latency_ms = 200, exit_code = 1): SimulatorResponse => ({ stdout, exit_code, latency_ms })

  // ── Utility: resolve service name from a pod name or partial name ──────────
  const resolveSvc = (token: string): string | null => {
    for (const svc of allServices(state)) {
      if (token.startsWith(svc) || token.includes(svc)) return svc
    }
    return null
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KUBECTL
  // ─────────────────────────────────────────────────────────────────────────
  if (cmd.startsWith('kubectl')) {
    const parts = cmd.replace(/\s+/g, ' ').split(' ')
    const subCmd = parts[1] ?? ''
    const resource = parts[2] ?? ''

    // ── kubectl get pods ──────────────────────────────────────────────────
    if (subCmd === 'get' && (resource === 'pods' || resource === 'pod')) {
      // kube-system namespace
      if (cmd.includes('-n kube-system')) {
        const out = [
          'NAME                                        READY   STATUS    RESTARTS   AGE',
          'coredns-5d78c9869d-8xvkq                    1/1     Running   0          14d',
          'coredns-5d78c9869d-bq9kp                    1/1     Running   0          14d',
          'etcd-master-0                               1/1     Running   0          14d',
          'kube-apiserver-master-0                     1/1     Running   0          14d',
          'kube-controller-manager-master-0            1/1     Running   0          14d',
          'kube-proxy-4xklv                            1/1     Running   0          14d',
          'kube-proxy-9n2rt                            1/1     Running   0          14d',
          'kube-scheduler-master-0                     1/1     Running   0          14d',
          'metrics-server-7db4566489-vb9kq             1/1     Running   0          14d',
        ].join('\n')
        return ok(out, 150)
      }
      // prod / all namespaces
      const rows = buildPodRows(state)
      return ok(fmtPodTable(rows), 180)
    }

    // ── kubectl describe pod ──────────────────────────────────────────────
    if (subCmd === 'describe' && (resource === 'pod' || resource === 'pods')) {
      const podToken = parts[3] ?? ''
      const svc = resolveSvc(podToken) ?? 'api-gateway'
      const svcState = state.services[svc]
      const svcStatus = svcState?.status ?? 'healthy'
      const node = `gke-prod-pool-${shortHash(svc + 'node', 8)}`
      const image = `gcr.io/prod-project/${svc}:${shortHash(svc + 'sha', 12)}`
      const eventsSection = svcStatus === 'down'
        ? [
            `  Warning  BackOff    2m    kubelet  Back-off restarting failed container`,
            `  Warning  Failed     3m    kubelet  Error: container ${svc} failed with exit code 1`,
            ...(scenario === 'pod-oom-killed' ? ['  Warning  OOMKilling  1m   kubelet  Container killed due to OOM: limit=2Gi rss=2.1Gi'] : []),
            ...(scenario === 'config-key-missing' ? [`  Warning  Failed      5m   kubelet  Error: configmap key PAYMENT_PROVIDER_SECRET not found`] : []),
          ].join('\n')
        : svcStatus === 'degraded'
          ? `  Warning  Unhealthy  90s  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 503\n  Normal   Pulled     3d   kubelet  Successfully pulled image "${image}"`
          : `  Normal   Pulled     3d   kubelet  Successfully pulled image "${image}"\n  Normal   Started    3d   kubelet  Started container ${svc}`

      const out = `Name:         ${podToken || podName(svc, 0)}
Namespace:    prod
Node:         ${node}/10.128.0.${shortHash(svc, 2)}
Status:       ${svcStatus === 'down' ? 'Failed' : 'Running'}
IP:           10.96.${shortHash(svc, 2)}.${shortHash(svc + 'ip', 2)}
Image:        ${image}
Limits:
  cpu:        500m
  memory:     ${scenario === 'pod-oom-killed' ? '2Gi' : '512Mi'}
Requests:
  cpu:        100m
  memory:     128Mi
Environment:
  APP_ENV:          production
  K8S_NAMESPACE:    prod
  DATABASE_URL:     postgres://app:***@postgres-primary.db.svc.cluster.local:5432/appdb
  REDIS_URL:        redis://redis-primary.cache.svc.cluster.local:6379
  LOG_LEVEL:        info
Conditions:
  Ready:   ${svcStatus === 'down' ? 'False' : 'True'}
Events:
${eventsSection}`
      return ok(out, 220)
    }

    // ── kubectl logs ──────────────────────────────────────────────────────
    if (subCmd === 'logs') {
      const target = parts[3] ?? parts[2] ?? ''
      const svc = resolveSvc(target) ?? 'api-gateway'
      return ok(serviceLogsOutput(svc, state), 200)
    }

    // ── kubectl get deployments ───────────────────────────────────────────
    if (subCmd === 'get' && (resource === 'deployments' || resource === 'deployment' || resource === 'deploy')) {
      const header = 'NAME                        READY   UP-TO-DATE   AVAILABLE   AGE'
      const rows = allServices(state).map(svc => {
        const svcState = state.services[svc]
        const status = svcState?.status ?? 'healthy'
        const ready = status === 'down' ? '0/3' : status === 'degraded' ? '2/3' : '3/3'
        const available = status === 'down' ? '0' : status === 'degraded' ? '2' : '3'
        return svc.padEnd(32) + ready.padEnd(8) + '3'.padEnd(13) + available.padEnd(12) + '14d'
      })
      return ok([header, ...rows].join('\n'), 160)
    }

    // ── kubectl get services / svc ────────────────────────────────────────
    if (subCmd === 'get' && (resource === 'services' || resource === 'service' || resource === 'svc')) {
      const header = 'NAME                        TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE'
      const rows = allServices(state).map((svc, i) => {
        const ip = `10.96.${i + 1}.${shortHash(svc, 3).charCodeAt(0) % 200 + 10}`
        const port = svc === 'api-gateway' ? '80:30080/TCP' : '8080/TCP'
        const type = svc === 'api-gateway' ? 'LoadBalancer' : 'ClusterIP'
        const ext = svc === 'api-gateway' ? '34.102.45.67' : '<none>'
        return svc.padEnd(32) + type.padEnd(12) + ip.padEnd(17) + ext.padEnd(14) + port.padEnd(11) + '14d'
      })
      return ok([header, ...rows].join('\n'), 140)
    }

    // ── kubectl get nodes ─────────────────────────────────────────────────
    if (subCmd === 'get' && resource === 'nodes') {
      const totalNodes = cluster?.nodes ?? 12
      const healthyNodes = cluster?.healthy_nodes ?? 12
      const header = 'NAME                                 STATUS   ROLES    AGE   VERSION'
      const nodeRows: string[] = []
      for (let i = 0; i < totalNodes; i++) {
        const name = `gke-prod-pool-${shortHash('node' + i, 8)}`
        const isHealthy = i < healthyNodes
        const status = isHealthy ? 'Ready' : 'NotReady'
        const role = i === 0 ? 'master' : '<none>'
        nodeRows.push(name.padEnd(37) + status.padEnd(9) + role.padEnd(9) + '14d   v1.28.4')
      }
      return ok([header, ...nodeRows].join('\n'), 180)
    }

    // ── kubectl describe node ─────────────────────────────────────────────
    if (subCmd === 'describe' && resource === 'node') {
      const nodeName = parts[3] ?? `gke-prod-pool-${shortHash('node0', 8)}`
      const out = `Name:     ${nodeName}
Roles:    <none>
Labels:   kubernetes.io/arch=amd64
          kubernetes.io/os=linux
          cloud.google.com/gke-nodepool=default-pool
Capacity:
  cpu:               8
  memory:            32Gi
  pods:              110
Allocatable:
  cpu:               7800m
  memory:            29Gi
  pods:              110
Conditions:
  Ready   True
System Info:
  OS Image:           Container-Optimized OS from Google
  Kernel Version:     5.15.65+
  Container Runtime:  containerd://1.6.8
  Kubelet Version:    v1.28.4
  Kube-Proxy Version: v1.28.4
Non-terminated Pods: ${allServices(state).length * 3}
Allocated resources:
  cpu:    3200m (41%)
  memory: 12Gi  (41%)`
      return ok(out, 220)
    }

    // ── kubectl get configmap / cm ─────────────────────────────────────────
    if (subCmd === 'get' && (resource === 'configmap' || resource === 'configmaps' || resource === 'cm')) {
      const header = 'NAME                        DATA   AGE'
      const rows = [
        'cluster-config              4      14d',
        'app-config                  8      14d',
        'env-config                  6      14d',
        ...allServices(state).map(svc => `${svc}-config`.padEnd(32) + '5      14d'),
      ]
      return ok([header, ...rows].join('\n'), 130)
    }

    // ── kubectl describe configmap ─────────────────────────────────────────
    if (subCmd === 'describe' && (resource === 'configmap' || resource === 'cm')) {
      const cmName = parts[3] ?? 'app-config'
      const isMissingKey = scenario === 'config-key-missing' && cmName.includes('payment')
      const data = isMissingKey
        ? `Data\n====\nPAYMENT_PROVIDER_URL:\n----\nhttps://api.stripe.com\nAPP_ENV:\n----\nproduction\n# NOTE: PAYMENT_PROVIDER_SECRET key is missing from this ConfigMap`
        : `Data\n====\nAPP_ENV:\n----\nproduction\nLOG_LEVEL:\n----\ninfo\nDATABASE_URL:\n----\npostgres://app:***@postgres-primary.db.svc.cluster.local:5432/appdb\nREDIS_URL:\n----\nredis://redis-primary.cache.svc.cluster.local:6379\nMAX_CONNECTIONS:\n----\n100`
      return ok(`Name:         ${cmName}\nNamespace:    prod\n${data}`, 150)
    }

    // ── kubectl get events ────────────────────────────────────────────────
    if (subCmd === 'get' && resource === 'events') {
      const header = 'LAST SEEN   TYPE      REASON              OBJECT                            MESSAGE'
      const eventLines: string[] = []
      for (const svc of allServices(state)) {
        const svcState = state.services[svc]
        const status = svcState?.status ?? 'healthy'
        if (status === 'down') {
          const pod = podName(svc, 0)
          eventLines.push(`2m          Warning   BackOff             pod/${pod}   Back-off restarting failed container`)
          eventLines.push(`3m          Warning   Failed              pod/${pod}   Error: container exited with code 1`)
        } else if (status === 'degraded') {
          const pod = podName(svc, 1)
          eventLines.push(`90s         Warning   Unhealthy           pod/${pod}   Readiness probe failed: statuscode 503`)
        }
      }
      if (eventLines.length === 0) {
        eventLines.push('5m          Normal    Pulled              pod/api-gateway-abc-xyz   Successfully pulled image')
        eventLines.push('10m         Normal    Scheduled           pod/api-gateway-abc-xyz   Assigned to node gke-prod-pool-aa1b2c3d')
      }
      return ok([header, ...eventLines].join('\n'), 170)
    }

    // ── kubectl rollout status ─────────────────────────────────────────────
    if (subCmd === 'rollout' && resource === 'status') {
      const target = parts[3] ?? 'deployment/api-gateway'
      const svcName = target.replace('deployment/', '')
      const svcState = state.services[svcName]
      const status = svcState?.status ?? 'healthy'
      if (status === 'down') {
        return err(`Waiting for deployment "${svcName}" rollout to finish: 0 of 3 updated replicas are available...`, 300)
      }
      if (status === 'degraded') {
        return ok(`Waiting for deployment "${svcName}" rollout to finish: 2 of 3 updated replicas are available...`, 250)
      }
      return ok(`deployment.apps/${svcName} successfully rolled out`, 150)
    }

    // ── kubectl top pods ──────────────────────────────────────────────────
    if (subCmd === 'top' && resource === 'pods') {
      const header = 'NAME                                        CPU(cores)   MEMORY(bytes)'
      const rows = allServices(state).flatMap((svc, _i) => {
        const svcState = state.services[svc]
        const status = svcState?.status ?? 'healthy'
        return [0, 1, 2].map(j => {
          const name = podName(svc, j)
          let cpu: string
          let mem: string
          if (status === 'down') {
            cpu = '0m'; mem = '0Mi'
          } else if (status === 'degraded') {
            cpu = j === 1 ? `${480 + j * 10}m` : `${120 + j * 15}m`
            mem = j === 1 ? (scenario === 'pod-oom-killed' ? '1980Mi' : '420Mi') : '180Mi'
          } else {
            cpu = `${80 + j * 12}m`; mem = `${160 + j * 20}Mi`
          }
          return name.padEnd(44) + cpu.padEnd(13) + mem
        })
      })
      return ok([header, ...rows].join('\n'), 200)
    }

    // ── kubectl top nodes ─────────────────────────────────────────────────
    if (subCmd === 'top' && resource === 'nodes') {
      const header = 'NAME                                 CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%'
      const totalNodes = cluster?.nodes ?? 12
      const nodeRows: string[] = []
      for (let i = 0; i < Math.min(totalNodes, 6); i++) {
        const name = `gke-prod-pool-${shortHash('node' + i, 8)}`
        const cpuPct = scenario === 'pod-oom-killed' ? 82 + i : 38 + i * 4
        const memPct = scenario === 'pod-oom-killed' ? 91 + i : 44 + i * 3
        nodeRows.push(`${name.padEnd(37)}${(cpuPct * 78).toString().padEnd(13)}${cpuPct}%    ${(memPct * 327).toString().padEnd(16)}${memPct}%`)
      }
      return ok([header, ...nodeRows].join('\n'), 190)
    }

    // ── kubectl exec ──────────────────────────────────────────────────────
    if (subCmd === 'exec') {
      const dashIdx = parts.indexOf('--')
      const execCmd = dashIdx !== -1 ? parts.slice(dashIdx + 1).join(' ') : '(no command)'
      return ok(`# ${execCmd}`, 200)
    }

    // Unknown kubectl command — graceful fallback
    return err(`error: unknown command "${subCmd}" for "kubectl"\nRun 'kubectl --help' for usage.`, 100)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REDIS-CLI
  // ─────────────────────────────────────────────────────────────────────────
  if (cmd.startsWith('redis-cli')) {
    if (redis?.status === 'down') {
      return err('Could not connect to Redis at redis-primary.cache.svc.cluster.local:6379: Connection refused', 2500)
    }

    if (cmd.includes('ping')) {
      return ok('PONG', 5)
    }

    if (cmd.includes('dbsize')) {
      return ok(`(integer) ${redis ? Math.round(redis.memory_used_mb * 120) : 48200}`, 10)
    }

    if (cmd.includes('keys *')) {
      return ok([
        '1) "session:usr_9a3f1b"',
        '2) "cart:usr_b2c4d5"',
        '3) "product:sku_1234"',
        '4) "order:ord_88abc1"',
        '5) "rate-limit:ip_192.168.1.42"',
        '6) "cache:homepage"',
        '... (and more)',
      ].join('\n'), 30)
    }

    if (cmd.includes('monitor')) {
      return ok([
        `OK`,
        `1712345678.123456 [0 10.96.2.14:41234] "GET" "session:usr_9a3f1b"`,
        `1712345678.125012 [0 10.96.3.8:52210]  "SET" "cart:usr_b2c4d5" "..."`,
        `1712345678.126999 [0 10.96.2.14:41234] "EXPIRE" "session:usr_9a3f1b" "3600"`,
        `1712345678.129441 [0 10.96.4.11:33819] "GET" "product:sku_1234"`,
      ].join('\n'), 20)
    }

    if (cmd.includes('info memory')) {
      const usedMb = redis?.memory_used_mb ?? 512
      const totalMb = redis?.memory_total_mb ?? 1024
      return ok([
        '# Memory',
        `used_memory:${Math.round(usedMb * 1048576)}`,
        `used_memory_human:${usedMb.toFixed(1)}M`,
        `used_memory_rss:${Math.round(usedMb * 1.3 * 1048576)}`,
        `used_memory_peak:${Math.round(totalMb * 0.95 * 1048576)}`,
        `used_memory_peak_human:${(totalMb * 0.95).toFixed(1)}M`,
        `maxmemory:${Math.round(totalMb * 1048576)}`,
        `maxmemory_human:${totalMb.toFixed(0)}M`,
        `maxmemory_policy:allkeys-lru`,
        `mem_fragmentation_ratio:1.24`,
      ].join('\n'), 15)
    }

    if (cmd.includes('info')) {
      const usedMb = redis?.memory_used_mb ?? 512
      const totalMb = redis?.memory_total_mb ?? 1024
      const hitRate = redis?.hit_rate ?? 0.85
      const hits = Math.round(hitRate * 1000000)
      const misses = Math.round((1 - hitRate) * 1000000)
      return ok([
        '# Server',
        'redis_version:7.0.11',
        'redis_mode:standalone',
        'os:Linux 5.15.0-1034-gke x86_64',
        'tcp_port:6379',
        `uptime_in_seconds:${14 * 86400}`,
        '',
        '# Replication',
        'role:master',
        'connected_slaves:2',
        '',
        '# Memory',
        `used_memory_human:${usedMb.toFixed(1)}M`,
        `maxmemory_human:${totalMb.toFixed(0)}M`,
        `mem_fragmentation_ratio:1.24`,
        '',
        '# Stats',
        `total_connections_received:4829241`,
        `total_commands_processed:98234100`,
        `keyspace_hits:${hits}`,
        `keyspace_misses:${misses}`,
        `keyspace_hit_rate:${(hitRate * 100).toFixed(2)}%`,
        '',
        '# Keyspace',
        `db0:keys=${Math.round(usedMb * 120)},expires=${Math.round(usedMb * 80)},avg_ttl=3480012`,
      ].join('\n'), 20)
    }

    return ok('OK', 10)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PSQL / DATABASE
  // ─────────────────────────────────────────────────────────────────────────
  if (cmd.startsWith('psql') || (cmd.includes('psql') && cmd.includes('-c'))) {
    if (pgPrimary?.status === 'down') {
      return err(`psql: error: connection to server at "postgres-primary" (10.0.1.10), port 5432 failed:\nFATAL:  sorry, too many clients already\nconnection to server failed`, 5000)
    }

    const queryLatency = pgPrimary?.query_latency_ms ?? 50
    const connCount = pgPrimary?.connection_count ?? 40

    // Extract the -c "..." query
    const cMatch = cmd.match(/-c\s+"([^"]+)"/i) ?? cmd.match(/-c\s+'([^']+)'/i)
    const query = (cMatch?.[1] ?? '').toLowerCase().trim()

    if (!query) {
      // Just psql connection — interactive
      if (pgPrimary?.status === 'degraded') {
        return ok(`psql (14.8)\nType "help" for help.\n\nWARNING: query latency is elevated (${queryLatency}ms avg)\nappdb=#`, 1200)
      }
      return ok(`psql (14.8)\nType "help" for help.\n\nappdb=#`, 400)
    }

    if (query.includes('pg_stat_activity')) {
      return ok(
        ` datname | count \n---------+-------\n appdb   | ${connCount}\n(1 row)`,
        Math.min(queryLatency, 5000)
      )
    }

    if (query.startsWith('select count(*)')) {
      const tableName = query.match(/from\s+(\w+)/)?.[1] ?? 'records'
      const counts: Record<string, number> = {
        orders: 4820341, users: 1923000, sessions: 82341,
        products: 48200, payments: 3912000, events: 10234100,
      }
      const count = counts[tableName] ?? 128400
      return ok(` count  \n--------\n ${count}\n(1 row)`, Math.min(queryLatency, 3000))
    }

    if (query.startsWith('explain')) {
      const isAnalyze = query.includes('analyze')
      const cost = scenario === 'db-slow-queries' ? '184234.00' : '234.50'
      const rows2 = scenario === 'db-slow-queries' ? '2341432' : '1024'
      const actualTime = scenario === 'db-slow-queries' ? `actual time=0.043..8423.210 rows=${rows2}` : `actual time=0.042..12.340 rows=${rows2}`
      const plan = [
        `                             QUERY PLAN`,
        `------------------------------------------------------------------------`,
        `Seq Scan on orders  (cost=0.00..${cost} rows=${rows2} width=328)${isAnalyze ? `\n              (${actualTime} loops=1)` : ''}`,
        `  Filter: (status = 'pending'::text)`,
        ...(scenario !== 'db-slow-queries' ? ['  ->  Index Scan using orders_pkey on orders'] : []),
        `Planning Time: 0.${shortHash('plan', 3)} ms`,
        ...(isAnalyze ? [`Execution Time: ${scenario === 'db-slow-queries' ? '8427.912' : '13.204'} ms`] : []),
      ]
      return ok(plan.join('\n'), Math.min(queryLatency + 100, 5000))
    }

    if (query === '\\dt' || query.includes('information_schema.tables')) {
      return ok([
        '         List of relations',
        ' Schema |      Name       | Type  |  Owner',
        '--------+-----------------+-------+---------',
        ' public | events          | table | postgres',
        ' public | orders          | table | postgres',
        ' public | payments        | table | postgres',
        ' public | products        | table | postgres',
        ' public | sessions        | table | postgres',
        ' public | users           | table | postgres',
        '(6 rows)',
      ].join('\n'), queryLatency)
    }

    if (query === '\\l' || query.includes('pg_database')) {
      return ok([
        '                               List of databases',
        '   Name    |  Owner   | Encoding | Collate |  Ctype  |   Access privileges',
        '-----------+----------+----------+---------+---------+---------------------',
        ' appdb     | postgres | UTF8     | C       | C       |',
        ' postgres  | postgres | UTF8     | C       | C       |',
        ' template0 | postgres | UTF8     | C       | C       | =c/postgres',
        '(3 rows)',
      ].join('\n'), queryLatency)
    }

    // Generic slow-query warning
    if (pgPrimary?.status === 'degraded') {
      return ok(`WARNING: query took ${queryLatency}ms (slow query detected)\n(1 row)`, queryLatency)
    }

    return ok(`(1 row)\n\nTime: ${queryLatency}.000 ms`, queryLatency)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NETWORK / CONNECTIVITY
  // ─────────────────────────────────────────────────────────────────────────

  if (cmd.startsWith('nc ')) {
    const isBlock = scenario === 'network-policy-block' || scenario === 'db-replica-ip-change'
    const hostMatch = cmd.match(/nc\s+(?:-[zv]+\s+)*(\S+)\s+(\d+)/)
    const host = hostMatch?.[1] ?? 'host'
    const port = hostMatch?.[2] ?? '80'
    const affectedHosts = ['10.0.1.45', 'postgres-replica', 'payment-service', 'auth-service']
    const isAffected = isBlock && affectedHosts.some(h => host.includes(h))
    if (isAffected) {
      return err(`nc: connect to ${host} port ${port} (tcp) failed: Connection refused`, 3000)
    }
    return ok(`Connection to ${host} ${port} port [tcp] succeeded!`, 200)
  }

  if (cmd.startsWith('curl')) {
    const urlMatch = cmd.match(/https?:\/\/[^\s'"]+/)
    const url = urlMatch?.[0] ?? 'http://api-gateway/'
    // Guess which service from URL
    let targetSvc = 'api-gateway'
    for (const svc of allServices(state)) {
      if (url.includes(svc)) { targetSvc = svc; break }
    }
    const svcState = state.services[targetSvc]
    const status = svcState?.status ?? 'healthy'
    if (status === 'down') {
      return err(`curl: (7) Failed to connect to ${url}: Connection refused`, 4000)
    }
    if (status === 'degraded') {
      const verbose = cmd.includes('-v')
      const body = `{"error":"Internal Server Error","service":"${targetSvc}","code":500}`
      return err(verbose
        ? `* Connected to ${url} (10.96.1.1) port 80\n> GET / HTTP/1.1\n< HTTP/1.1 500 Internal Server Error\n< content-type: application/json\n\n${body}`
        : body, 3000, 22)
    }
    const verbose = cmd.includes('-v')
    const body = `{"status":"ok","service":"${targetSvc}","version":"1.4.${shortHash(targetSvc, 2)}"}`
    return ok(verbose
      ? `* Connected to ${url} (10.96.1.1) port 80\n> GET / HTTP/1.1\n< HTTP/1.1 200 OK\n< content-type: application/json\n\n${body}`
      : body, 180)
  }

  if (cmd.startsWith('nslookup') || cmd.startsWith('dig')) {
    const parts2 = cmd.split(' ')
    const hostArg = parts2.find(p => !p.startsWith('-') && p !== 'nslookup' && p !== 'dig') ?? 'api-gateway'
    const ip = `10.96.${shortHash(hostArg, 1).charCodeAt(0) % 200 + 10}.${shortHash(hostArg + 'b', 1).charCodeAt(0) % 200 + 10}`
    return ok(`Server:  kube-dns.kube-system.svc.cluster.local\nAddress: 10.96.0.10#53\n\nName:   ${hostArg}.prod.svc.cluster.local\nAddress: ${ip}`, 80)
  }

  if (cmd.startsWith('ping ')) {
    const host = cmd.split(' ').find(p => !p.startsWith('-') && p !== 'ping') ?? 'host'
    return ok(`PING ${host}: 56 data bytes\n64 bytes from ${host}: icmp_seq=0 ttl=64 time=0.412 ms\n64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.381 ms\n64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.399 ms\n--- ${host} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss`, 400)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYSTEM COMMANDS
  // ─────────────────────────────────────────────────────────────────────────

  if (cmd === 'df -h' || cmd === 'df -hT' || cmd.startsWith('df ')) {
    const pct = scenario === 'pod-oom-killed' ? '94%' : '62%'
    return ok([
      'Filesystem      Size  Used Avail Use% Mounted on',
      `overlay         100G   ${pct === '94%' ? '94G' : '62G'}  ${pct === '94%' ? '6.0G' : '38G'}  ${pct} /`,
      'tmpfs            64M     0   64M   0% /dev',
      'tmpfs            16G   12M   16G   1% /sys/fs/cgroup',
      '/dev/sda1       100G   ${pct} remaining / (same overlay)',
      'shm              64M     0   64M   0% /dev/shm',
    ].join('\n'), 80)
  }

  if (cmd.startsWith('free')) {
    const isOom = scenario === 'pod-oom-killed'
    const total = 32768
    const used = isOom ? Math.round(total * 0.93) : Math.round(total * 0.54)
    const free = total - used
    const cached = isOom ? 200 : 4096
    const unit = cmd.includes('-m') ? 'Mi' : 'Gi'
    const div = unit === 'Gi' ? 1024 : 1
    return ok([
      `              total        used        free      shared  buff/cache   available`,
      `Mem:       ${(total / div).toFixed(0).padStart(10)} ${(used / div).toFixed(0).padStart(11)} ${(free / div).toFixed(0).padStart(11)}      ${(cached / div).toFixed(0).padStart(4)}        ${(cached / div).toFixed(0).padStart(4)}     ${(free / div).toFixed(0).padStart(8)}`,
      `Swap:           0           0           0`,
    ].join('\n'), 60)
  }

  if (cmd === 'top' || cmd === 'htop' || cmd.startsWith('top ') || cmd.startsWith('htop ')) {
    const isHigh = Object.values(state.services).some(s => s.status !== 'healthy')
    const cpuUs = isHigh ? 78.4 : 24.2
    const loadAvg = isHigh ? '4.82, 3.91, 2.45' : '1.21, 0.95, 0.82'
    const procs = allServices(state).map((svc, i) => {
      const svcState = state.services[svc]
      const pct = svcState?.status === 'down' ? 0 : svcState?.status === 'degraded' ? 60 + i * 4 : 8 + i * 2
      return ` ${(1000 + i * 37).toString().padEnd(7)} node       ${pct.toFixed(1).padStart(5)}   8.2  /app/${svc}/index.js`
    })
    return ok([
      `top - ${new Date().toTimeString().slice(0, 8)} up 14 days,  2:18,  1 user,  load average: ${loadAvg}`,
      `Tasks: ${allServices(state).length * 3 + 8} total,   2 running, ${allServices(state).length * 3 + 6} sleeping`,
      `%Cpu(s): ${cpuUs.toFixed(1)} us,  5.2 sy,  0.0 ni, ${(100 - cpuUs - 5.2).toFixed(1)} id`,
      `MiB Mem:  32768.0 total,  ${(32768 * 0.43).toFixed(1)} free,  ${(32768 * 0.48).toFixed(1)} used`,
      '',
      '  PID    COMMAND         %CPU   %MEM   COMMAND',
      ...procs,
    ].join('\n'), 150)
  }

  if (cmd.startsWith('journalctl')) {
    const svcMatch = cmd.match(/-u\s+(\S+)/)
    const svc = svcMatch?.[1] ?? 'api-gateway'
    return ok(serviceLogsOutput(svc, state), 200)
  }

  if (cmd === 'env') {
    return ok([
      'APP_ENV=production',
      'K8S_NAMESPACE=prod',
      'HOSTNAME=api-gateway-' + shortHash('hostname', 8),
      'DATABASE_URL=postgres://app:***@postgres-primary.db.svc.cluster.local:5432/appdb',
      'REDIS_URL=redis://redis-primary.cache.svc.cluster.local:6379',
      'LOG_LEVEL=info',
      'PORT=8080',
      'METRICS_PORT=9090',
      'TRACE_EXPORTER=jaeger',
      'JAEGER_ENDPOINT=http://jaeger-collector.observability.svc.cluster.local:14268/api/traces',
    ].join('\n'), 30)
  }

  if (cmd === 'cat /etc/hostname' || cmd === 'hostname') {
    return ok(`api-gateway-${shortHash('hostname', 8)}`, 20)
  }

  if (cmd.startsWith('uname')) {
    return ok('Linux gke-prod-pool-aa1b2c3d 5.15.65+ #1 SMP Fri Jan 20 01:23:45 UTC 2024 x86_64 GNU/Linux', 20)
  }

  if (cmd.startsWith('ps ')) {
    const procLines = allServices(state).map((svc, i) => {
      return `${(1000 + i * 37).toString().padStart(7)} ?        Sl   ${(12 + i * 3).toFixed(1)}  node /app/${svc}/dist/index.js`
    })
    return ok([
      'USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
      '  root         1  0.0  0.0   4236   760 ?        Ss   Jan01   0:00 /bin/sh -c node /app/index.js',
      ...procLines,
    ].join('\n'), 80)
  }

  if (cmd === 'uptime') {
    const isHigh = Object.values(state.services).some(s => s.status !== 'healthy')
    const load = isHigh ? '4.82, 3.91, 2.45' : '1.21, 0.95, 0.82'
    return ok(` ${new Date().toTimeString().slice(0, 8)} up 14 days,  2:18,  1 user,  load average: ${load}`, 20)
  }

  if (cmd === 'ls' || cmd.startsWith('ls ')) {
    return ok('app  bin  boot  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var', 40)
  }

  if (cmd.startsWith('cat ')) {
    const file = cmd.slice(4).trim()
    if (file.includes('config') || file.includes('.yaml') || file.includes('.json')) {
      if (scenario === 'config-key-missing' && file.includes('payment')) {
        return ok('APP_ENV: production\nPAYMENT_PROVIDER_URL: https://api.stripe.com\n# PAYMENT_PROVIDER_SECRET: <MISSING>', 30)
      }
      return ok('APP_ENV: production\nLOG_LEVEL: info\nMAX_CONNECTIONS: 100\nDATABASE_URL: postgres://app:***@postgres-primary:5432/appdb', 30)
    }
    return ok(`cat: ${file}: No such file or directory`, 20)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GCLOUD / CLOUD
  // ─────────────────────────────────────────────────────────────────────────

  if (cmd.startsWith('gcloud')) {
    if (cmd.includes('container clusters list')) {
      return ok([
        'NAME         LOCATION       MASTER_VERSION  MASTER_IP       MACHINE_TYPE   NODE_VERSION  NUM_NODES  STATUS',
        `prod-cluster us-central1    1.28.4-gke.10   34.102.45.67    e2-standard-4  1.28.4        ${cluster?.nodes ?? 12}          RUNNING`,
        'staging      us-central1-a  1.28.2-gke.8    34.102.21.11    e2-standard-2  1.28.2        3          RUNNING',
      ].join('\n'), 800)
    }

    if (cmd.includes('container clusters get-credentials')) {
      return ok('Fetching cluster endpoint and auth data.\nkubeconfig entry generated for prod-cluster.', 1200)
    }

    if (cmd.includes('sql instances list')) {
      const rows = state.infrastructure.databases.map(db => {
        return `${db.name.padEnd(28)}POSTGRES_14  us-central1  ${db.status.toUpperCase().padEnd(12)} 10.0.1.${shortHash(db.name, 2).charCodeAt(0) % 200 + 10}`
      })
      return ok(['NAME                        DATABASE_VERSION  LOCATION     STATUS       PRIMARY_ADDRESS', ...rows].join('\n'), 900)
    }

    if (cmd.includes('sql instances describe')) {
      const instName = cmd.split('describe')[1]?.trim() ?? pgPrimary?.name ?? 'postgres-primary'
      const db = state.infrastructure.databases.find(d => instName.includes(d.name)) ?? pgPrimary
      return ok([
        `name: ${db?.name ?? instName}`,
        `databaseVersion: POSTGRES_14`,
        `region: us-central1`,
        `state: ${db?.status === 'down' ? 'MAINTENANCE' : 'RUNNABLE'}`,
        `connectionName: prod-project:us-central1:${db?.name ?? instName}`,
        `ipAddresses:`,
        `- ipAddress: 10.0.1.10`,
        `  type: PRIVATE`,
        `settings:`,
        `  tier: db-custom-8-32768`,
        `  activationPolicy: ALWAYS`,
        `  availabilityType: REGIONAL`,
      ].join('\n'), 1000)
    }

    if (cmd.includes('spanner') && scenario === 'spanner-high-utilization') {
      const db = state.infrastructure.databases.find(d => d.name === 'spanner-primary')
      if (db?.status === 'degraded') {
        return err('ERROR: Cloud Spanner instance prod-catalog: Node us-central1-b CPU 92%. Queries experiencing elevated latency.', 3000)
      }
    }

    return ok(`Updated property [core/project].\nRun 'gcloud help' for usage.`, 300)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELM
  // ─────────────────────────────────────────────────────────────────────────

  if (cmd.startsWith('helm')) {
    if (cmd.includes('list')) {
      const header = 'NAME                        NAMESPACE  REVISION  UPDATED                          STATUS     CHART                       APP VERSION'
      const rows = allServices(state).map(svc => {
        const svcState = state.services[svc]
        const helmStatus = svcState?.status === 'down' ? 'failed' : 'deployed'
        return `${svc.padEnd(32)}prod       4         2024-03-15 10:23:${shortHash(svc, 2)} UTC  ${helmStatus.padEnd(11)}${svc}-1.4.0               1.4.${shortHash(svc, 2)}`
      })
      return ok([header, ...rows].join('\n'), 600)
    }

    if (cmd.includes('status')) {
      const releaseName = cmd.split('status')[1]?.trim().split(' ')[0] ?? 'api-gateway'
      const svcState = state.services[releaseName]
      const helmStatus = svcState?.status === 'down' ? 'failed' : 'deployed'
      return ok(`NAME: ${releaseName}\nLAST DEPLOYED: Fri Mar 15 10:23:41 2024\nNAMESPACE: prod\nSTATUS: ${helmStatus}\nREVISION: 4\nNOTES:\n  Service is accessible at http://${releaseName}.prod.svc.cluster.local:8080`, 500)
    }

    return ok('Error: run "helm --help" for usage.', 100)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIMPLE BUILTINS
  // ─────────────────────────────────────────────────────────────────────────

  if (cmd.startsWith('echo ')) return ok(cmd.slice(5), 20)
  if (cmd === 'date') return ok(new Date().toUTCString(), 20)
  if (cmd === 'whoami') return ok('root', 10)
  if (cmd === 'id') return ok('uid=0(root) gid=0(root) groups=0(root)', 10)
  if (cmd === 'pwd') return ok('/app', 10)
  if (cmd.startsWith('which ')) return ok(`/usr/bin/${cmd.slice(6).trim()}`, 15)
  if (cmd.startsWith('export ') || cmd.startsWith('set ') || cmd === 'set') return ok('', 10)
  if (cmd.startsWith('mkdir ') || cmd.startsWith('touch ') || cmd.startsWith('chmod ') || cmd.startsWith('chown ')) return ok('', 20)
  if (cmd.startsWith('rm ')) return ok('', 20)

  // ─────────────────────────────────────────────────────────────────────────
  // CATCH-ALL FOR KNOWN BINARIES
  // ─────────────────────────────────────────────────────────────────────────

  const knownBinaries = ['grep', 'sed', 'awk', 'jq', 'sort', 'uniq', 'wc', 'head', 'tail',
    'cut', 'tr', 'xargs', 'tee', 'less', 'more', 'watch', 'timeout', 'sleep',
    'kubectl', 'helm', 'gcloud', 'aws', 'az', 'terraform', 'ansible',
    'python', 'python3', 'node', 'bash', 'sh', 'zsh',
    'systemctl', 'service', 'crontab', 'netstat', 'ss', 'ip', 'ifconfig',
    'lsof', 'strace', 'tcpdump', 'openssl', 'ssh', 'scp', 'rsync']

  const cmdName = cmd.split(' ')[0] ?? cmd
  if (knownBinaries.includes(cmdName)) {
    // Return plausible generic output rather than command not found
    if (cmdName === 'grep') {
      const scenarioErrMsg = scenarioLogLines(scenario, 'service').join('\n')
      return ok(scenarioErrMsg || 'No matches found', 60)
    }
    if (cmdName === 'jq') return ok('{}', 30)
    if (cmdName === 'netstat' || cmdName === 'ss') {
      return ok([
        'Netid  State   Recv-Q  Send-Q  Local Address:Port  Peer Address:Port',
        'tcp    LISTEN  0       128     0.0.0.0:8080        0.0.0.0:*',
        'tcp    LISTEN  0       128     0.0.0.0:9090        0.0.0.0:*',
        `tcp    ESTAB   0       0       10.96.1.1:8080      10.96.${shortHash('conn1', 2)}.1:41234`,
      ].join('\n'), 80)
    }
    if (cmdName === 'systemctl') return ok(`● ${cmd.split(' ').slice(-1)[0]} service is running (active)`, 80)
    if (cmdName === 'python' || cmdName === 'python3') return ok('Python 3.11.4', 20)
    if (cmdName === 'node') return ok('v18.17.0', 10)
    if (cmdName === 'openssl') return ok('OpenSSL 3.0.2 15 Mar 2022 (Library: OpenSSL 3.0.2 15 Mar 2022)', 20)
    if (cmdName === 'lsof') {
      return ok([
        'COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
        `node    1000 root    8u  IPv4  12345      0t0  TCP *:8080 (LISTEN)`,
        `node    1000 root   12u  IPv4  12346      0t0  TCP *:9090 (LISTEN)`,
      ].join('\n'), 100)
    }
    // generic fallback for known binaries
    return ok('', 50)
  }

  return err(
    `${cmdName}: command not found\nTry: kubectl, redis-cli, psql, gcloud, nc, curl, df, free, top, helm`,
    80, 127
  )
}
