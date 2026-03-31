import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
    .replace('ws://', 'http://')
    .replace('wss://', 'https://')
    .replace('wss://', 'https://');
function ratingColor(r) {
    if (r === 'Good')
        return 'text-[#3fb950]';
    if (r === 'Managing')
        return 'text-[#d29922]';
    return 'text-[#f85149]';
}
function ratingBorder(r) {
    if (r === 'Good')
        return 'border-[#3fb950]';
    if (r === 'Managing')
        return 'border-[#d29922]';
    return 'border-[#f85149]';
}
function diffColor(d) {
    if (d === 'easy')
        return 'border-[#3fb950] text-[#3fb950]';
    if (d === 'medium')
        return 'border-[#d29922] text-[#d29922]';
    return 'border-[#f85149] text-[#f85149]';
}
function catLabel(c) {
    return c.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}
export default function CognitiveSimulation({ sessionInfo }) {
    const [questions, setQuestions] = useState([]);
    const [loadError, setLoadError] = useState('');
    const [answers, setAnswers] = useState({});
    const [currentIdx, setCurrentIdx] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [scoreResult, setScoreResult] = useState(null);
    const [reviewIdx, setReviewIdx] = useState(null);
    const timerRef = useRef(null);
    const timeLimit = sessionInfo.time_limit_minutes * 60;
    const remaining = Math.max(0, timeLimit - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timedOut = remaining === 0 && !submitted;
    useEffect(() => {
        fetch(`${API_BASE}/cognitive/questions`)
            .then(r => r.json())
            .then((qs) => {
            if (!Array.isArray(qs) || qs.length === 0) {
                setLoadError('No cognitive questions available. Ask your assessor to seed questions.');
                return;
            }
            setQuestions(qs);
        })
            .catch(() => setLoadError('Failed to load questions. Please refresh.'));
    }, []);
    useEffect(() => {
        if (!questions.length || submitted || timedOut)
            return;
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
        return () => { if (timerRef.current)
            clearInterval(timerRef.current); };
    }, [questions.length, submitted, timedOut]);
    // Auto-submit when time is up
    useEffect(() => {
        if (timedOut && questions.length > 0 && !submitted) {
            handleSubmit();
        }
    }, [timedOut]);
    const currentQ = questions[currentIdx] ?? null;
    function setAnswer(qId, val) {
        setAnswers(a => ({ ...a, [qId]: val }));
    }
    async function handleSubmit() {
        if (submitted || submitting || questions.length === 0)
            return;
        if (timerRef.current)
            clearInterval(timerRef.current);
        setSubmitting(true);
        setSubmitError('');
        try {
            const payload = {
                session_id: sessionInfo.session_id,
                answers: questions.map(q => ({ question_id: q.id, answer: answers[q.id] ?? '' })),
            };
            const res = await fetch(`${API_BASE}/cognitive/submit`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setSubmitError(data.error ?? `Server error (${res.status})`);
                return;
            }
            setScoreResult(data);
            setSubmitted(true);
        }
        catch (err) {
            setSubmitError('Submit failed: ' + String(err));
        }
        finally {
            setSubmitting(false);
        }
    }
    const answered = questions.filter(q => (answers[q.id] ?? '').trim() !== '').length;
    const allAnswered = answered === questions.length;
    if (loadError) {
        return (_jsx("div", { className: "min-h-screen bg-[#0d1117] flex items-center justify-center", children: _jsx("div", { className: "text-[#f85149] font-mono text-sm", children: loadError }) }));
    }
    if (questions.length === 0) {
        return (_jsx("div", { className: "min-h-screen bg-[#0d1117] flex items-center justify-center", children: _jsx("div", { className: "text-[#8b949e] font-mono text-sm animate-pulse", children: "Loading questions\u2026" }) }));
    }
    // ── Submitted page — no scores shown to candidate ───────────────────────────
    if (submitted) {
        return (_jsxs("div", { className: "min-h-screen bg-[#0d1117] font-mono flex flex-col items-center justify-center px-4", children: [_jsx("div", { className: "text-[#3fb950] text-5xl mb-5", children: "\u2713" }), _jsx("h1", { className: "text-xl font-bold text-[#e6edf3] mb-2", children: "Exercise Submitted" }), _jsx("p", { className: "text-[#8b949e] text-sm text-center max-w-sm", children: "Your answers have been recorded. Your assessor will review your results." }), timedOut && (_jsx("p", { className: "text-[#d29922] text-xs font-bold mt-3", children: "\u23F1 Time limit reached \u2014 auto-submitted." })), _jsx("div", { className: "mt-8 text-[#484f58] text-xs", children: "You may now close this window." })] }));
    }
    // ── Quiz UI ─────────────────────────────────────────────────────────────────
    return (_jsxs("div", { className: "min-h-screen bg-[#0d1117] font-mono text-xs flex flex-col", children: [_jsxs("div", { className: "bg-[#161b22] border-b border-[#30363d] px-4 py-2.5 flex items-center justify-between flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-[#bc8cff] font-bold text-sm", children: "Cognitive Assessment" }), _jsx("span", { className: "text-[#484f58]", children: sessionInfo.candidate_name })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("span", { className: "text-[#484f58]", children: [answered, "/", questions.length, " answered"] }), _jsx("span", { className: `text-sm font-bold tabular-nums ${remaining < 120 ? 'text-[#f85149] animate-pulse' : remaining < 300 ? 'text-[#d29922]' : 'text-[#3fb950]'}`, children: timedOut ? 'TIME UP' : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` })] })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsxs("div", { className: "w-56 border-r border-[#30363d] flex flex-col overflow-y-auto flex-shrink-0", children: [_jsx("div", { className: "px-3 py-2 border-b border-[#30363d] text-[#484f58] uppercase tracking-widest text-[10px]", children: "Questions" }), questions.map((q, i) => {
                                const ans = (answers[q.id] ?? '').trim();
                                return (_jsx("button", { onClick: () => setCurrentIdx(i), className: `w-full text-left px-3 py-2.5 border-b border-[#30363d] transition-colors ${currentIdx === i ? 'bg-[#1c2128] border-l-2 border-l-[#bc8cff]' : 'hover:bg-[#1c2128]'}`, children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 text-[10px] ${ans ? 'border-[#3fb950] bg-[#0f2a1a] text-[#3fb950]' : 'border-[#30363d] text-[#484f58]'}`, children: ans ? '✓' : i + 1 }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-[#8b949e] truncate", children: q.title.replace('[SEED] ', '') }), _jsxs("div", { className: "flex gap-1 mt-0.5", children: [_jsx("span", { className: `text-[9px] px-1 rounded border ${diffColor(q.difficulty)}`, children: q.difficulty }), _jsx("span", { className: "text-[9px] text-[#484f58]", children: catLabel(q.category) })] })] })] }) }, q.id));
                            })] }), _jsxs("div", { className: "flex-1 overflow-y-auto flex flex-col", children: [currentQ && (_jsxs("div", { className: "flex-1 flex flex-col p-6 max-w-2xl w-full mx-auto", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsxs("span", { className: "text-[#484f58]", children: ["Q", currentIdx + 1, " of ", questions.length] }), _jsx("span", { className: `px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${diffColor(currentQ.difficulty)}`, children: currentQ.difficulty }), _jsx("span", { className: "text-[#484f58] text-[10px]", children: catLabel(currentQ.category) }), _jsxs("span", { className: "ml-auto text-[#484f58] text-[10px]", children: [currentQ.time_limit_seconds, "s suggested"] })] }), _jsx("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-5 mb-5", children: _jsx("div", { className: "text-[#e6edf3] leading-relaxed whitespace-pre-wrap text-sm", children: currentQ.question }) }), currentQ.question_type === 'multiple_choice' && currentQ.options ? (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-2", children: "Select your answer" }), currentQ.options.map(opt => (_jsxs("label", { className: `flex items-center gap-3 px-4 py-3 rounded border cursor-pointer transition-colors ${answers[currentQ.id] === opt
                                                    ? 'border-[#bc8cff] bg-[#1c1430] text-[#e6edf3]'
                                                    : 'border-[#30363d] hover:border-[#484f58] text-[#8b949e]'}`, children: [_jsx("input", { type: "radio", name: `q-${currentQ.id}`, value: opt, checked: answers[currentQ.id] === opt, onChange: () => setAnswer(currentQ.id, opt), className: "accent-[#bc8cff]" }), _jsx("span", { className: "font-bold text-xs", children: opt })] }, opt)))] })) : (_jsxs("div", { children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-2", children: "Your Answer" }), _jsx("input", { type: "text", value: answers[currentQ.id] ?? '', onChange: e => setAnswer(currentQ.id, e.target.value), placeholder: "Enter your numerical answer\u2026", className: "w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2.5 text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#bc8cff] transition-colors text-sm font-mono", onKeyDown: e => {
                                                    if (e.key === 'Enter' && currentIdx < questions.length - 1) {
                                                        setCurrentIdx(i => i + 1);
                                                    }
                                                } }), _jsx("div", { className: "text-[#484f58] mt-1.5", children: "Press Enter to go to the next question" })] })), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: () => setCurrentIdx(i => Math.max(0, i - 1)), disabled: currentIdx === 0, className: "px-4 py-2 rounded border border-[#30363d] text-[#8b949e] disabled:opacity-30 hover:border-[#484f58] transition-colors", children: "\u2190 Previous" }), currentIdx < questions.length - 1 ? (_jsx("button", { onClick: () => setCurrentIdx(i => i + 1), className: "px-4 py-2 rounded border border-[#30363d] text-[#8b949e] hover:border-[#484f58] transition-colors", children: "Next \u2192" })) : null] })] })), _jsxs("div", { className: "border-t border-[#30363d] bg-[#161b22] px-6 py-3 flex items-center justify-between flex-shrink-0", children: [_jsx("div", { className: "text-[#8b949e]", children: allAnswered
                                            ? _jsx("span", { className: "text-[#3fb950]", children: "\u2713 All questions answered" })
                                            : _jsxs("span", { children: [questions.length - answered, " question", questions.length - answered !== 1 ? 's' : '', " unanswered"] }) }), _jsxs("div", { className: "flex items-center gap-3", children: [submitError && _jsxs("span", { className: "text-[#f85149]", children: ["\u2717 ", submitError] }), _jsx("button", { onClick: handleSubmit, disabled: submitting || submitted, className: "bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold py-2 px-6 rounded border border-[#2ea043] disabled:border-[#30363d] transition-all", children: submitting ? 'Submitting…' : 'Submit Assessment' })] })] })] })] })] }));
}
