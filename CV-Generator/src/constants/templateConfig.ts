import { TemplateConfig, TemplateId, TemplateColors } from '@/types/cv.types'

export const templateConfigs: Record<TemplateId, TemplateConfig> = {
  modern: {
    id: 'modern',
    name: 'Modern',
    description: '35% sidebar + 65% main, dark sidebar',
    colors: {
      primary: '#1e3a5f',
      secondary: '#2d5a8e',
      text: '#1f2937',
      textLight: '#6b7280',
      background: '#ffffff',
      sidebarBg: '#1e3a5f',
      sidebarText: '#ffffff',
      border: '#e5e7eb',
      accent: '#3b82f6',
    },
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Single column, centered header, dividers',
    colors: {
      primary: '#1a1a2e',
      secondary: '#16213e',
      text: '#1f2937',
      textLight: '#6b7280',
      background: '#ffffff',
      sidebarBg: '#f8f9fa',
      sidebarText: '#1a1a2e',
      border: '#1a1a2e',
      accent: '#c9a84c',
    },
  },
  creative: {
    id: 'creative',
    name: 'Creative',
    description: 'Full-width bold header, Montserrat font',
    colors: {
      primary: '#e91e63',
      secondary: '#c2185b',
      text: '#212121',
      textLight: '#757575',
      background: '#ffffff',
      sidebarBg: '#e91e63',
      sidebarText: '#ffffff',
      border: '#f8bbd0',
      accent: '#ff6090',
    },
  },
  executive: {
    id: 'executive',
    name: 'Executive',
    description: 'Dark header + cream body, gold accents',
    colors: {
      primary: '#1c1c1c',
      secondary: '#2d2d2d',
      text: '#2c2c2c',
      textLight: '#666666',
      background: '#faf8f3',
      sidebarBg: '#1c1c1c',
      sidebarText: '#f5f0e8',
      border: '#d4c5a0',
      accent: '#c9a84c',
    },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Max whitespace, no borders, spacing hierarchy',
    colors: {
      primary: '#111827',
      secondary: '#374151',
      text: '#111827',
      textLight: '#9ca3af',
      background: '#ffffff',
      sidebarBg: '#ffffff',
      sidebarText: '#111827',
      border: '#f3f4f6',
      accent: '#111827',
    },
  },
  tech: {
    id: 'tech',
    name: 'Tech',
    description: 'Monospace accents, code-like skill tags',
    colors: {
      primary: '#0f172a',
      secondary: '#1e293b',
      text: '#0f172a',
      textLight: '#64748b',
      background: '#ffffff',
      sidebarBg: '#0f172a',
      sidebarText: '#e2e8f0',
      border: '#e2e8f0',
      accent: '#06b6d4',
    },
  },
}

export const templateList = Object.values(templateConfigs)

export const getTemplateColors = (id: TemplateId): TemplateColors =>
  templateConfigs[id].colors
