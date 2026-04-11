import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback } from 'react';
const ALEX_LINES = {
    alex_speaks_1: "Hi everyone, I've just joined the war room. Can you give me a quick status update? What's the current situation?",
    alex_speaks_2: "What's your planned resolution action, and what help do you need from us?",
};
const SARAH_LINES = {
    sarah_speaks_1: "What have you already investigated? What does the data show?",
    sarah_speaks_2: "Got it. Keep us updated every 5 minutes. We'll stay on the call. You've got this.",
};
function getNow() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
function getVoices() {
    const voices = window.speechSynthesis?.getVoices() ?? [];
    const female = voices.find(v => /female|woman|girl|zira|susan|samantha|victoria|karen|moira|tessa|fiona|veena|allison|ava/i.test(v.name)) ??
        voices[1] ??
        null;
    const male = voices.find(v => /male|man|boy|daniel|david|alex|tom|fred|jorge|diego|luca|yuri|rishi/i.test(v.name)) ??
        voices[0] ??
        null;
    return { male, female };
}
export default function WarRoom({ isOpen, onClose }) {
    const [stage, setStage] = useState('joining');
    const [transcript, setTranscript] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [alexJoined, setAlexJoined] = useState(false);
    const [sarahJoined, setSarahJoined] = useState(false);
    const [textFallback, setTextFallback] = useState('');
    const [hasSpeechRecognition, setHasSpeechRecognition] = useState(false);
    const [voicesLoaded, setVoicesLoaded] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');
    const transcriptEndRef = useRef(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef(null);
    const timeoutRef = useRef(null);
    const stageRef = useRef('joining');
    stageRef.current = stage;
    // Check SpeechRecognition support
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window;
        const SR = w.webkitSpeechRecognition ?? w.SpeechRecognition;
        setHasSpeechRecognition(!!SR);
    }, []);
    // Load voices
    useEffect(() => {
        if (!isOpen)
            return;
        function tryLoadVoices() {
            if (window.speechSynthesis?.getVoices().length > 0) {
                setVoicesLoaded(true);
                return true;
            }
            return false;
        }
        if (tryLoadVoices())
            return;
        // Listen for voiceschanged
        const onVoicesChanged = () => { tryLoadVoices(); setVoicesLoaded(true); };
        window.speechSynthesis?.addEventListener('voiceschanged', onVoicesChanged);
        // Fallback: after 3s, start anyway even if no custom voices
        const fallbackTimer = setTimeout(() => setVoicesLoaded(true), 3000);
        return () => {
            window.speechSynthesis?.removeEventListener('voiceschanged', onVoicesChanged);
            clearTimeout(fallbackTimer);
        };
    }, [isOpen]);
    // Scroll transcript to bottom
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);
    // Cancel speech on unmount
    useEffect(() => {
        return () => {
            window.speechSynthesis?.cancel();
            recognitionRef.current?.abort();
            if (timeoutRef.current)
                clearTimeout(timeoutRef.current);
        };
    }, []);
    const addTranscriptEntry = useCallback((speaker, text) => {
        setTranscript(prev => [...prev, { speaker, text, timestamp: getNow() }]);
    }, []);
    const speak = useCallback((text, speaker, onDone) => {
        if (!window.speechSynthesis) {
            onDone();
            return;
        }
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        const { male, female } = getVoices();
        if (speaker === 'alex' && male)
            utter.voice = male;
        if (speaker === 'sarah' && female)
            utter.voice = female;
        utter.rate = 0.95;
        utter.pitch = speaker === 'sarah' ? 1.15 : 0.9;
        setIsSpeaking(true);
        utter.onend = () => {
            setIsSpeaking(false);
            onDone();
        };
        utter.onerror = () => {
            setIsSpeaking(false);
            onDone();
        };
        window.speechSynthesis.speak(utter);
    }, []);
    const startListening = useCallback((onResult) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window;
        const SR = w.webkitSpeechRecognition ?? w.SpeechRecognition;
        if (!SR)
            return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition = new SR();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognitionRef.current = recognition;
        let finalText = '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalText += result[0].transcript;
                }
                else {
                    interim += result[0].transcript;
                }
            }
            setLiveTranscript(finalText + interim);
        };
        recognition.onend = () => {
            setIsRecording(false);
            setLiveTranscript('');
            onResult(finalText || '[no response recorded]');
        };
        recognition.onerror = () => {
            setIsRecording(false);
            setLiveTranscript('');
            onResult(finalText || '[no response recorded]');
        };
        setIsRecording(true);
        recognition.start();
    }, []);
    // Run joining sequence
    useEffect(() => {
        if (!isOpen || !voicesLoaded)
            return;
        // Reset state
        setStage('joining');
        setTranscript([]);
        setAlexJoined(false);
        setSarahJoined(false);
        setIsSpeaking(false);
        setIsRecording(false);
        const t1 = setTimeout(() => setAlexJoined(true), 600);
        const t2 = setTimeout(() => setSarahJoined(true), 1200);
        const t3 = setTimeout(() => {
            setStage('alex_speaks_1');
        }, 2000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            window.speechSynthesis?.cancel();
            recognitionRef.current?.abort();
            if (timeoutRef.current)
                clearTimeout(timeoutRef.current);
        };
    }, [isOpen, voicesLoaded]);
    // Drive conversation stages
    useEffect(() => {
        if (!isOpen)
            return;
        if (stage === 'alex_speaks_1') {
            const line = ALEX_LINES['alex_speaks_1'];
            addTranscriptEntry('alex', line);
            speak(line, 'alex', () => setStage('sre_speaks_1'));
        }
        if (stage === 'sarah_speaks_1') {
            const line = SARAH_LINES['sarah_speaks_1'];
            addTranscriptEntry('sarah', line);
            speak(line, 'sarah', () => setStage('sre_speaks_2'));
        }
        if (stage === 'alex_speaks_2') {
            const line = ALEX_LINES['alex_speaks_2'];
            addTranscriptEntry('alex', line);
            speak(line, 'alex', () => setStage('sre_speaks_3'));
        }
        if (stage === 'sarah_speaks_2') {
            const line = SARAH_LINES['sarah_speaks_2'];
            addTranscriptEntry('sarah', line);
            speak(line, 'sarah', () => setStage('ended'));
        }
    }, [stage, isOpen, addTranscriptEntry, speak]);
    function handleSpeak() {
        if (hasSpeechRecognition) {
            startListening((text) => {
                addTranscriptEntry('you', text);
                advanceAfterSRE();
            });
        }
    }
    function handleTextSubmit(e) {
        e.preventDefault();
        const text = textFallback.trim() || '[no response recorded]';
        addTranscriptEntry('you', text);
        setTextFallback('');
        advanceAfterSRE();
    }
    function advanceAfterSRE() {
        const cur = stageRef.current;
        if (cur === 'sre_speaks_1')
            setStage('sarah_speaks_1');
        else if (cur === 'sre_speaks_2')
            setStage('alex_speaks_2');
        else if (cur === 'sre_speaks_3')
            setStage('sarah_speaks_2');
    }
    function handleClose() {
        window.speechSynthesis?.cancel();
        recognitionRef.current?.abort();
        if (timeoutRef.current)
            clearTimeout(timeoutRef.current);
        setStage('joining');
        setTranscript([]);
        onClose();
    }
    if (!isOpen)
        return null;
    const isSREturn = stage === 'sre_speaks_1' || stage === 'sre_speaks_2' || stage === 'sre_speaks_3';
    const speakDisabled = isSpeaking || isRecording || !isSREturn;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm", children: [_jsxs("div", { className: "relative flex flex-col w-full max-w-3xl h-[560px] bg-[#0d1117] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden", style: { fontFamily: 'ui-monospace, monospace' }, children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3 bg-[#161b22] border-b border-[#30363d]", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "inline-block w-2.5 h-2.5 rounded-full bg-[#f85149]", style: { animation: 'pulse 1.2s ease-in-out infinite' } }), _jsx("span", { className: "text-sm font-semibold text-white tracking-wide", children: "War Room \u2014 Active Incident" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-xs text-[#8b949e]", children: getNow() }), _jsx("button", { onClick: handleClose, className: "text-[#8b949e] hover:text-white transition-colors text-lg leading-none", "aria-label": "Close war room", children: "\u2715" })] })] }), _jsxs("div", { className: "flex flex-1 min-h-0", children: [_jsxs("div", { className: "flex flex-col w-64 shrink-0 border-r border-[#30363d] bg-[#0d1117] p-3 gap-3", children: [_jsx(ParticipantTile, { initials: "AC", name: "Alex Chen", role: "Engineering Manager", avatarBg: "#0d4a6e", avatarColor: "#58a6ff", joined: alexJoined, isSpeaking: isSpeaking && (stage === 'alex_speaks_1' || stage === 'alex_speaks_2') }), _jsx(ParticipantTile, { initials: "SO", name: "Sarah O.", role: "Team Lead", avatarBg: "#2d1d4a", avatarColor: "#d2a8ff", joined: sarahJoined, isSpeaking: isSpeaking && (stage === 'sarah_speaks_1' || stage === 'sarah_speaks_2') }), _jsxs("div", { className: "flex flex-col items-center justify-center bg-[#161b22] border border-[#30363d] rounded-lg p-3 gap-2 mt-auto", style: { minHeight: 100 }, children: [_jsx("div", { className: "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2", style: { background: '#1a2d1a', borderColor: '#3fb950', color: '#3fb950' }, children: "\uD83C\uDF99" }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-xs font-semibold text-white", children: "You (SRE)" }), isRecording && (_jsxs("div", { className: "flex items-center justify-center gap-1 mt-1", children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-full bg-[#f85149]", style: { animation: 'pulse 0.7s ease-in-out infinite' } }), _jsx("span", { className: "text-[10px] text-[#f85149]", children: "Recording\u2026" })] })), !isRecording && isSREturn && (_jsx("div", { className: "text-[10px] text-[#3fb950] mt-1", children: "Your turn" }))] })] })] }), _jsxs("div", { className: "flex flex-col flex-1 min-h-0", children: [_jsx("div", { className: "px-4 py-2 bg-[#161b22] border-b border-[#30363d]", children: _jsx("span", { className: "text-[11px] text-[#8b949e] uppercase tracking-widest", children: "Transcript" }) }), _jsxs("div", { className: "flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs font-mono", children: [stage === 'joining' && transcript.length === 0 && (_jsx("div", { className: "text-[#8b949e] text-center mt-10 text-xs", children: "Connecting participants\u2026" })), transcript.map((entry, i) => (_jsx(TranscriptMessage, { entry: entry }, i))), _jsx("div", { ref: transcriptEndRef })] }), _jsx("div", { className: "border-t border-[#30363d] px-4 py-3 bg-[#161b22]", children: stage === 'ended' ? (_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-[#8b949e]", children: "War room closed" }), _jsx("button", { onClick: handleClose, className: "px-4 py-1.5 rounded text-xs font-semibold bg-[#f85149]/20 text-[#f85149] border border-[#f85149]/40 hover:bg-[#f85149]/30 transition-colors", children: "Leave Call" })] })) : hasSpeechRecognition ? (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: handleSpeak, disabled: speakDisabled, className: `flex items-center gap-2 px-4 py-1.5 rounded text-xs font-semibold border transition-all ${isRecording
                                                                ? 'bg-[#f85149]/20 text-[#f85149] border-[#f85149]/60 cursor-not-allowed'
                                                                : speakDisabled
                                                                    ? 'bg-[#161b22] text-[#484f58] border-[#30363d] cursor-not-allowed'
                                                                    : 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/40 hover:bg-[#3fb950]/20 cursor-pointer'}`, children: isRecording ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-full bg-[#f85149]", style: { animation: 'pulse 0.7s ease-in-out infinite' } }), "Listening\u2026"] })) : ('🎙 Speak') }), isRecording && (_jsx("button", { onClick: () => recognitionRef.current?.stop(), className: "px-3 py-1 rounded text-xs bg-[#f85149]/20 text-[#f85149] border border-[#f85149]/40", children: "\u25A0 Done Speaking" })), _jsx("span", { className: "text-[10px] text-[#484f58]", children: isSREturn
                                                                ? 'Click to record — speak freely, press Done when finished'
                                                                : isSpeaking
                                                                    ? 'Wait — participant is speaking…'
                                                                    : '' })] }), isRecording && liveTranscript && (_jsxs("div", { className: "text-[#8b949e] text-[10px] italic mt-1 max-w-xs truncate", children: ["\"", liveTranscript, "\""] }))] })) : (
                                        // Text fallback
                                        _jsxs("form", { onSubmit: handleTextSubmit, className: "flex gap-2", children: [_jsx("input", { type: "text", value: textFallback, onChange: e => setTextFallback(e.target.value), disabled: !isSREturn || isSpeaking, placeholder: isSREturn && !isSpeaking
                                                        ? 'Type your response…'
                                                        : 'Waiting for participant…', className: "flex-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-white placeholder-[#484f58] outline-none focus:border-[#58a6ff] disabled:opacity-40" }), _jsx("button", { type: "submit", disabled: !isSREturn || isSpeaking, className: "px-3 py-1.5 rounded text-xs font-semibold bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/40 hover:bg-[#3fb950]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors", children: "Send" })] })) })] })] })] }), _jsx("style", { children: `
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      ` })] }));
}
function ParticipantTile({ initials, name, role, avatarBg, avatarColor, joined, isSpeaking, }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center bg-[#161b22] border rounded-lg p-3 gap-2 transition-all duration-500", style: {
            minHeight: 100,
            borderColor: isSpeaking ? avatarColor : '#30363d',
            boxShadow: isSpeaking ? `0 0 0 2px ${avatarColor}40` : 'none',
            opacity: joined ? 1 : 0.35,
            animation: joined ? 'fadeSlideIn 0.4s ease both' : 'none',
        }, children: [_jsx("div", { className: "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all", style: {
                    background: avatarBg,
                    borderColor: isSpeaking ? avatarColor : `${avatarColor}55`,
                    color: avatarColor,
                }, children: initials }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-xs font-semibold text-white", children: name }), _jsx("div", { className: "text-[10px] text-[#8b949e]", children: role }), joined && (_jsx("div", { className: "text-[10px] mt-0.5", style: { color: '#3fb950' }, children: isSpeaking ? '🔊 speaking…' : '● joined' })), !joined && (_jsx("div", { className: "text-[10px] mt-0.5 text-[#484f58]", children: "connecting\u2026" }))] })] }));
}
function TranscriptMessage({ entry }) {
    const isAlex = entry.speaker === 'alex';
    const isSarah = entry.speaker === 'sarah';
    const isYou = entry.speaker === 'you';
    const avatarColor = isAlex ? '#58a6ff' : isSarah ? '#d2a8ff' : '#3fb950';
    const avatarBg = isAlex ? '#0d4a6e' : isSarah ? '#2d1d4a' : '#1a2d1a';
    const initials = isAlex ? 'AC' : isSarah ? 'SO' : '🎙';
    const displayName = isAlex ? 'Alex Chen' : isSarah ? 'Sarah O.' : 'You';
    return (_jsxs("div", { className: "flex gap-2", style: { animation: 'fadeSlideIn 0.3s ease both' }, children: [_jsx("div", { className: "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border mt-0.5", style: { background: avatarBg, borderColor: `${avatarColor}55`, color: avatarColor }, children: isYou ? '🎙' : initials }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "text-[11px] font-semibold", style: { color: avatarColor }, children: displayName }), _jsx("span", { className: "text-[10px] text-[#484f58]", children: entry.timestamp })] }), _jsxs("div", { className: `text-xs mt-0.5 leading-relaxed break-words ${isYou ? 'text-[#e6edf3]' : 'text-[#c9d1d9]'}`, children: [isYou && (_jsx("span", { className: "text-[#8b949e] mr-1", children: "\uD83C\uDF99" })), entry.text] })] })] }));
}
