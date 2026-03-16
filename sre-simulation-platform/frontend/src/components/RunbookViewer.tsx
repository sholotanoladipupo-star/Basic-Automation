interface RunbookViewerProps {
  runbook: { id: string; title: string; content: string }
  onClose: () => void
}

export default function RunbookViewer({ runbook, onClose }: RunbookViewerProps) {
  // Very basic markdown-like rendering (headers, code blocks, bullets)
  function renderContent(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# ')) {
        return <div key={i} className="text-[#e6edf3] font-bold text-sm mt-3 mb-1">{line.slice(2)}</div>
      }
      if (line.startsWith('## ')) {
        return <div key={i} className="text-[#58a6ff] font-bold mt-3 mb-1">{line.slice(3)}</div>
      }
      if (line.startsWith('### ')) {
        return <div key={i} className="text-[#8b949e] font-bold mt-2 mb-1">{line.slice(4)}</div>
      }
      if (line.startsWith('```')) {
        return null
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <div key={i} className="text-[#e6edf3] pl-2">• {line.slice(2)}</div>
      }
      if (/^\d+\./.test(line)) {
        return <div key={i} className="text-[#e6edf3] pl-2">{line}</div>
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />
      }
      // Code-like lines (indented or backtick)
      if (line.startsWith('  ') || line.includes('kubectl') || line.includes('redis-cli') || line.includes('psql')) {
        return (
          <div key={i} className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 text-[#3fb950] my-0.5 break-all">
            {line.trim()}
          </div>
        )
      }
      return <div key={i} className="text-[#e6edf3]">{line}</div>
    })
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] font-mono text-xs">
      <div className="flex items-center justify-between p-3 bg-[#161b22] border-b border-[#30363d] flex-shrink-0">
        <div>
          <div className="text-[#8b949e] uppercase tracking-widest text-xs mb-0.5">Runbook</div>
          <div className="text-[#e6edf3] font-bold">{runbook.title}</div>
        </div>
        <button
          onClick={onClose}
          className="text-[#8b949e] hover:text-[#e6edf3] text-lg leading-none"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {renderContent(runbook.content)}
      </div>
    </div>
  )
}
