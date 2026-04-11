import { useEffect, useState } from 'react'
import { SimulationState, SimulationActions } from '../hooks/useSimulation'
import AlertPanel from '../components/AlertPanel'
import Terminal from '../components/Terminal'
import GrafanaDashboard from '../components/GrafanaDashboard'
import RunbookViewer from '../components/RunbookViewer'
import IncidentPanel from '../components/IncidentPanel'
import CommsPanel from '../components/CommsPanel'
import OnboardingModal from '../components/OnboardingModal'
import GCPConsole from '../components/GCPConsole'
import NewRelicPanel from '../components/NewRelicPanel'
import TourGuide from '../components/TourGuide'
import WarRoom from '../components/WarRoom'
import DBConsole from '../components/DBConsole'
import ConfluentPanel from '../components/ConfluentPanel'
import RedisPanel from '../components/RedisPanel'

interface SimulationProps {
  state: SimulationState
  actions: SimulationActions
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const SEVERITY_STYLE: Record<string, string> = {
  sev1: 'bg-[#f85149] text-white',
  sev2: 'bg-[#d18616] text-white',
  sev3: 'bg-[#d29922] text-black'
}
const SEVERITY_LABEL: Record<string, string> = { sev1: 'P1', sev2: 'P2', sev3: 'P3' }

const TABS = [
  { id: 'terminal', label: '⌨ Terminal' },
  { id: 'dashboard', label: '📊 Grafana' },
  { id: 'gcp-console', label: '🌐 GCP Console' },
  { id: 'new-relic', label: '📈 New Relic' },
  { id: 'db-console', label: '🗄 DB Console' },
  { id: 'confluent', label: '⚡ Confluent' },
  { id: 'redis', label: '⬡ Redis' },
  { id: 'runbook', label: '📖 Runbook' },
] as const

type TabId = typeof TABS[number]['id']

export default function Simulation({ state, actions }: SimulationProps) {
  const { sessionInfo, systemState, activePanel, elapsedSeconds, severityDeclared, connected } = state
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [showTour, setShowTour] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [elapsedAtDismissal, setElapsedAtDismissal] = useState<number | null>(null)
  const [expandedCenter, setExpandedCenter] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [showCommsDrawer, setShowCommsDrawer] = useState(false)
  const [showEscalateModal, setShowEscalateModal] = useState(false)
  const [showWarRoom, setShowWarRoom] = useState(false)
  const [escalateTo, setEscalateTo] = useState('')
  const [escalateMsg, setEscalateMsg] = useState('')

  // Auto-request fullscreen when simulation loads
  useEffect(() => {
    const el = document.documentElement
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    }
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  function handleDismissOnboarding() {
    setShowOnboarding(false)
    setShowTour(true)
    // Timer starts only when tour is also dismissed — see handleFinishTour
  }

  function handleFinishTour() {
    setElapsedAtDismissal(elapsedSeconds) // timer starts NOW
    setShowTour(false)
  }

  function handleEscalateSubmit() {
    if (!escalateTo.trim() || !escalateMsg.trim()) return
    actions.escalate(escalateTo.trim(), escalateMsg.trim())
    setEscalateTo(''); setEscalateMsg(''); setShowEscalateModal(false)
  }

  const timeLimitSeconds = (sessionInfo?.time_limit_minutes ?? 15) * 60
  // Timer counts from when the user dismissed the onboarding modal
  const effectiveElapsed = elapsedAtDismissal !== null ? Math.max(0, elapsedSeconds - elapsedAtDismissal) : 0
  const timeRemaining = Math.max(0, timeLimitSeconds - effectiveElapsed)
  const timeIsLow = timeRemaining < 120 // last 2 minutes

  function handleTabClick(tab: TabId) {
    if (tab === 'runbook' && !state.openRunbook) return
    actions.setActivePanel(tab)
  }

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] overflow-hidden font-mono text-xs">
      {/* Onboarding modal */}
      {showOnboarding && sessionInfo && (
        <OnboardingModal
          onDismiss={handleDismissOnboarding}
          scenarioName={sessionInfo.scenario_name}
          timeLimitMinutes={sessionInfo.time_limit_minutes}
        />
      )}

      {/* Tour guide */}
      {showTour && <TourGuide onFinish={handleFinishTour} />}

      {/* Top bar */}
      <div className="flex-shrink-0 h-11 bg-[#161b22] border-b border-[#30363d] flex items-center px-3 gap-3">
        <span className="text-[#3fb950] font-bold tracking-tight">SRE·SIM</span>

        {sessionInfo && (
          <span className="text-[#8b949e] truncate hidden sm:block">{sessionInfo.scenario_name}</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {severityDeclared && (
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${SEVERITY_STYLE[severityDeclared] ?? ''}`}>
              {SEVERITY_LABEL[severityDeclared] ?? severityDeclared.toUpperCase()}
            </span>
          )}

          {/* Countdown timer */}
          <div className={`font-bold tabular-nums px-2 py-0.5 rounded ${timeIsLow ? 'bg-[#f85149] text-white animate-pulse' : 'text-[#3fb950]'}`}>
            {showOnboarding ? '⏸ Paused' : `⏱ ${formatElapsed(timeRemaining)} left`}
          </div>

          <span className={`text-xs ${connected ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
            {connected ? '● LIVE' : '○ OFF'}
          </span>

          <button
            onClick={() => { if (elapsedAtDismissal === null) handleFinishTour(); else setShowTour(true) }}
            className="text-[#484f58] hover:text-[#58a6ff] px-1.5 transition-colors"
            title="Take tour"
          >
            🗺
          </button>

          <button
            onClick={toggleFullscreen}
            className="text-[#484f58] hover:text-[#e6edf3] px-1.5 transition-colors text-base"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⊡' : '⊞'}
          </button>

          <button
            onClick={() => setShowOnboarding(true)}
            className="text-[#484f58] hover:text-[#58a6ff] px-1.5 transition-colors"
            title="Show instructions"
          >
            ?
          </button>
        </div>
      </div>

      {/* Main layout: left panel | centre */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Left: Alerts + Incident stacked — collapsible */}
        <div className={`flex-shrink-0 flex flex-col overflow-hidden transition-all duration-200 border-r border-[#30363d] ${leftCollapsed || expandedCenter ? 'w-0' : 'w-64'}`}>
          {/* Alerts (top half) */}
          <div className="flex-1 overflow-hidden min-h-0">
            <AlertPanel
              alerts={state.alerts}
              onAcknowledge={actions.acknowledgeAlert}
              sessionStartedAt={state.sessionStartedAt}
            />
          </div>
          {/* Incident (bottom half) */}
          <div className="flex-shrink-0 border-t border-[#30363d] overflow-y-auto" style={{ maxHeight: '55%' }}>
            <IncidentPanel
              severityDeclared={severityDeclared}
              incidentResolved={state.incidentResolved}
              elapsedSeconds={elapsedSeconds}
              availableRunbooks={sessionInfo?.available_runbooks ?? []}
              onDeclareSeverity={actions.declareSeverity}
              onEscalate={actions.escalate}
              onResolveIncident={actions.resolveIncident}
              onCallRunbook={actions.callRunbook}
              hideEscalate
            />
          </div>
        </div>

        {/* Collapse/expand toggle for left panel */}
        {!expandedCenter && (
          <button
            onClick={() => setLeftCollapsed(c => !c)}
            className="absolute top-1/2 -translate-y-1/2 z-20 bg-[#21262d] border border-[#30363d] hover:border-[#58a6ff] text-[#484f58] hover:text-[#58a6ff] rounded-r text-[10px] py-3 px-0.5 transition-colors"
            style={{ left: leftCollapsed ? 0 : 256 }}
            title={leftCollapsed ? 'Expand left panel' : 'Collapse left panel'}
          >
            {leftCollapsed ? '›' : '‹'}
          </button>
        )}

        {/* Centre: tabs + panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 flex bg-[#161b22] border-b border-[#30363d] overflow-x-auto items-center">
            {TABS.map(tab => {
              const disabled = tab.id === 'runbook' && !state.openRunbook
              const isActive = activePanel === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  disabled={disabled}
                  className={`px-4 py-2 text-xs transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                    isActive ? 'text-[#e6edf3] border-[#3fb950]'
                    : disabled ? 'text-[#484f58] border-transparent cursor-not-allowed'
                    : 'text-[#8b949e] border-transparent hover:text-[#e6edf3]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
            {/* Expand/collapse full-width toggle */}
            <button
              onClick={() => setExpandedCenter(e => !e)}
              className="ml-auto mr-2 text-[#484f58] hover:text-[#e6edf3] px-2 py-1 transition-colors text-[11px] border border-[#30363d] rounded flex-shrink-0"
              title={expandedCenter ? 'Restore panels' : 'Full-width view'}
            >
              {expandedCenter ? '⊡ Restore' : '⤢ Full'}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {activePanel === 'terminal' && (
              <Terminal lines={state.terminalLines} onCommand={actions.sendCommand} onCancel={actions.cancelCommand} busy={state.terminalBusy} />
            )}
            {activePanel === 'dashboard' && (
              <GrafanaDashboard systemState={systemState} />
            )}
            {activePanel === 'runbook' && state.openRunbook && (
              <RunbookViewer runbook={state.openRunbook} onClose={() => actions.setActivePanel('terminal')} />
            )}
            {activePanel === 'gcp-console' && (
              <GCPConsole systemState={systemState} />
            )}
            {activePanel === 'new-relic' && (
              <NewRelicPanel systemState={systemState} />
            )}
            {activePanel === 'db-console' && (
              <DBConsole systemState={systemState} />
            )}
            {activePanel === 'confluent' && (
              <ConfluentPanel systemState={systemState} />
            )}
            {activePanel === 'redis' && (
              <RedisPanel systemState={systemState} />
            )}
          </div>
        </div>

        {/* Floating action buttons — bottom-right */}
        <div className="absolute bottom-5 right-4 flex flex-col items-end gap-3 z-30">
          {/* War Room float button */}
          <button
            onClick={() => { setShowWarRoom(true); setShowEscalateModal(false); setShowCommsDrawer(false) }}
            className={`w-12 h-12 rounded-full shadow-lg border-2 flex items-center justify-center text-xl transition-all ${showWarRoom ? 'bg-[#58a6ff] border-[#58a6ff] text-white' : 'bg-[#161b22] border-[#58a6ff]/60 text-[#58a6ff] hover:bg-[#0d2a4a]'}`}
            title="War Room Call"
          >
            📞
          </button>

          {/* Escalate float button */}
          <div className="relative">
            {showEscalateModal && (
              <div className="absolute bottom-12 right-0 w-72 bg-[#161b22] border border-[#f85149]/60 rounded-lg shadow-2xl p-4 font-mono text-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#f85149] font-bold uppercase tracking-widest text-[10px]">Escalate</span>
                  <button onClick={() => setShowEscalateModal(false)} className="text-[#484f58] hover:text-[#e6edf3]">✕</button>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={escalateTo}
                    onChange={e => setEscalateTo(e.target.value)}
                    placeholder="To (e.g. sre-lead, eng-manager)"
                    className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#f85149] font-mono"
                    autoFocus
                  />
                  <textarea
                    value={escalateMsg}
                    onChange={e => setEscalateMsg(e.target.value)}
                    placeholder="Describe the situation and what help you need…"
                    rows={3}
                    className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#f85149] font-mono resize-none"
                  />
                  <button
                    onClick={handleEscalateSubmit}
                    disabled={!escalateTo.trim() || !escalateMsg.trim()}
                    className="w-full bg-[#f85149] hover:bg-[#ff6b63] disabled:opacity-40 text-white font-bold text-xs py-1.5 rounded transition-colors"
                  >
                    Send Escalation
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => { setShowEscalateModal(e => !e); setShowCommsDrawer(false) }}
              className={`w-12 h-12 rounded-full shadow-lg border-2 flex items-center justify-center text-xl transition-all ${showEscalateModal ? 'bg-[#f85149] border-[#f85149] text-white' : 'bg-[#161b22] border-[#f85149]/60 text-[#f85149] hover:bg-[#2a0a0a]'}`}
              title="Escalate"
            >
              🚨
            </button>
          </div>

          {/* Slack / Comms float button */}
          <div className="relative">
            {showCommsDrawer && (
              <div className="absolute bottom-14 right-0 w-80 shadow-2xl rounded-lg overflow-hidden border border-[#30363d]">
                <div className="flex items-center justify-between bg-[#161b22] px-3 py-2 border-b border-[#30363d]">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💬</span>
                    <span className="text-[#e6edf3] text-xs font-bold font-mono">Slack</span>
                  </div>
                  <button onClick={() => setShowCommsDrawer(false)} className="text-[#484f58] hover:text-[#e6edf3] text-xs">✕</button>
                </div>
                <CommsPanel messages={state.slackMessages} onSendMessage={actions.sendSlack} />
              </div>
            )}
            {/* Unread badge */}
            <div className="relative">
              {state.slackMessages.length > 0 && !showCommsDrawer && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#3fb950] rounded-full text-[9px] font-bold text-black flex items-center justify-center z-10">
                  {Math.min(state.slackMessages.length, 9)}
                </span>
              )}
              <button
                onClick={() => { setShowCommsDrawer(d => !d); setShowEscalateModal(false) }}
                className={`w-12 h-12 rounded-full shadow-lg border-2 flex items-center justify-center text-xl transition-all ${showCommsDrawer ? 'bg-[#238636] border-[#3fb950] text-white' : 'bg-[#161b22] border-[#3fb950]/60 text-[#3fb950] hover:bg-[#0f2a1a]'}`}
                title="Slack / Comms"
              >
                💬
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* War Room modal */}
      <WarRoom
        isOpen={showWarRoom}
        onClose={() => setShowWarRoom(false)}
        systemState={systemState ?? undefined}
        scenarioName={sessionInfo?.scenario_name}
      />

      {/* Session-ended overlay */}
      {state.sessionEnded && !state.scorecard && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40">
          <div className={`border rounded-lg p-8 text-center font-mono max-w-sm ${
            state.sessionEnded.reason === 'resolved'
              ? 'bg-[#0f2a1a] border-[#3fb950]'
              : state.sessionEnded.reason === 'time_limit'
              ? 'bg-[#2a1e00] border-[#d29922]'
              : 'bg-[#161b22] border-[#30363d]'
          }`}>
            <div className="text-4xl mb-3">
              {state.sessionEnded.reason === 'resolved' ? '🎉' : state.sessionEnded.reason === 'time_limit' ? '⏱' : '✓'}
            </div>
            <div className={`text-xl font-bold mb-2 ${
              state.sessionEnded.reason === 'resolved' ? 'text-[#3fb950]'
              : state.sessionEnded.reason === 'time_limit' ? 'text-[#d29922]'
              : 'text-[#e6edf3]'
            }`}>
              {state.sessionEnded.reason === 'resolved'
                ? 'Exercise Completed!'
                : state.sessionEnded.reason === 'time_limit'
                ? 'Exercise Automatically Submitted'
                : 'Session Ended'}
            </div>
            <div className="text-[#8b949e] text-sm mb-1">
              {state.sessionEnded.reason === 'resolved'
                ? 'Incident resolved successfully'
                : state.sessionEnded.reason === 'time_limit'
                ? 'Time limit reached — your work has been submitted'
                : ''}
            </div>
            <div className="text-[#484f58] text-xs mb-4">Duration: {state.sessionEnded.duration_minutes} min</div>
            <div className="text-[#8b949e] text-xs flex items-center justify-center gap-2">
              <span className="animate-spin">◉</span>
              <span>AI is scoring your performance…</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
