import { useState, useEffect, useRef } from 'react'
import { TerminalLine } from '../types'

interface TerminalProps {
  lines: TerminalLine[]
  onCommand: (cmd: string) => void
  busy: boolean
}

export default function Terminal({ lines, onCommand, busy }: TerminalProps) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  // Focus input when not busy
  useEffect(() => {
    if (!busy && inputRef.current) {
      inputRef.current.focus()
    }
  }, [busy])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cmd = input.trim()
    if (!cmd || busy) return
    setHistory(h => [cmd, ...h.slice(0, 49)])
    setHistoryIndex(-1)
    setInput('')
    onCommand(cmd)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIndex = Math.min(historyIndex + 1, history.length - 1)
      setHistoryIndex(newIndex)
      if (history[newIndex]) setInput(history[newIndex])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIndex = Math.max(historyIndex - 1, -1)
      setHistoryIndex(newIndex)
      setInput(newIndex === -1 ? '' : (history[newIndex] ?? ''))
    }
  }

  function renderLine(line: TerminalLine) {
    switch (line.type) {
      case 'input':
        return (
          <div key={line.id} className="text-[#3fb950]">
            <span className="text-[#58a6ff]">engineer@prod</span>
            <span className="text-[#e6edf3]">:</span>
            <span className="text-[#58a6ff]">~</span>
            <span className="text-[#e6edf3]">$ </span>
            <span>{line.content}</span>
          </div>
        )
      case 'output':
        return (
          <div key={line.id} className="text-[#e6edf3] whitespace-pre-wrap break-words">
            {line.content}
          </div>
        )
      case 'error':
        return (
          <div key={line.id} className="text-[#f85149] whitespace-pre-wrap break-words">
            {line.content}
          </div>
        )
      case 'system':
        return (
          <div key={line.id} className={`font-mono ${line.content === '' ? 'h-2' : 'text-[#39d353] italic'}`}>
            {line.content}
          </div>
        )
      case 'thinking':
        return (
          <div key={line.id} className="text-[#484f58] italic flex items-center gap-2">
            <span className="blink">◉</span>
            <span>{line.content}</span>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] font-mono text-sm">
      {/* Terminal title bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-[#30363d] flex-shrink-0">
        <span className="w-3 h-3 rounded-full bg-[#f85149]" />
        <span className="w-3 h-3 rounded-full bg-[#d29922]" />
        <span className="w-3 h-3 rounded-full bg-[#3fb950]" />
        <span className="ml-2 text-xs text-[#8b949e]">engineer@sre-sim:~$</span>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 space-y-0.5 leading-5"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map(line => renderLine(line))}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-[#30363d] px-3 py-2">
        {busy ? (
          <div className="text-[#484f58] italic flex items-center gap-2">
            <span className="blink">◉</span>
            <span>Processing...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <span className="text-[#58a6ff] whitespace-nowrap">engineer@prod:~$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-[#e6edf3] focus:outline-none caret-[#3fb950]"
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </form>
        )}
      </div>
    </div>
  )
}
