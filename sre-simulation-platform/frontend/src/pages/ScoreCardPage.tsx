import { Scorecard } from '../types'

interface ScoreCardPageProps {
  scorecard: Scorecard
  sessionEnded: { reason: string; duration_minutes: number } | null
}

const QUALITY_STYLES: Record<string, string> = {
  excellent: 'bg-[#238636] text-white',
  good: 'bg-[#1f6feb] text-white',
  okay: 'bg-[#9e6a03] text-white',
  poor: 'bg-[#da3633] text-white'
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? '#3fb950' : score >= 60 ? '#d29922' : '#f85149'
  return (
    <div className="flex items-center justify-center w-32 h-32 rounded-full border-4 mx-auto" style={{ borderColor: color }}>
      <div>
        <div className="text-4xl font-bold text-center" style={{ color }}>{score}</div>
        <div className="text-xs text-[#8b949e] text-center">/100</div>
      </div>
    </div>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#3fb950' : score >= 60 ? '#d29922' : '#f85149'
  return (
    <div className="w-full bg-[#0d1117] rounded-full h-2 mt-1">
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${score}%`, backgroundColor: color }}
      />
    </div>
  )
}

export default function ScoreCardPage({ scorecard, sessionEnded }: ScoreCardPageProps) {
  const dims = [
    { key: 'coordination', label: 'Incident Coordination', weight: '25%', data: scorecard.dimensions.coordination },
    { key: 'resolution', label: 'Incident Resolution', weight: '35%', data: scorecard.dimensions.resolution },
    { key: 'technical_depth', label: 'Technical Depth', weight: '25%', data: scorecard.dimensions.technical_depth },
    { key: 'observability', label: 'Observability Usage', weight: '15%', data: scorecard.dimensions.observability }
  ]

  return (
    <div className="min-h-screen bg-[#0d1117] font-mono">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-2">Simulation Complete</div>
          <h1 className="text-2xl font-bold text-[#e6edf3] mb-1">Session Scorecard</h1>
          {sessionEnded && (
            <div className="text-[#8b949e] text-sm">
              Duration: {sessionEnded.duration_minutes} min ·{' '}
              {sessionEnded.reason === 'resolved' ? '✓ Resolved' :
               sessionEnded.reason === 'time_limit' ? '⏱ Time limit reached' : 'Ended'}
            </div>
          )}
        </div>

        {/* Overall score */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 mb-6 text-center">
          <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-4">Overall Score</div>
          <ScoreCircle score={scorecard.overall_score} />
          <div className="mt-3 text-sm text-[#8b949e]">
            {scorecard.overall_score >= 80 ? '🎉 Excellent performance' :
             scorecard.overall_score >= 65 ? '✓ Pass — on-call ready' :
             scorecard.overall_score >= 50 ? '⚠ Developing — more practice needed' :
             '✗ Needs significant improvement'}
          </div>
        </div>

        {/* Dimension scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {dims.map(dim => (
            <div key={dim.key} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#e6edf3] font-bold text-sm">{dim.label}</span>
                <span className="text-[#484f58] text-xs">{dim.weight}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <ScoreBar score={dim.data.score} />
                <span className="text-[#e6edf3] font-bold w-8 text-right">{dim.data.score}</span>
              </div>
              <p className="text-[#8b949e] text-xs mt-2 leading-relaxed">{dim.data.notes}</p>
            </div>
          ))}
        </div>

        {/* Timeline highlights */}
        {scorecard.timeline_highlights.length > 0 && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-6">
            <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-3">Timeline Highlights</div>
            <div className="space-y-2">
              {scorecard.timeline_highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[#39d353] w-14 flex-shrink-0">{h.ts}</span>
                  <span className="text-[#e6edf3] flex-1">{h.event}</span>
                  <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${QUALITY_STYLES[h.quality] ?? 'bg-[#21262d] text-[#8b949e]'}`}>
                    {h.quality}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Postmortem */}
        {scorecard.postmortem && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-6">
            <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-3">Postmortem</div>
            <p className="text-[#e6edf3] text-sm leading-relaxed whitespace-pre-wrap">{scorecard.postmortem}</p>
          </div>
        )}

        {/* Restart */}
        <div className="text-center">
          <button
            onClick={() => window.location.reload()}
            className="bg-[#238636] hover:bg-[#2ea043] text-white font-bold px-6 py-3 rounded border border-[#2ea043] transition-colors text-sm"
          >
            ▶ Start New Simulation
          </button>
        </div>

        <div className="mt-6 text-center text-[#484f58] text-xs">
          Session ID: {scorecard.session_id}
        </div>
      </div>
    </div>
  )
}
