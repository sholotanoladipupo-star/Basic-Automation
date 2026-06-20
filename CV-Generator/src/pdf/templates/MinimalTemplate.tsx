import React from 'react'
import { Page, View, Text, Image } from '@react-pdf/renderer'
import { CVData, TemplateColors } from '@/types/cv.types'
import { PDFBullet } from '@/pdf/shared/PDFBullet'

interface Props {
  data: CVData
  colors: TemplateColors
}

function Section({ title, colors, children }: { title: string; colors: TemplateColors; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 9, fontWeight: 'bold', color: colors.textLight, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
        {title}
      </Text>
      {children}
    </View>
  )
}

export function MinimalTemplate({ data, colors }: Props) {
  const { personalInfo, summary, experience, education, skills, projects, certifications, languages } = data

  return (
    <Page size="A4" style={{ fontFamily: 'Roboto', backgroundColor: colors.background, padding: 48 }}>
      {/* Clean header */}
      <View style={{ marginBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, lineHeight: 1.1, marginBottom: 4 }}>
              {personalInfo.firstName} {personalInfo.lastName}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textLight, marginBottom: 12 }}>
              {personalInfo.title}
            </Text>
          </View>
          {personalInfo.photo ? (
            <Image src={personalInfo.photo} style={{ width: 60, height: 60, borderRadius: 30 }} />
          ) : null}
        </View>
        {/* Inline contact */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {[
            personalInfo.email,
            personalInfo.phone,
            personalInfo.location,
            personalInfo.linkedin,
            personalInfo.github,
            personalInfo.website,
          ].filter(Boolean).map((item, i) => (
            <Text key={i} style={{ fontSize: 8.5, color: colors.textLight }}>{item}</Text>
          ))}
        </View>
      </View>

      {/* Summary */}
      {summary ? (
        <Section title="Summary" colors={colors}>
          <Text style={{ fontSize: 9.5, color: colors.text, lineHeight: 1.7 }}>{summary}</Text>
        </Section>
      ) : null}

      {/* Experience */}
      {experience.length > 0 && (
        <Section title="Experience" colors={colors}>
          {experience.map((exp) => (
            <View key={exp.id} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
                <Text style={{ fontSize: 10.5, fontWeight: 'bold', color: colors.text }}>{exp.role}</Text>
                <Text style={{ fontSize: 8.5, color: colors.textLight }}>{exp.dateRange}</Text>
              </View>
              <Text style={{ fontSize: 9, color: colors.textLight, marginBottom: 5 }}>
                {exp.company}{exp.location ? ` · ${exp.location}` : ''}
              </Text>
              {exp.bullets.filter(Boolean).map((b, i) => (
                <PDFBullet key={i} text={b} color={colors.textLight} textColor={colors.text} />
              ))}
            </View>
          ))}
        </Section>
      )}

      {/* Education */}
      {education.length > 0 && (
        <Section title="Education" colors={colors}>
          {education.map((edu) => (
            <View key={edu.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <View>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text }}>
                  {edu.degree}{edu.field ? ` in ${edu.field}` : ''}
                </Text>
                <Text style={{ fontSize: 9, color: colors.textLight }}>{edu.institution}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 8.5, color: colors.textLight }}>{edu.dateRange}</Text>
                {edu.gpa ? <Text style={{ fontSize: 8.5, color: colors.textLight }}>GPA: {edu.gpa}</Text> : null}
              </View>
            </View>
          ))}
        </Section>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <Section title="Skills" colors={colors}>
          {skills.map((cat) => (
            <View key={cat.id} style={{ flexDirection: 'row', marginBottom: 5 }}>
              <Text style={{ fontSize: 9, color: colors.textLight, width: 90 }}>{cat.category}</Text>
              <Text style={{ fontSize: 9, color: colors.text, flex: 1 }}>{cat.skills.join(', ')}</Text>
            </View>
          ))}
        </Section>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <Section title="Projects" colors={colors}>
          {projects.map((proj) => (
            <View key={proj.id} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text }}>{proj.name}</Text>
                <Text style={{ fontSize: 8.5, color: colors.textLight }}>{proj.dateRange}</Text>
              </View>
              {proj.techStack.length > 0 && (
                <Text style={{ fontSize: 8.5, color: colors.textLight, marginBottom: 3 }}>
                  {proj.techStack.join(' · ')}
                </Text>
              )}
              {proj.bullets.filter(Boolean).map((b, i) => (
                <PDFBullet key={i} text={b} color={colors.textLight} textColor={colors.text} />
              ))}
            </View>
          ))}
        </Section>
      )}

      {/* Bottom row */}
      <View style={{ flexDirection: 'row', gap: 32 }}>
        {certifications.length > 0 && (
          <View style={{ flex: 1 }}>
            <Section title="Certifications" colors={colors}>
              {certifications.map((cert) => (
                <View key={cert.id} style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: colors.text }}>{cert.name}</Text>
                  <Text style={{ fontSize: 8.5, color: colors.textLight }}>{cert.issuer}{cert.date ? ` · ${cert.date}` : ''}</Text>
                </View>
              ))}
            </Section>
          </View>
        )}
        {languages.length > 0 && (
          <View style={{ flex: 1 }}>
            <Section title="Languages" colors={colors}>
              {languages.map((lang) => (
                <View key={lang.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={{ fontSize: 9, color: colors.text }}>{lang.language}</Text>
                  <Text style={{ fontSize: 8.5, color: colors.textLight }}>{lang.proficiency}</Text>
                </View>
              ))}
            </Section>
          </View>
        )}
      </View>
    </Page>
  )
}
