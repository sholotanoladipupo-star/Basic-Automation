import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
    .replace('ws://', 'http://')
    .replace('wss://', 'https://')
    .replace('wss://', 'https://');
const STEP_META = {
    datasource: { icon: '⬡', label: 'Data Sources' },
    alert_rule: { icon: '⚡', label: 'Alert Rules' },
    contact_point: { icon: '📣', label: 'Contact Points' },
    notification_policy: { icon: '🔀', label: 'Notification Policies' },
    metrics: { icon: '📊', label: 'Key Metrics' },
    alerting: { icon: '🔔', label: 'Alerting Strategy' },
    investigation: { icon: '🔍', label: 'Investigation Steps' },
    sli_slo: { icon: '🎯', label: 'SLI / SLO' },
    error_budget: { icon: '⏱', label: 'Error Budget' },
    alert_fatigue: { icon: '🧹', label: 'Alert Hygiene' },
    dashboard: { icon: '📈', label: 'Dashboard Design' },
    k8s_metrics: { icon: '☸', label: 'K8s Metrics' },
    logging: { icon: '📋', label: 'Logging Strategy' },
    tracing: { icon: '🔗', label: 'Distributed Tracing' },
    runbook: { icon: '📖', label: 'Runbook' },
};
function ratingColor(rating) {
    if (rating === 'Good')
        return 'text-[#3fb950]';
    if (rating === 'Managing')
        return 'text-[#d29922]';
    return 'text-[#f85149]';
}
function ratingBorder(rating) {
    if (rating === 'Good')
        return 'border-[#3fb950]';
    if (rating === 'Managing')
        return 'border-[#d29922]';
    return 'border-[#f85149]';
}
export default function MonitoringSimulation({ sessionInfo }) {
    const [question, setQuestion] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [answers, setAnswers] = useState({});
    const [saved, setSaved] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [scoreResult, setScoreResult] = useState(null);
    const [elapsed, setElapsed] = useState(0);
    const [activeIdx, setActiveIdx] = useState(0);
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
        fetch(`${API_BASE}/monitoring/questions/${sessionInfo.question_id}`)
            .then(r => r.json())
            .then((q) => {
            setQuestion(q);
            const init = {};
            q.sub_questions.forEach(sq => { init[sq.id] = ''; });
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
            const answerList = question.sub_questions.map(sq => ({ id: sq.id, answer: answers[sq.id] ?? '' }));
            const res = await fetch(`${API_BASE}/monitoring/submit`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ session_id: sessionInfo.session_id, question_id: question.id, answers: answerList })
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
    function handleSaveStep() {
        const subQ = question?.sub_questions[activeIdx];
        if (!subQ)
            return;
        setSaved(s => ({ ...s, [subQ.id]: true }));
        if (question && activeIdx < question.sub_questions.length - 1) {
            setActiveIdx(i => i + 1);
        }
    }
    if (loadError) {
        return (_jsx("div", { className: "min-h-screen bg-[#111217] flex items-center justify-center", children: _jsx("div", { className: "text-[#f85149] font-mono text-sm", children: loadError }) }));
    }
    if (!question) {
        return (_jsx("div", { className: "min-h-screen bg-[#111217] flex items-center justify-center", children: _jsx("div", { className: "text-[#8b949e] font-mono text-sm animate-pulse", children: "Loading question\u2026" }) }));
    }
    const subQ = question.sub_questions[activeIdx];
    const subScore = scoreResult?.sub_scores.find(s => s.id === subQ?.id);
    return (_jsxs("div", { className: "min-h-screen bg-[#111217] font-mono text-xs flex flex-col", children: [submitted && (_jsxs("div", { className: "bg-[#0f2a1a] border-b border-[#3fb950] px-4 py-3 text-center flex-shrink-0", children: [_jsx("span", { className: "text-[#3fb950] font-bold text-sm", children: "\u2713 Exercise Submitted" }), _jsx("span", { className: "text-[#8b949e] text-xs block mt-0.5", children: "Your answers have been recorded. Your assessor will review your results." })] })), showTimeUpModal && (_jsx("div", { className: "fixed inset-0 bg-black/70 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-[#1f2028] border border-[#f85149] rounded-lg p-8 text-center max-w-sm", children: [_jsx("div", { className: "text-[#f85149] text-2xl font-bold mb-2", children: "\u23F1 Time is up!!" }), _jsx("div", { className: "text-[#8b949e] mb-4", children: "Your answers are being submitted automatically\u2026" }), _jsx("div", { className: "text-[#484f58] animate-pulse", children: "Exercise Submitted" })] }) })), _jsxs("div", { className: "bg-[#1a1c22] border-b border-[#2d2f3a] px-4 py-2 flex items-center justify-between flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("div", { className: "w-7 h-7 rounded bg-[#f46800] flex items-center justify-center text-white font-bold text-sm flex-shrink-0", children: "G" }), _jsx("span", { className: "text-[#e0e0e0] font-bold flex-shrink-0", children: "Grafana" }), _jsx("span", { className: "text-[#555] flex-shrink-0", children: "\u203A" }), _jsx("span", { className: "text-[#aaa] flex-shrink-0", children: "Alerting" }), _jsx("span", { className: "text-[#555] flex-shrink-0", children: "\u203A" }), _jsx("span", { className: "text-[#e0e0e0] truncate", children: question.title })] }), _jsxs("div", { className: "flex items-center gap-4 flex-shrink-0", children: [_jsx("span", { className: `px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${question.difficulty === 'easy' ? 'border-[#3fb950] text-[#3fb950]'
                                    : question.difficulty === 'medium' ? 'border-[#d29922] text-[#d29922]'
                                        : 'border-[#f85149] text-[#f85149]'}`, children: question.difficulty }), _jsx("div", { className: `text-sm font-bold tabular-nums ${remaining < 120 ? 'text-[#f85149] animate-pulse' : remaining < 300 ? 'text-[#d29922]' : 'text-[#3fb950]'}`, children: remaining === 0 ? 'TIME UP' : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` })] })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsxs("div", { className: "w-52 bg-[#1a1c22] border-r border-[#2d2f3a] flex flex-col flex-shrink-0", children: [_jsx("div", { className: "p-3 border-b border-[#2d2f3a]", children: _jsx("div", { className: "text-[#888] uppercase tracking-widest text-[10px]", children: "Alerting Config" }) }), _jsx("nav", { className: "flex-1 py-1 overflow-y-auto", children: question.sub_questions.map((sq, i) => {
                                    const meta = STEP_META[sq.type] ?? { icon: '○', label: sq.type };
                                    const isDone = saved[sq.id] || (submitted && (answers[sq.id] ?? '').trim().length > 0);
                                    const isActive = activeIdx === i;
                                    const hasAnswer = (answers[sq.id] ?? '').trim().length > 0;
                                    const ss = scoreResult?.sub_scores.find(s => s.id === sq.id);
                                    return (_jsxs("button", { onClick: () => setActiveIdx(i), className: `w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isActive
                                            ? 'bg-[#2d2f3a] border-l-2 border-[#f46800]'
                                            : 'hover:bg-[#22242e] border-l-2 border-transparent'}`, children: [_jsx("span", { className: "text-sm", children: meta.icon }), _jsx("div", { className: "flex-1 min-w-0", children: _jsx("div", { className: `truncate text-[11px] ${isActive ? 'text-[#e0e0e0]' : 'text-[#aaa]'}`, children: meta.label }) }), isDone || ss ? (_jsx("span", { className: "text-[#3fb950] text-xs", children: "\u2713" })) : hasAnswer ? (_jsx("span", { className: "w-2 h-2 rounded-full bg-[#f46800] flex-shrink-0" })) : null] }, sq.id));
                                }) }), !submitted && (_jsxs("div", { className: "p-3 border-t border-[#2d2f3a]", children: [_jsxs("div", { className: "text-[#555] text-[10px] mb-2", children: [question.sub_questions.filter(sq => (answers[sq.id] ?? '').trim().length > 0).length, "/", question.sub_questions.length, " configured"] }), _jsx("button", { onClick: doSubmit, disabled: submitting, className: "w-full bg-[#f46800] hover:bg-[#ff7a00] disabled:bg-[#2d2f3a] disabled:text-[#555] text-white font-bold py-2 rounded transition-all text-[11px]", children: submitting ? 'Saving…' : 'Save & Submit' })] })), submitted && (_jsx("div", { className: "p-3 border-t border-[#2d2f3a] text-center", children: _jsx("div", { className: "text-[#3fb950] text-xs font-bold", children: "\u2713 Submitted" }) }))] }), _jsxs("div", { className: "flex-1 flex overflow-hidden", children: [_jsxs("div", { className: "w-72 border-r border-[#2d2f3a] overflow-y-auto flex-shrink-0 bg-[#111217]", children: [_jsxs("div", { className: "p-4 border-b border-[#2d2f3a]", children: [_jsx("div", { className: "text-[#f46800] text-[10px] uppercase tracking-widest mb-1", children: "Incident Context" }), _jsx("div", { className: "text-[#e0e0e0] font-bold text-sm mb-3", children: question.title }), _jsx("div", { className: "text-[#8b949e] leading-relaxed whitespace-pre-wrap text-[11px]", children: question.scenario })] }), _jsxs("div", { className: "p-4", children: [_jsx("div", { className: "text-[#555] uppercase tracking-widest text-[10px] mb-3", children: "Configuration Steps" }), _jsx("div", { className: "space-y-2.5", children: question.sub_questions.map((sq, i) => {
                                                    const meta = STEP_META[sq.type] ?? { icon: '○', label: sq.type };
                                                    const isDone = saved[sq.id] || (answers[sq.id] ?? '').trim().length >= 10;
                                                    return (_jsxs("button", { onClick: () => setActiveIdx(i), className: `w-full flex items-center gap-2 text-[11px] text-left transition-colors ${isDone ? 'text-[#3fb950]' : activeIdx === i ? 'text-[#f46800]' : 'text-[#555] hover:text-[#888]'}`, children: [_jsx("span", { children: isDone ? '✓' : `${i + 1}.` }), _jsx("span", { children: meta.label })] }, sq.id));
                                                }) })] })] }), subQ && (_jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "p-5 border-b border-[#2d2f3a] bg-[#1a1c22] flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: "text-base", children: STEP_META[subQ.type]?.icon ?? '○' }), _jsx("span", { className: "text-[#aaa] uppercase tracking-widest text-[10px]", children: STEP_META[subQ.type]?.label ?? subQ.type }), _jsx("span", { className: "ml-auto px-1.5 py-0.5 rounded border border-[#2d2f3a] text-[#555] text-[10px] uppercase", children: subQ.type })] }), _jsx("div", { className: "text-[#e0e0e0] leading-relaxed text-sm", children: subQ.prompt })] }), _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsx("textarea", { value: answers[subQ.id] ?? '', onChange: e => setAnswers(a => ({ ...a, [subQ.id]: e.target.value })), disabled: submitted || remaining === 0, spellCheck: false, placeholder: subQ.placeholder || `Configure ${subQ.type} here…`, className: "flex-1 bg-[#111217] text-[#e0e0e0] resize-none p-5 text-sm font-mono focus:outline-none disabled:opacity-60", onKeyDown: e => {
                                                    if (e.key === 'Tab') {
                                                        e.preventDefault();
                                                        setAnswers(a => ({ ...a, [subQ.id]: (a[subQ.id] ?? '') + '  ' }));
                                                    }
                                                } }, subQ.id), submitted && subScore && (_jsx("div", { className: "border-t border-[#2d2f3a] bg-[#1a1c22] overflow-y-auto max-h-72 flex-shrink-0", children: _jsxs("div", { className: "p-4 grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[#555] uppercase tracking-widest text-[10px] mb-2", children: "Your Answer" }), _jsx("pre", { className: "text-[#8b949e] text-[11px] bg-[#111217] border border-[#2d2f3a] rounded p-3 whitespace-pre-wrap overflow-x-auto min-h-[60px]", children: answers[subQ.id] || '(no answer)' })] }), _jsxs("div", { children: [_jsx("div", { className: "flex items-center gap-2 mb-2", children: _jsx("div", { className: "text-[#555] uppercase tracking-widest text-[10px]", children: "Reference Answer" }) }), _jsx("pre", { className: "text-[#79c0ff] text-[11px] bg-[#111217] border border-[#2d2f3a] rounded p-3 whitespace-pre-wrap overflow-x-auto min-h-[60px]", children: subScore.reference_answer || 'N/A' })] })] }) }))] }), !submitted && (_jsxs("div", { className: "p-4 border-t border-[#2d2f3a] bg-[#1a1c22] flex items-center justify-between flex-shrink-0", children: [_jsx("button", { onClick: () => setActiveIdx(i => Math.max(0, i - 1)), disabled: activeIdx === 0, className: "px-4 py-1.5 rounded border border-[#2d2f3a] text-[#8b949e] hover:text-[#e0e0e0] disabled:opacity-40 transition-colors", children: "\u2190 Back" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: "text-[#555] text-[10px]", children: [(answers[subQ.id] ?? '').length, " chars"] }), _jsx("button", { onClick: handleSaveStep, disabled: (answers[subQ.id] ?? '').trim().length < 5, className: "bg-[#f46800] hover:bg-[#ff7a00] disabled:bg-[#2d2f3a] disabled:text-[#555] text-white font-bold px-5 py-1.5 rounded transition-all text-[11px]", children: activeIdx < question.sub_questions.length - 1 ? 'Save & Continue →' : 'Save' })] })] }))] }))] })] })] }));
}
