import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
const TOUR_STEPS = [
    {
        title: '🚨 Alerts Panel',
        description: 'Live PagerDuty-style alert feed on your left. Every alert shows its severity (SEV1/2/3) and timestamp. Click ACK to acknowledge — this earns coordination points. SEV1 alerts pulse red.',
        arrowSide: 'left',
        position: 'left-[284px] top-24',
        highlight: '← Alerts Panel',
    },
    {
        title: '⌨ Terminal',
        description: 'Your primary investigation tool. Run any Linux/Kubernetes command — kubectl, redis-cli, psql, curl, df, top, journalctl. Arrow-Up recalls history. Commands are evaluated against the live system state and return realistic output.',
        arrowSide: 'bottom',
        position: 'left-1/2 -translate-x-1/2 top-16',
        highlight: '↓ Terminal Tab',
    },
    {
        title: '📊 Grafana Dashboard',
        description: 'Switch to the Grafana tab to see live service metrics — error rates, latency, cache hit rate, DB connections, and business KPIs. The service health grid updates in real-time. Check dashboards early — they pinpoint where to look.',
        arrowSide: 'bottom',
        position: 'left-1/2 -translate-x-1/2 top-16',
        highlight: '↓ Grafana Tab',
    },
    {
        title: '🌐 GCP Console',
        description: 'Simulated Google Cloud Console. See GKE pod status, scale replicas up/down (including to 0), click any pod to view its container logs, and inspect Cloud SQL instance health. Scale down and back up to attempt service recovery.',
        arrowSide: 'bottom',
        position: 'left-1/2 -translate-x-1/2 top-16',
        highlight: '↓ GCP Console Tab',
    },
    {
        title: '📈 New Relic APM',
        description: 'Simulated APM showing service throughput, error rates, Apdex scores, and transaction traces. Click any KPI tile to drill into a chart. Use the time window (1h / 6h / 24h) to see when the spike started.',
        arrowSide: 'bottom',
        position: 'left-1/2 -translate-x-1/2 top-16',
        highlight: '↓ New Relic Tab',
    },
    {
        title: '⚙ Incident Panel',
        description: 'On your right: declare severity (SEV1/2/3) within 2 minutes — this is heavily weighted. Escalate to on-call leads when needed. Open runbooks for step-by-step guidance. Click Resolve when all services are healthy.',
        arrowSide: 'right',
        position: 'right-[284px] top-24',
        highlight: 'Incident Panel →',
    },
    {
        title: '💬 Comms Panel',
        description: 'Post Slack updates to #incidents and #oncall at the bottom-right. Stakeholders need to know status — even brief updates ("investigating redis", "restarting cache primary") earn coordination points. Aim for a message every 2-3 minutes.',
        arrowSide: 'right',
        position: 'right-[284px] bottom-28',
        highlight: 'Comms Panel →',
    },
];
// Renders a triangle arrow on the specified side of the tour card
function ArrowIndicator({ side }) {
    const size = 12;
    const triangles = {
        left: {
            position: 'absolute', left: -size, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: `${size}px solid transparent`,
            borderBottom: `${size}px solid transparent`,
            borderRight: `${size}px solid #58a6ff`,
        },
        right: {
            position: 'absolute', right: -size, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: `${size}px solid transparent`,
            borderBottom: `${size}px solid transparent`,
            borderLeft: `${size}px solid #58a6ff`,
        },
        top: {
            position: 'absolute', top: -size, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: `${size}px solid transparent`,
            borderRight: `${size}px solid transparent`,
            borderBottom: `${size}px solid #58a6ff`,
        },
        bottom: {
            position: 'absolute', bottom: -size, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: `${size}px solid transparent`,
            borderRight: `${size}px solid transparent`,
            borderTop: `${size}px solid #58a6ff`,
        },
    };
    return _jsx("div", { style: triangles[side] });
}
export default function TourGuide({ onFinish }) {
    const [step, setStep] = useState(0);
    const current = TOUR_STEPS[step];
    const isLast = step === TOUR_STEPS.length - 1;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/55 z-40 pointer-events-none" }), _jsxs("div", { className: `fixed z-50 ${current.position} w-80 bg-[#161b22] border border-[#58a6ff] rounded-lg shadow-2xl font-mono text-xs`, style: { position: 'fixed' }, children: [_jsx(ArrowIndicator, { side: current.arrowSide }), _jsx("div", { className: "h-1 bg-[#21262d] rounded-t-lg overflow-hidden", children: _jsx("div", { className: "h-full bg-[#58a6ff] transition-all duration-300", style: { width: `${((step + 1) / TOUR_STEPS.length) * 100}%` } }) }), _jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "text-[#484f58] text-[10px] uppercase tracking-widest", children: ["Step ", step + 1, " of ", TOUR_STEPS.length] }), current.highlight && (_jsx("div", { className: "text-[#58a6ff] text-[10px] font-bold animate-pulse bg-[#0d1117] px-2 py-0.5 rounded border border-[#58a6ff]/40", children: current.highlight }))] }), _jsx("div", { className: "text-[#e6edf3] font-bold text-sm mb-2", children: current.title }), _jsx("p", { className: "text-[#8b949e] leading-relaxed mb-4", children: current.description }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("button", { onClick: () => setStep(s => Math.max(0, s - 1)), disabled: step === 0, className: "text-[#484f58] hover:text-[#8b949e] disabled:opacity-30 transition-colors px-2 py-1", children: "\u2190 Back" }), _jsx("div", { className: "flex gap-1", children: TOUR_STEPS.map((_, i) => (_jsx("button", { onClick: () => setStep(i), className: `w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-[#58a6ff]' : 'bg-[#30363d]'}` }, i))) }), isLast ? (_jsx("button", { onClick: onFinish, className: "bg-[#238636] hover:bg-[#2ea043] text-white font-bold px-4 py-1.5 rounded border border-[#2ea043] transition-colors text-[11px]", children: "Start \u2192" })) : (_jsx("button", { onClick: () => setStep(s => s + 1), className: "bg-[#0d419d] hover:bg-[#1158c7] text-white font-bold px-4 py-1.5 rounded border border-[#388bfd] transition-colors text-[11px]", children: "Next \u2192" }))] })] })] }), _jsx("button", { onClick: onFinish, className: "fixed bottom-6 right-6 z-50 text-[#484f58] hover:text-[#8b949e] text-xs font-mono transition-colors", children: "Skip tour" })] }));
}
