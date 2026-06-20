import React from 'react'
import { useCVStore } from '@/store/useCVStore'
import { templateList } from '@/constants/templateConfig'
import { TemplateId } from '@/types/cv.types'
import { cn } from '@/utils/cn'

export function TemplateSwitcher() {
  const { activeTemplate, setActiveTemplate } = useCVStore()

  return (
    <div className="flex items-center gap-1">
      {templateList.map((tpl) => (
        <button
          key={tpl.id}
          onClick={() => setActiveTemplate(tpl.id as TemplateId)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            activeTemplate === tpl.id
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          )}
        >
          {tpl.name}
        </button>
      ))}
    </div>
  )
}
