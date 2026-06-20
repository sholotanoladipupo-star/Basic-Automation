import React from 'react'
import { Document } from '@react-pdf/renderer'
import { CVData, TemplateId, TemplateColors } from '@/types/cv.types'
import { ModernTemplate } from './templates/ModernTemplate'
import { ClassicTemplate } from './templates/ClassicTemplate'
import { CreativeTemplate } from './templates/CreativeTemplate'
import { ExecutiveTemplate } from './templates/ExecutiveTemplate'
import { MinimalTemplate } from './templates/MinimalTemplate'
import { TechTemplate } from './templates/TechTemplate'

interface Props {
  data: CVData
  templateId: TemplateId
  colors: TemplateColors
}

const templateMap: Record<TemplateId, React.ComponentType<{ data: CVData; colors: TemplateColors }>> = {
  modern: ModernTemplate,
  classic: ClassicTemplate,
  creative: CreativeTemplate,
  executive: ExecutiveTemplate,
  minimal: MinimalTemplate,
  tech: TechTemplate,
}

export function CVDocument({ data, templateId, colors }: Props) {
  const TemplateComponent = templateMap[templateId] ?? ModernTemplate

  return (
    <Document
      title={`${data.personalInfo.firstName} ${data.personalInfo.lastName} — CV`}
      author={`${data.personalInfo.firstName} ${data.personalInfo.lastName}`}
    >
      <TemplateComponent data={data} colors={colors} />
    </Document>
  )
}
