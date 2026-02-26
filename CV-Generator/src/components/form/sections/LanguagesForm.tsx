import React from 'react'
import { useCVStore } from '@/store/useCVStore'
import { Language } from '@/types/cv.types'

const proficiencyLevels = ['Native', 'Fluent', 'Professional', 'Conversational', 'Elementary']

function LanguageCard({ lang }: { lang: Language }) {
  const { updateLanguage, removeLanguage } = useCVStore()

  return (
    <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3">
      <input
        type="text"
        value={lang.language}
        onChange={(e) => updateLanguage(lang.id, 'language', e.target.value)}
        placeholder="Language"
        className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <select
        value={lang.proficiency}
        onChange={(e) => updateLanguage(lang.id, 'proficiency', e.target.value)}
        className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      >
        {proficiencyLevels.map((level) => (
          <option key={level} value={level}>{level}</option>
        ))}
      </select>
      <button
        onClick={() => removeLanguage(lang.id)}
        className="text-red-400 hover:text-red-600 text-sm px-1"
      >
        Remove
      </button>
    </div>
  )
}

export function LanguagesForm() {
  const { cvData, addLanguage } = useCVStore()

  return (
    <div className="space-y-3">
      {cvData.languages.map((lang) => (
        <LanguageCard key={lang.id} lang={lang} />
      ))}
      <button
        onClick={addLanguage}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + Add Language
      </button>
    </div>
  )
}
