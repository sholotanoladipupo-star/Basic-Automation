import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import {
  CVData,
  TemplateId,
  TemplateColors,
  WorkExperience,
  Education,
  SkillCategory,
  Project,
  Certification,
  Language,
} from '@/types/cv.types'
import { defaultCVData } from '@/constants/defaultCVData'
import { templateConfigs } from '@/constants/templateConfig'

interface ColorOverrides {
  [templateId: string]: Partial<TemplateColors>
}

interface CVStoreState {
  // Persisted
  cvData: CVData
  colorOverrides: ColorOverrides
  activeTemplate: TemplateId

  // UI state (not persisted)
  activeFormSection: string
}

interface CVStoreActions {
  // Personal Info
  updatePersonalInfo: (field: string, value: string) => void

  // Summary
  updateSummary: (value: string) => void

  // Experience
  addExperience: () => void
  updateExperience: (id: string, field: string, value: string) => void
  updateExperienceBullets: (id: string, bullets: string[]) => void
  removeExperience: (id: string) => void
  reorderExperience: (fromIndex: number, toIndex: number) => void

  // Education
  addEducation: () => void
  updateEducation: (id: string, field: string, value: string) => void
  removeEducation: (id: string) => void

  // Skills
  addSkillCategory: () => void
  updateSkillCategory: (id: string, field: string, value: string | string[]) => void
  removeSkillCategory: (id: string) => void

  // Projects
  addProject: () => void
  updateProject: (id: string, field: string, value: string | string[]) => void
  removeProject: (id: string) => void

  // Certifications
  addCertification: () => void
  updateCertification: (id: string, field: string, value: string) => void
  removeCertification: (id: string) => void

  // Languages
  addLanguage: () => void
  updateLanguage: (id: string, field: string, value: string) => void
  removeLanguage: (id: string) => void

  // Template & Colors
  setActiveTemplate: (id: TemplateId) => void
  updateColor: (key: keyof TemplateColors, value: string) => void
  resetColors: () => void

  // UI
  setActiveFormSection: (section: string) => void

  // Data management
  resetToDefault: () => void
  clearAll: () => void
  getActiveColors: () => TemplateColors
}

type CVStore = CVStoreState & CVStoreActions

export const useCVStore = create<CVStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      cvData: defaultCVData,
      colorOverrides: {},
      activeTemplate: 'modern',
      activeFormSection: 'personal',

      // Personal Info
      updatePersonalInfo: (field, value) =>
        set((state) => {
          ;(state.cvData.personalInfo as Record<string, string>)[field] = value
        }),

      // Summary
      updateSummary: (value) =>
        set((state) => {
          state.cvData.summary = value
        }),

      // Experience
      addExperience: () =>
        set((state) => {
          const newExp: WorkExperience = {
            id: nanoid(),
            company: '',
            role: '',
            location: '',
            dateRange: '',
            bullets: [''],
          }
          state.cvData.experience.push(newExp)
        }),

      updateExperience: (id, field, value) =>
        set((state) => {
          const exp = state.cvData.experience.find((e) => e.id === id)
          if (exp) {
            ;(exp as Record<string, unknown>)[field] = value
          }
        }),

      updateExperienceBullets: (id, bullets) =>
        set((state) => {
          const exp = state.cvData.experience.find((e) => e.id === id)
          if (exp) exp.bullets = bullets
        }),

      removeExperience: (id) =>
        set((state) => {
          state.cvData.experience = state.cvData.experience.filter((e) => e.id !== id)
        }),

      reorderExperience: (fromIndex, toIndex) =>
        set((state) => {
          const [item] = state.cvData.experience.splice(fromIndex, 1)
          state.cvData.experience.splice(toIndex, 0, item)
        }),

      // Education
      addEducation: () =>
        set((state) => {
          const newEdu: Education = {
            id: nanoid(),
            institution: '',
            degree: '',
            field: '',
            dateRange: '',
            gpa: '',
          }
          state.cvData.education.push(newEdu)
        }),

      updateEducation: (id, field, value) =>
        set((state) => {
          const edu = state.cvData.education.find((e) => e.id === id)
          if (edu) {
            ;(edu as Record<string, unknown>)[field] = value
          }
        }),

      removeEducation: (id) =>
        set((state) => {
          state.cvData.education = state.cvData.education.filter((e) => e.id !== id)
        }),

      // Skills
      addSkillCategory: () =>
        set((state) => {
          const newCat: SkillCategory = {
            id: nanoid(),
            category: '',
            skills: [],
          }
          state.cvData.skills.push(newCat)
        }),

      updateSkillCategory: (id, field, value) =>
        set((state) => {
          const cat = state.cvData.skills.find((s) => s.id === id)
          if (cat) {
            ;(cat as Record<string, unknown>)[field] = value
          }
        }),

      removeSkillCategory: (id) =>
        set((state) => {
          state.cvData.skills = state.cvData.skills.filter((s) => s.id !== id)
        }),

      // Projects
      addProject: () =>
        set((state) => {
          const newProj: Project = {
            id: nanoid(),
            name: '',
            role: '',
            url: '',
            dateRange: '',
            techStack: [],
            bullets: [''],
          }
          state.cvData.projects.push(newProj)
        }),

      updateProject: (id, field, value) =>
        set((state) => {
          const proj = state.cvData.projects.find((p) => p.id === id)
          if (proj) {
            ;(proj as Record<string, unknown>)[field] = value
          }
        }),

      removeProject: (id) =>
        set((state) => {
          state.cvData.projects = state.cvData.projects.filter((p) => p.id !== id)
        }),

      // Certifications
      addCertification: () =>
        set((state) => {
          const newCert: Certification = {
            id: nanoid(),
            name: '',
            issuer: '',
            date: '',
            expiryDate: '',
            credentialId: '',
            url: '',
          }
          state.cvData.certifications.push(newCert)
        }),

      updateCertification: (id, field, value) =>
        set((state) => {
          const cert = state.cvData.certifications.find((c) => c.id === id)
          if (cert) {
            ;(cert as Record<string, unknown>)[field] = value
          }
        }),

      removeCertification: (id) =>
        set((state) => {
          state.cvData.certifications = state.cvData.certifications.filter((c) => c.id !== id)
        }),

      // Languages
      addLanguage: () =>
        set((state) => {
          const newLang: Language = {
            id: nanoid(),
            language: '',
            proficiency: 'Professional',
          }
          state.cvData.languages.push(newLang)
        }),

      updateLanguage: (id, field, value) =>
        set((state) => {
          const lang = state.cvData.languages.find((l) => l.id === id)
          if (lang) {
            ;(lang as Record<string, unknown>)[field] = value
          }
        }),

      removeLanguage: (id) =>
        set((state) => {
          state.cvData.languages = state.cvData.languages.filter((l) => l.id !== id)
        }),

      // Template & Colors
      setActiveTemplate: (id) =>
        set((state) => {
          state.activeTemplate = id
        }),

      updateColor: (key, value) =>
        set((state) => {
          const templateId = state.activeTemplate
          if (!state.colorOverrides[templateId]) {
            state.colorOverrides[templateId] = {}
          }
          state.colorOverrides[templateId][key] = value
        }),

      resetColors: () =>
        set((state) => {
          delete state.colorOverrides[state.activeTemplate]
        }),

      // UI
      setActiveFormSection: (section) =>
        set((state) => {
          state.activeFormSection = section
        }),

      // Data management
      resetToDefault: () =>
        set((state) => {
          state.cvData = defaultCVData
        }),

      clearAll: () =>
        set((state) => {
          state.cvData = {
            personalInfo: {
              firstName: '',
              lastName: '',
              title: '',
              email: '',
              phone: '',
              location: '',
              linkedin: '',
              github: '',
              website: '',
              photo: '',
            },
            summary: '',
            experience: [],
            education: [],
            skills: [],
            projects: [],
            certifications: [],
            languages: [],
          }
        }),

      // Computed
      getActiveColors: () => {
        const state = get()
        const base = templateConfigs[state.activeTemplate].colors
        const overrides = state.colorOverrides[state.activeTemplate] || {}
        return { ...base, ...overrides }
      },
    })),
    {
      name: 'cv-generator-v1',
      partialize: (state) => ({
        cvData: state.cvData,
        colorOverrides: state.colorOverrides,
        activeTemplate: state.activeTemplate,
      }),
    }
  )
)
