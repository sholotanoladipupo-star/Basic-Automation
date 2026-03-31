import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
    .replace('ws://', 'http://')
    .replace('wss://', 'https://')
    .replace('wss://', 'https://');
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
export default function SQLSimulation({ sessionInfo }) {
    const [question, setQuestion] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [query, setQuery] = useState('');
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [scoreResult, setScoreResult] = useState(null);
    const [elapsed, setElapsed] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [schema, setSchema] = useState(null);
    const [activeSchemaTable, setActiveSchemaTable] = useState(null);
    const [schemaOpen, setSchemaOpen] = useState(true);
    const [syntaxOpen, setSyntaxOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef(null);
    const timerRef = useRef(null);
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
        }
        else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
        }
    }
    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);
    // Enforce minimum 8-minute time limit
    const timeLimit = Math.max(question?.time_limit_seconds ?? 480, 480);
    const remaining = Math.max(0, timeLimit - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timedOut = remaining === 0 && !submitted;
    useEffect(() => {
        if (!sessionInfo.question_id) {
            setLoadError('No question assigned. Contact your assessor.');
            return;
        }
        fetch(`${API_BASE}/sql/questions/${sessionInfo.question_id}`)
            .then(r => r.json())
            .then((q) => {
            setQuestion(q);
            setQuery(q.starter_query ?? '');
        })
            .catch(() => setLoadError('Failed to load question. Please refresh.'));
        // Load schema browser in background
        fetch(`${API_BASE}/sql/schema`)
            .then(r => r.json())
            .then((s) => {
            setSchema(s);
            setActiveSchemaTable(Object.keys(s)[0] ?? null);
        })
            .catch(() => { });
    }, [sessionInfo.question_id]);
    useEffect(() => {
        if (!question || submitted || timedOut)
            return;
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
        return () => { if (timerRef.current)
            clearInterval(timerRef.current); };
    }, [question, submitted, timedOut]);
    // Auto-submit on timeout
    useEffect(() => {
        if (timedOut && !submitted && question) {
            if (timerRef.current)
                clearInterval(timerRef.current);
            handleSubmit();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timedOut]);
    async function handleRun() {
        if (!query.trim() || running)
            return;
        setRunning(true);
        setRunResult(null);
        try {
            const res = await fetch(`${API_BASE}/sql/execute`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ query })
            });
            setRunResult(await res.json());
        }
        catch (err) {
            setRunResult({ columns: [], rows: [], row_count: 0, error: String(err) });
        }
        finally {
            setRunning(false);
        }
    }
    async function handleSubmit() {
        if (!query.trim() || submitted || !question)
            return;
        if (timerRef.current)
            clearInterval(timerRef.current);
        setRunning(true);
        setSubmitError('');
        try {
            const res = await fetch(`${API_BASE}/sql/submit`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ session_id: sessionInfo.session_id, question_id: question.id, query })
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
            setRunning(false);
        }
    }
    if (loadError) {
        return (_jsx("div", { className: "min-h-screen bg-[#0d1117] flex items-center justify-center", children: _jsx("div", { className: "text-[#f85149] font-mono text-sm", children: loadError }) }));
    }
    if (!question) {
        return (_jsx("div", { className: "min-h-screen bg-[#0d1117] flex items-center justify-center", children: _jsx("div", { className: "text-[#8b949e] font-mono text-sm animate-pulse", children: "Loading question\u2026" }) }));
    }
    return (_jsxs("div", { ref: containerRef, className: "min-h-screen bg-[#0d1117] font-mono text-xs flex flex-col", children: [submitted && (_jsxs("div", { className: "bg-[#0f2a1a] border-b border-[#3fb950] px-4 py-3 text-center flex-shrink-0", children: [_jsx("span", { className: "text-[#3fb950] font-bold text-sm", children: "\u2713 Exercise Submitted" }), _jsx("span", { className: "text-[#8b949e] text-xs block mt-0.5", children: "Your answers have been recorded. Your assessor will review your results." })] })), _jsxs("div", { className: "bg-[#161b22] border-b border-[#30363d] px-4 py-2.5 flex items-center justify-between flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-[#58a6ff] font-bold text-sm", children: "SQL Readiness Assessment" }), _jsx("span", { className: `px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${question.difficulty === 'easy' ? 'border-[#3fb950] text-[#3fb950]'
                                    : question.difficulty === 'medium' ? 'border-[#d29922] text-[#d29922]'
                                        : 'border-[#f85149] text-[#f85149]'}`, children: question.difficulty }), _jsx("span", { className: "text-[#484f58] capitalize", children: question.question_type === 'fix' ? 'Fix the Query' : question.question_type === 'identify' ? 'Identify the Issue' : 'Write a Query' })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `text-sm font-bold tabular-nums ${remaining < 120 ? 'text-[#f85149] animate-pulse' : remaining < 300 ? 'text-[#d29922]' : 'text-[#3fb950]'}`, children: timedOut ? 'TIME UP' : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` }), _jsx("button", { onClick: toggleFullscreen, title: isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen', className: "text-[#484f58] hover:text-[#8b949e] transition-colors text-sm px-1", children: isFullscreen ? '✕FS' : '⛶' })] })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsxs("div", { className: "w-2/5 border-r border-[#30363d] overflow-y-auto flex flex-col", children: [_jsxs("div", { className: "p-5 space-y-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[#e6edf3] text-sm font-bold mb-2", children: question.title }), _jsx("div", { className: "text-[#8b949e] leading-relaxed whitespace-pre-wrap", children: question.description })] }), question.hint && (_jsxs("div", { children: [_jsx("button", { onClick: () => setShowHint(!showHint), className: "text-[#d29922] hover:text-[#e3b341] transition-colors underline", children: showHint ? 'Hide hint' : 'Show hint' }), showHint && (_jsx("div", { className: "mt-2 bg-[#161b22] border border-[#d29922] rounded p-3 text-[#d29922] leading-relaxed", children: question.hint }))] }))] }), _jsxs("div", { className: "border-t border-[#30363d]", children: [_jsxs("button", { onClick: () => setSyntaxOpen(o => !o), className: "w-full px-5 py-2.5 flex items-center justify-between text-[#484f58] uppercase tracking-widest hover:text-[#8b949e] transition-colors", children: [_jsx("span", { children: "SQL Syntax Reference" }), _jsx("span", { className: "text-[10px]", children: syntaxOpen ? '▲' : '▼' })] }), syntaxOpen && (_jsx("div", { className: "px-5 pb-4 space-y-3 text-[11px]", children: [
                                            { label: 'SELECT', code: 'SELECT col1, col2\nFROM table\nWHERE condition\nORDER BY col ASC\nLIMIT 10;' },
                                            { label: 'JOIN', code: 'SELECT a.id, b.name\nFROM a\nINNER JOIN b ON a.id = b.a_id\nLEFT JOIN c ON a.id = c.a_id;' },
                                            { label: 'GROUP BY / HAVING', code: 'SELECT dept, COUNT(*) as cnt, AVG(salary)\nFROM employees\nGROUP BY dept\nHAVING COUNT(*) > 5;' },
                                            { label: 'Subquery', code: 'SELECT name FROM employees\nWHERE salary > (\n  SELECT AVG(salary) FROM employees\n);' },
                                            { label: 'CASE', code: 'SELECT name,\n  CASE\n    WHEN salary > 80000 THEN \'Senior\'\n    WHEN salary > 50000 THEN \'Mid\'\n    ELSE \'Junior\'\n  END AS level\nFROM employees;' },
                                            { label: 'Date functions', code: 'WHERE hire_date >= NOW() - INTERVAL \'1 year\'\nAND EXTRACT(YEAR FROM hire_date) = 2023\nAND DATE_TRUNC(\'month\', hire_date) = \'2023-01-01\'' },
                                            { label: 'String functions', code: "LOWER(col), UPPER(col)\nCONCAT(col1, ' ', col2)\nLIKE '%pattern%'\nCOALESCE(col, 'default')" },
                                            { label: 'Window functions', code: 'SELECT name, salary,\n  RANK() OVER (ORDER BY salary DESC) as rank,\n  SUM(salary) OVER (PARTITION BY dept) as dept_total\nFROM employees;' },
                                        ].map(({ label, code }) => (_jsxs("div", { children: [_jsx("div", { className: "text-[#58a6ff] font-bold text-[10px] uppercase tracking-widest mb-1", children: label }), _jsx("pre", { className: "bg-[#0d1117] border border-[#1c2128] rounded p-2 text-[#8b949e] text-[10px] whitespace-pre overflow-x-auto", children: code })] }, label))) }))] }), schema && (_jsxs("div", { className: "border-t border-[#30363d]", children: [_jsxs("button", { onClick: () => setSchemaOpen(o => !o), className: "w-full px-5 py-2.5 flex items-center justify-between text-[#484f58] uppercase tracking-widest hover:text-[#8b949e] transition-colors", children: [_jsx("span", { children: "Schema Browser" }), _jsx("span", { className: "text-[10px]", children: schemaOpen ? '▲' : '▼' })] }), schemaOpen && (_jsxs("div", { className: "px-3 pb-4", children: [_jsx("div", { className: "flex gap-1 mb-3 flex-wrap", children: Object.keys(schema).map(t => (_jsx("button", { onClick: () => setActiveSchemaTable(t), className: `px-2 py-1 rounded text-[10px] border transition-colors ${activeSchemaTable === t
                                                        ? 'border-[#58a6ff] text-[#58a6ff] bg-[#1c2128]'
                                                        : 'border-[#30363d] text-[#484f58] hover:border-[#8b949e] hover:text-[#8b949e]'}`, children: t }, t))) }), activeSchemaTable && schema[activeSchemaTable] && (_jsxs("div", { children: [_jsxs("div", { className: "mb-2", children: [_jsx("div", { className: "text-[#484f58] uppercase tracking-widest text-[9px] mb-1", children: "Columns" }), _jsx("div", { className: "flex flex-wrap gap-1", children: schema[activeSchemaTable].columns.map(c => (_jsxs("span", { className: "px-1.5 py-0.5 bg-[#1c2128] border border-[#30363d] rounded text-[#79c0ff] text-[10px]", children: [c.name, " ", _jsx("span", { className: "text-[#484f58]", children: c.type.replace('character varying', 'text').replace('timestamp with time zone', 'timestamptz') })] }, c.name))) })] }), schema[activeSchemaTable].sample_rows.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "text-[#484f58] uppercase tracking-widest text-[9px] mb-1", children: "Sample rows (5)" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-[10px]", children: [_jsx("thead", { children: _jsx("tr", { className: "text-[#484f58] border-b border-[#30363d]", children: schema[activeSchemaTable].columns.map(c => (_jsx("th", { className: "text-left px-1.5 py-1 font-normal whitespace-nowrap", children: c.name }, c.name))) }) }), _jsx("tbody", { children: schema[activeSchemaTable].sample_rows.map((row, i) => (_jsx("tr", { className: "border-b border-[#1c2128] hover:bg-[#161b22]", children: schema[activeSchemaTable].columns.map(c => (_jsx("td", { className: "px-1.5 py-1 text-[#8b949e] whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis", children: String(row[c.name] ?? '') }, c.name))) }, i))) })] }) })] }))] }))] }))] }))] }), _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex-1 flex flex-col border-b border-[#30363d] min-h-0", children: [_jsxs("div", { className: "px-4 py-2 border-b border-[#30363d] flex items-center justify-between bg-[#161b22]", children: [_jsx("span", { className: "text-[#8b949e] uppercase tracking-widest", children: "Query Editor" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: handleRun, disabled: running || submitted || timedOut || !query.trim(), className: "bg-[#0d419d] hover:bg-[#1158c7] disabled:bg-[#161b22] disabled:text-[#484f58] text-white px-4 py-1 rounded border border-[#388bfd] disabled:border-[#30363d] transition-all", children: running ? '▶ Running…' : '▶ Run' }), _jsx("button", { onClick: handleSubmit, disabled: running || submitted || timedOut || !query.trim(), className: "bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold px-4 py-1 rounded border border-[#2ea043] disabled:border-[#30363d] transition-all", children: submitted ? '✓ Submitted' : 'Submit' })] })] }), _jsx("textarea", { value: query, onChange: e => setQuery(e.target.value), disabled: submitted || timedOut, spellCheck: false, className: "flex-1 bg-[#0d1117] text-[#e6edf3] resize-none p-4 text-sm font-mono focus:outline-none disabled:opacity-60", placeholder: "-- Write your SQL query here", onKeyDown: e => {
                                            if (e.key === 'Tab') {
                                                e.preventDefault();
                                                setQuery(q => q + '    ');
                                            }
                                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                                e.preventDefault();
                                                handleRun();
                                            }
                                        } }), _jsx("div", { className: "px-4 py-1.5 bg-[#161b22] text-[#484f58] text-[10px] border-t border-[#30363d]", children: "Ctrl+Enter to run \u00B7 Submit when ready" })] }), _jsxs("div", { className: "h-64 overflow-auto bg-[#0d1117]", children: [timedOut && !submitted && (_jsxs("div", { className: "p-4 text-center", children: [_jsx("div", { className: "text-[#f85149] font-bold text-sm mb-1", children: "\u23F1 Time is up!!" }), _jsx("div", { className: "text-[#8b949e] text-xs", children: "Your query has been auto-submitted." })] })), submitError && (_jsxs("div", { className: "p-4 bg-[#1c0a0a] border-b border-[#f85149] text-[#f85149]", children: [_jsx("div", { className: "font-bold mb-1", children: "Submit Error" }), _jsx("div", { children: submitError })] })), submitted && (_jsxs("div", { className: "p-8 text-center", children: [_jsx("div", { className: "text-[#3fb950] text-3xl mb-3", children: "\u2713" }), _jsx("div", { className: "text-[#e6edf3] font-bold text-sm", children: "Exercise Submitted" }), _jsx("div", { className: "text-[#8b949e] text-xs mt-1", children: "Your assessor will review your results." })] })), !submitted && runResult && (_jsx("div", { className: "p-3", children: runResult.error ? (_jsxs("div", { className: "text-[#f85149] bg-[#1c0a0a] border border-[#f85149] rounded p-3", children: [_jsx("div", { className: "text-[#f85149] font-bold mb-1", children: "Error" }), _jsx("pre", { className: "whitespace-pre-wrap text-[11px]", children: runResult.error })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "text-[#3fb950] mb-2", children: [runResult.row_count, " row", runResult.row_count !== 1 ? 's' : '', " returned", runResult.truncated && _jsx("span", { className: "text-[#d29922] ml-2", children: "(truncated to 100)" })] }), runResult.columns.length > 0 && (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-[11px]", children: [_jsx("thead", { children: _jsx("tr", { className: "text-[#484f58] border-b border-[#30363d]", children: runResult.columns.map(c => _jsx("th", { className: "text-left px-2 py-1 font-normal", children: c }, c)) }) }), _jsx("tbody", { children: runResult.rows.map((row, i) => (_jsx("tr", { className: "border-b border-[#1c2128] hover:bg-[#161b22]", children: runResult.columns.map(c => (_jsx("td", { className: "px-2 py-1 text-[#e6edf3]", children: String(row[c] ?? '') }, c))) }, i))) })] }) }))] })) })), !submitted && !runResult && !submitError && (_jsx("div", { className: "p-4 text-[#484f58] text-center", children: "Run your query to see results here" }))] })] })] })] }));
}
