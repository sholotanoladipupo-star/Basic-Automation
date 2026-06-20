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
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.accent, fontFamily: 'PlayfairDisplay', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {title}
        </Text>
        <View style={{ flex: 1, borderBottomWidth: 0.5, borderBottomColor: colors.border, marginLeft: 10, marginTop: 2 }} />
      </View>
      {children}
    </View>
  )
}

export function ExecutiveTemplate({ data, colors }: Props) {
  const { personalInfo, summary, experience, education, skills, projects, certifications, languages } = data

  return (
    <Page size="A4" style={{ fontFamily: 'Roboto', backgroundColor: colors.background }}>
      {/* Dark premium header */}
      <View style={{ backgroundColor: colors.sidebarBg, padding: 36, paddingBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 30, fontWeight: 'bold', color: colors.sidebarText, fontFamily: 'PlayfairDisplay', letterSpacing: 0.5, marginBottom: 4 }}>
              {personalInfo.firstName} {personalInfo.lastName}
            </Text>
            <Text style={{ fontSize: 12, color: colors.accent, fontFamily: 'PlayfairDisplay', fontStyle: 'italic', marginBottom: 12 }}>
              {personalInfo.title}
            </Text>
            {/* Contact */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[
                personalInfo.email,
                personalInfo.phone,
                personalInfo.location,
              ].filter(Boolean).map((item, i) => (
                <Text key={i} style={{ fontSize: 8.5, color: colors.sidebarText, opacity: 0.8 }}>{item}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
              {[
                personalInfo.linkedin,
                personalInfo.github,
                personalInfo.website,
              ].filter(Boolean).map((item, i) => (
                <Text key={i} style={{ fontSize: 8.5, color: colors.accent, opacity: 0.9 }}>{item}</Text>
              ))}
            </View>
          </View>
          {personalInfo.photo ? (
            <Image
              src={personalInfo.photo}
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                borderWidth: 2,
                borderColor: colors.accent,
              }}
            />
          ) : null}
        </View>
      </View>

      {/* Cream body */}
      <View style={{ padding: 32, flex: 1, flexDirection: 'row' }}>
        {/* Main column */}
        <View style={{ width: '63%', paddingRight: 24 }}>
          {/* Summary */}
          {summary ? (
            <Section title="Executive Summary" colors={colors}>
              <Text style={{ fontSize: 9.5, color: colors.text, lineHeight: 1.7, fontStyle: 'italic' }}>
                {summary}
              </Text>
            </Section>
          ) : null}

          {/* Experience */}
          {experience.length > 0 && (
            <Section title="Professional Experience" colors={colors}>
              {experience.map((exp) => (
                <View key={exp.id} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: 'bold', color: colors.text, fontFamily: 'PlayfairDisplay' }}>
                      {exp.role}
                    </Text>
                    <Text style={{ fontSize: 8.5, color: colors.textLight }}>{exp.dateRange}</Text>
                  </View>
                  <Text style={{ fontSize: 9, color: colors.accent, fontWeight: 'bold', marginBottom: 4 }}>
                    {exp.company}{exp.location ? ` · ${exp.location}` : ''}
                  </Text>
                  {exp.bullets.filter(Boolean).map((b, i) => (
                    <PDFBullet key={i} text={b} color={colors.accent} textColor={colors.text} />
                  ))}
                </View>
              ))}
            </Section>
          )}

          {/* Projects */}
          {projects.length > 0 && (
            <Section title="Notable Projects" colors={colors}>
              {projects.map((proj) => (
                <View key={proj.id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text, fontFamily: 'PlayfairDisplay' }}>{proj.name}</Text>
                    <Text style={{ fontSize: 8.5, color: colors.textLight }}>{proj.dateRange}</Text>
                  </View>
                  {proj.techStack.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 }}>
                      {proj.techStack.map((t, i) => (
                        <PDFTag key={i} text={t} bgColor={colors.accent + '25'} textColor={colors.accent} />
                      ))}
                    </View>
                  )}
                  {proj.bullets.filter(Boolean).map((b, i) => (
                    <PDFBullet key={i} text={b} color={colors.accent} textColor={colors.text} />
                  ))}
                </View>
              ))}
            </Section>
          )}
        </View>

        {/* Right sidebar */}
        <View style={{ width: '37%', borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 20 }}>
          {/* Education */}
          {education.length > 0 && (
            <Section title="Education" colors={colors}>
              {education.map((edu) => (
                <View key={edu.id} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: colors.text, fontFamily: 'PlayfairDisplay' }}>
                    {edu.degree}
                  </Text>
                  {edu.field ? <Text style={{ fontSize: 9, color: colors.textLight }}>{edu.field}</Text> : null}
                  <Text style={{ fontSize: 9, color: colors.accent }}>{edu.institution}</Text>
                  <Text style={{ fontSize: 8.5, color: colors.textLight }}>{edu.dateRange}{edu.gpa ? ` · ${edu.gpa}` : ''}</Text>
                </View>
              ))}
            </Section>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <Section title="Expertise" colors={colors}>
              {skills.map((cat) => (
                <View key={cat.id} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: colors.text, marginBottom: 3 }}>{cat.category}</Text>
                  <Text style={{ fontSize: 8.5, color: colors.textLight, lineHeight: 1.5 }}>
                    {cat.skills.join('  ·  ')}
                  </Text>
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
                  {cert.date ? <Text style={{ fontSize: 8, color: colors.accent }}>{cert.date}</Text> : null}
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
        </View>
      </View>
    </Page>
  )
}
