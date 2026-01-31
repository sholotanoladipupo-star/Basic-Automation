import React from 'react';
import { CVData } from '../../types';

interface TemplateProps {
  cvData: CVData;
}

export default function MinimalTemplate({ cvData }: TemplateProps) {
  return (
    <div className="font-sans max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{cvData.personalInfo.fullName}</h1>
        <div className="text-sm text-gray-600 mt-1 space-y-1">
          {cvData.personalInfo.email && <div>{cvData.personalInfo.email}</div>}
          {cvData.personalInfo.phone && <div>{cvData.personalInfo.phone}</div>}
          {cvData.personalInfo.location && <div>{cvData.personalInfo.location}</div>}
        </div>
      </div>

      <div className="space-y-6">
        {/* Summary */}
        {cvData.personalInfo.summary && (
          <section>
            <p className="text-gray-800 leading-relaxed">{cvData.personalInfo.summary}</p>
          </section>
        )}

        {/* Experience */}
        {cvData.experience.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Experience</h2>
            <div className="space-y-4">
              {cvData.experience.map(exp => (
                <div key={exp.id}>
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{exp.jobTitle}</p>
                      <p className="text-gray-700">{exp.company}</p>
                    </div>
                    <p className="text-sm text-gray-600">
                      {exp.startDate} – {exp.currentlyWorking ? 'Present' : exp.endDate}
                    </p>
                  </div>
                  <p className="text-gray-700 mt-1 text-sm">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {cvData.education.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Education</h2>
            <div className="space-y-3">
              {cvData.education.map(edu => (
                <div key={edu.id} className="flex justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{edu.degree}</p>
                    <p className="text-gray-700">{edu.institution}</p>
                    {edu.field && <p className="text-sm text-gray-600">{edu.field}</p>}
                  </div>
                  {edu.graduationDate && <p className="text-sm text-gray-600">{edu.graduationDate}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {cvData.skills.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Skills</h2>
            <p className="text-gray-700 text-sm">{cvData.skills.join(', ')}</p>
          </section>
        )}
      </div>
    </div>
  );
}
