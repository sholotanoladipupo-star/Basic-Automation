import React, { useState, useRef, useCallback } from 'react'
import { LeftPanel } from './LeftPanel'
import { RightPanel } from './RightPanel'

export function SplitPanel() {
  const [leftWidth, setLeftWidth] = useState(45)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100
    setLeftWidth(Math.min(Math.max(newWidth, 25), 65))
  }, [])

  const onMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex flex-1 overflow-hidden"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Left panel */}
      <div style={{ width: `${leftWidth}%`, flexShrink: 0 }} className="h-full overflow-hidden">
        <LeftPanel />
      </div>

      {/* Resizer */}
      <div
        className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors"
        onMouseDown={onMouseDown}
      />

      {/* Right panel */}
      <div className="flex-1 h-full overflow-hidden">
        <RightPanel />
      </div>
    </div>
  )
}
