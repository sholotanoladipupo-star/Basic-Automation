import { useState, useEffect, useRef } from 'react'
import { TerminalLine } from '../types'

interface TerminalProps {
  lines: TerminalLine[]
  onCommand: (cmd: string) => void
  onCancel?: () => void
  busy: boolean
}

const TAB_COMPLETIONS = [
  // kubectl — pods
  'kubectl get pods', 'kubectl get pods -A', 'kubectl get pods -n cache', 'kubectl get pods -n payments',
  'kubectl get pods -n monitoring', 'kubectl get pods -n default', 'kubectl get pods -n kube-system',
  'kubectl describe pod ', 'kubectl logs ', 'kubectl logs -f ', 'kubectl logs --previous ',
  'kubectl exec -it ', 'kubectl delete pod ',
  // kubectl — workloads
  'kubectl get deployments', 'kubectl get deployments -A',
  'kubectl describe deployment ', 'kubectl rollout restart deployment/',
  'kubectl rollout status deployment/', 'kubectl scale deployment/ --replicas=',
  'kubectl get replicasets', 'kubectl get daemonsets',
  // kubectl — cluster
  'kubectl get nodes', 'kubectl get services', 'kubectl get services -A',
  'kubectl get events --sort-by=.metadata.creationTimestamp',
  'kubectl get configmap', 'kubectl get secret', 'kubectl top pods', 'kubectl top nodes',
  'kubectl get namespaces', 'kubectl get ingress', 'kubectl get hpa',
  // gcloud
  'gcloud sql instances list', 'gcloud sql instances describe ',
  'gcloud compute instances list', 'gcloud logging read ',
  'gcloud pubsub topics list', 'gcloud pubsub subscriptions list',
  'gcloud container clusters list', 'gcloud redis instances list',
  // DB / cache
  'psql -U postgres', 'psql -h localhost -U postgres ',
  'redis-cli ping', 'redis-cli info', 'redis-cli info memory',
  'redis-cli info replication', 'redis-cli info keyspace',
  'redis-cli monitor', 'redis-cli dbsize', 'redis-cli keys "*"',
  // network
  'curl -s http://localhost:8080/health', 'curl -s http://localhost:8080/metrics',
  'netstat -tlnp', 'ss -tlnp', 'ping ', 'nslookup ', 'dig ',
  // system
  'ps aux | grep ', 'df -h', 'free -m', 'top', 'uptime',
  'tail -f /var/log/', 'journalctl -u ', 'systemctl status ',
  // misc
  'grep -r ', 'cat /etc/hosts', 'env | grep ', 'which ',
]

const PALETTE_GROUPS = [
  { label: 'Pods & Workloads', cmds: ['kubectl get pods -A', 'kubectl get pods -n cache', 'kubectl get pods -n payments', 'kubectl describe pod ', 'kubectl logs ', 'kubectl logs --previous ', 'kubectl get deployments -A', 'kubectl rollout restart deployment/', 'kubectl rollout status deployment/', 'kubectl scale deployment/ --replicas=', 'kubectl get events --sort-by=.metadata.creationTimestamp', 'kubectl top pods'] },
  { label: 'Cluster', cmds: ['kubectl get nodes', 'kubectl get services -A', 'kubectl get configmap', 'kubectl get hpa', 'kubectl get namespaces', 'kubectl top nodes'] },
  { label: 'GCloud', cmds: ['gcloud sql instances list', 'gcloud redis instances list', 'gcloud container clusters list', 'gcloud compute instances list', 'gcloud logging read '] },
  { label: 'Database', cmds: ['psql -U postgres', 'redis-cli ping', 'redis-cli info memory', 'redis-cli info replication', 'redis-cli dbsize', 'redis-cli monitor'] },
  { label: 'Network', cmds: ['curl -s http://localhost:8080/health', 'netstat -tlnp', 'ss -tlnp', 'nslookup ', 'dig '] },
  { label: 'System', cmds: ['df -h', 'free -m', 'top', 'ps aux | grep ', 'journalctl -u ', 'systemctl status '] },
]

const PINNED_COMMANDS = [
  { label: 'pods', cmd: 'kubectl get pods -A' },
  { label: 'events', cmd: 'kubectl get events --sort-by=.metadata.creationTimestamp' },
  { label: 'top pods', cmd: 'kubectl top pods -A' },
  { label: 'describe', cmd: 'kubectl describe pod ' },
  { label: 'logs', cmd: 'kubectl logs ' },
  { label: 'db health', cmd: 'gcloud sql instances list' },
  { label: 'redis info', cmd: 'redis-cli info memory' },
]

export default function Terminal({ lines, onCommand, onCancel, busy }: TerminalProps) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [tabSuggestions, setTabSuggestions] = useState<string[]>([])
  const [clearedAt, setClearedAt] = useState(0)
  const [showPalette, setShowPalette] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [showPinned, setShowPinned] = useState(true)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const paletteInputRef = useRef<HTMLInputElement>(null)
  const tabIdxRef = useRef(-1)
  const lastTabInputRef = useRef('')

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  // Focus input when not busy
  useEffect(() => {
    if (!busy && inputRef.current) inputRef.current.focus()
  }, [busy])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cmd = input.trim()
    if (!cmd || busy) return

    // Handle `clear` locally
    if (cmd === 'clear') {
      setClearedAt(lines.length)
      setInput('')
      setHistory(h => [cmd, ...h.slice(0, 49)])
      setHistoryIndex(-1)
      return
    }

    setHistory(h => [cmd, ...h.slice(0, 49)])
    setHistoryIndex(-1)
    setInput('')
    onCommand(cmd)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Ctrl+C cancels a running command
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault()
      if (busy && onCancel) { onCancel() } else { setInput('') }
      setTabSuggestions([])
      return
    }

    // Ctrl+L clears the terminal
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setClearedAt(lines.length)
      setTabSuggestions([])
      return
    }

    // Ctrl+K toggles command palette
    if (e.key === 'k' && e.ctrlKey) {
      e.preventDefault()
      setShowPalette(p => !p)
      setPaletteQuery('')
      setTabSuggestions([])
      return
    }

    // Escape closes palette / clears tab suggestions
    if (e.key === 'Escape') {
      setShowPalette(false)
      setTabSuggestions([])
    }

    // Tab completion
    if (e.key === 'Tab') {
      e.preventDefault()
      const cur = input
      // If input changed since last Tab press, rebuild matches
      if (cur !== lastTabInputRef.current || tabIdxRef.current === -1) {
        const matches = cur.trim() === ''
          ? TAB_COMPLETIONS.slice(0, 8)
          : TAB_COMPLETIONS.filter(c => c.toLowerCase().startsWith(cur.toLowerCase()))
        lastTabInputRef.current = cur
        tabIdxRef.current = -1
        setTabSuggestions(matches)
        if (matches.length === 1) {
          setInput(matches[0])
          setTabSuggestions([])
          tabIdxRef.current = -1
        } else if (matches.length > 1) {
          tabIdxRef.current = 0
          setInput(matches[0])
        }
      } else {
        // Cycle through existing matches
        const matches = tabSuggestions
        if (matches.length === 0) return
        tabIdxRef.current = (tabIdxRef.current + 1) % matches.length
        setInput(matches[tabIdxRef.current])
      }
      return
    }

    // Any other key clears tab suggestions
    if (e.key !== 'Shift') setTabSuggestions([])

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

  // Also handle Ctrl+C on the busy indicator div
  function handleBusyKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault()
      onCancel?.()
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
          <div key={line.id} className="relative group text-[#e6edf3] whitespace-pre-wrap break-words">
            {line.content}
            <button
              onClick={() => navigator.clipboard.writeText(line.content)}
              className="absolute right-0 top-0 hidden group-hover:flex items-center px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[9px] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
              title="Copy"
            >⎘</button>
          </div>
        )
      case 'error':
        return (
          <div key={line.id} className="relative group text-[#f85149] whitespace-pre-wrap break-words">
            {line.content}
            <button
              onClick={() => navigator.clipboard.writeText(line.content)}
              className="absolute right-0 top-0 hidden group-hover:flex items-center px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[9px] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
              title="Copy"
            >⎘</button>
          </div>
        )
      case 'system':
        return (
          <div key={line.id} className={`font-mono ${line.content === '' ? 'h-2' : line.content === '^C' ? 'text-[#f85149]' : 'text-[#39d353] italic'}`}>
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
    <div className="flex flex-col h-full bg-[#0d1117] font-mono text-sm relative">
      {/* Ctrl+K Command palette modal */}
      {showPalette && (
        <div className="absolute inset-0 z-50 bg-black/70 flex items-start justify-center pt-8" onClick={() => setShowPalette(false)}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#30363d]">
              <span className="text-[#484f58] text-sm">⌘</span>
              <input
                ref={paletteInputRef}
                type="text"
                value={paletteQuery}
                onChange={e => setPaletteQuery(e.target.value)}
                placeholder="Search commands…"
                className="flex-1 bg-transparent text-[#e6edf3] text-sm focus:outline-none font-mono"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Escape') setShowPalette(false)
                }}
              />
              <span className="text-[#484f58] text-[10px]">Esc to close</span>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {(() => {
                const q = paletteQuery.toLowerCase()
                const groups = paletteQuery.trim()
                  ? [{ label: 'Results', cmds: TAB_COMPLETIONS.filter(c => c.toLowerCase().includes(q)) }]
                  : PALETTE_GROUPS
                return groups.map(g => g.cmds.length === 0 ? null : (
                  <div key={g.label}>
                    <div className="px-4 py-1 text-[9px] text-[#484f58] uppercase tracking-widest">{g.label}</div>
                    {g.cmds.map(cmd => (
                      <button key={cmd}
                        onMouseDown={e => { e.preventDefault(); setInput(cmd); setShowPalette(false); setTimeout(() => inputRef.current?.focus(), 0) }}
                        className="w-full text-left px-4 py-2 text-[11px] font-mono text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3] transition-colors"
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-[#30363d] flex-shrink-0">
        <span className="w-3 h-3 rounded-full bg-[#f85149]" />
        <span className="w-3 h-3 rounded-full bg-[#d29922]" />
        <span className="w-3 h-3 rounded-full bg-[#3fb950]" />
        <span className="ml-2 text-xs text-[#8b949e] flex-1">engineer@sre-sim:~$</span>
        {busy && (
          <span className="text-[10px] text-[#484f58]">Ctrl+C to cancel</span>
        )}
        {!busy && (
          <button onClick={() => { setShowPalette(true); setPaletteQuery('') }} className="text-[#484f58] text-[10px] hover:text-[#8b949e] transition-colors ml-auto">
            Ctrl+K
          </button>
        )}
      </div>

      {/* Pinned quick-commands bar */}
      {showPinned && !busy && (
        <div className="flex-shrink-0 bg-[#0d1117] border-b border-[#21262d] px-2 py-1 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[#484f58] text-[9px] flex-shrink-0">Quick:</span>
          {PINNED_COMMANDS.map(p => (
            <button
              key={p.cmd}
              onMouseDown={e => { e.preventDefault(); setInput(p.cmd); inputRef.current?.focus() }}
              className="flex-shrink-0 px-2 py-0.5 rounded border border-[#21262d] text-[9px] text-[#484f58] hover:border-[#30363d] hover:text-[#8b949e] transition-colors font-mono"
            >
              {p.label}
            </button>
          ))}
          <span className="ml-auto flex-shrink-0 text-[#484f58] text-[9px]">Ctrl+K for all</span>
        </div>
      )}

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 space-y-0.5 leading-5"
        onClick={() => busy ? null : inputRef.current?.focus()}
      >
        {lines.slice(clearedAt).map(line => renderLine(line))}
      </div>

      {/* Tab suggestions */}
      {tabSuggestions.length > 1 && (
        <div className="flex-shrink-0 bg-[#161b22] border-t border-[#30363d] px-3 py-1.5 flex flex-wrap gap-1.5">
          {tabSuggestions.slice(0, 12).map((s, i) => (
            <button
              key={s}
              onMouseDown={e => { e.preventDefault(); setInput(s); setTabSuggestions([]); inputRef.current?.focus() }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${i === tabIdxRef.current ? 'border-[#3fb950] text-[#3fb950] bg-[#3fb950]/10' : 'border-[#30363d] text-[#8b949e] hover:border-[#484f58]'}`}
            >{s}</button>
          ))}
          {tabSuggestions.length > 12 && <span className="text-[#484f58] text-[10px] self-center">+{tabSuggestions.length - 12} more</span>}
        </div>
      )}

      {/* Input area */}
      <div
        className="flex-shrink-0 border-t border-[#30363d] px-3 py-2"
        tabIndex={busy ? 0 : -1}
        onKeyDown={busy ? handleBusyKeyDown : undefined}
      >
        {busy ? (
          <div className="text-[#484f58] italic flex items-center gap-2 select-none">
            <span className="blink">◉</span>
            <span>Processing…</span>
            <span className="ml-auto text-[#484f58] text-[10px] cursor-pointer hover:text-[#f85149] transition-colors" onClick={() => onCancel?.()}>
              [Ctrl+C] cancel
            </span>
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
