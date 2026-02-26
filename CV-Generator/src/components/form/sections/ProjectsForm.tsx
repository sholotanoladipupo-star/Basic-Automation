import React, { useState } from 'react'
import { useCVStore } from '@/store/useCVStore'
import { Project } from '@/types/cv.types'

function BulletEditor({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  return (
    <div className="space-y-2">
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="text-gray-400 mt-2 text-sm">•</span>
          <textarea
            value={b}
            onChange={(e) => {
              const next = [...bullets]; next[i] = e.target.value; onChange(next)
            }}
            rows={2}
            placeholder="Describe a highlight or achievement..."
            className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <button
            onClick={() => onChange(bullets.filter((_, idx) => idx !== i).length ? bullets.filter((_, idx) => idx !== i) : [''])}
            className="mt-1.5 text-red-400 hover:text-red-600 text-lg"
          >
            ×
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...bullets, ''])} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
        + Add bullet
      </button>
    </div>
  )
}

function TechStackEditor({ stack, onChange }: { stack: string[]; onChange: (s: string[]) => void }) {
  const [val, setVal] = useState('')
  const add = () => {
    if (!val.trim()) return
    onChange([...stack, val.trim()])
    setVal('')
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
        {stack.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded border border-indigo-200">
            {t}
            <button onClick={() => onChange(stack.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-indigo-700 font-bold">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Add technology..."
          className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button onClick={add} className="bg-indigo-500 text-white text-sm px-3 py-1.5 rounded hover:bg-indigo-600">Add</button>
      </div>
    </div>
  )
}

function ProjectCard({ proj }: { proj: Project }) {
  const { updateProject, removeProject } = useCVStore()
  const [expanded, setExpanded] = useState(true)

  const field = (label: string, key: string, placeholder = '') => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={(proj as unknown as Record<string, unknown>)[key] as string ?? ''}
        onChange={(e) => updateProject(proj.id, key, e.target.value)}
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
        <p className="text-sm font-medium text-gray-800">{proj.name || 'New Project'}</p>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); removeProject(proj.id) }} className="text-red-400 hover:text-red-600 text-sm px-2">Remove</button>
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field('Project Name', 'name', 'My Awesome Project')}
            {field('Your Role', 'role', 'Lead Developer')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('URL / GitHub', 'url', 'github.com/user/project')}
            {field('Date Range', 'dateRange', '2023 – Present')}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Tech Stack</label>
            <TechStackEditor
              stack={proj.techStack}
              onChange={(s) => updateProject(proj.id, 'techStack', s)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Highlights</label>
            <BulletEditor
              bullets={proj.bullets}
              onChange={(b) => updateProject(proj.id, 'bullets', b)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function ProjectsForm() {
  const { cvData, addProject } = useCVStore()

  return (
    <div className="space-y-3">
      {cvData.projects.map((proj) => (
        <ProjectCard key={proj.id} proj={proj} />
      ))}
      <button
        onClick={addProject}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + Add Project
      </button>
    </div>
  )
}
