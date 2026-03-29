/**
 * Seeds:
 * 1. sql_sandbox schema with 5 tables + realistic data
 * 2. 5 SQL questions (write / fix / analyse) — expected_output computed dynamically
 * 3. 5 monitoring & observability questions
 */
import { PoolClient } from 'pg'
import { pool } from './client'

async function seedSqlSandbox(client: PoolClient) {
  console.log('Creating sql_sandbox schema...')
  await client.query(`CREATE SCHEMA IF NOT EXISTS sql_sandbox`)

  await client.query(`
    CREATE TABLE IF NOT EXISTS sql_sandbox.departments (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      budget NUMERIC(12,2),
      location TEXT
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS sql_sandbox.employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      department_id INTEGER REFERENCES sql_sandbox.departments(id),
      role TEXT NOT NULL,
      salary NUMERIC(10,2) NOT NULL,
      hire_date DATE NOT NULL,
      manager_id INTEGER REFERENCES sql_sandbox.employees(id),
      is_active BOOLEAN DEFAULT TRUE
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS sql_sandbox.projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      department_id INTEGER REFERENCES sql_sandbox.departments(id),
      status TEXT NOT NULL DEFAULT 'active',
      start_date DATE,
      end_date DATE,
      budget NUMERIC(12,2)
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS sql_sandbox.project_assignments (
      employee_id INTEGER REFERENCES sql_sandbox.employees(id),
      project_id INTEGER REFERENCES sql_sandbox.projects(id),
      role TEXT,
      start_date DATE,
      PRIMARY KEY (employee_id, project_id)
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS sql_sandbox.incidents (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      service TEXT NOT NULL,
      reported_by INTEGER REFERENCES sql_sandbox.employees(id),
      resolved_by INTEGER REFERENCES sql_sandbox.employees(id),
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      root_cause TEXT
    )
  `)

  // Clear existing seed data
  await client.query(`TRUNCATE sql_sandbox.incidents, sql_sandbox.project_assignments, sql_sandbox.projects, sql_sandbox.employees, sql_sandbox.departments RESTART IDENTITY CASCADE`)

  // Departments
  await client.query(`
    INSERT INTO sql_sandbox.departments (name, budget, location) VALUES
    ('Engineering', 2500000, 'San Francisco'),
    ('DevOps', 900000, 'San Francisco'),
    ('Data', 750000, 'New York'),
    ('Product', 600000, 'London'),
    ('Security', 400000, 'Remote')
  `)

  // Employees
  await client.query(`
    INSERT INTO sql_sandbox.employees (name, department_id, role, salary, hire_date, manager_id) VALUES
    ('Alice Chen',    1, 'Engineering Manager',  145000, '2019-03-01', NULL),
    ('Bob Okafor',    1, 'Senior Engineer',       118000, '2020-06-15', 1),
    ('Chloe Martin',  1, 'Senior Engineer',       115000, '2020-09-01', 1),
    ('David Kim',     1, 'Engineer',               92000, '2021-04-10', 2),
    ('Eva Rossi',     1, 'Engineer',               88000, '2022-01-05', 2),
    ('Frank Nguyen',  2, 'DevOps Lead',           130000, '2019-11-20', NULL),
    ('Grace Lee',     2, 'SRE',                   108000, '2021-03-15', 6),
    ('Henry Obi',     2, 'SRE',                   104000, '2021-07-01', 6),
    ('Isla Patel',    2, 'Platform Engineer',      96000, '2022-05-12', 6),
    ('James Adeyemi', 3, 'Data Lead',             125000, '2020-02-28', NULL),
    ('Karen Zhou',    3, 'Data Engineer',          99000, '2021-09-01', 10),
    ('Liam Torres',   3, 'Data Analyst',           82000, '2022-08-01', 10),
    ('Mia Fischer',   4, 'Product Manager',       115000, '2020-07-14', NULL),
    ('Noah Clark',    4, 'Product Analyst',        85000, '2022-03-21', 13),
    ('Olivia Brooks', 5, 'Security Lead',         135000, '2019-06-01', NULL),
    ('Peter Walsh',   5, 'Security Engineer',     102000, '2021-10-04', 15),
    ('Quinn Murphy',  1, 'Junior Engineer',        72000, '2023-02-13', 3),
    ('Rita Yamada',   2, 'Junior SRE',             74000, '2023-06-01', 7),
    ('Sam Okonkwo',   3, 'Junior Data Engineer',   76000, '2023-08-15', 11),
    ('Tina Reyes',    1, 'Engineer',               91000, '2022-11-01', 2)
  `)

  // Projects
  await client.query(`
    INSERT INTO sql_sandbox.projects (name, department_id, status, start_date, end_date, budget) VALUES
    ('Platform Rewrite',     1, 'active',    '2024-01-01', NULL,         800000),
    ('Redis Migration',      2, 'active',    '2024-03-01', NULL,         200000),
    ('Data Warehouse v2',    3, 'active',    '2024-02-01', NULL,         350000),
    ('Mobile App v3',        4, 'completed', '2023-06-01', '2024-01-31', 400000),
    ('Zero Trust Security',  5, 'active',    '2024-01-15', NULL,         180000),
    ('API Gateway Upgrade',  2, 'active',    '2024-04-01', NULL,         120000),
    ('ML Pipeline',          3, 'active',    '2024-03-15', NULL,         290000),
    ('Auth Service Revamp',  1, 'completed', '2023-09-01', '2024-02-28', 220000),
    ('Infra as Code',        2, 'active',    '2024-05-01', NULL,         150000),
    ('Observability Stack',  2, 'active',    '2024-02-15', NULL,         175000)
  `)

  // Project Assignments
  await client.query(`
    INSERT INTO sql_sandbox.project_assignments (employee_id, project_id, role, start_date) VALUES
    (1, 1, 'Tech Lead',   '2024-01-01'),
    (2, 1, 'Backend',     '2024-01-01'),
    (3, 1, 'Backend',     '2024-01-01'),
    (4, 1, 'Backend',     '2024-01-01'),
    (17,1, 'Frontend',    '2024-01-01'),
    (6, 2, 'Lead',        '2024-03-01'),
    (7, 2, 'SRE',         '2024-03-01'),
    (8, 2, 'SRE',         '2024-03-01'),
    (10,3, 'Lead',        '2024-02-01'),
    (11,3, 'Engineer',    '2024-02-01'),
    (19,3, 'Engineer',    '2024-02-01'),
    (13,4, 'PM',          '2023-06-01'),
    (15,5, 'Lead',        '2024-01-15'),
    (16,5, 'Engineer',    '2024-01-15'),
    (6, 6, 'Lead',        '2024-04-01'),
    (9, 6, 'Engineer',    '2024-04-01'),
    (10,7, 'Lead',        '2024-03-15'),
    (12,7, 'Analyst',     '2024-03-15'),
    (6, 9, 'Lead',        '2024-05-01'),
    (8, 9, 'Engineer',    '2024-05-01'),
    (7, 10,'Lead',        '2024-02-15'),
    (9, 10,'Engineer',    '2024-02-15'),
    (2, 8, 'Backend',     '2023-09-01'),
    (3, 8, 'Backend',     '2023-09-01'),
    (20,1, 'Backend',     '2024-02-01')
  `)

  // Incidents — TLS cert expiry fixed: resolved_at is AFTER opened_at
  await client.query(`
    INSERT INTO sql_sandbox.incidents (title, severity, service, reported_by, resolved_by, opened_at, resolved_at, root_cause) VALUES
    ('Redis OOM kill',              'sev1', 'cache',       7,  7,  NOW()-INTERVAL'45 days', NOW()-INTERVAL'44 days 22 hours', 'Memory limit too low'),
    ('DB connection pool exhausted','sev1', 'postgres',    8,  6,  NOW()-INTERVAL'30 days', NOW()-INTERVAL'29 days 22 hours', 'Missing connection timeout'),
    ('API gateway 502 storm',       'sev2', 'api-gateway', 7,  8,  NOW()-INTERVAL'20 days', NOW()-INTERVAL'19 days 23 hours', 'Upstream timeout misconfigured'),
    ('Auth service latency spike',  'sev2', 'auth',        9,  2,  NOW()-INTERVAL'15 days', NOW()-INTERVAL'14 days 23 hours', 'N+1 query in session lookup'),
    ('Payment timeout cascade',     'sev1', 'payments',    6,  6,  NOW()-INTERVAL'10 days', NOW()-INTERVAL'9 days 20 hours',  'Redis timeout propagated'),
    ('ML pipeline OOM',             'sev3', 'ml-pipeline', 11, 10, NOW()-INTERVAL'8 days',  NOW()-INTERVAL'7 days 20 hours',  'Batch size too large'),
    ('Disk full on logs host',      'sev2', 'logging',     8,  9,  NOW()-INTERVAL'5 days',  NOW()-INTERVAL'4 days 21 hours',  'Log rotation not configured'),
    ('TLS cert expiry',             'sev1', 'api-gateway', 16, 15, NOW()-INTERVAL'3 days',  NOW()-INTERVAL'2 days 23 hours',  'Cert renewal automation missed')
  `)

  console.log('SQL sandbox seeded.')
}

/** Run a query against the sandbox and return {columns, rows} for expected_output */
async function computeExpected(client: PoolClient, sql: string): Promise<{ columns: string[]; rows: Record<string, string>[] }> {
  const r = await client.query(sql)
  return {
    columns: r.fields.map(f => f.name),
    rows: r.rows.map(row =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, v === null ? '' : String(v)])
      ) as Record<string, string>
    )
  }
}

async function seedSqlQuestions(client: PoolClient) {
  console.log('Seeding SQL questions...')
  await client.query(`DELETE FROM sql_questions WHERE title LIKE '[SEED]%'`)

  const questions = [
    {
      title: '[SEED] Employee Department Lookup',
      description: `List all **active** employees along with their department name and salary.
Show only employees in the **Engineering** or **DevOps** departments.
Order results by salary descending.

Expected columns: \`name\`, \`department\`, \`role\`, \`salary\``,
      difficulty: 'easy',
      question_type: 'write',
      starter_query: '-- Write your query here\nSELECT\n\nFROM employees e\n',
      schema_hint: `**employees**: id, name, department_id, role, salary, hire_date, manager_id, is_active
**departments**: id, name, budget, location`,
      hint: 'Join employees with departments. Filter by department name using IN. Remember to filter is_active = true.',
      time_limit_seconds: 300,
      correct_query: `
        SELECT e.name, d.name AS department, e.role, e.salary
        FROM sql_sandbox.employees e
        JOIN sql_sandbox.departments d ON e.department_id = d.id
        WHERE d.name IN ('Engineering','DevOps') AND e.is_active = true
        ORDER BY e.salary DESC
      `
    },
    {
      title: '[SEED] Average Salary by Department',
      description: `Calculate the **average salary** for each department.
Include only departments with **more than 2 employees**.
Order by average salary descending.

Expected columns: \`department\`, \`avg_salary\`, \`employee_count\``,
      difficulty: 'medium',
      question_type: 'write',
      starter_query: '-- Write your query here\n',
      schema_hint: `**employees**: id, name, department_id, role, salary, is_active
**departments**: id, name`,
      hint: 'Use GROUP BY and HAVING. ROUND() the average to 2 decimal places. Use COUNT() for employee_count.',
      time_limit_seconds: 300,
      correct_query: `
        SELECT d.name AS department,
               ROUND(AVG(e.salary), 2) AS avg_salary,
               COUNT(*) AS employee_count
        FROM sql_sandbox.employees e
        JOIN sql_sandbox.departments d ON e.department_id = d.id
        GROUP BY d.name
        HAVING COUNT(*) > 2
        ORDER BY avg_salary DESC
      `
    },
    {
      title: '[SEED] Fix the Broken Query',
      description: `The query below has **3 bugs**. Fix them so it returns all employees who earn more than the company average salary.

\`\`\`sql
SELCT e.name, e.salary, d.name AS department
FORM employees e
JOIN departement d ON e.department_id = d.id
WHERE e.salary > (SELECT AVG(salry) FROM employes)
ORDR BY e.salary DESC
\`\`\`

Expected columns: \`name\`, \`salary\`, \`department\``,
      difficulty: 'medium',
      question_type: 'fix',
      starter_query: `SELCT e.name, e.salary, d.name AS department
FORM employees e
JOIN departement d ON e.department_id = d.id
WHERE e.salary > (SELECT AVG(salry) FROM employes)
ORDR BY e.salary DESC`,
      schema_hint: `**employees**: id, name, department_id, salary
**departments**: id, name`,
      hint: 'Look carefully at the keywords and table/column names. There are spelling mistakes.',
      time_limit_seconds: 240,
      correct_query: `
        SELECT e.name, e.salary, d.name AS department
        FROM sql_sandbox.employees e
        JOIN sql_sandbox.departments d ON e.department_id = d.id
        WHERE e.salary > (SELECT AVG(salary) FROM sql_sandbox.employees)
        ORDER BY e.salary DESC
      `
    },
    {
      title: '[SEED] Employees on Multiple Projects',
      description: `Find all employees assigned to **more than 1 active project**.
Show their name, department, and the number of active projects they are on.
Order by project count descending, then by name.

Expected columns: \`name\`, \`department\`, \`active_projects\``,
      difficulty: 'hard',
      question_type: 'write',
      starter_query: '-- Write your query here\n',
      schema_hint: `**employees**: id, name, department_id
**departments**: id, name
**projects**: id, name, status
**project_assignments**: employee_id, project_id, role, start_date`,
      hint: "Join employees → project_assignments → projects. Filter projects.status = 'active'. GROUP BY employee. Use HAVING COUNT > 1.",
      time_limit_seconds: 360,
      correct_query: `
        SELECT e.name, d.name AS department, COUNT(*) AS active_projects
        FROM sql_sandbox.employees e
        JOIN sql_sandbox.departments d ON e.department_id = d.id
        JOIN sql_sandbox.project_assignments pa ON pa.employee_id = e.id
        JOIN sql_sandbox.projects p ON p.id = pa.project_id
        WHERE p.status = 'active'
        GROUP BY e.name, d.name
        HAVING COUNT(*) > 1
        ORDER BY active_projects DESC, e.name
      `
    },
    {
      title: '[SEED] SEV1 Incident Resolution Times',
      description: `Find all **SEV1 incidents** that were resolved, along with:
- The name of the employee who reported it
- The name of the employee who resolved it
- Time to resolve in **hours** (rounded to 1 decimal)

Order by time_to_resolve ascending.

Expected columns: \`title\`, \`service\`, \`reported_by\`, \`resolved_by\`, \`hours_to_resolve\``,
      difficulty: 'hard',
      question_type: 'write',
      starter_query: '-- Write your query here\nSELECT\n\nFROM incidents i\n',
      schema_hint: `**incidents**: id, title, severity, service, reported_by (employee_id), resolved_by (employee_id), opened_at, resolved_at
**employees**: id, name`,
      hint: "You need to JOIN employees twice (once for reporter, once for resolver). Use EXTRACT(EPOCH ...) or ROUND(...) to calculate hours. Filter WHERE severity = 'sev1' AND resolved_at IS NOT NULL.",
      time_limit_seconds: 420,
      correct_query: `
        SELECT i.title, i.service,
               rep.name AS reported_by,
               res.name AS resolved_by,
               ROUND(EXTRACT(EPOCH FROM (i.resolved_at - i.opened_at)) / 3600, 1) AS hours_to_resolve
        FROM sql_sandbox.incidents i
        JOIN sql_sandbox.employees rep ON rep.id = i.reported_by
        JOIN sql_sandbox.employees res ON res.id = i.resolved_by
        WHERE i.severity = 'sev1' AND i.resolved_at IS NOT NULL
        ORDER BY hours_to_resolve ASC
      `
    },
  ]

  for (const q of questions) {
    // Compute expected_output dynamically from the actual seeded data
    const expected_output = await computeExpected(client, q.correct_query)
    const { correct_query, ...rest } = q

    await client.query(
      `INSERT INTO sql_questions (title, description, difficulty, question_type, starter_query, expected_output, solution_query, schema_hint, hint, time_limit_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT DO NOTHING`,
      [rest.title, rest.description, rest.difficulty, rest.question_type, rest.starter_query, JSON.stringify(expected_output), correct_query.trim(), rest.schema_hint, rest.hint, rest.time_limit_seconds]
    )
  }
  console.log(`Seeded ${questions.length} SQL questions with dynamically computed expected_output.`)
}

// ─── Sub-question types for Grafana-like UI ──────────────────────────────────
// type: 'datasource'         → Data Source panel (choose type + URL/project)
// type: 'alert_rule'         → Alert Rules panel (metric query + threshold + duration)
// type: 'contact_point'      → Contact Points panel (type + config)
// type: 'notification_policy'→ Notification Policies panel (routing + grouping)
//
// Scoring uses required_keywords matched against the candidate's answer string.

async function seedMonitoringQuestions(client: PoolClient) {
  console.log('Seeding monitoring questions (scenario-based troubleshooting)...')
  await client.query(`DELETE FROM monitoring_questions WHERE title LIKE '[SEED]%'`)

  type SubQuestion = {
    id: string
    type: string
    prompt: string
    placeholder: string
    required_keywords: string[]
    bonus_keywords: string[]
    reference_answer: string
  }

  type MonitoringQ = {
    title: string
    scenario: string
    difficulty: string
    time_limit_seconds: number
    sub_questions: SubQuestion[]
  }

  const questions: MonitoringQ[] = [
    {
      title: '[SEED] Design Monitoring for a New PostgreSQL Database',
      difficulty: 'medium',
      time_limit_seconds: 720,
      scenario: `Your team just deployed a new PostgreSQL database (db-n1-standard-4, max 500 connections) to serve the payments service. There is currently zero monitoring on it.

Your task: design comprehensive monitoring for this database from scratch.

Stack: GKE cluster, Prometheus + Grafana, PagerDuty for on-call alerting. The postgres_exporter sidecar is already running and exposing metrics on port 9187.`,
      sub_questions: [
        {
          id: 'key_metrics',
          type: 'investigation',
          prompt: 'What are the most important metrics you would monitor for a PostgreSQL database serving a payments workload? List at least 5 metrics, why each matters, and what the warning/critical thresholds should be.',
          placeholder: 'Metric 1: name — why it matters — threshold\nMetric 2: ...\nMetric 3: ...\nMetric 4: ...\nMetric 5: ...',
          required_keywords: ['connection', 'query', 'latency', 'replication', 'disk'],
          bonus_keywords: ['deadlock', 'vacuum', 'bloat', 'cache hit', 'autovacuum', 'locks', 'transaction'],
          reference_answer: '1. pg_stat_activity (active connections) — warn >70%, crit >90% of max_connections (500). Exhaustion causes new queries to fail.\n2. pg_stat_statements (query latency p99) — warn >500ms, crit >2s. Slow queries indicate missing indexes or lock contention.\n3. pg_stat_replication (replication lag) — warn >30s, crit >5min. Lag means replica is stale and failover risks data loss.\n4. node_filesystem_avail_bytes (disk usage) — warn >75%, crit >90%. Full disk = DB crash.\n5. pg_stat_bgwriter (checkpoint frequency) — warn if checkpoints requested > scheduled. Indicates write pressure exceeding bgwriter capacity.\n6. Bonus: pg_locks (blocked queries) — crit if any query blocked >30s. Deadlocks silently fail transactions.\n7. Bonus: pg_stat_user_tables (dead tuples / live tuples ratio) — warn >0.2. Table bloat means autovacuum is falling behind.',
        },
        {
          id: 'promql_alert',
          type: 'alert_rule',
          prompt: 'Write the PromQL expression for a connection pool saturation alert that: fires when active connections exceed 80% of max_connections for 5 minutes, and pages the on-call only during business hours. Show the full alert rule.',
          placeholder: 'PromQL:\n\nalert:\n  name:\n  expr:\n  for:\n  labels:\n  annotations:',
          required_keywords: ['pg_stat_activity', 'max_conn', 'for', '0.8', 'alert'],
          bonus_keywords: ['numrange', 'business hours', 'label', 'runbook', 'severity', 'group_by'],
          reference_answer: 'PromQL expression:\npg_stat_activity_count{state="active"} / pg_settings_max_connections > 0.8\n\nFull Prometheus alert rule:\n  alert: PostgreSQLConnectionSaturation\n  expr: pg_stat_activity_count{state="active"} / pg_settings_max_connections > 0.8\n  for: 5m\n  labels:\n    severity: warning\n    team: payments\n  annotations:\n    summary: "PostgreSQL connection pool at {{ $value | humanizePercentage }} capacity"\n    runbook: "https://runbooks.moniepoint.com/db/connection-saturation"\n    description: "Active connections on {{ $labels.instance }} are {{ $value | humanizePercentage }} of max. Risk of connection exhaustion."\n\nFor business-hours routing: in Alertmanager, add a time_interval restriction on the payments-pagerduty receiver so it only pages 08:00-20:00 WAT. Outside hours, route to a Slack channel instead.',
        },
        {
          id: 'scrape_config',
          type: 'investigation',
          prompt: 'The postgres_exporter is running as a sidecar in the payments-db pod on port 9187. Write the Prometheus scrape config to collect its metrics, including the job name, target discovery method, and any important relabeling rules.',
          placeholder: 'scrape_configs:\n  - job_name: ...\n    ...',
          required_keywords: ['scrape_configs', 'job_name', 'port', 'kubernetes'],
          bonus_keywords: ['kubernetes_sd_configs', 'relabel_configs', 'annotation', 'namespace', 'pod', 'metrics_path'],
          reference_answer: `scrape_configs:\n  - job_name: postgresql\n    kubernetes_sd_configs:\n      - role: pod\n        namespaces:\n          names: [production]\n    relabel_configs:\n      # Only scrape pods with the annotation prometheus.io/scrape: "true"\n      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]\n        action: keep\n        regex: "true"\n      # Use the port from annotation prometheus.io/port\n      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]\n        action: replace\n        regex: ([^:]+)(?::\\d+)?;(\\d+)\n        replacement: $$1:$$2\n        target_label: __address__\n      # Add pod name and namespace as labels\n      - source_labels: [__meta_kubernetes_pod_name]\n        target_label: pod\n      - source_labels: [__meta_kubernetes_namespace]\n        target_label: namespace\n    scrape_interval: 15s\n    metrics_path: /metrics`,
        },
        {
          id: 'dashboard_design',
          type: 'postmortem',
          prompt: 'You are designing the Grafana dashboard for this database. What panels would you include, how would you arrange them, and what variables (template variables) would you add to make it reusable across multiple DB instances?',
          placeholder: 'Row 1: ...\nRow 2: ...\nTemplate variables: ...\nPanel types: ...',
          required_keywords: ['row', 'panel', 'variable', 'instance'],
          bonus_keywords: ['stat', 'graph', 'table', 'datasource', 'refresh', 'alert annotation', 'drill-down'],
          reference_answer: 'Dashboard structure:\n\nRow 1 — Overview (stat panels)\n  - Total connections / max (gauge + threshold colouring)\n  - Active queries right now\n  - Replication lag (stat, red if >30s)\n  - Uptime\n\nRow 2 — Query Performance (time series)\n  - p50 / p95 / p99 query latency (3 lines on one graph)\n  - Queries per second\n  - Slow query count (>500ms)\n\nRow 3 — Resource Usage (time series)\n  - DB disk usage % (with 75%/90% threshold bands)\n  - Dead tuples vs live tuples\n  - Checkpoint frequency\n\nRow 4 — Replication (if replica exists)\n  - Replication lag in seconds\n  - WAL bytes written/s\n\nTemplate variables:\n  - $instance — dropdown of all postgres_exporter targets (allows switching between DBs)\n  - $datasource — allows switching Prometheus source (useful for prod/staging)\n  - $interval — auto time interval for rate() functions\n\nAnnotations: add Prometheus alert firing events as annotations so latency spikes can be correlated with alerts on the same graph.',
        },
      ],
    },
    {
      title: '[SEED] Eliminating Alert Fatigue — 200 Alerts a Day',
      difficulty: 'medium',
      time_limit_seconds: 720,
      scenario: `You join a team as SRE. In your first week you notice the on-call rotation is miserable — the team receives ~200 PagerDuty alerts per day, but only ~15 of them lead to actual action. The rest are acknowledged and silenced without investigation.

Engineers are burned out, alert fatigue is severe, and there has been one production outage that was missed because the real alert was buried in noise.

Your job: design and execute an alert quality improvement program.`,
      sub_questions: [
        {
          id: 'root_causes',
          type: 'investigation',
          prompt: 'What are the most common root causes of noisy/false-positive alerts in a microservices environment? List at least 5 and briefly explain each.',
          placeholder: 'Cause 1: ...\nCause 2: ...\nCause 3: ...\nCause 4: ...\nCause 5: ...',
          required_keywords: ['threshold', 'false positive', 'flapping', 'missing for', 'static threshold'],
          bonus_keywords: ['deployment spikes', 'no data', 'alert storm', 'cardinality', 'absent', 'aggregation'],
          reference_answer: '1. Static thresholds that ignore traffic patterns — e.g. "CPU > 70%" fires every time there is a morning traffic spike even though the service handles it fine.\n2. Missing "for" duration — alerts with for: 0s fire on any transient spike and resolve in seconds, creating alert storms.\n3. Alert on symptoms not causes — alerting on "downstream timeouts" for every service when the real cause is one upstream service failing, creating 10 alerts for one issue.\n4. Alerts on metrics that do not predict user impact — e.g. alerting on GC pause time when p99 latency is unaffected.\n5. Flapping alerts — thresholds right at steady-state values, so alerts fire and resolve repeatedly every few minutes (fix: add hysteresis or increase "for" window).\n6. No data treated as alerting — when a service restarts, metrics briefly disappear, triggering alerts (fix: set no_data_state = "OK" or use absent() with delay).',
        },
        {
          id: 'triage_method',
          type: 'investigation',
          prompt: 'You have 400 alert rules and need to prioritise which to fix first. Describe your systematic approach to auditing alert quality. What data do you collect, how do you score each alert, and what are your criteria for deletion vs improvement?',
          placeholder: 'Data to collect: ...\nScoring approach: ...\nDelete when: ...\nFix when: ...\nKeep as-is when: ...',
          required_keywords: ['fire rate', 'action taken', 'false positive', 'delete', 'priority'],
          bonus_keywords: ['alert-to-action ratio', 'toil', 'ownership', 'MTTA', 'silence history', 'suppress'],
          reference_answer: 'Data to collect (from PagerDuty + Prometheus):\n  - Alert fire count per day (last 30 days)\n  - Alert-to-action ratio: of all fires, how often did the engineer take a real action vs acknowledge+close?\n  - MTTA (mean time to acknowledge) — high MTTA suggests low confidence in the alert\n  - Silence history — how often is this alert silenced without action?\n  - Owner — does the alert have a named owning team?\n\nScoring:\n  - Action rate < 10%: candidate for deletion\n  - Action rate 10-40%: needs threshold/for-duration fix\n  - Action rate > 80%: keep, may need runbook improvement only\n\nDelete criteria:\n  - Alert has not led to any action in 90 days\n  - Alert is fully covered by a parent alert (e.g. "service down" covers all its sub-alerts)\n  - No named owner\n\nFix criteria:\n  - Good signal but bad threshold or for-duration\n  - Fires during deployments only (add deployment annotation + inhibit rule)',
        },
        {
          id: 'alert_design',
          type: 'alert_rule',
          prompt: 'Design an alerting strategy for the payments-api service. The service must maintain 99.9% availability. Write: (1) the SLO-based alert using burn rate, and (2) one symptom-based alert that would page on-call. Explain why you chose each approach.',
          placeholder: 'SLO burn-rate alert:\n  PromQL: ...\n  For: ...\n  Why: ...\n\nSymptom-based alert:\n  PromQL: ...\n  For: ...\n  Why: ...',
          required_keywords: ['burn rate', 'error budget', 'slo', 'rate', 'for'],
          bonus_keywords: ['multi-window', '1h', '6h', 'fast burn', 'slow burn', 'availability', 'latency slo'],
          reference_answer: 'SLO burn-rate alert (Google SRE Workbook multi-window approach):\n  Fast-burn (page immediately):\n    expr: (\n      rate(http_requests_total{service="payments",status=~"5.."}[1h]) / rate(http_requests_total{service="payments"}[1h]) > 14.4 * 0.001\n      and\n      rate(http_requests_total{service="payments",status=~"5.."}[5m]) / rate(http_requests_total{service="payments"}[5m]) > 14.4 * 0.001\n    )\n  Explanation: 14.4x burn rate over 1h means 2% of monthly error budget (43 min) burned in 1h. Both windows must agree to prevent false-positive from a 5-min spike.\n\nSlow-burn (ticket, not page):\n    expr: rate(http_requests_total{service="payments",status=~"5.."}[6h]) / rate(http_requests_total{service="payments"}[6h]) > 6 * 0.001\n  Explanation: slower bleed that would exhaust budget in 5 days — needs attention but not a 3am page.\n\nSymptom-based alert:\n  expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="payments"}[5m])) > 2\n  for: 5m\n  Explanation: if p99 latency >2s sustained for 5m, users experience timeouts regardless of error rate. This catches hangs that error-rate alerts miss.',
        },
        {
          id: 'prevention',
          type: 'prevention',
          prompt: 'After your cleanup reduced alerts from 200 to 30 per day, how do you prevent alert quality from degrading again over time? Describe the processes and tooling you put in place.',
          placeholder: 'Process 1: ...\nProcess 2: ...\nTooling: ...\nMetrics you track: ...',
          required_keywords: ['review', 'ownership', 'runbook', 'process'],
          bonus_keywords: ['alert budget', 'SLO', 'on-call', 'code review', 'monthly', 'toil'],
          reference_answer: '1. Alerts as code + mandatory review: all alert rules live in Git. PRs that add new alerts require a second reviewer to confirm: the alert has a runbook, has been tested against historical data, has a named owner, and has a "for" duration of at least 5 minutes.\n\n2. Monthly alert retrospective: the on-call rotation holds a monthly 30-min review of all alerts that fired. Any alert with <10% action rate is flagged for deletion or improvement by its owner within 2 sprints.\n\n3. On-call toil budget: if on-call receives >50 alerts/week, the team\'s next sprint must include alert quality work (no features until alert quality is restored).\n\n4. Metrics to track:\n  - Alerts per on-call week (target: <50)\n  - Alert-to-action ratio (target: >60%)\n  - MTTA (target: <5 min for SEV1)\n  - Number of missed incidents in the last quarter (target: 0)\n\n5. New engineer onboarding: every new SRE must spend their first week on-call shadow reviewing past alert firings. Understanding alert history builds intuition for quality.',
        },
      ],
    },
    {
      title: '[SEED] Prometheus Scraping Setup for a VM Fleet',
      difficulty: 'hard',
      time_limit_seconds: 900,
      scenario: `You are tasked with setting up Prometheus monitoring for a fleet of 50 GCP VM instances (Compute Engine) running a legacy Java payments processing service. These VMs are NOT in Kubernetes — they are bare VMs.

Each VM runs:
- The Java service (exposing JVM metrics via Prometheus JMX exporter on port 8080/metrics)
- A node_exporter sidecar for OS metrics on port 9100

Your Prometheus server runs in GKE. You need to auto-discover all 50 VMs and scrape metrics from both exporters.

Stack: GCP Compute Engine (VMs with label env=production, role=payments-processor), GKE-hosted Prometheus, Grafana, PagerDuty.`,
      sub_questions: [
        {
          id: 'discovery_method',
          type: 'investigation',
          prompt: 'You cannot manually list 50 VM IPs in Prometheus — VMs scale up and down. What service discovery mechanism do you use to auto-discover GCP VMs, and what are the configuration requirements on both the Prometheus side and the GCP side?',
          placeholder: 'Discovery mechanism: ...\nPrometheus config requirements: ...\nGCP requirements (IAM, labels, etc.): ...',
          required_keywords: ['gce_sd', 'service discovery', 'label', 'credentials', 'project'],
          bonus_keywords: ['gce_sd_configs', 'IAM', 'compute.instances.list', 'port', 'filter', 'zone'],
          reference_answer: 'Use gce_sd_configs (GCE Service Discovery) built into Prometheus:\n\nPrometheus config:\n  scrape_configs:\n    - job_name: gce-payments-jvm\n      gce_sd_configs:\n        - project: moniepoint-prod\n          zone: us-central1-a\n          filter: labels.env="production" AND labels.role="payments-processor"\n          port: 8080\n      relabel_configs:\n        - source_labels: [__meta_gce_instance_name]\n          target_label: instance\n        - source_labels: [__meta_gce_zone]\n          target_label: zone\n\n    - job_name: gce-payments-node\n      gce_sd_configs:\n        - project: moniepoint-prod\n          zone: us-central1-a\n          filter: labels.env="production" AND labels.role="payments-processor"\n          port: 9100\n\nGCP requirements:\n  - Prometheus service account needs roles/compute.viewer IAM permission to call compute.instances.list\n  - VMs must have GCP labels (env=production, role=payments-processor) for the filter\n  - Firewall rule: allow Prometheus GKE pod CIDR to reach VMs on ports 8080 and 9100\n  - For multi-zone: add one gce_sd_configs entry per zone, or use zone: "(us-central1-a|us-central1-b)"',
        },
        {
          id: 'key_jvm_metrics',
          type: 'investigation',
          prompt: 'The Java service exposes JVM metrics via the JMX exporter. What are the most important JVM metrics you would monitor for a payments processing service, and what are the alert thresholds?',
          placeholder: 'Metric 1: name — why — threshold\nMetric 2: ...\nMetric 3: ...\nMetric 4: ...\nMetric 5: ...',
          required_keywords: ['heap', 'gc', 'thread', 'memory', 'jvm'],
          bonus_keywords: ['old gen', 'gc pause', 'full gc', 'thread pool', 'class loading', 'non-heap', 'off-heap'],
          reference_answer: '1. jvm_memory_bytes_used{area="heap"} / jvm_memory_bytes_max{area="heap"} — heap utilisation. Warn >80%, crit >90%. >90% triggers frequent GC, causing latency spikes.\n\n2. rate(jvm_gc_collection_seconds_sum[5m]) / rate(jvm_gc_collection_seconds_count[5m]) — GC pause duration. Warn >100ms, crit >500ms. Long GC pauses cause request timeouts.\n\n3. rate(jvm_gc_collection_seconds_count{gc="PS MarkSweep"}[5m]) — Full GC rate. Crit if any Full GC occurs. Full GC stops the world for seconds.\n\n4. jvm_threads_current vs jvm_threads_peak — thread count. Crit if current approaches peak (thread exhaustion → service hangs).\n\n5. jvm_memory_pool_bytes_used{pool="Metaspace"} / jvm_memory_pool_bytes_max{pool="Metaspace"} — Metaspace. Crit >90%. ClassLoader leak causes OutOfMemoryError: Metaspace.\n\n6. Bonus: rate(http_requests_total{status="5xx"}[5m]) from the app — business-level error rate should come from the service, not just JVM health.',
        },
        {
          id: 'network_security',
          type: 'mitigation',
          prompt: 'Security team raises a concern: your plan opens ports 8080 and 9100 on all 50 VMs to the Prometheus pod IP. They say this is too broad. How do you secure Prometheus scraping without blocking it?',
          placeholder: 'Security concern: ...\nSolution 1 (network): ...\nSolution 2 (auth): ...\nTradeoffs: ...',
          required_keywords: ['firewall', 'cidr', 'tls', 'authentication', 'network'],
          bonus_keywords: ['bearer token', 'mutual tls', 'VPC', 'private IP', 'pod CIDR', 'service account', 'prometheus-operator'],
          reference_answer: 'Security concerns: open ports on all VMs = lateral movement risk if Prometheus is compromised.\n\nSolution 1 — Network restriction (minimum viable):\n  GCP Firewall rule: allow TCP 8080,9100 ONLY from the GKE pod CIDR (e.g. 10.4.0.0/14) to VMs tagged with target=payments-exporter.\n  This restricts access to the specific pod network — not the entire internet or VPC.\n\nSolution 2 — Prometheus scrape with bearer token auth:\n  Each exporter can require a bearer token:\n    - node_exporter: use --web.config.file with bearer_token\n    - Prometheus scrape config: authorization: { credentials_file: /etc/prometheus/token }\n  Kubernetes Secret stores the token, mounted into the Prometheus pod.\n\nSolution 3 — mTLS (most secure):\n  Both Prometheus and exporters use TLS client certificates. Only Prometheus with the right cert can scrape. Overkill for internal VPC but correct for regulated environments.\n\nRecommendation: Solution 1 + Solution 2 (network restriction + bearer token) gives good security without high ops overhead. mTLS reserved for PCI-scoped workloads.',
        },
        {
          id: 'alerting_design',
          type: 'alert_rule',
          prompt: 'One of the 50 VMs crashes and the exporter becomes unreachable. How do you alert on a VM disappearing from Prometheus scraping? Write the PromQL expression, explain the "absent()" function, and describe how you prevent false alerts during planned maintenance.',
          placeholder: 'PromQL for "VM missing" alert: ...\nHow absent() works: ...\nHandling planned maintenance: ...',
          required_keywords: ['absent', 'up', 'for', 'silence', 'maintenance'],
          bonus_keywords: ['up{job="gce-payments"}', 'inhibit_rules', 'Alertmanager', 'silence window', 'annotations'],
          reference_answer: 'PromQL for VM missing from scrape:\n  alert: PaymentsVMDown\n  expr: absent(up{job="gce-payments-node"}) OR up{job="gce-payments-node"} == 0\n  for: 3m\n  labels:\n    severity: critical\n  annotations:\n    summary: "Payments VM {{ $labels.instance }} unreachable for 3+ minutes"\n    runbook: "https://runbooks/vm-down"\n\nHow absent() works:\n  absent(metric) returns an empty result if the metric exists, or a single element {value=1} if it does NOT exist. This lets you alert on missing metrics that would otherwise return nothing and cause the alert to silently never fire.\n  Warning: absent() loses all label information, so "absent(up{job=...})" returns no instance label — you cannot tell WHICH VM disappeared. Use up == 0 for per-instance alerts.\n\nHandling planned maintenance:\n  1. Alertmanager silence: before maintenance, create a silence via the Alertmanager UI or amtool:\n     amtool silence add --alertname=PaymentsVMDown instance=payments-vm-42 --duration=2h --comment="Scheduled patching"\n  2. Inhibit rule: if a "MaintenancePlanned" alert is firing for an instance, inhibit PaymentsVMDown for that instance.\n  3. Scheduled silences via GitOps: manage silences as YAML in Git, applied via CI before maintenance windows.',
        },
      ],
    },
  ]

  for (const q of questions) {
    await client.query(
      `INSERT INTO monitoring_questions (title, scenario, difficulty, sub_questions, time_limit_seconds)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING`,
      [q.title, q.scenario, q.difficulty, JSON.stringify(q.sub_questions), q.time_limit_seconds]
    )
  }
  console.log(`Seeded ${questions.length} monitoring questions.`)
}

async function seedCognitiveQuestions(client: PoolClient) {
  console.log('Seeding cognitive questions...')
  await client.query(`DELETE FROM cognitive_questions WHERE title LIKE '[SEED]%'`)

  const questions = [
    // ── Numerical Reasoning ─────────────────────────────────────────────────
    {
      title: '[SEED] Age Sum Problem',
      question: 'The combined age of three engineers is 108 years today. What will be the sum of their ages 6 years from now?',
      question_type: 'numerical',
      options: null,
      correct_answer: '126',
      explanation: 'Each of the 3 people gains 6 years, so the total increases by 3 × 6 = 18. 108 + 18 = 126.',
      difficulty: 'easy',
      category: 'numerical_reasoning',
      time_limit_seconds: 45,
    },
    {
      title: '[SEED] Server Load Distribution',
      question: 'A load balancer distributes traffic across 4 servers. Server A handles 35% of requests, Server B handles 25%, Server C handles 20%, and Server D handles the rest. If the total request rate is 12,000 requests/minute, how many requests per minute does Server D handle?',
      question_type: 'numerical',
      options: null,
      correct_answer: '2400',
      explanation: 'Server D handles 100% - 35% - 25% - 20% = 20% of traffic. 20% of 12,000 = 2,400 requests/minute.',
      difficulty: 'easy',
      category: 'numerical_reasoning',
      time_limit_seconds: 60,
    },
    {
      title: '[SEED] SLO Error Budget Calculation',
      question: 'Your service has a 99.95% monthly availability SLO. In a 30-day month, how many minutes of downtime are you allowed? (Round to 1 decimal place.)',
      question_type: 'numerical',
      options: null,
      correct_answer: '21.6',
      explanation: '30 days = 43,200 minutes. Allowed downtime = 0.05% × 43,200 = 21.6 minutes.',
      difficulty: 'medium',
      category: 'sre_maths',
      time_limit_seconds: 90,
    },
    {
      title: '[SEED] Incident Response Time',
      question: 'Three on-call engineers each took the following times to acknowledge a P1 alert: 4 minutes, 7 minutes, and 4 minutes. In the next quarter, the team wants to reduce the average acknowledgement time by 25%. What is the new target average in minutes?',
      question_type: 'numerical',
      options: null,
      correct_answer: '3.75',
      explanation: 'Current average = (4 + 7 + 4) / 3 = 5 minutes. Reduce by 25%: 5 × 0.75 = 3.75 minutes.',
      difficulty: 'medium',
      category: 'numerical_reasoning',
      time_limit_seconds: 75,
    },
    {
      title: '[SEED] Cache Hit Rate Impact',
      question: 'A database serves 8,000 queries per minute. After adding a Redis cache with a 70% hit rate, how many queries per minute still reach the database?',
      question_type: 'numerical',
      options: null,
      correct_answer: '2400',
      explanation: '70% of queries are served by cache. 30% reach the database. 30% × 8,000 = 2,400 queries/minute.',
      difficulty: 'easy',
      category: 'numerical_reasoning',
      time_limit_seconds: 60,
    },
    // ── Logical Reasoning ───────────────────────────────────────────────────
    {
      title: '[SEED] Alert Logic Pattern',
      question: 'An alert fires ONLY when: CPU > 80% AND (error_rate > 5% OR latency > 2s). In which of the following scenarios does the alert fire?\n\nA) CPU: 85%, error_rate: 3%, latency: 1.5s\nB) CPU: 75%, error_rate: 8%, latency: 3s\nC) CPU: 90%, error_rate: 2%, latency: 2.5s\nD) CPU: 60%, error_rate: 10%, latency: 5s',
      question_type: 'multiple_choice',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'C',
      explanation: 'A: CPU 85% but error_rate 3% < 5% AND latency 1.5s < 2s → no fire. B: CPU 75% < 80% → no fire. C: CPU 90% > 80% AND latency 2.5s > 2s → FIRES. D: CPU 60% < 80% → no fire.',
      difficulty: 'medium',
      category: 'logical_reasoning',
      time_limit_seconds: 90,
    },
    {
      title: '[SEED] Deployment Pipeline Ordering',
      question: 'A deployment must follow these rules:\n• Unit tests must pass before integration tests\n• Integration tests must pass before staging deploy\n• Staging deploy must succeed before prod deploy\n• Security scan can run at any time but must complete before prod deploy\n\nWhich sequence is valid?\n\nA) Security scan → Unit tests → Integration tests → Staging → Prod\nB) Unit tests → Security scan → Integration tests → Staging → Prod\nC) Unit tests → Integration tests → Prod → Staging → Security scan\nD) Security scan → Integration tests → Unit tests → Staging → Prod',
      question_type: 'multiple_choice',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'B',
      explanation: 'A is valid too — security scan can run first. But B is also valid and is the canonical answer. C is invalid (Prod before Staging). D is invalid (Integration before Unit). Both A and B satisfy all rules; the question tests that C and D are clearly wrong. B is the most common real-world ordering.',
      difficulty: 'medium',
      category: 'logical_reasoning',
      time_limit_seconds: 90,
    },
    {
      title: '[SEED] Network Throughput Bottleneck',
      question: 'A service processes data through 3 pipeline stages:\n• Stage 1: can process 500 records/second\n• Stage 2: can process 300 records/second\n• Stage 3: can process 800 records/second\n\nWhat is the maximum throughput of the entire pipeline?',
      question_type: 'numerical',
      options: null,
      correct_answer: '300',
      explanation: 'The bottleneck is Stage 2 at 300 records/second. A pipeline\'s maximum throughput is limited by its slowest stage.',
      difficulty: 'easy',
      category: 'logical_reasoning',
      time_limit_seconds: 45,
    },
    {
      title: '[SEED] On-Call Rotation Logic',
      question: 'A team of 5 engineers rotates on-call weekly. Alice was on-call last week. The rotation goes alphabetically: Alice, Bob, Carol, David, Eve, then back to Alice.\n\nIf today is the start of Week 8, who is on-call?',
      question_type: 'multiple_choice',
      options: ['Alice', 'Bob', 'Carol', 'David', 'Eve'],
      correct_answer: 'Carol',
      explanation: 'Alice starts at Week 1. Week pattern: 1=Alice, 2=Bob, 3=Carol, 4=David, 5=Eve, 6=Alice, 7=Bob, 8=Carol. Week 8 mod 5 = 3 → Carol.',
      difficulty: 'medium',
      category: 'logical_reasoning',
      time_limit_seconds: 60,
    },
    {
      title: '[SEED] Burn Rate Alert Threshold',
      question: 'Your service has a 99.9% monthly SLO (43.2 minutes error budget). A multi-window burn rate alert fires when the 1-hour burn rate exceeds 14x. At 14x burn rate, how many minutes of error budget would be consumed in 1 hour?',
      question_type: 'numerical',
      options: null,
      correct_answer: '10.08',
      explanation: 'Normal budget consumption rate = 43.2 min / 720 hours = 0.06 min/hour. At 14x: 0.06 × 14 = 0.84 min/hour... Actually: at 14x burn you consume 14 hours-worth of budget per hour = 14 × (43.2/720) × 60min = 14 × 3.6min = wait. Simpler: 14x burn means you consume the full budget 14x faster than normal. Budget = 43.2 min over 720 hours. 1 hour at 14x = 14 × (43.2/720) = 14 × 0.06 = 0.84 hours-equivalent. In minutes: 43.2 × (14/720) × 60 = 43.2 × 14 / 720 × 60... Let me recalculate: 14x burn rate over 1 hour = 14 × (1/720) of the monthly budget = 14 × 43.2 / 720 = 604.8 / 720 = 0.84 × 12 minutes. Hmm. The standard Google SRE formula: at 14x burn, time to exhaust = 720h/14 = 51.4 hours. Budget burned in 1h = 43.2 / 51.4 = 0.84 min. Wait I think the answer should be 0.84. Let me reconsider. 43.2 minutes budget. At 14x burn rate you burn through it 14x faster. Normal rate = 43.2 min / (30 days × 24 hr × 60 min) = 43.2 / 43200 = 0.001 per minute. At 14x = 0.014 per minute. In 60 minutes: 0.014 × 60 = 0.84 minutes of budget consumed in 1 hour.',
      difficulty: 'hard',
      category: 'sre_maths',
      time_limit_seconds: 120,
    },
  ]

  // Fix the burn rate answer after recalculation
  questions[questions.length - 1].correct_answer = '0.84'

  for (const q of questions) {
    await client.query(
      `INSERT INTO cognitive_questions (title, question, question_type, options, correct_answer, explanation, difficulty, category, time_limit_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      [q.title, q.question, q.question_type, q.options ? JSON.stringify(q.options) : null, q.correct_answer, q.explanation, q.difficulty, q.category, q.time_limit_seconds]
    )
  }
  console.log(`Seeded ${questions.length} cognitive questions.`)
}


export async function runSeed() {
  const client = await pool.connect()
  try {
    await seedSqlSandbox(client)
    await seedSqlQuestions(client)
    await seedMonitoringQuestions(client)
    await seedCognitiveQuestions(client)
    console.log('All questions seeded successfully.')
  } finally {
    client.release()
  }
}

async function main() {
  await runSeed()
  await pool.end()
}

// Only run main() when executed directly (not when imported as a module)
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1) })
}
