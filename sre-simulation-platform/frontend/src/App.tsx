import { useState } from 'react'
import { useSimulation } from './hooks/useSimulation'
import Home from './pages/Home'
import Simulation from './pages/Simulation'
import ScoreCardPage from './pages/ScoreCardPage'
import SessionHistory from './pages/SessionHistory'
import Admin from './pages/Admin'
import SQLSimulation from './pages/SQLSimulation'
import MonitoringSimulation from './pages/MonitoringSimulation'
import CognitiveSimulation from './pages/CognitiveSimulation'

type AppScreen = 'home' | 'history' | 'admin'

export default function App() {
  const [state, actions] = useSimulation()
  const [appScreen, setAppScreen] = useState<AppScreen>('home')

  // Simulation screens take over when active
  if (state.screen === 'submitted' || state.screen === 'scorecard') {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center font-mono px-4">
        <div className="text-[#3fb950] text-5xl mb-6">✓</div>
        <h1 className="text-2xl font-bold text-[#e6edf3] mb-3 tracking-tight">Exercise Submitted</h1>
        <p className="text-[#8b949e] text-sm text-center max-w-sm mb-2">
          Your session has been recorded. Your assessor will review your results.
        </p>
        {state.sessionEnded?.reason === 'time_limit' && (
          <p className="text-[#d29922] text-xs font-bold mb-6">⏱ Time limit reached — your answers were auto-submitted.</p>
        )}
        <div className="mt-8 text-[#484f58] text-xs">
          You may now close this window.
        </div>
      </div>
    )
  }
  if (state.screen === 'simulation') {
    const moduleType = state.sessionInfo?.module_type ?? 'incident'
    if (moduleType === 'sql') {
      return <SQLSimulation sessionInfo={state.sessionInfo!} />
    }
    if (moduleType === 'monitoring') {
      return <MonitoringSimulation sessionInfo={state.sessionInfo!} />
    }
    if (moduleType === 'cognitive') {
      return <CognitiveSimulation sessionInfo={state.sessionInfo!} />
    }
    return <Simulation state={state} actions={actions} />
  }

  if (appScreen === 'history') {
    return <SessionHistory onBack={() => setAppScreen('home')} />
  }
  if (appScreen === 'admin') {
    return <Admin onBack={() => setAppScreen('home')} />
  }

  return (
    <Home
      onStart={actions.connect}
      connecting={state.connecting}
      connectionError={state.connectionError}
      onViewHistory={() => setAppScreen('history')}
      onAdmin={() => setAppScreen('admin')}
    />
  )
}
