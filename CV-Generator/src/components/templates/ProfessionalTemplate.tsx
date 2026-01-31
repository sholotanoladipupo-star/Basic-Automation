import React from 'react';
import { CVData } from '../../types';

interface TemplateProps {
  cvData: CVData;
}

export default function ProfessionalTemplate({ cvData }: TemplateProps) {
  return (
    <div className="font-serif">
      {/* Header */}
      <div className="border-b-4 border-gray-800 pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{cvData.personalInfo.fullName}</h1>
        <div className="flex gap-3 text-sm text-gray-600 mt-2">
          {cvData.personalInfo.email && <span>{cvData.personalInfo.email}</span>}
          {cvData.personalInfo.phone && <span>|</span>}
          {cvData.personalInfo.phone && <span>{cvData.personalInfo.phone}</span>}
          {cvData.personalInfo.location && <span>|</span>}
          {cvData.personalInfo.location && <span>{cvData.personalInfo.location}</span>}
        </div>
      </div>

      <div className="space-y-6">
        {/* Summary */}
        {cvData.personalInfo.summary && (
          <section>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">
              Summary
            </h2>
            <p className="text-gray-800 leading-relaxed text-sm">{cvData.personalInfo.summary}</p>
          </section>
        )}

        {/* Experience */}
        {cvData.experience.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
              Experience
            </h2>
            <div className="space-y-4">
              {cvData.experience.map(exp => (
                <div key={exp.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900">{exp.jobTitle}</h3>
                      <p className="italic text-gray-700">{exp.company}</p>
                    </div>
                    <span className="text-xs text-gray-600">
                      {exp.startDate}
                      {exp.endDate && ` - ${exp.endDate}`}
                      {exp.currentlyWorking && ' - Present'}
                    </span>
                  </div>
                  <p className="text-gray-800 mt-1 text-sm">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {cvData.education.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
              Education
            </h2>
            <div className="space-y-3">
              {cvData.education.map(edu => (
                <div key={edu.id} className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900">{edu.degree}</h3>
                    <p className="text-gray-700">{edu.institution}</p>
                    {edu.field && <p className="text-sm text-gray-700">{edu.field}</p>}
                  </div>
                  {edu.graduationDate && <span className="text-xs text-gray-600">{edu.graduationDate}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {cvData.skills.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">
              Skills
            </h2>
            <p className="text-gray-800 text-sm">{cvData.skills.join(' • ')}</p>
          </section>
        )}
      </div>
    </div>
  );
}
