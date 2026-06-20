import React from 'react'
import { PDFPreview } from '@/components/preview/PDFPreview'

export function RightPanel() {
  return (
    <div className="h-full flex flex-col bg-gray-200">
      <div className="flex-1 overflow-hidden">
        <PDFPreview />
      </div>
    </div>
  )
}
