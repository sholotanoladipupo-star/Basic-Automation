import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
export default function Terminal({ lines, onCommand, busy }) {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const outputRef = useRef(null);
    const inputRef = useRef(null);
    // Auto-scroll to bottom
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [lines]);
    // Focus input when not busy
    useEffect(() => {
        if (!busy && inputRef.current) {
            inputRef.current.focus();
        }
    }, [busy]);
    function handleSubmit(e) {
        e.preventDefault();
        const cmd = input.trim();
        if (!cmd || busy)
            return;
        setHistory(h => [cmd, ...h.slice(0, 49)]);
        setHistoryIndex(-1);
        setInput('');
        onCommand(cmd);
    }
    function handleKeyDown(e) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const newIndex = Math.min(historyIndex + 1, history.length - 1);
            setHistoryIndex(newIndex);
            if (history[newIndex])
                setInput(history[newIndex]);
        }
        else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const newIndex = Math.max(historyIndex - 1, -1);
            setHistoryIndex(newIndex);
            setInput(newIndex === -1 ? '' : (history[newIndex] ?? ''));
        }
    }
    function renderLine(line) {
        switch (line.type) {
            case 'input':
                return (_jsxs("div", { className: "text-[#3fb950]", children: [_jsx("span", { className: "text-[#58a6ff]", children: "engineer@prod" }), _jsx("span", { className: "text-[#e6edf3]", children: ":" }), _jsx("span", { className: "text-[#58a6ff]", children: "~" }), _jsx("span", { className: "text-[#e6edf3]", children: "$ " }), _jsx("span", { children: line.content })] }, line.id));
            case 'output':
                return (_jsx("div", { className: "text-[#e6edf3] whitespace-pre-wrap break-words", children: line.content }, line.id));
            case 'error':
                return (_jsx("div", { className: "text-[#f85149] whitespace-pre-wrap break-words", children: line.content }, line.id));
            case 'system':
                return (_jsx("div", { className: `font-mono ${line.content === '' ? 'h-2' : 'text-[#39d353] italic'}`, children: line.content }, line.id));
            case 'thinking':
                return (_jsxs("div", { className: "text-[#484f58] italic flex items-center gap-2", children: [_jsx("span", { className: "blink", children: "\u25C9" }), _jsx("span", { children: line.content })] }, line.id));
            default:
                return null;
        }
    }
    return (_jsxs("div", { className: "flex flex-col h-full bg-[#0d1117] font-mono text-sm", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-[#30363d] flex-shrink-0", children: [_jsx("span", { className: "w-3 h-3 rounded-full bg-[#f85149]" }), _jsx("span", { className: "w-3 h-3 rounded-full bg-[#d29922]" }), _jsx("span", { className: "w-3 h-3 rounded-full bg-[#3fb950]" }), _jsx("span", { className: "ml-2 text-xs text-[#8b949e]", children: "engineer@sre-sim:~$" })] }), _jsx("div", { ref: outputRef, className: "flex-1 overflow-y-auto p-3 space-y-0.5 leading-5", onClick: () => inputRef.current?.focus(), children: lines.map(line => renderLine(line)) }), _jsx("div", { className: "flex-shrink-0 border-t border-[#30363d] px-3 py-2", children: busy ? (_jsxs("div", { className: "text-[#484f58] italic flex items-center gap-2", children: [_jsx("span", { className: "blink", children: "\u25C9" }), _jsx("span", { children: "Processing..." })] })) : (_jsxs("form", { onSubmit: handleSubmit, className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[#58a6ff] whitespace-nowrap", children: "engineer@prod:~$" }), _jsx("input", { ref: inputRef, type: "text", value: input, onChange: e => setInput(e.target.value), onKeyDown: handleKeyDown, className: "flex-1 bg-transparent text-[#e6edf3] focus:outline-none caret-[#3fb950]", autoFocus: true, spellCheck: false, autoComplete: "off" })] })) })] }));
}
