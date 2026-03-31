import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
    .replace('ws://', 'http://')
    .replace('wss://', 'https://');
const SECTIONS = [
    { id: 'summary', icon: '📋', label: 'Incident Summary', placeholder: 'What happened? What was the user-facing impact? How was it detected? How was it resolved?\n\nInclude:\n- Duration of incident\n- Affected services / users\n- How it was detected (alert, customer report, etc.)\n- How it was resolved' },
    { id: 'root_cause', icon: '🔍', label: 'Root Cause Analysis', placeholder: 'What was the root cause of this incident?\n\nWrite a clear, specific explanation of:\n1. The triggering event\n2. Why the system failed to handle it gracefully\n3. Any contributing factors (missing monitoring, no circuit breaker, etc.)' },
    { id: 'timeline', icon: '⏱', label: 'Detailed Timeline', placeholder: 'Fill in the detailed timeline with timestamps and what happened at each step.\n\nFormat:\n[HH:MM] — What happened\n[HH:MM] — What happened\n...\n\nInclude: when the issue started, when it was detected, all investigation steps, when it was resolved.' },
    { id: 'action_items', icon: '✅', label: 'Action Items', placeholder: 'What specific actions will prevent this from happening again?\n\nGroup by priority:\n\nImmediate (this week):\n- [ ] ...\n\nShort-term (this sprint):\n- [ ] ...\n\nLong-term (this quarter):\n- [ ] ...\n\nEach item must have an owner and a due date.' },
    { id: 'lessons', icon: '💡', label: 'Lessons Learned', placeholder: 'What did the team learn from this incident?\n\n- What worked well in the response?\n- What should be done differently next time?\n- What systemic issues does this reveal?\n- Any process or cultural changes needed?' },
];
export default function PostmortemSimulation({ sessionInfo }) {
    const [question, setQuestion] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [answers, setAnswers] = useState({});
    const [activeSection, setActiveSection] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [scoreResult, setScoreResult] = useState(null);
    const [showTimeUpModal, setShowTimeUpModal] = useState(false);
    const timerRef = useRef(null);
    const autoSubmittedRef = useRef(false);
    const timeLimit = question?.time_limit_seconds ?? (sessionInfo.time_limit_minutes * 60);
    const remaining = Math.max(0, timeLimit - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    useEffect(() => {
        if (!sessionInfo.question_id) {
            setLoadError('No question assigned. Contact your assessor.');
            return;
        }
        fetch(`${API_BASE}/postmortem/questions/${sessionInfo.question_id}`)
            .then(r => r.json())
            .then((q) => {
            setQuestion(q);
            const init = {};
            SECTIONS.forEach(s => { init[s.id] = ''; });
            setAnswers(init);
        })
            .catch(() => setLoadError('Failed to load question. Please refresh.'));
    }, [sessionInfo.question_id]);
    useEffect(() => {
        if (!question || submitted)
            return;
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
        return () => { if (timerRef.current)
            clearInterval(timerRef.current); };
    }, [question, submitted]);
    useEffect(() => {
        if (remaining === 0 && !submitted && !autoSubmittedRef.current && question) {
            autoSubmittedRef.current = true;
            setShowTimeUpModal(true);
            if (timerRef.current)
                clearInterval(timerRef.current);
            doSubmit();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remaining]);
    async function doSubmit() {
        if (!question || submitting || submitted)
            return;
        if (timerRef.current)
            clearInterval(timerRef.current);
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/postmortem/submit`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionInfo.session_id,
                    question_id: question.id,
                    sections: answers,
                })
            });
            const data = await res.json();
            setScoreResult(data);
            setSubmitted(true);
            setShowTimeUpModal(false);
        }
        catch (err) {
            alert('Submit failed: ' + String(err));
        }
        finally {
            setSubmitting(false);
        }
    }
    function wordCount(text) {
        return text.trim().split(/\s+/).filter(Boolean).length;
    }
    if (loadError) {
        return (_jsx("div", { className: "min-h-screen bg-[#0d1117] flex items-center justify-center", children: _jsx("div", { className: "text-[#f85149] font-mono text-sm", children: loadError }) }));
    }
    if (!question) {
        return (_jsx("div", { className: "min-h-screen bg-[#0d1117] flex items-center justify-center", children: _jsx("div", { className: "text-[#8b949e] font-mono text-sm animate-pulse", children: "Loading question\u2026" }) }));
    }
    const section = SECTIONS[activeSection];
    const totalWords = Object.values(answers).reduce((sum, v) => sum + wordCount(v), 0);
    const completedSections = SECTIONS.filter(s => wordCount(answers[s.id] ?? '') >= 20).length;
    return (_jsxs("div", { className: "min-h-screen bg-[#0d1117] font-mono text-xs flex flex-col", children: [submitted && (_jsxs("div", { className: "bg-[#0f2a1a] border-b border-[#3fb950] px-4 py-3 text-center flex-shrink-0", children: [_jsx("span", { className: "text-[#3fb950] font-bold text-sm", children: "\u2713 Postmortem Submitted" }), _jsx("span", { className: "text-[#8b949e] text-xs block mt-0.5", children: "Your assessor will review your document." })] })), showTimeUpModal && (_jsx("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-[#161b22] border border-[#f85149] rounded-lg p-8 text-center max-w-sm", children: [_jsx("div", { className: "text-[#f85149] text-2xl font-bold mb-2", children: "\u23F1 Time is up!" }), _jsx("div", { className: "text-[#8b949e] mb-4", children: "Submitting your postmortem automatically\u2026" }), _jsx("div", { className: "text-[#484f58] animate-pulse", children: "Saving\u2026" })] }) })), _jsxs("div", { className: "bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center justify-between flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-7 h-7 rounded bg-[#d29922] flex items-center justify-center text-white font-bold text-sm", children: "\uD83D\uDCC4" }), _jsx("span", { className: "text-[#e6edf3] font-bold", children: "Postmortem" }), _jsx("span", { className: "text-[#484f58]", children: "\u203A" }), _jsx("span", { className: "text-[#8b949e] truncate max-w-xs", children: question.title })] }), _jsxs("div", { className: "flex items-center gap-4 flex-shrink-0", children: [_jsx("span", { className: `px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${question.difficulty === 'easy' ? 'border-[#3fb950] text-[#3fb950]'
                                    : question.difficulty === 'medium' ? 'border-[#d29922] text-[#d29922]'
                                        : 'border-[#f85149] text-[#f85149]'}`, children: question.difficulty }), _jsxs("span", { className: "text-[#8b949e]", children: [completedSections, "/", SECTIONS.length, " sections \u00B7 ", totalWords, " words"] }), _jsx("div", { className: `text-sm font-bold tabular-nums ${remaining < 300 ? 'text-[#f85149] animate-pulse' : remaining < 600 ? 'text-[#d29922]' : 'text-[#3fb950]'}`, children: remaining === 0 ? 'TIME UP' : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` })] })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsxs("div", { className: "w-52 bg-[#161b22] border-r border-[#30363d] flex flex-col flex-shrink-0", children: [_jsx("div", { className: "p-3 border-b border-[#30363d]", children: _jsx("div", { className: "text-[#8b949e] uppercase tracking-widest text-[10px]", children: "Postmortem Sections" }) }), _jsx("nav", { className: "flex-1 py-1 overflow-y-auto", children: SECTIONS.map((s, i) => {
                                    const wc = wordCount(answers[s.id] ?? '');
                                    const done = wc >= 20;
                                    const isActive = activeSection === i;
                                    return (_jsxs("button", { onClick: () => setActiveSection(i), className: `w-full text-left px-4 py-3 flex items-center gap-2.5 transition-colors border-l-2 ${isActive ? 'bg-[#1c2128] border-[#d29922]' : 'border-transparent hover:bg-[#1c2128]'}`, children: [_jsx("span", { className: "text-sm", children: s.icon }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: `truncate text-[11px] ${isActive ? 'text-[#e6edf3]' : 'text-[#8b949e]'}`, children: s.label }), wc > 0 && _jsxs("div", { className: "text-[#484f58] text-[10px] mt-0.5", children: [wc, " words"] })] }), done && _jsx("span", { className: "text-[#3fb950] text-xs flex-shrink-0", children: "\u2713" })] }, s.id));
                                }) }), !submitted && (_jsx("div", { className: "p-3 border-t border-[#30363d]", children: _jsx("button", { onClick: doSubmit, disabled: submitting, className: "w-full bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold py-2 rounded transition-all text-[11px]", children: submitting ? 'Submitting…' : 'Submit Postmortem' }) })), submitted && (_jsx("div", { className: "p-3 border-t border-[#30363d] text-center", children: _jsx("div", { className: "text-[#3fb950] text-xs font-bold", children: "\u2713 Submitted" }) }))] }), _jsxs("div", { className: "w-72 border-r border-[#30363d] bg-[#0d1117] overflow-y-auto flex-shrink-0", children: [_jsxs("div", { className: "p-4 border-b border-[#30363d]", children: [_jsx("div", { className: "text-[#d29922] text-[10px] uppercase tracking-widest mb-1", children: "Incident Report" }), _jsx("div", { className: "text-[#e6edf3] font-bold text-sm mb-3", children: question.title }), _jsx("div", { className: "text-[#8b949e] leading-relaxed whitespace-pre-wrap text-[11px]", children: question.incident_summary })] }), question.timeline.length > 0 && (_jsxs("div", { className: "p-4", children: [_jsx("div", { className: "text-[#484f58] uppercase tracking-widest text-[10px] mb-3", children: "Known Timeline" }), _jsx("div", { className: "space-y-3", children: question.timeline.map((e, i) => (_jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "text-[#d29922] font-bold text-[10px] whitespace-nowrap mt-0.5", children: e.time }), _jsx("div", { className: "text-[#8b949e] text-[11px] leading-relaxed", children: e.description })] }, i))) })] }))] }), _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "p-4 border-b border-[#30363d] bg-[#161b22] flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "text-base", children: section.icon }), _jsx("span", { className: "text-[#e6edf3] font-bold text-sm", children: section.label }), _jsxs("span", { className: "ml-auto text-[#484f58] text-[10px]", children: [wordCount(answers[section.id] ?? ''), " words"] })] }), _jsxs("div", { className: "text-[#8b949e] text-[11px] leading-relaxed", children: [activeSection === 0 && 'Describe what happened, who was affected, and how the incident was detected and resolved.', activeSection === 1 && 'Explain the root cause clearly. What triggered the failure? What allowed it to propagate?', activeSection === 2 && 'Reconstruct the full timeline from first sign of trouble to resolution.', activeSection === 3 && 'List concrete, ownable action items to prevent recurrence. Each needs an owner and due date.', activeSection === 4 && 'What did the team learn? What worked? What should change?'] })] }), _jsx("textarea", { value: answers[section.id] ?? '', onChange: e => setAnswers(a => ({ ...a, [section.id]: e.target.value })), disabled: submitted || remaining === 0, spellCheck: false, placeholder: section.placeholder, className: "flex-1 bg-[#0d1117] text-[#e6edf3] resize-none p-5 text-sm font-mono focus:outline-none disabled:opacity-60 leading-relaxed", onKeyDown: e => {
                                    if (e.key === 'Tab') {
                                        e.preventDefault();
                                        const ta = e.currentTarget;
                                        const start = ta.selectionStart;
                                        const end = ta.selectionEnd;
                                        const val = answers[section.id] ?? '';
                                        setAnswers(a => ({ ...a, [section.id]: val.slice(0, start) + '  ' + val.slice(end) }));
                                        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
                                    }
                                } }, section.id), submitted && scoreResult && (_jsxs("div", { className: "border-t border-[#30363d] bg-[#161b22] p-4 flex-shrink-0 max-h-52 overflow-y-auto", children: [_jsxs("div", { className: "flex items-center gap-4 mb-3", children: [_jsxs("div", { className: `text-2xl font-bold ${scoreResult.score >= 75 ? 'text-[#3fb950]' : scoreResult.score >= 50 ? 'text-[#d29922]' : 'text-[#f85149]'}`, children: [scoreResult.score, "/100"] }), _jsx("div", { className: `px-2 py-0.5 rounded border text-[10px] font-bold ${scoreResult.rating === 'Good' ? 'border-[#3fb950] text-[#3fb950]' : scoreResult.rating === 'Managing' ? 'border-[#d29922] text-[#d29922]' : 'border-[#f85149] text-[#f85149]'}`, children: scoreResult.rating }), _jsx("div", { className: "flex-1" }), _jsx("div", { className: "text-[#8b949e] text-[10px]", children: Object.entries(scoreResult.section_scores).map(([k, v]) => (_jsxs("span", { className: "mr-3", children: [k, ": ", v] }, k))) })] }), _jsx("div", { className: "text-[#e6edf3] text-[11px] leading-relaxed", children: scoreResult.feedback })] })), !submitted && (_jsxs("div", { className: "p-3 border-t border-[#30363d] bg-[#161b22] flex items-center justify-between flex-shrink-0", children: [_jsx("button", { onClick: () => setActiveSection(i => Math.max(0, i - 1)), disabled: activeSection === 0, className: "px-4 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] disabled:opacity-40", children: "\u2190 Back" }), activeSection < SECTIONS.length - 1 ? (_jsx("button", { onClick: () => setActiveSection(i => i + 1), className: "bg-[#d29922] hover:bg-[#e3a516] text-[#0d1117] font-bold px-5 py-1.5 rounded text-[11px]", children: "Next Section \u2192" })) : (_jsx("button", { onClick: doSubmit, disabled: submitting, className: "bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold px-5 py-1.5 rounded text-[11px]", children: submitting ? 'Submitting…' : 'Submit Postmortem' }))] }))] })] })] }));
}
