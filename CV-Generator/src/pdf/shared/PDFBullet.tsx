import React from 'react'
import { View, Text } from '@react-pdf/renderer'

interface PDFBulletProps {
  text: string
  color: string
  textColor: string
}

export function PDFBullet({ text, color, textColor }: PDFBulletProps) {
  if (!text.trim()) return null
  return (
    <View style={{ flexDirection: 'row', marginBottom: 3 }}>
      <Text style={{ fontSize: 9, color, width: 12, marginTop: 0 }}>•</Text>
      <Text style={{ fontSize: 9, color: textColor, flex: 1, lineHeight: 1.5 }}>{text}</Text>
    </View>
  )
}
