import React from 'react';
import { CVData } from '../../types';

interface TemplateProps {
  cvData: CVData;
}

export default function ModernTemplate({ cvData }: TemplateProps) {
  return (
    <div className="font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 mb-6">
        <h1 className="text-4xl font-bold mb-2">{cvData.personalInfo.fullName}</h1>
        <div className="flex gap-4 text-sm">
          {cvData.personalInfo.email && <span>{cvData.personalInfo.email}</span>}
          {cvData.personalInfo.phone && <span>•</span>}
          {cvData.personalInfo.phone && <span>{cvData.personalInfo.phone}</span>}
          {cvData.personalInfo.location && <span>•</span>}
          {cvData.personalInfo.location && <span>{cvData.personalInfo.location}</span>}
        </div>
      </div>

      <div className="px-8 space-y-6">
        {/* Summary */}
        {cvData.personalInfo.summary && (
          <section>
            <h2 className="text-xl font-bold text-blue-600 mb-3 pb-2 border-b-2 border-blue-600">
              Professional Summary
            </h2>
            <p className="text-gray-700 leading-relaxed">{cvData.personalInfo.summary}</p>
          </section>
        )}

        {/* Experience */}
        {cvData.experience.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-blue-600 mb-3 pb-2 border-b-2 border-blue-600">
              Experience
            </h2>
            <div className="space-y-4">
              {cvData.experience.map(exp => (
                <div key={exp.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900">{exp.jobTitle}</h3>
                      <p className="text-gray-600">{exp.company}</p>
                    </div>
                    <span className="text-sm text-gray-600">
                      {exp.startDate}
                      {exp.endDate && ` - ${exp.endDate}`}
                      {exp.currentlyWorking && ' - Present'}
                    </span>
                  </div>
                  <p className="text-gray-700 mt-2 text-sm">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {cvData.education.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-blue-600 mb-3 pb-2 border-b-2 border-blue-600">
              Education
            </h2>
            <div className="space-y-4">
              {cvData.education.map(edu => (
                <div key={edu.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900">{edu.degree}</h3>
                      <p className="text-gray-600">{edu.institution}</p>
                      {edu.field && <p className="text-sm text-gray-700">{edu.field}</p>}
                    </div>
                    {edu.graduationDate && <span className="text-sm text-gray-600">{edu.graduationDate}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {cvData.skills.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-blue-600 mb-3 pb-2 border-b-2 border-blue-600">
              Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {cvData.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
