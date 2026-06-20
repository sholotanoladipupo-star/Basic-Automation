import React, { useState } from 'react'
import { useCVStore } from '@/store/useCVStore'
import { Education } from '@/types/cv.types'

function EducationCard({ edu }: { edu: Education }) {
  const { updateEducation, removeEducation } = useCVStore()
  const [expanded, setExpanded] = useState(true)

  const field = (label: string, key: string, placeholder = '') => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={(edu as unknown as Record<string, unknown>)[key] as string ?? ''}
        onChange={(e) => updateEducation(edu.id, key, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <p className="text-sm font-medium text-gray-800">
            {edu.degree || 'New Degree'}{edu.field ? ` in ${edu.field}` : ''}
          </p>
          {edu.institution && <p className="text-xs text-gray-500">{edu.institution}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); removeEducation(edu.id) }}
            className="text-red-400 hover:text-red-600 text-sm px-2"
          >
            Remove
          </button>
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="p-4 space-y-3">
          {field('Institution', 'institution', 'University of ...')}
          <div className="grid grid-cols-2 gap-3">
            {field('Degree', 'degree', 'Bachelor of Science')}
            {field('Field of Study', 'field', 'Computer Science')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Date Range', 'dateRange', '2018 – 2022')}
            {field('GPA (optional)', 'gpa', '3.8')}
          </div>
        </div>
      )}
    </div>
  )
}

export function EducationForm() {
  const { cvData, addEducation } = useCVStore()

  return (
    <div className="space-y-3">
      {cvData.education.map((edu) => (
        <EducationCard key={edu.id} edu={edu} />
      ))}
      <button
        onClick={addEducation}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + Add Education
      </button>
    </div>
  )
}
