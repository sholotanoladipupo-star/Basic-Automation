import { useState } from 'react'

interface HomeProps {
  onStart: (candidateName: string) => void
  connecting: boolean
  connectionError: string | null
  onViewHistory: () => void
  onAdmin: () => void
}

export default function Home({ onStart, connecting, connectionError, onViewHistory, onAdmin }: HomeProps) {
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim() && !connecting) {
      onStart(name.trim())
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background image with dark overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/moniepoint-bg.png')" }}
      />
      {/* Dark overlay so text remains readable */}
      <div className="absolute inset-0 bg-[#0d1117]/80" />

      {/* Fallback gradient when no image is present */}
      <div className="absolute inset-0 -z-10"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, #0e1a2e 0%, #0d1117 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-[#3fb950] text-xs tracking-widest uppercase mb-3 font-mono">
            ● SYSTEM READY
          </div>
          <h1 className="text-4xl font-bold text-[#e6edf3] font-mono mb-3 tracking-tight">
            Moniepoint SRE Simulation Platform
          </h1>
          <p className="text-[#8b949e] text-sm font-mono whitespace-nowrap">
            Real incidents. Real pressure. Validate your on-call readiness.
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-[#161b22]/95 backdrop-blur border border-[#30363d] rounded-lg p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[#8b949e] uppercase tracking-widest mb-2 font-mono">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm font-mono text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#3fb950] transition-colors"
                disabled={connecting}
                autoFocus
              />
              <p className="text-[#484f58] text-xs font-mono mt-1.5">
                Enter the name your assessor registered you under.
              </p>
            </div>

            {connectionError && (
              <div className="p-3 bg-[#0d1117] border border-[#f85149] rounded text-xs font-mono text-[#f85149]">
                ✗ {connectionError}
              </div>
            )}

            <button
              type="submit"
              disabled={!name.trim() || connecting}
              className="w-full bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] disabled:border-[#30363d] text-[#e6edf3] font-mono font-bold py-3 px-4 rounded border border-[#2ea043] disabled:border-[#30363d] transition-all text-sm tracking-wide"
            >
              {connecting ? '◉ CONNECTING...' : '▶ START SIMULATION'}
            </button>
          </form>
        </div>

        {/* Bottom links */}
        <div className="mt-6 flex items-center gap-6 text-xs font-mono text-[#484f58]">
          <button onClick={onViewHistory} className="hover:text-[#58a6ff] transition-colors">
            📋 Session History
          </button>
          <span>·</span>
          <button onClick={onAdmin} className="hover:text-[#8b949e] transition-colors">
            Admin
          </button>
        </div>
      </div>
    </div>
  )
}
