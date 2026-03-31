import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
const NR_NAV = [
    { id: 'apm', label: 'APM & Services' },
    { id: 'infra', label: 'Infrastructure' },
];
// Tiny SVG sparkline
function Spark({ values, color, h = 28 }) {
    const max = Math.max(...values, 1);
    const w = 100;
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 2)}`).join(' ');
    return (_jsxs("svg", { width: w, height: h, className: "w-full", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: `g-${color.replace('#', '')}`, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: color, stopOpacity: "0.3" }), _jsx("stop", { offset: "100%", stopColor: color, stopOpacity: "0" })] }) }), _jsx("polygon", { points: `0,${h} ${pts} ${w},${h}`, fill: `url(#g-${color.replace('#', '')})` }), _jsx("polyline", { points: pts, fill: "none", stroke: color, strokeWidth: "1.5", strokeLinejoin: "round" })] }));
}
function hist(base, count = 20, noise = 15) {
    return Array.from({ length: count }, (_, i) => Math.max(0, base + Math.sin(i * 0.6) * noise + (Math.random() * noise * 0.5)));
}
// Generate spike+recovery trend: flat → spike at incidentAt → recovery at recoverAt
function spikeHist(base, spike, count, incidentAt, recoverAt, noise = 0) {
    return Array.from({ length: count }, (_, i) => {
        const frac = i / (count - 1);
        let val;
        if (frac < incidentAt)
            val = base;
        else if (frac < recoverAt)
            val = base + (spike - base) * ((frac - incidentAt) / (recoverAt - incidentAt)) * 2;
        else
            val = base + (spike - base) * Math.max(0, 1 - (frac - recoverAt) / (1 - recoverAt));
        return Math.max(0, val + (Math.random() - 0.5) * noise);
    });
}
// Drill-down chart panel for a single KPI
function KpiDrillDown({ label, unit, color, values, timeLabels, onClose }) {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const w = 600;
    const h = 120;
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 4)}`).join(' ');
    return (_jsxs("div", { className: "bg-[#12131a] border border-[#2d2f45] rounded p-4 mt-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("span", { className: "text-[#d4d4d4] font-bold text-[11px] uppercase tracking-widest", children: [label, " \u2014 Trend"] }), _jsx("button", { onClick: onClose, className: "text-[#555] hover:text-[#d4d4d4] text-[11px] transition-colors", children: "\u2715 Close" })] }), _jsxs("svg", { viewBox: `0 0 ${w} ${h}`, className: "w-full", style: { height: 100 }, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: `kpi-${label}`, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: color, stopOpacity: "0.25" }), _jsx("stop", { offset: "100%", stopColor: color, stopOpacity: "0" })] }) }), _jsx("polygon", { points: `0,${h} ${pts} ${w},${h}`, fill: `url(#kpi-${label})` }), _jsx("polyline", { points: pts, fill: "none", stroke: color, strokeWidth: "2", strokeLinejoin: "round" })] }), _jsx("div", { className: "flex justify-between text-[9px] text-[#555] mt-1", children: timeLabels.filter((_, i) => i % Math.ceil(timeLabels.length / 6) === 0).map((t, i) => (_jsx("span", { children: t }, i))) }), _jsxs("div", { className: "flex gap-4 mt-2 text-[10px]", children: [_jsxs("span", { className: "text-[#555]", children: ["Min: ", _jsxs("span", { style: { color }, children: [min.toFixed(2), unit] })] }), _jsxs("span", { className: "text-[#555]", children: ["Max: ", _jsxs("span", { style: { color }, children: [max.toFixed(2), unit] })] }), _jsxs("span", { className: "text-[#555]", children: ["Avg: ", _jsxs("span", { style: { color }, children: [(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2), unit] })] })] })] }));
}
function ServiceDetail({ service, onBack }) {
    const [tab, setTab] = useState('summary');
    const [drillDown, setDrillDown] = useState(null);
    const [txWindow, setTxWindow] = useState('1h');
    const errPct = (service.error_rate * 100);
    const errColor = errPct > 10 ? '#f85149' : errPct > 2 ? '#d29922' : '#00b4a0';
    const latColor = service.p99_latency_ms > 2000 ? '#f85149' : service.p99_latency_ms > 500 ? '#d29922' : '#00b4a0';
    const pointCount = txWindow === '1h' ? 24 : txWindow === '6h' ? 36 : 48;
    // Spike starts at 30% of time window, recovers at 70% — incident pattern
    const errTrendValues = useMemo(() => spikeHist(0.5, errPct, pointCount, 0.3, 0.7, 0.2), [errPct, pointCount]);
    const apdexTrendValues = useMemo(() => {
        const baseApdex = service.status === 'down' ? 0.05 : service.status === 'degraded' ? 0.54 : 0.97;
        return spikeHist(0.97, baseApdex, pointCount, 0.3, 0.7, 0.02).map(v => Math.min(1, Math.max(0, v)));
    }, [service.status, pointCount]);
    const txTimeLabels = useMemo(() => {
        const now = new Date();
        const hours = txWindow === '1h' ? 1 : txWindow === '6h' ? 6 : 24;
        return Array.from({ length: pointCount }, (_, i) => {
            const t = new Date(now.getTime() - (hours * 3600000) * (1 - i / (pointCount - 1)));
            return t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        });
    }, [txWindow, pointCount]);
    const errHist = useMemo(() => hist(errPct, 20, errPct * 0.4), [errPct]);
    const latHist = useMemo(() => hist(service.p99_latency_ms, 20, service.p99_latency_ms * 0.2), [service.p99_latency_ms]);
    const throughputHist = useMemo(() => hist(service.status === 'down' ? 0 : service.status === 'degraded' ? 120 : 850, 20, 80), [service.status]);
    const p95 = Math.round(service.p99_latency_ms * 0.82);
    const apdexVal = service.status === 'down' ? 0 : service.status === 'degraded' ? 0.54 : 0.96;
    const apdex = apdexVal.toFixed(2);
    const throughput = service.status === 'down' ? 0 : service.status === 'degraded' ? 134 : 847;
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "bg-[#1a1d2e] border-b border-[#2d2f45] px-4 py-2.5 flex items-center gap-3", children: [_jsx("button", { onClick: onBack, className: "text-[#00b4a0] hover:text-[#00d4bf] text-[11px] transition-colors", children: "\u2190 All Services" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-2 h-2 rounded-full", style: { backgroundColor: service.status === 'healthy' ? '#00b4a0' : service.status === 'degraded' ? '#d29922' : '#f85149' } }), _jsx("span", { className: "text-[#d4d4d4] font-bold", children: service.name })] }), _jsx("span", { className: `ml-auto text-[10px] font-bold px-2 py-0.5 rounded ${service.status === 'down' ? 'bg-[#2a0a0a] text-[#f85149]'
                            : service.status === 'degraded' ? 'bg-[#2a1e00] text-[#d29922]'
                                : 'bg-[#0a2a20] text-[#00b4a0]'}`, children: service.status.toUpperCase() })] }), _jsx("div", { className: "bg-[#1a1d2e] border-b border-[#2d2f45] flex", children: ['summary', 'transactions', 'errors', 'infrastructure'].map(t => (_jsx("button", { onClick: () => setTab(t), className: `px-4 py-2 text-[11px] capitalize border-b-2 transition-colors ${tab === t ? 'text-[#00b4a0] border-[#00b4a0]' : 'text-[#555] border-transparent hover:text-[#d4d4d4]'}`, children: t }, t))) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4", children: [tab === 'summary' && (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "grid grid-cols-4 gap-2", children: [
                                    { label: 'Apdex Score', value: apdex, color: parseFloat(apdex) > 0.85 ? '#00b4a0' : parseFloat(apdex) > 0.7 ? '#d29922' : '#f85149', clickable: true },
                                    { label: 'Error Rate', value: `${errPct.toFixed(2)}%`, color: errColor, clickable: true },
                                    { label: 'Throughput', value: `${throughput} rpm`, color: '#d4d4d4', clickable: false },
                                    { label: 'p99 Latency', value: `${service.p99_latency_ms}ms`, color: latColor, clickable: false },
                                ].map(k => (_jsxs("div", { onClick: () => k.clickable && setDrillDown(drillDown === k.label ? null : k.label), className: `bg-[#12131a] border rounded p-2.5 transition-colors ${k.clickable ? 'cursor-pointer hover:border-[#00b4a0]/50 border-[#2d2f45]' : 'border-[#2d2f45]'} ${drillDown === k.label ? 'border-[#00b4a0]' : ''}`, children: [_jsxs("div", { className: "text-[#666] text-[9px] uppercase tracking-widest mb-1 flex items-center gap-1", children: [k.label, " ", k.clickable && _jsx("span", { className: "text-[#555]", children: "\u2193" })] }), _jsx("div", { className: "text-sm font-bold tabular-nums", style: { color: k.color }, children: k.value })] }, k.label))) }), drillDown === 'Apdex Score' && (_jsx(KpiDrillDown, { label: "Apdex Score", unit: "", color: parseFloat(apdex) > 0.85 ? '#00b4a0' : '#f85149', values: apdexTrendValues, timeLabels: txTimeLabels, onClose: () => setDrillDown(null) })), drillDown === 'Error Rate' && (_jsx(KpiDrillDown, { label: "Error Rate", unit: "%", color: errColor, values: errTrendValues, timeLabels: txTimeLabels, onClose: () => setDrillDown(null) })), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "bg-[#12131a] border border-[#2d2f45] rounded p-3", children: [_jsx("div", { className: "text-[#666] text-[10px] mb-2", children: "Response Time (ms)" }), _jsx(Spark, { values: latHist, color: latColor }), _jsxs("div", { className: "mt-1 flex justify-between text-[10px] text-[#555]", children: [_jsxs("span", { children: ["p95: ", _jsxs("span", { className: "text-[#d4d4d4]", children: [p95, "ms"] })] }), _jsxs("span", { children: ["p99: ", _jsxs("span", { style: { color: latColor }, children: [service.p99_latency_ms, "ms"] })] })] })] }), _jsxs("div", { className: "bg-[#12131a] border border-[#2d2f45] rounded p-3", children: [_jsx("div", { className: "text-[#666] text-[10px] mb-2", children: "Error Rate (%)" }), _jsx(Spark, { values: errHist, color: errColor }), _jsxs("div", { className: "mt-1 text-[10px] text-[#555]", children: ["Current: ", _jsxs("span", { style: { color: errColor }, children: [errPct.toFixed(2), "%"] })] })] }), _jsxs("div", { className: "bg-[#12131a] border border-[#2d2f45] rounded p-3", children: [_jsx("div", { className: "text-[#666] text-[10px] mb-2", children: "Throughput (rpm)" }), _jsx(Spark, { values: throughputHist, color: "#8ab4f8" }), _jsxs("div", { className: "mt-1 text-[10px] text-[#555]", children: ["Current: ", _jsxs("span", { className: "text-[#8ab4f8]", children: [throughput, " rpm"] })] })] })] }), service.status !== 'healthy' && (_jsxs("div", { className: "bg-[#1a1d2e] border border-[#f85149]/40 rounded p-3", children: [_jsx("div", { className: "text-[#f85149] font-bold text-[11px] mb-1", children: "\u25CF Open Incident" }), _jsx("div", { className: "text-[#d4d4d4] text-[11px]", children: service.status === 'down'
                                            ? `${service.name} is down — all pods returning 5xx errors`
                                            : `${service.name} is degraded — elevated error rate and latency` })] }))] })), tab === 'transactions' && (_jsx(TxTab, { service: service, errPct: errPct, txWindow: txWindow, setTxWindow: setTxWindow, pointCount: pointCount, txTimeLabels: txTimeLabels })), tab === 'errors' && (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-[#666] text-[10px] uppercase tracking-widest mb-3", children: "Error Inbox" }), service.status === 'healthy' && errPct < 2 ? (_jsx("div", { className: "text-center text-[#555] py-10 text-[11px]", children: "No active errors" })) : ([
                                { count: Math.floor(errPct * 120), msg: `upstream connect error or disconnect/reset before headers`, fingerprint: 'ERR-001' },
                                { count: Math.floor(errPct * 45), msg: `context deadline exceeded (5000ms)`, fingerprint: 'ERR-002' },
                                { count: Math.floor(errPct * 22), msg: `failed to acquire Redis lock after 3 retries`, fingerprint: 'ERR-003' },
                            ].filter(e => e.count > 0).map((err, i) => (_jsxs("div", { className: "bg-[#12131a] border border-[#f85149]/40 rounded p-3 text-[11px]", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-[#f85149] font-bold text-[10px]", children: err.fingerprint }), _jsxs("span", { className: "text-[#555] text-[10px]", children: [err.count, " occurrences"] })] }), _jsx("div", { className: "text-[#d4d4d4]", children: err.msg }), _jsxs("div", { className: "text-[#555] text-[10px] mt-1", children: [service.name, " \u00B7 last seen just now"] })] }, i))))] })), tab === 'infrastructure' && (_jsxs("div", { className: "space-y-3 text-[11px]", children: [_jsx("div", { className: "text-[#666] text-[10px] uppercase tracking-widest mb-3", children: "Container Metrics" }), Array.from({ length: service.status === 'down' ? 0 : service.status === 'degraded' ? 1 : 3 }, (_, i) => {
                                const cpu = (service.status === 'degraded' ? 78 : 22) + i * 5;
                                const mem = (service.status === 'degraded' ? 81 : 35) + i * 8;
                                return (_jsxs("div", { className: "bg-[#12131a] border border-[#2d2f45] rounded p-3", children: [_jsxs("div", { className: "text-[#8ab4f8] mb-2", children: ["Container ", i + 1, " \u2014 ", service.name] }), _jsx("div", { className: "grid grid-cols-2 gap-3", children: [['CPU', cpu], ['Memory', mem]].map(([label, val]) => {
                                                const v = Number(val);
                                                const c = v > 85 ? '#f85149' : v > 60 ? '#d29922' : '#00b4a0';
                                                return (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-[10px] mb-1", children: [_jsxs("span", { className: "text-[#555]", children: [label, " Usage"] }), _jsxs("span", { style: { color: c }, className: "font-bold", children: [v, "%"] })] }), _jsx("div", { className: "w-full bg-[#1a1d2e] rounded-full h-1.5", children: _jsx("div", { className: "h-1.5 rounded-full", style: { width: `${v}%`, backgroundColor: c } }) })] }, String(label)));
                                            }) })] }, i));
                            }), service.status === 'down' && (_jsx("div", { className: "text-center text-[#555] py-8", children: "No running containers" }))] }))] })] }));
}
function TxBreakdown({ tx, errPct, onClose }) {
    const p90 = Math.round(tx.avgMs * 1.35);
    const p95 = Math.round(tx.avgMs * 1.55);
    const p99 = Math.round(tx.avgMs * 2.1);
    const apdex = tx.avgMs < 500 ? ((1 + (tx.avgMs < 2000 ? 0.5 : 0)) / 2).toFixed(2) : (tx.avgMs < 2000 ? 0.7 : 0.3).toFixed(2);
    const latC = tx.avgMs > 2000 ? '#f85149' : tx.avgMs > 500 ? '#d29922' : '#00b4a0';
    // Segment breakdown: DB, external, app code
    const dbPct = errPct > 5 ? 72 : 35;
    const extPct = 8;
    const appPct = 100 - dbPct - extPct;
    return (_jsxs("div", { className: "bg-[#0d0e17] border border-[#00b4a0]/40 rounded p-4 mt-2 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-[#00b4a0] font-bold text-[11px] uppercase tracking-widest", children: "Transaction Detail" }), _jsx("button", { onClick: onClose, className: "text-[#555] hover:text-[#d4d4d4] text-[11px] transition-colors", children: "\u2715" })] }), _jsx("div", { className: "text-[#8ab4f8] font-mono text-[10px] truncate", children: tx.name }), _jsx("div", { className: "grid grid-cols-4 gap-2", children: [
                    { label: 'Avg', val: `${tx.avgMs}ms`, color: latC },
                    { label: 'P90', val: `${p90}ms`, color: p90 > 2000 ? '#f85149' : p90 > 500 ? '#d29922' : '#00b4a0' },
                    { label: 'P95', val: `${p95}ms`, color: p95 > 2000 ? '#f85149' : p95 > 500 ? '#d29922' : '#00b4a0' },
                    { label: 'P99', val: `${p99}ms`, color: p99 > 2000 ? '#f85149' : p99 > 500 ? '#d29922' : '#00b4a0' },
                ].map(s => (_jsxs("div", { className: "bg-[#12131a] border border-[#2d2f45] rounded p-2 text-center", children: [_jsx("div", { className: "text-[#555] text-[9px] mb-0.5", children: s.label }), _jsx("div", { className: "font-bold text-[11px]", style: { color: s.color }, children: s.val })] }, s.label))) }), _jsxs("div", { className: "grid grid-cols-3 gap-2 text-[10px]", children: [_jsxs("div", { className: "bg-[#12131a] border border-[#2d2f45] rounded p-2", children: [_jsx("div", { className: "text-[#555] text-[9px] mb-0.5", children: "Apdex" }), _jsx("div", { className: `font-bold ${parseFloat(apdex) > 0.85 ? 'text-[#00b4a0]' : parseFloat(apdex) > 0.7 ? 'text-[#d29922]' : 'text-[#f85149]'}`, children: apdex })] }), _jsxs("div", { className: "bg-[#12131a] border border-[#2d2f45] rounded p-2", children: [_jsx("div", { className: "text-[#555] text-[9px] mb-0.5", children: "Total Calls" }), _jsx("div", { className: "text-[#d4d4d4] font-bold", children: tx.calls.toLocaleString() })] }), _jsxs("div", { className: "bg-[#12131a] border border-[#2d2f45] rounded p-2", children: [_jsx("div", { className: "text-[#555] text-[9px] mb-0.5", children: "Error Rate" }), _jsxs("div", { className: `font-bold ${errPct > 5 ? 'text-[#f85149]' : 'text-[#d4d4d4]'}`, children: [Math.max(0, errPct).toFixed(1), "%"] })] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[#555] text-[9px] mb-1.5 uppercase tracking-widest", children: "Time Breakdown" }), _jsxs("div", { className: "flex h-4 rounded overflow-hidden", children: [_jsx("div", { style: { width: `${dbPct}%`, backgroundColor: errPct > 5 ? '#f85149' : '#2a5298' }, title: `Database: ${dbPct}%` }), _jsx("div", { style: { width: `${extPct}%`, backgroundColor: '#8ab4f8' }, title: `External: ${extPct}%` }), _jsx("div", { style: { width: `${appPct}%`, backgroundColor: '#00b4a0' }, title: `App code: ${appPct}%` })] }), _jsxs("div", { className: "flex gap-4 mt-1.5 text-[9px]", children: [_jsxs("span", { children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-sm mr-1", style: { backgroundColor: errPct > 5 ? '#f85149' : '#2a5298' } }), "Database ", dbPct, "%"] }), _jsxs("span", { children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-sm mr-1 bg-[#8ab4f8]" }), "External ", extPct, "%"] }), _jsxs("span", { children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-sm mr-1 bg-[#00b4a0]" }), "App code ", appPct, "%"] })] }), errPct > 5 && (_jsx("div", { className: "text-[#f85149] text-[10px] mt-1.5", children: "\u26A0 High DB time \u2014 possible slow query or connection pool exhaustion" }))] })] }));
}
function TxTab({ service, errPct, txWindow, setTxWindow, pointCount, txTimeLabels }) {
    const [openTx, setOpenTx] = useState(null);
    const transactions = [
        { name: `POST /api/v1/${service.name.replace('-service', '')}/create`, calls: 1243, avgMs: Math.round(service.p99_latency_ms * 0.6), errPct: errPct * 0.8 },
        { name: `GET /api/v1/${service.name.replace('-service', '')}/list`, calls: 3891, avgMs: Math.round(service.p99_latency_ms * 0.35), errPct: errPct * 0.4 },
        { name: `PUT /api/v1/${service.name.replace('-service', '')}/update`, calls: 547, avgMs: Math.round(service.p99_latency_ms * 0.8), errPct: errPct * 1.2 },
        { name: `DELETE /api/v1/${service.name.replace('-service', '')}/remove`, calls: 89, avgMs: Math.round(service.p99_latency_ms * 0.5), errPct: errPct * 0.3 },
        { name: `GET /api/v1/${service.name.replace('-service', '')}/health`, calls: 12490, avgMs: 2, errPct: 0 },
    ];
    // Pick 5 evenly spaced time labels for the sparkline axis
    const axisLabels = [0, 0.25, 0.5, 0.75, 1].map(frac => {
        const idx = Math.round(frac * (txTimeLabels.length - 1));
        return txTimeLabels[idx];
    });
    const showAxis = txWindow === '6h' || txWindow === '24h';
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("div", { className: "text-[#666] text-[10px] uppercase tracking-widest", children: "Top Transactions" }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[#555] text-[10px] mr-1", children: "Window:" }), ['1h', '6h', '24h'].map(w => (_jsx("button", { onClick: () => setTxWindow(w), className: `px-2 py-0.5 rounded text-[10px] transition-colors ${txWindow === w ? 'bg-[#00b4a0] text-[#12131a] font-bold' : 'bg-[#1a1d2e] border border-[#2d2f45] text-[#666] hover:text-[#d4d4d4]'}`, children: w }, w)))] })] }), transactions.map((tx, i) => {
                const sparkData = spikeHist(tx.avgMs * 0.8, tx.avgMs, pointCount, 0.3, 0.7, tx.avgMs * 0.1);
                const latC = tx.avgMs > 2000 ? '#f85149' : tx.avgMs > 500 ? '#d29922' : '#00b4a0';
                const isOpen = openTx === i;
                return (_jsxs("div", { className: "space-y-0", children: [_jsxs("div", { onClick: () => setOpenTx(isOpen ? null : i), className: `bg-[#12131a] border rounded p-2.5 text-[11px] cursor-pointer transition-colors ${isOpen ? 'border-[#00b4a0]' : 'border-[#2d2f45] hover:border-[#00b4a0]/30'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [_jsx("span", { className: "text-[#8ab4f8] truncate flex-1 font-mono text-[10px]", children: tx.name }), _jsx("span", { className: "text-[#555] text-[9px] ml-2", children: isOpen ? '▲ collapse' : '▼ detail' })] }), _jsxs("div", { className: "grid gap-2 text-[10px]", style: { gridTemplateColumns: '1fr 1fr 1fr 1fr' }, children: [_jsxs("div", { children: [_jsx("span", { className: "text-[#555]", children: "Calls: " }), _jsx("span", { className: "text-[#d4d4d4]", children: tx.calls.toLocaleString() })] }), _jsxs("div", { children: [_jsx("span", { className: "text-[#555]", children: "Avg: " }), _jsxs("span", { style: { color: latC }, children: [tx.avgMs, "ms"] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-[#555]", children: "Errors: " }), _jsxs("span", { style: { color: tx.errPct > 5 ? '#f85149' : '#d4d4d4' }, children: [Math.max(0, tx.errPct).toFixed(1), "%"] })] }), _jsx("div", { children: _jsxs("div", { className: "relative", children: [_jsx(Spark, { values: sparkData, color: latC, h: 20 }), showAxis && (_jsxs("div", { className: "flex justify-between text-[8px] text-[#444] mt-0.5", children: [_jsx("span", { children: axisLabels[0] }), _jsx("span", { children: axisLabels[2] }), _jsx("span", { children: axisLabels[4] })] }))] }) })] })] }), isOpen && (_jsx(TxBreakdown, { tx: tx, errPct: tx.errPct, onClose: () => setOpenTx(null) }))] }, i));
            }), showAxis && (_jsxs("div", { className: "bg-[#12131a] border border-[#2d2f45] rounded p-2 text-[10px]", children: [_jsxs("div", { className: "text-[#555] text-[9px] mb-1 uppercase tracking-widest", children: ["Time Axis \u2014 ", txWindow, " window"] }), _jsx("div", { className: "flex justify-between text-[#484f58]", children: axisLabels.map((l, i) => _jsx("span", { children: l }, i)) }), _jsx("div", { className: "h-px bg-[#2d2f45] mt-1" }), _jsxs("div", { className: "text-[#484f58] text-[9px] mt-1", children: ["Spike visible at ", txWindow === '6h' ? 'approx. 2h ago' : 'approx. 7h ago', " \u2014 incident onset"] })] })), !showAxis && (_jsxs("div", { className: "text-[#555] text-[10px] mt-2 text-center", children: ["Showing last ", txWindow, " \u00B7 Click any row to see P90/P95/P99 + call breakdown"] }))] }));
}
export default function NewRelicPanel({ systemState }) {
    const [activeTab, setActiveTab] = useState('apm');
    const [selectedService, setSelectedService] = useState(null);
    const services = systemState ? Object.values(systemState.services) : [];
    const databases = systemState?.infrastructure.databases ?? [];
    const caches = systemState?.infrastructure.caches ?? [];
    const svc = selectedService ? systemState?.services[selectedService] : null;
    if (svc) {
        return (_jsxs("div", { className: "flex flex-col h-full bg-[#12131a] font-mono text-xs text-[#d4d4d4] overflow-hidden", children: [_jsxs("div", { className: "bg-[#1a1d2e] border-b border-[#2d2f45] px-4 py-2 flex items-center gap-3 flex-shrink-0", children: [_jsx("div", { className: "w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[11px]", style: { background: 'linear-gradient(135deg, #00b4a0 0%, #0078bf 100%)' }, children: "NR" }), _jsx("span", { className: "text-[#d4d4d4] font-medium", children: "New Relic One" }), _jsx("span", { className: "text-[#555] text-[10px]", children: "\u00B7 moniepoint-production" })] }), _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ServiceDetail, { service: svc, onBack: () => setSelectedService(null) }) })] }));
    }
    const degradedCount = services.filter(s => s.status !== 'healthy').length;
    return (_jsxs("div", { className: "flex flex-col h-full bg-[#12131a] font-mono text-xs text-[#d4d4d4] overflow-hidden", children: [_jsxs("div", { className: "bg-[#1a1d2e] border-b border-[#2d2f45] px-4 py-2 flex items-center justify-between flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[11px]", style: { background: 'linear-gradient(135deg, #00b4a0 0%, #0078bf 100%)' }, children: "NR" }), _jsx("span", { className: "text-[#d4d4d4] font-medium", children: "New Relic One" }), _jsx("span", { className: "text-[#555] text-[10px]", children: "\u00B7 moniepoint-production" })] }), _jsx("span", { className: `font-bold text-[10px] ${degradedCount > 0 ? 'text-[#f85149]' : 'text-[#00b4a0]'}`, children: degradedCount > 0 ? `⚠ ${degradedCount} service${degradedCount > 1 ? 's' : ''} degraded` : '✓ All services healthy' })] }), _jsx("div", { className: "bg-[#1a1d2e] border-b border-[#2d2f45] flex flex-shrink-0", children: NR_NAV.map(tab => (_jsx("button", { onClick: () => setActiveTab(tab.id), className: `px-4 py-2 text-[11px] border-b-2 transition-colors ${activeTab === tab.id ? 'text-[#00b4a0] border-[#00b4a0]' : 'text-[#666] border-transparent hover:text-[#d4d4d4]'}`, children: tab.label }, tab.id))) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-2", children: [activeTab === 'apm' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-[#888] text-[10px] uppercase tracking-widest mb-3", children: "Services \u2014 click to drill down" }), services.map(svc => {
                                const errPct = (svc.error_rate * 100);
                                const errColor = errPct > 10 ? '#f85149' : errPct > 2 ? '#d29922' : '#00b4a0';
                                const latColor = svc.p99_latency_ms > 2000 ? '#f85149' : svc.p99_latency_ms > 500 ? '#d29922' : '#d4d4d4';
                                return (_jsxs("div", { onClick: () => setSelectedService(svc.name), className: "bg-[#1a1d2e] border border-[#2d2f45] hover:border-[#00b4a0]/50 rounded p-3 cursor-pointer transition-colors", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-[#d4d4d4] font-bold", children: svc.name }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-[10px] font-bold px-1.5 py-0.5 rounded ${svc.status === 'down' ? 'bg-[#2a0a0a] text-[#f85149]'
                                                                : svc.status === 'degraded' ? 'bg-[#2a1e00] text-[#d29922]'
                                                                    : 'bg-[#0a2a20] text-[#00b4a0]'}`, children: svc.status.toUpperCase() }), _jsx("span", { className: "text-[#555] text-[10px]", children: "\u2192" })] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3 text-[10px]", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[#555] mb-0.5", children: "Error Rate" }), _jsxs("span", { className: "font-bold tabular-nums", style: { color: errColor }, children: [errPct.toFixed(1), "%"] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[#555] mb-0.5", children: "p99 Latency" }), _jsxs("span", { className: "font-bold tabular-nums", style: { color: latColor }, children: [svc.p99_latency_ms, "ms"] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[#555] mb-0.5", children: "Throughput" }), _jsxs("span", { className: "font-bold tabular-nums text-[#d4d4d4]", children: [svc.status === 'down' ? '0' : svc.status === 'degraded' ? '134' : '847', " rpm"] })] })] })] }, svc.name));
                            })] })), activeTab === 'infra' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-[#888] text-[10px] uppercase tracking-widest mb-3", children: "Infrastructure \u2014 click to drill down" }), [...caches, ...databases].map((item, i) => (_jsxs("div", { onClick: () => { }, className: "bg-[#1a1d2e] border border-[#2d2f45] rounded p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [_jsx("span", { className: "text-[#d4d4d4] font-bold", children: item.name }), _jsx("span", { className: `text-[10px] font-bold px-1.5 py-0.5 rounded ${item.status === 'down' ? 'bg-[#2a0a0a] text-[#f85149]'
                                                    : item.status === 'degraded' ? 'bg-[#2a1e00] text-[#d29922]'
                                                        : 'bg-[#0a2a20] text-[#00b4a0]'}`, children: item.status.toUpperCase() })] }), 'hit_rate' in item && (_jsxs("div", { className: "text-[10px] text-[#888]", children: ["Hit rate: ", _jsxs("span", { className: "text-[#d4d4d4]", children: [(item.hit_rate * 100).toFixed(0), "%"] })] })), 'connection_count' in item && (_jsxs("div", { className: "text-[10px] text-[#888]", children: ["Connections: ", _jsxs("span", { className: "text-[#d4d4d4]", children: [item.connection_count, "/", item.max_connections] })] }))] }, i)))] }))] })] }));
}
