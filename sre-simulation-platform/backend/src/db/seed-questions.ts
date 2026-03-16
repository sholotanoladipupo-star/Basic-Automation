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
  console.log('Seeding monitoring questions (Grafana-style)...')
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
      title: '[SEED] API Gateway Error Rate Alerting',
      difficulty: 'medium',
      time_limit_seconds: 900,
      scenario: `**Scenario:** You are the SRE on-call for an e-commerce platform. The API gateway has had intermittent spikes in 5xx error rates. The SEV1 threshold is >10% for >2 minutes. Configure Grafana monitoring so the on-call team is paged before users notice.

**Stack:** Prometheus (metrics), Grafana (dashboards + alerts), Alertmanager (routing), Slack (#alerts-prod), PagerDuty (on-call).

**Available Prometheus metrics:**
- \`http_requests_total{service="api-gateway", status_code="5xx"}\`
- \`http_requests_total{service="api-gateway"}\`
- \`http_request_duration_seconds_bucket{service="api-gateway"}\`
- \`up{job="api-gateway"}\``,
      sub_questions: [
        {
          id: 'datasource',
          type: 'datasource',
          prompt: 'Configure the data source for your Grafana instance. What type of data source would you add for Prometheus metrics, and what is the typical connection URL?',
          placeholder: 'Type: Prometheus\nURL: http://prometheus:9090',
          required_keywords: ['prometheus'],
          bonus_keywords: ['9090', 'server', '15s'],
          reference_answer: 'Type: Prometheus\nURL: http://prometheus:9090\nAccess: Server (default)\nScrape interval: 15s',
        },
        {
          id: 'alert_rule',
          type: 'alert_rule',
          prompt: 'Create an alert rule for high API gateway error rate. Write the PromQL expression, set threshold at 10%, and configure a 2-minute pending period.',
          placeholder: 'rate(http_requests_total{status_code="5xx"}[5m]) / rate(http_requests_total[5m]) > 0.1',
          required_keywords: ['http_requests_total', 'rate', '5xx'],
          bonus_keywords: ['0.1', '2m', 'for', 'api-gateway', 'critical'],
          reference_answer: 'Alert: HighAPIGatewayErrorRate\nExpr: rate(http_requests_total{service="api-gateway",status_code="5xx"}[5m]) / rate(http_requests_total{service="api-gateway"}[5m]) > 0.1\nFor: 2m\nSeverity: critical\nSummary: API gateway error rate above 10%',
        },
        {
          id: 'contact_point',
          type: 'contact_point',
          prompt: 'Configure contact points for the on-call team. Set up a Slack channel for team awareness and PagerDuty for on-call escalation.',
          placeholder: 'Slack: channel=#alerts-prod, webhook=https://hooks.slack.com/...\nPagerDuty: integration key=<routing-key>',
          required_keywords: ['slack', 'pagerduty'],
          bonus_keywords: ['webhook', '#alerts-prod', 'integration key', 'channel'],
          reference_answer: 'Contact Point 1 - Slack:\n  Channel: #alerts-prod\n  Webhook URL: https://hooks.slack.com/services/...\n\nContact Point 2 - PagerDuty:\n  Integration Key: <your-routing-key>\n  Severity: critical',
        },
        {
          id: 'notification_policy',
          type: 'notification_policy',
          prompt: 'Set up the notification routing policy. Critical alerts should go to both Slack and PagerDuty. Configure grouping to avoid alert storms.',
          placeholder: 'Default: Slack\nRoute: severity=critical -> Slack + PagerDuty\nGroup by: [alertname, service]\nGroup wait: 30s',
          required_keywords: ['critical', 'slack'],
          bonus_keywords: ['group_by', 'group_wait', 'pagerduty', 'repeat_interval'],
          reference_answer: 'Default policy:\n  Contact point: Slack (#alerts-prod)\n  Group by: [alertname, service]\n  Group wait: 30s\n  Repeat interval: 4h\n\nNested route (severity=critical):\n  Contact point: PagerDuty\n  Continue matching: true (also notifies Slack)',
        },
      ],
    },
    {
      title: '[SEED] Cloud Spanner High CPU Alerting (Google Cloud Monitoring)',
      difficulty: 'medium',
      time_limit_seconds: 900,
      scenario: `**Scenario:** Your team runs a product catalog on Cloud Spanner. A hot key issue drove CPU to 92% and took down the catalog service for 45 minutes before anyone noticed. Set up proactive monitoring.

**Stack:** Google Cloud Monitoring (GCM) as a Grafana data source, Slack #platform-alerts, PagerDuty for on-call.

**Available GCM metrics:**
- \`spanner.googleapis.com/instance/cpu/utilization\`
- \`spanner.googleapis.com/instance/query_count\`
- \`spanner.googleapis.com/instance/storage/used_bytes\`
- \`spanner.googleapis.com/instance/api/request_latencies\``,
      sub_questions: [
        {
          id: 'datasource',
          type: 'datasource',
          prompt: 'Your metrics are in Google Cloud Monitoring (formerly Stackdriver). What Grafana data source type would you configure, and what authentication does it require?',
          placeholder: 'Type: Google Cloud Monitoring\nAuth: Service Account JSON key\nProject ID: your-gcp-project-id',
          required_keywords: ['google cloud monitoring', 'cloud monitoring', 'gcm', 'stackdriver'],
          bonus_keywords: ['service account', 'json', 'oauth', 'project id', 'gcp'],
          reference_answer: 'Data source type: Google Cloud Monitoring (Stackdriver)\nAuthentication: GCP Service Account JSON key (or Workload Identity on GKE)\nProject ID: your-gcp-project-id',
        },
        {
          id: 'alert_rule',
          type: 'alert_rule',
          prompt: 'Create an alert rule for Spanner high CPU utilization. The metric is spanner.googleapis.com/instance/cpu/utilization. Alert when CPU exceeds 70% for more than 5 minutes.',
          placeholder: 'Metric: spanner.googleapis.com/instance/cpu/utilization\nFilter: resource.type="spanner_instance"\nThreshold: > 0.70\nFor: 5m',
          required_keywords: ['cpu', 'utilization', '70'],
          bonus_keywords: ['0.7', 'spanner', '5m', 'instance', 'node'],
          reference_answer: 'Alert: SpannerHighCPU\nMetric: spanner.googleapis.com/instance/cpu/utilization\nFilter: resource.type="spanner_instance"\nThreshold: > 0.70 (70%)\nFor: 5m\nSeverity: warning (>70%) / critical (>85%)\nSummary: Spanner CPU above 70% - check for hot key patterns',
        },
        {
          id: 'contact_point',
          type: 'contact_point',
          prompt: 'Configure contact points. The team uses Slack #platform-alerts for warnings. Critical issues also need a PagerDuty page. Optionally add a webhook for runbook automation.',
          placeholder: 'Slack: #platform-alerts\nPagerDuty: routing key\nWebhook (optional): https://automation.internal/runbooks/spanner',
          required_keywords: ['slack', 'pagerduty'],
          bonus_keywords: ['webhook', '#platform-alerts', 'runbook', 'integration key'],
          reference_answer: 'Contact Point 1 - Slack:\n  Channel: #platform-alerts\n  Include dashboard link: yes\n\nContact Point 2 - PagerDuty:\n  Integration Key: <routing-key>\n  Severity mapping: warning->warning, critical->critical\n\nOptional Webhook: https://automation.internal/runbooks/spanner-high-cpu',
        },
        {
          id: 'notification_policy',
          type: 'notification_policy',
          prompt: 'Define routing: warnings go to Slack only; critical alerts (CPU > 85%) go to Slack and PagerDuty. Explain how you would silence alerts during a planned maintenance window.',
          placeholder: 'Route warning -> Slack\nRoute critical -> Slack + PagerDuty\nSilence: create Grafana silence covering maintenance window',
          required_keywords: ['warning', 'critical', 'slack'],
          bonus_keywords: ['silence', 'maintenance', 'inhibit', 'pagerduty', 'group_by'],
          reference_answer: 'Route 1 (severity=warning): Slack #platform-alerts, repeat 1h\nRoute 2 (severity=critical): Slack + PagerDuty, repeat 30m until ack\nMaintenance window: Create a Grafana silence or Alertmanager time_intervals block',
        },
      ],
    },
    {
      title: '[SEED] Kubernetes Pod CrashLoopBackOff Detection',
      difficulty: 'hard',
      time_limit_seconds: 900,
      scenario: `**Scenario:** A service pod entered CrashLoopBackOff and went undetected for 20 minutes because there was no alert. Build monitoring to catch pods in degraded states within 2 minutes.

**Stack:** Prometheus + kube-state-metrics, Grafana, Alertmanager, Slack.

**Available metrics:**
- \`kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}\`
- \`kube_pod_container_status_restarts_total\`
- \`kube_pod_status_phase{phase="Failed"}\`
- \`kube_deployment_status_replicas_unavailable\``,
      sub_questions: [
        {
          id: 'datasource',
          type: 'datasource',
          prompt: 'kube-state-metrics exposes Kubernetes object metrics scraped by Prometheus. What data source would you configure in Grafana, and what namespace does kube-state-metrics typically run in?',
          placeholder: 'Type: Prometheus\nURL: http://prometheus-server.monitoring.svc.cluster.local\nkube-state-metrics runs in: kube-system',
          required_keywords: ['prometheus'],
          bonus_keywords: ['kube-state-metrics', 'kube-system', 'monitoring', 'scrape'],
          reference_answer: 'Data source: Prometheus\nURL: http://prometheus-server.monitoring.svc.cluster.local\nkube-state-metrics namespace: kube-system\nScrape interval: 15s',
        },
        {
          id: 'alert_rule',
          type: 'alert_rule',
          prompt: 'Write two alert rules: (1) Alert when any pod is in CrashLoopBackOff for > 2 minutes. (2) Alert when a deployment has unavailable replicas for > 5 minutes.',
          placeholder: 'Alert 1: kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} == 1, for: 2m\nAlert 2: kube_deployment_status_replicas_unavailable > 0, for: 5m',
          required_keywords: ['kube_pod_container_status_waiting_reason', 'CrashLoopBackOff'],
          bonus_keywords: ['kube_deployment_status_replicas_unavailable', '5m', '2m', 'for'],
          reference_answer: 'Alert 1 - CrashLoopBackOff:\n  expr: kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} == 1\n  for: 2m, severity: critical\n\nAlert 2 - Unavailable replicas:\n  expr: kube_deployment_status_replicas_unavailable > 0\n  for: 5m, severity: warning',
        },
        {
          id: 'contact_point',
          type: 'contact_point',
          prompt: 'Configure a Slack contact point for the platform team. Template the message to include the pod name, namespace, and a link to logs.',
          placeholder: 'Type: Slack\nChannel: #platform-alerts\nTitle template: [{{ .Status }}] {{ .CommonLabels.alertname }}\nBody: Pod: {{ .CommonLabels.pod }} in {{ .CommonLabels.namespace }}',
          required_keywords: ['slack'],
          bonus_keywords: ['template', 'namespace', 'pod', 'annotations', 'channel', '#platform'],
          reference_answer: 'Contact Point - Slack:\n  Channel: #platform-alerts\n  Title: [{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}\n  Body: Pod: {{ .CommonLabels.pod }}\n  Namespace: {{ .CommonLabels.namespace }}\n  Summary: {{ .CommonAnnotations.summary }}',
        },
        {
          id: 'notification_policy',
          type: 'notification_policy',
          prompt: 'Route alerts so that CrashLoopBackOff in the "prod" namespace pages the on-call engineer immediately, but the same alert in "staging" only posts to Slack.',
          placeholder: 'Route: namespace=prod -> PagerDuty + Slack (group_wait: 0s)\nRoute: namespace=staging -> Slack only (group_wait: 5m)',
          required_keywords: ['prod', 'staging', 'namespace'],
          bonus_keywords: ['pagerduty', 'match', 'label', 'continue'],
          reference_answer: 'Route 1 (namespace=prod, alertname=PodCrashLoopBackOff):\n  -> PagerDuty + Slack #platform-alerts\n  group_wait: 0s, repeat_interval: 30m\n\nRoute 2 (namespace=staging):\n  -> Slack #platform-staging-alerts only\n  group_wait: 5m, repeat_interval: 2h',
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


export async function runSeed() {
  const client = await pool.connect()
  try {
    await seedSqlSandbox(client)
    await seedSqlQuestions(client)
    await seedMonitoringQuestions(client)
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
