import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export default function LogViewer({ onQuery, logLines, availableServices, busy }) {
    const [selectedService, setSelectedService] = useState(availableServices[0] ?? '');
    const [filter, setFilter] = useState('');
    function handleFetch() {
        if (!selectedService)
            return;
        onQuery(selectedService, filter || undefined);
    }
    function getLineStyle(line) {
        const lower = line.toLowerCase();
        if (lower.includes('error') || lower.includes('fatal') || lower.includes('crit'))
            return 'text-[#f85149]';
        if (lower.includes('warn'))
            return 'text-[#d29922]';
        if (lower.includes('info'))
            return 'text-[#8b949e]';
        return 'text-[#e6edf3]';
    }
    return (_jsxs("div", { className: "flex flex-col h-full bg-[#0d1117] font-mono text-xs", children: [_jsxs("div", { className: "flex-shrink-0 p-3 bg-[#161b22] border-b border-[#30363d] space-y-2", children: [_jsx("div", { className: "text-xs text-[#8b949e] uppercase tracking-widest mb-2", children: "Log Viewer" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("select", { value: selectedService, onChange: e => setSelectedService(e.target.value), className: "bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#3fb950] font-mono flex-1", children: availableServices.map(s => (_jsx("option", { value: s, children: s }, s))) }), _jsx("input", { type: "text", value: filter, onChange: e => setFilter(e.target.value), placeholder: "grep pattern...", className: "bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#3fb950] font-mono flex-1" }), _jsx("button", { onClick: handleFetch, disabled: busy || !selectedService, className: "bg-[#21262d] hover:bg-[#30363d] disabled:opacity-50 border border-[#30363d] text-[#e6edf3] text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap", children: busy ? '◉ Loading...' : 'Fetch Logs' })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-3 space-y-0.5", children: logLines.length === 0 ? (_jsx("div", { className: "text-[#484f58] italic text-center mt-8", children: "Select a service and click Fetch Logs to view log output." })) : (logLines.map((line, i) => {
                    // Extract timestamp prefix if present
                    const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.Z]+|\w{3}\s+\d{1,2}\s+[\d:]+)(.*)/);
                    if (match) {
                        return (_jsxs("div", { className: getLineStyle(line), children: [_jsx("span", { className: "text-[#39d353]", children: match[1] }), match[2]] }, i));
                    }
                    return _jsx("div", { className: getLineStyle(line), children: line }, i);
                })) })] }));
}
