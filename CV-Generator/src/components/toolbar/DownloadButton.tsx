import React from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { useCVStore } from '@/store/useCVStore'
import { CVDocument } from '@/pdf/CVDocument'

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

export function DownloadButton() {
  const { cvData, activeTemplate, getActiveColors } = useCVStore()
  const colors = getActiveColors()
  const name = `${cvData.personalInfo.firstName || 'CV'}_${cvData.personalInfo.lastName || ''}`
    .replace(/\s+/g, '_')
    .replace(/_+$/, '')

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <PDFDownloadLink
      document={<CVDocument data={cvData} templateId={activeTemplate} colors={colors} />}
      fileName={`${name}.pdf`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#2563eb',
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
        padding: '8px 16px',
        borderRadius: '8px',
        textDecoration: 'none',
        transition: 'background-color 0.2s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      }}
    >
      {(({ loading }: { loading: boolean }) => (
        <>
          <DownloadIcon />
          {loading ? 'Generating...' : 'Download PDF'}
        </>
      )) as unknown as React.ReactNode}
    </PDFDownloadLink>
  )
}
