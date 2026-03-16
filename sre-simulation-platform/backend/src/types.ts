export interface Alert {
  id: string
  severity: 'sev1' | 'sev2' | 'sev3'
  service: string
  message: string
  fired_at: string
  acknowledged: boolean
}

export interface ServiceState {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  error_rate: number
  p99_latency_ms: number
  dependencies: string[]
  current_alerts: Alert[]
}

export interface ClusterState {
  name: string
  nodes: number
  healthy_nodes: number
}

export interface DatabaseState {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  connection_count: number
  max_connections: number
  query_latency_ms: number
}

export interface CacheState {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  hit_rate: number
  memory_used_mb: number
  memory_total_mb: number
}

export interface ExternalDepState {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  latency_ms: number
}

export interface Incident {
  id: string
  root_cause: string
  visible_symptoms: string[]
  blast_radius: string[]
  injected_at: string
  resolved_at?: string
}

export interface SystemState {
  session_id: string
  scenario_id: string
  sim_time: string
  services: Record<string, ServiceState>
  active_incidents: Incident[]
  resolved_incidents: Incident[]
  infrastructure: {
    clusters: ClusterState[]
    databases: DatabaseState[]
    caches: CacheState[]
    external_deps: ExternalDepState[]
  }
  metrics_snapshot: Record<string, number>
}

export interface SessionEvent {
  id: string
  ts: string
  sim_ts: string
  type: EventType
  payload: Record<string, unknown>
  system_state_snapshot_id: string
}

export type EventType =
  | 'alert_received'
  | 'page_acknowledged'
  | 'command_run'
  | 'dashboard_viewed'
  | 'logs_queried'
  | 'runbook_called'
  | 'slack_sent'
  | 'severity_declared'
  | 'escalation_triggered'
  | 'remediation_attempted'
  | 'incident_resolved'
  | 'postmortem_submitted'

export interface Runbook {
  id: string
  title: string
  content: string
}

export interface Dashboard {
  id: string
  name: string
  services: string[]
}

export interface FailureStep {
  trigger_at_minutes: number
  description: string
  apply: (state: SystemState) => SystemState
}

export interface ScenarioTemplate {
  id: string
  name: string
  difficulty: 'junior' | 'senior' | 'chaos'
  description: string
  topology_description: string
  initial_system_state: SystemState
  failure_sequence: FailureStep[]
  expected_root_cause: string
  expected_resolution_steps: string[]
  available_runbooks: Runbook[]
  available_dashboards: Dashboard[]
  passing_score: number
  time_limit_minutes: number
}

export interface MetricPoint {
  service: string
  metric: string
  value: number
  unit: string
}

export interface Scorecard {
  session_id: string
  overall_score: number
  dimensions: {
    coordination: { score: number; notes: string }
    resolution: { score: number; notes: string }
    technical_depth: { score: number; notes: string }
    observability: { score: number; notes: string }
  }
  timeline_highlights: { ts: string; event: string; quality: 'poor' | 'okay' | 'good' | 'excellent' }[]
  postmortem: string
}

export type ClientMessage =
  | { type: 'start_session'; payload: { candidate_name: string } }
  | { type: 'run_command'; payload: { cmd: string } }
  | { type: 'query_dashboard'; payload: { dashboard_id: string } }
  | { type: 'read_logs'; payload: { service: string; filter?: string } }
  | { type: 'call_runbook'; payload: { id: string } }
  | { type: 'send_slack'; payload: { channel: string; message: string } }
  | { type: 'declare_severity'; payload: { severity: 'sev1' | 'sev2' | 'sev3' } }
  | { type: 'escalate'; payload: { to: string; message: string } }
  | { type: 'resolve_incident'; payload: Record<string, never> }

export type ServerMessage =
  | { type: 'session_started'; payload: { session_id: string; scenario_name: string; difficulty: string; time_limit_minutes: number; module_type: 'incident' | 'sql' | 'monitoring'; question_id: string | null; initial_alerts: Alert[]; available_runbooks: { id: string; title: string }[]; available_dashboards: { id: string; name: string }[] } }
  | { type: 'command_response'; payload: { stdout: string; exit_code: number; latency_ms: number } }
  | { type: 'log_response'; payload: { lines: string[] } }
  | { type: 'dashboard_response'; payload: { dashboard_id: string; name: string; metrics: MetricPoint[] } }
  | { type: 'runbook_response'; payload: { id: string; title: string; content: string } }
  | { type: 'slack_ack'; payload: { channel: string; ts: string } }
  | { type: 'state_update'; payload: SystemState }
  | { type: 'new_alert'; payload: Alert }
  | { type: 'session_ended'; payload: { reason: 'time_limit' | 'resolved' | 'manual'; duration_minutes: number } }
  | { type: 'scorecard'; payload: Scorecard }
  | { type: 'thinking'; payload: { message: string } }
  | { type: 'error'; payload: { message: string } }

export interface SessionState {
  session_id: string
  candidate_name: string
  scenario: ScenarioTemplate
  system_state: SystemState
  event_log: SessionEvent[]
  started_at: Date
  sim_time_offset_seconds: number
  severity_declared?: 'sev1' | 'sev2' | 'sev3'
  resolved: boolean
  applied_steps: Set<number>
  ticker?: ReturnType<typeof setInterval>
  recovery_ticks: number
}
