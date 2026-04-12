import { useEffect, useRef, useState } from 'react'
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
import IncidentDebrief from '../components/IncidentDebrief'

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
  const warRoomInjectedIdx = useRef(0)
  const [showNotesDrawer, setShowNotesDrawer] = useState(false)
  const [notes, setNotes] = useState('')
  const notesKey = sessionInfo ? `sre-notes-${sessionInfo.session_id}` : null
  const [hintsUsed, setHintsUsed] = useState(0)
  const [showHintModal, setShowHintModal] = useState(false)
  const [hintLoading, setHintLoading] = useState(false)
  const [hintText, setHintText] = useState('')

  // Load notes from localStorage when session is known
  useEffect(() => {
    if (!notesKey) return
    const saved = localStorage.getItem(notesKey)
    if (saved) setNotes(saved)
  }, [notesKey])

  // Persist notes to localStorage on change
  useEffect(() => {
    if (!notesKey) return
    localStorage.setItem(notesKey, notes)
  }, [notes, notesKey])

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

  // Stakeholder messages — auto-injected after incident drags on
  const injectedStakeholderMins = useRef<Set<number>>(new Set())
  useEffect(() => {
    if (!sessionInfo || showOnboarding || !elapsedAtDismissal || state.sessionEnded) return
    const activeSecs = elapsedSeconds - elapsedAtDismissal
    const activeMins = Math.floor(activeSecs / 60)

    const STAKEHOLDER_MSGS: Array<{ atMin: number; channel: string; sender: string; message: string }> = [
      { atMin: 5, channel: '#incidents', sender: 'CS-Bot 🤖', message: '🚨 Customer support is receiving reports of failures. Ticket volume up 340% in the last 5 minutes. Can the SRE team provide an ETA?' },
      { atMin: 6, channel: '#incidents', sender: 'Taiwo Adebayo (PM)', message: 'Hey team — our payment success rate just dropped to 12% on the dashboard. We have ~2,000 affected users. What is our ETA to resolution?' },
      { atMin: 8, channel: '#incidents', sender: 'Chidi Okonkwo (CTO)', message: 'What is the root cause? Do we need to roll back the last deployment? I need an update in the next 2 minutes for the exec call.' },
      { atMin: 10, channel: '#incidents', sender: 'Amaka Eze (CEO)', message: 'I am on the phone with our banking partners. They are asking about the outage. What is the status? When will this be resolved?' },
      { atMin: 12, channel: '#incidents', sender: 'Uche Nwosu (SRE Lead)', message: 'MTTR is now at 12 minutes. If this extends beyond 15 min we trigger the external status page update. Do you need another engineer on the call?' },
      { atMin: 14, channel: '#incidents', sender: 'Taiwo Adebayo (PM)', message: 'We have now exceeded our SLA for P1 incidents (15 min). Regulators may need to be notified. Please post an update to #status-page ASAP.' },
    ]

    for (const msg of STAKEHOLDER_MSGS) {
      if (activeMins >= msg.atMin && !injectedStakeholderMins.current.has(msg.atMin)) {
        injectedStakeholderMins.current.add(msg.atMin)
        actions.injectSlack(msg.channel, msg.sender, msg.message)
      }
    }
  }, [elapsedSeconds, elapsedAtDismissal, sessionInfo, showOnboarding, state.sessionEnded, actions])

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

  function generateContextualHint(): string {
    if (!systemState) return 'Check your dashboards and logs for anomalies. Look for services with elevated error rates.'
    const degraded = Object.entries(systemState.services).filter(([, s]) => s.status === 'degraded').map(([n]) => n)
    const down = Object.entries(systemState.services).filter(([, s]) => s.status === 'down').map(([n]) => n)
    const parts: string[] = []
    if (down.length > 0) parts.push(`⚠ Services DOWN: ${down.join(', ')} — these are completely unreachable.`)
    if (degraded.length > 0) parts.push(`⚠ Services DEGRADED: ${degraded.join(', ')} — elevated error rates or latency.`)
    const topLatency = Object.entries(systemState.services)
      .filter(([, s]) => s.p99_latency_ms > 500)
      .sort(([, a], [, b]) => b.p99_latency_ms - a.p99_latency_ms)
      .slice(0, 2)
    if (topLatency.length > 0) parts.push(`🐢 High latency: ${topLatency.map(([n, s]) => `${n} (${s.p99_latency_ms}ms)`).join(', ')}`)
    if (systemState.active_incidents.length > 0) parts.push(`🔴 ${systemState.active_incidents.length} active incident(s). Look at the blast radius and visible symptoms.`)
    if (parts.length === 0) return 'Services look stable. Check your GrafanaDashboard for metric anomalies and run log queries for recent errors.'
    return parts.join('\n')
  }

  async function handleRequestHint() {
    if (hintsUsed >= 3 || hintLoading || !sessionInfo) return
    setHintLoading(true)
    try {
      const apiBase = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001').replace('ws://', 'http://').replace('wss://', 'https://')
      const res = await fetch(`${apiBase}/sessions/${sessionInfo.session_id}/hint`, { method: 'POST' })
      const data = await res.json() as { hints_used: number; hints_remaining: number; error?: string }
      if (data.error) { setHintText('Max hints reached.'); return }
      setHintsUsed(data.hints_used)
      setHintText(generateContextualHint())
    } catch {
      setHintText(generateContextualHint())
    } finally {
      setHintLoading(false)
    }
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

      {/* Hint modal */}
      {showHintModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#161b22] border border-[#d29922] rounded-xl p-5 w-full max-w-sm font-mono text-xs shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💡</span>
              <div className="text-[#e6edf3] font-bold text-sm">Request a Hint</div>
              <div className="ml-auto text-[#484f58]">{3 - hintsUsed} remaining</div>
            </div>
            {hintText ? (
              <>
                <div className="bg-[#1f1a0a] border border-[#d29922]/40 rounded-lg p-3 mb-4 text-[#d29922] leading-relaxed whitespace-pre-wrap">{hintText}</div>
                <div className="text-[#484f58] text-[10px] mb-3">-5 points have been deducted from your score.</div>
                <button onClick={() => { setShowHintModal(false); setHintText('') }}
                  className="w-full py-2 rounded border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors">
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="text-[#8b949e] mb-4 leading-relaxed">Each hint costs <span className="text-[#f85149] font-bold">-5 points</span> from your final score. You have used <span className="text-[#d29922] font-bold">{hintsUsed}/3</span> hints.</div>
                <div className="flex gap-3">
                  <button onClick={() => setShowHintModal(false)}
                    className="flex-1 py-2 rounded border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleRequestHint} disabled={hintLoading}
                    className="flex-1 py-2 rounded bg-[#d29922] hover:bg-[#e3b341] disabled:opacity-60 text-[#0d1117] font-bold transition-colors">
                    {hintLoading ? 'Loading…' : 'Get Hint (-5 pts)'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex-shrink-0 h-11 bg-[#161b22] border-b border-[#30363d] flex items-center px-3 gap-3">
        <span className="text-[#3fb950] font-bold tracking-tight">SRE·SIM</span>

        {sessionInfo && (
          <span className="text-[#8b949e] truncate hidden sm:block">{sessionInfo.scenario_name}</span>
        )}
        {sessionInfo?.is_practice && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#d29922]/20 text-[#d29922] border border-[#d29922]/40 flex-shrink-0">
            PRACTICE
          </span>
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

          {sessionInfo && hintsUsed < 3 && (
            <button
              onClick={() => setShowHintModal(true)}
              className="text-[#d29922] hover:text-[#e3b341] px-1.5 transition-colors text-xs font-bold"
              title="Request a hint (-5 pts)"
            >
              💡 {3 - hintsUsed}
            </button>
          )}

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
              <GCPConsole systemState={systemState} onScaleService={actions.scaleService} />
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
          {/* Notes float button */}
          <div className="relative">
            {showNotesDrawer && (
              <div className="absolute bottom-14 right-0 w-80 bg-[#161b22] border border-[#d18616]/60 rounded-lg shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d]">
                  <span className="text-[#d18616] font-bold text-[10px] uppercase tracking-widest">📝 Notes</span>
                  <span className="text-[#484f58] text-[10px]">auto-saved</span>
                </div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={"Jot down observations, hypotheses, commands to try…\n\nE.g.:\n• Redis OOM at 14:03\n• DB conn pool maxed — scale up?\n• Check redis-cli info memory"}
                  className="w-full h-52 bg-[#0d1117] text-[#e6edf3] text-[11px] font-mono px-3 py-2 resize-none focus:outline-none placeholder-[#484f58] leading-relaxed"
                  autoFocus
                />
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d1117] border-t border-[#30363d]">
                  <span className="text-[#484f58] text-[10px]">{notes.length} chars</span>
                  <button
                    onClick={() => { setNotes(''); localStorage.removeItem(notesKey ?? '') }}
                    className="text-[#484f58] hover:text-[#f85149] text-[10px] transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => { setShowNotesDrawer(d => !d); setShowCommsDrawer(false); setShowEscalateModal(false) }}
              className={`w-12 h-12 rounded-full shadow-lg border-2 flex items-center justify-center text-xl transition-all ${showNotesDrawer ? 'bg-[#d18616] border-[#d18616] text-white' : 'bg-[#161b22] border-[#d18616]/60 text-[#d18616] hover:bg-[#2a1e00]'}`}
              title="Notes"
            >
              📝
            </button>
          </div>

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
        onTranscriptUpdate={entries => {
          // Only inject new entries not yet pushed to Comms
          const newEntries = entries.slice(warRoomInjectedIdx.current)
          newEntries.forEach(e => {
            const sender = e.speaker === 'you' ? (sessionInfo?.candidate_name ?? 'You') : e.speaker === 'alex' ? 'Alex (SRE Lead) 📞' : 'Sarah (EM) 📞'
            actions.injectSlack('#war-room', sender, e.text)
          })
          warRoomInjectedIdx.current = entries.length
        }}
      />

      {/* Session-ended: waiting for scorecard */}
      {state.sessionEnded && !state.scorecard && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
          <div className={`border rounded-xl p-10 text-center font-mono max-w-sm w-full mx-4 ${
            state.sessionEnded.reason === 'resolved'
              ? 'bg-[#0f2a1a] border-[#3fb950]/60'
              : 'bg-[#2a1e00] border-[#d29922]/60'
          }`}>
            <div className="text-5xl mb-4">
              {state.sessionEnded.reason === 'resolved' ? '🎉' : '⏱'}
            </div>
            <div className={`text-lg font-bold mb-1 ${
              state.sessionEnded.reason === 'resolved' ? 'text-[#3fb950]' : 'text-[#d29922]'
            }`}>
              {state.sessionEnded.reason === 'resolved' ? 'Incident Resolved!' : 'Time Limit Reached'}
            </div>
            <div className="text-[#484f58] text-xs mb-6">Duration: {state.sessionEnded.duration_minutes} min</div>
            <div className="flex items-center justify-center gap-2 text-[#8b949e] text-xs">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Claude is reviewing your performance…
            </div>
          </div>
        </div>
      )}

      {/* Full debrief — shown when scorecard arrives */}
      {state.scorecard && state.sessionEnded && (
        <IncidentDebrief
          scorecard={state.scorecard}
          sessionEnded={state.sessionEnded}
          scenarioName={sessionInfo?.scenario_name ?? 'Incident Simulation'}
          onClose={() => window.location.reload()}
        />
      )}
    </div>
  )
}
