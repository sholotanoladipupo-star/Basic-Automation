import React from 'react'
import { Page, View, Text, Image } from '@react-pdf/renderer'
import { CVData, TemplateColors } from '@/types/cv.types'
import { PDFBullet } from '@/pdf/shared/PDFBullet'
import { PDFTag } from '@/pdf/shared/PDFTag'

interface Props {
  data: CVData
  colors: TemplateColors
}

function Section({ title, colors, children }: { title: string; colors: TemplateColors; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ width: 4, height: 14, backgroundColor: colors.primary, marginRight: 8, borderRadius: 2 }} />
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.primary, fontFamily: 'Montserrat', textTransform: 'uppercase', letterSpacing: 1 }}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  )
}

export function CreativeTemplate({ data, colors }: Props) {
  const { personalInfo, summary, experience, education, skills, projects, certifications, languages } = data

  return (
    <Page size="A4" style={{ fontFamily: 'Roboto', backgroundColor: colors.background }}>
      {/* Bold top header band */}
      <View
        style={{
          backgroundColor: colors.sidebarBg,
          padding: 32,
          paddingBottom: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {personalInfo.photo ? (
            <Image
              src={personalInfo.photo}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                marginRight: 20,
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.5)',
              }}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.sidebarText, fontFamily: 'Montserrat', lineHeight: 1.1 }}>
              {personalInfo.firstName}
            </Text>
            <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.sidebarText, fontFamily: 'Montserrat', lineHeight: 1.1, opacity: 0.7 }}>
              {personalInfo.lastName}
            </Text>
            <Text style={{ fontSize: 11, color: colors.sidebarText, opacity: 0.85, marginTop: 6, fontFamily: 'Montserrat' }}>
              {personalInfo.title}
            </Text>
          </View>
        </View>

        {/* Contact pills */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 6 }}>
          {[
            { label: personalInfo.email },
            { label: personalInfo.phone },
            { label: personalInfo.location },
            { label: personalInfo.linkedin },
            { label: personalInfo.github },
            { label: personalInfo.website },
          ].filter(c => c.label).map((c, i) => (
            <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 8, color: colors.sidebarText }}>{c.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Body */}
      <View style={{ padding: 28, flexDirection: 'row', flex: 1 }}>
        {/* Left column */}
        <View style={{ width: '60%', paddingRight: 20 }}>
          {/* Summary */}
          {summary ? (
            <Section title="About Me" colors={colors}>
              <Text style={{ fontSize: 9.5, color: colors.text, lineHeight: 1.6 }}>{summary}</Text>
            </Section>
          ) : null}

          {/* Experience */}
          {experience.length > 0 && (
            <Section title="Experience" colors={colors}>
              {experience.map((exp) => (
                <View key={exp.id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text, fontFamily: 'Montserrat' }}>{exp.role}</Text>
                    <Text style={{ fontSize: 8, color: colors.textLight }}>{exp.dateRange}</Text>
                  </View>
                  <Text style={{ fontSize: 9, color: colors.primary, marginBottom: 4, fontWeight: 'bold' }}>
                    {exp.company}{exp.location ? ` · ${exp.location}` : ''}
                  </Text>
                  {exp.bullets.filter(Boolean).map((b, i) => (
                    <PDFBullet key={i} text={b} color={colors.primary} textColor={colors.text} />
                  ))}
                </View>
              ))}
            </Section>
          )}

          {/* Projects */}
          {projects.length > 0 && (
            <Section title="Projects" colors={colors}>
              {projects.map((proj) => (
                <View key={proj.id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text, fontFamily: 'Montserrat' }}>{proj.name}</Text>
                    <Text style={{ fontSize: 8, color: colors.textLight }}>{proj.dateRange}</Text>
                  </View>
                  {proj.techStack.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
                      {proj.techStack.map((t, i) => (
                        <PDFTag key={i} text={t} bgColor={colors.primary + '20'} textColor={colors.primary} />
                      ))}
                    </View>
                  )}
                  {proj.bullets.filter(Boolean).map((b, i) => (
                    <PDFBullet key={i} text={b} color={colors.primary} textColor={colors.text} />
                  ))}
                </View>
              ))}
            </Section>
          )}
        </View>

        {/* Right column */}
        <View style={{ width: '40%' }}>
          {/* Education */}
          {education.length > 0 && (
            <Section title="Education" colors={colors}>
              {education.map((edu) => (
                <View key={edu.id} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: colors.text, fontFamily: 'Montserrat' }}>
                    {edu.degree}{edu.field ? ` in ${edu.field}` : ''}
                  </Text>
                  <Text style={{ fontSize: 9, color: colors.primary }}>{edu.institution}</Text>
                  <Text style={{ fontSize: 8.5, color: colors.textLight }}>{edu.dateRange}{edu.gpa ? ` · GPA ${edu.gpa}` : ''}</Text>
                </View>
              ))}
            </Section>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <Section title="Skills" colors={colors}>
              {skills.map((cat) => (
                <View key={cat.id} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: colors.text, fontFamily: 'Montserrat', marginBottom: 4 }}>
                    {cat.category}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {cat.skills.map((skill, i) => (
                      <PDFTag key={i} text={skill} bgColor={colors.primary + '15'} textColor={colors.primary} />
                    ))}
                  </View>
                </View>
              ))}
            </Section>
          )}

          {/* Languages */}
          {languages.length > 0 && (
            <Section title="Languages" colors={colors}>
              {languages.map((lang) => (
                <View key={lang.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={{ fontSize: 9, color: colors.text }}>{lang.language}</Text>
                  <Text style={{ fontSize: 8.5, color: colors.textLight }}>{lang.proficiency}</Text>
                </View>
              ))}
            </Section>
          )}

          {/* Certifications */}
          {certifications.length > 0 && (
            <Section title="Certifications" colors={colors}>
              {certifications.map((cert) => (
                <View key={cert.id} style={{ marginBottom: 7 }}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: colors.text }}>{cert.name}</Text>
                  <Text style={{ fontSize: 8.5, color: colors.textLight }}>{cert.issuer}</Text>
                  {cert.date ? <Text style={{ fontSize: 8, color: colors.textLight }}>{cert.date}</Text> : null}
                </View>
              ))}
            </Section>
          )}
        </View>
      </View>
    </Page>
  )
}
