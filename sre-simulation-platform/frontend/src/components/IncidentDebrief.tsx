import { useEffect, useState } from 'react'
import { Scorecard } from '../types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

interface IncidentDebriefProps {
  scorecard: Scorecard
  sessionEnded: { reason: string; duration_minutes: number }
  scenarioName: string
  onClose: () => void
}

const QUALITY_COLOR: Record<string, string> = {
  excellent: '#3fb950',
  good: '#58a6ff',
  okay: '#d29922',
  poor: '#f85149',
}

const QUALITY_LABEL: Record<string, string> = {
  excellent: 'EXCELLENT',
  good: 'GOOD',
  okay: 'NEEDS WORK',
  poor: 'MISSED',
}

function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const radius = size / 2 - 8
  const circ = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, score))
  const dash = (pct / 100) * circ
  const color = score >= 70 ? '#3fb950' : score >= 50 ? '#d29922' : '#f85149'

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#21262d" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s ease' }}
      />
      <text
        x={size / 2} y={size / 2 + 6}
        textAnchor="middle"
        fill={color}
        fontSize={size < 80 ? 14 : 22}
        fontWeight="bold"
        fontFamily="ui-monospace, monospace"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
      >
        {score}
      </text>
    </svg>
  )
}

function DimensionBar({ label, score, notes, weight }: { label: string; score: number; notes: string; weight: string }) {
  const color = score >= 70 ? '#3fb950' : score >= 50 ? '#d29922' : '#f85149'
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-[#e6edf3] font-bold text-xs">{label}</span>
          <span className="text-[#484f58] text-[10px] ml-2">{weight} of score</span>
        </div>
        <span className="font-bold text-sm tabular-nums" style={{ color }}>{score}/100</span>
      </div>
      <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      {notes && (
        <p className="text-[#8b949e] text-[11px] leading-relaxed">{notes}</p>
      )}
    </div>
  )
}

export default function IncidentDebrief({ scorecard, sessionEnded, scenarioName, onClose }: IncidentDebriefProps) {
  const passed = scorecard.overall_score >= 70
  const dims = scorecard.dimensions
  const [percentile, setPercentile] = useState<number | null>(null)

  useEffect(() => {
    fetch(`${API}/percentile/${scorecard.overall_score}`)
      .then(r => r.json())
      .then(d => { if (d.percentile != null) setPercentile(d.percentile) })
      .catch(() => {})
  }, [scorecard.overall_score])

  const dimensions = [
    { label: 'Incident Coordination', score: dims.coordination.score, notes: dims.coordination.notes, weight: '25%' },
    { label: 'Incident Resolution', score: dims.resolution.score, notes: dims.resolution.notes, weight: '35%' },
    { label: 'Technical Depth', score: dims.technical_depth.score, notes: dims.technical_depth.notes, weight: '25%' },
    { label: 'Observability Usage', score: dims.observability.score, notes: dims.observability.notes, weight: '15%' },
  ]

  function handlePrint() {
    const w = window.open('', '_blank')
    if (!w) return
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>SRE Simulation Debrief — ${scenarioName}</title>
  <style>
    body { font-family: ui-monospace, monospace; padding: 32px; color: #1a1a1a; font-size: 12px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 24px; }
    .score { font-size: 48px; font-weight: bold; color: ${passed ? '#1a7f37' : '#cf222e'}; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
    .pass { background: #d1f7dd; color: #1a7f37; }
    .fail { background: #ffd8d8; color: #cf222e; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td, th { text-align: left; padding: 4px 8px; border-bottom: 1px solid #eee; }
    th { font-weight: bold; color: #555; }
    .bar-wrap { background: #eee; border-radius: 4px; height: 6px; width: 100%; }
    .bar-fill { height: 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>${scenarioName}</h1>
  <div style="color:#555;margin-bottom:16px">SRE Simulation Debrief · ${new Date().toLocaleDateString()}</div>
  <div class="score">${scorecard.overall_score}/100</div>
  <div style="margin:8px 0">
    <span class="badge ${passed ? 'pass' : 'fail'}">${passed ? '✓ PASS' : '✗ FAIL'}</span>
    <span style="margin-left:8px;color:#555">Duration: ${sessionEnded.duration_minutes} min · ${sessionEnded.reason === 'resolved' ? 'Resolved' : 'Time limit reached'}</span>
    ${percentile != null ? `<span style="margin-left:8px;color:#555">Top ${100 - percentile}% of all candidates</span>` : ''}
  </div>
  ${scorecard.postmortem ? `<h2>AI Assessor Feedback</h2><p>${scorecard.postmortem}</p>` : ''}
  <h2>Performance Breakdown</h2>
  <table>
    <tr><th>Dimension</th><th>Score</th><th>Weight</th></tr>
    ${dimensions.map(d => `<tr><td>${d.label}</td><td>${d.score}/100</td><td>${d.weight}</td></tr>`).join('')}
  </table>
  ${(scorecard.timeline_highlights?.length ?? 0) > 0 ? `
  <h2>Key Moments</h2>
  <table>
    ${scorecard.timeline_highlights!.map(h => `<tr><td>${h.ts}</td><td>${h.event}</td><td>${h.quality?.toUpperCase()}</td></tr>`).join('')}
  </table>` : ''}
  <p style="color:#888;font-size:10px;margin-top:32px">Generated by SRE Simulation Platform</p>
</body>
</html>`
    w.document.write(html)
    w.document.close()
    w.print()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 overflow-y-auto flex items-start justify-center py-6 px-4">
      <div className="w-full max-w-3xl space-y-4 font-mono text-xs">

        {/* Header */}
        <div className={`rounded-xl p-6 border ${passed ? 'bg-[#0f2a1a] border-[#3fb950]/50' : 'bg-[#2a0a0a] border-[#f85149]/50'}`}>
          <div className="flex items-center gap-6">
            <ScoreRing score={scorecard.overall_score} size={110} />
            <div className="flex-1">
              <div className={`text-2xl font-bold mb-1 ${passed ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                {passed ? 'Incident Resolved' : 'Time Limit Reached'}
              </div>
              <div className="text-[#8b949e] text-sm mb-2">{scenarioName}</div>
              <div className="flex gap-3 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${passed ? 'bg-[#3fb950]/20 text-[#3fb950] border-[#3fb950]/40' : 'bg-[#f85149]/20 text-[#f85149] border-[#f85149]/40'}`}>
                  {passed ? '✓ PASS' : '✗ FAIL'} — passing score: 70
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                  ⏱ {sessionEnded.duration_minutes} min
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  sessionEnded.reason === 'resolved'
                    ? 'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30'
                    : 'bg-[#d29922]/10 text-[#d29922] border-[#d29922]/30'
                }`}>
                  {sessionEnded.reason === 'resolved' ? '✓ Resolved' : '⏱ Time limit'}
                </span>
                {percentile != null && (
                  <span className="px-3 py-1 rounded-full text-xs bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/30">
                    🏆 Top {100 - percentile}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Assessment */}
        {scorecard.postmortem && (
          <div className="bg-[#161b22] border border-[#58a6ff]/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#58a6ff] text-base">🤖</span>
              <span className="text-[#58a6ff] font-bold uppercase tracking-widest text-[10px]">AI Assessor Feedback</span>
            </div>
            <p className="text-[#c9d1d9] leading-relaxed text-[12px]">{scorecard.postmortem}</p>
          </div>
        )}

        {/* Dimension scores */}
        <div>
          <div className="text-[#484f58] uppercase tracking-widest text-[9px] mb-2 px-1">Performance Breakdown</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dimensions.map(d => <DimensionBar key={d.label} {...d} />)}
          </div>
        </div>

        {/* Timeline highlights */}
        {scorecard.timeline_highlights && scorecard.timeline_highlights.length > 0 && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
            <div className="text-[#484f58] uppercase tracking-widest text-[9px] mb-3">Key Moments</div>
            <div className="space-y-2">
              {scorecard.timeline_highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{
                      background: `${QUALITY_COLOR[h.quality]}20`,
                      color: QUALITY_COLOR[h.quality],
                      border: `1px solid ${QUALITY_COLOR[h.quality]}40`,
                    }}
                  >
                    {QUALITY_LABEL[h.quality]}
                  </span>
                  <div>
                    <span className="text-[#484f58] text-[10px] mr-2">{h.ts}</span>
                    <span className="text-[#c9d1d9] text-[11px]">{h.event}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What to improve */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
          <div className="text-[#484f58] uppercase tracking-widest text-[9px] mb-3">What to Focus on Next</div>
          <div className="space-y-2">
            {dimensions
              .filter(d => d.score < 80)
              .sort((a, b) => a.score - b.score)
              .map(d => (
                <div key={d.label} className="flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <div className="h-1 bg-[#21262d] rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${d.score}%`, background: d.score >= 70 ? '#d29922' : '#f85149' }} />
                    </div>
                  </div>
                  <span className="text-[#8b949e] text-[11px]">{d.label} — {d.score}/100</span>
                </div>
              ))}
            {dimensions.every(d => d.score >= 80) && (
              <div className="text-[#3fb950] text-[11px]">✓ Strong performance across all dimensions</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pb-4">
          <button
            onClick={handlePrint}
            className="px-6 py-2.5 bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] font-bold rounded-lg border border-[#30363d] transition-colors text-sm"
          >
            🖨 Export / Print
          </button>
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-[#238636] hover:bg-[#2ea043] text-white font-bold rounded-lg border border-[#2ea043] transition-colors text-sm tracking-wide"
          >
            Close Debrief
          </button>
        </div>

      </div>
    </div>
  )
}
