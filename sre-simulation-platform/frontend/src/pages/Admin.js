import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
    .replace('ws://', 'http://')
    .replace('wss://', 'https://');
const SCENARIOS = [
    { id: 'cache-db-cascade', name: 'Redis Cache → DB Cascade', difficulty: 'SENIOR', timeLimit: 10 },
    { id: 'db-slow-queries', name: 'Database Slow Queries — Connection Pool Exhaustion', difficulty: 'SENIOR', timeLimit: 10 },
    { id: 'spanner-high-utilization', name: 'Cloud Spanner Node CPU Spike — Hot Key Hotspot', difficulty: 'SENIOR', timeLimit: 10 },
    { id: 'pod-crashloop', name: 'checkout-service Pods in CrashLoopBackOff', difficulty: 'SENIOR', timeLimit: 10 },
    { id: 'db-replica-ip-change', name: 'Database Connectivity Issues', difficulty: 'MID', timeLimit: 10 },
    { id: 'missing-table', name: 'Payment Processing Errors', difficulty: 'MID', timeLimit: 10 },
    { id: 'kafka-consumer-lag', name: 'Event Processing Degradation', difficulty: 'MID', timeLimit: 10 },
    { id: 'config-key-missing', name: 'Service Deployment Anomaly', difficulty: 'MID', timeLimit: 10 },
    { id: 'pod-oom-killed', name: 'Container Resource Pressure', difficulty: 'MID', timeLimit: 10 },
    { id: 'network-policy-block', name: 'Network Connectivity Anomaly', difficulty: 'MID', timeLimit: 10 },
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
        loadSqlQuestions();
        loadMonitoringQuestions();
        const iv = setInterval(() => { loadAssignments(); }, 15000);
        return () => clearInterval(iv);
    }, [authed]);
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
                        : moduleType === 'monitoring' ? monitoringQuestions.find(q => q.id === selectedQuestionId)?.title
                            : 'Cognitive Test';
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
    function moduleLabel(mt) {
        if (mt === 'sql')
            return 'SQL';
        if (mt === 'monitoring')
            return 'MONITORING';
        if (mt === 'cognitive')
            return 'COGNITIVE';
        return 'INCIDENT';
    }
    function moduleBadgeClass(mt) {
        if (mt === 'sql')
            return 'border-[#58a6ff] text-[#58a6ff]';
        if (mt === 'monitoring')
            return 'border-[#bc8cff] text-[#bc8cff]';
        if (mt === 'cognitive')
            return 'border-[#e3b341] text-[#e3b341]';
        return 'border-[#f85149] text-[#f85149]';
    }
    const inputCls = "w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors";
    const labelCls = "block text-[#8b949e] mb-1.5";
    return (_jsx("div", { className: "min-h-screen bg-[#0d1117] font-mono text-xs px-4 py-8", children: _jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsxs("div", { className: "flex items-center gap-4 mb-8", children: [_jsx("button", { onClick: onBack, className: "text-[#58a6ff] hover:text-[#79c0ff] transition-colors", children: "\u2190 Back" }), _jsxs("div", { children: [_jsx("h1", { className: "text-[#e6edf3] text-xl font-bold", children: "Admin Panel" }), _jsx("div", { className: "text-[#8b949e] mt-0.5", children: "Manage assignments, questions, and view results" })] })] }), !authed ? (_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-6 max-w-sm mx-auto", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-4", children: "Admin Authentication" }), _jsxs("form", { onSubmit: handleAuth, className: "space-y-4", children: [_jsx("input", { type: "password", value: adminKey, onChange: e => setAdminKey(e.target.value), placeholder: "Admin key", className: inputCls, autoFocus: true }), authError && _jsxs("div", { className: "text-[#f85149]", children: ["\u2717 ", authError] }), _jsx("button", { type: "submit", className: "w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 rounded border border-[#2ea043] transition-colors", children: "Sign In" })] })] })) : (_jsxs("div", { className: "space-y-5", children: [_jsx("div", { className: "flex border-b border-[#30363d] overflow-x-auto", children: [
                                ['assign', '📋 Assign'],
                                ['sql', '🗄 SQL'],
                                ['monitoring', '📊 Monitoring'],
                            ].map(([id, label]) => (_jsx("button", { onClick: () => setTab(id), className: `px-5 py-2.5 text-xs whitespace-nowrap border-b-2 transition-colors ${tab === id ? 'border-[#3fb950] text-[#e6edf3]' : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'}`, children: label }, id))) }), tab === 'assign' && (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-5", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-4", children: "New Assignment" }), _jsxs("form", { onSubmit: handleCreate, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Candidate Name" }), _jsx("input", { type: "text", value: candidateName, onChange: e => setCandidateName(e.target.value), placeholder: "Exact name candidate will use to log in", className: inputCls, autoFocus: true })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Module Type" }), _jsx("div", { className: "flex gap-2 flex-wrap", children: [
                                                                ['incident', 'Incident Simulation'],
                                                                ['sql', 'SQL Readiness'],
                                                                ['monitoring', 'Monitoring Design'],
                                                                ['cognitive', 'Cognitive Test'],
                                                            ].map(([m, label]) => (_jsx("button", { type: "button", onClick: () => { setModuleType(m); setSelectedQuestionId(''); }, className: `px-4 py-1.5 rounded border text-xs font-bold transition-colors ${moduleType === m ? 'border-[#3fb950] text-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] text-[#8b949e] hover:border-[#484f58]'}`, children: label }, m))) })] }), moduleType === 'incident' && (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Scenario" }), _jsx("div", { className: "space-y-2", children: SCENARIOS.map(s => (_jsxs("label", { className: `flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${scenarioId === s.id ? 'border-[#3fb950] bg-[#0d1117]'
                                                                    : 'border-[#30363d] hover:border-[#484f58]'}`, children: [_jsx("input", { type: "radio", name: "scenario", value: s.id, checked: scenarioId === s.id, onChange: () => setScenarioId(s.id), className: "accent-[#3fb950]" }), _jsx("span", { className: "text-[#e6edf3] flex-1", children: s.name }), _jsxs("span", { className: "text-[#8b949e]", children: [s.timeLimit, "min"] })] }, s.id))) })] })), moduleType === 'sql' && (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "SQL Question" }), sqlQuestions.length === 0 ? (_jsx("div", { className: "text-[#484f58]", children: "No SQL questions yet \u2014 create some in the SQL Questions tab" })) : (_jsx("div", { className: "space-y-1.5", children: sqlQuestions.map(q => (_jsxs("label", { className: `flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedQuestionId === q.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`, children: [_jsx("input", { type: "radio", name: "sql_question", value: q.id, checked: selectedQuestionId === q.id, onChange: () => setSelectedQuestionId(q.id), className: "accent-[#3fb950]" }), _jsx("span", { className: "text-[#e6edf3] flex-1", children: q.title }), _jsxs("span", { className: "text-[#484f58] text-[10px] uppercase", children: [q.difficulty, " \u00B7 ", q.question_type] })] }, q.id))) }))] })), moduleType === 'monitoring' && (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Monitoring Question" }), monitoringQuestions.length === 0 ? (_jsx("div", { className: "text-[#484f58]", children: "No monitoring questions yet \u2014 create some in the Monitoring Questions tab" })) : (_jsx("div", { className: "space-y-1.5", children: monitoringQuestions.map(q => (_jsxs("label", { className: `flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedQuestionId === q.id ? 'border-[#3fb950] bg-[#0d1117]' : 'border-[#30363d] hover:border-[#484f58]'}`, children: [_jsx("input", { type: "radio", name: "mon_question", value: q.id, checked: selectedQuestionId === q.id, onChange: () => setSelectedQuestionId(q.id), className: "accent-[#3fb950]" }), _jsx("span", { className: "text-[#e6edf3] flex-1", children: q.title }), _jsx("span", { className: "text-[#484f58] text-[10px] uppercase", children: q.difficulty })] }, q.id))) }))] })), moduleType === 'cognitive' && (_jsxs("div", { className: "bg-[#0d1117] border border-[#e3b341] rounded p-4", children: [_jsx("div", { className: "text-[#e3b341] font-bold mb-1", children: "Cognitive Assessment" }), _jsx("div", { className: "text-[#8b949e] leading-relaxed", children: "The candidate will be shown all available cognitive questions (logical reasoning and numerical problems). No specific question selection is needed \u2014 the full question bank is used automatically." })] })), createError && _jsxs("div", { className: "text-[#f85149]", children: ["\u2717 ", createError] }), createSuccess && _jsx("div", { className: "text-[#3fb950]", children: createSuccess }), _jsx("button", { type: "submit", disabled: !candidateName.trim() || creating, className: "bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold py-2 px-6 rounded border border-[#2ea043] disabled:border-[#30363d] transition-all", children: creating ? 'Assigning…' : '+ Assign' })] })] }), _jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden", children: [_jsxs("div", { className: "px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest", children: ["Assignments (", assignments.length, ")"] }), assignments.length === 0 ? (_jsx("div", { className: "px-5 py-8 text-center text-[#484f58]", children: "No assignments yet" })) : (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-[#484f58] border-b border-[#30363d]", children: [_jsx("th", { className: "text-left px-4 py-2", children: "Candidate" }), _jsx("th", { className: "text-left px-4 py-2", children: "Module" }), _jsx("th", { className: "text-left px-4 py-2", children: "Created" }), _jsx("th", { className: "text-left px-4 py-2", children: "Status" }), _jsx("th", { className: "px-4 py-2" })] }) }), _jsx("tbody", { children: assignments.map(a => (_jsxs("tr", { className: "border-b border-[#30363d] last:border-0 hover:bg-[#1c2128] transition-colors", children: [_jsx("td", { className: "px-4 py-2.5 text-[#e6edf3] font-bold", children: a.candidate_name }), _jsx("td", { className: "px-4 py-2.5", children: _jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded border font-bold ${moduleBadgeClass(a.module_type ?? 'incident')}`, children: moduleLabel(a.module_type ?? 'incident') }) }), _jsx("td", { className: "px-4 py-2.5 text-[#484f58]", children: fmt(a.created_at) }), _jsx("td", { className: "px-4 py-2.5", children: _jsx("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-bold border ${a.status === 'pending' ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#484f58] text-[#484f58]'}`, children: a.status.toUpperCase() }) }), _jsx("td", { className: "px-4 py-2.5 text-right", children: a.status === 'pending' && (_jsx("button", { onClick: () => handleDeleteAssignment(a.id), className: "text-[#484f58] hover:text-[#f85149] transition-colors", title: "Delete", children: "\u2715" })) })] }, a.id))) })] }))] })] })), tab === 'sql' && (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-5", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-4", children: "Create SQL Question" }), _jsxs("form", { onSubmit: handleCreateSqlQuestion, className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Title" }), _jsx("input", { value: sqlForm.title, onChange: e => setSqlForm(f => ({ ...f, title: e.target.value })), placeholder: "e.g. Find employees by dept", className: inputCls })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Difficulty" }), _jsxs("select", { value: sqlForm.difficulty, onChange: e => setSqlForm(f => ({ ...f, difficulty: e.target.value })), className: inputCls, children: [_jsx("option", { value: "easy", children: "Easy" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "hard", children: "Hard" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Type" }), _jsxs("select", { value: sqlForm.question_type, onChange: e => setSqlForm(f => ({ ...f, question_type: e.target.value })), className: inputCls, children: [_jsx("option", { value: "write", children: "Write" }), _jsx("option", { value: "fix", children: "Fix" }), _jsx("option", { value: "identify", children: "Identify" })] })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Description" }), _jsx("textarea", { value: sqlForm.description, onChange: e => setSqlForm(f => ({ ...f, description: e.target.value })), rows: 3, placeholder: "What should the candidate do?", className: inputCls + ' resize-none' })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Starter Query (optional)" }), _jsx("textarea", { value: sqlForm.starter_query, onChange: e => setSqlForm(f => ({ ...f, starter_query: e.target.value })), rows: 3, placeholder: "SELECT ...", className: inputCls + ' resize-none font-mono text-[11px]' })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Expected Output (JSON)" }), _jsxs("div", { className: "text-[#484f58] text-[10px] mb-1", children: ["Format: ", '{ "columns": ["col1"], "rows": [{"col1": "val"}] }'] }), _jsx("textarea", { value: sqlForm.expected_output, onChange: e => setSqlForm(f => ({ ...f, expected_output: e.target.value })), rows: 3, className: inputCls + ' resize-none font-mono text-[11px]' })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Schema Hint" }), _jsx("textarea", { value: sqlForm.schema_hint, onChange: e => setSqlForm(f => ({ ...f, schema_hint: e.target.value })), rows: 3, placeholder: "Table definitions...", className: inputCls + ' resize-none font-mono text-[11px]' })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Hint (shown on request)" }), _jsx("textarea", { value: sqlForm.hint, onChange: e => setSqlForm(f => ({ ...f, hint: e.target.value })), rows: 3, placeholder: "Optional hint...", className: inputCls + ' resize-none' })] })] }), _jsx("div", { className: "flex items-center gap-4", children: _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Time Limit (seconds)" }), _jsx("input", { type: "number", value: sqlForm.time_limit_seconds, onChange: e => setSqlForm(f => ({ ...f, time_limit_seconds: e.target.value })), className: inputCls + ' w-32' })] }) }), sqlFormError && _jsxs("div", { className: "text-[#f85149]", children: ["\u2717 ", sqlFormError] }), sqlFormSuccess && _jsx("div", { className: "text-[#3fb950]", children: sqlFormSuccess }), _jsx("button", { type: "submit", className: "bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all", children: "+ Create SQL Question" })] })] }), _jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden", children: [_jsxs("div", { className: "px-5 py-3 border-b border-[#30363d] text-[#8b949e] uppercase tracking-widest", children: ["Questions (", sqlQuestions.length, ")"] }), sqlQuestions.length === 0 ? (_jsxs("div", { className: "px-5 py-8 text-center text-[#484f58]", children: ["No SQL questions yet. Run ", _jsx("code", { className: "text-[#8b949e]", children: "npm run db:seed-questions" }), " on the backend to seed examples."] })) : (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-[#484f58] border-b border-[#30363d]", children: [_jsx("th", { className: "text-left px-4 py-2", children: "Title" }), _jsx("th", { className: "text-left px-4 py-2", children: "Difficulty" }), _jsx("th", { className: "text-left px-4 py-2", children: "Type" }), _jsx("th", { className: "text-left px-4 py-2", children: "Time" }), _jsx("th", { className: "px-4 py-2" })] }) }), _jsx("tbody", { children: sqlQuestions.map(q => (_jsxs("tr", { className: "border-b border-[#30363d] last:border-0 hover:bg-[#1c2128]", children: [_jsx("td", { className: "px-4 py-2.5 text-[#e6edf3]", children: q.title }), _jsx("td", { className: "px-4 py-2.5 text-[#8b949e] uppercase text-[10px]", children: q.difficulty }), _jsx("td", { className: "px-4 py-2.5 text-[#8b949e] uppercase text-[10px]", children: q.question_type }), _jsxs("td", { className: "px-4 py-2.5 text-[#484f58]", children: [Math.round(q.time_limit_seconds / 60), "min"] }), _jsx("td", { className: "px-4 py-2.5 text-right", children: _jsx("button", { onClick: () => handleDeleteSqlQuestion(q.id), className: "text-[#484f58] hover:text-[#f85149] transition-colors", children: "\u2715" }) })] }, q.id))) })] }))] })] })), tab === 'monitoring' && (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg p-5", children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest mb-4", children: "Create Monitoring Question" }), _jsxs("form", { onSubmit: handleCreateMonitoringQuestion, className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Title" }), _jsx("input", { value: monForm.title, onChange: e => setMonForm(f => ({ ...f, title: e.target.value })), placeholder: "e.g. Redis Cache Alerting Setup", className: inputCls })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Difficulty" }), _jsxs("select", { value: monForm.difficulty, onChange: e => setMonForm(f => ({ ...f, difficulty: e.target.value })), className: inputCls, children: [_jsx("option", { value: "easy", children: "Easy" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "hard", children: "Hard" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Time Limit (sec)" }), _jsx("input", { type: "number", value: monForm.time_limit_seconds, onChange: e => setMonForm(f => ({ ...f, time_limit_seconds: e.target.value })), className: inputCls })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Scenario Description" }), _jsx("textarea", { value: monForm.scenario, onChange: e => setMonForm(f => ({ ...f, scenario: e.target.value })), rows: 4, placeholder: "Describe the system context...", className: inputCls + ' resize-none' })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Sub-Questions (JSON array)" }), _jsx("div", { className: "text-[#484f58] text-[10px] mb-1.5", children: '[{ "id": "q1", "prompt": "...", "type": "promql|nrql|text|yaml", "placeholder": "...", "required_keywords": [], "bonus_keywords": [], "reference_answer": "..." }]' }), _jsx("textarea", { value: monForm.sub_questions, onChange: e => setMonForm(f => ({ ...f, sub_questions: e.target.value })), rows: 8, placeholder: '[\n  {\n    "id": "q1",\n    "prompt": "Write a PromQL alert for high error rate",\n    "type": "promql",\n    "placeholder": "rate(http_errors_total[5m])",\n    "required_keywords": ["rate", "5m"],\n    "bonus_keywords": ["by (service)"],\n    "reference_answer": "rate(http_errors_total[5m]) > 0.05"\n  }\n]', className: inputCls + ' resize-none font-mono text-[11px]' })] }), monFormError && _jsxs("div", { className: "text-[#f85149]", children: ["\u2717 ", monFormError] }), monFormSuccess && _jsx("div", { className: "text-[#3fb950]", children: monFormSuccess }), _jsx("button", { type: "submit", className: "bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-6 rounded border border-[#2ea043] transition-all", children: "+ Create Monitoring Question" })] })] }), _jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden", children: [_jsxs("div", { className: "px-5 py-3 border-b border-[#30363d] flex items-center justify-between", children: [_jsxs("span", { className: "text-[#8b949e] uppercase tracking-widest", children: ["Questions (", monitoringQuestions.length, ")"] }), _jsx("button", { onClick: async () => {
                                                        const r = await fetch(`${API_BASE}/monitoring/admin/seed`, { method: 'POST', headers: { 'x-admin-key': adminKey } });
                                                        const data = await r.json();
                                                        await loadMonitoringQuestions();
                                                        alert(`Seeded ${data.inserted} question(s). ${data.skipped} already existed.`);
                                                    }, className: "text-[10px] px-3 py-1 rounded border border-[#bc8cff]/40 text-[#bc8cff] hover:bg-[#bc8cff]/10 transition-colors", children: "\u26A1 Seed Default Questions" })] }), monitoringQuestions.length === 0 ? (_jsx("div", { className: "px-5 py-8 text-center text-[#484f58]", children: "No monitoring questions yet. Click \"Seed Default Questions\" above to add 3 pre-built questions." })) : (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-[#484f58] border-b border-[#30363d]", children: [_jsx("th", { className: "text-left px-4 py-2", children: "Title" }), _jsx("th", { className: "text-left px-4 py-2", children: "Difficulty" }), _jsx("th", { className: "text-left px-4 py-2", children: "Time" }), _jsx("th", { className: "px-4 py-2" })] }) }), _jsx("tbody", { children: monitoringQuestions.map(q => (_jsxs("tr", { className: "border-b border-[#30363d] last:border-0 hover:bg-[#1c2128]", children: [_jsx("td", { className: "px-4 py-2.5 text-[#e6edf3]", children: q.title }), _jsx("td", { className: "px-4 py-2.5 text-[#8b949e] uppercase text-[10px]", children: q.difficulty }), _jsxs("td", { className: "px-4 py-2.5 text-[#484f58]", children: [Math.round(q.time_limit_seconds / 60), "min"] }), _jsx("td", { className: "px-4 py-2.5 text-right", children: _jsx("button", { onClick: () => handleDeleteMonitoringQuestion(q.id), className: "text-[#484f58] hover:text-[#f85149] transition-colors", children: "\u2715" }) })] }, q.id))) })] }))] })] }))] }))] }) }));
}
