import React, { useState } from 'react'
import { useCVStore } from '@/store/useCVStore'
import { WorkExperience } from '@/types/cv.types'

function BulletEditor({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  const updateBullet = (i: number, val: string) => {
    const next = [...bullets]
    next[i] = val
    onChange(next)
  }

  const addBullet = () => onChange([...bullets, ''])

  const removeBullet = (i: number) => {
    const next = bullets.filter((_, idx) => idx !== i)
    onChange(next.length ? next : [''])
  }

  return (
    <div className="space-y-2">
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="text-gray-400 mt-2 text-sm">•</span>
          <textarea
            value={b}
            onChange={(e) => updateBullet(i, e.target.value)}
            rows={2}
            placeholder="Describe an achievement or responsibility..."
            className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <button
            onClick={() => removeBullet(i)}
            className="mt-1.5 text-red-400 hover:text-red-600 text-lg leading-none"
            title="Remove bullet"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addBullet}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        + Add bullet
      </button>
    </div>
  )
}

function ExperienceCard({ exp }: { exp: WorkExperience }) {
  const { updateExperience, updateExperienceBullets, removeExperience } = useCVStore()
  const [expanded, setExpanded] = useState(true)

  const field = (label: string, key: string, placeholder = '') => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={(exp as unknown as Record<string, unknown>)[key] as string ?? ''}
        onChange={(e) => updateExperience(exp.id, key, e.target.value)}
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
            {exp.role || 'New Position'}{exp.company ? ` @ ${exp.company}` : ''}
          </p>
          {exp.dateRange && <p className="text-xs text-gray-500">{exp.dateRange}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); removeExperience(exp.id) }}
            className="text-red-400 hover:text-red-600 text-sm px-2"
          >
            Remove
          </button>
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field('Job Title / Role', 'role', 'Senior Engineer')}
            {field('Company', 'company', 'Acme Corp')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Location', 'location', 'New York, NY')}
            {field('Date Range', 'dateRange', 'Jan 2021 – Present')}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Achievements & Responsibilities</label>
            <BulletEditor
              bullets={exp.bullets}
              onChange={(bullets) => updateExperienceBullets(exp.id, bullets)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function ExperienceForm() {
  const { cvData, addExperience } = useCVStore()

  return (
    <div className="space-y-3">
      {cvData.experience.map((exp) => (
        <ExperienceCard key={exp.id} exp={exp} />
      ))}
      <button
        onClick={addExperience}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + Add Work Experience
      </button>
    </div>
  )
}
