import { useEffect, useState } from 'react'
import { SimulationState, SimulationActions } from '../hooks/useSimulation'
import AlertPanel from '../components/AlertPanel'
import Terminal from '../components/Terminal'
import LogViewer from '../components/LogViewer'
import MetricsDashboard from '../components/MetricsDashboard'
import RunbookViewer from '../components/RunbookViewer'
import IncidentPanel from '../components/IncidentPanel'
import CommsPanel from '../components/CommsPanel'
import OnboardingModal from '../components/OnboardingModal'

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
  { id: 'dashboard', label: '📊 Dashboards' },
  { id: 'logs', label: '📋 Logs' },
  { id: 'runbook', label: '📖 Runbook' }
] as const

type TabId = typeof TABS[number]['id']

export default function Simulation({ state, actions }: SimulationProps) {
  const { sessionInfo, systemState, activePanel, elapsedSeconds, severityDeclared, connected } = state
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

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

  const services = systemState ? Object.values(systemState.services) : []
  const serviceNames = services.map(s => s.name)

  const timeLimitSeconds = (sessionInfo?.time_limit_minutes ?? 10) * 60
  const timeRemaining = Math.max(0, timeLimitSeconds - elapsedSeconds)
  const timeIsLow = timeRemaining < 120 // last 2 minutes

  function handleTabClick(tab: TabId) {
    if (tab === 'runbook' && !state.openRunbook) return
    actions.setActivePanel(tab)
  }

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] overflow-hidden font-mono text-xs select-none">
      {/* Onboarding modal */}
      {showOnboarding && sessionInfo && (
        <OnboardingModal
          onDismiss={() => setShowOnboarding(false)}
          scenarioName={sessionInfo.scenario_name}
          timeLimitMinutes={sessionInfo.time_limit_minutes}
        />
      )}

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
            ⏱ {formatElapsed(timeRemaining)} left
          </div>

          <span className={`text-xs ${connected ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
            {connected ? '● LIVE' : '○ OFF'}
          </span>

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
        {/* Left: Alert panel */}
        <div className="w-64 flex-shrink-0 overflow-hidden">
          <AlertPanel alerts={state.alerts} onAcknowledge={actions.acknowledgeAlert} />
        </div>

        {/* Centre: tabs + panel */}
        <div className="flex-1 flex flex-col overflow-hidden border-x border-[#30363d]">
          <div className="flex-shrink-0 flex bg-[#161b22] border-b border-[#30363d]">
            {TABS.map(tab => {
              const disabled = tab.id === 'runbook' && !state.openRunbook
              const isActive = activePanel === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  disabled={disabled}
                  className={`px-4 py-2 text-xs transition-colors border-b-2 ${
                    isActive ? 'text-[#e6edf3] border-[#3fb950]'
                    : disabled ? 'text-[#484f58] border-transparent cursor-not-allowed'
                    : 'text-[#8b949e] border-transparent hover:text-[#e6edf3]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div className="flex-1 overflow-hidden">
            {activePanel === 'terminal' && (
              <Terminal lines={state.terminalLines} onCommand={actions.sendCommand} busy={state.terminalBusy} />
            )}
            {activePanel === 'dashboard' && (
              <MetricsDashboard systemState={systemState} availableDashboards={sessionInfo?.available_dashboards ?? []} dashboardData={state.dashboardData} onQueryDashboard={actions.queryDashboard} />
            )}
            {activePanel === 'logs' && (
              <LogViewer onQuery={actions.readLogs} logLines={state.logLines} availableServices={serviceNames.length > 0 ? serviceNames : ['api-gateway', 'order-service', 'redis-primary']} busy={state.terminalBusy} />
            )}
            {activePanel === 'runbook' && state.openRunbook && (
              <RunbookViewer runbook={state.openRunbook} onClose={() => actions.setActivePanel('terminal')} />
            )}
          </div>
        </div>

        {/* Right: Incident + Comms */}
        <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0">
            <IncidentPanel
              severityDeclared={severityDeclared}
              incidentResolved={state.incidentResolved}
              systemState={systemState}
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
