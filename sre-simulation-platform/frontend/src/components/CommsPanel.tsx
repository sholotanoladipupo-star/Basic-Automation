import { useState, useEffect, useRef } from 'react'
import { SlackMessage } from '../types'

interface CommsPanelProps {
  messages: SlackMessage[]
  onSendMessage: (channel: string, message: string) => void
}

const CHANNELS = ['incidents', 'sre-team', 'oncall']

export default function CommsPanel({ messages, onSendMessage }: CommsPanelProps) {
  const [activeChannel, setActiveChannel] = useState('incidents')
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const channelMessages = messages.filter(m =>
    m.channel === activeChannel || m.channel === `#${activeChannel}`
  )

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [channelMessages.length])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const msg = input.trim()
    if (!msg) return
    onSendMessage(activeChannel, msg)
    setInput('')
  }

  function formatTime(ts: string): string {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  return (
    <div className="flex flex-col bg-[#161b22] border-l border-t border-[#30363d] text-xs font-mono h-64">
      {/* Channel tabs */}
      <div className="flex border-b border-[#30363d] flex-shrink-0">
        {CHANNELS.map(ch => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            className={`px-3 py-1.5 text-xs transition-colors ${
              activeChannel === ch
                ? 'text-[#e6edf3] border-b-2 border-[#3fb950]'
                : 'text-[#8b949e] hover:text-[#e6edf3]'
            }`}
          >
            #{ch}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {channelMessages.length === 0 ? (
          <div className="text-[#484f58] italic text-center mt-2">No messages in #{activeChannel}</div>
        ) : (
          channelMessages.map(msg => (
            <div key={msg.id} className={`${msg.isSystem ? 'text-[#484f58] italic' : ''}`}>
              <span className="text-[#484f58] mr-1">{formatTime(msg.ts)}</span>
              <span className="text-[#58a6ff] mr-1">{msg.sender}:</span>
              <span className={msg.isSystem ? '' : 'text-[#e6edf3]'}>{msg.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex-shrink-0 border-t border-[#30363d] flex gap-1 p-1.5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Message #${activeChannel}`}
          className="flex-1 bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs px-2 py-1 rounded focus:outline-none focus:border-[#3fb950] font-mono"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 text-white text-xs px-2 py-1 rounded transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
