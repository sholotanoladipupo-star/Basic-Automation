export interface PersonalInfo {
  firstName: string
  lastName: string
  title: string
  email: string
  phone: string
  location: string
  linkedin: string
  github: string
  website: string
  photo: string // base64 data URL
}

export interface WorkExperience {
  id: string
  company: string
  role: string
  location: string
  dateRange: string
  bullets: string[]
}

export interface Education {
  id: string
  institution: string
  degree: string
  field: string
  dateRange: string
  gpa: string
}

export interface SkillCategory {
  id: string
  category: string
  skills: string[]
}

export interface Project {
  id: string
  name: string
  role: string
  url: string
  dateRange: string
  techStack: string[]
  bullets: string[]
}

export interface Certification {
  id: string
  name: string
  issuer: string
  date: string
  expiryDate: string
  credentialId: string
  url: string
}

export interface Language {
  id: string
  language: string
  proficiency: string
}

export interface CVData {
  personalInfo: PersonalInfo
  summary: string
  experience: WorkExperience[]
  education: Education[]
  skills: SkillCategory[]
  projects: Project[]
  certifications: Certification[]
  languages: Language[]
}

export type TemplateId = 'modern' | 'classic' | 'creative' | 'executive' | 'minimal' | 'tech'

export interface TemplateColors {
  primary: string
  secondary: string
  text: string
  textLight: string
  background: string
  sidebarBg: string
  sidebarText: string
  border: string
  accent: string
}

export interface TemplateConfig {
  id: TemplateId
  name: string
  description: string
  colors: TemplateColors
}
