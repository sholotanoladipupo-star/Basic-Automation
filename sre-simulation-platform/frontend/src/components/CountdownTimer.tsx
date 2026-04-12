import { useEffect, useState } from 'react'

interface Props {
  totalSeconds: number
  onExpire?: () => void
  paused?: boolean
}

export default function CountdownTimer({ totalSeconds, onExpire, paused = false }: Props) {
  const [remaining, setRemaining] = useState(totalSeconds)

  useEffect(() => {
    setRemaining(totalSeconds)
  }, [totalSeconds])

  useEffect(() => {
    if (paused || remaining <= 0) return
    const id = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { onExpire?.(); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [paused, remaining, onExpire])

  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  const pct = totalSeconds > 0 ? remaining / totalSeconds : 0
  const isLow = remaining < 120
  const color = isLow ? '#f85149' : pct < 0.4 ? '#d29922' : '#3fb950'

  return (
    <div className={`flex items-center gap-2 font-mono text-xs font-bold tabular-nums px-3 py-1.5 rounded border ${isLow ? 'border-[#f85149]/60 bg-[#2a0a0a] animate-pulse' : 'border-[#30363d] bg-[#161b22]'}`} style={{ color }}>
      <svg width="14" height="14" viewBox="0 0 14 14" className="flex-shrink-0">
        <circle cx="7" cy="7" r="6" fill="none" stroke="#30363d" strokeWidth="1.5"/>
        <circle
          cx="7" cy="7" r="6"
          fill="none" stroke={color} strokeWidth="1.5"
          strokeDasharray={`${pct * 37.7} 37.7`}
          strokeLinecap="round"
          transform="rotate(-90 7 7)"
          style={{ transition: 'stroke-dasharray 1s linear' }}
        />
      </svg>
      ⏱ {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')} left
    </div>
  )
}
