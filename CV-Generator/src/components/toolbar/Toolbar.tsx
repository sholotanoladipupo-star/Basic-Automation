import React from 'react'
import { TemplateSwitcher } from './TemplateSwitcher'
import { DownloadButton } from './DownloadButton'
import { ColorCustomizer } from './ColorCustomizer'
import { useCVStore } from '@/store/useCVStore'

export function Toolbar() {
  const { resetToDefault, clearAll } = useCVStore()

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 flex-shrink-0 shadow-sm z-10">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a2 2 0 00-2 2v1H5a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2V4a2 2 0 00-2-2H9zM9 4h2v1H9V4zM5 7h10v9H5V7z"/>
          </svg>
        </div>
        <span className="font-semibold text-gray-800 text-sm">CV Generator</span>
      </div>

      {/* Template switcher */}
      <TemplateSwitcher />

      <div className="flex-1" />

      {/* Color customizer */}
      <ColorCustomizer />

      {/* Data management */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { if (confirm('Reset to demo data?')) resetToDefault() }}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white px-2.5 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
        >
          Demo Data
        </button>
        <button
          onClick={() => { if (confirm('Clear all CV data?')) clearAll() }}
          className="text-xs text-gray-500 hover:text-red-600 border border-gray-200 bg-white px-2.5 py-1.5 rounded-md hover:bg-red-50 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Download */}
      <DownloadButton />
    </header>
  )
}
