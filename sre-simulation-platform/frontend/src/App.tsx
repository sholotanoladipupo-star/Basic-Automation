import { useState } from 'react'
import { useSimulation } from './hooks/useSimulation'
import Home from './pages/Home'
import Simulation from './pages/Simulation'
import ScoreCardPage from './pages/ScoreCardPage'
import SessionHistory from './pages/SessionHistory'
import Admin from './pages/Admin'
import SQLSimulation from './pages/SQLSimulation'
import MonitoringSimulation from './pages/MonitoringSimulation'

type AppScreen = 'home' | 'history' | 'admin'

export default function App() {
  const [state, actions] = useSimulation()
  const [appScreen, setAppScreen] = useState<AppScreen>('home')

  // Simulation screens take over when active
  if (state.screen === 'scorecard') {
    if (!state.scorecard) return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center font-mono text-[#8b949e] text-sm animate-pulse">
        Loading results…
      </div>
    )
    return <ScoreCardPage scorecard={state.scorecard} sessionEnded={state.sessionEnded} />
  }
  if (state.screen === 'simulation') {
    const moduleType = state.sessionInfo?.module_type ?? 'incident'
    if (moduleType === 'sql') {
      return <SQLSimulation sessionInfo={state.sessionInfo!} />
    }
    if (moduleType === 'monitoring') {
      return <MonitoringSimulation sessionInfo={state.sessionInfo!} />
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
