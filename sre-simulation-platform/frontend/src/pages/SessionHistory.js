import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
const WS_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001').replace('ws://', 'http://').replace('wss://', 'https://');
const API_BASE = WS_BASE;
const HISTORY_PASSWORD = 'sre-moniepoint-2024';
export default function SessionHistory({ onBack }) {
    const [unlocked, setUnlocked] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(null);
    function handleUnlock(e) {
        e.preventDefault();
        if (passwordInput === HISTORY_PASSWORD) {
            setUnlocked(true);
            setPasswordError(false);
        }
        else {
            setPasswordError(true);
        }
    }
    useEffect(() => {
        if (!unlocked)
            return;
        setLoading(true);
        async function load() {
            try {
                const res = await fetch(`${API_BASE}/sessions`);
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                // Fetch scorecards for all sessions that have ended (any terminal status)
                const withScores = await Promise.all(data.map(async (session) => {
                    const terminal = ['ended', 'completed', 'time_limit', 'resolved', 'abandoned'];
                    if (terminal.includes(session.status) || session.ended_at) {
                        try {
                            const sc = await fetch(`${API_BASE}/sessions/${session.id}/scorecard`);
                            if (sc.ok) {
                                const scorecard = await sc.json();
                                return { ...session, scorecard };
                            }
                        }
                        catch {
                            // ignore
                        }
                    }
                    return session;
                }));
                setSessions(withScores);
            }
            catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load sessions');
            }
            finally {
                setLoading(false);
            }
        }
        load();
    }, [unlocked]);
    function formatDate(iso) {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: 'medium', timeStyle: 'short'
        });
    }
    function scoreColor(score, passing) {
        if (score >= passing)
            return 'text-[#3fb950]';
        if (score >= passing * 0.7)
            return 'text-[#d29922]';
        return 'text-[#f85149]';
    }
    function barColor(score) {
        if (score >= 65)
            return 'bg-[#3fb950]';
        if (score >= 45)
            return 'bg-[#d29922]';
        return 'bg-[#f85149]';
    }
    function moduleLabel(session, sc) {
        const mt = sc?.module_type ?? session.scenario_id;
        if (mt === 'sql')
            return { label: 'SQL', color: '#58a6ff' };
        if (mt === 'monitoring')
            return { label: 'MONITORING', color: '#bc8cff' };
        if (mt === 'cognitive')
            return { label: 'COGNITIVE', color: '#e3b341' };
        if (mt === 'postmortem')
            return { label: 'POSTMORTEM', color: '#ff7c21' };
        if (mt === 'automation')
            return { label: 'AUTOMATION', color: '#3fb950' };
        return { label: 'INCIDENT', color: '#f85149' };
    }
    if (!unlocked) {
        return (_jsx("div", { className: "min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4 font-mono", children: _jsxs("div", { className: "w-full max-w-sm bg-[#161b22] border border-[#30363d] rounded-lg p-6 space-y-5", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-[#8b949e] text-xs uppercase tracking-widest mb-2", children: "\uD83D\uDD12 Restricted Access" }), _jsx("h1", { className: "text-[#e6edf3] text-lg font-bold", children: "Session History" }), _jsx("p", { className: "text-[#484f58] text-xs mt-1", children: "Enter the assessor password to continue" })] }), _jsxs("form", { onSubmit: handleUnlock, className: "space-y-4", children: [_jsx("input", { type: "password", value: passwordInput, onChange: e => setPasswordInput(e.target.value), placeholder: "Password", autoFocus: true, className: "w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#3fb950] transition-colors" }), passwordError && (_jsx("div", { className: "text-[#f85149] text-xs text-center", children: "\u2717 Incorrect password" })), _jsx("button", { type: "submit", className: "w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2.5 rounded border border-[#2ea043] transition-all text-sm", children: "Unlock" })] }), _jsx("button", { onClick: onBack, className: "w-full text-[#484f58] hover:text-[#8b949e] text-xs text-center transition-colors", children: "\u2190 Back to Home" })] }) }));
    }
    return (_jsx("div", { className: "min-h-screen bg-[#0d1117] font-mono text-xs px-4 py-8", children: _jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsxs("div", { className: "flex items-center gap-4 mb-8", children: [_jsx("button", { onClick: onBack, className: "text-[#58a6ff] hover:text-[#79c0ff] transition-colors", children: "\u2190 Back" }), _jsxs("div", { children: [_jsx("h1", { className: "text-[#e6edf3] text-xl font-bold tracking-tight", children: "Session History" }), _jsx("div", { className: "text-[#8b949e] mt-0.5", children: "All past simulation runs" })] })] }), loading && (_jsxs("div", { className: "text-[#8b949e] text-center py-16", children: [_jsx("div", { className: "text-2xl mb-3", children: "\u25C9" }), "Loading sessions..."] })), error && (_jsxs("div", { className: "bg-[#161b22] border border-[#f85149] rounded-lg p-6 text-center text-[#f85149]", children: ["\u2717 ", error] })), !loading && !error && sessions.length === 0 && (_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-12 text-center text-[#8b949e]", children: [_jsx("div", { className: "text-3xl mb-3", children: "\uD83D\uDCCB" }), "No sessions yet. Start a simulation to see history here."] })), !loading && !error && sessions.length > 0 && (_jsx("div", { className: "space-y-3", children: sessions.map(session => {
                        const sc = session.scorecard;
                        const isExpanded = expanded === session.id;
                        const mod = moduleLabel(session, sc);
                        const isSql = sc?.module_type === 'sql' || sc?.candidate_query !== undefined;
                        return (_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#1c2128] transition-colors", onClick: () => setExpanded(isExpanded ? null : session.id), children: [_jsx("div", { className: `w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 font-bold text-sm ${sc ? (sc.passed ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#f85149] text-[#f85149]')
                                                : 'border-[#30363d] text-[#484f58]'}`, children: sc ? sc.total_score : '–' }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "text-[#e6edf3] font-bold", children: session.candidate_name }), _jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded border font-bold", style: { borderColor: mod.color, color: mod.color }, children: mod.label }), sc && (_jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded font-bold border ${sc.passed ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#f85149] text-[#f85149]'}`, children: sc.passed ? 'PASS' : 'FAIL' })), _jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded border ${session.status === 'time_limit' ? 'border-[#d29922] text-[#d29922]'
                                                                : session.status === 'abandoned' ? 'border-[#484f58] text-[#484f58]'
                                                                    : 'border-[#30363d] text-[#8b949e]'}`, children: session.status === 'time_limit' ? 'TIME LIMIT'
                                                                : session.status === 'abandoned' ? 'ABANDONED'
                                                                    : session.status === 'active' ? 'IN PROGRESS'
                                                                        : 'COMPLETED' })] }), _jsx("div", { className: "text-[#8b949e] mt-0.5", children: session.scenario_name ?? session.scenario_id })] }), _jsxs("div", { className: "text-right flex-shrink-0", children: [_jsx("div", { className: "text-[#8b949e]", children: formatDate(session.started_at) }), sc && _jsxs("div", { className: "text-[#484f58] mt-0.5", children: [sc.duration_minutes, " min"] })] }), _jsx("span", { className: "text-[#484f58] ml-2", children: isExpanded ? '▲' : '▼' })] }), isExpanded && sc && (_jsxs("div", { className: "border-t border-[#30363d] px-4 py-4 bg-[#0d1117] space-y-5", children: [(sc.postmortem_summary || sc.postmortem) && (_jsxs("div", { className: "bg-[#1c2128] border border-[#58a6ff]/30 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: "text-[#58a6ff] text-base", children: "\uD83E\uDD16" }), _jsx("div", { className: "text-[#58a6ff] font-bold uppercase tracking-widest text-[10px]", children: "AI Assessment" })] }), _jsx("div", { className: "text-[#e6edf3] leading-relaxed text-[11px]", children: sc.postmortem_summary || sc.postmortem })] })), _jsxs("div", { children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-2 text-[10px]", children: "Score Breakdown" }), _jsx("div", { className: "space-y-2", children: isSql ? (
                                                    // SQL-specific breakdown
                                                    _jsx(_Fragment, { children: [
                                                            { label: 'Query Correctness', score: sc.query_correctness ?? 0, weight: 60, notes: 'Whether the query returned the expected result set and all required columns/rows.' },
                                                            { label: 'Syntax Accuracy', score: sc.syntax_accuracy ?? 0, weight: 20, notes: 'Query syntax validity — no parser errors, proper use of SQL keywords and operators.' },
                                                            { label: 'Result Completeness', score: sc.result_completeness ?? 0, weight: 20, notes: 'Whether the result set is fully complete — right number of rows and correct column values.' },
                                                        ].map(d => (_jsxs("div", { className: "bg-[#161b22] rounded p-2.5 border border-[#30363d]", children: [_jsxs("div", { className: "flex justify-between mb-1", children: [_jsxs("span", { className: "text-[#8b949e]", children: [d.label, " ", _jsxs("span", { className: "text-[#484f58]", children: ["(", d.weight, "%)"] })] }), _jsxs("span", { className: scoreColor(d.score, 65), children: [d.score, "/100"] })] }), _jsx("div", { className: "h-1.5 bg-[#0d1117] rounded overflow-hidden mb-1.5", children: _jsx("div", { className: `h-full rounded transition-all ${barColor(d.score)}`, style: { width: `${d.score}%` } }) }), _jsx("div", { className: "text-[#484f58] text-[10px] leading-relaxed", children: d.notes })] }, d.label))) })) : (
                                                    // Incident simulation breakdown
                                                    _jsx(_Fragment, { children: [
                                                            { label: 'Coordination', score: sc.incident_coordination, weight: 25, notes: sc.coordination_notes },
                                                            { label: 'Resolution', score: sc.incident_resolution, weight: 35, notes: sc.resolution_notes },
                                                            { label: 'Technical Depth', score: sc.technical_depth, weight: 25, notes: sc.technical_notes },
                                                            { label: 'Observability', score: sc.observability_usage, weight: 15, notes: sc.observability_notes },
                                                        ].map(d => (_jsxs("div", { className: "bg-[#161b22] rounded p-2.5 border border-[#30363d]", children: [_jsxs("div", { className: "flex justify-between mb-1", children: [_jsxs("span", { className: "text-[#8b949e]", children: [d.label, " ", _jsxs("span", { className: "text-[#484f58]", children: ["(", d.weight, "%)"] })] }), _jsxs("span", { className: scoreColor(d.score, 65), children: [d.score, "/100"] })] }), _jsx("div", { className: "h-1.5 bg-[#0d1117] rounded overflow-hidden mb-1.5", children: _jsx("div", { className: `h-full rounded transition-all ${barColor(d.score)}`, style: { width: `${d.score}%` } }) }), d.notes && _jsx("div", { className: "text-[#8b949e] text-[10px] leading-relaxed", children: d.notes })] }, d.label))) })) })] }), (sc.highlights?.length ?? 0) > 0 && (_jsxs("div", { children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-2 text-[10px]", children: "Timeline Highlights" }), _jsx("div", { className: "space-y-1", children: sc.highlights.map((h, i) => {
                                                        const isObj = typeof h === 'object' && h !== null;
                                                        const event = isObj ? h.event : String(h);
                                                        const ts = isObj ? h.ts : undefined;
                                                        const quality = isObj ? h.quality : undefined;
                                                        const qColor = quality === 'excellent' ? '#3fb950' : quality === 'good' ? '#58a6ff' : quality === 'okay' ? '#d29922' : quality === 'poor' ? '#f85149' : '#3fb950';
                                                        return (_jsxs("div", { className: "flex gap-2 items-start", children: [_jsx("span", { style: { color: qColor }, className: "flex-shrink-0 mt-0.5", children: "\u2713" }), _jsxs("div", { children: [ts && _jsx("span", { className: "text-[#484f58] text-[10px] mr-2", children: ts }), _jsx("span", { className: "text-[#e6edf3]", children: event }), quality && _jsxs("span", { className: "ml-2 text-[9px] uppercase", style: { color: qColor }, children: ["[", quality, "]"] })] })] }, i));
                                                    }) })] })), isSql && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest text-[10px]", children: "SQL Submission" }), sc.sql_score !== undefined && (_jsxs("span", { className: `text-[10px] font-bold px-2 py-0.5 rounded border ${(sc.sql_score ?? 0) >= 70 ? 'border-[#3fb950] text-[#3fb950]'
                                                                : (sc.sql_score ?? 0) >= 50 ? 'border-[#d29922] text-[#d29922]'
                                                                    : 'border-[#f85149] text-[#f85149]'}`, children: ["Score: ", sc.sql_score, "/100 \u00B7 ", sc.sql_rating] }))] }), sc.sql_question && (_jsxs("div", { className: "bg-[#161b22] rounded p-3 border border-[#30363d]", children: [_jsx("div", { className: "text-[#58a6ff] font-bold mb-1 text-[11px]", children: sc.sql_question.title }), _jsx("div", { className: "text-[#e6edf3] text-[11px] mb-2 leading-relaxed", children: sc.sql_question.description }), sc.sql_question.schema_hint && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-[#484f58] text-[10px] mb-1 uppercase tracking-widest", children: "Schema" }), _jsx("pre", { className: "text-[#8b949e] text-[10px] bg-[#0d1117] rounded p-2 border border-[#30363d] overflow-x-auto whitespace-pre-wrap font-mono", children: sc.sql_question.schema_hint })] }))] })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[#484f58] text-[10px] mb-1 uppercase tracking-widest", children: "Expected / Solution Query" }), _jsx("pre", { className: "text-[#8b949e] text-[11px] leading-relaxed bg-[#0d1117] rounded p-3 border border-[#30363d] overflow-x-auto whitespace-pre-wrap font-mono min-h-[80px]", children: sc.sql_question?.solution_query || sc.sql_question?.starter_query || _jsx("span", { className: "text-[#484f58] italic", children: "No reference query available" }) })] }), _jsxs("div", { children: [_jsxs("div", { className: "text-[#484f58] text-[10px] mb-1 uppercase tracking-widest", children: ["Candidate's Query", sc.sql_score !== undefined && (_jsxs("span", { className: `ml-2 ${(sc.sql_score ?? 0) >= 70 ? 'text-[#3fb950]' : (sc.sql_score ?? 0) >= 50 ? 'text-[#d29922]' : 'text-[#f85149]'}`, children: ["\u2014 ", (sc.sql_score ?? 0) >= 70 ? 'Correct result' : (sc.sql_score ?? 0) >= 50 ? 'Partial match' : 'Needs improvement'] }))] }), _jsx("pre", { className: "text-[#e6edf3] text-[11px] leading-relaxed bg-[#0d1117] rounded p-3 border border-[#58a6ff]/20 overflow-x-auto whitespace-pre-wrap font-mono min-h-[80px]", children: sc.candidate_query || _jsx("span", { className: "text-[#484f58] italic", children: "No query submitted" }) })] })] }), _jsxs("div", { className: "bg-[#161b22] rounded p-3 border border-[#30363d]", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest text-[10px] mb-2", children: "Assessment Summary" }), _jsx("div", { className: "grid grid-cols-3 gap-3 text-center", children: [
                                                                { label: 'Syntax Accuracy', score: sc.syntax_accuracy ?? 0, icon: '{ }' },
                                                                { label: 'Query Correctness', score: sc.query_correctness ?? 0, icon: '✓' },
                                                                { label: 'Result Completeness', score: sc.result_completeness ?? 0, icon: '◉' },
                                                            ].map(item => (_jsxs("div", { className: "bg-[#0d1117] rounded p-2 border border-[#30363d]", children: [_jsx("div", { className: "text-[#484f58] text-base mb-1", children: item.icon }), _jsx("div", { className: `text-lg font-bold tabular-nums ${item.score >= 65 ? 'text-[#3fb950]' : item.score >= 40 ? 'text-[#d29922]' : 'text-[#f85149]'}`, children: item.score }), _jsx("div", { className: "text-[#484f58] text-[9px] mt-0.5", children: item.label })] }, item.label))) }), sc.sql_score !== undefined && (_jsx("div", { className: `mt-3 text-[11px] text-center font-bold ${(sc.sql_score ?? 0) >= 70 ? 'text-[#3fb950]' : (sc.sql_score ?? 0) >= 50 ? 'text-[#d29922]' : 'text-[#f85149]'}`, children: (sc.sql_score ?? 0) >= 80 ? 'Strong SQL skills demonstrated.' :
                                                                (sc.sql_score ?? 0) >= 60 ? 'Core SQL knowledge present — review JOIN syntax and aggregations.' :
                                                                    (sc.sql_score ?? 0) >= 40 ? 'SQL fundamentals need more work — review JOINs, WHERE conditions, and GROUP BY.' :
                                                                        'SQL fundamentals need significant improvement — revisit core query patterns.' }))] })] })), sc.monitoring_answers && sc.monitoring_answers.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-2 text-[10px]", children: "Candidate Answers" }), _jsx("div", { className: "space-y-2", children: sc.monitoring_answers.map((a, i) => (_jsxs("div", { className: "bg-[#161b22] rounded p-3 border border-[#30363d]", children: [_jsx("div", { className: "text-[#484f58] text-[10px] mb-1 uppercase tracking-widest", children: a.id }), _jsx("div", { className: "text-[#e6edf3] text-[11px] leading-relaxed", children: a.answer || _jsx("span", { className: "text-[#484f58] italic", children: "No answer provided" }) })] }, i))) })] }))] })), isExpanded && !sc && (_jsxs("div", { className: "border-t border-[#30363d] px-4 py-4 bg-[#0d1117] space-y-3", children: [_jsx("div", { className: "text-[#484f58] text-center text-[11px]", children: session.status === 'active'
                                                ? '⏳ Session still in progress — scorecard will appear after completion.'
                                                : session.status === 'abandoned'
                                                    ? '⚠ Session was abandoned before completion. No scorecard generated.'
                                                    : '◉ Scorecard is being generated by AI — refresh in a moment.' }), _jsxs("div", { className: "grid grid-cols-2 gap-3 text-[10px]", children: [_jsxs("div", { className: "bg-[#161b22] rounded p-2 border border-[#30363d]", children: [_jsx("div", { className: "text-[#484f58] uppercase tracking-widest mb-1", children: "Scenario" }), _jsx("div", { className: "text-[#e6edf3]", children: session.scenario_name ?? session.scenario_id })] }), _jsxs("div", { className: "bg-[#161b22] rounded p-2 border border-[#30363d]", children: [_jsx("div", { className: "text-[#484f58] uppercase tracking-widest mb-1", children: "Started" }), _jsx("div", { className: "text-[#e6edf3]", children: formatDate(session.started_at) })] })] })] }))] }, session.id));
                    }) }))] }) }));
}
