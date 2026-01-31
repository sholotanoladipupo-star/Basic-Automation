import React from 'react';
import { CVData } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface CVFormProps {
  cvData: CVData;
  onCvDataChange: (data: CVData) => void;
}

export default function CVForm({ cvData, onCvDataChange }: CVFormProps) {
  const handlePersonalInfoChange = (field: string, value: string) => {
    onCvDataChange({
      ...cvData,
      personalInfo: {
        ...cvData.personalInfo,
        [field]: value,
      },
    });
  };

  const handleAddExperience = () => {
    onCvDataChange({
      ...cvData,
      experience: [
        ...cvData.experience,
        {
          id: Date.now().toString(),
          jobTitle: '',
          company: '',
          startDate: '',
          endDate: '',
          currentlyWorking: false,
          description: '',
        },
      ],
    });
  };

  const handleRemoveExperience = (id: string) => {
    onCvDataChange({
      ...cvData,
      experience: cvData.experience.filter(exp => exp.id !== id),
    });
  };

  const handleExperienceChange = (id: string, field: string, value: any) => {
    onCvDataChange({
      ...cvData,
      experience: cvData.experience.map(exp =>
        exp.id === id ? { ...exp, [field]: value } : exp
      ),
    });
  };

  const handleAddEducation = () => {
    onCvDataChange({
      ...cvData,
      education: [
        ...cvData.education,
        {
          id: Date.now().toString(),
          degree: '',
          institution: '',
          field: '',
          graduationDate: '',
        },
      ],
    });
  };

  const handleRemoveEducation = (id: string) => {
    onCvDataChange({
      ...cvData,
      education: cvData.education.filter(edu => edu.id !== id),
    });
  };

  const handleEducationChange = (id: string, field: string, value: string) => {
    onCvDataChange({
      ...cvData,
      education: cvData.education.map(edu =>
        edu.id === id ? { ...edu, [field]: value } : edu
      ),
    });
  };

  const handleSkillsChange = (skills: string) => {
    onCvDataChange({
      ...cvData,
      skills: skills
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill),
    });
  };

  return (
    <div className="space-y-8">
      {/* Personal Information */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Personal Information</h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            value={cvData.personalInfo.fullName}
            onChange={e => handlePersonalInfoChange('fullName', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            placeholder="Email"
            value={cvData.personalInfo.email}
            onChange={e => handlePersonalInfoChange('email', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            placeholder="Phone"
            value={cvData.personalInfo.phone}
            onChange={e => handlePersonalInfoChange('phone', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Location"
            value={cvData.personalInfo.location}
            onChange={e => handlePersonalInfoChange('location', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Professional Summary"
            value={cvData.personalInfo.summary}
            onChange={e => handlePersonalInfoChange('summary', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </section>

      {/* Experience */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Experience</h2>
          <button
            onClick={handleAddExperience}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Add Experience
          </button>
        </div>
        <div className="space-y-6">
          {cvData.experience.map(exp => (
            <div key={exp.id} className="border border-gray-200 rounded-lg p-4 relative">
              <button
                onClick={() => handleRemoveExperience(exp.id)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Job Title"
                  value={exp.jobTitle}
                  onChange={e => handleExperienceChange(exp.id, 'jobTitle', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Company"
                  value={exp.company}
                  onChange={e => handleExperienceChange(exp.id, 'company', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={exp.startDate}
                    onChange={e => handleExperienceChange(exp.id, 'startDate', e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={exp.endDate}
                    onChange={e => handleExperienceChange(exp.id, 'endDate', e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={exp.currentlyWorking}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exp.currentlyWorking}
                    onChange={e =>
                      handleExperienceChange(exp.id, 'currentlyWorking', e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-gray-700">Currently Working Here</span>
                </label>
                <textarea
                  placeholder="Job Description"
                  value={exp.description}
                  onChange={e => handleExperienceChange(exp.id, 'description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Education */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Education</h2>
          <button
            onClick={handleAddEducation}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Add Education
          </button>
        </div>
        <div className="space-y-6">
          {cvData.education.map(edu => (
            <div key={edu.id} className="border border-gray-200 rounded-lg p-4 relative">
              <button
                onClick={() => handleRemoveEducation(edu.id)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Degree"
                  value={edu.degree}
                  onChange={e => handleEducationChange(edu.id, 'degree', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Institution"
                  value={edu.institution}
                  onChange={e => handleEducationChange(edu.id, 'institution', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Field of Study"
                  value={edu.field}
                  onChange={e => handleEducationChange(edu.id, 'field', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={edu.graduationDate}
                  onChange={e => handleEducationChange(edu.id, 'graduationDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Skills</h2>
        <textarea
          placeholder="Enter skills separated by commas (e.g., JavaScript, React, TypeScript)"
          value={cvData.skills.join(', ')}
          onChange={e => handleSkillsChange(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </section>
    </div>
  );
}
