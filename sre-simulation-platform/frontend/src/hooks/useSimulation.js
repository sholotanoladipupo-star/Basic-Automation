import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
// Web Audio API — must be created/resumed from a user gesture, then works from WS callbacks
let audioCtx = null;
function unlockAudio() {
    if (typeof window === 'undefined')
        return;
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended')
        audioCtx.resume();
}
function playBeep() {
    if (!audioCtx || audioCtx.state !== 'running')
        return;
    const now = audioCtx.currentTime;
    // PagerDuty-style siren: two wee-woo sweeps (400→1100→400→1100 Hz)
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(1100, now + 0.35);
    osc.frequency.linearRampToValueAtTime(400, now + 0.7);
    osc.frequency.linearRampToValueAtTime(1100, now + 1.05);
    osc.frequency.linearRampToValueAtTime(400, now + 1.4);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.05);
    gain.gain.setValueAtTime(0.22, now + 1.3);
    gain.gain.linearRampToValueAtTime(0, now + 1.4);
    osc.start(now);
    osc.stop(now + 1.4);
}
const INITIAL_STATE = {
    screen: 'home', activePanel: 'terminal', connected: false, connecting: false, connectionError: null,
    sessionInfo: null, systemState: null, alerts: [], terminalLines: [], terminalBusy: false,
    logLines: [], dashboardData: {}, openRunbook: null, severityDeclared: null,
    incidentResolved: false, sessionEnded: null, slackMessages: [], scorecard: null, elapsedSeconds: 0
};
function mkLine(type, content, extra) {
    return { id: uuidv4(), type, content, timestamp: new Date().toISOString(), ...extra };
}
function addLine(lines, type, content, extra) {
    return [...lines, mkLine(type, content, extra)];
}
function speakAlert(message) {
    // Beep via Web Audio (reliable after user gesture unlocked the context)
    playBeep();
    // Speech synthesis as secondary layer
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(`PagerDuty Alert. ${message}`);
        utt.rate = 1.0;
        utt.pitch = 1.0;
        utt.volume = 1.0;
        window.speechSynthesis.speak(utt);
    }
}
export function useSimulation() {
    const [state, setState] = useState(INITIAL_STATE);
    const wsRef = useRef(null);
    const timerRef = useRef(null);
    const candidateNameRef = useRef('');
    useEffect(() => {
        return () => {
            if (wsRef.current)
                wsRef.current.close();
            if (timerRef.current)
                clearInterval(timerRef.current);
        };
    }, []);
    function send(msg) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }
    const connect = useCallback((candidateName) => {
        candidateNameRef.current = candidateName;
        setState(s => ({ ...s, connecting: true, connectionError: null }));
        // Unlock Web Audio from this user gesture so beeps work when WS fires
        unlockAudio();
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => {
            setState(s => ({ ...s, connected: true, connecting: false }));
            ws.send(JSON.stringify({ type: 'start_session', payload: { candidate_name: candidateName } }));
        };
        ws.onmessage = (event) => {
            try {
                handleServerMessage(JSON.parse(event.data));
            }
            catch (err) {
                console.error('Failed to parse message:', err);
            }
        };
        ws.onerror = () => {
            setState(s => ({ ...s, connected: false, connecting: false, connectionError: 'Could not connect to backend. Check that the server is running.' }));
        };
        ws.onclose = () => {
            setState(s => ({ ...s, connected: false }));
            if (timerRef.current)
                clearInterval(timerRef.current);
        };
    }, []);
    function handleServerMessage(msg) {
        // Side effects (audio) MUST run outside setState — browsers block speechSynthesis inside render cycles
        if (msg.type === 'session_started' && msg.payload.initial_alerts[0]) {
            speakAlert(msg.payload.initial_alerts[0].message);
        }
        else if (msg.type === 'new_alert') {
            speakAlert(msg.payload.message);
        }
        setState(s => {
            switch (msg.type) {
                case 'session_started': {
                    if (timerRef.current)
                        clearInterval(timerRef.current);
                    timerRef.current = setInterval(() => setState(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 })), 1000);
                    const moduleType = msg.payload.module_type ?? 'incident';
                    const info = {
                        session_id: msg.payload.session_id,
                        candidate_name: msg.payload.candidate_name ?? candidateNameRef.current,
                        scenario_name: msg.payload.scenario_name,
                        difficulty: msg.payload.difficulty, time_limit_minutes: msg.payload.time_limit_minutes,
                        module_type: moduleType, question_id: msg.payload.question_id ?? null,
                        available_runbooks: msg.payload.available_runbooks, available_dashboards: msg.payload.available_dashboards
                    };
                    const welcomeLines = [
                        mkLine('system', `=== SRE SIMULATION STARTED ===`),
                        mkLine('system', `You have been paged. An active incident is in progress.`),
                        mkLine('system', `Investigate, diagnose, and resolve before the timer runs out.`),
                        mkLine('system', `Tip: start with — kubectl get pods -n cache`),
                    ];
                    return { ...s, screen: 'simulation', sessionInfo: info, alerts: msg.payload.initial_alerts, terminalLines: welcomeLines, terminalBusy: false };
                }
                case 'thinking':
                    return { ...s, terminalBusy: true, terminalLines: addLine(s.terminalLines, 'thinking', msg.payload.message) };
                case 'command_response': {
                    const lines = s.terminalLines.filter(l => l.type !== 'thinking');
                    return { ...s, terminalBusy: false, terminalLines: addLine(lines, msg.payload.exit_code !== 0 ? 'error' : 'output', msg.payload.stdout, { exit_code: msg.payload.exit_code }) };
                }
                case 'log_response':
                    return { ...s, logLines: msg.payload.lines, terminalBusy: false };
                case 'dashboard_response':
                    return { ...s, dashboardData: { ...s.dashboardData, [msg.payload.dashboard_id]: { name: msg.payload.name, metrics: msg.payload.metrics } } };
                case 'runbook_response':
                    return { ...s, openRunbook: { id: msg.payload.id, title: msg.payload.title, content: msg.payload.content }, activePanel: 'runbook' };
                case 'slack_ack': {
                    const newMsg = { id: uuidv4(), channel: msg.payload.channel, message: `✓ Message delivered`, sender: 'system', ts: msg.payload.ts, isSystem: true };
                    return { ...s, slackMessages: [...s.slackMessages, newMsg] };
                }
                case 'state_update':
                    return { ...s, systemState: msg.payload };
                case 'new_alert': {
                    const existingIds = new Set(s.alerts.map(a => a.id));
                    if (existingIds.has(msg.payload.id))
                        return s;
                    return {
                        ...s,
                        alerts: [...s.alerts, msg.payload],
                        terminalLines: addLine(s.terminalLines, 'system', `🚨 NEW ALERT [${msg.payload.severity.toUpperCase()}] ${msg.payload.service}: ${msg.payload.message}`)
                    };
                }
                case 'session_ended': {
                    if (timerRef.current)
                        clearInterval(timerRef.current);
                    return { ...s, sessionEnded: msg.payload, terminalLines: addLine(s.terminalLines, 'system', `=== SESSION ENDED: ${msg.payload.reason.toUpperCase()} | Duration: ${msg.payload.duration_minutes} min ===`), terminalBusy: false };
                }
                case 'scorecard':
                    return { ...s, scorecard: msg.payload, screen: 'scorecard' };
                case 'error': {
                    // If still on home screen (no session started yet), show as connection error
                    if (s.screen === 'home') {
                        return { ...s, connecting: false, connectionError: msg.payload.message };
                    }
                    const lines = s.terminalLines.filter(l => l.type !== 'thinking');
                    return { ...s, terminalBusy: false, terminalLines: addLine(lines, 'error', `ERROR: ${msg.payload.message}`) };
                }
                default: return s;
            }
        });
    }
    const sendCommand = useCallback((cmd) => {
        setState(s => ({ ...s, terminalBusy: true, terminalLines: addLine(s.terminalLines, 'input', cmd) }));
        send({ type: 'run_command', payload: { cmd } });
    }, []);
    const queryDashboard = useCallback((id) => { send({ type: 'query_dashboard', payload: { dashboard_id: id } }); }, []);
    const readLogs = useCallback((service, filter) => {
        setState(s => ({ ...s, logLines: [], terminalBusy: true }));
        send({ type: 'read_logs', payload: { service, filter } });
    }, []);
    const callRunbook = useCallback((id) => { send({ type: 'call_runbook', payload: { id } }); }, []);
    const sendSlack = useCallback((channel, message) => {
        const outgoing = { id: uuidv4(), channel, message, sender: candidateNameRef.current || 'engineer', ts: new Date().toISOString() };
        setState(s => ({ ...s, slackMessages: [...s.slackMessages, outgoing] }));
        send({ type: 'send_slack', payload: { channel, message } });
    }, []);
    const declareSeverity = useCallback((severity) => {
        setState(s => ({ ...s, severityDeclared: severity }));
        send({ type: 'declare_severity', payload: { severity } });
    }, []);
    const escalate = useCallback((to, message) => {
        const sysMsg = { id: uuidv4(), channel: `@${to}`, message: `Escalation: ${message}`, sender: candidateNameRef.current || 'engineer', ts: new Date().toISOString() };
        setState(s => ({ ...s, slackMessages: [...s.slackMessages, sysMsg] }));
        send({ type: 'escalate', payload: { to, message } });
    }, []);
    const resolveIncident = useCallback(() => {
        setState(s => ({ ...s, incidentResolved: true, terminalBusy: true }));
        send({ type: 'resolve_incident', payload: {} });
    }, []);
    const setActivePanel = useCallback((panel) => { setState(s => ({ ...s, activePanel: panel })); }, []);
    const acknowledgeAlert = useCallback((alertId) => {
        setState(s => ({ ...s, alerts: s.alerts.map(a => a.id === alertId ? { ...a, acknowledged: true } : a) }));
    }, []);
    return [state, { connect, sendCommand, queryDashboard, readLogs, callRunbook, sendSlack, declareSeverity, escalate, resolveIncident, setActivePanel, acknowledgeAlert }];
}
