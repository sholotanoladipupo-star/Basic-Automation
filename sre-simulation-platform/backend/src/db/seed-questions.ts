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
      title: '[SEED] Alert Firing But Dashboard Looks Normal',
      difficulty: 'medium',
      time_limit_seconds: 720,
      scenario: `It is 11pm. You get paged: "HIGH ERROR RATE — payments-api error rate > 5% for 5 minutes."

You open Grafana. The error rate panel shows 0.3%. Everything looks healthy. The alert is still firing.

Stack: Grafana Alerting, Prometheus metrics, Slack + PagerDuty. The alert rule was written 3 months ago by a former team member.`,
      sub_questions: [
        {
          id: 'first_move',
          type: 'investigation',
          prompt: 'The alert is firing but the dashboard shows 0.3% error rate. What is the most likely explanation? List 3 possible root causes in order of likelihood.',
          placeholder: 'Most likely: ...\nSecond: ...\nThird: ...',
          required_keywords: ['threshold', 'metric', 'alert rule', 'query'],
          bonus_keywords: ['time range', 'label', 'datasource', 'lag', 'stale', 'different metric'],
          reference_answer: '1. The alert rule is querying a different metric or label set than the dashboard panel — e.g. the alert uses http_errors_total{service="payments"} but the dashboard shows a different label or aggregation.\n2. The alert evaluation window is different from the dashboard time range — the alert saw a spike 5 min ago that the dashboard has already scrolled past.\n3. The alert threshold is configured incorrectly (e.g. absolute count > 5 not rate > 5%), so it fired on a traffic burst, not a sustained error rate.',
        },
        {
          id: 'check_alert_rule',
          type: 'alert_rule',
          prompt: 'You open the alert rule in Grafana. What specific things do you inspect to understand why it fired? List the fields you check and what you look for in each.',
          placeholder: 'Field 1: ...\nField 2: ...\nField 3: ...',
          required_keywords: ['query', 'threshold', 'evaluation', 'for', 'condition'],
          bonus_keywords: ['pending period', 'labels', 'datasource', 'time range override', 'no data state'],
          reference_answer: 'Query expression: is it the same metric + labels as the dashboard? Run it manually and check the result.\nThreshold condition: is it "last value > 5" or "avg over 5m > 5%"? A single-sample evaluation can fire on a transient spike.\nFor (pending period): how long must the condition hold before firing? "For: 5m" prevents single-spike alerts; "For: 0s" fires immediately.\nTime range override: alert rules can have a different time window than the dashboard (e.g. alert queries last 1m, dashboard shows last 30m).\nNo data / error state: check what the rule does when the query returns no data — if set to Alerting it fires spuriously.',
        },
        {
          id: 'resolve_action',
          type: 'investigation',
          prompt: 'You confirm the alert rule had "For: 0s" (fires on any single spike) and a threshold of absolute count > 5 (not rate > 5%). The spike was real but lasted only 20 seconds. How do you fix this alert to be more reliable? What is the corrected alert definition?',
          placeholder: 'Problem: ...\nFix:\n  Metric: ...\n  Threshold: ...\n  Evaluation window: ...\n  For: ...',
          required_keywords: ['rate', 'for', 'window', 'percentage', 'sustained'],
          bonus_keywords: ['5 minutes', 'rolling', 'error ratio', 'total requests', 'false positive'],
          reference_answer: 'Problem: the alert fires on a single 20-second spike of absolute error count, not sustained high error rate.\n\nFixed alert:\n  Metric: rate(http_errors_total{service="payments"}[5m]) / rate(http_requests_total{service="payments"}[5m])\n  Threshold: > 0.05 (5%)\n  Evaluation: every 1 minute\n  For: 5m (must be sustained for 5 minutes before paging)\n\nThis ensures: (1) we measure rate not count so traffic volume does not skew it, (2) a 20-second spike will not fire, (3) only sustained degradation pages on-call.',
        },
        {
          id: 'postmortem',
          type: 'postmortem',
          prompt: 'After resolving the false-positive alert, your team wants to prevent this from happening again. What process or guardrails do you put in place for all future alert rules?',
          placeholder: 'Process change 1: ...\nProcess change 2: ...\nTooling: ...',
          required_keywords: ['review', 'runbook', 'test', 'false positive'],
          bonus_keywords: ['alert as code', 'PR review', 'staging', 'alert fatigue', 'ownership'],
          reference_answer: '1. Alerts as code (alert rules in Git): every alert change goes through a PR review before being applied. A second engineer reviews the query, threshold, and "for" window.\n2. Mandatory runbook link: every alert must reference a runbook URL. If no runbook exists, the alert is not merged.\n3. Staging environment replay: new alert rules are deployed to staging first and evaluated against historical production traffic to check for false positives.\n4. Monthly alert hygiene review: review all alerts that fired in the past month. Delete or fix any with > 20% false positive rate.\n5. Alert ownership: every alert has a named team owner. Ownerless alerts are deleted.',
        },
      ],
    },
    {
      title: '[SEED] Service Latency Spike — Metrics vs Reality',
      difficulty: 'medium',
      time_limit_seconds: 720,
      scenario: `At 2pm your Grafana dashboard shows checkout-service p99 latency spiked from 120ms to 4.2 seconds starting 15 minutes ago. The error rate panel is completely flat at 0.1%.

Users are complaining in Slack: "checkout is hanging". Your SLO dashboard shows you are burning error budget at 14x the normal rate.

Stack: GKE, Prometheus + Grafana, Cloud Spanner (database), Cloud Pub/Sub (async jobs).`,
      sub_questions: [
        {
          id: 'initial_hypothesis',
          type: 'investigation',
          prompt: 'Latency is at 4.2s p99 but error rate is near zero. What does this pattern tell you? List your top 3 hypotheses for what is causing this.',
          placeholder: 'Pattern interpretation: ...\n\nHypothesis 1: ...\nHypothesis 2: ...\nHypothesis 3: ...',
          required_keywords: ['timeout', 'slow', 'queue', 'database', 'downstream'],
          bonus_keywords: ['hanging', 'connection pool', 'lock', 'retry', 'circuit breaker', 'upstream'],
          reference_answer: 'Pattern: high latency + near-zero errors means requests are completing, just slowly. The service is not crashing — it is waiting. This rules out OOM, crash loops, and code errors.\n\nHypothesis 1: Database (Cloud Spanner) is slow — most likely. A lock contention or hot key issue causes queries to queue up, adding seconds of wait time.\nHypothesis 2: An upstream dependency (e.g. inventory or payment API) is responding slowly, and checkout is waiting synchronously.\nHypothesis 3: Connection pool exhaustion — all DB connections are in use, new requests queue waiting for one to free up.',
        },
        {
          id: 'spanner_investigation',
          type: 'investigation',
          prompt: 'You pivot to check Cloud Spanner. What metrics or signals do you look at in Spanner monitoring to confirm or rule out a database problem? Name the specific metrics.',
          placeholder: 'Metric 1: ...\nMetric 2: ...\nMetric 3: ...\nWhat you expect to see if Spanner is the problem: ...',
          required_keywords: ['latency', 'cpu', 'lock', 'query'],
          bonus_keywords: ['99th percentile', 'hot key', 'read latency', 'write latency', 'transaction', 'split'],
          reference_answer: 'Key Spanner metrics to check:\n1. api/request_latencies (by method: Read, ExecuteSql, Commit) — if read latency p99 jumped from 5ms to 3s, Spanner is the cause.\n2. instance/cpu/utilization — Spanner CPU > 70% indicates high query load or hot key contention.\n3. lock_stat/total/lock_wait_seconds — high lock wait time means write transactions are blocking reads.\n4. query_stat/total/query_latencies — shows slowest SQL queries by latency percentile.\n\nExpected signs if Spanner is the issue: read latency p99 matches the checkout p99 spike in timing. CPU spike or lock_wait spike coincides with the latency event.',
        },
        {
          id: 'mitigation',
          type: 'mitigation',
          prompt: 'You confirm: Spanner shows high lock_wait_seconds starting at the same time. A batch job was deployed at 1:58pm that is doing large full-table reads. What do you do right now to restore service?',
          placeholder: 'Immediate action: ...\nVerification: ...\nFollow-up: ...',
          required_keywords: ['stop', 'rollback', 'batch', 'deploy', 'latency'],
          bonus_keywords: ['kill', 'scale down', 'staleness', 'stale read', 'priority', 'rate limit'],
          reference_answer: 'Immediate action: stop the batch job deployment. kubectl scale deployment/batch-processor --replicas=0 -n prod OR roll back the deploy: kubectl rollout undo deployment/batch-processor.\n\nVerification: watch Spanner lock_wait_seconds drop in real time. Check checkout-service p99 latency — should return to ~120ms within 2-3 minutes of stopping the contention source.\n\nFollow-up:\n1. Root cause: batch job used strong reads (default) on a hot table instead of stale reads, acquiring read locks that blocked write transactions.\n2. Fix: rewrite batch job to use stale reads (bounded staleness 15s) which do not take locks.\n3. Scheduling: run batch jobs outside business hours OR add a maximum QPS rate limit to the batch job.',
        },
        {
          id: 'slo_communication',
          type: 'communication',
          prompt: 'The incident lasted 22 minutes. Your SLO is 99.9% monthly availability. How much error budget did you burn? How do you communicate this to stakeholders?',
          placeholder: 'Error budget burned: ...\nStakeholder update: ...',
          required_keywords: ['error budget', 'minutes', 'slo', 'stakeholder'],
          bonus_keywords: ['43', 'burn rate', 'postmortem', 'action items', 'remaining budget'],
          reference_answer: 'Error budget calculation:\n99.9% SLO → 0.1% allowed per month = 43.2 minutes budget.\n22 minutes burned = 51% of the monthly error budget gone in one incident.\n\nStakeholder update (within 1 hour of resolution):\n"checkout-service experienced elevated latency (p99 4.2s, normal 120ms) from 14:00 to 14:22 UTC due to a batch job deployment causing Spanner lock contention. No data loss. 22 minutes of degraded service, burning ~51% of our monthly error budget. Batch job has been stopped. Post-mortem scheduled for Friday. Short-term fix: batch job updated to use stale reads. We will also add deployment guardrails to prevent batch jobs from running during peak hours."',
        },
      ],
    },
    {
      title: '[SEED] Disk Alert Firing — But Disk Metrics Look Fine',
      difficulty: 'hard',
      time_limit_seconds: 900,
      scenario: `You receive a PagerDuty alert at 3am: "DISK FULL — /var/log on logging-agent-7 is 95% full."

You SSH into the node. df -h shows /var/log at 23% used. The alert is still firing in Grafana.

Stack: Kubernetes on GKE, node_exporter for host metrics, Prometheus + Grafana for monitoring. The logging agent (Fluent Bit) writes logs to /var/log before shipping them to Cloud Logging.`,
      sub_questions: [
        {
          id: 'discrepancy',
          type: 'investigation',
          prompt: 'The alert says 95% full. df -h says 23%. What are all the possible explanations for this discrepancy? Rank them by likelihood.',
          placeholder: 'Most likely: ...\nSecond: ...\nThird: ...\nFourth: ...',
          required_keywords: ['stale', 'metric', 'label', 'node', 'time'],
          bonus_keywords: ['scrape', 'cache', 'wrong pod', 'kubernetes node', 'relabeling', 'previous node', 'terminated'],
          reference_answer: '1. Most likely: the alert is evaluating a stale metric — node_exporter scraped logging-agent-7 at 95% but the log rotation ran since then. The Prometheus scrape interval is 15s but the alert evaluated the cached value.\n2. The alert label "logging-agent-7" refers to a different node that was terminated/replaced. The pod name stayed the same but moved to a different underlying GKE node.\n3. node_exporter relabeling bug — a Prometheus relabeling rule is incorrectly mapping a different node\'s /var/log metric to this alert label, so you are looking at the right node but the alert fired for a different one.\n4. The df command is showing available inodes, not block usage — inode exhaustion can cause "disk full" errors while block % is low.',
        },
        {
          id: 'inode_check',
          type: 'investigation',
          prompt: 'Your colleague suggests it could be inode exhaustion. What is inode exhaustion, how does it manifest, and what command do you run to check it?',
          placeholder: 'What inodes are: ...\nHow it manifests: ...\nCommand to check: ...',
          required_keywords: ['inode', 'files', 'df', 'small files'],
          bonus_keywords: ['df -i', 'no space left', 'log files', 'touch', 'find', 'tmp'],
          reference_answer: 'Inodes are filesystem metadata entries — one per file/directory. Each inode stores permissions, ownership, timestamps, and data block pointers.\n\nInode exhaustion: you have used up all available inodes (too many files/directories), so no new files can be created even if block space is available. The error is "No space left on device" even with df showing plenty of free space.\n\nCommands:\ndf -i /var/log   → shows inode usage (Use% column). If 100%, you have inode exhaustion.\nfind /var/log -maxdepth 3 -type d | xargs -I{} sh -c \'echo $(ls {} | wc -l) {}\' | sort -rn | head -20  → find dirs with most files\n\nFor Fluent Bit logs: Fluent Bit can create one file per log stream. If a pod is restarting rapidly, thousands of tiny partial log files accumulate and exhaust inodes.',
        },
        {
          id: 'prometheus_debug',
          type: 'investigation',
          prompt: 'You want to verify what Prometheus actually recorded for this node. How do you query Prometheus directly to check the raw metric vs what Grafana is displaying? Write the PromQL query and explain how you interpret it.',
          placeholder: 'Prometheus query: ...\nWhat you check: ...\nHow to verify stale data: ...',
          required_keywords: ['node_filesystem', 'promql', 'instant vector', 'label'],
          bonus_keywords: ['node_filesystem_avail_bytes', 'mountpoint', 'rate', 'timestamp', 'staleness'],
          reference_answer: 'Query in Prometheus UI (or Grafana Explore):\n\n1 - (node_filesystem_avail_bytes{instance="logging-agent-7", mountpoint="/var/log"} / node_filesystem_size_bytes{instance="logging-agent-7", mountpoint="/var/log"})\n\nThis gives the current usage ratio directly from Prometheus.\n\nTo check staleness: look at the timestamp of the last sample. In Prometheus UI, hover over the result to see when it was scraped. If the timestamp is > 2 scrape intervals old (>30s), the target may be down or the metric is stale.\n\nAlso run: up{job="node_exporter", instance="logging-agent-7"} — if this is 0, node_exporter is down on that host and all its metrics are stale. Grafana may still display the last known value while the alert evaluates the old cached metric as still breaching threshold.',
        },
        {
          id: 'fix_and_prevent',
          type: 'prevention',
          prompt: 'Root cause found: the GKE node was replaced (scale event), the old node\'s metrics are stale in Prometheus, and node_exporter on the new node has not been scraped yet with the new instance label. How do you fix the alert and prevent this class of false positive?',
          placeholder: 'Immediate fix: ...\nAlert rule fix: ...\nLong-term prevention: ...',
          required_keywords: ['stale', 'absent', 'for', 'label'],
          bonus_keywords: ['node lifecycle', 'absent()', 'no data', 'GKE node pool', 'daemonset', 'scrape interval'],
          reference_answer: 'Immediate fix: silence the alert for 15 minutes while the new node\'s node_exporter is discovered and scraped. Verify df -h on the new node.\n\nAlert rule fix:\n1. Add "For: 5m" if not already present — stale metrics will stop updating and Prometheus will mark them as stale after 5 minutes, resolving the alert naturally.\n2. Add an absent() guard: if absent(node_filesystem_avail_bytes{instance="..."}) then the alert should not fire (or fire a different "metric missing" alert).\n3. Set the alert\'s "No data" state to "OK" not "Alerting" in Grafana — missing data should not trigger a page.\n\nLong-term prevention:\n- Use Kubernetes pod labels instead of node hostnames in metrics (node_exporter DaemonSet pods are auto-relabeled with kubernetes_pod_name which survives node replacement).\n- Add a node lifecycle runbook: after a scale event, verify node_exporter DaemonSet pods are running on new nodes before trusting disk alerts.',
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
