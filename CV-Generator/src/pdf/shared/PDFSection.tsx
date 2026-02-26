import React from 'react'
import { View, Text } from '@react-pdf/renderer'
import { TemplateColors } from '@/types/cv.types'

interface PDFSectionProps {
  title: string
  colors: TemplateColors
  children: React.ReactNode
  style?: Record<string, unknown>
  compact?: boolean
}

export function PDFSection({ title, colors, children, style, compact }: PDFSectionProps) {
  return (
    <View style={{ marginBottom: compact ? 8 : 12, ...style }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: 'bold',
          color: colors.primary,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginBottom: 6,
        }}
      />
      {children}
    </View>
  )
}
