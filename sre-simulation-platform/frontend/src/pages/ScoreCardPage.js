import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const QUALITY_STYLES = {
    excellent: 'bg-[#238636] text-white',
    good: 'bg-[#1f6feb] text-white',
    okay: 'bg-[#9e6a03] text-white',
    poor: 'bg-[#da3633] text-white'
};
function ScoreCircle({ score }) {
    const color = score >= 80 ? '#3fb950' : score >= 60 ? '#d29922' : '#f85149';
    return (_jsx("div", { className: "flex items-center justify-center w-32 h-32 rounded-full border-4 mx-auto", style: { borderColor: color }, children: _jsxs("div", { children: [_jsx("div", { className: "text-4xl font-bold text-center", style: { color }, children: score }), _jsx("div", { className: "text-xs text-[#8b949e] text-center", children: "/100" })] }) }));
}
function ScoreBar({ score }) {
    const color = score >= 80 ? '#3fb950' : score >= 60 ? '#d29922' : '#f85149';
    return (_jsx("div", { className: "w-full bg-[#0d1117] rounded-full h-2 mt-1", children: _jsx("div", { className: "h-2 rounded-full transition-all", style: { width: `${score}%`, backgroundColor: color } }) }));
}
export default function ScoreCardPage({ scorecard, sessionEnded }) {
    const dims = [
        { key: 'coordination', label: 'Incident Coordination', weight: '25%', data: scorecard.dimensions.coordination },
        { key: 'resolution', label: 'Incident Resolution', weight: '35%', data: scorecard.dimensions.resolution },
        { key: 'technical_depth', label: 'Technical Depth', weight: '25%', data: scorecard.dimensions.technical_depth },
        { key: 'observability', label: 'Observability Usage', weight: '15%', data: scorecard.dimensions.observability }
    ];
    return (_jsx("div", { className: "min-h-screen bg-[#0d1117] font-mono", children: _jsxs("div", { className: "max-w-3xl mx-auto px-4 py-8", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "text-[#8b949e] text-xs uppercase tracking-widest mb-2", children: "Simulation Complete" }), _jsx("h1", { className: "text-2xl font-bold text-[#e6edf3] mb-1", children: "Session Scorecard" }), sessionEnded && (_jsxs("div", { className: "text-[#8b949e] text-sm", children: ["Duration: ", sessionEnded.duration_minutes, " min \u00B7", ' ', sessionEnded.reason === 'resolved' ? '✓ Resolved' :
                                    sessionEnded.reason === 'time_limit' ? '⏱ Time limit reached' : 'Ended'] }))] }), _jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-6 mb-6 text-center", children: [_jsx("div", { className: "text-[#8b949e] text-xs uppercase tracking-widest mb-4", children: "Overall Score" }), _jsx(ScoreCircle, { score: scorecard.overall_score }), _jsx("div", { className: "mt-3 text-sm text-[#8b949e]", children: scorecard.overall_score >= 80 ? '🎉 Excellent performance' :
                                scorecard.overall_score >= 65 ? '✓ Pass — on-call ready' :
                                    scorecard.overall_score >= 50 ? '⚠ Developing — more practice needed' :
                                        '✗ Needs significant improvement' })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-6", children: dims.map(dim => (_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "text-[#e6edf3] font-bold text-sm", children: dim.label }), _jsx("span", { className: "text-[#484f58] text-xs", children: dim.weight })] }), _jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx(ScoreBar, { score: dim.data.score }), _jsx("span", { className: "text-[#e6edf3] font-bold w-8 text-right", children: dim.data.score })] }), _jsx("p", { className: "text-[#8b949e] text-xs mt-2 leading-relaxed", children: dim.data.notes })] }, dim.key))) }), scorecard.timeline_highlights.length > 0 && (_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-6", children: [_jsx("div", { className: "text-[#8b949e] text-xs uppercase tracking-widest mb-3", children: "Timeline Highlights" }), _jsx("div", { className: "space-y-2", children: scorecard.timeline_highlights.map((h, i) => (_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "text-[#39d353] w-14 flex-shrink-0", children: h.ts }), _jsx("span", { className: "text-[#e6edf3] flex-1", children: h.event }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded flex-shrink-0 ${QUALITY_STYLES[h.quality] ?? 'bg-[#21262d] text-[#8b949e]'}`, children: h.quality })] }, i))) })] })), scorecard.postmortem && (_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-6", children: [_jsx("div", { className: "text-[#8b949e] text-xs uppercase tracking-widest mb-3", children: "Postmortem" }), _jsx("p", { className: "text-[#e6edf3] text-sm leading-relaxed whitespace-pre-wrap", children: scorecard.postmortem })] })), _jsx("div", { className: "text-center", children: _jsx("button", { onClick: () => window.location.reload(), className: "bg-[#238636] hover:bg-[#2ea043] text-white font-bold px-6 py-3 rounded border border-[#2ea043] transition-colors text-sm", children: "\u25B6 Start New Simulation" }) }), _jsxs("div", { className: "mt-6 text-center text-[#484f58] text-xs", children: ["Session ID: ", scorecard.session_id] })] }) }));
}
