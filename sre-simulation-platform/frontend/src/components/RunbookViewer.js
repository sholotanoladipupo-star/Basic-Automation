import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function RunbookViewer({ runbook, onClose }) {
    // Very basic markdown-like rendering (headers, code blocks, bullets)
    function renderContent(text) {
        return text.split('\n').map((line, i) => {
            if (line.startsWith('# ')) {
                return _jsx("div", { className: "text-[#e6edf3] font-bold text-sm mt-3 mb-1", children: line.slice(2) }, i);
            }
            if (line.startsWith('## ')) {
                return _jsx("div", { className: "text-[#58a6ff] font-bold mt-3 mb-1", children: line.slice(3) }, i);
            }
            if (line.startsWith('### ')) {
                return _jsx("div", { className: "text-[#8b949e] font-bold mt-2 mb-1", children: line.slice(4) }, i);
            }
            if (line.startsWith('```')) {
                return null;
            }
            if (line.startsWith('- ') || line.startsWith('* ')) {
                return _jsxs("div", { className: "text-[#e6edf3] pl-2", children: ["\u2022 ", line.slice(2)] }, i);
            }
            if (/^\d+\./.test(line)) {
                return _jsx("div", { className: "text-[#e6edf3] pl-2", children: line }, i);
            }
            if (line.trim() === '') {
                return _jsx("div", { className: "h-2" }, i);
            }
            // Code-like lines (indented or backtick)
            if (line.startsWith('  ') || line.includes('kubectl') || line.includes('redis-cli') || line.includes('psql')) {
                return (_jsx("div", { className: "bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 text-[#3fb950] my-0.5 break-all", children: line.trim() }, i));
            }
            return _jsx("div", { className: "text-[#e6edf3]", children: line }, i);
        });
    }
    return (_jsxs("div", { className: "flex flex-col h-full bg-[#0d1117] font-mono text-xs", children: [_jsxs("div", { className: "flex items-center justify-between p-3 bg-[#161b22] border-b border-[#30363d] flex-shrink-0", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[#8b949e] uppercase tracking-widest text-xs mb-0.5", children: "Runbook" }), _jsx("div", { className: "text-[#e6edf3] font-bold", children: runbook.title })] }), _jsx("button", { onClick: onClose, className: "text-[#8b949e] hover:text-[#e6edf3] text-lg leading-none", children: "\u00D7" })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-3 space-y-0.5", children: renderContent(runbook.content) })] }));
}
