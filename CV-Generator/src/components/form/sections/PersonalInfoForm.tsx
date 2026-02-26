import React, { useRef } from 'react'
import { useCVStore } from '@/store/useCVStore'

export function PersonalInfoForm() {
  const { cvData, updatePersonalInfo } = useCVStore()
  const { personalInfo } = cvData
  const fileRef = useRef<HTMLInputElement>(null)

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={(personalInfo as unknown as Record<string, string>)[key] ?? ''}
        onChange={(e) => updatePersonalInfo(key, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  )

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      updatePersonalInfo('photo', ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {field('First Name', 'firstName', 'text', 'Alex')}
        {field('Last Name', 'lastName', 'text', 'Johnson')}
      </div>
      {field('Job Title', 'title', 'text', 'Senior Software Engineer')}
      {field('Email', 'email', 'email', 'alex@example.com')}
      <div className="grid grid-cols-2 gap-3">
        {field('Phone', 'phone', 'tel', '+1 (555) 000-0000')}
        {field('Location', 'location', 'text', 'San Francisco, CA')}
      </div>
      {field('LinkedIn', 'linkedin', 'text', 'linkedin.com/in/username')}
      {field('GitHub', 'github', 'text', 'github.com/username')}
      {field('Website', 'website', 'text', 'yoursite.com')}

      {/* Photo upload */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Profile Photo</label>
        <div className="flex items-center gap-3">
          {personalInfo.photo ? (
            <img src={personalInfo.photo} alt="Profile" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">
              No photo
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md transition-colors"
            >
              Upload photo
            </button>
            {personalInfo.photo && (
              <button
                onClick={() => updatePersonalInfo('photo', '')}
                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-md transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
      </div>
    </div>
  )
}
