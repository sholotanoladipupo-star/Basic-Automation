import React, { useState } from 'react'
import { PersonalInfoForm } from '@/components/form/sections/PersonalInfoForm'
import { SummaryForm } from '@/components/form/sections/SummaryForm'
import { ExperienceForm } from '@/components/form/sections/ExperienceForm'
import { EducationForm } from '@/components/form/sections/EducationForm'
import { SkillsForm } from '@/components/form/sections/SkillsForm'
import { ProjectsForm } from '@/components/form/sections/ProjectsForm'
import { CertificationsForm } from '@/components/form/sections/CertificationsForm'
import { LanguagesForm } from '@/components/form/sections/LanguagesForm'
import { cn } from '@/utils/cn'

interface Section {
  id: string
  label: string
  icon: string
  component: React.ComponentType
}

const sections: Section[] = [
  { id: 'personal', label: 'Personal Info', icon: '👤', component: PersonalInfoForm },
  { id: 'summary', label: 'Summary', icon: '📝', component: SummaryForm },
  { id: 'experience', label: 'Experience', icon: '💼', component: ExperienceForm },
  { id: 'education', label: 'Education', icon: '🎓', component: EducationForm },
  { id: 'skills', label: 'Skills', icon: '⚡', component: SkillsForm },
  { id: 'projects', label: 'Projects', icon: '🚀', component: ProjectsForm },
  { id: 'certifications', label: 'Certifications', icon: '🏆', component: CertificationsForm },
  { id: 'languages', label: 'Languages', icon: '🌐', component: LanguagesForm },
]

function AccordionSection({ section, defaultOpen = false }: { section: Section; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const Comp = section.component

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
          open ? 'bg-blue-50 border-b border-blue-100' : 'hover:bg-gray-50'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{section.icon}</span>
          <span className={cn('text-sm font-semibold', open ? 'text-blue-700' : 'text-gray-700')}>
            {section.label}
          </span>
        </div>
        <svg
          className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-4">
          <Comp />
        </div>
      )}
    </div>
  )
}

export function LeftPanel() {
  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CV Sections</h2>
          <span className="text-xs text-gray-400">Edit fields below</span>
        </div>
        {sections.map((section, i) => (
          <AccordionSection key={section.id} section={section} defaultOpen={i === 0} />
        ))}
        <div className="h-4" />
      </div>
    </div>
  )
}
