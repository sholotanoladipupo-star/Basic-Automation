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
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: colors.accent, fontFamily: 'SourceCodePro', textTransform: 'uppercase', letterSpacing: 1.5 }}>
          // {title}
        </Text>
        <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: colors.border, marginLeft: 8 }} />
      </View>
      {children}
    </View>
  )
}

export function TechTemplate({ data, colors }: Props) {
  const { personalInfo, summary, experience, education, skills, projects, certifications, languages } = data

  return (
    <Page size="A4" style={{ fontFamily: 'Roboto', backgroundColor: colors.background, flexDirection: 'row' }}>
      {/* Dark sidebar */}
      <View style={{ width: '32%', backgroundColor: colors.sidebarBg, padding: 22, minHeight: '100%' }}>
        {/* Avatar */}
        {personalInfo.photo ? (
          <Image
            src={personalInfo.photo}
            style={{ width: 64, height: 64, borderRadius: 32, marginBottom: 12, alignSelf: 'center', borderWidth: 2, borderColor: colors.accent }}
          />
        ) : null}

        {/* Name */}
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.sidebarText, fontFamily: 'SourceCodePro', marginBottom: 2, lineHeight: 1.2 }}>
          {personalInfo.firstName}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.accent, fontFamily: 'SourceCodePro', marginBottom: 6, lineHeight: 1.2 }}>
          {personalInfo.lastName}
        </Text>
        <Text style={{ fontSize: 8.5, color: colors.sidebarText, opacity: 0.75, marginBottom: 18, fontFamily: 'SourceCodePro' }}>
          {personalInfo.title}
        </Text>

        {/* Contact */}
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 7.5, color: colors.accent, fontFamily: 'SourceCodePro', fontWeight: 'bold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            contact
          </Text>
          {[
            { icon: '@ ', val: personalInfo.email },
            { icon: '# ', val: personalInfo.phone },
            { icon: '~ ', val: personalInfo.location },
            { icon: '↳ ', val: personalInfo.linkedin },
            { icon: '⌥ ', val: personalInfo.github },
            { icon: '⊕ ', val: personalInfo.website },
          ].filter(c => c.val).map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}>
              <Text style={{ fontSize: 8, color: colors.accent, fontFamily: 'SourceCodePro', width: 14 }}>{c.icon}</Text>
              <Text style={{ fontSize: 8, color: colors.sidebarText, opacity: 0.85, flex: 1, fontFamily: 'SourceCodePro' }}>{c.val}</Text>
            </View>
          ))}
        </View>

        {/* Skills in sidebar */}
        {skills.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 7.5, color: colors.accent, fontFamily: 'SourceCodePro', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              tech_stack
            </Text>
            {skills.map((cat) => (
              <View key={cat.id} style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 7.5, color: colors.sidebarText, opacity: 0.6, fontFamily: 'SourceCodePro', marginBottom: 4 }}>
                  {cat.category.toLowerCase()}/
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {cat.skills.map((skill, i) => (
                    <View
                      key={i}
                      style={{
                        backgroundColor: colors.accent + '20',
                        borderRadius: 2,
                        paddingHorizontal: 5,
                        paddingVertical: 2,
                        marginRight: 3,
                        marginBottom: 3,
                        borderWidth: 0.5,
                        borderColor: colors.accent + '50',
                      }}
                    >
                      <Text style={{ fontSize: 7, color: colors.accent, fontFamily: 'SourceCodePro' }}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Languages */}
        {languages.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 7.5, color: colors.accent, fontFamily: 'SourceCodePro', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              languages
            </Text>
            {languages.map((lang) => (
              <View key={lang.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontSize: 8, color: colors.sidebarText, fontFamily: 'SourceCodePro' }}>{lang.language}</Text>
                <Text style={{ fontSize: 7.5, color: colors.accent, fontFamily: 'SourceCodePro' }}>{lang.proficiency}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <View>
            <Text style={{ fontSize: 7.5, color: colors.accent, fontFamily: 'SourceCodePro', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              certs
            </Text>
            {certifications.map((cert) => (
              <View key={cert.id} style={{ marginBottom: 7 }}>
                <Text style={{ fontSize: 7.5, color: colors.sidebarText, fontWeight: 'bold', fontFamily: 'SourceCodePro' }}>{cert.name}</Text>
                <Text style={{ fontSize: 7, color: colors.sidebarText, opacity: 0.65, fontFamily: 'SourceCodePro' }}>{cert.issuer}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Main content */}
      <View style={{ width: '68%', padding: 26, backgroundColor: colors.background }}>
        {/* Summary */}
        {summary ? (
          <Section title="about" colors={colors}>
            <Text style={{ fontSize: 9, color: colors.text, lineHeight: 1.6 }}>{summary}</Text>
          </Section>
        ) : null}

        {/* Experience */}
        {experience.length > 0 && (
          <Section title="experience" colors={colors}>
            {experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text }}>{exp.role}</Text>
                  <Text style={{ fontSize: 8, color: colors.textLight, fontFamily: 'SourceCodePro' }}>{exp.dateRange}</Text>
                </View>
                <Text style={{ fontSize: 9, color: colors.accent, fontFamily: 'SourceCodePro', marginBottom: 4 }}>
                  {exp.company}{exp.location ? ` · ${exp.location}` : ''}
                </Text>
                {exp.bullets.filter(Boolean).map((b, i) => (
                  <PDFBullet key={i} text={b} color={colors.accent} textColor={colors.text} />
                ))}
              </View>
            ))}
          </Section>
        )}

        {/* Education */}
        {education.length > 0 && (
          <Section title="education" colors={colors}>
            {education.map((edu) => (
              <View key={edu.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View>
                  <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: colors.text }}>
                    {edu.degree}{edu.field ? ` in ${edu.field}` : ''}
                  </Text>
                  <Text style={{ fontSize: 9, color: colors.accent, fontFamily: 'SourceCodePro' }}>{edu.institution}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 8, color: colors.textLight, fontFamily: 'SourceCodePro' }}>{edu.dateRange}</Text>
                  {edu.gpa ? <Text style={{ fontSize: 8, color: colors.textLight }}>GPA: {edu.gpa}</Text> : null}
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <Section title="projects" colors={colors}>
            {projects.map((proj) => (
              <View key={proj.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text }}>{proj.name}</Text>
                  <Text style={{ fontSize: 8, color: colors.textLight, fontFamily: 'SourceCodePro' }}>{proj.dateRange}</Text>
                </View>
                {proj.url ? (
                  <Text style={{ fontSize: 8, color: colors.accent, fontFamily: 'SourceCodePro', marginBottom: 3 }}>{proj.url}</Text>
                ) : null}
                {proj.techStack.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
                    {proj.techStack.map((t, i) => (
                      <PDFTag key={i} text={t} bgColor={colors.accent + '15'} textColor={colors.accent} fontFamily="SourceCodePro" />
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
    </Page>
  )
}
