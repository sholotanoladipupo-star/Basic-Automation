import React, { useState } from 'react'
import { useCVStore } from '@/store/useCVStore'
import { Certification } from '@/types/cv.types'

function CertCard({ cert }: { cert: Certification }) {
  const { updateCertification, removeCertification } = useCVStore()
  const [expanded, setExpanded] = useState(true)

  const field = (label: string, key: string, placeholder = '') => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={(cert as unknown as Record<string, unknown>)[key] as string ?? ''}
        onChange={(e) => updateCertification(cert.id, key, e.target.value)}
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
        <div>
          <p className="text-sm font-medium text-gray-800">{cert.name || 'New Certification'}</p>
          {cert.issuer && <p className="text-xs text-gray-500">{cert.issuer}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); removeCertification(cert.id) }} className="text-red-400 hover:text-red-600 text-sm px-2">Remove</button>
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="p-4 space-y-3">
          {field('Certification Name', 'name', 'AWS Solutions Architect')}
          {field('Issuing Organization', 'issuer', 'Amazon Web Services')}
          <div className="grid grid-cols-2 gap-3">
            {field('Issue Date', 'date', '2024-01')}
            {field('Expiry Date', 'expiryDate', '2027-01')}
          </div>
          {field('Credential ID', 'credentialId', 'AWS-SAP-123456')}
          {field('Certificate URL', 'url', 'https://...')}
        </div>
      )}
    </div>
  )
}

export function CertificationsForm() {
  const { cvData, addCertification } = useCVStore()

  return (
    <div className="space-y-3">
      {cvData.certifications.map((cert) => (
        <CertCard key={cert.id} cert={cert} />
      ))}
      <button
        onClick={addCertification}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + Add Certification
      </button>
    </div>
  )
}
