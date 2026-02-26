import React from 'react'
import { useCVStore } from '@/store/useCVStore'

export function SummaryForm() {
  const { cvData, updateSummary } = useCVStore()

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-2">
        Professional Summary
      </label>
      <textarea
        value={cvData.summary}
        onChange={(e) => updateSummary(e.target.value)}
        rows={6}
        placeholder="Write a concise, compelling summary of your professional background, key skills, and career goals..."
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />
      <p className="text-xs text-gray-400 mt-1">{cvData.summary.length} characters</p>
    </div>
  )
}
