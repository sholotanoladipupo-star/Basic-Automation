import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
const CHANNELS = ['incidents', 'sre-team', 'oncall'];
export default function CommsPanel({ messages, onSendMessage }) {
    const [activeChannel, setActiveChannel] = useState('incidents');
    const [input, setInput] = useState('');
    const bottomRef = useRef(null);
    const channelMessages = messages.filter(m => m.channel === activeChannel || m.channel === `#${activeChannel}`);
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [channelMessages.length]);
    function handleSend(e) {
        e.preventDefault();
        const msg = input.trim();
        if (!msg)
            return;
        onSendMessage(activeChannel, msg);
        setInput('');
    }
    function formatTime(ts) {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return (_jsxs("div", { className: "flex flex-col bg-[#161b22] border-l border-t border-[#30363d] text-xs font-mono h-64", children: [_jsx("div", { className: "flex border-b border-[#30363d] flex-shrink-0", children: CHANNELS.map(ch => (_jsxs("button", { onClick: () => setActiveChannel(ch), className: `px-3 py-1.5 text-xs transition-colors ${activeChannel === ch
                        ? 'text-[#e6edf3] border-b-2 border-[#3fb950]'
                        : 'text-[#8b949e] hover:text-[#e6edf3]'}`, children: ["#", ch] }, ch))) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-2 space-y-1", children: [channelMessages.length === 0 ? (_jsxs("div", { className: "text-[#484f58] italic text-center mt-2", children: ["No messages in #", activeChannel] })) : (channelMessages.map(msg => (_jsxs("div", { className: `${msg.isSystem ? 'text-[#484f58] italic' : ''}`, children: [_jsx("span", { className: "text-[#484f58] mr-1", children: formatTime(msg.ts) }), _jsxs("span", { className: "text-[#58a6ff] mr-1", children: [msg.sender, ":"] }), _jsx("span", { className: msg.isSystem ? '' : 'text-[#e6edf3]', children: msg.message })] }, msg.id)))), _jsx("div", { ref: bottomRef })] }), _jsxs("form", { onSubmit: handleSend, className: "flex-shrink-0 border-t border-[#30363d] flex gap-1 p-1.5", children: [_jsx("input", { type: "text", value: input, onChange: e => setInput(e.target.value), placeholder: `Message #${activeChannel}`, className: "flex-1 bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1 rounded focus:outline-none focus:border-[#3fb950] font-mono" }), _jsx("button", { type: "submit", disabled: !input.trim(), className: "bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 text-white text-xs px-2 py-1 rounded transition-colors", children: "Send" })] })] }));
}
