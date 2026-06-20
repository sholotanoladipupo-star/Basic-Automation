import React, { useState } from 'react'
import { useCVStore } from '@/store/useCVStore'
import { TemplateColors } from '@/types/cv.types'

const colorFields: { key: keyof TemplateColors; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'accent', label: 'Accent' },
  { key: 'sidebarBg', label: 'Sidebar BG' },
  { key: 'sidebarText', label: 'Sidebar Text' },
  { key: 'background', label: 'Background' },
  { key: 'text', label: 'Body Text' },
]

export function ColorCustomizer() {
  const { getActiveColors, updateColor, resetColors } = useCVStore()
  const [open, setOpen] = useState(false)
  const colors = getActiveColors()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        Colors
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 min-w-[220px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-700">Customize Colors</span>
            <button
              onClick={() => { resetColors(); setOpen(false) }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Reset
            </button>
          </div>
          <div className="space-y-2">
            {colorFields.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label className="text-xs text-gray-600 w-24">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colors[key]}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="w-8 h-7 rounded cursor-pointer border border-gray-200 p-0.5"
                  />
                  <span className="text-xs text-gray-400 font-mono w-16">{colors[key]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
