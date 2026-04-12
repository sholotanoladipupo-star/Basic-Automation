import { useState } from 'react'

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001')
  .replace('ws://', 'http://')
  .replace('wss://', 'https://')

interface Props {
  sessionId: string
  onDone: () => void
}

export default function FeedbackForm({ sessionId, onDone }: Props) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (rating === 0 || submitting) return
    setSubmitting(true)
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      })
      setDone(true)
      setTimeout(onDone, 1500)
    } catch {
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 w-full max-w-sm shadow-2xl">
        {done ? (
          <div className="text-center py-4">
            <div className="text-[#3fb950] text-3xl mb-2">✓</div>
            <div className="text-[#e6edf3] font-bold">Thanks for your feedback!</div>
          </div>
        ) : (
          <>
            <div className="text-center mb-5">
              <div className="text-[#e6edf3] font-bold text-sm mb-1">How was your experience?</div>
              <div className="text-[#484f58] text-xs">Your feedback helps us improve the platform</div>
            </div>

            {/* Star rating */}
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(n)}
                  className="text-2xl transition-transform hover:scale-125"
                >
                  <span style={{ color: n <= (hovered || rating) ? '#d29922' : '#30363d' }}>★</span>
                </button>
              ))}
            </div>

            {/* Label */}
            <div className="text-center text-xs mb-4" style={{ color: rating ? '#d29922' : '#484f58', minHeight: '1rem' }}>
              {labels[hovered || rating] || ''}
            </div>

            {/* Comment */}
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Anything else? (optional)"
              rows={3}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs font-mono placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] resize-none transition-colors mb-4"
            />

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onDone}
                className="flex-1 py-2 rounded-lg border border-[#30363d] text-[#8b949e] text-xs hover:border-[#484f58] transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="flex-1 py-2 rounded-lg bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#161b22] disabled:text-[#484f58] text-white font-bold text-xs border border-[#2ea043] disabled:border-[#30363d] transition-all"
              >
                {submitting ? 'Sending…' : 'Submit Feedback'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
