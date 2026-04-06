import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import AlertPanel from '../components/AlertPanel';
import Terminal from '../components/Terminal';
import GrafanaDashboard from '../components/GrafanaDashboard';
import RunbookViewer from '../components/RunbookViewer';
import IncidentPanel from '../components/IncidentPanel';
import CommsPanel from '../components/CommsPanel';
import OnboardingModal from '../components/OnboardingModal';
import GCPConsole from '../components/GCPConsole';
import NewRelicPanel from '../components/NewRelicPanel';
import TourGuide from '../components/TourGuide';
import WarRoom from '../components/WarRoom';
import DBConsole from '../components/DBConsole';
function formatElapsed(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
const SEVERITY_STYLE = {
    sev1: 'bg-[#f85149] text-white',
    sev2: 'bg-[#d18616] text-white',
    sev3: 'bg-[#d29922] text-black'
};
const SEVERITY_LABEL = { sev1: 'P1', sev2: 'P2', sev3: 'P3' };
const TABS = [
    { id: 'terminal', label: '⌨ Terminal' },
    { id: 'dashboard', label: '📊 Grafana' },
    { id: 'gcp-console', label: '🌐 GCP Console' },
    { id: 'new-relic', label: '📈 New Relic' },
    { id: 'db-console', label: '🗄 DB Console' },
    { id: 'runbook', label: '📖 Runbook' },
];
export default function Simulation({ state, actions }) {
    const { sessionInfo, systemState, activePanel, elapsedSeconds, severityDeclared, connected } = state;
    const [showOnboarding, setShowOnboarding] = useState(true);
    const [showTour, setShowTour] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [elapsedAtDismissal, setElapsedAtDismissal] = useState(null);
    const [expandedCenter, setExpandedCenter] = useState(false);
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [showCommsDrawer, setShowCommsDrawer] = useState(false);
    const [showEscalateModal, setShowEscalateModal] = useState(false);
    const [showWarRoom, setShowWarRoom] = useState(false);
    const [escalateTo, setEscalateTo] = useState('');
    const [escalateMsg, setEscalateMsg] = useState('');
    // Auto-request fullscreen when simulation loads
    useEffect(() => {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
        }
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            if (document.fullscreenElement)
                document.exitFullscreen().catch(() => { });
        };
    }, []);
    function toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }
        else {
            document.documentElement.requestFullscreen().catch(() => { });
        }
    }
    function handleDismissOnboarding() {
        setShowOnboarding(false);
        setShowTour(true);
        // Timer starts only when tour is also dismissed — see handleFinishTour
    }
    function handleFinishTour() {
        setElapsedAtDismissal(elapsedSeconds); // timer starts NOW
        setShowTour(false);
    }
    function handleEscalateSubmit() {
        if (!escalateTo.trim() || !escalateMsg.trim())
            return;
        actions.escalate(escalateTo.trim(), escalateMsg.trim());
        setEscalateTo('');
        setEscalateMsg('');
        setShowEscalateModal(false);
    }
    const timeLimitSeconds = (sessionInfo?.time_limit_minutes ?? 15) * 60;
    // Timer counts from when the user dismissed the onboarding modal
    const effectiveElapsed = elapsedAtDismissal !== null ? Math.max(0, elapsedSeconds - elapsedAtDismissal) : 0;
    const timeRemaining = Math.max(0, timeLimitSeconds - effectiveElapsed);
    const timeIsLow = timeRemaining < 120; // last 2 minutes
    function handleTabClick(tab) {
        if (tab === 'runbook' && !state.openRunbook)
            return;
        actions.setActivePanel(tab);
    }
    return (_jsxs("div", { className: "h-screen flex flex-col bg-[#0d1117] overflow-hidden font-mono text-xs", children: [showOnboarding && sessionInfo && (_jsx(OnboardingModal, { onDismiss: handleDismissOnboarding, scenarioName: sessionInfo.scenario_name, timeLimitMinutes: sessionInfo.time_limit_minutes })), showTour && _jsx(TourGuide, { onFinish: handleFinishTour }), _jsxs("div", { className: "flex-shrink-0 h-11 bg-[#161b22] border-b border-[#30363d] flex items-center px-3 gap-3", children: [_jsx("span", { className: "text-[#3fb950] font-bold tracking-tight", children: "SRE\u00B7SIM" }), sessionInfo && (_jsx("span", { className: "text-[#8b949e] truncate hidden sm:block", children: sessionInfo.scenario_name })), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [severityDeclared && (_jsx("span", { className: `text-xs px-2 py-0.5 rounded font-bold ${SEVERITY_STYLE[severityDeclared] ?? ''}`, children: SEVERITY_LABEL[severityDeclared] ?? severityDeclared.toUpperCase() })), _jsx("div", { className: `font-bold tabular-nums px-2 py-0.5 rounded ${timeIsLow ? 'bg-[#f85149] text-white animate-pulse' : 'text-[#3fb950]'}`, children: showOnboarding ? '⏸ Paused' : `⏱ ${formatElapsed(timeRemaining)} left` }), _jsx("span", { className: `text-xs ${connected ? 'text-[#3fb950]' : 'text-[#f85149]'}`, children: connected ? '● LIVE' : '○ OFF' }), _jsx("button", { onClick: () => { if (elapsedAtDismissal === null)
                                    handleFinishTour();
                                else
                                    setShowTour(true); }, className: "text-[#484f58] hover:text-[#58a6ff] px-1.5 transition-colors", title: "Take tour", children: "\uD83D\uDDFA" }), _jsx("button", { onClick: toggleFullscreen, className: "text-[#484f58] hover:text-[#e6edf3] px-1.5 transition-colors text-base", title: isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen', children: isFullscreen ? '⊡' : '⊞' }), _jsx("button", { onClick: () => setShowOnboarding(true), className: "text-[#484f58] hover:text-[#58a6ff] px-1.5 transition-colors", title: "Show instructions", children: "?" })] })] }), _jsxs("div", { className: "flex-1 flex overflow-hidden relative", children: [_jsxs("div", { className: `flex-shrink-0 flex flex-col overflow-hidden transition-all duration-200 border-r border-[#30363d] ${leftCollapsed || expandedCenter ? 'w-0' : 'w-64'}`, children: [_jsx("div", { className: "flex-1 overflow-hidden min-h-0", children: _jsx(AlertPanel, { alerts: state.alerts, onAcknowledge: actions.acknowledgeAlert, sessionStartedAt: state.sessionStartedAt }) }), _jsx("div", { className: "flex-shrink-0 border-t border-[#30363d] overflow-y-auto", style: { maxHeight: '55%' }, children: _jsx(IncidentPanel, { severityDeclared: severityDeclared, incidentResolved: state.incidentResolved, elapsedSeconds: elapsedSeconds, availableRunbooks: sessionInfo?.available_runbooks ?? [], onDeclareSeverity: actions.declareSeverity, onEscalate: actions.escalate, onResolveIncident: actions.resolveIncident, onCallRunbook: actions.callRunbook, hideEscalate: true }) })] }), !expandedCenter && (_jsx("button", { onClick: () => setLeftCollapsed(c => !c), className: "absolute top-1/2 -translate-y-1/2 z-20 bg-[#21262d] border border-[#30363d] hover:border-[#58a6ff] text-[#484f58] hover:text-[#58a6ff] rounded-r text-[10px] py-3 px-0.5 transition-colors", style: { left: leftCollapsed ? 0 : 256 }, title: leftCollapsed ? 'Expand left panel' : 'Collapse left panel', children: leftCollapsed ? '›' : '‹' })), _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex-shrink-0 flex bg-[#161b22] border-b border-[#30363d] overflow-x-auto items-center", children: [TABS.map(tab => {
                                        const disabled = tab.id === 'runbook' && !state.openRunbook;
                                        const isActive = activePanel === tab.id;
                                        return (_jsx("button", { onClick: () => handleTabClick(tab.id), disabled: disabled, className: `px-4 py-2 text-xs transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${isActive ? 'text-[#e6edf3] border-[#3fb950]'
                                                : disabled ? 'text-[#484f58] border-transparent cursor-not-allowed'
                                                    : 'text-[#8b949e] border-transparent hover:text-[#e6edf3]'}`, children: tab.label }, tab.id));
                                    }), _jsx("button", { onClick: () => setExpandedCenter(e => !e), className: "ml-auto mr-2 text-[#484f58] hover:text-[#e6edf3] px-2 py-1 transition-colors text-[11px] border border-[#30363d] rounded flex-shrink-0", title: expandedCenter ? 'Restore panels' : 'Full-width view', children: expandedCenter ? '⊡ Restore' : '⤢ Full' })] }), _jsxs("div", { className: "flex-1 overflow-hidden", children: [activePanel === 'terminal' && (_jsx(Terminal, { lines: state.terminalLines, onCommand: actions.sendCommand, busy: state.terminalBusy })), activePanel === 'dashboard' && (_jsx(GrafanaDashboard, { systemState: systemState })), activePanel === 'runbook' && state.openRunbook && (_jsx(RunbookViewer, { runbook: state.openRunbook, onClose: () => actions.setActivePanel('terminal') })), activePanel === 'gcp-console' && (_jsx(GCPConsole, { systemState: systemState })), activePanel === 'new-relic' && (_jsx(NewRelicPanel, { systemState: systemState })), activePanel === 'db-console' && (_jsx(DBConsole, { systemState: systemState }))] })] }), _jsxs("div", { className: "absolute bottom-5 right-4 flex flex-col items-end gap-3 z-30", children: [_jsx("button", { onClick: () => { setShowWarRoom(true); setShowEscalateModal(false); setShowCommsDrawer(false); }, className: `w-12 h-12 rounded-full shadow-lg border-2 flex items-center justify-center text-xl transition-all ${showWarRoom ? 'bg-[#58a6ff] border-[#58a6ff] text-white' : 'bg-[#161b22] border-[#58a6ff]/60 text-[#58a6ff] hover:bg-[#0d2a4a]'}`, title: "War Room Call", children: "\uD83D\uDCDE" }), _jsxs("div", { className: "relative", children: [showEscalateModal && (_jsxs("div", { className: "absolute bottom-12 right-0 w-72 bg-[#161b22] border border-[#f85149]/60 rounded-lg shadow-2xl p-4 font-mono text-xs", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "text-[#f85149] font-bold uppercase tracking-widest text-[10px]", children: "Escalate" }), _jsx("button", { onClick: () => setShowEscalateModal(false), className: "text-[#484f58] hover:text-[#e6edf3]", children: "\u2715" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("input", { type: "text", value: escalateTo, onChange: e => setEscalateTo(e.target.value), placeholder: "To (e.g. sre-lead, eng-manager)", className: "w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#f85149] font-mono", autoFocus: true }), _jsx("textarea", { value: escalateMsg, onChange: e => setEscalateMsg(e.target.value), placeholder: "Describe the situation and what help you need\u2026", rows: 3, className: "w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#f85149] font-mono resize-none" }), _jsx("button", { onClick: handleEscalateSubmit, disabled: !escalateTo.trim() || !escalateMsg.trim(), className: "w-full bg-[#f85149] hover:bg-[#ff6b63] disabled:opacity-40 text-white font-bold text-xs py-1.5 rounded transition-colors", children: "Send Escalation" })] })] })), _jsx("button", { onClick: () => { setShowEscalateModal(e => !e); setShowCommsDrawer(false); }, className: `w-12 h-12 rounded-full shadow-lg border-2 flex items-center justify-center text-xl transition-all ${showEscalateModal ? 'bg-[#f85149] border-[#f85149] text-white' : 'bg-[#161b22] border-[#f85149]/60 text-[#f85149] hover:bg-[#2a0a0a]'}`, title: "Escalate", children: "\uD83D\uDEA8" })] }), _jsxs("div", { className: "relative", children: [showCommsDrawer && (_jsxs("div", { className: "absolute bottom-14 right-0 w-80 shadow-2xl rounded-lg overflow-hidden border border-[#30363d]", children: [_jsxs("div", { className: "flex items-center justify-between bg-[#161b22] px-3 py-2 border-b border-[#30363d]", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-lg", children: "\uD83D\uDCAC" }), _jsx("span", { className: "text-[#e6edf3] text-xs font-bold font-mono", children: "Slack" })] }), _jsx("button", { onClick: () => setShowCommsDrawer(false), className: "text-[#484f58] hover:text-[#e6edf3] text-xs", children: "\u2715" })] }), _jsx(CommsPanel, { messages: state.slackMessages, onSendMessage: actions.sendSlack })] })), _jsxs("div", { className: "relative", children: [state.slackMessages.length > 0 && !showCommsDrawer && (_jsx("span", { className: "absolute -top-1 -right-1 w-4 h-4 bg-[#3fb950] rounded-full text-[9px] font-bold text-black flex items-center justify-center z-10", children: Math.min(state.slackMessages.length, 9) })), _jsx("button", { onClick: () => { setShowCommsDrawer(d => !d); setShowEscalateModal(false); }, className: `w-12 h-12 rounded-full shadow-lg border-2 flex items-center justify-center text-xl transition-all ${showCommsDrawer ? 'bg-[#238636] border-[#3fb950] text-white' : 'bg-[#161b22] border-[#3fb950]/60 text-[#3fb950] hover:bg-[#0f2a1a]'}`, title: "Slack / Comms", children: "\uD83D\uDCAC" })] })] })] })] }), _jsx(WarRoom, { isOpen: showWarRoom, onClose: () => setShowWarRoom(false) }), state.sessionEnded && !state.scorecard && (_jsx("div", { className: "absolute inset-0 bg-black/70 flex items-center justify-center z-40", children: _jsxs("div", { className: `border rounded-lg p-8 text-center font-mono max-w-sm ${state.sessionEnded.reason === 'resolved'
                        ? 'bg-[#0f2a1a] border-[#3fb950]'
                        : state.sessionEnded.reason === 'time_limit'
                            ? 'bg-[#2a1e00] border-[#d29922]'
                            : 'bg-[#161b22] border-[#30363d]'}`, children: [_jsx("div", { className: "text-4xl mb-3", children: state.sessionEnded.reason === 'resolved' ? '🎉' : state.sessionEnded.reason === 'time_limit' ? '⏱' : '✓' }), _jsx("div", { className: `text-xl font-bold mb-2 ${state.sessionEnded.reason === 'resolved' ? 'text-[#3fb950]'
                                : state.sessionEnded.reason === 'time_limit' ? 'text-[#d29922]'
                                    : 'text-[#e6edf3]'}`, children: state.sessionEnded.reason === 'resolved'
                                ? 'Exercise Completed!'
                                : state.sessionEnded.reason === 'time_limit'
                                    ? 'Exercise Automatically Submitted'
                                    : 'Session Ended' }), _jsx("div", { className: "text-[#8b949e] text-sm mb-1", children: state.sessionEnded.reason === 'resolved'
                                ? 'Incident resolved successfully'
                                : state.sessionEnded.reason === 'time_limit'
                                    ? 'Time limit reached — your work has been submitted'
                                    : '' }), _jsxs("div", { className: "text-[#484f58] text-xs mb-4", children: ["Duration: ", state.sessionEnded.duration_minutes, " min"] }), _jsxs("div", { className: "text-[#8b949e] text-xs flex items-center justify-center gap-2", children: [_jsx("span", { className: "animate-spin", children: "\u25C9" }), _jsx("span", { children: "AI is scoring your performance\u2026" })] })] }) }))] }));
}
