import React from 'react'
import { Page, View, Text, Image, Link } from '@react-pdf/renderer'
import { CVData, TemplateColors } from '@/types/cv.types'
import { PDFBullet } from '@/pdf/shared/PDFBullet'
import { PDFSection } from '@/pdf/shared/PDFSection'
import { PDFTag } from '@/pdf/shared/PDFTag'

interface Props {
  data: CVData
  colors: TemplateColors
}

export function ModernTemplate({ data, colors }: Props) {
  const { personalInfo, summary, experience, education, skills, projects, certifications, languages } = data

  const sidebarSectionTitle = (title: string) => (
    <Text
      style={{
        fontSize: 9,
        fontWeight: 'bold',
        color: colors.sidebarText,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 4,
        opacity: 0.8,
      }}
    >
      {title}
    </Text>
  )

  return (
    <Page size="A4" style={{ fontFamily: 'Roboto', flexDirection: 'row' }}>
      {/* Sidebar 35% */}
      <View
        style={{
          width: '35%',
          backgroundColor: colors.sidebarBg,
          padding: 24,
          minHeight: '100%',
        }}
      >
        {/* Photo */}
        {personalInfo.photo ? (
          <Image
            src={personalInfo.photo}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              marginBottom: 16,
              alignSelf: 'center',
            }}
          />
        ) : null}

        {/* Name & Title */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: 'bold',
            color: colors.sidebarText,
            marginBottom: 4,
            lineHeight: 1.2,
          }}
        >
          {personalInfo.firstName} {personalInfo.lastName}
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: colors.sidebarText,
            opacity: 0.8,
            marginBottom: 20,
          }}
        >
          {personalInfo.title}
        </Text>

        {/* Contact */}
        <View style={{ marginBottom: 20 }}>
          {sidebarSectionTitle('Contact')}
          <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.sidebarText, opacity: 0.3, marginBottom: 8 }} />
          {personalInfo.email ? (
            <Text style={{ fontSize: 8.5, color: colors.sidebarText, marginBottom: 5, opacity: 0.9 }}>
              ✉  {personalInfo.email}
            </Text>
          ) : null}
          {personalInfo.phone ? (
            <Text style={{ fontSize: 8.5, color: colors.sidebarText, marginBottom: 5, opacity: 0.9 }}>
              ☎  {personalInfo.phone}
            </Text>
          ) : null}
          {personalInfo.location ? (
            <Text style={{ fontSize: 8.5, color: colors.sidebarText, marginBottom: 5, opacity: 0.9 }}>
              ⌖  {personalInfo.location}
            </Text>
          ) : null}
          {personalInfo.linkedin ? (
            <Text style={{ fontSize: 8.5, color: colors.sidebarText, marginBottom: 5, opacity: 0.9 }}>
              in  {personalInfo.linkedin}
            </Text>
          ) : null}
          {personalInfo.github ? (
            <Text style={{ fontSize: 8.5, color: colors.sidebarText, marginBottom: 5, opacity: 0.9 }}>
              ⌥  {personalInfo.github}
            </Text>
          ) : null}
          {personalInfo.website ? (
            <Text style={{ fontSize: 8.5, color: colors.sidebarText, marginBottom: 5, opacity: 0.9 }}>
              ⊕  {personalInfo.website}
            </Text>
          ) : null}
        </View>

        {/* Skills */}
        {skills.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            {sidebarSectionTitle('Skills')}
            <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.sidebarText, opacity: 0.3, marginBottom: 8 }} />
            {skills.map((cat) => (
              <View key={cat.id} style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 8.5, color: colors.sidebarText, fontWeight: 'bold', marginBottom: 4, opacity: 0.9 }}>
                  {cat.category}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {cat.skills.map((skill, i) => (
                    <View
                      key={i}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        borderRadius: 3,
                        paddingHorizontal: 5,
                        paddingVertical: 2,
                        marginRight: 3,
                        marginBottom: 3,
                      }}
                    >
                      <Text style={{ fontSize: 7.5, color: colors.sidebarText }}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Languages */}
        {languages.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            {sidebarSectionTitle('Languages')}
            <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.sidebarText, opacity: 0.3, marginBottom: 8 }} />
            {languages.map((lang) => (
              <View key={lang.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontSize: 8.5, color: colors.sidebarText, opacity: 0.9 }}>{lang.language}</Text>
                <Text style={{ fontSize: 8, color: colors.sidebarText, opacity: 0.65 }}>{lang.proficiency}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            {sidebarSectionTitle('Certifications')}
            <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.sidebarText, opacity: 0.3, marginBottom: 8 }} />
            {certifications.map((cert) => (
              <View key={cert.id} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 8.5, color: colors.sidebarText, fontWeight: 'bold', opacity: 0.9, marginBottom: 1 }}>
                  {cert.name}
                </Text>
                <Text style={{ fontSize: 8, color: colors.sidebarText, opacity: 0.7 }}>{cert.issuer}</Text>
                {cert.date ? (
                  <Text style={{ fontSize: 7.5, color: colors.sidebarText, opacity: 0.6 }}>{cert.date}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Main content 65% */}
      <View style={{ width: '65%', padding: 28, backgroundColor: colors.background }}>
        {/* Summary */}
        {summary ? (
          <PDFSection title="Summary" colors={colors} style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 9, color: colors.text, lineHeight: 1.6 }}>{summary}</Text>
          </PDFSection>
        ) : null}

        {/* Experience */}
        {experience.length > 0 && (
          <PDFSection title="Experience" colors={colors}>
            {experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text }}>{exp.role}</Text>
                  <Text style={{ fontSize: 8, color: colors.textLight }}>{exp.dateRange}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={{ fontSize: 9, color: colors.primary, fontWeight: 'bold' }}>{exp.company}</Text>
                  {exp.location ? (
                    <Text style={{ fontSize: 8, color: colors.textLight }}>{exp.location}</Text>
                  ) : null}
                </View>
                {exp.bullets.filter(Boolean).map((bullet, i) => (
                  <PDFBullet key={i} text={bullet} color={colors.accent} textColor={colors.text} />
                ))}
              </View>
            ))}
          </PDFSection>
        )}

        {/* Education */}
        {education.length > 0 && (
          <PDFSection title="Education" colors={colors}>
            {education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text }}>{edu.degree} in {edu.field}</Text>
                  <Text style={{ fontSize: 8, color: colors.textLight }}>{edu.dateRange}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 9, color: colors.primary, fontWeight: 'bold' }}>{edu.institution}</Text>
                  {edu.gpa ? (
                    <Text style={{ fontSize: 8, color: colors.textLight }}>GPA: {edu.gpa}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </PDFSection>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <PDFSection title="Projects" colors={colors}>
            {projects.map((proj) => (
              <View key={proj.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text }}>{proj.name}</Text>
                  <Text style={{ fontSize: 8, color: colors.textLight }}>{proj.dateRange}</Text>
                </View>
                {proj.role ? (
                  <Text style={{ fontSize: 8.5, color: colors.textLight, marginBottom: 3 }}>{proj.role}</Text>
                ) : null}
                {proj.techStack.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
                    {proj.techStack.map((tech, i) => (
                      <PDFTag
                        key={i}
                        text={tech}
                        bgColor={colors.accent + '20'}
                        textColor={colors.primary}
                      />
                    ))}
                  </View>
                )}
                {proj.bullets.filter(Boolean).map((bullet, i) => (
                  <PDFBullet key={i} text={bullet} color={colors.accent} textColor={colors.text} />
                ))}
              </View>
            ))}
          </PDFSection>
        )}
      </View>
    </Page>
  )
}
