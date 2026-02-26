import { StyleSheet } from '@react-pdf/renderer'
import { TemplateColors } from '@/types/cv.types'

// Dynamic styles factory — can't use static StyleSheet when colors are dynamic
export function createStyles(colors: TemplateColors) {
  return StyleSheet.create({
    page: {
      backgroundColor: colors.background,
      flexDirection: 'row',
      fontFamily: 'Roboto',
    },
    // Section
    sectionTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    sectionDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 8,
    },
    // Text
    bodyText: {
      fontSize: 9,
      color: colors.text,
      lineHeight: 1.5,
    },
    lightText: {
      fontSize: 8,
      color: colors.textLight,
    },
    // Bullet
    bulletRow: {
      flexDirection: 'row',
      marginBottom: 3,
    },
    bulletDot: {
      fontSize: 9,
      color: colors.primary,
      width: 12,
      marginTop: 1,
    },
    bulletText: {
      fontSize: 9,
      color: colors.text,
      flex: 1,
      lineHeight: 1.5,
    },
    // Tag badge
    tag: {
      backgroundColor: colors.accent + '20',
      borderRadius: 3,
      paddingHorizontal: 5,
      paddingVertical: 2,
      marginRight: 4,
      marginBottom: 4,
    },
    tagText: {
      fontSize: 8,
      color: colors.primary,
      fontWeight: 'bold',
    },
  })
}
