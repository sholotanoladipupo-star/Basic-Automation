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

function localFallback(cmd: string, state: SystemState): SimulatorResponse {
  const redis = state.infrastructure.caches[0]
  const pgPrimary = state.infrastructure.databases[0]
  const scenario = state.scenario_id ?? ''

  if ((cmd.includes('redis') || cmd.includes('6379')) && redis?.status === 'down') {
    return { stdout: 'Could not connect to Redis at redis-primary.cache.svc.cluster.local:6379: Connection refused', exit_code: 1, latency_ms: 2500 }
  }
  if ((cmd.includes('psql') || cmd.includes('postgres')) && pgPrimary?.status === 'down') {
    return { stdout: 'psql: error: connection to server failed: FATAL:  sorry, too many clients already', exit_code: 1, latency_ms: 5000 }
  }
  if (cmd.includes('psql') && scenario === 'db-slow-queries' && pgPrimary?.status === 'degraded') {
    return { stdout: 'psql: WARNING: transaction took 8423ms (slow query detected)', exit_code: 0, latency_ms: 8500 }
  }
  if ((cmd.includes('gcloud spanner') || cmd.includes('spanner')) && scenario === 'spanner-high-utilization') {
    const db = state.infrastructure.databases.find(d => d.name === 'spanner-primary')
    if (db?.status === 'degraded') return { stdout: 'ERROR: Cloud Spanner instance prod-catalog: Node us-central1-b CPU 92%. Queries experiencing elevated latency.', exit_code: 1, latency_ms: 3000 }
  }
  if (cmd.startsWith('kubectl') && scenario === 'pod-crashloop') {
    const svc = state.services['checkout-service']
    if (svc?.status === 'down' && cmd.includes('get pods')) {
      return { stdout: 'NAME                                READY   STATUS             RESTARTS   AGE\ncheckout-service-5b7c8d6f4-abc1    0/1     CrashLoopBackOff   8          12m\ncheckout-service-5b7c8d6f4-abc2    0/1     CrashLoopBackOff   8          12m\ncheckout-service-5b7c8d6f4-abc3    0/1     CrashLoopBackOff   7          12m', exit_code: 0, latency_ms: 180 }
    }
  }
  if (cmd.startsWith('kubectl')) {
    return { stdout: `Error from server: resource not found\nUsage: kubectl [command] [TYPE] [NAME] [flags]`, exit_code: 1, latency_ms: 200 }
  }
  if (cmd === 'ls' || cmd.startsWith('ls ')) {
    return { stdout: `bin  boot  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var`, exit_code: 0, latency_ms: 60 }
  }
  if (cmd === 'top' || cmd === 'htop' || cmd.startsWith('top ')) {
    return { stdout: `top - 14:03:21 up 14 days  load average: 4.82, 3.91, 2.45\n%Cpu(s): 78.4 us  MiB Mem: 15953.0 total  14234.4 used\n PID  CMD          %CPU  %MEM\n1234  postgres     89.1  24.4\n5678  node         45.2   5.6`, exit_code: 0, latency_ms: 150 }
  }
  if (cmd.startsWith('ping ')) {
    const host = cmd.split(' ')[1] ?? 'host'
    return { stdout: `PING ${host}: 56 data bytes\n64 bytes from ${host}: icmp_seq=0 ttl=64 time=0.412 ms`, exit_code: 0, latency_ms: 400 }
  }
  if (cmd.startsWith('echo ')) return { stdout: cmd.slice(5), exit_code: 0, latency_ms: 30 }
  if (cmd === 'date') return { stdout: new Date().toUTCString(), exit_code: 0, latency_ms: 30 }

  const cmdName = cmd.split(' ')[0] ?? cmd
  return { stdout: `${cmdName}: command not found\nTry: kubectl, redis-cli, psql, gcloud, nc, curl, df, free, top`, exit_code: 127, latency_ms: 80 }
}
