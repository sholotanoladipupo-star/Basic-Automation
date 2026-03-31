import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useSimulation } from './hooks/useSimulation';
import Home from './pages/Home';
import Simulation from './pages/Simulation';
import SessionHistory from './pages/SessionHistory';
import Admin from './pages/Admin';
import SQLSimulation from './pages/SQLSimulation';
import MonitoringSimulation from './pages/MonitoringSimulation';
import CognitiveSimulation from './pages/CognitiveSimulation';
import PostmortemSimulation from './pages/PostmortemSimulation';
import AutomationSimulation from './pages/AutomationSimulation';
export default function App() {
    const [state, actions] = useSimulation();
    const [appScreen, setAppScreen] = useState('home');
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('sre-theme') ?? 'dark';
    });
    useEffect(() => {
        document.documentElement.classList.toggle('light-mode', theme === 'light');
        localStorage.setItem('sre-theme', theme);
    }, [theme]);
    function toggleTheme() {
        setTheme(t => (t === 'dark' ? 'light' : 'dark'));
    }
    // Simulation screens take over when active
    if (state.screen === 'submitted' || state.screen === 'scorecard') {
        return (_jsxs("div", { className: "min-h-screen bg-[#0d1117] flex flex-col items-center justify-center font-mono px-4", children: [_jsx("div", { className: "text-[#3fb950] text-5xl mb-6", children: "\u2713" }), _jsx("h1", { className: "text-2xl font-bold text-[#e6edf3] mb-3 tracking-tight", children: "Exercise Submitted" }), _jsx("p", { className: "text-[#8b949e] text-sm text-center max-w-sm mb-2", children: "Your session has been recorded. Your assessor will review your results." }), state.sessionEnded?.reason === 'time_limit' && (_jsx("p", { className: "text-[#d29922] text-xs font-bold mb-6", children: "\u23F1 Time limit reached \u2014 your answers were auto-submitted." })), _jsx("div", { className: "mt-8 text-[#484f58] text-xs", children: "You may now close this window." })] }));
    }
    if (state.screen === 'simulation') {
        const moduleType = state.sessionInfo?.module_type ?? 'incident';
        if (moduleType === 'sql')
            return _jsx(SQLSimulation, { sessionInfo: state.sessionInfo });
        if (moduleType === 'monitoring')
            return _jsx(MonitoringSimulation, { sessionInfo: state.sessionInfo });
        if (moduleType === 'cognitive')
            return _jsx(CognitiveSimulation, { sessionInfo: state.sessionInfo });
        if (moduleType === 'postmortem')
            return _jsx(PostmortemSimulation, { sessionInfo: state.sessionInfo });
        if (moduleType === 'automation')
            return _jsx(AutomationSimulation, { sessionInfo: state.sessionInfo });
        return _jsx(Simulation, { state: state, actions: actions });
    }
    if (appScreen === 'history')
        return _jsx(SessionHistory, { onBack: () => setAppScreen('home') });
    if (appScreen === 'admin')
        return _jsx(Admin, { onBack: () => setAppScreen('home') });
    return (_jsx(Home, { onStart: actions.connect, connecting: state.connecting, connectionError: state.connectionError, onViewHistory: () => setAppScreen('history'), onAdmin: () => setAppScreen('admin'), theme: theme, onToggleTheme: toggleTheme }));
}
