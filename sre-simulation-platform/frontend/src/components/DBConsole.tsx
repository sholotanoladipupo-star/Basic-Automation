import { useState, useRef, useEffect, useCallback } from 'react'
import { SystemState } from '../types'

interface DBConsoleProps {
  systemState: SystemState | null
}

// ─── Database / Table registry ───────────────────────────────────────────────

const DB_TREE: Record<string, string[]> = {
  payments_db: ['accounts', 'transactions', 'payment_methods', 'banks', 'ledger_entries'],
  orders_db:   ['orders', 'order_items', 'products', 'inventory', 'customers'],
  users_db:    ['users', 'sessions', 'user_profiles', 'kyc_documents', 'user_settings'],
  analytics_db:['events', 'metrics_rollup', 'funnel_steps', 'cohorts'],
}

// ─── Schema definitions ───────────────────────────────────────────────────────

interface ColumnDef {
  name: string
  type: string
  extra: string
}

const TABLE_SCHEMAS: Record<string, ColumnDef[]> = {
  accounts: [
    { name: 'id',         type: 'BIGINT',        extra: 'PK, AUTO_INCREMENT' },
    { name: 'user_id',    type: 'BIGINT',        extra: 'FK → users.id, NOT NULL' },
    { name: 'balance',    type: 'DECIMAL(20,4)', extra: 'NOT NULL, DEFAULT 0.0000' },
    { name: 'currency',   type: 'VARCHAR(3)',    extra: 'NOT NULL' },
    { name: 'status',     type: "ENUM('active','frozen','closed')", extra: 'NOT NULL, DEFAULT active' },
    { name: 'created_at', type: 'TIMESTAMP',     extra: 'NOT NULL, DEFAULT CURRENT_TIMESTAMP' },
  ],
  transactions: [
    { name: 'id',           type: 'BIGINT',        extra: 'PK, AUTO_INCREMENT' },
    { name: 'account_id',   type: 'BIGINT',        extra: 'FK → accounts.id, NOT NULL' },
    { name: 'amount',       type: 'DECIMAL(20,4)', extra: 'NOT NULL' },
    { name: 'type',         type: "ENUM('credit','debit')", extra: 'NOT NULL' },
    { name: 'status',       type: "ENUM('pending','settled','failed')", extra: 'NOT NULL, DEFAULT pending' },
    { name: 'reference_id', type: 'VARCHAR(64)',    extra: 'UNIQUE' },
    { name: 'created_at',   type: 'TIMESTAMP',     extra: 'NOT NULL, DEFAULT CURRENT_TIMESTAMP' },
  ],
  payment_methods: [
    { name: 'id',         type: 'BIGINT',       extra: 'PK, AUTO_INCREMENT' },
    { name: 'user_id',    type: 'BIGINT',       extra: 'FK → users.id, NOT NULL' },
    { name: 'type',       type: "ENUM('card','bank')", extra: 'NOT NULL' },
    { name: 'provider',   type: 'VARCHAR(50)',  extra: 'NOT NULL' },
    { name: 'token',      type: 'VARCHAR(255)', extra: 'NOT NULL' },
    { name: 'is_default', type: 'TINYINT(1)',   extra: 'NOT NULL, DEFAULT 0' },
    { name: 'created_at', type: 'TIMESTAMP',    extra: 'NOT NULL, DEFAULT CURRENT_TIMESTAMP' },
  ],
  banks: [
    { name: 'id',             type: 'BIGINT',      extra: 'PK, AUTO_INCREMENT' },
    { name: 'bank_id',        type: 'VARCHAR(20)', extra: 'UNIQUE, NOT NULL' },
    { name: 'name',           type: 'VARCHAR(100)',extra: 'NOT NULL' },
    { name: 'country',        type: 'CHAR(2)',     extra: 'NOT NULL' },
    { name: 'is_active',      type: 'TINYINT(1)', extra: 'NOT NULL, DEFAULT 1' },
    { name: 'routing_number', type: 'VARCHAR(20)', extra: '' },
  ],
  ledger_entries: [
    { name: 'id',              type: 'BIGINT',        extra: 'PK, AUTO_INCREMENT' },
    { name: 'account_id',      type: 'BIGINT',        extra: 'FK → accounts.id' },
    { name: 'transaction_id',  type: 'BIGINT',        extra: 'FK → transactions.id' },
    { name: 'debit',           type: 'DECIMAL(20,4)', extra: 'NOT NULL, DEFAULT 0' },
    { name: 'credit',          type: 'DECIMAL(20,4)', extra: 'NOT NULL, DEFAULT 0' },
    { name: 'balance_after',   type: 'DECIMAL(20,4)', extra: 'NOT NULL' },
    { name: 'created_at',      type: 'TIMESTAMP',     extra: 'NOT NULL' },
  ],
  orders: [
    { name: 'id',          type: 'BIGINT',        extra: 'PK, AUTO_INCREMENT' },
    { name: 'customer_id', type: 'BIGINT',        extra: 'FK → customers.id, NOT NULL' },
    { name: 'status',      type: "ENUM('pending','confirmed','shipped','delivered','cancelled')", extra: 'NOT NULL, DEFAULT pending' },
    { name: 'total',       type: 'DECIMAL(10,2)', extra: 'NOT NULL' },
    { name: 'created_at',  type: 'TIMESTAMP',     extra: 'NOT NULL, DEFAULT CURRENT_TIMESTAMP' },
  ],
  order_items: [
    { name: 'id',         type: 'BIGINT',        extra: 'PK, AUTO_INCREMENT' },
    { name: 'order_id',   type: 'BIGINT',        extra: 'FK → orders.id, NOT NULL' },
    { name: 'product_id', type: 'BIGINT',        extra: 'FK → products.id, NOT NULL' },
    { name: 'quantity',   type: 'INT',           extra: 'NOT NULL, DEFAULT 1' },
    { name: 'unit_price', type: 'DECIMAL(10,2)', extra: 'NOT NULL' },
  ],
  products: [
    { name: 'id',          type: 'BIGINT',        extra: 'PK, AUTO_INCREMENT' },
    { name: 'sku',         type: 'VARCHAR(50)',   extra: 'UNIQUE, NOT NULL' },
    { name: 'name',        type: 'VARCHAR(200)',  extra: 'NOT NULL' },
    { name: 'price',       type: 'DECIMAL(10,2)', extra: 'NOT NULL' },
    { name: 'stock',       type: 'INT',           extra: 'NOT NULL, DEFAULT 0' },
    { name: 'created_at',  type: 'TIMESTAMP',     extra: 'NOT NULL' },
  ],
  inventory: [
    { name: 'id',           type: 'BIGINT',  extra: 'PK, AUTO_INCREMENT' },
    { name: 'product_id',   type: 'BIGINT',  extra: 'FK → products.id' },
    { name: 'warehouse_id', type: 'INT',     extra: 'NOT NULL' },
    { name: 'quantity',     type: 'INT',     extra: 'NOT NULL, DEFAULT 0' },
    { name: 'updated_at',   type: 'TIMESTAMP', extra: 'NOT NULL' },
  ],
  customers: [
    { name: 'id',         type: 'BIGINT',      extra: 'PK, AUTO_INCREMENT' },
    { name: 'email',      type: 'VARCHAR(255)', extra: 'UNIQUE, NOT NULL' },
    { name: 'full_name',  type: 'VARCHAR(100)', extra: 'NOT NULL' },
    { name: 'phone',      type: 'VARCHAR(20)',  extra: '' },
    { name: 'created_at', type: 'TIMESTAMP',   extra: 'NOT NULL' },
  ],
  users: [
    { name: 'id',         type: 'BIGINT',      extra: 'PK, AUTO_INCREMENT' },
    { name: 'email',      type: 'VARCHAR(255)', extra: 'UNIQUE, NOT NULL' },
    { name: 'full_name',  type: 'VARCHAR(100)', extra: 'NOT NULL' },
    { name: 'status',     type: "ENUM('active','suspended')", extra: 'NOT NULL, DEFAULT active' },
    { name: 'created_at', type: 'TIMESTAMP',   extra: 'NOT NULL, DEFAULT CURRENT_TIMESTAMP' },
  ],
  sessions: [
    { name: 'id',         type: 'VARCHAR(64)',  extra: 'PK' },
    { name: 'user_id',    type: 'BIGINT',       extra: 'FK → users.id, NOT NULL' },
    { name: 'ip_address', type: 'VARCHAR(45)',  extra: '' },
    { name: 'user_agent', type: 'TEXT',         extra: '' },
    { name: 'expires_at', type: 'TIMESTAMP',   extra: 'NOT NULL' },
    { name: 'created_at', type: 'TIMESTAMP',   extra: 'NOT NULL' },
  ],
  user_profiles: [
    { name: 'user_id',       type: 'BIGINT',      extra: 'PK, FK → users.id' },
    { name: 'avatar_url',    type: 'VARCHAR(512)', extra: '' },
    { name: 'bio',           type: 'TEXT',        extra: '' },
    { name: 'date_of_birth', type: 'DATE',        extra: '' },
    { name: 'address',       type: 'TEXT',        extra: '' },
    { name: 'updated_at',    type: 'TIMESTAMP',   extra: 'NOT NULL' },
  ],
  kyc_documents: [
    { name: 'id',          type: 'BIGINT',      extra: 'PK, AUTO_INCREMENT' },
    { name: 'user_id',     type: 'BIGINT',      extra: 'FK → users.id, NOT NULL' },
    { name: 'doc_type',    type: "ENUM('nin','bvn','passport','drivers_license')", extra: 'NOT NULL' },
    { name: 'doc_number',  type: 'VARCHAR(50)', extra: 'NOT NULL' },
    { name: 'status',      type: "ENUM('pending','verified','rejected')", extra: 'NOT NULL, DEFAULT pending' },
    { name: 'verified_at', type: 'TIMESTAMP',   extra: '' },
    { name: 'created_at',  type: 'TIMESTAMP',   extra: 'NOT NULL' },
  ],
  user_settings: [
    { name: 'user_id',         type: 'BIGINT',    extra: 'PK, FK → users.id' },
    { name: 'notifications',   type: 'TINYINT(1)',extra: 'DEFAULT 1' },
    { name: 'two_fa_enabled',  type: 'TINYINT(1)',extra: 'DEFAULT 0' },
    { name: 'preferred_lang',  type: 'VARCHAR(5)',extra: 'DEFAULT en' },
    { name: 'updated_at',      type: 'TIMESTAMP', extra: 'NOT NULL' },
  ],
  events: [
    { name: 'id',         type: 'BIGINT',      extra: 'PK, AUTO_INCREMENT' },
    { name: 'user_id',    type: 'BIGINT',      extra: 'INDEX' },
    { name: 'event_name', type: 'VARCHAR(100)', extra: 'NOT NULL' },
    { name: 'properties', type: 'JSON',        extra: '' },
    { name: 'occurred_at',type: 'TIMESTAMP',   extra: 'NOT NULL' },
  ],
  metrics_rollup: [
    { name: 'id',          type: 'BIGINT',        extra: 'PK, AUTO_INCREMENT' },
    { name: 'metric_name', type: 'VARCHAR(100)',  extra: 'NOT NULL' },
    { name: 'period',      type: "ENUM('1m','5m','1h','1d')", extra: 'NOT NULL' },
    { name: 'value',       type: 'DECIMAL(20,4)', extra: 'NOT NULL' },
    { name: 'recorded_at', type: 'TIMESTAMP',    extra: 'NOT NULL' },
  ],
  funnel_steps: [
    { name: 'id',          type: 'BIGINT',      extra: 'PK, AUTO_INCREMENT' },
    { name: 'funnel_name', type: 'VARCHAR(100)', extra: 'NOT NULL' },
    { name: 'step_name',   type: 'VARCHAR(100)', extra: 'NOT NULL' },
    { name: 'user_count',  type: 'INT',         extra: 'NOT NULL' },
    { name: 'period_date', type: 'DATE',        extra: 'NOT NULL' },
  ],
  cohorts: [
    { name: 'id',           type: 'BIGINT',      extra: 'PK, AUTO_INCREMENT' },
    { name: 'cohort_date',  type: 'DATE',        extra: 'NOT NULL' },
    { name: 'size',         type: 'INT',         extra: 'NOT NULL' },
    { name: 'retained_d7',  type: 'INT',         extra: '' },
    { name: 'retained_d30', type: 'INT',         extra: '' },
  ],
}

// ─── Sample data rows ─────────────────────────────────────────────────────────

type Row = Record<string, string | number>

const SAMPLE_ACCOUNTS: Row[] = [
  { id: 1, user_id: 101, balance: '125000.0000', currency: 'NGN', status: 'active',   created_at: '2024-01-15 09:23:11' },
  { id: 2, user_id: 102, balance: '450.0000',    currency: 'USD', status: 'active',   created_at: '2024-02-03 14:07:44' },
  { id: 3, user_id: 103, balance: '98750.5000',  currency: 'NGN', status: 'frozen',   created_at: '2024-02-20 08:15:30' },
  { id: 4, user_id: 104, balance: '0.0000',      currency: 'NGN', status: 'closed',   created_at: '2023-11-01 11:00:00' },
  { id: 5, user_id: 105, balance: '3200000.0000',currency: 'NGN', status: 'active',   created_at: '2024-03-10 16:45:22' },
]

const SAMPLE_TRANSACTIONS: Row[] = [
  { id: 1001, account_id: 1, amount: '5000.0000',   type: 'debit',  status: 'settled', reference_id: 'TXN-A1B2C3',   created_at: '2026-03-31 08:01:05' },
  { id: 1002, account_id: 2, amount: '125.0000',    type: 'credit', status: 'settled', reference_id: 'TXN-D4E5F6',   created_at: '2026-03-31 08:05:18' },
  { id: 1003, account_id: 1, amount: '50000.0000',  type: 'debit',  status: 'failed',  reference_id: 'TXN-G7H8I9',   created_at: '2026-03-31 08:12:44' },
  { id: 1004, account_id: 3, amount: '1500.0000',   type: 'debit',  status: 'pending', reference_id: 'TXN-J0K1L2',   created_at: '2026-03-31 08:22:09' },
  { id: 1005, account_id: 5, amount: '250000.0000', type: 'debit',  status: 'settled', reference_id: 'TXN-M3N4O5',   created_at: '2026-03-31 08:30:55' },
  { id: 1006, account_id: 2, amount: '75.5000',     type: 'credit', status: 'settled', reference_id: 'TXN-P6Q7R8',   created_at: '2026-03-31 08:41:02' },
  { id: 1007, account_id: 1, amount: '10000.0000',  type: 'debit',  status: 'failed',  reference_id: 'TXN-S9T0U1',   created_at: '2026-03-31 08:55:33' },
  { id: 1008, account_id: 4, amount: '3200.0000',   type: 'credit', status: 'settled', reference_id: 'TXN-V2W3X4',   created_at: '2026-03-31 09:03:17' },
  { id: 1009, account_id: 3, amount: '800.0000',    type: 'debit',  status: 'failed',  reference_id: 'TXN-Y5Z6A7',   created_at: '2026-03-31 09:14:50' },
  { id: 1010, account_id: 5, amount: '15000.0000',  type: 'debit',  status: 'pending', reference_id: 'TXN-B8C9D0',   created_at: '2026-03-31 09:20:07' },
]

const SAMPLE_ORDERS: Row[] = [
  { id: 5001, customer_id: 201, status: 'delivered',  total: '12500.00', created_at: '2026-03-29 10:11:00' },
  { id: 5002, customer_id: 202, status: 'shipped',    total: '4350.00',  created_at: '2026-03-30 09:05:22' },
  { id: 5003, customer_id: 203, status: 'pending',    total: '780.50',   created_at: '2026-03-31 07:45:33' },
  { id: 5004, customer_id: 204, status: 'cancelled',  total: '2200.00',  created_at: '2026-03-31 08:30:41' },
  { id: 5005, customer_id: 205, status: 'confirmed',  total: '95000.00', created_at: '2026-03-31 09:00:15' },
]

// ─── Query execution engine ───────────────────────────────────────────────────

interface QueryResult {
  columns: string[]
  rows: Row[]
  rowCount: number
  execTimeMs: number
  isError: boolean
  errorMessage?: string
}

function hasDownService(systemState: SystemState | null): boolean {
  if (!systemState) return false
  return Object.values(systemState.services).some(s => s.status === 'down')
}

function hasDownDB(systemState: SystemState | null): boolean {
  if (!systemState) return false
  return systemState.infrastructure.databases.some(d => d.status === 'down')
}

function describeTable(tableName: string): QueryResult {
  const schema = TABLE_SCHEMAS[tableName]
  if (!schema) {
    return {
      columns: [], rows: [], rowCount: 0, execTimeMs: 1, isError: true,
      errorMessage: `ERROR 1146 (42S02): Table '${tableName}' doesn't exist`,
    }
  }
  return {
    columns: ['Field', 'Type', 'Extra'],
    rows: schema.map(c => ({ Field: c.name, Type: c.type, Extra: c.extra })),
    rowCount: schema.length,
    execTimeMs: Math.floor(Math.random() * 4) + 1,
    isError: false,
  }
}

function showTables(db: string): QueryResult {
  const tables = DB_TREE[db] ?? Object.values(DB_TREE).flat()
  return {
    columns: [`Tables_in_${db}`],
    rows: tables.map(t => ({ [`Tables_in_${db}`]: t })),
    rowCount: tables.length,
    execTimeMs: Math.floor(Math.random() * 3) + 1,
    isError: false,
  }
}

function showDatabases(): QueryResult {
  const dbs = Object.keys(DB_TREE)
  return {
    columns: ['Database'],
    rows: dbs.map(d => ({ Database: d })),
    rowCount: dbs.length,
    execTimeMs: 1,
    isError: false,
  }
}

function makeError(msg: string): QueryResult {
  return { columns: [], rows: [], rowCount: 0, execTimeMs: 1, isError: true, errorMessage: msg }
}

function genericResult(sql: string): QueryResult {
  // extract possible table name
  const m = sql.match(/from\s+(\w+)/i)
  const tbl = m ? m[1] : 'result'
  return {
    columns: ['id', 'value', 'status'],
    rows: [
      { id: 1, value: `row_1_${tbl}`, status: 'ok' },
      { id: 2, value: `row_2_${tbl}`, status: 'ok' },
      { id: 3, value: `row_3_${tbl}`, status: 'ok' },
    ],
    rowCount: 3,
    execTimeMs: Math.floor(Math.random() * 20) + 5,
    isError: false,
  }
}

function executeQuery(sql: string, currentDb: string, systemState: SystemState | null): QueryResult {
  const q = sql.trim()
  const up = q.toUpperCase()
  const execMs = Math.floor(Math.random() * 30) + 5

  // SHOW DATABASES
  if (/^SHOW\s+DATABASES/i.test(q)) return showDatabases()

  // SHOW TABLES
  if (/^SHOW\s+TABLES/i.test(q)) return showTables(currentDb)

  // DESCRIBE / EXPLAIN tablename  (not SELECT ... EXPLAIN)
  const descMatch = q.match(/^(?:DESCRIBE|DESC|EXPLAIN)\s+(\w+)\s*;?\s*$/i)
  if (descMatch) return describeTable(descMatch[1])

  // SELECT / queries
  if (/^SELECT/i.test(q)) {
    const fromMatch = q.match(/FROM\s+(\w+)/i)
    const tableName = fromMatch ? fromMatch[1].toLowerCase() : ''

    if (!tableName) return genericResult(q)

    // Check table exists anywhere
    const allTables = Object.values(DB_TREE).flat()
    if (!allTables.includes(tableName)) {
      return makeError(`ERROR 1146 (42S02): Table '${currentDb}.${tableName}' doesn't exist`)
    }

    switch (tableName) {
      case 'accounts': {
        let rows = [...SAMPLE_ACCOUNTS]
        if (up.includes('WHERE STATUS')) {
          const statusMatch = q.match(/status\s*=\s*'(\w+)'/i)
          if (statusMatch) rows = rows.filter(r => r.status === statusMatch[1])
        }
        if (up.includes('LIMIT')) {
          const lm = q.match(/LIMIT\s+(\d+)/i)
          if (lm) rows = rows.slice(0, parseInt(lm[1]))
        }
        return { columns: Object.keys(SAMPLE_ACCOUNTS[0]), rows, rowCount: rows.length, execTimeMs: execMs, isError: false }
      }

      case 'transactions': {
        if (hasDownService(systemState) && up.includes('PAYMENT_METHODS')) {
          return makeError("ERROR 1146 (42S02): Table 'payments_db.payment_methods' doesn't exist")
        }
        let rows = [...SAMPLE_TRANSACTIONS]
        if (up.includes("STATUS = 'FAILED'") || up.includes("STATUS='FAILED'")) {
          rows = rows.filter(r => r.status === 'failed')
        }
        if (up.includes('ORDER BY CREATED_AT DESC')) rows = [...rows].reverse()
        if (up.includes('LIMIT')) {
          const lm = q.match(/LIMIT\s+(\d+)/i)
          if (lm) rows = rows.slice(0, parseInt(lm[1]))
        }
        return { columns: Object.keys(SAMPLE_TRANSACTIONS[0]), rows, rowCount: rows.length, execTimeMs: execMs, isError: false }
      }

      case 'payment_methods': {
        if (hasDownService(systemState)) {
          return makeError("ERROR 1146 (42S02): Table 'payments_db.payment_methods' doesn't exist")
        }
        const pmRows: Row[] = [
          { id: 1, user_id: 101, type: 'bank',  provider: 'First Bank',   token: 'tok_fb_****2341', is_default: 1, created_at: '2024-01-20 10:00:00' },
          { id: 2, user_id: 102, type: 'card',  provider: 'Zenith Bank',  token: 'tok_zb_****9981', is_default: 1, created_at: '2024-02-14 15:30:00' },
          { id: 3, user_id: 103, type: 'bank',  provider: 'GTBank',       token: 'tok_gt_****5572', is_default: 0, created_at: '2024-03-01 08:20:00' },
        ]
        return { columns: Object.keys(pmRows[0]), rows: pmRows, rowCount: pmRows.length, execTimeMs: execMs, isError: false }
      }

      case 'banks': {
        if (hasDownDB(systemState)) {
          return makeError("ERROR 1054 (42S22): Unknown column 'bank_id' in 'banks'")
        }
        const bankRows: Row[] = [
          { id: 1, bank_id: 'FBNINGLA',  name: 'First Bank of Nigeria',  country: 'NG', is_active: 1, routing_number: '011150111' },
          { id: 2, bank_id: 'ZEIBNGLA',  name: 'Zenith Bank',            country: 'NG', is_active: 1, routing_number: '057150013' },
          { id: 3, bank_id: 'GTBINGLA',  name: 'Guaranty Trust Bank',    country: 'NG', is_active: 1, routing_number: '058152036' },
          { id: 4, bank_id: 'UBININGLA', name: 'United Bank for Africa', country: 'NG', is_active: 1, routing_number: '033153513' },
          { id: 5, bank_id: 'ACCENINGLA',name: 'Access Bank',            country: 'NG', is_active: 1, routing_number: '044150149' },
        ]
        return { columns: Object.keys(bankRows[0]), rows: bankRows, rowCount: bankRows.length, execTimeMs: execMs, isError: false }
      }

      case 'orders': {
        let rows = [...SAMPLE_ORDERS]
        if (up.includes('LIMIT')) {
          const lm = q.match(/LIMIT\s+(\d+)/i)
          if (lm) rows = rows.slice(0, parseInt(lm[1]))
        }
        return { columns: Object.keys(SAMPLE_ORDERS[0]), rows, rowCount: rows.length, execTimeMs: execMs, isError: false }
      }

      case 'users': {
        const userRows: Row[] = [
          { id: 101, email: 'ade.okafor@example.ng',   full_name: 'Adebayo Okafor',    status: 'active',    created_at: '2024-01-10 09:00:00' },
          { id: 102, email: 'chioma.nwosu@example.ng', full_name: 'Chioma Nwosu',       status: 'active',    created_at: '2024-02-01 11:30:00' },
          { id: 103, email: 'emeka.ibrahim@example.ng',full_name: 'Emeka Ibrahim',      status: 'suspended', created_at: '2024-02-18 14:00:00' },
          { id: 104, email: 'ngozi.dike@example.ng',   full_name: 'Ngozi Dike',         status: 'active',    created_at: '2023-10-22 08:45:00' },
          { id: 105, email: 'taiwo.adesanya@example.ng',full_name: 'Taiwo Adesanya',   status: 'active',    created_at: '2024-03-05 16:00:00' },
        ]
        return { columns: Object.keys(userRows[0]), rows: userRows, rowCount: userRows.length, execTimeMs: execMs, isError: false }
      }

      default:
        return genericResult(q)
    }
  }

  // INSERT / UPDATE / DELETE — simulate row-affected style
  if (/^(INSERT|UPDATE|DELETE)/i.test(q)) {
    const affected = Math.floor(Math.random() * 5) + 1
    return {
      columns: ['Affected rows'],
      rows: [{ 'Affected rows': affected }],
      rowCount: affected,
      execTimeMs: Math.floor(Math.random() * 15) + 8,
      isError: false,
    }
  }

  return genericResult(q)
}

// ─── Query Plan ───────────────────────────────────────────────────────────────

function buildQueryPlan(sql: string): string {
  const m = sql.match(/FROM\s+(\w+)/i)
  const tbl = m ? m[1] : 'result'
  return [
    '+----+-------------+' + '-'.repeat(tbl.length + 2) + '+------------+------+',
    `| id | select_type | table${' '.repeat(tbl.length - 4)} | type       | rows |`,
    '+----+-------------+' + '-'.repeat(tbl.length + 2) + '+------------+------+',
    `|  1 | SIMPLE      | ${tbl}${' '.repeat(6 - Math.min(tbl.length, 6))} | ALL        | 2847 |`,
    '+----+-------------+' + '-'.repeat(tbl.length + 2) + '+------------+------+',
    '1 row in set (0.02 sec)',
  ].join('\n')
}

// ─── Quick shortcuts ──────────────────────────────────────────────────────────

const QUICK_QUERIES = [
  { label: 'Recent transactions', sql: 'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;' },
  { label: 'Failed payments',     sql: "SELECT * FROM transactions WHERE status = 'failed' ORDER BY created_at DESC LIMIT 20;" },
  { label: 'Show tables',         sql: 'SHOW TABLES;' },
  { label: 'Check schema',        sql: 'DESCRIBE accounts;' },
  { label: 'Active accounts',     sql: "SELECT * FROM accounts WHERE status = 'active';" },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function DBConsole({ systemState }: DBConsoleProps) {
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set(['payments_db']))
  const [currentDb, setCurrentDb] = useState('payments_db')
  const [selectedTable, setSelectedTable] = useState<string | null>('accounts')
  const [query, setQuery] = useState('SELECT * FROM accounts LIMIT 10;')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [activeTab, setActiveTab] = useState<'results' | 'plan'>('results')
  const [isRunning, setIsRunning] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const runQuery = useCallback(() => {
    if (!query.trim()) return
    setIsRunning(true)
    // Simulate a brief async execution
    const start = performance.now()
    setTimeout(() => {
      const res = executeQuery(query, currentDb, systemState)
      // override execTimeMs with real elapsed if > sim value
      res.execTimeMs = Math.max(res.execTimeMs, Math.round(performance.now() - start))
      setResult(res)
      setActiveTab('results')
      setIsRunning(false)
    }, 80 + Math.random() * 120)
  }, [query, currentDb, systemState])

  // Ctrl+Enter to run
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        runQuery()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [runQuery])

  function toggleDb(db: string) {
    setExpandedDbs(prev => {
      const next = new Set(prev)
      if (next.has(db)) next.delete(db)
      else next.add(db)
      return next
    })
  }

  function selectTable(db: string, table: string) {
    setCurrentDb(db)
    setSelectedTable(table)
    setQuery(`SELECT * FROM ${table} LIMIT 10;`)
  }

  function applyQuickQuery(sql: string) {
    setQuery(sql)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const schemaColumns = selectedTable ? TABLE_SCHEMAS[selectedTable] ?? [] : []
  const queryPlanText = result && !result.isError ? buildQueryPlan(query) : ''

  return (
    <div className="flex h-full bg-[#0d1117] text-[#e6edf3] font-mono text-xs overflow-hidden">

      {/* ── Left sidebar: DB tree ── */}
      <aside className="w-[200px] flex-shrink-0 bg-[#161b22] border-r border-[#30363d] flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-[#30363d] bg-[#0d1117]">
          <span className="text-[10px] text-[#8b949e] uppercase tracking-widest font-bold">Databases</span>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {Object.entries(DB_TREE).map(([db, tables]) => {
            const isExpanded = expandedDbs.has(db)
            const isActive = currentDb === db
            return (
              <div key={db}>
                <button
                  onClick={() => { toggleDb(db); setCurrentDb(db) }}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-1.5 hover:bg-[#21262d] transition-colors ${isActive ? 'text-[#58a6ff]' : 'text-[#c9d1d9]'}`}
                >
                  <span className="text-[9px] text-[#8b949e]">{isExpanded ? '▼' : '▶'}</span>
                  <span className="text-[10px] truncate">{db}</span>
                </button>
                {isExpanded && (
                  <div className="ml-3 border-l border-[#30363d]">
                    {tables.map(table => (
                      <button
                        key={table}
                        onClick={() => selectTable(db, table)}
                        className={`w-full text-left px-3 py-1 text-[10px] hover:bg-[#21262d] transition-colors flex items-center gap-1.5 ${selectedTable === table && currentDb === db ? 'text-[#3fb950] bg-[#0f2a1a]' : 'text-[#8b949e]'}`}
                      >
                        <span className="text-[8px] opacity-60">⊞</span>
                        <span className="truncate">{table}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Active DB indicator */}
        <div className="px-3 py-2 border-t border-[#30363d] text-[9px] text-[#8b949e]">
          <span className="text-[#58a6ff]">{currentDb}</span>
        </div>
      </aside>

      {/* ── Center: Editor + Results ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Quick queries bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#30363d] bg-[#161b22] flex-wrap">
          <span className="text-[9px] text-[#8b949e] mr-1">Quick:</span>
          {QUICK_QUERIES.map(qq => (
            <button
              key={qq.label}
              onClick={() => applyQuickQuery(qq.sql)}
              className="px-2 py-0.5 text-[9px] bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded hover:bg-[#30363d] hover:text-[#58a6ff] transition-colors"
            >
              {qq.label}
            </button>
          ))}
        </div>

        {/* Query editor */}
        <div className="relative bg-[#0d1117] border-b border-[#30363d]">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            rows={5}
            spellCheck={false}
            className="w-full bg-transparent text-[#e6edf3] text-xs font-mono p-3 resize-none outline-none leading-5 placeholder-[#484f58]"
            placeholder="-- Enter SQL query here (Ctrl+Enter to run)"
            style={{ caretColor: '#58a6ff' }}
          />
          {/* Run button */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#30363d] bg-[#161b22]">
            <span className="text-[9px] text-[#484f58]">Ctrl+Enter to run</span>
            <button
              onClick={runQuery}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-[10px] font-bold rounded transition-colors"
            >
              {isRunning ? (
                <span className="inline-block w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>▶</span>
              )}
              Run Query
            </button>
          </div>
        </div>

        {/* Results area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#30363d] bg-[#161b22]">
            {(['results', 'plan'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-[10px] font-bold transition-colors border-b-2 ${activeTab === tab ? 'text-[#58a6ff] border-[#58a6ff]' : 'text-[#8b949e] border-transparent hover:text-[#c9d1d9]'}`}
              >
                {tab === 'results' ? 'Results' : 'Query Plan'}
              </button>
            ))}
            {result && (
              <div className="ml-auto flex items-center px-3 gap-3 text-[9px] text-[#8b949e]">
                {!result.isError && (
                  <span>{result.rowCount} {result.rowCount === 1 ? 'row' : 'rows'}</span>
                )}
                <span>{result.execTimeMs} ms</span>
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto">
            {!result && (
              <div className="flex items-center justify-center h-32 text-[#484f58] text-[11px]">
                No results yet — run a query above
              </div>
            )}

            {result && activeTab === 'results' && (
              <>
                {result.isError ? (
                  <div className="p-4 text-[#f85149] text-xs leading-relaxed whitespace-pre-wrap">
                    {result.errorMessage}
                  </div>
                ) : result.rows.length === 0 ? (
                  <div className="p-4 text-[#8b949e] text-xs">Empty set (0 rows)</div>
                ) : (
                  <table className="w-full text-[10px] border-collapse min-w-max">
                    <thead>
                      <tr className="bg-[#161b22] border-b border-[#30363d] sticky top-0 z-10">
                        {result.columns.map(col => (
                          <th key={col} className="px-3 py-2 text-left text-[#8b949e] font-bold whitespace-nowrap border-r border-[#30363d] last:border-r-0">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-b border-[#21262d] hover:bg-[#21262d] transition-colors ${i % 2 === 0 ? 'bg-[#0d1117]' : 'bg-[#161b22]'}`}
                        >
                          {result.columns.map(col => {
                            const val = row[col]
                            const isStatus = col === 'status'
                            const statusColors: Record<string, string> = {
                              active: 'text-[#3fb950]', healthy: 'text-[#3fb950]', settled: 'text-[#3fb950]',
                              delivered: 'text-[#3fb950]', confirmed: 'text-[#3fb950]',
                              failed: 'text-[#f85149]', frozen: 'text-[#f85149]', closed: 'text-[#f85149]',
                              cancelled: 'text-[#f85149]', suspended: 'text-[#f85149]',
                              pending: 'text-[#d29922]', degraded: 'text-[#d29922]',
                              shipped: 'text-[#58a6ff]', credit: 'text-[#3fb950]', debit: 'text-[#f85149]',
                            }
                            const colorClass = isStatus && typeof val === 'string' ? statusColors[val] ?? '' : ''
                            return (
                              <td key={col} className={`px-3 py-1.5 whitespace-nowrap border-r border-[#21262d] last:border-r-0 ${colorClass}`}>
                                {val === null || val === undefined ? <span className="text-[#484f58] italic">NULL</span> : String(val)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {result && activeTab === 'plan' && (
              <div className="p-4">
                {result.isError ? (
                  <div className="text-[#f85149] text-xs">{result.errorMessage}</div>
                ) : (
                  <pre className="text-[11px] text-[#8b949e] leading-relaxed whitespace-pre">{queryPlanText}</pre>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Right panel: Schema inspector ── */}
      <aside className="w-[240px] flex-shrink-0 bg-[#161b22] border-l border-[#30363d] flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-[#30363d] bg-[#0d1117]">
          <span className="text-[10px] text-[#8b949e] uppercase tracking-widest font-bold">Schema</span>
          {selectedTable && (
            <div className="mt-0.5 text-[10px] text-[#58a6ff] truncate">{selectedTable}</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selectedTable ? (
            <div className="p-3 text-[9px] text-[#484f58]">Click a table to inspect its schema</div>
          ) : schemaColumns.length === 0 ? (
            <div className="p-3 text-[9px] text-[#484f58]">No schema defined</div>
          ) : (
            <div className="divide-y divide-[#21262d]">
              {schemaColumns.map((col, i) => (
                <div key={i} className="px-3 py-2 hover:bg-[#21262d] transition-colors">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] text-[#e6edf3] font-bold truncate">{col.name}</span>
                    {col.extra.includes('PK') && (
                      <span className="text-[8px] px-1 py-0 bg-[#2a1e00] text-[#d29922] border border-[#d29922] rounded flex-shrink-0">PK</span>
                    )}
                    {col.extra.includes('FK') && !col.extra.includes('PK') && (
                      <span className="text-[8px] px-1 py-0 bg-[#0a1a2a] text-[#58a6ff] border border-[#58a6ff] rounded flex-shrink-0">FK</span>
                    )}
                  </div>
                  <div className="text-[9px] text-[#3fb950]">{col.type}</div>
                  {col.extra && (
                    <div className="text-[8px] text-[#484f58] leading-tight mt-0.5 break-words">{col.extra}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connection info footer */}
        <div className="px-3 py-2 border-t border-[#30363d] text-[9px] text-[#484f58] space-y-0.5">
          <div className="flex justify-between">
            <span>Host</span>
            <span className="text-[#8b949e]">mysql-primary:3306</span>
          </div>
          <div className="flex justify-between">
            <span>DB</span>
            <span className="text-[#58a6ff]">{currentDb}</span>
          </div>
          <div className="flex justify-between">
            <span>User</span>
            <span className="text-[#8b949e]">readonly</span>
          </div>
          {systemState && (
            <div className="flex justify-between pt-0.5">
              <span>Incidents</span>
              <span className={systemState.active_incidents.length > 0 ? 'text-[#f85149]' : 'text-[#3fb950]'}>
                {systemState.active_incidents.length > 0 ? `${systemState.active_incidents.length} active` : 'none'}
              </span>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
