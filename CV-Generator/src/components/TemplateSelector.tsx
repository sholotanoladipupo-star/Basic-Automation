import React from 'react';
import { Template } from '../types';
import { Palette } from 'lucide-react';

interface TemplateSelectorProps {
  selectedTemplate: Template;
  onSelectTemplate: (template: Template) => void;
}

const templates: { value: Template; label: string; description: string }[] = [
  { value: 'modern', label: 'Modern', description: 'Clean and contemporary design' },
  { value: 'professional', label: 'Professional', description: 'Classic corporate style' },
  { value: 'creative', label: 'Creative', description: 'Bold and colorful layout' },
  { value: 'minimal', label: 'Minimal', description: 'Simple and elegant' },
];

export default function TemplateSelector({
  selectedTemplate,
  onSelectTemplate,
}: TemplateSelectorProps) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-6">
        <Palette className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Choose Your Template</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {templates.map(template => (
          <button
            key={template.value}
            onClick={() => onSelectTemplate(template.value)}
            className={`p-4 rounded-lg border-2 transition ${
              selectedTemplate === template.value
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <h3 className="font-bold text-gray-900">{template.label}</h3>
            <p className="text-sm text-gray-600">{template.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
