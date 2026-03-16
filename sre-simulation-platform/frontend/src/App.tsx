import { useState } from 'react'
import { useSimulation } from './hooks/useSimulation'
import Home from './pages/Home'
import Simulation from './pages/Simulation'
import ScoreCardPage from './pages/ScoreCardPage'
import SessionHistory from './pages/SessionHistory'
import Admin from './pages/Admin'

type AppScreen = 'home' | 'history' | 'admin'

export default function App() {
  const [state, actions] = useSimulation()
  const [appScreen, setAppScreen] = useState<AppScreen>('home')

  // Simulation screens take over when active
  if (state.screen === 'scorecard') {
    return <ScoreCardPage scorecard={state.scorecard!} sessionEnded={state.sessionEnded} />
  }
  if (state.screen === 'simulation') {
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
