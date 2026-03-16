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
    const { correct_query: _cq, ...rest } = q

    await client.query(
      `INSERT INTO sql_questions (title, description, difficulty, question_type, starter_query, expected_output, schema_hint, hint, time_limit_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      [rest.title, rest.description, rest.difficulty, rest.question_type, rest.starter_query, JSON.stringify(expected_output), rest.schema_hint, rest.hint, rest.time_limit_seconds]
    )
  }
  console.log(`Seeded ${questions.length} SQL questions with dynamically computed expected_output.`)
}

async function seedMonitoringQuestions(client: PoolClient) {
  console.log('Seeding monitoring questions...')
  await client.query(`DELETE FROM monitoring_questions WHERE title LIKE '[SEED]%'`)

  const questions = [
    {
      title: '[SEED] Redis Cache Alerting Setup',
      scenario: `**Scenario:** Your production Redis cache cluster handles 50,000 req/s. Over the past week you had two incidents:
1. Redis OOM-killed at 97% memory (SEV1, 2 hours to recover)
2. Cache hit rate dropped below 40% during a deploy, causing DB connection storm

You need to set up monitoring and alerting to catch these earlier. Your stack uses **Prometheus + Grafana + Alertmanager**.

**Available Prometheus metrics:**
- \`redis_memory_used_bytes\` / \`redis_memory_max_bytes\`
- \`redis_keyspace_hits_total\`, \`redis_keyspace_misses_total\`
- \`redis_connected_clients\`
- \`redis_instantaneous_ops_per_sec\`
- \`up{job="redis"}\``,
      difficulty: 'medium',
      time_limit_seconds: 600,
      sub_questions: [
        {
          id: 'sq1',
          prompt: 'Write a PromQL expression that evaluates to `true` when Redis memory usage exceeds **85%** for more than **3 minutes**. This will be used as the alert condition.',
          type: 'promql',
          placeholder: '# PromQL expression\n',
          required_keywords: ['redis_memory_used_bytes', 'redis_memory_max_bytes', '0.85'],
          bonus_keywords: ['for:', '3m', '>'],
          expected_answer: 'redis_memory_used_bytes / redis_memory_max_bytes > 0.85',
          reference_answer: `# Alert fires when memory > 85% for 3 minutes
(redis_memory_used_bytes / redis_memory_max_bytes) > 0.85

# In a full alert rule:
- alert: RedisHighMemory
  expr: (redis_memory_used_bytes / redis_memory_max_bytes) > 0.85
  for: 3m
  labels:
    severity: warning
  annotations:
    summary: "Redis memory usage above 85%"`,
        },
        {
          id: 'sq2',
          prompt: 'Write a PromQL expression for **cache hit rate** (as a percentage, 0–100). Then write the alert condition that fires when hit rate drops below **60% for 5 minutes**.',
          type: 'promql',
          placeholder: '# PromQL expression for hit rate\n\n# Alert condition\n',
          required_keywords: ['redis_keyspace_hits_total', 'redis_keyspace_misses_total', 'rate'],
          bonus_keywords: ['5m', '60', '0.60', 'for:'],
          expected_answer: 'rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) * 100 < 60',
          reference_answer: `# Hit rate as percentage
rate(redis_keyspace_hits_total[5m]) /
  (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) * 100

# Alert condition (< 60% for 5 min)
- alert: RedisCacheHitRateLow
  expr: |
    rate(redis_keyspace_hits_total[5m]) /
      (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) * 100 < 60
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Redis hit rate below 60% — DB connection storm risk"`,
        },
        {
          id: 'sq3',
          prompt: 'Design the Grafana dashboard for Redis health. List 4–5 panels you would add, the visualization type for each, and what metric/query powers it.',
          type: 'text',
          placeholder: 'Panel 1: ...\nPanel 2: ...\n',
          required_keywords: ['memory', 'hit rate', 'connections'],
          bonus_keywords: ['stat', 'time series', 'gauge', 'ops', 'latency'],
          expected_answer: '',
          reference_answer: `**Recommended panels:**
1. **Memory Usage %** — Gauge (0–100%) — redis_memory_used_bytes / redis_memory_max_bytes * 100
2. **Cache Hit Rate %** — Stat + Spark line — rate(hits) / (rate(hits)+rate(misses)) * 100
3. **Ops/sec** — Time Series — redis_instantaneous_ops_per_sec
4. **Connected Clients** — Time Series — redis_connected_clients
5. **Evicted Keys/sec** — Time Series — rate(redis_evicted_keys_total[5m])

Set thresholds on memory (yellow 75%, red 90%) and hit rate (yellow 70%, red 60%).`,
        },
      ]
    },
    {
      title: '[SEED] API Gateway Error Rate & Latency',
      scenario: `**Scenario:** Your API gateway processes 200,000 req/min in production. You have an SLA of 99.9% availability and P99 latency < 500ms.

Last month you had three incidents where error rates spiked to >5% before anyone noticed. You need to set up monitoring across two observability stacks your org uses:
- **New Relic** (primary APM)
- **Prometheus + Grafana** (infrastructure)

**Available data:**
- New Relic: \`Transaction\`, \`TransactionError\`, \`Metric\` event types
- Prometheus: \`http_requests_total{status, method, path}\`, \`http_request_duration_seconds{quantile}\``,
      difficulty: 'hard',
      time_limit_seconds: 720,
      sub_questions: [
        {
          id: 'sq1',
          prompt: 'Write a **New Relic NRQL query** that shows the error rate (%) per minute over the last 30 minutes, broken down by HTTP status code family (2xx, 4xx, 5xx).',
          type: 'nrql',
          placeholder: 'SELECT ...\nFROM ...\nWHERE ...\n',
          required_keywords: ['SELECT', 'FROM', 'TransactionError'],
          bonus_keywords: ['TIMESERIES', 'FACET', 'percentage', 'SINCE'],
          expected_answer: '',
          reference_answer: `SELECT
  percentage(count(*), WHERE error IS TRUE) AS error_rate,
  filter(count(*), WHERE httpResponseCode LIKE '5%') AS server_errors,
  filter(count(*), WHERE httpResponseCode LIKE '4%') AS client_errors
FROM Transaction
FACET httpResponseCodeCategory
SINCE 30 minutes ago
TIMESERIES 1 minute`,
        },
        {
          id: 'sq2',
          prompt: 'Write a **PromQL expression** for P99 request latency using the histogram metric. Then write an alert that fires when P99 > 500ms for 2 minutes.',
          type: 'promql',
          placeholder: '# P99 latency expression\n\n# Alert rule\n',
          required_keywords: ['http_request_duration_seconds', 'histogram_quantile', '0.99'],
          bonus_keywords: ['2m', '0.5', '500', 'for:'],
          expected_answer: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5',
          reference_answer: `# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Alert rule
- alert: APIHighP99Latency
  expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "P99 latency above 500ms"
    description: "Current: {{ $value | humanizeDuration }}"`,
        },
        {
          id: 'sq3',
          prompt: 'You need to set up a **multi-window, multi-burn-rate alert** for your 99.9% SLA. Describe: (1) what burn rates you would use, (2) the alerting windows, and (3) why this is better than a simple threshold alert.',
          type: 'text',
          placeholder: 'Burn rates: ...\nWindows: ...\nWhy better: ...\n',
          required_keywords: ['burn rate', 'window'],
          bonus_keywords: ['1h', '6h', '24h', '72h', 'false positive', 'SLO', 'error budget'],
          expected_answer: '',
          reference_answer: `**Multi-window, multi-burn-rate strategy:**

Burn rates: 14.4x (fast: consuming budget in 1h), 6x (medium: 6h), 1x (slow: budget depletion pace)

Windows:
- 14.4x burn rate → alert on 1h + 5m windows (page immediately)
- 6x burn rate → alert on 6h + 30m windows (ticket/slack)
- 1x burn rate → alert on 3d window (weekly review only)

Why better than simple threshold:
1. Reduces false positives — a 5-min spike at 14x burn won't page you unless it persists
2. Correlated windows ensure the spike is real, not a blip
3. Different burn rates give you fast detection AND early warning
4. Directly tied to error budget, not arbitrary thresholds`,
        },
      ]
    },
    {
      title: '[SEED] Grafana Alerting — Contact Points & Routing',
      scenario: `**Scenario:** Your SRE team uses Grafana for alerting. You need to configure contact points and notification routing for a new service you are onboarding.

Requirements:
- SEV1 alerts → PagerDuty (immediate) + #incidents Slack channel
- SEV2 alerts → #alerts Slack channel only (no page)
- All alerts → archive to a webhook for audit logging
- Business hours alerts only for the on-call Slack DM

Your Grafana version: **10.x** (unified alerting). You have a PagerDuty integration key and Slack bot token.`,
      difficulty: 'medium',
      time_limit_seconds: 720,
      sub_questions: [
        {
          id: 'sq1',
          prompt: 'Write the **Grafana contact point configuration** (YAML format, as used in Grafana provisioning) for the PagerDuty + Slack SEV1 contact point.',
          type: 'yaml',
          placeholder: '# grafana/provisioning/alerting/contact-points.yaml\napiVersion: 1\ncontactPoints:\n  - name: ...\n',
          required_keywords: ['pagerduty', 'slack', 'name', 'receivers'],
          bonus_keywords: ['integration_key', 'url', 'channel', 'apiVersion', 'title', 'text'],
          expected_answer: '',
          reference_answer: `# grafana/provisioning/alerting/contact-points.yaml
apiVersion: 1
contactPoints:
  - orgId: 1
    name: sev1-critical
    receivers:
      - uid: pagerduty-sev1
        type: pagerduty
        settings:
          integrationKey: \${PAGERDUTY_INTEGRATION_KEY}
          severity: critical
          title: "{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}"
          details: |
            Service: {{ .CommonLabels.service }}
            Runbook: {{ .CommonAnnotations.runbook_url }}
        disableResolveMessage: false

      - uid: slack-incidents
        type: slack
        settings:
          url: \${SLACK_WEBHOOK_URL}
          channel: '#incidents'
          title: ':red_circle: SEV1 — {{ .GroupLabels.alertname }}'
          text: |
            *Summary:* {{ .CommonAnnotations.summary }}
            *Service:* {{ .CommonLabels.service }}
            *Runbook:* {{ .CommonAnnotations.runbook_url }}
        disableResolveMessage: false

  - orgId: 1
    name: sev2-warning
    receivers:
      - uid: slack-alerts
        type: slack
        settings:
          url: \${SLACK_WEBHOOK_URL}
          channel: '#alerts'
          title: ':warning: SEV2 — {{ .GroupLabels.alertname }}'
          text: "{{ .CommonAnnotations.summary }}"`,
        },
        {
          id: 'sq2',
          prompt: 'Write the **Alertmanager-compatible routing tree** (YAML) that routes alerts to the correct contact points based on severity label.',
          type: 'yaml',
          placeholder: '# Routing configuration\nroute:\n  receiver: ...\n  routes:\n',
          required_keywords: ['route', 'receiver', 'match', 'severity'],
          bonus_keywords: ['group_by', 'group_wait', 'group_interval', 'repeat_interval', 'continue'],
          expected_answer: '',
          reference_answer: `route:
  receiver: default-webhook
  group_by: ['alertname', 'service', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    # SEV1 — page immediately, also send to Slack
    - matchers:
        - severity = "sev1"
      receiver: sev1-critical
      group_wait: 10s
      repeat_interval: 1h
      continue: true   # also send to audit webhook

    # SEV2 — Slack only
    - matchers:
        - severity = "sev2"
      receiver: sev2-warning
      repeat_interval: 6h
      continue: true

    # Audit webhook catches everything
    - receiver: default-webhook
      continue: false

receivers:
  - name: sev1-critical
  - name: sev2-warning
  - name: default-webhook
    webhook_configs:
      - url: 'https://audit.internal/alerts'
        send_resolved: true`,
        },
        {
          id: 'sq3',
          prompt: 'Describe **3 common alerting anti-patterns** you would avoid when setting up this routing, and how Grafana/Alertmanager features help address them.',
          type: 'text',
          placeholder: 'Anti-pattern 1: ...\nAnti-pattern 2: ...\nAnti-pattern 3: ...\n',
          required_keywords: ['alert', 'noise', 'silence'],
          bonus_keywords: ['inhibition', 'group', 'flapping', 'repeat_interval', 'runbook', 'false positive'],
          expected_answer: '',
          reference_answer: `**Common alerting anti-patterns:**

1. **Alert fatigue / noise** — Too many low-priority alerts paging on-call.
   Fix: Use severity labels + routing to send SEV2 to Slack only. Use repeat_interval (e.g. 4h) so resolved-and-refired alerts don't spam. Use inhibit_rules so child alerts are suppressed when a parent fires.

2. **Missing runbook links** — Alerts with no context slow incident response.
   Fix: Always include runbook_url in annotations. Grafana templates can render these in Slack/PD messages automatically.

3. **Alert flapping** — Alert fires and resolves repeatedly during a flapping condition.
   Fix: Use for: duration in Prometheus alert rules (e.g. for: 5m) so a transient spike doesn't page. Use group_wait and group_interval to batch related alerts rather than firing immediately.`,
        },
      ]
    },
    {
      title: '[SEED] New Relic Alert Policy Design',
      scenario: `**Scenario:** Your team is moving from Datadog to **New Relic** for APM. You need to create alert policies and NRQL alert conditions for your payment service.

Service SLOs:
- Error rate < 1% over any 5-minute window
- P95 latency < 300ms
- Throughput > 100 req/min (dead-man's switch)

You need to write NRQL conditions for a New Relic alert policy and configure the appropriate thresholds.`,
      difficulty: 'hard',
      time_limit_seconds: 600,
      sub_questions: [
        {
          id: 'sq1',
          prompt: 'Write the **NRQL alert condition** for error rate exceeding 1%. Include both a WARNING (0.5%) and CRITICAL (1%) threshold. Use a 5-minute sliding window.',
          type: 'nrql',
          placeholder: '-- NRQL query\nSELECT ...\nFROM ...\n\n-- Thresholds:\n-- WARNING: ...\n-- CRITICAL: ...',
          required_keywords: ['SELECT', 'FROM', 'Transaction', 'error'],
          bonus_keywords: ['percentage', 'TIMESERIES', 'SLIDING', '0.5', '1.0', 'WHERE'],
          expected_answer: '',
          reference_answer: `-- NRQL Alert Condition: Error Rate
SELECT percentage(count(*), WHERE error IS TRUE) AS error_rate
FROM Transaction
WHERE appName = 'payment-service'
TIMESERIES

-- Alert condition config (New Relic API / Terraform):
-- Type: NRQL
-- Aggregation method: EVENT_FLOW
-- Aggregation window: 5 minutes (SLIDING)
-- Fill option: NONE (to avoid masking gaps)

-- Thresholds:
-- WARNING:  error_rate > 0.5  for at least 5 minutes
-- CRITICAL: error_rate > 1.0  for at least 5 minutes

-- Signal: Open violation when query returns no data (detects service outage)`,
        },
        {
          id: 'sq2',
          prompt: 'Write the **NRQL condition for P95 latency** > 300ms AND a **dead-man\'s switch** condition that fires when throughput drops to zero for 3 minutes.',
          type: 'nrql',
          placeholder: '-- P95 latency query\nSELECT ...\n\n-- Dead-man switch query\nSELECT ...\n',
          required_keywords: ['SELECT', 'FROM', 'percentile', 'Transaction'],
          bonus_keywords: ['300', 'count', 'throughput', 'SINCE', 'fill', '0'],
          expected_answer: '',
          reference_answer: `-- P95 Latency condition
SELECT percentile(duration * 1000, 95) AS p95_ms
FROM Transaction
WHERE appName = 'payment-service'
TIMESERIES

-- Threshold: CRITICAL when p95_ms > 300 for 5 minutes

---

-- Dead-man switch (throughput = 0)
SELECT count(*) AS request_count
FROM Transaction
WHERE appName = 'payment-service'
TIMESERIES

-- Threshold: CRITICAL when request_count < 1 for 3 minutes
-- This fires when the service stops receiving traffic entirely.
-- Set "fill with last known value" OFF so gaps trigger the alert.`,
        },
        {
          id: 'sq3',
          prompt: 'Explain the **difference between baseline and static threshold** alert conditions in New Relic, and when you would use each for the payment service.',
          type: 'text',
          placeholder: 'Static threshold: ...\nBaseline: ...\nWhen to use each: ...\n',
          required_keywords: ['baseline', 'static', 'threshold'],
          bonus_keywords: ['anomaly', 'deviation', 'standard deviation', 'seasonal', 'traffic', 'dynamic'],
          expected_answer: '',
          reference_answer: `**Static threshold:**
A fixed numeric limit (e.g., error rate > 1%). Fires whenever the metric crosses the line.
- Use for: SLO-driven conditions where you have a hard contractual limit (e.g., error rate > 1% violates SLA).
- Use for: Dead-man switches where "no data" itself is the problem.
- Downside: Generates noise during expected traffic spikes (e.g., Black Friday) unless thresholds are tuned.

**Baseline (anomaly) threshold:**
New Relic learns the metric's normal behavior over time and alerts when it deviates by N standard deviations.
- Use for: Latency during variable traffic patterns — e.g., P95 spikes 3x above normal at 2 AM even if it's below 300ms absolute.
- Use for: Throughput drops — a 50% traffic drop is suspicious even if absolute count stays above a fixed threshold.
- Downside: Requires a learning period (~7 days). Can miss issues during first deployment.

**For payment service:**
- Error rate → Static (hard SLO: 1%)
- P95 latency → Baseline (traffic varies by time of day; 300ms may be fine at low traffic but suspicious at peak)
- Throughput → Both: static dead-man (<100 req/min) + baseline anomaly for sudden drops`,
        },
      ]
    },
    {
      title: '[SEED] Grafana Dashboard JSON Design',
      scenario: `**Scenario:** You are building a Grafana dashboard for your **order processing service**. The service emits the following Prometheus metrics:

- \`orders_total{status="success"|"failed"|"pending"}\` — counter
- \`order_processing_duration_seconds{quantile}\` — summary metric (p50, p95, p99)
- \`order_queue_depth\` — gauge
- \`order_value_dollars_total\` — counter (cumulative revenue)

You need to design and write the JSON for key panels. Use **Grafana 10.x panel JSON format**.`,
      difficulty: 'hard',
      time_limit_seconds: 720,
      sub_questions: [
        {
          id: 'sq1',
          prompt: 'Write the **Grafana panel JSON** for a Stat panel showing the current **order success rate %** (last 5 minutes). Include thresholds: green ≥ 99%, yellow ≥ 95%, red < 95%.',
          type: 'yaml',
          placeholder: '{\n  "type": "stat",\n  "title": "...",\n  "targets": [...],\n  "options": {...}\n}',
          required_keywords: ['type', 'stat', 'targets', 'thresholds'],
          bonus_keywords: ['expr', 'orders_total', 'rate', 'percentage', '99', '95', 'green', 'red', 'yellow'],
          expected_answer: '',
          reference_answer: `{
  "type": "stat",
  "title": "Order Success Rate (5m)",
  "datasource": { "type": "prometheus", "uid": "prometheus" },
  "targets": [
    {
      "expr": "rate(orders_total{status='success'}[5m]) / rate(orders_total[5m]) * 100",
      "legendFormat": "Success Rate %",
      "refId": "A"
    }
  ],
  "options": {
    "reduceOptions": { "calcs": ["lastNotNull"] },
    "orientation": "auto",
    "textMode": "auto",
    "colorMode": "background",
    "unit": "percent"
  },
  "fieldConfig": {
    "defaults": {
      "unit": "percent",
      "thresholds": {
        "mode": "absolute",
        "steps": [
          { "color": "red",    "value": null },
          { "color": "yellow", "value": 95 },
          { "color": "green",  "value": 99 }
        ]
      },
      "mappings": []
    }
  }
}`,
        },
        {
          id: 'sq2',
          prompt: 'Write the **Grafana panel JSON** for a Time Series panel showing **P50, P95, P99 order processing latency** over the selected time range.',
          type: 'yaml',
          placeholder: '{\n  "type": "timeseries",\n  ...\n}',
          required_keywords: ['type', 'timeseries', 'targets', 'expr'],
          bonus_keywords: ['order_processing_duration', 'p50', 'p95', 'p99', 'legendFormat', 'unit', 'ms'],
          expected_answer: '',
          reference_answer: `{
  "type": "timeseries",
  "title": "Order Processing Latency",
  "datasource": { "type": "prometheus", "uid": "prometheus" },
  "targets": [
    {
      "expr": "order_processing_duration_seconds{quantile='0.5'} * 1000",
      "legendFormat": "P50",
      "refId": "A"
    },
    {
      "expr": "order_processing_duration_seconds{quantile='0.95'} * 1000",
      "legendFormat": "P95",
      "refId": "B"
    },
    {
      "expr": "order_processing_duration_seconds{quantile='0.99'} * 1000",
      "legendFormat": "P99",
      "refId": "C"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "ms",
      "custom": {
        "lineWidth": 2,
        "fillOpacity": 10,
        "showPoints": "never"
      },
      "thresholds": {
        "mode": "absolute",
        "steps": [
          { "color": "green",  "value": null },
          { "color": "yellow", "value": 500 },
          { "color": "red",    "value": 1000 }
        ]
      }
    },
    "overrides": [
      { "matcher": { "id": "byName", "options": "P99" },
        "properties": [{ "id": "custom.lineStyle", "value": { "dash": [10, 10] } }] }
    ]
  },
  "options": {
    "tooltip": { "mode": "multi" },
    "legend": { "displayMode": "table", "placement": "bottom", "calcs": ["mean", "max", "lastNotNull"] }
  }
}`,
        },
        {
          id: 'sq3',
          prompt: 'Describe your **overall dashboard layout strategy** for this service: row organization, variable/template variables you would add, and how you would use dashboard links to connect it to related dashboards or runbooks.',
          type: 'text',
          placeholder: 'Rows: ...\nVariables: ...\nDashboard links: ...\n',
          required_keywords: ['row', 'variable', 'link'],
          bonus_keywords: ['template', 'instance', 'environment', 'annotation', 'runbook', 'drill-down', 'time range'],
          expected_answer: '',
          reference_answer: `**Dashboard layout strategy:**

**Rows (top to bottom):**
1. Overview row — Stat panels: Success Rate %, Error Rate %, Queue Depth, Revenue/min (4 stats in one row)
2. Latency row — P50/P95/P99 time series + heatmap of latency distribution
3. Volume row — Orders/min by status (stacked bar), Failed order count
4. Queue row — Queue depth over time + queue processing rate vs input rate
5. Revenue row — Cumulative revenue counter, revenue/hour rate

**Template variables:**
- \`$environment\` — dropdown: prod | staging | dev (filters all metrics by environment label)
- \`$instance\` — multi-select from \`label_values(orders_total, instance)\` (drill into specific pods)
- \`$interval\` — interval picker (auto | 1m | 5m) for rate() window

**Annotations:**
- Deployment events from CI/CD webhook (highlight when releases happened)
- SEV1/2 incident windows from PagerDuty annotation API

**Dashboard links:**
- Link to "Order Service Logs" in Grafana Loki (passing \`$__timeRange\`)
- Link to "Infrastructure — Payment DB" dashboard
- External link to Runbook: https://wiki.internal/runbooks/order-service
- Link to New Relic APM trace explorer with \`service=order-service\` pre-filled`,
        },
      ]
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
