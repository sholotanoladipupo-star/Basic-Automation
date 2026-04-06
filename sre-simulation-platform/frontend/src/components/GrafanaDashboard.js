import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
// Derive fake CPU/mem from service status
function cpuPct(status) {
    if (status === 'down')
        return 2;
    if (status === 'degraded')
        return 78 + Math.floor(Math.random() * 15);
    return 18 + Math.floor(Math.random() * 20);
}
function memPct(status) {
    if (status === 'down')
        return 5;
    if (status === 'degraded')
        return 82 + Math.floor(Math.random() * 12);
    return 30 + Math.floor(Math.random() * 25);
}
function Bar({ pct, warn = 60, crit = 85 }) {
    const color = pct >= crit ? '#f85149' : pct >= warn ? '#ff7c21' : '#3fb950';
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 bg-[#1a1d2b] rounded-full h-1.5", children: _jsx("div", { className: "h-1.5 rounded-full transition-all", style: { width: `${pct}%`, backgroundColor: color } }) }), _jsxs("span", { className: "text-[10px] tabular-nums w-7 text-right", style: { color }, children: [pct, "%"] })] }));
}
// Tiny sparkline using SVG
function Sparkline({ values, color }) {
    const max = Math.max(...values, 1);
    const w = 80, h = 24;
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(' ');
    return (_jsx("svg", { width: w, height: h, className: "overflow-visible", children: _jsx("polyline", { points: pts, fill: "none", stroke: color, strokeWidth: "1.5", strokeLinejoin: "round" }) }));
}
function sampleHistory(base, count = 12) {
    return Array.from({ length: count }, (_, i) => Math.max(0, Math.min(100, base + (Math.sin(i * 0.8) * 12) + (Math.random() * 8 - 4))));
}
function CollapsibleRow({ title, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (_jsxs("div", { className: "mb-1", children: [_jsxs("button", { onClick: () => setOpen(o => !o), className: "w-full flex items-center gap-2 px-3 py-1.5 bg-[#1e2030] hover:bg-[#252838] border border-[#2c3235] text-[11px] text-[#9fa8be] font-medium transition-colors", children: [_jsx("span", { className: "text-[#ff7c21]", children: open ? '▼' : '▶' }), _jsx("span", { className: "uppercase tracking-widest text-[10px]", children: title }), _jsx("div", { className: "flex-1 h-px bg-[#2c3235] ml-2" })] }), open && _jsx("div", { className: "border-x border-b border-[#2c3235]", children: children })] }));
}
function StatCard({ label, value, sub, color = '#e6edf3' }) {
    return (_jsxs("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded p-2.5 min-w-0", children: [_jsx("div", { className: "text-[9px] text-[#6b7280] uppercase tracking-widest mb-1", children: label }), _jsx("div", { className: "text-lg font-bold tabular-nums leading-none", style: { color }, children: value }), sub && _jsx("div", { className: "text-[10px] text-[#6b7280] mt-0.5", children: sub })] }));
}
export default function GrafanaDashboard({ systemState }) {
    const services = systemState ? Object.values(systemState.services) : [];
    const caches = systemState?.infrastructure.caches ?? [];
    const databases = systemState?.infrastructure.databases ?? [];
    const clusters = systemState?.infrastructure.clusters ?? [];
    const now = new Date();
    const timeLabel = `Last 5 minutes — ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    if (!systemState) {
        return (_jsx("div", { className: "h-full bg-[#111217] flex items-center justify-center text-[#6b7280] text-xs font-mono", children: "Waiting for system state\u2026" }));
    }
    return (_jsxs("div", { className: "h-full bg-[#111217] font-mono text-xs text-[#9fa8be] overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#2c3235] flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-5 h-5 flex items-center justify-center", children: _jsxs("svg", { viewBox: "0 0 24 24", className: "w-4 h-4", fill: "#ff7c21", children: [_jsx("circle", { cx: "12", cy: "12", r: "10", fill: "none", stroke: "#ff7c21", strokeWidth: "2" }), _jsx("path", { d: "M12 6v6l4 2", stroke: "#ff7c21", strokeWidth: "2", strokeLinecap: "round" })] }) }), _jsx("span", { className: "text-[#e6edf3] font-medium text-[11px]", children: "Grafana" }), _jsx("span", { className: "text-[#484f58] text-[10px]", children: "/ moniepoint-prod / SRE Overview" })] }), _jsxs("div", { className: "flex items-center gap-3 text-[10px]", children: [_jsxs("span", { className: "text-[#ff7c21]", children: ["\u23F1 ", timeLabel] }), _jsx("span", { className: "text-[#3fb950]", children: "\u25CF Live" })] })] }), _jsxs("div", { className: "p-3 space-y-1", children: [_jsxs("div", { className: "grid grid-cols-4 gap-2 mb-3", children: [_jsx(StatCard, { label: "Services Total", value: String(services.length), color: "#e6edf3" }), _jsx(StatCard, { label: "Healthy", value: String(services.filter(s => s.status === 'healthy').length), color: "#3fb950" }), _jsx(StatCard, { label: "Degraded", value: String(services.filter(s => s.status === 'degraded').length), color: "#ff7c21" }), _jsx(StatCard, { label: "Down", value: String(services.filter(s => s.status === 'down').length), color: "#f85149" })] }), _jsx(CollapsibleRow, { title: "Kubernetes Pod Health", defaultOpen: true, children: _jsxs("div", { className: "p-3 space-y-2", children: [clusters.map(c => (_jsxs("div", { className: "flex items-center justify-between bg-[#1a1d2b] border border-[#2c3235] rounded px-3 py-1.5 text-[11px]", children: [_jsxs("span", { className: "text-[#8ab4f8]", children: ["\u2638 ", c.name] }), _jsxs("span", { className: `font-bold ${c.healthy_nodes === c.nodes ? 'text-[#3fb950]' : 'text-[#f85149]'}`, children: [c.healthy_nodes, "/", c.nodes, " nodes ready"] })] }, c.name))), _jsx("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded overflow-hidden", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "bg-[#111217] border-b border-[#2c3235]", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "Deployment" }), _jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "Pods" }), _jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "Status" }), _jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "Restarts" }), _jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "CPU" }), _jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "Memory" })] }) }), _jsxs("tbody", { children: [services.map(svc => {
                                                        const pods = svc.status === 'down' ? '0/3' : svc.status === 'degraded' ? '1/3' : '3/3';
                                                        const restarts = svc.status === 'down' ? 12 : svc.status === 'degraded' ? 3 : 0;
                                                        const cpu = cpuPct(svc.status);
                                                        const mem = memPct(svc.status);
                                                        const statusColor = svc.status === 'down' ? '#f85149' : svc.status === 'degraded' ? '#ff7c21' : '#3fb950';
                                                        const statusLabel = svc.status === 'down' ? 'CrashLoopBackOff' : svc.status === 'degraded' ? 'Running (degraded)' : 'Running';
                                                        return (_jsxs("tr", { className: "border-b border-[#2c3235] last:border-0 hover:bg-[#1e2030]", children: [_jsx("td", { className: "px-3 py-2 text-[#8ab4f8]", children: svc.name }), _jsx("td", { className: "px-3 py-2", children: pods }), _jsx("td", { className: "px-3 py-2 font-bold", style: { color: statusColor }, children: statusLabel }), _jsx("td", { className: "px-3 py-2", style: { color: restarts > 5 ? '#f85149' : restarts > 0 ? '#ff7c21' : '#9fa8be' }, children: restarts }), _jsx("td", { className: "px-3 py-2 w-28", children: _jsx(Bar, { pct: cpu }) }), _jsx("td", { className: "px-3 py-2 w-28", children: _jsx(Bar, { pct: mem }) })] }, svc.name));
                                                    }), caches.map(c => {
                                                        const cpu = cpuPct(c.status);
                                                        const mem = Math.round((c.memory_used_mb / c.memory_total_mb) * 100);
                                                        return (_jsxs("tr", { className: "border-b border-[#2c3235] last:border-0 hover:bg-[#1e2030]", children: [_jsx("td", { className: "px-3 py-2 text-[#8ab4f8]", children: c.name }), _jsx("td", { className: "px-3 py-2", children: "1/1" }), _jsx("td", { className: "px-3 py-2 font-bold", style: { color: c.status === 'healthy' ? '#3fb950' : c.status === 'degraded' ? '#ff7c21' : '#f85149' }, children: c.status === 'healthy' ? 'Running' : c.status === 'degraded' ? 'Running (degraded)' : 'CrashLoopBackOff' }), _jsx("td", { className: "px-3 py-2 text-[#9fa8be]", children: "0" }), _jsx("td", { className: "px-3 py-2 w-28", children: _jsx(Bar, { pct: cpu }) }), _jsx("td", { className: "px-3 py-2 w-28", children: _jsx(Bar, { pct: mem, crit: 90, warn: 75 }) })] }, c.name));
                                                    })] })] }) })] }) }), _jsx(CollapsibleRow, { title: "Redis Metrics", defaultOpen: true, children: _jsx("div", { className: "p-3 space-y-3", children: caches.length === 0 ? (_jsx("div", { className: "text-[#6b7280] text-[11px] py-4 text-center", children: "No cache instances in system state" })) : caches.map(cache => {
                                const hitRate = Math.round(cache.hit_rate * 100);
                                const memUsedPct = Math.round((cache.memory_used_mb / cache.memory_total_mb) * 100);
                                const isDown = cache.status === 'down';
                                const isDeg = cache.status === 'degraded';
                                // Derived Redis metrics from cache state
                                const readLatency = isDown ? 0 : isDeg ? 42 + Math.floor(Math.random() * 20) : 1 + Math.floor(Math.random() * 2);
                                const writeLatency = isDown ? 0 : isDeg ? 38 + Math.floor(Math.random() * 18) : 1 + Math.floor(Math.random() * 2);
                                const opsPerSec = isDown ? 0 : isDeg ? 2800 + Math.floor(Math.random() * 400) : 18400 + Math.floor(Math.random() * 2000);
                                const evictionRate = isDown ? 0 : isDeg ? 12.4 : cache.hit_rate < 0.5 ? 8.1 : 0.2;
                                const connectedClients = isDown ? 0 : isDeg ? 8 : 142;
                                const hitColor = hitRate < 30 ? '#f85149' : hitRate < 70 ? '#ff7c21' : '#3fb950';
                                const readColor = readLatency > 20 ? '#f85149' : readLatency > 10 ? '#ff7c21' : '#3fb950';
                                const evictColor = evictionRate > 5 ? '#f85149' : evictionRate > 1 ? '#ff7c21' : '#3fb950';
                                const opsColor = opsPerSec < 1000 ? '#f85149' : '#8ab4f8';
                                const hitHist = sampleHistory(hitRate);
                                const readHist = sampleHistory(readLatency * 2).map(v => v / 2);
                                const opsHist = sampleHistory(isDown ? 0 : isDeg ? 30 : 85);
                                return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-[#e6edf3] font-bold text-[11px]", children: ["\u25CF ", cache.name] }), _jsx("span", { className: `text-[10px] font-bold px-2 py-0.5 rounded ${isDown ? 'bg-[#2a0a0a] text-[#f85149]' : isDeg ? 'bg-[#2a1800] text-[#ff7c21]' : 'bg-[#0f2a1a] text-[#3fb950]'}`, children: cache.status.toUpperCase() })] }), _jsx("div", { className: "grid grid-cols-5 gap-2", children: [
                                                { label: 'Hit Rate', value: `${hitRate}%`, color: hitColor, sub: hitRate < 30 ? 'CRITICAL' : hitRate < 70 ? 'LOW' : 'GOOD' },
                                                { label: 'Read Latency', value: isDown ? '—' : `${readLatency}ms`, color: readColor, sub: readLatency > 20 ? 'HIGH' : 'OK' },
                                                { label: 'Write Latency', value: isDown ? '—' : `${writeLatency}ms`, color: readColor, sub: writeLatency > 20 ? 'HIGH' : 'OK' },
                                                { label: 'Ops / sec', value: isDown ? '0' : opsPerSec.toLocaleString(), color: opsColor, sub: isDown ? 'DOWN' : isDeg ? 'DEGRADED' : 'NOMINAL' },
                                                { label: 'Eviction Rate', value: isDown ? '0' : `${evictionRate}/s`, color: evictColor, sub: evictionRate > 5 ? 'HIGH' : 'LOW' },
                                            ].map(t => (_jsxs("div", { className: "bg-[#111217] border border-[#2c3235] rounded p-2.5", children: [_jsx("div", { className: "text-[9px] text-[#555] uppercase tracking-widest mb-1", children: t.label }), _jsx("div", { className: "text-base font-bold tabular-nums leading-none mb-1", style: { color: t.color }, children: t.value }), _jsx("div", { className: "text-[9px]", style: { color: t.color }, children: t.sub })] }, t.label))) }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "bg-[#111217] border border-[#2c3235] rounded p-3", children: [_jsx("div", { className: "text-[#555] text-[10px] mb-1.5", children: "Cache Hit Rate (%)" }), _jsx(Sparkline, { values: hitHist, color: hitColor }), _jsxs("div", { className: "text-[9px] mt-1 text-[#555]", children: ["Now: ", _jsxs("span", { style: { color: hitColor }, children: [hitRate, "%"] })] })] }), _jsxs("div", { className: "bg-[#111217] border border-[#2c3235] rounded p-3", children: [_jsx("div", { className: "text-[#555] text-[10px] mb-1.5", children: "Read Latency (ms)" }), _jsx(Sparkline, { values: readHist, color: readColor }), _jsxs("div", { className: "text-[9px] mt-1 text-[#555]", children: ["Now: ", _jsx("span", { style: { color: readColor }, children: isDown ? '—' : `${readLatency}ms` })] })] }), _jsxs("div", { className: "bg-[#111217] border border-[#2c3235] rounded p-3", children: [_jsx("div", { className: "text-[#555] text-[10px] mb-1.5", children: "Operations / sec" }), _jsx(Sparkline, { values: opsHist, color: opsColor }), _jsxs("div", { className: "text-[9px] mt-1 text-[#555]", children: ["Now: ", _jsx("span", { style: { color: opsColor }, children: isDown ? '0' : opsPerSec.toLocaleString() })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded p-3", children: [_jsxs("div", { className: "text-[9px] text-[#6b7280] mb-1.5", children: ["Memory Used \u2014 ", cache.memory_used_mb, "/", cache.memory_total_mb, " MB"] }), _jsx(Bar, { pct: memUsedPct, warn: 75, crit: 90 })] }), _jsxs("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded p-3", children: [_jsx("div", { className: "text-[9px] text-[#6b7280] mb-1", children: "Connected Clients" }), _jsx("div", { className: "text-lg font-bold tabular-nums", style: { color: connectedClients === 0 ? '#f85149' : '#e6edf3' }, children: connectedClients })] })] })] }, cache.name));
                            }) }) }), _jsx(CollapsibleRow, { title: "Business Performance", defaultOpen: true, children: _jsx("div", { className: "p-3 space-y-3", children: (() => {
                                const isDown = systemState ? Object.values(systemState.services).some(s => s.status === 'down') : false;
                                const isDegraded = systemState ? Object.values(systemState.services).some(s => s.status === 'degraded') : false;
                                const successRate = isDown ? 61.2 : isDegraded ? 84.7 : 99.4;
                                const rpm = isDown ? 183 : isDegraded ? 412 : 1247;
                                const pendingTx = isDown ? 3842 : isDegraded ? 1203 : 47;
                                const avgRespMs = isDown ? 4821 : isDegraded ? 1834 : 142;
                                const ordersToday = isDown ? 2341 : isDegraded ? 5102 : 12847;
                                const productsPurchased = isDown ? 3109 : isDegraded ? 6843 : 18293;
                                const successColor = successRate > 95 ? '#3fb950' : successRate > 80 ? '#ff7c21' : '#f85149';
                                const rpmColor = '#8ab4f8';
                                const pendingColor = pendingTx > 1000 ? '#f85149' : pendingTx > 200 ? '#ff7c21' : '#3fb950';
                                const respColor = avgRespMs > 2000 ? '#f85149' : avgRespMs > 500 ? '#ff7c21' : '#3fb950';
                                const successHist = Array.from({ length: 20 }, (_, i) => Math.max(0, Math.min(100, successRate + Math.sin(i * 0.7) * (isDown ? 15 : isDegraded ? 6 : 1.5) + (Math.random() * 3 - 1.5))));
                                const rpmHist = Array.from({ length: 20 }, (_, i) => Math.max(0, rpm + Math.sin(i * 0.5) * rpm * 0.15 + (Math.random() * rpm * 0.08)));
                                const pendingHist = Array.from({ length: 20 }, (_, i) => Math.max(0, pendingTx + Math.sin(i * 0.9) * pendingTx * 0.3 + (Math.random() * pendingTx * 0.1)));
                                return (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-6 gap-2", children: [
                                                { label: 'Success Rate', value: `${successRate.toFixed(1)}%`, color: successColor, sub: isDown ? 'CRITICAL' : isDegraded ? 'DEGRADED' : 'HEALTHY' },
                                                { label: 'Requests/min', value: rpm.toLocaleString(), color: rpmColor, sub: `${txWindow_placeholder(rpm)} vs avg` },
                                                { label: 'Pending Txns', value: pendingTx.toLocaleString(), color: pendingColor, sub: pendingTx > 1000 ? 'QUEUE BACKUP' : 'NOMINAL' },
                                                { label: 'Avg Response', value: `${avgRespMs}ms`, color: respColor, sub: avgRespMs > 2000 ? 'SLO BREACH' : avgRespMs > 500 ? 'WARNING' : 'GOOD' },
                                                { label: 'Orders Today', value: ordersToday.toLocaleString(), color: '#e6edf3', sub: 'since midnight' },
                                                { label: 'Products Sold', value: productsPurchased.toLocaleString(), color: '#e6edf3', sub: 'since midnight' },
                                            ].map(tile => (_jsxs("div", { className: "bg-[#111217] border border-[#2c3235] rounded p-2.5", children: [_jsx("div", { className: "text-[#555] text-[9px] uppercase tracking-widest mb-1", children: tile.label }), _jsx("div", { className: "text-base font-bold tabular-nums leading-none mb-1", style: { color: tile.color }, children: tile.value }), _jsx("div", { className: "text-[9px]", style: { color: tile.color }, children: tile.sub })] }, tile.label))) }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "bg-[#111217] border border-[#2c3235] rounded p-3", children: [_jsx("div", { className: "text-[#555] text-[10px] mb-1.5", children: "Success Rate (%) \u2014 Last 20min" }), _jsx(Sparkline, { values: successHist, color: successColor }), _jsxs("div", { className: "flex justify-between text-[9px] mt-1", children: [_jsxs("span", { className: "text-[#555]", children: ["Min: ", _jsxs("span", { style: { color: successColor }, children: [Math.min(...successHist).toFixed(1), "%"] })] }), _jsxs("span", { className: "text-[#555]", children: ["Now: ", _jsxs("span", { style: { color: successColor }, children: [successRate.toFixed(1), "%"] })] })] })] }), _jsxs("div", { className: "bg-[#111217] border border-[#2c3235] rounded p-3", children: [_jsx("div", { className: "text-[#555] text-[10px] mb-1.5", children: "Requests Per Minute" }), _jsx(Sparkline, { values: rpmHist, color: rpmColor }), _jsxs("div", { className: "flex justify-between text-[9px] mt-1", children: [_jsxs("span", { className: "text-[#555]", children: ["Min: ", _jsx("span", { style: { color: rpmColor }, children: Math.round(Math.min(...rpmHist)) })] }), _jsxs("span", { className: "text-[#555]", children: ["Now: ", _jsx("span", { style: { color: rpmColor }, children: rpm })] })] })] }), _jsxs("div", { className: "bg-[#111217] border border-[#2c3235] rounded p-3", children: [_jsx("div", { className: "text-[#555] text-[10px] mb-1.5", children: "Pending Transactions" }), _jsx(Sparkline, { values: pendingHist, color: pendingColor }), _jsxs("div", { className: "flex justify-between text-[9px] mt-1", children: [_jsxs("span", { className: "text-[#555]", children: ["Peak: ", _jsx("span", { style: { color: pendingColor }, children: Math.round(Math.max(...pendingHist)) })] }), _jsxs("span", { className: "text-[#555]", children: ["Now: ", _jsx("span", { style: { color: pendingColor }, children: pendingTx })] })] })] })] })] }));
                            })() }) }), _jsx(KafkaRow, { systemState: systemState }), _jsx(MySQLRow, { systemState: systemState })] })] }));
}
function txWindow_placeholder(rpm) {
    const diff = rpm > 1000 ? '+3%' : rpm > 400 ? '-67%' : '-85%';
    return diff;
}
// ─── Kafka / Confluent Row ────────────────────────────────────────────────────
const KAFKA_TOPICS = [
    { name: 'transactions', partitions: 24, baseLag: 120, baseRate: 14200 },
    { name: 'user-events', partitions: 12, baseLag: 8, baseRate: 5800 },
    { name: 'payment-events', partitions: 16, baseLag: 45, baseRate: 9100 },
    { name: 'order-lifecycle', partitions: 8, baseLag: 3, baseRate: 2300 },
    { name: 'notification-queue', partitions: 6, baseLag: 22, baseRate: 1600 },
    { name: 'audit-log', partitions: 4, baseLag: 0, baseRate: 800 },
];
const SOURCE_CONNECTORS = [
    { name: 'postgres-cdc-source', type: 'PostgreSQL CDC', status: 'RUNNING', topics: 'transactions, accounts' },
    { name: 'mysql-orders-source', type: 'MySQL CDC', status: 'RUNNING', topics: 'order-lifecycle' },
];
const SINK_CONNECTORS = [
    { name: 'bigquery-analytics-sink', type: 'BigQuery', status: 'RUNNING', topics: 'transactions, user-events' },
    { name: 's3-audit-sink', type: 'S3', status: 'RUNNING', topics: 'audit-log' },
    { name: 'elasticsearch-search-sink', type: 'Elasticsearch', status: 'RUNNING', topics: 'user-events, order-lifecycle' },
];
function KafkaRow({ systemState }) {
    const [open, setOpen] = useState(false);
    const isIncident = systemState ? Object.values(systemState.services).some(s => s.status !== 'healthy') : false;
    const isKafkaIncident = systemState?.scenario_id === 'kafka-consumer-lag';
    const topics = KAFKA_TOPICS.map(t => {
        const lagMultiplier = isKafkaIncident && t.name === 'transactions' ? 18000 : isIncident ? 4 : 1;
        const lag = Math.round(t.baseLag * lagMultiplier + (Math.random() * t.baseLag * 0.2));
        const produceRate = Math.round(t.baseRate * (isIncident ? 0.92 : 1) + Math.random() * t.baseRate * 0.05);
        const consumeRate = Math.round(t.baseRate * (isKafkaIncident && t.name === 'transactions' ? 0.02 : isIncident ? 0.85 : 0.99) + Math.random() * t.baseRate * 0.05);
        const lagColor = lag > 10000 ? '#f85149' : lag > 500 ? '#ff7c21' : '#3fb950';
        return { ...t, lag, produceRate, consumeRate, lagColor };
    });
    const totalLag = topics.reduce((s, t) => s + t.lag, 0);
    const totalProduce = topics.reduce((s, t) => s + t.produceRate, 0);
    const totalConsume = topics.reduce((s, t) => s + t.consumeRate, 0);
    const lagHistory = sampleHistory(isKafkaIncident ? 95 : isIncident ? 40 : 5);
    return (_jsxs("div", { className: "mb-1", children: [_jsxs("button", { onClick: () => setOpen(o => !o), className: "w-full flex items-center gap-2 px-3 py-1.5 bg-[#1e2030] hover:bg-[#252838] border border-[#2c3235] text-[11px] text-[#9fa8be] font-medium transition-colors", children: [_jsx("span", { className: "text-[#ff7c21]", children: open ? '▼' : '▶' }), _jsx("span", { className: "uppercase tracking-widest text-[10px]", children: "Kafka / Confluent" }), _jsx("div", { className: "flex-1 h-px bg-[#2c3235] ml-2" }), totalLag > 1000 && _jsx("span", { className: "text-[#f85149] text-[10px] font-bold animate-pulse ml-2", children: "\u26A0 High Consumer Lag" })] }), open && (_jsxs("div", { className: "border-x border-b border-[#2c3235] p-3 space-y-4", children: [_jsx("div", { className: "grid grid-cols-4 gap-2", children: [
                            { label: 'Total Consumer Lag', value: totalLag.toLocaleString(), color: totalLag > 10000 ? '#f85149' : totalLag > 1000 ? '#ff7c21' : '#3fb950' },
                            { label: 'Produce Rate / s', value: totalProduce.toLocaleString(), color: '#8ab4f8' },
                            { label: 'Consume Rate / s', value: totalConsume.toLocaleString(), color: '#8ab4f8' },
                            { label: 'Active Topics', value: String(topics.length), color: '#e6edf3' },
                        ].map(t => (_jsxs("div", { className: "bg-[#111217] border border-[#2c3235] rounded p-2.5", children: [_jsx("div", { className: "text-[9px] text-[#555] uppercase tracking-widest mb-1", children: t.label }), _jsx("div", { className: "text-base font-bold tabular-nums", style: { color: t.color }, children: t.value })] }, t.label))) }), _jsxs("div", { className: "bg-[#111217] border border-[#2c3235] rounded p-3", children: [_jsx("div", { className: "text-[#555] text-[10px] mb-2", children: "Consumer Lag Trend \u2014 Last 20min" }), _jsx(Sparkline, { values: lagHistory, color: totalLag > 10000 ? '#f85149' : totalLag > 500 ? '#ff7c21' : '#3fb950' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[9px] text-[#6b7280] uppercase tracking-widest mb-2", children: "Topics \u2014 Consumer Group: sre-consumers" }), _jsx("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded overflow-hidden", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { className: "bg-[#111217] border-b border-[#2c3235]", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "Topic" }), _jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "Partitions" }), _jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "Consumer Lag" }), _jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "Produce/s" }), _jsx("th", { className: "text-left px-3 py-1.5 text-[#6b7280] font-normal", children: "Consume/s" })] }) }), _jsx("tbody", { children: topics.map(t => (_jsxs("tr", { className: "border-b border-[#2c3235] last:border-0 hover:bg-[#1e2030]", children: [_jsx("td", { className: "px-3 py-2 text-[#8ab4f8] font-mono", children: t.name }), _jsx("td", { className: "px-3 py-2 text-[#9fa8be]", children: t.partitions }), _jsx("td", { className: "px-3 py-2 font-bold tabular-nums", style: { color: t.lagColor }, children: t.lag.toLocaleString() }), _jsx("td", { className: "px-3 py-2 text-[#9fa8be] tabular-nums", children: t.produceRate.toLocaleString() }), _jsx("td", { className: "px-3 py-2 tabular-nums", style: { color: t.consumeRate < t.produceRate * 0.5 ? '#f85149' : '#9fa8be' }, children: t.consumeRate.toLocaleString() })] }, t.name))) })] }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[9px] text-[#6b7280] uppercase tracking-widest mb-2", children: "Source Connectors" }), _jsx("div", { className: "space-y-1", children: SOURCE_CONNECTORS.map(c => (_jsxs("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded px-3 py-2 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[#e6edf3] text-[11px]", children: c.name }), _jsxs("div", { className: "text-[9px] text-[#6b7280]", children: [c.type, " \u2192 ", c.topics] })] }), _jsx("span", { className: "text-[9px] font-bold text-[#3fb950] bg-[#0f2a1a] px-1.5 py-0.5 rounded", children: c.status })] }, c.name))) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[9px] text-[#6b7280] uppercase tracking-widest mb-2", children: "Sink Connectors" }), _jsx("div", { className: "space-y-1", children: SINK_CONNECTORS.map(c => (_jsxs("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded px-3 py-2 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[#e6edf3] text-[11px]", children: c.name }), _jsxs("div", { className: "text-[9px] text-[#6b7280]", children: [c.type, " \u2190 ", c.topics] })] }), _jsx("span", { className: "text-[9px] font-bold text-[#3fb950] bg-[#0f2a1a] px-1.5 py-0.5 rounded", children: c.status })] }, c.name))) })] })] })] }))] }));
}
// ─── MySQL Database Monitoring Row ──────────────────────────────────────────
const TIME_RANGES = ['1m', '2m', '5m', '15m', '1h', '3h', '6h', '24h'];
function slowQueriesForRange(range, isDegraded) {
    const base = isDegraded ? 14 : 1;
    const multiplier = { '1m': 1, '2m': 2, '5m': 5, '15m': 9, '1h': 22, '3h': 47, '6h': 81, '24h': 180 };
    return isDegraded ? Math.round(base * (multiplier[range] * 0.6 + Math.random() * 3)) : Math.floor(Math.random() * 2);
}
function slowQuerySeries(range, isDegraded, count = 20) {
    // Spike starts ~40% in (incident onset) if degraded
    return Array.from({ length: count }, (_, i) => {
        const frac = i / (count - 1);
        if (!isDegraded)
            return Math.random() * 0.5;
        if (frac < 0.35)
            return Math.random() * 1.5;
        if (frac < 0.55)
            return 12 + Math.random() * 8; // spike
        return 10 + Math.random() * 6; // sustained high
    });
}
function fmtTime(d, range) {
    if (range === '1m' || range === '2m' || range === '5m' || range === '15m') {
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function MySQLRow({ systemState }) {
    const [range, setRange] = useState('5m');
    const [open, setOpen] = useState(false);
    const dbs = systemState?.infrastructure.databases ?? [];
    const isDegraded = dbs.some(d => d.status === 'degraded' || d.status === 'down');
    const isDown = dbs.every(d => d.status === 'down') && dbs.length > 0;
    const now = new Date();
    const dbStatus = isDown ? 'down' : isDegraded ? 'degraded' : 'healthy';
    const cpu = isDown ? 1 : isDegraded ? 88 : 22;
    const mem = isDown ? 3 : isDegraded ? 91 : 45;
    const disk = isDegraded ? 74 : 52;
    const activeConns = isDown ? 0 : isDegraded ? 498 : 42;
    const slowCount = slowQueriesForRange(range, isDegraded);
    const series = slowQuerySeries(range, isDegraded);
    // Generate slow query rows
    const activeSlowQueries = isDegraded ? [
        { duration: '00:04:23', query: 'SELECT o.*, p.name, p.sku FROM orders o JOIN products p ON o.product_id = p.id WHERE o.status = \'pending\' AND o.created_at > NOW() - INTERVAL \'1 hour\'', db: 'moniepoint_prod', user: 'app_user', rows: 48203 },
        { duration: '00:03:47', query: 'UPDATE wallets SET balance = balance - ? WHERE user_id IN (SELECT user_id FROM pending_transactions WHERE created_at < NOW() - INTERVAL \'30 min\')', db: 'moniepoint_prod', user: 'txn_worker', rows: 12041 },
        { duration: '00:03:12', query: 'SELECT COUNT(*) FROM audit_logs WHERE action = \'payment_attempt\' AND timestamp BETWEEN ? AND ? GROUP BY user_id HAVING count > 5', db: 'moniepoint_prod', user: 'analytics', rows: 892440 },
        { duration: '00:02:58', query: 'SELECT * FROM sessions s JOIN session_events se ON s.id = se.session_id WHERE s.started_at > NOW() - INTERVAL \'1 day\'', db: 'moniepoint_prod', user: 'app_user', rows: 312000 },
    ] : [];
    const slowQueryHistory = isDegraded ? [
        { started: new Date(now.getTime() - 8 * 60000), duration: '00:08:14', query: 'ANALYZE TABLE orders', db: 'moniepoint_prod', user: 'root' },
        { started: new Date(now.getTime() - 22 * 60000), duration: '00:01:52', query: 'SELECT * FROM transactions WHERE amount > 10000 ORDER BY created_at DESC', db: 'moniepoint_prod', user: 'report_svc' },
        { started: new Date(now.getTime() - 41 * 60000), duration: '00:00:47', query: 'UPDATE product_inventory SET stock_count = stock_count - 1 WHERE id IN (...)', db: 'moniepoint_prod', user: 'inventory_worker' },
    ] : [
        { started: new Date(now.getTime() - 180 * 60000), duration: '00:00:12', query: 'OPTIMIZE TABLE session_logs', db: 'moniepoint_prod', user: 'root' },
    ];
    const rangeMs = { '1m': 60000, '2m': 120000, '5m': 300000, '15m': 900000, '1h': 3600000, '3h': 10800000, '6h': 21600000, '24h': 86400000 };
    const chartLabels = [0, 0.25, 0.5, 0.75, 1].map(frac => {
        const t = new Date(now.getTime() - rangeMs[range] * (1 - frac));
        return fmtTime(t, range);
    });
    const maxSeries = Math.max(...series, 1);
    const w = 500, h = 60;
    const sparkPts = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - (v / maxSeries) * (h - 4)}`).join(' ');
    const fillPts = `0,${h} ${sparkPts} ${w},${h}`;
    const sparkColor = isDegraded ? '#f85149' : '#3fb950';
    return (_jsxs("div", { className: "mb-1", children: [_jsxs("button", { onClick: () => setOpen(o => !o), className: "w-full flex items-center gap-2 px-3 py-1.5 bg-[#1e2030] hover:bg-[#252838] border border-[#2c3235] text-[11px] text-[#9fa8be] font-medium transition-colors", children: [_jsx("span", { className: "text-[#ff7c21]", children: open ? '▼' : '▶' }), _jsx("span", { className: "uppercase tracking-widest text-[10px]", children: "MySQL Database" }), isDegraded && _jsx("span", { className: "text-[10px] text-[#f85149] font-bold animate-pulse ml-1", children: "\u25CF DEGRADED" }), _jsx("div", { className: "flex-1 h-px bg-[#2c3235] ml-2" }), _jsx("span", { className: "text-[9px] text-[#484f58]", children: "moniepoint-mysql-prod" })] }), open && (_jsxs("div", { className: "border-x border-b border-[#2c3235] p-3 space-y-4 bg-[#111217]", children: [_jsxs("div", { className: "flex items-center gap-1 flex-wrap", children: [_jsx("span", { className: "text-[#484f58] text-[10px] mr-2", children: "Time range:" }), TIME_RANGES.map(r => (_jsx("button", { onClick: () => setRange(r), className: `px-2 py-0.5 text-[10px] rounded border transition-colors ${range === r
                                    ? 'bg-[#ff7c21]/20 border-[#ff7c21] text-[#ff7c21]'
                                    : 'border-[#2c3235] text-[#484f58] hover:text-[#9fa8be]'}`, children: r }, r))), _jsx("span", { className: "ml-auto text-[#484f58] text-[10px]", children: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })] }), _jsx("div", { className: "grid grid-cols-4 gap-2", children: [
                            { label: 'CPU Utilization', value: `${cpu}%`, color: cpu >= 85 ? '#f85149' : cpu >= 60 ? '#ff7c21' : '#3fb950' },
                            { label: 'Memory Usage', value: `${mem}%`, color: mem >= 85 ? '#f85149' : mem >= 70 ? '#ff7c21' : '#3fb950' },
                            { label: 'Disk Usage', value: `${disk}%`, color: disk >= 85 ? '#f85149' : disk >= 70 ? '#ff7c21' : '#3fb950' },
                            { label: 'Active Connections', value: String(activeConns), color: activeConns >= 450 ? '#f85149' : activeConns >= 300 ? '#ff7c21' : '#3fb950' },
                        ].map(t => (_jsxs("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded p-2.5", children: [_jsx("div", { className: "text-[9px] text-[#6b7280] uppercase tracking-widest mb-1", children: t.label }), _jsx("div", { className: "text-xl font-bold tabular-nums", style: { color: t.color }, children: t.value }), _jsx("div", { className: "text-[9px] mt-0.5", style: { color: t.color }, children: dbStatus.toUpperCase() })] }, t.label))) }), _jsxs("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded p-3", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("div", { className: "text-[#6b7280] text-[10px] uppercase tracking-widest", children: "Slow Queries / sec" }), _jsxs("div", { className: `text-sm font-bold tabular-nums ${isDegraded ? 'text-[#f85149]' : 'text-[#3fb950]'}`, children: [slowCount, " total in ", range] })] }), _jsxs("svg", { width: "100%", viewBox: `0 0 ${w} ${h + 20}`, preserveAspectRatio: "none", className: "overflow-visible", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "mysql-grad", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: sparkColor, stopOpacity: "0.4" }), _jsx("stop", { offset: "100%", stopColor: sparkColor, stopOpacity: "0" })] }) }), _jsx("polygon", { points: fillPts, fill: "url(#mysql-grad)" }), _jsx("polyline", { points: sparkPts, fill: "none", stroke: sparkColor, strokeWidth: "1.5", strokeLinejoin: "round" }), chartLabels.map((label, i) => (_jsx("text", { x: (i / (chartLabels.length - 1)) * w, y: h + 16, textAnchor: i === 0 ? 'start' : i === chartLabels.length - 1 ? 'end' : 'middle', fontSize: "8", fill: "#484f58", children: label }, i)))] })] }), _jsxs("div", { children: [_jsxs("div", { className: "text-[#6b7280] text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2", children: ["Running Slow Queries", activeSlowQueries.length > 0 && (_jsxs("span", { className: "text-[#f85149] font-bold animate-pulse", children: [activeSlowQueries.length, " active"] }))] }), activeSlowQueries.length === 0 ? (_jsx("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded p-3 text-[#484f58] text-[10px] text-center", children: "\u2713 No slow queries currently running" })) : (_jsx("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded overflow-hidden", children: _jsxs("table", { className: "w-full text-[10px]", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[#2c3235] text-[#484f58]", children: [_jsx("th", { className: "text-left px-3 py-1.5", children: "Duration" }), _jsx("th", { className: "text-left px-3 py-1.5", children: "Query" }), _jsx("th", { className: "text-left px-3 py-1.5", children: "DB" }), _jsx("th", { className: "text-left px-3 py-1.5", children: "User" }), _jsx("th", { className: "text-right px-3 py-1.5", children: "Rows" })] }) }), _jsx("tbody", { children: activeSlowQueries.map((q, i) => (_jsxs("tr", { className: "border-b border-[#2c3235] last:border-0 hover:bg-[#252838]", children: [_jsx("td", { className: "px-3 py-1.5 text-[#f85149] font-bold tabular-nums whitespace-nowrap", children: q.duration }), _jsx("td", { className: "px-3 py-1.5 text-[#9fa8be] max-w-xs truncate font-mono", title: q.query, children: q.query }), _jsx("td", { className: "px-3 py-1.5 text-[#58a6ff]", children: q.db }), _jsx("td", { className: "px-3 py-1.5 text-[#d29922]", children: q.user }), _jsx("td", { className: "px-3 py-1.5 text-[#484f58] text-right tabular-nums", children: q.rows.toLocaleString() })] }, i))) })] }) }))] }), _jsxs("div", { children: [_jsx("div", { className: "text-[#6b7280] text-[10px] uppercase tracking-widest mb-2", children: "Slow Query History" }), _jsx("div", { className: "bg-[#1a1d2b] border border-[#2c3235] rounded overflow-hidden", children: _jsxs("table", { className: "w-full text-[10px]", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[#2c3235] text-[#484f58]", children: [_jsx("th", { className: "text-left px-3 py-1.5", children: "Started At" }), _jsx("th", { className: "text-left px-3 py-1.5", children: "Duration" }), _jsx("th", { className: "text-left px-3 py-1.5", children: "Query" }), _jsx("th", { className: "text-left px-3 py-1.5", children: "User" })] }) }), _jsx("tbody", { children: slowQueryHistory.map((q, i) => (_jsxs("tr", { className: "border-b border-[#2c3235] last:border-0 hover:bg-[#252838]", children: [_jsx("td", { className: "px-3 py-1.5 text-[#484f58] tabular-nums whitespace-nowrap", children: fmtTime(q.started, range) }), _jsx("td", { className: "px-3 py-1.5 text-[#d29922] tabular-nums whitespace-nowrap", children: q.duration }), _jsx("td", { className: "px-3 py-1.5 text-[#9fa8be] max-w-xs truncate font-mono", title: q.query, children: q.query }), _jsx("td", { className: "px-3 py-1.5 text-[#484f58]", children: q.user })] }, i))) })] }) })] })] }))] }));
}
