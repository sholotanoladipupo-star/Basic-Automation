import React, { useState } from 'react'
import { useCVStore } from '@/store/useCVStore'
import { SkillCategory } from '@/types/cv.types'

function SkillCard({ cat }: { cat: SkillCategory }) {
  const { updateSkillCategory, removeSkillCategory } = useCVStore()
  const [newSkill, setNewSkill] = useState('')

  const addSkill = () => {
    const trimmed = newSkill.trim()
    if (!trimmed) return
    updateSkillCategory(cat.id, 'skills', [...cat.skills, trimmed])
    setNewSkill('')
  }

  const removeSkill = (i: number) => {
    updateSkillCategory(cat.id, 'skills', cat.skills.filter((_, idx) => idx !== i))
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={cat.category}
          onChange={(e) => updateSkillCategory(cat.id, 'category', e.target.value)}
          placeholder="Category name (e.g., Languages)"
          className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={() => removeSkillCategory(cat.id)}
          className="text-red-400 hover:text-red-600 text-sm px-2"
        >
          Remove
        </button>
      </div>

      {/* Skill tags */}
      <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
        {cat.skills.map((skill, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-200"
          >
            {skill}
            <button
              onClick={() => removeSkill(i)}
              className="text-blue-400 hover:text-blue-700 font-bold text-sm leading-none ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
        {cat.skills.length === 0 && (
          <span className="text-xs text-gray-400">No skills added yet</span>
        )}
      </div>

      {/* Add skill input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
          placeholder="Add a skill, press Enter"
          className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={addSkill}
          className="bg-blue-500 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-600 transition-colors"
        >
          Add
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1">Press Enter or click Add to insert a skill</p>
    </div>
  )
}

export function SkillsForm() {
  const { cvData, addSkillCategory } = useCVStore()

  return (
    <div className="space-y-3">
      {cvData.skills.map((cat) => (
        <SkillCard key={cat.id} cat={cat} />
      ))}
      <button
        onClick={addSkillCategory}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + Add Skill Category
      </button>
    </div>
  )
}
