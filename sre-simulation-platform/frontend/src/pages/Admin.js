import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
    .replace('ws://', 'http://')
    .replace('wss://', 'https://');
const SCENARIOS = [
    { id: 'cache-db-cascade', name: 'Redis Cache → DB Cascade', difficulty: 'SENIOR', timeLimit: 10 },
    { id: 'network-partition', name: 'Network Partition & Split Brain', difficulty: 'STAFF', timeLimit: 15, disabled: true },
    { id: 'memory-leak', name: 'Gradual Memory Leak', difficulty: 'MID', timeLimit: 12, disabled: true },
    { id: 'deployment-rollout', name: 'Bad Deployment Rollout', difficulty: 'MID', timeLimit: 10, disabled: true },
];
export default function Admin({ onBack }) {
    const [adminKey, setAdminKey] = useState('');
    const [authed, setAuthed] = useState(false);
    const [authError, setAuthError] = useState('');
    const [tab, setTab] = useState('assign');
    // Assign tab
    const [assignments, setAssignments] = useState([]);
    const [candidateName, setCandidateName] = useState('');
    const [moduleType, setModuleType] = useState('incident');
    const [scenarioId, setScenarioId] = useState('cache-db-cascade');
    const [selectedQuestionId, setSelectedQuestionId] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState('');
    // Results tab
    const [sessions, setSessions] = useState([]);
    const [expandedSession, setExpandedSession] = useState(null);
    const [scorecardCache, setScorecardCache] = useState({});
    // SQL tab
    const [sqlQuestions, setSqlQuestions] = useState([]);
    const [sqlForm, setSqlForm] = useState({ title: '', description: '', difficulty: 'medium', question_type: 'write', starter_query: '', expected_output: '{}', schema_hint: '', hint: '', time_limit_seconds: '300' });
    const [sqlFormError, setSqlFormError] = useState('');
    const [sqlFormSuccess, setSqlFormSuccess] = useState('');
    // Monitoring tab
    const [monitoringQuestions, setMonitoringQuestions] = useState([]);
    const [monForm, setMonForm] = useState({ title: '', scenario: '', difficulty: 'medium', sub_questions: '', time_limit_seconds: '600' });
    const [monFormError, setMonFormError] = useState('');
    const [monFormSuccess, setMonFormSuccess] = useState('');
    async function handleAuth(e) {
        e.preventDefault();
        setAuthError('');
        try {
            const res = await fetch(`${API_BASE}/admin/assignments`, { headers: { 'x-admin-key': adminKey } });
            if (res.status === 401) {
                setAuthError('Invalid admin key');
                return;
            }
            setAssignments(await res.json());
            setAuthed(true);
        }
        catch {
            setAuthError('Could not reach backend');
        }
    }
    async function loadAssignments() {
        try {
            const res = await fetch(`${API_BASE}/admin/assignments`, { headers: { 'x-admin-key': adminKey } });
            setAssignments(await res.json());
        }
        catch { /* ignore */ }
    }
    async function loadSessions() {
        try {
            const res = await fetch(`${API_BASE}/sessions`);
            setSessions(await res.json());
        }
        catch { /* ignore */ }
    }
    async function loadSqlQuestions() {
        try {
            const res = await fetch(`${API_BASE}/sql/admin/questions`, { headers: { 'x-admin-key': adminKey } });
            if (res.ok)
                setSqlQuestions(await res.json());
        }
        catch { /* ignore */ }
    }
    async function loadMonitoringQuestions() {
        try {
            const res = await fetch(`${API_BASE}/monitoring/admin/questions`, { headers: { 'x-admin-key': adminKey } });
            if (res.ok)
                setMonitoringQuestions(await res.json());
        }
        catch { /* ignore */ }
    }
    useEffect(() => {
        if (!authed)
            return;
        loadAssignments();
        loadSessions();
        loadSqlQuestions();
        loadMonitoringQuestions();
        const iv = setInterval(() => { loadAssignments(); loadSessions(); }, 15000);
        return () => clearInterval(iv);
    }, [authed]);
    async function loadScorecard(sessionId) {
        if (scorecardCache[sessionId]) {
            setExpandedSession(expandedSession === sessionId ? null : sessionId);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/sessions/${sessionId}/scorecard`);
            if (res.ok) {
                const sc = await res.json();
                setScorecardCache(c => ({ ...c, [sessionId]: sc }));
            }
        }
        catch { /* ignore */ }
        setExpandedSession(expandedSession === sessionId ? null : sessionId);
    }
    async function handleCreate(e) {
        e.preventDefault();
        if (!candidateName.trim())
            return;
        if ((moduleType === 'sql' || moduleType === 'monitoring') && !selectedQuestionId) {
            setCreateError('Select a question for this module');
            return;
        }
        setCreating(true);
        setCreateError('');
        setCreateSuccess('');
        try {
            const body = { candidate_name: candidateName.trim(), module_type: moduleType };
            if (moduleType === 'incident')
                body.scenario_id = scenarioId;
            if (moduleType === 'sql' || moduleType === 'monitoring')
                body.question_id = selectedQuestionId;
            const res = await fetch(`${API_BASE}/admin/assignments`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                setCreateError((await res.json()).error);
            }
            else {
                setCandidateName('');
                setSelectedQuestionId('');
                const modLabel = moduleType === 'incident' ? SCENARIOS.find(s => s.id === scenarioId)?.name
                    : moduleType === 'sql' ? sqlQuestions.find(q => q.id === selectedQuestionId)?.title
                        : monitoringQuestions.find(q => q.id === selectedQuestionId)?.title;
                setCreateSuccess(`✓ Assigned "${candidateName.trim()}" → ${modLabel ?? moduleType}`);
                await loadAssignments();
            }
        }
        catch (err) {
            setCreateError(String(err));
        }
        finally {
            setCreating(false);
        }
    }
    async function handleDeleteAssignment(id) {
        try {
            await fetch(`${API_BASE}/admin/assignments/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } });
            await loadAssignments();
        }
        catch { /* ignore */ }
    }
    async function handleCreateSqlQuestion(e) {
        e.preventDefault();
        setSqlFormError('');
        setSqlFormSuccess('');
        let expectedOutput = {};
        try {
            expectedOutput = JSON.parse(sqlForm.expected_output);
        }
        catch {
            setSqlFormError('Expected output must be valid JSON');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/sql/admin/questions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
                body: JSON.stringify({ ...sqlForm, time_limit_seconds: Number(sqlForm.time_limit_seconds), expected_output: expectedOutput })
            });
            if (!res.ok) {
                setSqlFormError((await res.json()).error);
                return;
            }
            setSqlFormSuccess('✓ SQL question created');
            setSqlForm({ title: '', description: '', difficulty: 'medium', question_type: 'write', starter_query: '', expected_output: '{}', schema_hint: '', hint: '', time_limit_seconds: '300' });
            await loadSqlQuestions();
        }
        catch (err) {
            setSqlFormError(String(err));
        }
    }
    async function handleDeleteSqlQuestion(id) {
        await fetch(`${API_BASE}/sql/admin/questions/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } });
        await loadSqlQuestions();
    }
    async function handleCreateMonitoringQuestion(e) {
        e.preventDefault();
        setMonFormError('');
        setMonFormSuccess('');
        let subQs = [];
        try {
            subQs = JSON.parse(monForm.sub_questions);
        }
        catch {
            setMonFormError('Sub-questions must be valid JSON array');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/monitoring/admin/questions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
                body: JSON.stringify({ title: monForm.title, scenario: monForm.scenario, difficulty: monForm.difficulty, sub_questions: subQs, time_limit_seconds: Number(monForm.time_limit_seconds) })
            });
            if (!res.ok) {
                setMonFormError((await res.json()).error);
                return;
            }
            setMonFormSuccess('✓ Monitoring question created');
            setMonForm({ title: '', scenario: '', difficulty: 'medium', sub_questions: '', time_limit_seconds: '600' });
            await loadMonitoringQuestions();
        }
        catch (err) {
            setMonFormError(String(err));
        }
    }
    async function handleDeleteMonitoringQuestion(id) {
        await fetch(`${API_BASE}/monitoring/admin/questions/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } });
        await loadMonitoringQuestions();
    }
    function fmt(iso) {
        return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    }
    function scoreColor(score) {
        if (score >= 80)
            return 'text-[#3fb950]';
        if (score >= 50)
            return 'text-[#d29922]';
        return 'text-[#f85149]';
    }
    function ratingLabel(score) {
        return score >= 80 ? 'GOOD' : score >= 50 ? 'MANAGING' : 'LEARNING';
    }
    function moduleLabel(mt) {
        if (mt === 'sql')
            return 'SQL';
        if (mt === 'monitoring')
            return 'MONITORING';
        return 'INCIDENT';
    }
    const inputCls = "w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors";
    const labelCls = "block text-[#8b949e] mb-1.5";
    return (_jsx("div", { className: "min-h-screen bg-[#0d1117] font-mono text-xs px-4 py-8", children: _jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsxs("div", { className: "flex items-center gap-4 mb-8", children: [_jsx("button", { onClick: onBack, className: "text-[#58a6ff] hover:text-[#79c0ff] transition-colors", children: "\u2190 Back" }), _jsxs("div", { children: [_jsx("h1", { className: "text-[#e6edf3] text-xl font-bold", children: "Admin Panel" }), _jsx("div", { className: "text-[#8b949e] mt-0.5", children: "Manage assignments, questions, and view results" })] })] }), !authed ? (_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-6 max-w-sm mx-auto", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-4", children: "Admin Authentication" }), _jsxs("form", { onSubmit: handleAuth, className: "space-y-4", children: [_jsx("input", { type: "password", value: adminKey, onChange: e => setAdminKey(e.target.value), placeholder: "Admin key", className: inputCls, autoFocus: true }), authError && _jsxs("div", { className: "text-[#f85149]", children: ["\u2717 ", authError] }), _jsx("button", { type: "submit", className: "w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 rounded border border-[#2ea043] transition-colors", children: "Sign In" })] }), ] })) : (_jsxs("div", { className: "space-y-5", children: [_jsx("div", { className: "flex border-b border-[#30363d] overflow-x-auto", children: [
                                ['assign', '📋 Assign'],
                                ['sql', '🗄 SQL Questions'],
                                ['monitoring', '📊 Monitoring Questions'],
                                ['results', '🏆 Results'],
                            ].map(([id, label]) => (_jsx("button", { onClick: () => setTab(id), className: `px-5 py-2.5 text-xs whitespace-nowrap border-b-2 transition-colors ${tab === id ? 'border-[#3fb950] text-[#e6edf3]' : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'}`, children: label }, id))) }), tab === 'assign' && (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-5", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-4", children: "New Assignment" }), _jsxs("form", { onSubmit: handleCreate, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Candidate Name" }), _jsx("input", { type: "text", value: candidateName, onChange: e => setCandidateName(e.target.value), placeholder: "Exact name candidate will use to log in", className: inputCls, autoFocus: true })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Module Type" }), _jsx("div", { className: "flex gap-2 flex-wrap", children: ['incident', 'sql', 'monitoring'].map(m => (_jsx("button", { type: "button", onClick: () => { setModuleType(m); setSelectedQuestionId(''); }, className: `px-4 py-1.5 rounded border text-xs font-bold transition-colors ${moduleType === m ? 'border-[#3fb950] text-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] text-[#8b949e] hover:border-[#484f58]'}`, children: m === 'incident' ? 'Incident Simulation' : m === 'sql' ? 'SQL Readiness' : 'Monitoring Design' }, m))) })] }), moduleType === 'incident' && (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Scenario" }), _jsx("div", { className: "space-y-2", children: SCENARIOS.map(s => (_jsxs("label", { className: `flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${s.disabled ? 'opacity-40 cursor-not-allowed border-[#30363d]'
                                                                    : scenarioId === s.id ? 'border-[#3fb950] bg-[#0d1117]'
                                                                        : 'border-[#30363d] hover:border-[#484f58]'}`, children: [_jsx("input", { type: "radio", name: "scenario", value: s.id, checked: scenarioId === s.id, onChange: () => !s.disabled && setScenarioId(s.id), disabled: s.disabled, className: "accent-[#3fb950]" }), _jsx("span", { className: "text-[#e6edf3] flex-1", children: s.name }), _jsxs("span", { className: "text-[#8b949e]", children: [s.timeLimit, "min"] }), s.disabled && _jsx("span", { className: "text-[#484f58] text-[10px]", children: "COMING SOON" })] }, s.id))) })] })), moduleType === 'sql' && (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "SQL Question" }), sqlQuestions.length === 0 ? (_jsx("div", { className: "text-[#484f58]", children: "No SQL questions yet \u2014 create some in the SQL Questions tab" })) : (_jsx("div", { className: "space-y-1.5", children: sqlQuestions.map(q => (_jsxs("label", { className: `flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedQuestionId === q.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`, children: [_jsx("input", { type: "radio", name: "sql_question", value: q.id, checked: selectedQuestionId === q.id, onChange: () => setSelectedQuestionId(q.id), className: "accent-[#3fb950]" }), _jsx("span", { className: "text-[#e6edf3] flex-1", children: q.title }), _jsxs("span", { className: "text-[#484f58] text-[10px] uppercase", children: [q.difficulty, " \u00B7 ", q.question_type] })] }, q.id))) }))] })), moduleType === 'monitoring' && (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Monitoring Question" }), monitoringQuestions.length === 0 ? (_jsx("div", { className: "text-[#484f58]", children: "No monitoring questions yet \u2014 create some in the Monitoring Questions tab" })) : (_jsx("div", { className: "space-y-1.5", children: monitoringQuestions.map(q => (_jsxs("label", { className: `flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedQuestionId === q.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`, children: [_jsx("input", { type: "radio", name: "mon_question", value: q.id, checked: selectedQuestionId === q.id, onChange: () => setSelectedQuestionId(q.id), className: "accent-[#3fb950]" }), _jsx("span", { className: "text-[#e6edf3] flex-1", children: q.title }), _jsx("span", { className: "text-[#484f58] text-[10px] uppercase", children: q.difficulty })] }, q.id))) }))] })), createError && _jsxs("div", { className: "text-[#f85149]", children: ["\u2717 ", createError] }), createSuccess && _jsx("div", { className: "text-[#3fb950]", children: createSuccess }), _jsx("button", { type: "submit", disabled: !candidateName.trim() || creating, className: "bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold py-2 px-6 rounded border border-[#2ea043] disabled:border-[#30363d] transition-all", children: creating ? 'Assigning…' : '+ Assign' })] })] }), _jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden", children: [_jsxs("div", { className: "px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest", children: ["Assignments (", assignments.length, ")"] }), assignments.length === 0 ? (_jsx("div", { className: "px-5 py-8 text-center text-[#484f58]", children: "No assignments yet" })) : (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-[#484f58] border-b border-[#30363d]", children: [_jsx("th", { className: "text-left px-4 py-2", children: "Candidate" }), _jsx("th", { className: "text-left px-4 py-2", children: "Module" }), _jsx("th", { className: "text-left px-4 py-2", children: "Created" }), _jsx("th", { className: "text-left px-4 py-2", children: "Status" }), _jsx("th", { className: "px-4 py-2" })] }) }), _jsx("tbody", { children: assignments.map(a => (_jsxs("tr", { className: "border-b border-[#30363d] last:border-0 hover:bg-[#1c2128] transition-colors", children: [_jsx("td", { className: "px-4 py-2.5 text-[#e6edf3] font-bold", children: a.candidate_name }), _jsx("td", { className: "px-4 py-2.5", children: _jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded border font-bold ${a.module_type === 'sql' ? 'border-[#58a6ff] text-[#58a6ff]' : a.module_type === 'monitoring' ? 'border-[#bc8cff] text-[#bc8cff]' : 'border-[#d29922] text-[#d29922]'}`, children: moduleLabel(a.module_type ?? 'incident') }) }), _jsx("td", { className: "px-4 py-2.5 text-[#484f58]", children: fmt(a.created_at) }), _jsx("td", { className: "px-4 py-2.5", children: _jsx("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-bold border ${a.status === 'pending' ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#484f58] text-[#484f58]'}`, children: a.status.toUpperCase() }) }), _jsx("td", { className: "px-4 py-2.5 text-right", children: a.status === 'pending' && (_jsx("button", { onClick: () => handleDeleteAssignment(a.id), className: "text-[#484f58] hover:text-[#f85149] transition-colors", title: "Delete", children: "\u2715" })) })] }, a.id))) })] }))] })] })), tab === 'sql' && (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-5", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-4", children: "Create SQL Question" }), _jsxs("form", { onSubmit: handleCreateSqlQuestion, className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Title" }), _jsx("input", { value: sqlForm.title, onChange: e => setSqlForm(f => ({ ...f, title: e.target.value })), placeholder: "e.g. Find employees by dept", className: inputCls })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Difficulty" }), _jsxs("select", { value: sqlForm.difficulty, onChange: e => setSqlForm(f => ({ ...f, difficulty: e.target.value })), className: inputCls, children: [_jsx("option", { value: "easy", children: "Easy" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "hard", children: "Hard" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Type" }), _jsxs("select", { value: sqlForm.question_type, onChange: e => setSqlForm(f => ({ ...f, question_type: e.target.value })), className: inputCls, children: [_jsx("option", { value: "write", children: "Write" }), _jsx("option", { value: "fix", children: "Fix" }), _jsx("option", { value: "identify", children: "Identify" })] })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Description" }), _jsx("textarea", { value: sqlForm.description, onChange: e => setSqlForm(f => ({ ...f, description: e.target.value })), rows: 3, placeholder: "What should the candidate do?", className: inputCls + ' resize-none' })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Starter Query (optional)" }), _jsx("textarea", { value: sqlForm.starter_query, onChange: e => setSqlForm(f => ({ ...f, starter_query: e.target.value })), rows: 3, placeholder: "SELECT ...", className: inputCls + ' resize-none font-mono text-[11px]' })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Expected Output (JSON)" }), _jsxs("div", { className: "text-[#484f58] text-[10px] mb-1", children: ["Format: ", '{ "columns": ["col1"], "rows": [{"col1": "val"}] }'] }), _jsx("textarea", { value: sqlForm.expected_output, onChange: e => setSqlForm(f => ({ ...f, expected_output: e.target.value })), rows: 3, className: inputCls + ' resize-none font-mono text-[11px]' })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Schema Hint" }), _jsx("textarea", { value: sqlForm.schema_hint, onChange: e => setSqlForm(f => ({ ...f, schema_hint: e.target.value })), rows: 3, placeholder: "Table definitions...", className: inputCls + ' resize-none font-mono text-[11px]' })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Hint (shown on request)" }), _jsx("textarea", { value: sqlForm.hint, onChange: e => setSqlForm(f => ({ ...f, hint: e.target.value })), rows: 3, placeholder: "Optional hint...", className: inputCls + ' resize-none' })] })] }), _jsx("div", { className: "flex items-center gap-4", children: _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Time Limit (seconds)" }), _jsx("input", { type: "number", value: sqlForm.time_limit_seconds, onChange: e => setSqlForm(f => ({ ...f, time_limit_seconds: e.target.value })), className: inputCls + ' w-32' })] }) }), sqlFormError && _jsxs("div", { className: "text-[#f85149]", children: ["\u2717 ", sqlFormError] }), sqlFormSuccess && _jsx("div", { className: "text-[#3fb950]", children: sqlFormSuccess }), _jsx("button", { type: "submit", className: "bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all", children: "+ Create SQL Question" })] })] }), _jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden", children: [_jsxs("div", { className: "px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest", children: ["Questions (", sqlQuestions.length, ")"] }), sqlQuestions.length === 0 ? (_jsxs("div", { className: "px-5 py-8 text-center text-[#484f58]", children: ["No SQL questions yet. Run ", _jsx("code", { className: "text-[#8b949e]", children: "npm run db:seed-questions" }), " on the backend to seed examples."] })) : (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-[#484f58] border-b border-[#30363d]", children: [_jsx("th", { className: "text-left px-4 py-2", children: "Title" }), _jsx("th", { className: "text-left px-4 py-2", children: "Difficulty" }), _jsx("th", { className: "text-left px-4 py-2", children: "Type" }), _jsx("th", { className: "text-left px-4 py-2", children: "Time" }), _jsx("th", { className: "px-4 py-2" })] }) }), _jsx("tbody", { children: sqlQuestions.map(q => (_jsxs("tr", { className: "border-b border-[#30363d] last:border-0 hover:bg-[#1c2128]", children: [_jsx("td", { className: "px-4 py-2.5 text-[#e6edf3]", children: q.title }), _jsx("td", { className: "px-4 py-2.5 text-[#8b949e] uppercase text-[10px]", children: q.difficulty }), _jsx("td", { className: "px-4 py-2.5 text-[#8b949e] uppercase text-[10px]", children: q.question_type }), _jsxs("td", { className: "px-4 py-2.5 text-[#484f58]", children: [Math.round(q.time_limit_seconds / 60), "min"] }), _jsx("td", { className: "px-4 py-2.5 text-right", children: _jsx("button", { onClick: () => handleDeleteSqlQuestion(q.id), className: "text-[#484f58] hover:text-[#f85149] transition-colors", children: "\u2715" }) })] }, q.id))) })] }))] })] })), tab === 'monitoring' && (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-5", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-4", children: "Create Monitoring Question" }), _jsxs("form", { onSubmit: handleCreateMonitoringQuestion, className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Title" }), _jsx("input", { value: monForm.title, onChange: e => setMonForm(f => ({ ...f, title: e.target.value })), placeholder: "e.g. Redis Cache Alerting Setup", className: inputCls })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Difficulty" }), _jsxs("select", { value: monForm.difficulty, onChange: e => setMonForm(f => ({ ...f, difficulty: e.target.value })), className: inputCls, children: [_jsx("option", { value: "easy", children: "Easy" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "hard", children: "Hard" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Time Limit (sec)" }), _jsx("input", { type: "number", value: monForm.time_limit_seconds, onChange: e => setMonForm(f => ({ ...f, time_limit_seconds: e.target.value })), className: inputCls })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Scenario Description" }), _jsx("textarea", { value: monForm.scenario, onChange: e => setMonForm(f => ({ ...f, scenario: e.target.value })), rows: 4, placeholder: "Describe the system context...", className: inputCls + ' resize-none' })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Sub-Questions (JSON array)" }), _jsx("div", { className: "text-[#484f58] text-[10px] mb-1.5", children: '[{ "id": "q1", "prompt": "...", "type": "promql|nrql|text|yaml", "placeholder": "...", "required_keywords": [], "bonus_keywords": [], "reference_answer": "..." }]' }), _jsx("textarea", { value: monForm.sub_questions, onChange: e => setMonForm(f => ({ ...f, sub_questions: e.target.value })), rows: 8, placeholder: '[\n  {\n    "id": "q1",\n    "prompt": "Write a PromQL alert for high error rate",\n    "type": "promql",\n    "placeholder": "rate(http_errors_total[5m])",\n    "required_keywords": ["rate", "5m"],\n    "bonus_keywords": ["by (service)"],\n    "reference_answer": "rate(http_errors_total[5m]) > 0.05"\n  }\n]', className: inputCls + ' resize-none font-mono text-[11px]' })] }), monFormError && _jsxs("div", { className: "text-[#f85149]", children: ["\u2717 ", monFormError] }), monFormSuccess && _jsx("div", { className: "text-[#3fb950]", children: monFormSuccess }), _jsx("button", { type: "submit", className: "bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all", children: "+ Create Monitoring Question" })] })] }), _jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden", children: [_jsxs("div", { className: "px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest", children: ["Questions (", monitoringQuestions.length, ")"] }), monitoringQuestions.length === 0 ? (_jsxs("div", { className: "px-5 py-8 text-center text-[#484f58]", children: ["No monitoring questions yet. Run ", _jsx("code", { className: "text-[#8b949e]", children: "npm run db:seed-questions" }), " on the backend to seed examples."] })) : (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-[#484f58] border-b border-[#30363d]", children: [_jsx("th", { className: "text-left px-4 py-2", children: "Title" }), _jsx("th", { className: "text-left px-4 py-2", children: "Difficulty" }), _jsx("th", { className: "text-left px-4 py-2", children: "Time" }), _jsx("th", { className: "px-4 py-2" })] }) }), _jsx("tbody", { children: monitoringQuestions.map(q => (_jsxs("tr", { className: "border-b border-[#30363d] last:border-0 hover:bg-[#1c2128]", children: [_jsx("td", { className: "px-4 py-2.5 text-[#e6edf3]", children: q.title }), _jsx("td", { className: "px-4 py-2.5 text-[#8b949e] uppercase text-[10px]", children: q.difficulty }), _jsxs("td", { className: "px-4 py-2.5 text-[#484f58]", children: [Math.round(q.time_limit_seconds / 60), "min"] }), _jsx("td", { className: "px-4 py-2.5 text-right", children: _jsx("button", { onClick: () => handleDeleteMonitoringQuestion(q.id), className: "text-[#484f58] hover:text-[#f85149] transition-colors", children: "\u2715" }) })] }, q.id))) })] }))] })] })), tab === 'results' && (_jsx("div", { className: "space-y-3", children: sessions.length === 0 ? (_jsx("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-12 text-center text-[#484f58]", children: "No completed sessions yet" })) : sessions.map(session => {
                                const sc = scorecardCache[session.id];
                                const isExpanded = expandedSession === session.id;
                                const score = session.overall_score;
                                const rating = score !== null ? ratingLabel(score) : null;
                                return (_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#1c2128] transition-colors", onClick: () => loadScorecard(session.id), children: [_jsx("div", { className: `w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 font-bold text-sm ${score === null ? 'border-[#30363d] text-[#484f58]'
                                                        : score >= 80 ? 'border-[#3fb950] text-[#3fb950]'
                                                            : score >= 50 ? 'border-[#d29922] text-[#d29922]'
                                                                : 'border-[#f85149] text-[#f85149]'}`, children: score ?? '—' }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "text-[#e6edf3] font-bold", children: session.candidate_name }), rating && (_jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded border font-bold ${score >= 80 ? 'border-[#3fb950] text-[#3fb950]' : score >= 50 ? 'border-[#d29922] text-[#d29922]' : 'border-[#f85149] text-[#f85149]'}`, children: rating })), _jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded border ${session.status === 'active' ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#30363d] text-[#484f58]'}`, children: session.status.toUpperCase() })] }), _jsx("div", { className: "text-[#8b949e] mt-0.5", children: session.scenario_name ?? session.scenario_id })] }), _jsxs("div", { className: "text-right text-[#484f58] flex-shrink-0", children: [_jsx("div", { children: fmt(session.started_at) }), session.ended_at && _jsx("div", { className: "mt-0.5", children: fmt(session.ended_at) })] }), _jsx("span", { className: "text-[#484f58] ml-1", children: isExpanded ? '▲' : '▼' })] }), isExpanded && sc && (_jsxs("div", { className: "border-t border-[#30363d] px-4 py-4 bg-[#0d1117] space-y-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-2", children: "Score Breakdown" }), _jsx("div", { className: "space-y-2", children: Object.entries(sc.dimensions).map(([key, dim]) => {
                                                                const pct = Math.round((dim.score / dim.max) * 100);
                                                                const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                                                return (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between mb-1", children: [_jsx("span", { className: "text-[#8b949e]", children: label }), _jsxs("span", { className: scoreColor(pct), children: [dim.score, "/", dim.max] })] }), _jsx("div", { className: "h-1.5 bg-[#161b22] rounded overflow-hidden", children: _jsx("div", { className: `h-full rounded ${pct >= 80 ? 'bg-[#3fb950]' : pct >= 50 ? 'bg-[#d29922]' : 'bg-[#f85149]'}`, style: { width: `${pct}%` } }) })] }, key));
                                                            }) })] }), sc.timeline_highlights?.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-2", children: "Highlights" }), _jsx("div", { className: "space-y-1", children: sc.timeline_highlights.map((h, i) => (_jsxs("div", { className: "flex gap-2", children: [_jsx("span", { className: "text-[#3fb950]", children: "\u2713" }), _jsx("span", { className: "text-[#e6edf3]", children: h })] }, i))) })] })), sc.postmortem && (_jsxs("div", { children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-2", children: "Summary" }), _jsx("div", { className: "text-[#e6edf3] leading-relaxed bg-[#161b22] rounded p-3 border border-[#30363d]", children: sc.postmortem })] }))] })), isExpanded && !sc && session.status !== 'active' && (_jsx("div", { className: "border-t border-[#30363d] px-4 py-4 bg-[#0d1117] text-[#484f58] text-center", children: "No scorecard available yet" })), isExpanded && session.status === 'active' && (_jsx("div", { className: "border-t border-[#30363d] px-4 py-4 bg-[#0d1117] text-[#3fb950] text-center", children: "\u25CF Session in progress\u2026" }))] }, session.id));
                            }) }))] }))] }) }));
}
