/**
 * Seeds:
 * 1. sql_sandbox schema with 5 tables + realistic data
 * 2. 5 SQL questions (write / fix / analyse)
 * 3. 2 monitoring & observability questions
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

  // Incidents
  await client.query(`
    INSERT INTO sql_sandbox.incidents (title, severity, service, reported_by, resolved_by, opened_at, resolved_at, root_cause) VALUES
    ('Redis OOM kill',              'sev1', 'cache',       7,  7,  NOW()-INTERVAL'45 days', NOW()-INTERVAL'44 days 22 hours', 'Memory limit too low'),
    ('DB connection pool exhausted','sev1', 'postgres',    8,  6,  NOW()-INTERVAL'30 days', NOW()-INTERVAL'30 days 2 hours',  'Missing connection timeout'),
    ('API gateway 502 storm',       'sev2', 'api-gateway', 7,  8,  NOW()-INTERVAL'20 days', NOW()-INTERVAL'20 days 1 hour',   'Upstream timeout misconfigured'),
    ('Auth service latency spike',  'sev2', 'auth',        9,  2,  NOW()-INTERVAL'15 days', NOW()-INTERVAL'14 days 23 hours', 'N+1 query in session lookup'),
    ('Payment timeout cascade',     'sev1', 'payments',    6,  6,  NOW()-INTERVAL'10 days', NOW()-INTERVAL'9 days 20 hours',  'Redis timeout propagated'),
    ('ML pipeline OOM',             'sev3', 'ml-pipeline', 11, 10, NOW()-INTERVAL'8 days',  NOW()-INTERVAL'8 days 4 hours',   'Batch size too large'),
    ('Disk full on logs host',      'sev2', 'logging',     8,  9,  NOW()-INTERVAL'5 days',  NOW()-INTERVAL'5 days 3 hours',   'Log rotation not configured'),
    ('TLS cert expiry',             'sev1', 'api-gateway', 16, 15, NOW()-INTERVAL'3 days',  NOW()-INTERVAL'3 days 1 hour',    'Cert renewal automation missed')
  `)

  console.log('SQL sandbox seeded.')
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
      expected_output: {
        columns: ['name','department','role','salary'],
        rows: [
          {name:'Alice Chen',department:'Engineering',role:'Engineering Manager',salary:'145000.00'},
          {name:'Bob Okafor',department:'Engineering',role:'Senior Engineer',salary:'118000.00'},
          {name:'Chloe Martin',department:'Engineering',role:'Senior Engineer',salary:'115000.00'},
          {name:'Frank Nguyen',department:'DevOps',role:'DevOps Lead',salary:'130000.00'},
          {name:'Grace Lee',department:'DevOps',role:'SRE',salary:'108000.00'},
          {name:'Henry Obi',department:'DevOps',role:'SRE',salary:'104000.00'},
          {name:'Tina Reyes',department:'Engineering',role:'Engineer',salary:'91000.00'},
          {name:'David Kim',department:'Engineering',role:'Engineer',salary:'92000.00'},
          {name:'Eva Rossi',department:'Engineering',role:'Engineer',salary:'88000.00'},
          {name:'Isla Patel',department:'DevOps',role:'Platform Engineer',salary:'96000.00'},
          {name:'Quinn Murphy',department:'Engineering',role:'Junior Engineer',salary:'72000.00'},
          {name:'Rita Yamada',department:'DevOps',role:'Junior SRE',salary:'74000.00'},
        ]
      }
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
      expected_output: {
        columns: ['department','avg_salary','employee_count'],
        rows: [
          {department:'Engineering',avg_salary:'91571.43',employee_count:'7'},
          {department:'DevOps',avg_salary:'102500.00',employee_count:'4'},
          {department:'Data',avg_salary:'95500.00',employee_count:'4'},
        ]
      }
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
      expected_output: {
        columns: ['name','salary','department'],
        rows: [
          {name:'Alice Chen',salary:'145000.00',department:'Engineering'},
          {name:'Olivia Brooks',salary:'135000.00',department:'Security'},
          {name:'Frank Nguyen',salary:'130000.00',department:'DevOps'},
          {name:'James Adeyemi',salary:'125000.00',department:'Data'},
          {name:'Mia Fischer',salary:'115000.00',department:'Product'},
          {name:'Bob Okafor',salary:'118000.00',department:'Engineering'},
          {name:'Chloe Martin',salary:'115000.00',department:'Engineering'},
          {name:'Grace Lee',salary:'108000.00',department:'DevOps'},
          {name:'Henry Obi',salary:'104000.00',department:'DevOps'},
          {name:'Peter Walsh',salary:'102000.00',department:'Security'},
        ]
      }
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
      hint: 'Join employees → project_assignments → projects. Filter projects.status = \'active\'. GROUP BY employee. Use HAVING COUNT > 1.',
      time_limit_seconds: 360,
      expected_output: {
        columns: ['name','department','active_projects'],
        rows: [
          {name:'Frank Nguyen',department:'DevOps',active_projects:'4'},
          {name:'Grace Lee',department:'DevOps',active_projects:'2'},
          {name:'Henry Obi',department:'DevOps',active_projects:'2'},
          {name:'Isla Patel',department:'DevOps',active_projects:'2'},
          {name:'James Adeyemi',department:'Data',active_projects:'2'},
          {name:'Tina Reyes',department:'Engineering',active_projects:'2'},
        ]
      }
    },
    {
      title: '[SEED] Unresolved SEV1 Incidents',
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
      hint: 'You need to JOIN employees twice (once for reporter, once for resolver). Use EXTRACT(EPOCH ...) or ROUND(...) to calculate hours. Filter WHERE severity = \'sev1\' AND resolved_at IS NOT NULL.',
      time_limit_seconds: 420,
      expected_output: {
        columns: ['title','service','reported_by','resolved_by','hours_to_resolve'],
        rows: [
          {title:'Auth service latency spike', service:'auth',     reported_by:'Isla Patel',  resolved_by:'Bob Okafor', hours_to_resolve:'23.0'},
          {title:'Payment timeout cascade',    service:'payments', reported_by:'Frank Nguyen',resolved_by:'Frank Nguyen',hours_to_resolve:'28.0'},
          {title:'DB connection pool exhausted',service:'postgres',reported_by:'Henry Obi',  resolved_by:'Frank Nguyen',hours_to_resolve:'2.0'},
          {title:'TLS cert expiry',            service:'api-gateway',reported_by:'Peter Walsh',resolved_by:'Olivia Brooks',hours_to_resolve:'1.0'},
          {title:'Redis OOM kill',             service:'cache',    reported_by:'Grace Lee',   resolved_by:'Grace Lee',  hours_to_resolve:'2.0'},
        ]
      }
    },
  ]

  for (const q of questions) {
    await pool.query(
      `INSERT INTO sql_questions (title, description, difficulty, question_type, starter_query, expected_output, schema_hint, hint, time_limit_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      [q.title, q.description, q.difficulty, q.question_type, q.starter_query, JSON.stringify(q.expected_output), q.schema_hint, q.hint, q.time_limit_seconds]
    )
  }
  console.log(`Seeded ${questions.length} SQL questions.`)
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
    }
  ]

  for (const q of questions) {
    await pool.query(
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
