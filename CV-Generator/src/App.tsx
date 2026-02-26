import React from 'react'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { SplitPanel } from '@/components/layout/SplitPanel'

function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Toolbar />
      <SplitPanel />
    </div>
  )
}

export default App
