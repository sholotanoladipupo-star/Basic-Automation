import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
const GCP_NAV = [
    { id: 'gke', icon: '☸', label: 'Kubernetes Engine' },
    { id: 'cloudsql', icon: '🗄', label: 'Cloud SQL' },
    { id: 'logging', icon: '📋', label: 'Cloud Logging' },
    { id: 'iam', icon: '🔑', label: 'IAM & Admin' },
];
const STATIC_SERVICES = [
    { name: 'api-gateway', status: 'healthy', error_rate: 0.001, p99_latency_ms: 8 },
    { name: 'auth-service', status: 'healthy', error_rate: 0.002, p99_latency_ms: 12 },
    { name: 'user-service', status: 'healthy', error_rate: 0.001, p99_latency_ms: 15 },
    { name: 'notification-service', status: 'healthy', error_rate: 0.003, p99_latency_ms: 22 },
    { name: 'fraud-detection', status: 'healthy', error_rate: 0.001, p99_latency_ms: 45 },
    { name: 'order-service', status: 'healthy', error_rate: 0.002, p99_latency_ms: 18 },
    { name: 'inventory-service', status: 'healthy', error_rate: 0.001, p99_latency_ms: 11 },
    { name: 'analytics-service', status: 'healthy', error_rate: 0.004, p99_latency_ms: 35 },
    { name: 'kyc-service', status: 'healthy', error_rate: 0.001, p99_latency_ms: 28 },
    { name: 'config-service', status: 'healthy', error_rate: 0.0, p99_latency_ms: 4 },
];
const LEVEL_COLOR = {
    INFO: '#6b7280', DEBUG: '#484f58', WARN: '#d29922', ERROR: '#f85149', FATAL: '#f85149',
};
function podStatus(podIdx, current, desired, isScaling) {
    if (!isScaling)
        return podIdx < current ? 'Running' : 'Terminated';
    if (podIdx < desired && podIdx >= current)
        return 'ContainerCreating'; // scaling up
    if (podIdx >= desired && podIdx < current)
        return 'Terminating'; // scaling down
    return podIdx < current ? 'Running' : 'Terminated';
}
function StatusChip({ status }) {
    const c = status === 'Running' || status === 'healthy' || status === 'RUNNING'
        ? 'bg-[#0f2a1a] text-[#3fb950] border-[#3fb950]'
        : status === 'Terminating'
            ? 'bg-[#2a1e00] text-[#d29922] border-[#d29922]'
            : status === 'ContainerCreating'
                ? 'bg-[#0a1a2a] text-[#58a6ff] border-[#58a6ff]'
                : status === 'down' || status === 'ERROR'
                    ? 'bg-[#2a0a0a] text-[#f85149] border-[#f85149]'
                    : 'bg-[#2a1e00] text-[#d29922] border-[#d29922]';
    const label = status === 'healthy' ? 'RUNNING'
        : status === 'down' ? 'ERROR'
            : status === 'degraded' ? 'DEGRADED'
                : status.toUpperCase();
    return _jsx("span", { className: `text-[9px] font-bold px-1.5 py-0.5 rounded border ${c}`, children: label });
}
// --- Log generation ---
const LOG_MSGS = {
    INFO: [
        `GET /api/v1/health 200 OK 3ms`, `POST /api/v1/transactions 201 Created 18ms`,
        `Processed 847 events in batch`, `Cache hit ratio: 94.2%`,
        `DB connection pool: 12/100 active`, `Heartbeat OK — upstream services reachable`,
        `Metrics flushed to Prometheus endpoint`, `Config reload completed — 0 changes detected`,
        `JWT validated for user_id=usr_48291 (1ms)`, `GET /api/v2/accounts/bal 200 OK 7ms`,
        `Kafka consumer lag: 0 — partition 3 fully caught up`, `S3 presigned URL generated for upload_id=f9a2c`,
        `gRPC call to payment-processor:50051 OK (22ms)`, `Rate limit check: 840/1000 tokens used`,
        `Trace exported to Cloud Trace — spans=14`, `Serving request from cache: /feed 200 (0ms)`,
        `Session renewed for user_id=usr_77231 — TTL reset to 3600s`, `Health check /readyz returned 200 in 1ms`,
        `Distributed lock acquired: lock:checkout:ord_9123 (TTL=30s)`, `Batch job completed: 2048 records processed in 1.2s`,
        `Outgoing webhook delivered to partner_id=ptnr_442 — 200 OK`, `Feature flag 'new_checkout_flow' = true for user_id=usr_11029`,
        `Auto-scaling: 2→3 replicas triggered (CPU 72%)`, `Config value refreshed: payment.retry_limit = 3`,
    ],
    DEBUG: [
        `Entering handler: TransactionController.create`, `SQL query executed: SELECT * FROM accounts WHERE id=$1 [3ms]`,
        `Cache key lookup: session:usr_48291 → HIT`, `gRPC interceptor: req_id=74f2b9`,
        `Span started: checkout.process_payment`, `Rate limiter bucket: 850/1000 tokens remaining`,
        `Health check: /readyz returned 200 in 1ms`, `Middleware chain: auth → ratelimit → handler (total 4ms)`,
        `DB pool checkout: conn_id=84 leased (pool free: 88/100)`, `Serializing response: 1.2KB JSON`,
        `Cache write: key=user:profile:usr_48291 TTL=300s`, `Tracing: child span created span_id=9f3a2b`,
        `gRPC dial to redis-service:6379 established`, `Feature flag evaluated: rollout=22% → user in`,
        `Request ID assigned: req_id=a9f2c3d7`, `Unmarshalling body: 384 bytes`,
    ],
    WARN: [
        `Response time p99 exceeded 2000ms (got 3241ms)`, `DB connection pool at 71% capacity (71/100)`,
        `Redis cache miss rate elevated: 28%`, `Memory usage at 73%`,
        `Retry 2/3 for downstream call`, `Slow query detected (>500ms)`,
        `Goroutine count spike: 1820 (threshold: 1500)`, `Circuit breaker half-open — test request sent`,
        `Disk usage at 81% on /var/log`, `Consumer lag growing: partition 2 = 1420 msgs`,
        `Upstream latency high: payment-processor p99=1800ms`, `JWT expiry imminent — refresh token issued`,
        `gRPC deadline approaching: 400ms remaining`, `Retry exhausted — falling back to degraded response`,
        `Connection pool queue depth: 12 waiting`, `Slow GC pause: 140ms (threshold: 100ms)`,
        `TLS cert expiry in 14 days — renewal needed`, `Read replica lag: 480ms (threshold: 300ms)`,
    ],
    ERROR: [
        `upstream connect error or disconnect/reset before headers`, `context deadline exceeded after 5000ms`,
        `failed to acquire distributed lock after 3 retries`, `pq: deadlock detected — rolling back transaction`,
        `EOF on Redis connection — reconnecting`, `gRPC status UNAVAILABLE from payment-processor:50051`,
        `dial tcp: connection refused 10.0.0.5:5432`, `http: panic serving — recovered, 500 returned`,
        `failed to publish to Kafka topic=transactions: leader not available`, `Redis SETEX failed: READONLY — replica lag`,
        `SQL: ERROR 1213 (40001): Deadlock found`, `Webhook delivery failed (502): partner_id=ptnr_442`,
        `goroutine leak detected: 840 goroutines (threshold: 500)`, `OOM: runtime memory allocation failed`,
        `Cloud Storage upload failed: ServiceUnavailable — retry 3/3`, `Response body read error: unexpected EOF`,
    ],
    FATAL: [
        `panic: runtime error: nil pointer dereference`, `connection refused — localhost:5432`,
        `OOMKilled — container exceeded memory limit`, `failed to connect to Redis: connection refused`,
        `unrecoverable error in main goroutine — exiting`, `signal: killed — container OOM`,
        `failed to open DB connection after 5 attempts — shutting down`, `stack overflow in request handler — process dying`,
        `SIGTERM received — graceful shutdown failed after 30s`, `panic: concurrent map write detected`,
    ],
};
function pickLevel(status) {
    const r = Math.random();
    if (status === 'down')
        return r < 0.45 ? 'FATAL' : r < 0.8 ? 'ERROR' : 'WARN';
    if (status === 'degraded')
        return r < 0.25 ? 'ERROR' : r < 0.5 ? 'WARN' : r < 0.72 ? 'INFO' : 'DEBUG';
    return r < 0.42 ? 'INFO' : r < 0.72 ? 'DEBUG' : r < 0.88 ? 'WARN' : r < 0.97 ? 'ERROR' : 'FATAL';
}
function generateSingleLog(service, status) {
    const level = pickLevel(status);
    const pool = LOG_MSGS[level] ?? LOG_MSGS.INFO;
    return {
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        level,
        msg: `[${service}] ${pool[Math.floor(Math.random() * pool.length)]}`,
    };
}
function generateLogs(service, status, minutes) {
    const now = Date.now();
    const count = Math.min(minutes * 12, 200);
    return Array.from({ length: count }, (_, i) => {
        const t = new Date(now - (count - i) * (minutes * 60000 / count));
        const level = pickLevel(status);
        const pool = LOG_MSGS[level] ?? LOG_MSGS.INFO;
        return { time: t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level, msg: `[${service}] ${pool[Math.floor(Math.random() * pool.length)]}` };
    });
}
function generateEvents(svcName, status) {
    const now = Date.now();
    if (status === 'down')
        return [
            { time: new Date(now - 300000).toLocaleTimeString(), type: 'Warning', reason: 'BackOff', msg: `Back-off restarting failed container ${svcName}` },
            { time: new Date(now - 600000).toLocaleTimeString(), type: 'Warning', reason: 'OOMKilling', msg: `Container ${svcName} exceeded memory limit (512Mi)` },
            { time: new Date(now - 900000).toLocaleTimeString(), type: 'Warning', reason: 'Killing', msg: `Stopping container due to liveness probe failure` },
        ];
    if (status === 'degraded')
        return [
            { time: new Date(now - 120000).toLocaleTimeString(), type: 'Warning', reason: 'Unhealthy', msg: `Liveness probe failed: HTTP probe failed statuscode: 503` },
            { time: new Date(now - 240000).toLocaleTimeString(), type: 'Warning', reason: 'Unhealthy', msg: `Readiness probe failed: context deadline exceeded` },
        ];
    return [
        { time: new Date(now - 3600000).toLocaleTimeString(), type: 'Normal', reason: 'Pulled', msg: `Pulled image gcr.io/moniepoint-prod/${svcName}:latest` },
        { time: new Date(now - 3540000).toLocaleTimeString(), type: 'Normal', reason: 'Started', msg: `Started container ${svcName}` },
        { time: new Date(now - 3480000).toLocaleTimeString(), type: 'Normal', reason: 'Scheduled', msg: `Assigned to node gke-node-pool-abc123` },
    ];
}
function LogHistogram({ logs }) {
    const BUCKETS = 10;
    const now = Date.now();
    // Build minute-buckets for last 10 minutes
    const buckets = Array.from({ length: BUCKETS }, (_, i) => {
        const bucketStart = now - (BUCKETS - i) * 60000;
        const bucketEnd = bucketStart + 60000;
        const label = new Date(bucketStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        let errors = 0, warns = 0, infos = 0;
        for (const l of logs) {
            // Parse time HH:MM:SS back to ms (approximate, same day)
            const parts = l.time.split(':').map(Number);
            if (parts.length < 3)
                continue;
            const d = new Date();
            d.setHours(parts[0], parts[1], parts[2], 0);
            const t = d.getTime();
            if (t >= bucketStart && t < bucketEnd) {
                if (l.level === 'ERROR' || l.level === 'FATAL')
                    errors++;
                else if (l.level === 'WARN')
                    warns++;
                else
                    infos++;
            }
        }
        return { label, errors, warns, infos };
    });
    const maxVal = Math.max(1, ...buckets.map(b => b.errors + b.warns + b.infos));
    return (_jsxs("div", { className: "bg-[#1e1f22] border border-[#3c4043] rounded p-3 mb-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2", children: "Log Volume \u2014 Last 10 min" }), _jsx("div", { className: "flex items-end gap-1 h-16", children: buckets.map((b, i) => {
                    const total = b.errors + b.warns + b.infos;
                    const pct = total / maxVal;
                    const errPct = b.errors / Math.max(1, total);
                    const warnPct = b.warns / Math.max(1, total);
                    return (_jsxs("div", { className: "flex-1 flex flex-col justify-end items-stretch gap-0 group relative", title: `${b.label} — ${b.errors} errors, ${b.warns} warns, ${b.infos} info`, children: [_jsxs("div", { style: { height: `${pct * 52}px` }, className: "flex flex-col justify-end overflow-hidden rounded-sm", children: [_jsx("div", { style: { height: `${errPct * 100}%` }, className: "bg-[#f85149] min-h-[1px]" }), _jsx("div", { style: { height: `${warnPct * 100}%` }, className: "bg-[#d29922] min-h-[1px]" }), _jsx("div", { style: { flex: 1 }, className: "bg-[#3fb950]/40 min-h-[1px]" })] }), _jsx("div", { className: "text-[8px] text-[#484f58] text-center mt-0.5 hidden group-hover:block absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-10", children: b.label })] }, i));
                }) }), _jsxs("div", { className: "flex items-center gap-3 mt-2", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("div", { className: "w-2 h-2 rounded-sm bg-[#f85149]" }), _jsx("span", { className: "text-[#9aa0a6] text-[9px]", children: "error/fatal" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("div", { className: "w-2 h-2 rounded-sm bg-[#d29922]" }), _jsx("span", { className: "text-[#9aa0a6] text-[9px]", children: "warn" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("div", { className: "w-2 h-2 rounded-sm bg-[#3fb950]/40" }), _jsx("span", { className: "text-[#9aa0a6] text-[9px]", children: "info/debug" })] })] })] }));
}
function PodView({ podName, status, svcStatus, onBack }) {
    const [logRange, setLogRange] = useState(5);
    const [logFilter, setLogFilter] = useState(null);
    const [pinned, setPinned] = useState(new Set());
    const [streamedLogs, setStreamedLogs] = useState([]);
    const logEndRef = useRef(null);
    const baseLogs = useMemo(() => generateLogs(podName, svcStatus, logRange), [podName, svcStatus, logRange]);
    // Stream a new log line every 3s
    useEffect(() => {
        const iv = setInterval(() => {
            setStreamedLogs(prev => [...prev.slice(-200), generateSingleLog(podName, svcStatus)]);
        }, 3000);
        return () => clearInterval(iv);
    }, [podName, svcStatus]);
    // Auto-scroll to bottom as new logs arrive
    useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [streamedLogs]);
    const allLogs = useMemo(() => [...baseLogs, ...streamedLogs], [baseLogs, streamedLogs]);
    const filtered = logFilter ? allLogs.filter(l => l.level === logFilter) : allLogs;
    const pinnedEntries = [...pinned].map(i => ({ ...allLogs[i], pinIdx: i }));
    const displayed = [
        ...pinnedEntries.map(e => ({ time: '📌', level: e.level, msg: e.msg, origIdx: e.pinIdx })),
        ...filtered.map((l, i) => ({ ...l, origIdx: i })).filter(l => !pinned.has(l.origIdx)),
    ];
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-4 py-2 border-b border-[#3c4043] bg-[#292a2d] flex items-center gap-3 flex-shrink-0", children: [_jsx("button", { onClick: onBack, className: "text-[#8ab4f8] hover:text-[#e8eaed] text-[11px]", children: "\u2190 Pod" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-[#e8eaed] text-sm font-medium font-mono", children: podName }), _jsxs("div", { className: "text-[#9aa0a6] text-[10px]", children: ["Container logs \u00B7 ", _jsx("span", { className: "text-[#3fb950]", children: "\u25CF live" })] })] }), _jsx(StatusChip, { status: status })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-3 space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 mb-1", children: [_jsx("span", { className: "text-[#9aa0a6] text-[10px]", children: "Range:" }), [1, 5, 15, 30, 60].map(m => (_jsx("button", { onClick: () => setLogRange(m), className: `px-2 py-0.5 rounded text-[10px] transition-colors ${logRange === m ? 'bg-[#8ab4f8] text-[#202124] font-bold' : 'bg-[#292a2d] border border-[#3c4043] text-[#9aa0a6]'}`, children: m < 60 ? `${m}m` : '1h' }, m))), _jsx("span", { className: "text-[#9aa0a6] text-[10px] ml-2", children: "Filter:" }), ['INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL'].map(lvl => (_jsx("button", { onClick: () => setLogFilter(logFilter === lvl ? null : lvl), className: `text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${logFilter === lvl ? 'opacity-100' : 'opacity-50'}`, style: { color: LEVEL_COLOR[lvl], borderColor: LEVEL_COLOR[lvl], backgroundColor: logFilter === lvl ? `${LEVEL_COLOR[lvl]}22` : 'transparent' }, children: lvl }, lvl))), pinned.size > 0 && _jsxs("button", { onClick: () => setPinned(new Set()), className: "text-[9px] text-[#484f58] hover:text-[#f85149] ml-auto", children: ["clear ", pinned.size, " pin(s)"] })] }), _jsxs("div", { className: "bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[calc(100vh-200px)] overflow-y-auto", children: [displayed.map((l, i) => (_jsxs("div", { className: `flex gap-2 leading-relaxed group ${l.time === '📌' ? 'bg-[#1a1400] border-l-2 border-[#d29922] pl-1' : ''}`, children: [_jsx("span", { className: "text-[#484f58] flex-shrink-0 w-16", children: l.time }), _jsx("span", { className: "font-bold flex-shrink-0 w-10", style: { color: LEVEL_COLOR[l.level] ?? '#6b7280' }, children: l.level }), _jsx("span", { className: "text-[#e8eaed] break-all flex-1", children: l.msg }), l.time !== '📌' && (_jsx("button", { onClick: () => setPinned(p => { const n = new Set(p); n.has(l.origIdx) ? n.delete(l.origIdx) : n.add(l.origIdx); return n; }), className: "opacity-0 group-hover:opacity-100 text-[#484f58] hover:text-[#d29922] flex-shrink-0 transition-opacity text-[11px]", title: "Pin log line", children: "\uD83D\uDCCC" }))] }, i))), _jsx("div", { ref: logEndRef })] })] })] }));
}
function DeployDetail({ name, status, kind, extraData, scale, podSuffixes, onBack, onScale }) {
    const [tab, setTab] = useState('overview');
    const [logRange, setLogRange] = useState(5);
    const [logFilter, setLogFilter] = useState(null);
    const [pinned, setPinned] = useState(new Set());
    const [streamedLogs, setStreamedLogs] = useState([]);
    const [scaleInput, setScaleInput] = useState(String(scale.desired));
    const [selectedPodIdx, setSelectedPodIdx] = useState(null);
    const logEndRef = useRef(null);
    const baseLogs = useMemo(() => generateLogs(name, status, logRange), [name, status, logRange]);
    useEffect(() => {
        if (tab !== 'logs')
            return;
        const iv = setInterval(() => {
            setStreamedLogs(prev => [...prev.slice(-300), generateSingleLog(name, status)]);
        }, 3000);
        return () => clearInterval(iv);
    }, [tab, name, status]);
    useEffect(() => { if (tab === 'logs')
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [streamedLogs, tab]);
    const allLogs = useMemo(() => [...baseLogs, ...streamedLogs], [baseLogs, streamedLogs]);
    const filtered = logFilter ? allLogs.filter(l => l.level === logFilter) : allLogs;
    const pinnedEntries = [...pinned].map(i => ({ ...allLogs[i], pinIdx: i }));
    const displayed = [
        ...pinnedEntries.map(e => ({ time: '📌', level: e.level, msg: e.msg, origIdx: e.pinIdx })),
        ...filtered.map((l, i) => ({ ...l, origIdx: i })).filter(l => !pinned.has(l.origIdx)),
    ];
    const events = useMemo(() => generateEvents(name, status), [name, status]);
    const cpuReq = kind === 'service' ? '250m' : '100m';
    const memReq = kind === 'service' ? '512Mi' : '256Mi';
    const maxPods = 5;
    const allPodSuffixes = [...podSuffixes, ...Array.from({ length: Math.max(0, maxPods - podSuffixes.length) }, (_, i) => `extra-${i}`)];
    if (selectedPodIdx !== null) {
        const pSuffix = allPodSuffixes[selectedPodIdx] ?? `pod-${selectedPodIdx}`;
        const pStatus = podStatus(selectedPodIdx, scale.current, scale.desired, scale.isScaling);
        return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsx("div", { className: "px-4 py-2 border-b border-[#3c4043] bg-[#292a2d] flex items-center gap-3 flex-shrink-0", children: _jsxs("button", { onClick: () => setSelectedPodIdx(null), className: "text-[#8ab4f8] hover:text-[#e8eaed] text-[11px]", children: ["\u2190 ", name] }) }), _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(PodView, { podName: `${name}-${pSuffix}`, status: pStatus, svcStatus: status, onBack: () => setSelectedPodIdx(null) }) })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-4 py-2 border-b border-[#3c4043] bg-[#292a2d] flex items-center gap-3 flex-shrink-0", children: [_jsx("button", { onClick: onBack, className: "text-[#8ab4f8] hover:text-[#e8eaed] text-[11px]", children: "\u2190 Back" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-[#e8eaed] text-sm font-medium", children: name }), _jsx("div", { className: "text-[#9aa0a6] text-[10px]", children: "Namespace: default \u00B7 Kind: Deployment" })] }), _jsx(StatusChip, { status: status })] }), _jsx("div", { className: "flex border-b border-[#3c4043] bg-[#292a2d] flex-shrink-0", children: ['overview', 'observability', 'events', 'logs'].map(t => (_jsx("button", { onClick: () => setTab(t), className: `px-4 py-2 text-[11px] capitalize border-b-2 transition-colors ${tab === t ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-[#e8eaed]'}`, children: t }, t))) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4", children: [tab === 'overview' && (_jsxs("div", { className: "space-y-3 text-[11px]", children: [_jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2", children: "Scale Deployment" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => { const n = Math.max(0, scale.desired - 1); setScaleInput(String(n)); onScale(n); }, className: "w-7 h-7 rounded border border-[#3c4043] text-[#e8eaed] hover:bg-[#3c4043] flex items-center justify-center font-bold text-base transition-colors", children: "\u2212" }), _jsx("input", { type: "number", min: 0, max: maxPods, value: scaleInput, onChange: e => setScaleInput(e.target.value), onBlur: e => { const n = Math.max(0, Math.min(maxPods, parseInt(e.target.value) || 0)); setScaleInput(String(n)); onScale(n); }, className: "w-12 text-center bg-[#1e1f22] border border-[#3c4043] rounded text-[#e8eaed] py-1 text-[11px]" }), _jsx("button", { onClick: () => { const n = Math.min(maxPods, scale.desired + 1); setScaleInput(String(n)); onScale(n); }, className: "w-7 h-7 rounded border border-[#3c4043] text-[#e8eaed] hover:bg-[#3c4043] flex items-center justify-center font-bold text-base transition-colors", children: "+" })] }), _jsx("span", { className: "text-[#9aa0a6] text-[10px]", children: scale.isScaling ? `scaling → ${scale.desired}…` : `${scale.current}/${scale.desired} replicas` }), _jsx("button", { onClick: () => { onScale(0); setScaleInput('0'); }, className: "ml-auto text-[10px] px-2 py-0.5 rounded border border-[#f85149]/50 text-[#f85149] hover:bg-[#2a0a0a] transition-colors", children: "Scale to 0" })] })] }), _jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2", children: "Deployment Info" }), _jsx("div", { className: "grid grid-cols-2 gap-y-2", children: [['Desired Replicas', `${scale.desired}`], ['Current Replicas', `${scale.current}`], ['Strategy', 'RollingUpdate'], ['CPU Request', cpuReq], ['Memory Request', memReq], ['Cluster', 'moniepoint-prod-gke']].map(([k, v]) => (_jsxs("div", { children: [_jsx("div", { className: "text-[#9aa0a6] text-[10px]", children: k }), _jsx("div", { className: "text-[#e8eaed] font-medium", children: v })] }, k))) })] }), _jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden", children: [_jsx("div", { className: "px-3 py-1.5 bg-[#1e1f22] border-b border-[#3c4043] text-[#9aa0a6] text-[10px] uppercase tracking-widest", children: "Pods \u2014 click to view container logs" }), allPodSuffixes.slice(0, Math.max(scale.desired, scale.current, 1)).map((suffix, i) => {
                                        const ps = podStatus(i, scale.current, scale.desired, scale.isScaling);
                                        const isVisible = i < Math.max(scale.desired, scale.current);
                                        if (!isVisible && scale.desired === 0 && scale.current === 0)
                                            return null;
                                        return (_jsxs("div", { onClick: () => setSelectedPodIdx(i), className: "flex items-center justify-between px-3 py-2 border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/50 cursor-pointer transition-colors", children: [_jsxs("span", { className: "text-[#8ab4f8] font-mono text-[10px]", children: [name, "-", suffix] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[#484f58] text-[10px]", children: "\u2192 logs" }), _jsx(StatusChip, { status: ps })] })] }, i));
                                    }), scale.desired === 0 && scale.current === 0 && (_jsx("div", { className: "px-3 py-3 text-[#484f58] text-[10px] text-center", children: "Scaled to 0 \u2014 no running pods" }))] }), extraData && (_jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2", children: "Service Details" }), _jsx("div", { className: "grid grid-cols-2 gap-y-2", children: Object.entries(extraData).map(([k, v]) => (_jsxs("div", { children: [_jsx("div", { className: "text-[#9aa0a6] text-[10px]", children: k }), _jsx("div", { className: "text-[#e8eaed] font-medium", children: String(v) })] }, k))) })] }))] })), tab === 'observability' && (_jsxs("div", { className: "space-y-3 text-[11px]", children: [_jsx("div", { className: "text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2", children: "CPU & Memory \u2014 Last 30 minutes" }), Array.from({ length: Math.max(scale.current, 1) }, (_, i) => {
                                const cpu = status === 'down' ? 0 : status === 'degraded' ? 78 + i * 5 : 22 + i * 8;
                                const mem = status === 'down' ? 0 : status === 'degraded' ? 81 + i * 3 : 35 + i * 10;
                                const cpuColor = cpu > 80 ? '#f85149' : cpu > 60 ? '#d29922' : '#3fb950';
                                const memColor = mem > 85 ? '#f85149' : mem > 70 ? '#d29922' : '#3fb950';
                                return (_jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsxs("div", { className: "text-[#8ab4f8] mb-2", children: ["Pod ", i + 1] }), [['CPU Usage', cpu, cpuColor], ['Memory Usage', mem, memColor]].map(([label, val, color]) => (_jsxs("div", { className: "mb-2", children: [_jsxs("div", { className: "flex justify-between text-[10px] mb-1", children: [_jsx("span", { className: "text-[#9aa0a6]", children: label }), _jsxs("span", { style: { color: String(color) }, className: "font-bold", children: [val, "%"] })] }), _jsx("div", { className: "w-full bg-[#1e1f22] rounded-full h-1.5", children: _jsx("div", { className: "h-1.5 rounded-full", style: { width: `${val}%`, backgroundColor: String(color) } }) })] }, String(label))))] }, i));
                            })] })), tab === 'events' && (_jsxs("div", { className: "space-y-2 text-[11px]", children: [_jsx("div", { className: "text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2", children: "Kubernetes Events" }), events.map((ev, i) => (_jsxs("div", { className: `border rounded p-2.5 ${ev.type === 'Warning' ? 'border-[#f85149]/40 bg-[#2a0a0a]/40' : 'border-[#3c4043] bg-[#292a2d]'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: `font-bold text-[10px] ${ev.type === 'Warning' ? 'text-[#f85149]' : 'text-[#3fb950]'}`, children: ev.type }), _jsx("span", { className: "text-[#9aa0a6] text-[10px]", children: ev.time })] }), _jsxs("div", { className: "text-[#8ab4f8] mb-0.5", children: ["Reason: ", ev.reason] }), _jsx("div", { className: "text-[#e8eaed]", children: ev.msg })] }, i)))] })), tab === 'logs' && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 mb-1", children: [_jsx("span", { className: "text-[#9aa0a6] text-[10px]", children: "Range:" }), [1, 5, 15, 30, 60].map(m => (_jsx("button", { onClick: () => setLogRange(m), className: `px-2 py-0.5 rounded text-[10px] transition-colors ${logRange === m ? 'bg-[#8ab4f8] text-[#202124] font-bold' : 'bg-[#292a2d] border border-[#3c4043] text-[#9aa0a6]'}`, children: m < 60 ? `${m}m` : '1h' }, m))), _jsx("span", { className: "text-[#9aa0a6] text-[10px] ml-2", children: "Filter:" }), ['INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL'].map(lvl => (_jsx("button", { onClick: () => setLogFilter(logFilter === lvl ? null : lvl), className: `text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all ${logFilter === lvl ? 'opacity-100 scale-105' : 'opacity-50 hover:opacity-80'}`, style: { color: LEVEL_COLOR[lvl], borderColor: LEVEL_COLOR[lvl], backgroundColor: logFilter === lvl ? `${LEVEL_COLOR[lvl]}22` : 'transparent' }, children: lvl }, lvl))), _jsx("span", { className: "text-[#3fb950] text-[9px] ml-1", children: "\u25CF live" }), pinned.size > 0 && _jsxs("button", { onClick: () => setPinned(new Set()), className: "text-[9px] text-[#484f58] hover:text-[#f85149] ml-auto", children: ["clear ", pinned.size, " pin(s)"] })] }), _jsxs("div", { className: "bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[400px] overflow-y-auto", children: [displayed.map((l, i) => (_jsxs("div", { className: `flex gap-2 leading-relaxed group ${l.time === '📌' ? 'bg-[#1a1400] border-l-2 border-[#d29922] pl-1' : ''}`, children: [_jsx("span", { className: "text-[#484f58] flex-shrink-0 w-16", children: l.time }), _jsx("span", { className: "font-bold flex-shrink-0 w-10", style: { color: LEVEL_COLOR[l.level] ?? '#6b7280' }, children: l.level }), _jsx("span", { className: "text-[#e8eaed] break-all flex-1", children: l.msg }), l.time !== '📌' && (_jsx("button", { onClick: () => setPinned(p => { const n = new Set(p); n.has(l.origIdx) ? n.delete(l.origIdx) : n.add(l.origIdx); return n; }), className: "opacity-0 group-hover:opacity-100 text-[#484f58] hover:text-[#d29922] flex-shrink-0 text-[11px] transition-opacity", title: "Pin log line", children: "\uD83D\uDCCC" }))] }, i))), _jsx("div", { ref: logEndRef })] })] }))] })] }));
}
// --- Cloud SQL Panel ---
const SQL_DBS = {
    'payments-db': ['payments_db', 'audit_db', 'reporting_db'],
    'postgres-primary': ['payments_db', 'orders_db', 'users_db'],
    'user-db': ['users_db', 'sessions_db'],
    'orders-db': ['orders_db', 'inventory_db'],
};
const SLOW_QUERIES = [
    { query: 'SELECT * FROM transactions WHERE account_id = ? AND status = ?', avg: '2840ms', calls: 1423, rows: 84200, plan: 'Seq Scan (missing index)' },
    { query: 'UPDATE accounts SET balance = balance - ? WHERE id = ?', avg: '1200ms', calls: 8712, rows: 1, plan: 'Index Scan on accounts_pkey' },
    { query: 'SELECT COUNT(*) FROM payment_methods WHERE user_id IN (SELECT id FROM users WHERE ...)', avg: '3100ms', calls: 412, rows: 1, plan: 'Nested Loop / Hash Join' },
    { query: 'DELETE FROM sessions WHERE expires_at < NOW()', avg: '890ms', calls: 24, rows: 120400, plan: 'Seq Scan on sessions' },
    { query: 'SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 100', avg: '450ms', calls: 5623, rows: 100, plan: 'Sort + Seq Scan (no index on created_at)' },
];
function CloudSQLPanel({ databases }) {
    const [selectedDb, setSelectedDb] = useState(null);
    const [sqlTab, setSqlTab] = useState('overview');
    const db = databases.find(d => d.name === selectedDb) ?? databases[0] ?? null;
    if (!db)
        return (_jsx("div", { className: "p-4 text-[#9aa0a6] text-xs", children: "No Cloud SQL instances found." }));
    const connPct = db.connection_count / db.max_connections;
    const memUsedMb = db.status === 'down' ? 800 : db.status === 'degraded' ? 6800 : 3200;
    const memTotalMb = 8192;
    const memPct = memUsedMb / memTotalMb;
    const diskUsedGb = db.status === 'degraded' ? 180 : 95;
    const diskTotalGb = 500;
    const cpuPct = db.status === 'down' ? 0 : db.status === 'degraded' ? 87 : 32;
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-4 pt-3 pb-0", children: [_jsx("div", { className: "text-[#e8eaed] text-sm font-medium mb-1", children: "Cloud SQL \u2014 Instances" }), _jsx("div", { className: "flex gap-2 mb-3 flex-wrap", children: databases.map(d => (_jsxs("button", { onClick: () => { setSelectedDb(d.name); setSqlTab('overview'); }, className: `px-2.5 py-1 rounded text-[10px] font-mono border transition-colors ${(selectedDb ?? databases[0]?.name) === d.name
                                ? 'bg-[#8ab4f8] text-[#202124] border-[#8ab4f8] font-bold'
                                : 'bg-[#292a2d] border-[#3c4043] text-[#9aa0a6] hover:border-[#8ab4f8]/40'}`, children: [_jsx("span", { className: `mr-1 ${d.status === 'down' ? 'text-[#f85149]' : d.status === 'degraded' ? 'text-[#d29922]' : 'text-[#3fb950]'}`, children: "\u25CF" }), d.name] }, d.name))) }), _jsx("div", { className: "flex border-b border-[#3c4043] mb-0", children: [['overview', 'Overview'], ['databases', 'Databases'], ['queryinsights', 'Query Insights'], ['systeminsights', 'System Insights']].map(([t, l]) => (_jsx("button", { onClick: () => setSqlTab(t), className: `px-3 py-1.5 text-[10px] border-b-2 transition-colors -mb-px ${sqlTab === t ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-[#e8eaed]'}`, children: l }, t))) })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-4", children: [sqlTab === 'overview' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2", children: "Connections" }), _jsxs("div", { className: `text-lg font-bold tabular-nums ${connPct > 0.85 ? 'text-[#f85149]' : connPct > 0.6 ? 'text-[#d29922]' : 'text-[#3fb950]'}`, children: [db.connection_count, " ", _jsxs("span", { className: "text-[#9aa0a6] text-xs font-normal", children: ["/ ", db.max_connections] })] }), _jsx("div", { className: "h-1.5 bg-[#3c4043] rounded mt-2 overflow-hidden", children: _jsx("div", { className: "h-full rounded transition-all", style: { width: `${connPct * 100}%`, background: connPct > 0.85 ? '#f85149' : connPct > 0.6 ? '#d29922' : '#3fb950' } }) }), _jsxs("div", { className: "text-[#9aa0a6] text-[9px] mt-1", children: [(connPct * 100).toFixed(0), "% utilization"] })] }), _jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2", children: "Query p99 Latency" }), _jsx("div", { className: `text-lg font-bold tabular-nums ${db.query_latency_ms > 2000 ? 'text-[#f85149]' : db.query_latency_ms > 500 ? 'text-[#d29922]' : 'text-[#3fb950]'}`, children: db.query_latency_ms === 999999 ? '∞' : `${db.query_latency_ms}ms` }), _jsxs("div", { className: "text-[#9aa0a6] text-[9px] mt-1", children: ["p50: ", Math.round(db.query_latency_ms * 0.4), "ms \u00B7 p95: ", Math.round(db.query_latency_ms * 0.85), "ms"] })] }), _jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2", children: "Memory" }), _jsxs("div", { className: `text-lg font-bold tabular-nums ${memPct > 0.85 ? 'text-[#f85149]' : memPct > 0.7 ? 'text-[#d29922]' : 'text-[#e8eaed]'}`, children: [(memUsedMb / 1024).toFixed(1), " ", _jsxs("span", { className: "text-[#9aa0a6] text-xs font-normal", children: ["GB / ", memTotalMb / 1024, " GB"] })] }), _jsx("div", { className: "h-1.5 bg-[#3c4043] rounded mt-2 overflow-hidden", children: _jsx("div", { className: "h-full rounded transition-all", style: { width: `${memPct * 100}%`, background: memPct > 0.85 ? '#f85149' : memPct > 0.7 ? '#d29922' : '#8ab4f8' } }) }), _jsxs("div", { className: "text-[#9aa0a6] text-[9px] mt-1", children: [(memPct * 100).toFixed(0), "% used"] })] }), _jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2", children: "Storage" }), _jsxs("div", { className: "text-lg font-bold tabular-nums text-[#e8eaed]", children: [diskUsedGb, " ", _jsxs("span", { className: "text-[#9aa0a6] text-xs font-normal", children: ["GB / ", diskTotalGb, " GB"] })] }), _jsx("div", { className: "h-1.5 bg-[#3c4043] rounded mt-2 overflow-hidden", children: _jsx("div", { className: "h-full bg-[#8ab4f8] rounded", style: { width: `${(diskUsedGb / diskTotalGb) * 100}%` } }) }), _jsxs("div", { className: "text-[#9aa0a6] text-[9px] mt-1", children: [((diskUsedGb / diskTotalGb) * 100).toFixed(0), "% used \u00B7 SSD"] })] })] }), _jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3 text-[10px] space-y-1.5", children: [_jsx("div", { className: "text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2", children: "Instance Details" }), [
                                        ['Instance ID', db.name],
                                        ['Database version', 'PostgreSQL 15.4'],
                                        ['Machine type', 'db-custom-4-8192'],
                                        ['Region', 'us-central1-c'],
                                        ['Public IP', 'Disabled'],
                                        ['Private IP', '10.128.0.5'],
                                        ['Maintenance window', 'Sunday 02:00 UTC'],
                                        ['Status', db.status.toUpperCase()],
                                    ].map(([k, v]) => (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-[#9aa0a6]", children: k }), _jsx("span", { className: `font-mono ${k === 'Status' ? (db.status === 'down' ? 'text-[#f85149]' : db.status === 'degraded' ? 'text-[#d29922]' : 'text-[#3fb950]') : 'text-[#e8eaed]'}`, children: v })] }, k)))] })] })), sqlTab === 'databases' && (_jsxs("div", { children: [_jsxs("div", { className: "text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-3", children: ["Databases in ", db.name] }), _jsx("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden", children: _jsxs("table", { className: "w-full text-[10px]", children: [_jsx("thead", { className: "bg-[#1e1f22] border-b border-[#3c4043]", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-2 text-[#9aa0a6] font-normal", children: "Database" }), _jsx("th", { className: "text-left px-3 py-2 text-[#9aa0a6] font-normal", children: "Owner" }), _jsx("th", { className: "text-right px-3 py-2 text-[#9aa0a6] font-normal", children: "Size" }), _jsx("th", { className: "text-right px-3 py-2 text-[#9aa0a6] font-normal", children: "Tables" })] }) }), _jsx("tbody", { children: (SQL_DBS[db.name] ?? ['payments_db', 'audit_db']).map((dbName, i) => (_jsxs("tr", { className: "border-b border-[#3c4043] last:border-0 hover:bg-[#1e1f22]", children: [_jsx("td", { className: "px-3 py-2 text-[#8ab4f8] font-mono", children: dbName }), _jsx("td", { className: "px-3 py-2 text-[#9aa0a6]", children: "postgres" }), _jsxs("td", { className: "px-3 py-2 text-right text-[#e8eaed]", children: [[24, 8, 3, 61, 14][i] ?? 5, " GB"] }), _jsx("td", { className: "px-3 py-2 text-right text-[#e8eaed]", children: [42, 18, 7, 95, 23][i] ?? 12 })] }, i))) })] }) })] })), sqlTab === 'queryinsights' && (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[9px] uppercase tracking-widest", children: "Top Queries by Avg Latency" }), _jsx("span", { className: `text-[9px] font-bold ${db.status !== 'healthy' ? 'text-[#f85149]' : 'text-[#3fb950]'}`, children: db.status !== 'healthy' ? '⚠ Slow queries detected' : '✓ Normal' })] }), _jsx("div", { className: "space-y-2", children: SLOW_QUERIES.map((q, i) => (_jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-2 mb-2", children: [_jsx("code", { className: "text-[#e8eaed] text-[9px] break-all flex-1", children: q.query }), _jsx("span", { className: `text-[9px] font-bold flex-shrink-0 ${parseFloat(q.avg) > 2000 ? 'text-[#f85149]' : parseFloat(q.avg) > 800 ? 'text-[#d29922]' : 'text-[#3fb950]'}`, children: q.avg })] }), _jsxs("div", { className: "flex gap-4 text-[9px] text-[#9aa0a6]", children: [_jsxs("span", { children: ["Calls: ", _jsx("span", { className: "text-[#e8eaed]", children: q.calls.toLocaleString() })] }), _jsxs("span", { children: ["Rows scanned: ", _jsx("span", { className: "text-[#e8eaed]", children: q.rows.toLocaleString() })] }), _jsxs("span", { className: "text-[#d29922] flex-1 truncate", children: ["\u26A1 ", q.plan] })] })] }, i))) })] })), sqlTab === 'systeminsights' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-3", children: "CPU Utilization (last 30m)" }), _jsx("svg", { viewBox: "0 0 300 60", className: "w-full", style: { height: 60 }, children: (() => {
                                            const vals = Array.from({ length: 30 }, (_, i) => {
                                                const base = cpuPct;
                                                return Math.max(0, Math.min(100, base + Math.sin(i * 0.8) * 12 + (Math.random() * 8 - 4)));
                                            });
                                            const pts = vals.map((v, i) => `${(i / 29) * 300},${60 - (v / 100) * 56}`).join(' ');
                                            return (_jsxs(_Fragment, { children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "cpuGrad", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: cpuPct > 80 ? '#f85149' : '#8ab4f8', stopOpacity: "0.3" }), _jsx("stop", { offset: "100%", stopColor: cpuPct > 80 ? '#f85149' : '#8ab4f8', stopOpacity: "0" })] }) }), _jsx("polygon", { points: `0,60 ${pts} 300,60`, fill: "url(#cpuGrad)" }), _jsx("polyline", { points: pts, fill: "none", stroke: cpuPct > 80 ? '#f85149' : '#8ab4f8', strokeWidth: "1.5" })] }));
                                        })() }), _jsxs("div", { className: "flex justify-between text-[8px] text-[#484f58] mt-1", children: [_jsx("span", { children: "-30m" }), _jsx("span", { children: "-20m" }), _jsx("span", { children: "-10m" }), _jsx("span", { children: "now" })] }), _jsxs("div", { className: "text-[#e8eaed] text-xs font-bold mt-1", children: [cpuPct, "% ", _jsx("span", { className: "text-[#9aa0a6] font-normal text-[9px]", children: "avg" })] })] }), _jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-3", children: "Memory Usage (last 30m)" }), _jsx("div", { className: "space-y-1.5 text-[10px]", children: [
                                            { label: 'Total RAM', value: `${memTotalMb / 1024} GB`, bar: 100, color: '#3c4043' },
                                            { label: 'Buffer Pool', value: `${((memUsedMb * 0.6) / 1024).toFixed(1)} GB`, bar: 60, color: '#8ab4f8' },
                                            { label: 'OS Cache', value: `${((memUsedMb * 0.25) / 1024).toFixed(1)} GB`, bar: 25, color: '#3fb950' },
                                            { label: 'WAL Buffers', value: `${((memUsedMb * 0.05) / 1024).toFixed(1)} GB`, bar: 5, color: '#d29922' },
                                            { label: 'Free', value: `${((memTotalMb - memUsedMb) / 1024).toFixed(1)} GB`, bar: ((memTotalMb - memUsedMb) / memTotalMb) * 100, color: '#555' },
                                        ].map(r => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[#9aa0a6] w-24 flex-shrink-0", children: r.label }), _jsx("div", { className: "flex-1 h-2 bg-[#1e1f22] rounded overflow-hidden", children: _jsx("div", { className: "h-full rounded", style: { width: `${r.bar}%`, background: r.color } }) }), _jsx("span", { className: "text-[#e8eaed] w-16 text-right", children: r.value })] }, r.label))) })] }), _jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsx("div", { className: "text-[#9aa0a6] text-[9px] uppercase tracking-widest mb-2", children: "I/O & Locks" }), _jsx("div", { className: "grid grid-cols-3 gap-3 text-[10px]", children: [
                                            { label: 'Read IOPS', value: db.status === 'degraded' ? '4200' : '1100' },
                                            { label: 'Write IOPS', value: db.status === 'degraded' ? '8800' : '2300' },
                                            { label: 'Active Locks', value: db.status === 'degraded' ? '47' : '3' },
                                        ].map(m => (_jsxs("div", { children: [_jsx("div", { className: "text-[#9aa0a6] mb-0.5", children: m.label }), _jsx("span", { className: `font-bold ${parseInt(m.value) > 5000 || m.label === 'Active Locks' && parseInt(m.value) > 10 ? 'text-[#f85149]' : 'text-[#e8eaed]'}`, children: m.value })] }, m.label))) })] })] }))] })] }));
}
// --- Main GCPConsole ---
export default function GCPConsole({ systemState }) {
    const [activeSection, setActiveSection] = useState('gke');
    const [selectedDeploy, setSelectedDeploy] = useState(null);
    const [scaleMap, setScaleMap] = useState({});
    const [globalLogRange, setGlobalLogRange] = useState(15);
    const [globalFilter, setGlobalFilter] = useState(null);
    const dynamicServices = systemState ? Object.values(systemState.services) : [];
    const caches = systemState?.infrastructure.caches ?? [];
    const databases = systemState?.infrastructure.databases ?? [];
    const clusters = systemState?.infrastructure.clusters ?? [];
    const dynamicNames = new Set(dynamicServices.map(s => s.name));
    const allServices = [...dynamicServices, ...STATIC_SERVICES.filter(s => !dynamicNames.has(s.name))];
    // Default scale entry for a service
    function getScale(name, status) {
        if (scaleMap[name])
            return scaleMap[name];
        const def = status === 'down' ? 0 : status === 'degraded' ? 1 : 3;
        return { desired: def, current: def, isScaling: false };
    }
    const handleScale = useCallback((name, targetReplicas) => {
        setScaleMap(prev => {
            const cur = prev[name] ?? { desired: 3, current: 3, isScaling: false };
            if (cur.desired === targetReplicas)
                return prev;
            return { ...prev, [name]: { desired: targetReplicas, current: cur.current, isScaling: true } };
        });
        // Animate current toward desired
        const STEP_MS = 800;
        const stepFn = (steps, direction) => {
            let done = 0;
            const iv = setInterval(() => {
                done++;
                setScaleMap(prev => {
                    const c = prev[name];
                    if (!c) {
                        clearInterval(iv);
                        return prev;
                    }
                    const next = direction === 'up' ? c.current + 1 : c.current - 1;
                    const reached = direction === 'up' ? next >= c.desired : next <= c.desired;
                    if (reached || done >= steps) {
                        clearInterval(iv);
                        return { ...prev, [name]: { ...c, current: c.desired, isScaling: false } };
                    }
                    return { ...prev, [name]: { ...c, current: next } };
                });
            }, STEP_MS);
        };
        setScaleMap(prev => {
            const c = prev[name];
            if (!c)
                return prev;
            const diff = Math.abs(c.current - targetReplicas);
            const dir = targetReplicas > c.current ? 'up' : 'down';
            if (diff > 0)
                setTimeout(() => stepFn(diff, dir), 0);
            return prev;
        });
    }, []);
    // Stable pod suffixes per service name
    const podSuffixes = useCallback((name) => (Array.from({ length: 5 }, (_, i) => {
        const seed = name.charCodeAt(0) * (i + 1) * 31;
        const a = ((seed * 1103515245 + 12345) & 0x7fffffff).toString(36).slice(0, 5);
        const b = ((seed * 22695477 + 1) & 0x7fffffff).toString(36).slice(0, 4);
        return `${a}-${b}`;
    })), []);
    // Global logs
    const [streamedGlobal, setStreamedGlobal] = useState([]);
    const [pinnedGlobalIdx, setPinnedGlobalIdx] = useState(new Set());
    const globalLogEndRef = useRef(null);
    const baseGlobalLogs = useMemo(() => {
        const all = [];
        for (const svc of allServices.slice(0, 12)) {
            const logs = generateLogs(svc.name, svc.status, globalLogRange);
            all.push(...logs.map(l => ({ ...l, svc: svc.name })));
        }
        return all.sort((a, b) => a.time.localeCompare(b.time));
    }, [allServices, globalLogRange]);
    // Stream new global log lines every 2s
    useEffect(() => {
        if (activeSection !== 'logging')
            return;
        const svcList = allServices.slice(0, 12);
        const iv = setInterval(() => {
            const svc = svcList[Math.floor(Math.random() * svcList.length)];
            if (!svc)
                return;
            setStreamedGlobal(prev => [...prev.slice(-500), { ...generateSingleLog(svc.name, svc.status), svc: svc.name }]);
        }, 2000);
        return () => clearInterval(iv);
    }, [activeSection, allServices]);
    // Auto-scroll global log to bottom
    useEffect(() => {
        if (activeSection === 'logging')
            globalLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [streamedGlobal, activeSection]);
    const allGlobalLogs = useMemo(() => [...baseGlobalLogs, ...streamedGlobal], [baseGlobalLogs, streamedGlobal]);
    const filteredGlobal = globalFilter ? allGlobalLogs.filter(l => l.level === globalFilter) : allGlobalLogs;
    const pinnedGlobalEntries = [...pinnedGlobalIdx].map(i => ({ ...allGlobalLogs[i], pinIdx: i }));
    const displayedGlobal = [
        ...pinnedGlobalEntries.map(e => ({ time: '📌', level: e.level, msg: e.msg, svc: e.svc, origIdx: e.pinIdx })),
        ...filteredGlobal.map((l, i) => ({ ...l, origIdx: i })).filter(l => !pinnedGlobalIdx.has(l.origIdx)),
    ];
    if (selectedDeploy) {
        const sc = getScale(selectedDeploy.name, selectedDeploy.status);
        return (_jsx("div", { className: "flex flex-col h-full bg-[#202124] font-mono text-xs text-[#e8eaed] overflow-hidden", children: _jsx(DeployDetail, { name: selectedDeploy.name, status: selectedDeploy.status, kind: selectedDeploy.kind, extraData: selectedDeploy.extra, scale: sc, podSuffixes: podSuffixes(selectedDeploy.name), onBack: () => setSelectedDeploy(null), onScale: (n) => handleScale(selectedDeploy.name, n) }) }));
    }
    return (_jsxs("div", { className: "flex h-full bg-[#202124] font-mono text-xs text-[#e8eaed] overflow-hidden", children: [_jsxs("div", { className: "w-48 bg-[#292a2d] border-r border-[#3c4043] flex flex-col flex-shrink-0", children: [_jsxs("div", { className: "px-3 py-2.5 border-b border-[#3c4043] flex items-center gap-2", children: [_jsx("div", { className: "w-5 h-5 rounded-sm flex items-center justify-center bg-white text-[10px] font-bold", style: { color: '#4285F4' }, children: "G" }), _jsx("span", { className: "text-[#e8eaed] text-[11px] font-medium", children: "Google Cloud" })] }), _jsxs("div", { className: "px-3 py-1.5 border-b border-[#3c4043]", children: [_jsx("div", { className: "text-[#9aa0a6] text-[10px] mb-0.5", children: "Project" }), _jsx("div", { className: "text-[#e8eaed] text-[11px] font-medium truncate", children: "moniepoint-prod" })] }), _jsx("nav", { className: "flex-1 py-1 overflow-y-auto", children: GCP_NAV.map(item => (_jsxs("button", { onClick: () => setActiveSection(item.id), className: `w-full text-left px-3 py-2 flex items-center gap-2.5 text-[11px] transition-colors ${activeSection === item.id ? 'bg-[#1a73e8]/20 text-[#8ab4f8]' : 'text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]'}`, children: [_jsx("span", { children: item.icon }), _jsx("span", { children: item.label })] }, item.id))) })] }), _jsxs("div", { className: "flex-1 overflow-y-auto", children: [activeSection === 'gke' && (_jsxs("div", { className: "p-4 space-y-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[#e8eaed] text-sm font-medium mb-1", children: "Kubernetes Engine \u2014 Workloads" }), _jsx("div", { className: "text-[#9aa0a6] text-[10px] mb-3", children: "Cluster: moniepoint-prod-gke \u00B7 Region: us-central1" })] }), clusters.map(c => (_jsxs("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-[#8ab4f8] font-medium", children: c.name }), _jsx(StatusChip, { status: "RUNNING" })] }), _jsxs("div", { className: "text-[#9aa0a6] text-[10px]", children: ["Nodes: ", c.healthy_nodes, "/", c.nodes, " healthy"] })] }, c.name))), _jsxs("div", { children: [_jsxs("div", { className: "text-[#9aa0a6] text-[10px] uppercase tracking-widest mb-2", children: ["Deployments (", allServices.length + caches.length, ") \u2014 click row to manage"] }), _jsx("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "bg-[#1e1f22] border-b border-[#3c4043]", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-2 text-[#9aa0a6] font-normal", children: "Name" }), _jsx("th", { className: "text-left px-3 py-2 text-[#9aa0a6] font-normal", children: "Namespace" }), _jsx("th", { className: "text-left px-3 py-2 text-[#9aa0a6] font-normal", children: "Pods" }), _jsx("th", { className: "text-left px-3 py-2 text-[#9aa0a6] font-normal", children: "Status" })] }) }), _jsxs("tbody", { children: [allServices.map(svc => {
                                                            const sc = getScale(svc.name, svc.status);
                                                            const displayStatus = sc.isScaling ? (sc.desired < sc.current ? 'Terminating' : 'ContainerCreating') : svc.status;
                                                            return (_jsxs("tr", { onClick: () => setSelectedDeploy({ name: svc.name, status: svc.status, kind: 'service', extra: { 'Error Rate': `${((svc.error_rate ?? 0) * 100).toFixed(1)}%`, 'p99 Latency': `${svc.p99_latency_ms}ms` } }), className: "border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/50 cursor-pointer", children: [_jsx("td", { className: "px-3 py-2 text-[#8ab4f8]", children: svc.name }), _jsx("td", { className: "px-3 py-2 text-[#9aa0a6]", children: "default" }), _jsxs("td", { className: "px-3 py-2 text-[#9aa0a6]", children: [sc.current, "/", sc.desired] }), _jsx("td", { className: "px-3 py-2", children: _jsx(StatusChip, { status: displayStatus }) })] }, svc.name));
                                                        }), caches.map(c => {
                                                            const sc = getScale(c.name, c.status);
                                                            return (_jsxs("tr", { onClick: () => setSelectedDeploy({ name: c.name, status: c.status, kind: 'cache', extra: { 'Hit Rate': `${(c.hit_rate * 100).toFixed(0)}%`, 'Memory': `${c.memory_used_mb}/${c.memory_total_mb} MB` } }), className: "border-b border-[#3c4043] last:border-0 hover:bg-[#3c4043]/50 cursor-pointer", children: [_jsx("td", { className: "px-3 py-2 text-[#8ab4f8]", children: c.name }), _jsx("td", { className: "px-3 py-2 text-[#9aa0a6]", children: "cache" }), _jsxs("td", { className: "px-3 py-2 text-[#9aa0a6]", children: [sc.current, "/", sc.desired] }), _jsx("td", { className: "px-3 py-2", children: _jsx(StatusChip, { status: c.status }) })] }, c.name));
                                                        })] })] }) })] })] })), activeSection === 'cloudsql' && (_jsx(CloudSQLPanel, { databases: databases })), activeSection === 'logging' && (_jsxs("div", { className: "p-4 space-y-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3 mb-1", children: [_jsx("div", { className: "text-[#e8eaed] text-sm font-medium", children: "Cloud Logging \u2014 Log Explorer" }), _jsx("span", { className: "text-[#3fb950] text-[10px]", children: "\u25CF live streaming" })] }), _jsxs("div", { className: "text-[#9aa0a6] text-[10px] mb-3", children: ["Resource: GKE Container \u00B7 Project: moniepoint-prod \u00B7 ", allGlobalLogs.length, " entries"] })] }), _jsx(LogHistogram, { logs: allGlobalLogs }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 mb-2", children: [_jsx("span", { className: "text-[#9aa0a6] text-[10px]", children: "Range:" }), [5, 15, 30, 60].map(m => (_jsx("button", { onClick: () => setGlobalLogRange(m), className: `px-2 py-0.5 rounded text-[10px] transition-colors ${globalLogRange === m ? 'bg-[#8ab4f8] text-[#202124] font-bold' : 'bg-[#292a2d] border border-[#3c4043] text-[#9aa0a6]'}`, children: m < 60 ? `${m}m` : '1h' }, m))), _jsx("span", { className: "text-[#9aa0a6] text-[10px] ml-2", children: "Filter:" }), ['INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL'].map(lvl => (_jsx("button", { onClick: () => setGlobalFilter(globalFilter === lvl ? null : lvl), className: `text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all ${globalFilter === lvl ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`, style: { color: LEVEL_COLOR[lvl], borderColor: LEVEL_COLOR[lvl], backgroundColor: globalFilter === lvl ? `${LEVEL_COLOR[lvl]}22` : 'transparent' }, children: lvl }, lvl))), pinnedGlobalIdx.size > 0 && _jsxs("button", { onClick: () => setPinnedGlobalIdx(new Set()), className: "text-[9px] text-[#484f58] hover:text-[#f85149] ml-auto", children: ["clear ", pinnedGlobalIdx.size, " pin(s)"] })] }), _jsxs("div", { className: "bg-[#0f1011] border border-[#3c4043] rounded p-2 font-mono text-[10px] space-y-0.5 max-h-[calc(100vh-240px)] overflow-y-auto", children: [displayedGlobal.map((l, i) => (_jsxs("div", { className: `flex gap-2 leading-relaxed group ${l.time === '📌' ? 'bg-[#1a1400] border-l-2 border-[#d29922] pl-1' : ''}`, children: [_jsx("span", { className: "text-[#484f58] flex-shrink-0 w-16", children: l.time }), _jsx("span", { className: "font-bold flex-shrink-0 w-10", style: { color: LEVEL_COLOR[l.level] ?? '#6b7280' }, children: l.level }), l.svc && _jsx("span", { className: "text-[#8ab4f8] flex-shrink-0 w-28 truncate", children: l.svc }), _jsx("span", { className: "text-[#e8eaed] break-all flex-1", children: l.msg.replace(l.svc ? `[${l.svc}] ` : '', '') }), l.time !== '📌' && (_jsx("button", { onClick: () => setPinnedGlobalIdx(p => { const n = new Set(p); n.has(l.origIdx) ? n.delete(l.origIdx) : n.add(l.origIdx); return n; }), className: "opacity-0 group-hover:opacity-100 text-[#484f58] hover:text-[#d29922] flex-shrink-0 transition-opacity text-[11px]", title: "Pin log line", children: "\uD83D\uDCCC" }))] }, i))), _jsx("div", { ref: globalLogEndRef })] })] })), activeSection === 'iam' && (_jsxs("div", { className: "p-4", children: [_jsx("div", { className: "text-[#e8eaed] text-sm font-medium mb-3", children: "IAM & Admin \u2014 Service Accounts" }), _jsx("div", { className: "bg-[#292a2d] border border-[#3c4043] rounded overflow-hidden", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "bg-[#1e1f22] border-b border-[#3c4043]", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-2 text-[#9aa0a6] font-normal", children: "Account" }), _jsx("th", { className: "text-left px-3 py-2 text-[#9aa0a6] font-normal", children: "Role" })] }) }), _jsx("tbody", { children: [['sre-oncall@moniepoint-prod.iam', 'roles/editor'], ['gke-sa@moniepoint-prod.iam', 'roles/container.nodeServiceAccount'], ['cloud-sql-sa@moniepoint-prod.iam', 'roles/cloudsql.client'], ['monitoring-sa@moniepoint-prod.iam', 'roles/monitoring.viewer'], ['ci-cd-sa@moniepoint-prod.iam', 'roles/storage.admin']].map(([acc, role], i) => (_jsxs("tr", { className: "border-b border-[#3c4043] last:border-0", children: [_jsx("td", { className: "px-3 py-2 text-[#8ab4f8]", children: acc }), _jsx("td", { className: "px-3 py-2 text-[#9aa0a6]", children: role })] }, i))) })] }) })] }))] })] }));
}
