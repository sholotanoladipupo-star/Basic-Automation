import React, { Component, ErrorInfo } from 'react'
import { PDFViewer } from '@react-pdf/renderer'
import { useCVStore } from '@/store/useCVStore'
import { CVDocument } from '@/pdf/CVDocument'

class PDFErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PDF render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-100 p-8">
          <div className="bg-white rounded-xl border border-red-200 p-6 max-w-md text-center shadow-sm">
            <div className="text-red-500 text-2xl mb-3">⚠</div>
            <h3 className="font-semibold text-gray-800 mb-2">PDF Preview Error</h3>
            <p className="text-sm text-gray-500 mb-4">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function PDFViewerInner() {
  const { cvData, activeTemplate, getActiveColors } = useCVStore()
  const colors = getActiveColors()

  return (
    <PDFViewer
      style={{ width: '100%', height: '100%', border: 'none' }}
      showToolbar={false}
    >
      <CVDocument data={cvData} templateId={activeTemplate} colors={colors} />
    </PDFViewer>
  )
}

export function PDFPreview() {
  return (
    <div className="w-full h-full bg-gray-200">
      <PDFErrorBoundary>
        <PDFViewerInner />
      </PDFErrorBoundary>
    </div>
  )
}
