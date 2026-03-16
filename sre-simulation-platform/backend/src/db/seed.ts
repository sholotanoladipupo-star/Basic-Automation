/**
 * Seed pre-defined command responses into Neon DB.
 * Run: npx ts-node src/db/seed.ts
 *
 * State conditions used by the simulator:
 *   always           - applies regardless of incident state
 *   redis_down       - redis status === 'down'
 *   redis_recovering - redis status === 'degraded' (restarting)
 *   redis_healthy    - redis status === 'healthy' hit_rate > 0.7
 *   db_overloaded    - postgres connection_count > 100 or status degraded
 *   db_down          - postgres status === 'down'
 *   services_degraded - order-service error_rate > 0.2
 *   services_down    - order-service status === 'down'
 */

import { pool } from './client'
import { initDb } from './init'

interface SeedRow {
  scenario_id: string
  command_pattern: string
  state_condition: string
  stdout: string
  exit_code: number
  latency_ms: number
  priority: number
}

const rows: SeedRow[] = [

  // ─── kubectl get pods (production namespace, no -n flag) ───────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get pods',
    state_condition: 'services_down',
    priority: 4,
    exit_code: 0, latency_ms: 180,
    stdout: `NAME                                READY   STATUS             RESTARTS   AGE
api-gateway-7d4f8b9c6-xkp2m        1/1     Running            0          2d4h
product-service-6c8d9f7b5-mn3p     0/1     CrashLoopBackOff   14         9m
order-service-5b7c8d6f4-qr7s       0/1     CrashLoopBackOff   21         9m
payment-service-4a6b7c5e3-ts9k     0/1     CrashLoopBackOff   8          9m
user-service-3e5f6d4c2-vw2x        1/1     Running            4          2d4h`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get pods',
    state_condition: 'services_degraded',
    priority: 3,
    exit_code: 0, latency_ms: 180,
    stdout: `NAME                                READY   STATUS             RESTARTS   AGE
api-gateway-7d4f8b9c6-xkp2m        1/1     Running            0          2d4h
product-service-6c8d9f7b5-mn3p     0/1     CrashLoopBackOff   7          6m
order-service-5b7c8d6f4-qr7s       0/1     CrashLoopBackOff   11         6m
payment-service-4a6b7c5e3-ts9k     1/1     Running            2          2d4h
user-service-3e5f6d4c2-vw2x        1/1     Running            1          2d4h`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get pods',
    state_condition: 'redis_down',
    priority: 1,
    exit_code: 0, latency_ms: 180,
    stdout: `NAME                                READY   STATUS    RESTARTS   AGE
api-gateway-7d4f8b9c6-xkp2m        1/1     Running   0          2d4h
product-service-6c8d9f7b5-mn3p     1/1     Running   0          2d4h
order-service-5b7c8d6f4-qr7s       1/1     Running   2          2d4h
payment-service-4a6b7c5e3-ts9k     1/1     Running   0          2d4h
user-service-3e5f6d4c2-vw2x        1/1     Running   0          2d4h`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get pods',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 180,
    stdout: `NAME                                READY   STATUS    RESTARTS   AGE
api-gateway-7d4f8b9c6-xkp2m        1/1     Running   0          2d4h
product-service-6c8d9f7b5-mn3p     1/1     Running   0          2d4h
order-service-5b7c8d6f4-qr7s       1/1     Running   0          2d4h
payment-service-4a6b7c5e3-ts9k     1/1     Running   0          2d4h
user-service-3e5f6d4c2-vw2x        1/1     Running   0          2d4h`
  },

  // ─── kubectl get pods -n cache ─────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get pods -n cache',
    state_condition: 'redis_recovering',
    priority: 2,
    exit_code: 0, latency_ms: 160,
    stdout: `NAME              READY   STATUS              RESTARTS   AGE
redis-primary-0   1/1     Running             1          48s
redis-primary-1   0/1     ContainerCreating   0          23s
redis-primary-2   0/1     ContainerCreating   0          8s`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get pods -n cache',
    state_condition: 'redis_down',
    priority: 1,
    exit_code: 0, latency_ms: 160,
    stdout: `NAME              READY   STATUS      RESTARTS   AGE
redis-primary-0   0/1     OOMKilled   3          9m
redis-primary-1   0/1     OOMKilled   3          9m
redis-primary-2   0/1     OOMKilled   3          9m`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get pods -n cache',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 160,
    stdout: `NAME              READY   STATUS    RESTARTS   AGE
redis-primary-0   1/1     Running   0          2d4h
redis-primary-1   1/1     Running   0          2d4h
redis-primary-2   1/1     Running   0          2d4h`
  },

  // ─── kubectl get pods -n db ────────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get pods -n db',
    state_condition: 'db_down',
    priority: 2,
    exit_code: 0, latency_ms: 160,
    stdout: `NAME                 READY   STATUS             RESTARTS   AGE
postgres-primary-0   0/1     CrashLoopBackOff   5          4m
postgres-replica-0   1/1     Running            0          7d`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get pods -n db',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 160,
    stdout: `NAME                 READY   STATUS    RESTARTS   AGE
postgres-primary-0   1/1     Running   0          7d
postgres-replica-0   1/1     Running   0          7d`
  },

  // ─── kubectl describe pod redis-primary-0 ──────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl describe pod redis-primary-0',
    state_condition: 'redis_down',
    priority: 1,
    exit_code: 0, latency_ms: 200,
    stdout: `Name:         redis-primary-0
Namespace:    cache
Node:         ip-10-0-1-45.us-east-1.compute.internal/10.0.1.45
Start Time:   Mon, 15 Jan 2024 13:55:00 +0000
Labels:       app=redis
              statefulset.kubernetes.io/pod-name=redis-primary-0
Status:       Failed
IP:           10.0.2.15
Containers:
  redis:
    Image:         redis:7.2-alpine
    Port:          6379/TCP
    Limits:
      memory:  4Gi
    Last State:  Terminated
      Reason:    OOMKilled
      Exit Code: 137
      Started:   Mon, 15 Jan 2024 14:00:41 +0000
      Finished:  Mon, 15 Jan 2024 14:00:44 +0000
    Ready:          False
    Restart Count:  3
Conditions:
  Ready: False
Events:
  Type     Reason      Age    From     Message
  ----     ------      ---    ----     -------
  Warning  OOMKilling  9m45s  kubelet  Memory cgroup out of memory: Kill process 1 (redis-server) score 1967
  Warning  BackOff     9m30s  kubelet  Back-off restarting failed container redis in pod redis-primary-0_cache
  Warning  OOMKilling  7m12s  kubelet  Memory cgroup out of memory: Kill process 1 (redis-server) score 1967
  Warning  BackOff     6m58s  kubelet  Back-off restarting failed container redis in pod redis-primary-0_cache
  Warning  OOMKilling  4m33s  kubelet  Memory cgroup out of memory: Kill process 1 (redis-server) score 1967`
  },

  // ─── kubectl logs redis-primary-0 (prev) ───────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl logs redis-primary-0',
    state_condition: 'redis_down',
    priority: 1,
    exit_code: 0, latency_ms: 220,
    stdout: `1:M 15 Jan 2024 13:58:02.341 # oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo
1:M 15 Jan 2024 13:58:02.343 # Configuration loaded
1:M 15 Jan 2024 13:58:02.346 * Server initialized
1:M 15 Jan 2024 13:58:02.347 * Ready to accept connections tcp
1:M 15 Jan 2024 13:59:14.102 * 1204 clients connected, 1841729280 bytes in use
1:M 15 Jan 2024 13:59:41.102 * 1847 clients connected, 2841729280 bytes in use
1:M 15 Jan 2024 13:59:55.887 * 2103 clients connected, 3412992840 bytes in use
1:M 15 Jan 2024 14:00:08.234 # WARNING: 32 bytes left before maxmemory is reached. Eviction policy is noeviction!
1:M 15 Jan 2024 14:00:33.891 # WARNING: 0 bytes left before maxmemory is reached. Eviction policy is noeviction!
1:M 15 Jan 2024 14:00:44.123 # OOM command not allowed when used memory > 'maxmemory'.
1:M 15 Jan 2024 14:00:44.201 # Can't save in background: fork: Cannot allocate memory
1:M 15 Jan 2024 14:00:44.234 # SIGKILL received, aborting now.`
  },

  // ─── redis-cli ping ────────────────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'redis-cli ping',
    state_condition: 'redis_down',
    priority: 2,
    exit_code: 1, latency_ms: 3000,
    stdout: `Could not connect to Redis at redis-primary.cache.svc.cluster.local:6379: Connection refused`
  },
  {
    scenario_id: 'global',
    command_pattern: 'redis-cli ping',
    state_condition: 'redis_recovering',
    priority: 2,
    exit_code: 0, latency_ms: 80,
    stdout: `PONG`
  },
  {
    scenario_id: 'global',
    command_pattern: 'redis-cli ping',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 80,
    stdout: `PONG`
  },

  // ─── redis-cli info memory ─────────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'redis-cli info memory',
    state_condition: 'redis_down',
    priority: 2,
    exit_code: 1, latency_ms: 3000,
    stdout: `Could not connect to Redis at redis-primary.cache.svc.cluster.local:6379: Connection refused`
  },
  {
    scenario_id: 'global',
    command_pattern: 'redis-cli info memory',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 90,
    stdout: `# Memory
used_memory:2306867200
used_memory_human:2.15G
used_memory_rss:2415919104
used_memory_rss_human:2.25G
used_memory_peak:4249124880
used_memory_peak_human:3.96G
used_memory_peak_perc:54.29%
maxmemory:4294967296
maxmemory_human:4.00G
maxmemory_policy:noeviction
mem_fragmentation_ratio:1.05
active_defrag_running:0`
  },

  // ─── redis-cli cluster info ────────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'redis-cli cluster info',
    state_condition: 'redis_down',
    priority: 2,
    exit_code: 1, latency_ms: 3000,
    stdout: `Could not connect to Redis at redis-primary.cache.svc.cluster.local:6379: Connection refused`
  },
  {
    scenario_id: 'global',
    command_pattern: 'redis-cli cluster info',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 85,
    stdout: `cluster_enabled:0
cluster_state:ok
cluster_slots_assigned:0
cluster_slots_ok:0
cluster_known_nodes:0
cluster_size:0
cluster_current_epoch:0
cluster_my_epoch:0
cluster_stats_messages_sent:0
cluster_stats_messages_received:0`
  },

  // ─── nc / telnet redis port check ──────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'nc -zv redis-primary',
    state_condition: 'redis_down',
    priority: 2,
    exit_code: 1, latency_ms: 2000,
    stdout: `nc: connect to redis-primary.cache.svc.cluster.local port 6379 (tcp) failed: Connection refused`
  },
  {
    scenario_id: 'global',
    command_pattern: 'nc -zv redis-primary',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 50,
    stdout: `Connection to redis-primary.cache.svc.cluster.local 6379 port [tcp/redis] succeeded!`
  },

  // ─── kubectl rollout restart redis ─────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl rollout restart statefulset/redis-primary',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 350,
    stdout: `statefulset.apps/redis-primary restarted`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl rollout restart statefulset redis-primary',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 350,
    stdout: `statefulset.apps/redis-primary restarted`
  },

  // ─── kubectl rollout status redis ──────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl rollout status statefulset/redis-primary',
    state_condition: 'redis_down',
    priority: 1,
    exit_code: 0, latency_ms: 400,
    stdout: `Waiting for 3 pods to be ready...
Waiting for pod redis-primary-0 to be running...`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl rollout status statefulset/redis-primary',
    state_condition: 'redis_recovering',
    priority: 2,
    exit_code: 0, latency_ms: 400,
    stdout: `Waiting for 2 pods to be ready...
redis-primary-0 is up to date
Waiting for pod redis-primary-1 to be ready...`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl rollout status statefulset/redis-primary',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 400,
    stdout: `statefulset rolling update complete 3 pods at revision redis-primary-77d9f84b7c...`
  },

  // ─── psql connection pool / pg_stat_activity ───────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'pg_stat_activity',
    state_condition: 'db_down',
    priority: 3,
    exit_code: 1, latency_ms: 8000,
    stdout: `psql: error: connection to server at "postgres-primary.db.svc.cluster.local" (10.0.3.20), port 5432 failed: FATAL:  sorry, too many clients already`
  },
  {
    scenario_id: 'global',
    command_pattern: 'pg_stat_activity',
    state_condition: 'db_overloaded',
    priority: 2,
    exit_code: 0, latency_ms: 1800,
    stdout: ` count |              state
-------+---------------------------------
   183 | active
    14 | idle
     3 | idle in transaction (aborted)
(3 rows)

WARNING: Connection pool near capacity. 183/200 connections active.`
  },
  {
    scenario_id: 'global',
    command_pattern: 'pg_stat_activity',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 120,
    stdout: ` count | state
-------+--------
    45 | active
    12 | idle
(2 rows)`
  },

  // ─── kubectl logs order-service ────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl logs order-service',
    state_condition: 'services_degraded',
    priority: 3,
    exit_code: 0, latency_ms: 250,
    stdout: `2024-01-15T14:01:34.123Z ERROR: Failed to connect to Redis: connect ECONNREFUSED 10.0.2.15:6379
2024-01-15T14:01:34.145Z ERROR: DB query timeout 8500ms: SELECT * FROM orders WHERE user_id=$1
2024-01-15T14:01:34.156Z ERROR: Connection pool exhausted: pool_size=20 queue_depth=847
2024-01-15T14:01:34.201Z WARN:  Falling back to direct DB query (cache unavailable)
2024-01-15T14:01:34.234Z ERROR: Failed to place order uid=84729: timeout
2024-01-15T14:01:35.012Z INFO:  GET /health → 503 (circuit breaker open)
2024-01-15T14:01:35.089Z ERROR: Failed to connect to Redis: connect ECONNREFUSED 10.0.2.15:6379
2024-01-15T14:01:35.102Z ERROR: DB query timeout 8500ms
2024-01-15T14:01:36.234Z ERROR: 847 requests queued, dropping oldest (queue_full=true)
2024-01-15T14:01:36.501Z ERROR: Failed to connect to Redis: connect ECONNREFUSED 10.0.2.15:6379`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl logs order-service',
    state_condition: 'redis_down',
    priority: 1,
    exit_code: 0, latency_ms: 250,
    stdout: `2024-01-15T14:00:51.023Z WARN:  Redis connection lost, retrying...
2024-01-15T14:00:51.234Z ERROR: Failed to connect to Redis: connect ECONNREFUSED 10.0.2.15:6379
2024-01-15T14:00:52.100Z WARN:  Redis connection lost, falling back to DB cache bypass
2024-01-15T14:00:52.445Z INFO:  GET /api/orders/summary → 200 (89ms, no cache)
2024-01-15T14:00:53.001Z INFO:  POST /api/orders → 200 (234ms, no cache)
2024-01-15T14:00:54.334Z WARN:  DB query latency elevated: avg=340ms p99=1200ms
2024-01-15T14:00:55.891Z ERROR: Failed to connect to Redis: connect ECONNREFUSED 10.0.2.15:6379`
  },

  // ─── kubectl logs product-service ──────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl logs product-service',
    state_condition: 'redis_down',
    priority: 1,
    exit_code: 0, latency_ms: 220,
    stdout: `2024-01-15T14:00:45.112Z ERROR: Redis ECONNREFUSED 10.0.2.15:6379 (attempt 1/3)
2024-01-15T14:00:45.345Z ERROR: Redis ECONNREFUSED 10.0.2.15:6379 (attempt 2/3)
2024-01-15T14:00:45.567Z ERROR: Redis ECONNREFUSED 10.0.2.15:6379 (attempt 3/3) — giving up
2024-01-15T14:00:45.789Z WARN:  Cache unavailable, serving stale data from DB
2024-01-15T14:00:46.234Z INFO:  GET /api/products → 200 (1847ms, db fallback)
2024-01-15T14:00:47.891Z INFO:  GET /api/products/123 → 200 (2103ms, db fallback)
2024-01-15T14:00:49.012Z WARN:  DB connection pool: 89/100 (high)`
  },

  // ─── kubectl top pods ──────────────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl top pods',
    state_condition: 'db_overloaded',
    priority: 2,
    exit_code: 0, latency_ms: 300,
    stdout: `NAME                                CPU(cores)   MEMORY(bytes)
api-gateway-7d4f8b9c6-xkp2m        125m         234Mi
product-service-6c8d9f7b5-mn3p     892m         1124Mi
order-service-5b7c8d6f4-qr7s       <unknown>    <unknown>
payment-service-4a6b7c5e3-ts9k     342m         445Mi
user-service-3e5f6d4c2-vw2x        89m          178Mi`
  },
  {
    scenario_id: 'global',
    command_pattern: 'kubectl top pods',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 300,
    stdout: `NAME                                CPU(cores)   MEMORY(bytes)
api-gateway-7d4f8b9c6-xkp2m        45m          156Mi
product-service-6c8d9f7b5-mn3p     78m          234Mi
order-service-5b7c8d6f4-qr7s       92m          312Mi
payment-service-4a6b7c5e3-ts9k     61m          189Mi
user-service-3e5f6d4c2-vw2x        34m          145Mi`
  },

  // ─── kubectl get nodes ─────────────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get nodes',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 160,
    stdout: `NAME                                         STATUS   ROLES    AGE   VERSION
ip-10-0-1-45.us-east-1.compute.internal     Ready    <none>   14d   v1.28.4
ip-10-0-1-67.us-east-1.compute.internal     Ready    <none>   14d   v1.28.4
ip-10-0-2-23.us-east-1.compute.internal     Ready    <none>   14d   v1.28.4
ip-10-0-2-89.us-east-1.compute.internal     Ready    <none>   14d   v1.28.4
ip-10-0-3-12.us-east-1.compute.internal     Ready    <none>   14d   v1.28.4
ip-10-0-3-56.us-east-1.compute.internal     Ready    <none>   14d   v1.28.4`
  },

  // ─── kubectl get events -n cache ───────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get events -n cache',
    state_condition: 'redis_down',
    priority: 1,
    exit_code: 0, latency_ms: 190,
    stdout: `LAST SEEN   TYPE      REASON      OBJECT                MESSAGE
9m45s       Warning   OOMKilling  Pod/redis-primary-0   Memory cgroup out of memory: Kill process 1 (redis-server)
9m44s       Warning   OOMKilling  Pod/redis-primary-1   Memory cgroup out of memory: Kill process 1 (redis-server)
9m43s       Warning   OOMKilling  Pod/redis-primary-2   Memory cgroup out of memory: Kill process 1 (redis-server)
9m30s       Warning   BackOff     Pod/redis-primary-0   Back-off restarting failed container redis
9m29s       Warning   BackOff     Pod/redis-primary-1   Back-off restarting failed container redis
7m12s       Warning   OOMKilling  Pod/redis-primary-0   Memory cgroup out of memory: Kill process 1 (redis-server)
5m10s       Normal    Pulling     Pod/redis-primary-0   Pulling image "redis:7.2-alpine"
4m55s       Normal    Started     Pod/redis-primary-0   Started container redis
4m33s       Warning   OOMKilling  Pod/redis-primary-0   Memory cgroup out of memory: Kill process 1 (redis-server)`
  },

  // ─── kubectl get events (all namespaces) ───────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get events',
    state_condition: 'redis_down',
    priority: 1,
    exit_code: 0, latency_ms: 200,
    stdout: `NAMESPACE   LAST SEEN   TYPE      REASON      OBJECT                MESSAGE
cache       9m45s       Warning   OOMKilling  Pod/redis-primary-0   Memory cgroup out of memory: Kill process 1 (redis-server)
cache       9m30s       Warning   BackOff     Pod/redis-primary-0   Back-off restarting failed container redis
cache       7m12s       Warning   OOMKilling  Pod/redis-primary-0   Memory cgroup out of memory
production  6m34s       Warning   Unhealthy   Pod/order-service     Readiness probe failed: HTTP probe failed with statuscode: 503
production  6m12s       Warning   BackOff     Pod/order-service     Back-off restarting failed container order-service`
  },

  // ─── kubectl get svc ───────────────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'kubectl get svc',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 140,
    stdout: `NAME              TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
api-gateway       ClusterIP   10.96.1.10      <none>        80/TCP     14d
order-service     ClusterIP   10.96.1.11      <none>        3000/TCP   14d
product-service   ClusterIP   10.96.1.12      <none>        3001/TCP   14d
payment-service   ClusterIP   10.96.1.13      <none>        3002/TCP   14d
user-service      ClusterIP   10.96.1.14      <none>        3003/TCP   14d
redis-primary     ClusterIP   10.96.2.10      <none>        6379/TCP   14d
postgres-primary  ClusterIP   10.96.3.10      <none>        5432/TCP   14d
postgres-replica  ClusterIP   10.96.3.11      <none>        5432/TCP   14d`
  },

  // ─── df -h ─────────────────────────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'df -h',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 80,
    stdout: `Filesystem      Size  Used Avail Use% Mounted on
overlay         100G   45G   55G  45% /
tmpfs            64M     0   64M   0% /dev
/dev/nvme0n1p1  100G   45G   55G  45% /etc/hosts
shm              64M     0   64M   0% /dev/shm`
  },

  // ─── free -m / memory ──────────────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'free -m',
    state_condition: 'db_overloaded',
    priority: 2,
    exit_code: 0, latency_ms: 90,
    stdout: `              total        used        free      shared  buff/cache   available
Mem:          15953       14234         891          12         827        1507
Swap:             0           0           0`
  },
  {
    scenario_id: 'global',
    command_pattern: 'free -m',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 90,
    stdout: `              total        used        free      shared  buff/cache   available
Mem:          15953        6234        7891          12        1827        9507
Swap:             0           0           0`
  },

  // ─── curl health checks ────────────────────────────────────────────────────
  {
    scenario_id: 'global',
    command_pattern: 'curl http://order-service',
    state_condition: 'services_degraded',
    priority: 2,
    exit_code: 0, latency_ms: 8500,
    stdout: `curl: (28) Operation timed out after 8000 milliseconds with 0 bytes received`
  },
  {
    scenario_id: 'global',
    command_pattern: 'curl http://order-service',
    state_condition: 'always',
    priority: 0,
    exit_code: 0, latency_ms: 120,
    stdout: `{"status":"ok","uptime":174832}`
  },
  {
    scenario_id: 'global',
    command_pattern: 'curl http://redis-primary',
    state_condition: 'redis_down',
    priority: 1,
    exit_code: 7, latency_ms: 2000,
    stdout: `curl: (7) Failed to connect to redis-primary.cache.svc.cluster.local port 6379 after 2002 ms: Connection refused`
  },
]

async function seed(): Promise<void> {
  await initDb()

  const client = await pool.connect()
  try {
    await client.query('TRUNCATE TABLE command_responses')
    console.log('Cleared existing command_responses')

    for (const row of rows) {
      await client.query(
        `INSERT INTO command_responses (scenario_id, command_pattern, state_condition, stdout, exit_code, latency_ms, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.scenario_id, row.command_pattern, row.state_condition, row.stdout, row.exit_code, row.latency_ms, row.priority]
      )
    }

    console.log(`Seeded ${rows.length} command responses`)
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch((err) => { console.error(err); process.exit(1) })
