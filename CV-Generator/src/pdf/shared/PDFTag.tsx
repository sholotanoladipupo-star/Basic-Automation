import React from 'react'
import { View, Text } from '@react-pdf/renderer'

interface PDFTagProps {
  text: string
  bgColor: string
  textColor: string
  fontFamily?: string
}

export function PDFTag({ text, bgColor, textColor, fontFamily = 'Roboto' }: PDFTagProps) {
  return (
    <View
      style={{
        backgroundColor: bgColor,
        borderRadius: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginRight: 4,
        marginBottom: 4,
      }}
    >
      <Text style={{ fontSize: 8, color: textColor, fontWeight: 'bold', fontFamily }}>
        {text}
      </Text>
    </View>
  )
}
