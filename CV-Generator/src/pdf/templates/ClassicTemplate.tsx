import React from 'react'
import { Page, View, Text, Image } from '@react-pdf/renderer'
import { CVData, TemplateColors } from '@/types/cv.types'
import { PDFBullet } from '@/pdf/shared/PDFBullet'

interface Props {
  data: CVData
  colors: TemplateColors
}

function SectionTitle({ title, colors }: { title: string; colors: TemplateColors }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: 'bold',
          color: colors.primary,
          fontFamily: 'PlayfairDisplay',
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      <View style={{ borderBottomWidth: 1.5, borderBottomColor: colors.border }} />
    </View>
  )
}

export function ClassicTemplate({ data, colors }: Props) {
  const { personalInfo, summary, experience, education, skills, projects, certifications, languages } = data

  return (
    <Page size="A4" style={{ fontFamily: 'Roboto', backgroundColor: colors.background, padding: 40 }}>
      {/* Header — centered */}
      <View style={{ alignItems: 'center', marginBottom: 24, borderBottomWidth: 2, borderBottomColor: colors.border, paddingBottom: 20 }}>
        {personalInfo.photo ? (
          <Image
            src={personalInfo.photo}
            style={{ width: 70, height: 70, borderRadius: 35, marginBottom: 10 }}
          />
        ) : null}
        <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.primary, fontFamily: 'PlayfairDisplay', marginBottom: 4 }}>
          {personalInfo.firstName} {personalInfo.lastName}
        </Text>
        {personalInfo.title ? (
          <Text style={{ fontSize: 12, color: colors.textLight, fontStyle: 'italic', marginBottom: 10, fontFamily: 'PlayfairDisplay' }}>
            {personalInfo.title}
          </Text>
        ) : null}
        {/* Contact row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
          {[
            personalInfo.email,
            personalInfo.phone,
            personalInfo.location,
            personalInfo.linkedin,
            personalInfo.github,
            personalInfo.website,
          ].filter(Boolean).map((item, i, arr) => (
            <Text key={i} style={{ fontSize: 8.5, color: colors.textLight }}>
              {item}{i < arr.length - 1 ? '  |  ' : ''}
            </Text>
          ))}
        </View>
      </View>

      {/* Summary */}
      {summary ? (
        <View style={{ marginBottom: 18 }}>
          <SectionTitle title="Professional Summary" colors={colors} />
          <Text style={{ fontSize: 9.5, color: colors.text, lineHeight: 1.7, textAlign: 'justify' }}>
            {summary}
          </Text>
        </View>
      ) : null}

      {/* Experience */}
      {experience.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <SectionTitle title="Work Experience" colors={colors} />
          {experience.map((exp) => (
            <View key={exp.id} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 10.5, fontWeight: 'bold', color: colors.text, fontFamily: 'PlayfairDisplay' }}>
                  {exp.role}
                </Text>
                <Text style={{ fontSize: 8.5, color: colors.textLight, fontStyle: 'italic' }}>{exp.dateRange}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontSize: 9, color: colors.accent, fontStyle: 'italic' }}>
                  {exp.company}{exp.location ? `, ${exp.location}` : ''}
                </Text>
              </View>
              {exp.bullets.filter(Boolean).map((bullet, i) => (
                <PDFBullet key={i} text={bullet} color={colors.accent} textColor={colors.text} />
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Education */}
      {education.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <SectionTitle title="Education" colors={colors} />
          {education.map((edu) => (
            <View key={edu.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text, fontFamily: 'PlayfairDisplay' }}>
                  {edu.degree}{edu.field ? ` in ${edu.field}` : ''}
                </Text>
                <Text style={{ fontSize: 9, color: colors.textLight, fontStyle: 'italic' }}>{edu.institution}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 8.5, color: colors.textLight }}>{edu.dateRange}</Text>
                {edu.gpa ? <Text style={{ fontSize: 8.5, color: colors.textLight }}>GPA: {edu.gpa}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <SectionTitle title="Skills" colors={colors} />
          {skills.map((cat) => (
            <View key={cat.id} style={{ flexDirection: 'row', marginBottom: 5 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: colors.text, width: 100 }}>
                {cat.category}:
              </Text>
              <Text style={{ fontSize: 9, color: colors.textLight, flex: 1 }}>
                {cat.skills.join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <SectionTitle title="Projects" colors={colors} />
          {projects.map((proj) => (
            <View key={proj.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text, fontFamily: 'PlayfairDisplay' }}>
                  {proj.name}
                </Text>
                <Text style={{ fontSize: 8.5, color: colors.textLight, fontStyle: 'italic' }}>{proj.dateRange}</Text>
              </View>
              {proj.techStack.length > 0 && (
                <Text style={{ fontSize: 8.5, color: colors.accent, fontStyle: 'italic', marginBottom: 3 }}>
                  {proj.techStack.join(' · ')}
                </Text>
              )}
              {proj.bullets.filter(Boolean).map((bullet, i) => (
                <PDFBullet key={i} text={bullet} color={colors.accent} textColor={colors.text} />
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Certifications + Languages row */}
      <View style={{ flexDirection: 'row', gap: 20 }}>
        {certifications.length > 0 && (
          <View style={{ flex: 1 }}>
            <SectionTitle title="Certifications" colors={colors} />
            {certifications.map((cert) => (
              <View key={cert.id} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: colors.text }}>{cert.name}</Text>
                <Text style={{ fontSize: 8.5, color: colors.textLight, fontStyle: 'italic' }}>
                  {cert.issuer}{cert.date ? ` · ${cert.date}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
        {languages.length > 0 && (
          <View style={{ flex: 1 }}>
            <SectionTitle title="Languages" colors={colors} />
            {languages.map((lang) => (
              <View key={lang.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontSize: 9, color: colors.text }}>{lang.language}</Text>
                <Text style={{ fontSize: 8.5, color: colors.textLight, fontStyle: 'italic' }}>{lang.proficiency}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Page>
  )
}
