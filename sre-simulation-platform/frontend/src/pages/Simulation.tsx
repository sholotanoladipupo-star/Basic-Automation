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

const TABS = [
  { id: 'terminal', label: '⌨ Terminal' },
  { id: 'dashboard', label: '📊 Grafana' },
  { id: 'gcp-console', label: '🌐 GCP Console' },
  { id: 'new-relic', label: '📈 New Relic' },
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

  const services = systemState ? Object.values(systemState.services) : []

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
              {severityDeclared.toUpperCase()}
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

      {/* Main layout: left | centre | right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Alert panel — hidden when expanded */}
        <div className={`flex-shrink-0 overflow-hidden transition-all duration-200 ${expandedCenter ? 'w-0' : 'w-64'}`}>
          <AlertPanel
            alerts={state.alerts}
            onAcknowledge={actions.acknowledgeAlert}
            sessionStartedAt={state.sessionStartedAt}
          />
        </div>

        {/* Centre: tabs + panel */}
        <div className="flex-1 flex flex-col overflow-hidden border-x border-[#30363d]">
          <div className="flex-shrink-0 flex bg-[#161b22] border-b border-[#30363d] overflow-x-auto items-center">
            {TABS.map(tab => {
              const disabled = tab.id === 'runbook' && !state.openRunbook
              const isActive = activePanel === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => { handleTabClick(tab.id); if (tab.id !== 'gcp-console' && tab.id !== 'new-relic') setExpandedCenter(false) }}
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
            {/* Expand button only for GCP/New Relic panels */}
            {(activePanel === 'gcp-console' || activePanel === 'new-relic') && (
              <button
                onClick={() => setExpandedCenter(e => !e)}
                className="ml-auto mr-2 text-[#484f58] hover:text-[#e6edf3] px-2 py-1 transition-colors text-[11px] border border-[#30363d] rounded"
                title={expandedCenter ? 'Collapse' : 'Expand full width'}
              >
                {expandedCenter ? '⊡ Collapse' : '⤢ Expand'}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {activePanel === 'terminal' && (
              <Terminal lines={state.terminalLines} onCommand={actions.sendCommand} busy={state.terminalBusy} />
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
          </div>
        </div>

        {/* Right: Incident + Comms — hidden when expanded */}
        <div className={`flex-shrink-0 flex flex-col overflow-hidden transition-all duration-200 ${expandedCenter ? 'w-0' : 'w-64'}`}>
          <div className="flex-1 overflow-y-auto min-h-0">
            <IncidentPanel
              severityDeclared={severityDeclared}
              incidentResolved={state.incidentResolved}
              elapsedSeconds={elapsedSeconds}
              availableRunbooks={sessionInfo?.available_runbooks ?? []}
              onDeclareSeverity={actions.declareSeverity}
              onEscalate={actions.escalate}
              onResolveIncident={actions.resolveIncident}
              onCallRunbook={actions.callRunbook}
            />
          </div>
          <CommsPanel messages={state.slackMessages} onSendMessage={actions.sendSlack} />
        </div>
      </div>

      {/* Session-ended overlay */}
      {state.sessionEnded && !state.scorecard && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 text-center font-mono max-w-sm">
            <div className="text-[#3fb950] text-2xl mb-2">{state.sessionEnded.reason === 'resolved' ? '✓' : '⏱'}</div>
            <div className="text-[#e6edf3] text-lg font-bold mb-2">
              {state.sessionEnded.reason === 'resolved' ? 'Incident Resolved' : state.sessionEnded.reason === 'time_limit' ? 'Time Limit Reached' : 'Session Ended'}
            </div>
            <div className="text-[#8b949e] text-sm mb-4">Duration: {state.sessionEnded.duration_minutes} minutes</div>
            <div className="text-[#8b949e] text-xs">Generating scorecard... <span className="blink">◉</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
