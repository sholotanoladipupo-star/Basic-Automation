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
  console.log('Seeding monitoring questions (knowledge-based)...')
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
      title: '[SEED] Production Database Observability',
      difficulty: 'medium',
      time_limit_seconds: 720,
      scenario: `Your team manages a production Cloud SQL (PostgreSQL) database on GCP serving the main checkout service. It handles ~5,000 queries/minute with a p99 latency SLO of 200ms. You have been asked to design the full monitoring and alerting strategy for this database.

Your observability stack: Grafana for dashboards and alerting, Slack (#platform-alerts) for team notifications, PagerDuty for on-call escalation.`,
      sub_questions: [
        {
          id: 'metrics',
          type: 'metrics',
          prompt: 'What are the key metrics you would monitor on this Cloud SQL instance? List them grouped by category: Performance, Availability, Capacity, and Replication.',
          placeholder: 'Performance:\n- ...\nAvailability:\n- ...\nCapacity:\n- ...\nReplication:\n- ...',
          required_keywords: ['connections', 'latency', 'cpu', 'disk', 'replication'],
          bonus_keywords: ['slow queries', 'cache hit', 'deadlock', 'lock', 'vacuum', 'iops'],
          reference_answer: 'Performance: query latency (p50/p95/p99), queries per second, slow query count, lock wait time, deadlocks per minute.\nAvailability: uptime %, failover events, connection errors.\nCapacity: disk usage %, active connections vs max_connections, CPU utilization %, memory usage.\nReplication: replication lag (seconds), replica status (healthy/lagging/disconnected).',
        },
        {
          id: 'datasource',
          type: 'datasource',
          prompt: 'Your team uses Grafana and the database runs on GCP Cloud SQL. What Grafana data source(s) would you configure to pull in these metrics? Explain your choice.',
          placeholder: 'Primary data source: ...\nWhy: ...\nOptional additional source: ...',
          required_keywords: ['google cloud monitoring', 'cloud monitoring', 'stackdriver', 'gcp'],
          bonus_keywords: ['prometheus', 'cloud sql exporter', 'service account', 'pg_stat'],
          reference_answer: 'Primary: Google Cloud Monitoring (formerly Stackdriver) — native GCP data source in Grafana, exposes all Cloud SQL metrics (CPU, disk, connections, replication lag) without extra infrastructure. Configure with a GCP service account JSON key and your project ID.\n\nOptional: Deploy Cloud SQL Proxy + postgres_exporter sidecar, scrape with Prometheus for deeper metrics like pg_stat_statements (query-level latency, top slow queries).',
        },
        {
          id: 'alerting',
          type: 'alerting',
          prompt: 'Define two alert rules for this database:\n1. Connection saturation (when to page the on-call)\n2. Replication lag (threshold and severity)\n\nFor each: include the threshold, evaluation window, and severity.',
          placeholder: 'Alert 1 - Connection Saturation:\n  Threshold: ...\n  Window: ...\n  Severity: ...\n\nAlert 2 - Replication Lag:\n  Threshold: ...\n  Window: ...\n  Severity: ...',
          required_keywords: ['connections', 'threshold', 'replication', 'lag', 'severity'],
          bonus_keywords: ['80%', '95%', '30 seconds', 'sev1', 'sev2', 'warning', 'critical'],
          reference_answer: 'Alert 1 — Connection Saturation:\n  Warning: active_connections / max_connections > 80% for 5 min → SEV2 (Slack + ticket)\n  Critical: > 95% for 2 min → SEV1 (PagerDuty page)\n\nAlert 2 — Replication Lag:\n  Warning: replication_lag > 30s for 3 min → SEV2 (Slack)\n  Critical: replication_lag > 120s for 2 min → SEV1 (PagerDuty) — risk of data loss on failover',
        },
        {
          id: 'investigation',
          type: 'investigation',
          prompt: 'It is 2am and you are paged: p99 query latency has spiked from 50ms to 3 seconds. Walk through your investigation steps in order.',
          placeholder: 'Step 1: ...\nStep 2: ...\nStep 3: ...',
          required_keywords: ['connections', 'slow query', 'explain', 'index', 'lock'],
          bonus_keywords: ['pg_stat_activity', 'pg_stat_statements', 'vacuum', 'autovacuum', 'cpu', 'disk io'],
          reference_answer: '1. Check active connections (pg_stat_activity) — look for piled-up long-running queries or lock waits.\n2. Identify the slowest queries: SELECT query, wait_event, state, now()-query_start FROM pg_stat_activity WHERE state != \'idle\' ORDER BY query_start;\n3. Run EXPLAIN ANALYZE on the slowest query — look for Seq Scans on large tables (missing index).\n4. Check pg_locks for blocking locks / deadlocks.\n5. Review CPU and disk I/O metrics in Cloud Monitoring — rule out resource exhaustion.\n6. Check if autovacuum is running on a large table (causes lock contention).\n7. If a specific query is the culprit: either terminate it (pg_terminate_backend) or create a covering index.',
        },
      ],
    },
    {
      title: '[SEED] SLOs, Error Budgets & Alert Hygiene',
      difficulty: 'medium',
      time_limit_seconds: 720,
      scenario: `Your team is building observability for a new payments API. The product team has agreed on a 99.9% monthly availability SLO. You are designing the SLI/SLO framework and alert strategy.

Context: the team currently receives 200+ alerts per week and on-call engineers have started ignoring pages. Your job is also to fix this alert fatigue problem.`,
      sub_questions: [
        {
          id: 'sli_slo',
          type: 'sli_slo',
          prompt: 'Explain the difference between an SLI and an SLO. Give a concrete example for this payments API — what would your SLI be and what SLO would you set?',
          placeholder: 'SLI definition: ...\nSLO definition: ...\n\nExample for payments API:\nSLI: ...\nSLO: ...',
          required_keywords: ['sli', 'slo', 'indicator', 'objective'],
          bonus_keywords: ['error rate', '99.9', 'latency', 'success rate', 'p99', 'measurement window'],
          reference_answer: 'SLI (Service Level Indicator): the actual metric being measured. It is a ratio or value that describes service behaviour.\nSLO (Service Level Objective): the target value for that SLI that you commit to meeting.\n\nExample:\nSLI: proportion of HTTP requests to /v1/payments that return 2xx within 500ms\nSLO: 99.9% of those requests succeed, measured over a 30-day rolling window\n\nThe SLI is what you measure; the SLO is the threshold you promise.',
        },
        {
          id: 'error_budget',
          type: 'error_budget',
          prompt: 'With a 99.9% monthly SLO, calculate your error budget in minutes per month. How would you use this budget operationally to balance reliability vs feature velocity?',
          placeholder: 'Error budget calculation:\n...\n\nOperational use:\n...',
          required_keywords: ['error budget', 'minutes', '43'],
          bonus_keywords: ['burn rate', 'freeze', 'deploy', 'velocity', 'reliability', '43.2'],
          reference_answer: 'Calculation: 99.9% SLO → 0.1% allowed downtime. 30 days = 43,200 min × 0.001 = 43.2 minutes/month error budget.\n\nOperational use:\n- Track burn rate: if you burn the budget in 1 week, something is wrong.\n- Budget healthy → teams can deploy frequently and take reliability risks.\n- Budget < 20% remaining → freeze non-critical deploys, increase testing bar, focus on reliability work.\n- Budget exhausted → full deploy freeze until next month; incident review required.\n- Use burn rate alerts: alert when budget will be exhausted in < 6 hours at current rate.',
        },
        {
          id: 'alert_fatigue',
          type: 'alert_fatigue',
          prompt: '200+ alerts per week and engineers are ignoring pages. How do you fix alert fatigue? Describe your approach to auditing and improving alert hygiene.',
          placeholder: 'Step 1: Audit\n...\nStep 2: Triage\n...\nStep 3: Fix\n...',
          required_keywords: ['actionable', 'runbook', 'severity', 'false positive', 'threshold'],
          bonus_keywords: ['deduplicate', 'grouping', 'silence', 'inhibition', 'sev1', 'sev2', 'sev3'],
          reference_answer: '1. Audit: export all alerts + firing frequency. Classify each as actionable (requires human action now) or noise (informational / auto-resolves).\n2. Delete or demote noise: alerts that fired 50+ times with no action taken are not alerts — they are metrics. Move them to dashboards.\n3. Every surviving alert must have a runbook. If you cannot write a runbook for it, it should not exist.\n4. Implement severity tiers: SEV1 = wake someone up (PagerDuty); SEV2 = ticket/Slack during business hours; SEV3 = log only.\n5. Use evaluation windows: no alert on a single-sample spike. Require 5-minute sustained breach.\n6. Group related alerts (Alertmanager group_by) to prevent storm of 20 alerts for one incident.\n7. Weekly alert review meeting: track MTTA, false positive rate, alert volume trend.',
        },
        {
          id: 'dashboard',
          type: 'dashboard',
          prompt: 'You are building a Grafana dashboard for the payments API. What panels would you include? What is the "Four Golden Signals" framework and how does it apply here?',
          placeholder: 'Four Golden Signals:\n1. ...\n2. ...\n3. ...\n4. ...\n\nDashboard panels:\n...',
          required_keywords: ['latency', 'traffic', 'errors', 'saturation', 'golden signals'],
          bonus_keywords: ['p99', 'p95', 'rate', 'histogram', 'error rate', 'requests per second'],
          reference_answer: 'Four Golden Signals (Google SRE Book):\n1. Latency — time to serve a request. Show p50/p95/p99 as time series. Separate successful vs failed latency.\n2. Traffic — requests per second hitting the system. Shows load and usage patterns.\n3. Errors — rate of failed requests (5xx, timeouts, explicit failures).\n4. Saturation — how full the service is (CPU %, memory %, connection pool usage, queue depth).\n\nDashboard panels for payments API:\n- Request rate + error rate (dual axis)\n- p99/p95/p50 latency time series\n- Error rate % with SLO burn line\n- Saturation: DB connection pool %, CPU\n- SLO compliance panel (30-day burn rate)\n- Active alert list',
        },
      ],
    },
    {
      title: '[SEED] Kubernetes & Cloud-Native Observability',
      difficulty: 'hard',
      time_limit_seconds: 900,
      scenario: `Your company runs a microservices application on GKE (Google Kubernetes Engine) with 15 services across 3 environments (dev/staging/prod). The platform team needs to build a scalable observability strategy covering metrics, logging, tracing, and runbook practices.`,
      sub_questions: [
        {
          id: 'k8s_metrics',
          type: 'k8s_metrics',
          prompt: 'What are the critical Kubernetes-level metrics you would monitor? Categorise them by: Cluster, Node, Pod, and Container level. Name the metric sources you would use.',
          placeholder: 'Cluster level:\n...\nNode level:\n...\nPod level:\n...\nContainer level:\n...\nMetric sources:\n...',
          required_keywords: ['cpu', 'memory', 'pod', 'node', 'restart'],
          bonus_keywords: ['OOMKill', 'eviction', 'pending', 'kube-state-metrics', 'cAdvisor', 'node_exporter', 'PVC'],
          reference_answer: 'Cluster: node count, unschedulable nodes, API server latency/error rate.\nNode: CPU/memory/disk utilization %, pod count vs capacity, network throughput.\nPod: restart count (CrashLoopBackOff signal), pending pods (scheduling issues), ready ratio per deployment.\nContainer: CPU throttling %, memory usage vs limit, OOMKill events.\n\nSources:\n- kube-state-metrics: Kubernetes object state (pod phase, deployment replicas, node conditions)\n- cAdvisor / metrics-server: container resource usage (CPU/memory)\n- node_exporter: host-level metrics (disk I/O, network, filesystem)',
        },
        {
          id: 'logging',
          type: 'logging',
          prompt: 'How would you approach centralized logging for 15 services on GKE? What should you log, and what should you NOT log? How do you handle log correlation across services?',
          placeholder: 'Log architecture:\n...\nWhat to log:\n...\nWhat NOT to log:\n...\nCorrelation:\n...',
          required_keywords: ['structured', 'log level', 'correlation', 'request id', 'context'],
          bonus_keywords: ['json', 'trace id', 'sampling', 'PII', 'retention', 'cloud logging', 'fluent bit'],
          reference_answer: 'Architecture: On GKE, use Cloud Logging (Stackdriver) via the Fluent Bit DaemonSet — already built in, no extra setup. All stdout/stderr is captured automatically.\n\nLog format: structured JSON with: timestamp, service, level, request_id, trace_id, user_id (hash, not raw), duration_ms, status_code, error message.\n\nWhat to log: key business events (payment initiated, payment succeeded/failed), errors with full context, slow operations > 500ms, auth events.\n\nWhat NOT to log: passwords, tokens, full request/response bodies, PII (card numbers, SSNs), high-cardinality debug noise in prod.\n\nCorrelation: propagate a trace_id/request_id header (X-Request-ID) across all service calls. Log it at every hop. Use Cloud Trace or OpenTelemetry for full distributed tracing.\n\nRetention: 30 days hot in Cloud Logging, export to GCS for 1-year cold storage.',
        },
        {
          id: 'tracing',
          type: 'tracing',
          prompt: 'When would you use distributed tracing vs logs vs metrics? Give a concrete scenario for each where it is the right tool to reach for.',
          placeholder: 'Use metrics when: ...\nUse logs when: ...\nUse tracing when: ...',
          required_keywords: ['tracing', 'metrics', 'logs', 'latency', 'distributed'],
          bonus_keywords: ['opentelemetry', 'span', 'sampling', 'alert', 'debug', 'root cause'],
          reference_answer: 'Metrics — use for: detecting that something is wrong (aggregate signals). Best for: alerting, dashboards, capacity planning. Example: your error rate alert fires because 5xx rate jumped to 8%. Metrics told you something broke.\n\nLogs — use for: understanding what happened in detail for a specific request or error. Best for: post-incident debugging, audit trails. Example: a customer reports their payment failed at 14:32. You search logs by request_id to see exactly what error occurred and where.\n\nTracing — use for: diagnosing latency across multiple services. Best for: "which service is slow and why?" Example: p99 spiked to 3s. Traces show the checkout service is spending 2.8s waiting on product-catalog. Logs on product-catalog show a DB timeout. Tracing pointed you to the right service immediately.',
        },
        {
          id: 'runbook',
          type: 'runbook',
          prompt: 'Write a concise runbook for: "checkout-service pods are in CrashLoopBackOff". What are the diagnostic steps an on-call engineer should follow?',
          placeholder: 'Alert: checkout-service CrashLoopBackOff\n\nStep 1: ...\nStep 2: ...\nStep 3: ...',
          required_keywords: ['kubectl', 'logs', 'describe', 'restart', 'rollback'],
          bonus_keywords: ['kubectl get pods', 'kubectl describe pod', 'previous', 'configmap', 'secret', 'rollout undo'],
          reference_answer: 'Alert: checkout-service pods in CrashLoopBackOff\n\n1. kubectl get pods -n prod -l app=checkout-service\n   → Confirm pods in CrashLoopBackOff, note restart count and age.\n\n2. kubectl describe pod <pod-name> -n prod\n   → Check Events section: OOMKill? Image pull error? Config error?\n\n3. kubectl logs <pod-name> -n prod --previous\n   → Get logs from the last crashed container (before restart).\n\n4. Check recent changes:\n   kubectl rollout history deployment/checkout-service -n prod\n   → Was there a recent deploy?\n\n5. If bad deploy: kubectl rollout undo deployment/checkout-service -n prod\n\n6. If config issue: kubectl describe configmap checkout-config -n prod\n   → Check for missing/wrong environment variables or secrets.\n\n7. If OOMKill: increase memory limits in the deployment spec and re-deploy.',
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
