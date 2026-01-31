import React from 'react';
import { CVData } from '../../types';

interface TemplateProps {
  cvData: CVData;
}

export default function CreativeTemplate({ cvData }: TemplateProps) {
  return (
    <div className="font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white p-12 mb-8 rounded-lg">
        <h1 className="text-5xl font-bold mb-1">{cvData.personalInfo.fullName}</h1>
        <p className="text-lg opacity-90">{cvData.personalInfo.summary?.split('.')[0]}</p>
        <div className="flex gap-6 mt-4 text-sm">
          {cvData.personalInfo.email && <span>{cvData.personalInfo.email}</span>}
          {cvData.personalInfo.phone && <span>{cvData.personalInfo.phone}</span>}
          {cvData.personalInfo.location && <span>{cvData.personalInfo.location}</span>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="col-span-2 space-y-8">
          {/* Experience */}
          {cvData.experience.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-purple-600 mb-4">Experience</h2>
              <div className="space-y-6">
                {cvData.experience.map((exp, idx) => (
                  <div key={exp.id} className="border-l-4 border-pink-600 pl-4">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-xl font-bold text-gray-900">{exp.jobTitle}</h3>
                      <span className="text-sm text-gray-600 font-semibold">
                        {exp.startDate} - {exp.currentlyWorking ? 'Present' : exp.endDate}
                      </span>
                    </div>
                    <p className="text-lg text-purple-600 font-semibold mb-2">{exp.company}</p>
                    <p className="text-gray-700">{exp.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Education */}
          {cvData.education.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-purple-600 mb-4">Education</h2>
              <div className="space-y-4">
                {cvData.education.map(edu => (
                  <div key={edu.id} className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-900">{edu.degree}</h3>
                    <p className="text-purple-600 font-semibold">{edu.institution}</p>
                    {edu.field && <p className="text-gray-600 text-sm">{edu.field}</p>}
                    {edu.graduationDate && <p className="text-gray-500 text-sm">{edu.graduationDate}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column */}
        {cvData.skills.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-purple-600 mb-4">Skills</h2>
            <div className="space-y-3">
              {cvData.skills.map((skill, idx) => (
                <div key={idx} className="bg-gradient-to-r from-purple-100 to-pink-100 p-3 rounded-lg">
                  <p className="font-semibold text-gray-800">{skill}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
