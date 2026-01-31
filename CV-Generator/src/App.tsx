import React, { useState } from 'react';
import { FileText, Download, Sparkles } from 'lucide-react';
import CVForm from './components/CVForm';
import CVPreview from './components/CVPreview';
import TemplateSelector from './components/TemplateSelector';
import { CVData, Template } from './types';

export default function App() {
  const [cvData, setCvData] = useState<CVData>({
    personalInfo: {
      fullName: '',
      email: '',
      phone: '',
      location: '',
      summary: '',
    },
    experience: [],
    education: [],
    skills: [],
  });

  const [selectedTemplate, setSelectedTemplate] = useState<Template>('modern');
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const handleCVDataChange = (newData: CVData) => {
    setCvData(newData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">CV Generator</h1>
          </div>
          <p className="text-gray-600">Create your professional CV in minutes</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Template Selector */}
        <TemplateSelector
          selectedTemplate={selectedTemplate}
          onSelectTemplate={setSelectedTemplate}
        />

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 justify-center">
          <button
            onClick={() => setActiveTab('form')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'form'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Fill Information
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'preview'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Preview & Download
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {activeTab === 'form' ? (
            <CVForm cvData={cvData} onCvDataChange={handleCVDataChange} />
          ) : (
            <div className="lg:col-span-2">
              <CVPreview cvData={cvData} template={selectedTemplate} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
