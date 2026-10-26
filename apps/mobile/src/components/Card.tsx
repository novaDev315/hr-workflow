import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radii, shadow, spacing, type } from '../theme'

interface CardProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Removes inner padding, e.g. for lists of ListItems. */
  flush?: boolean
}

export function Card({ children, style, flush = false }: CardProps) {
  return <View style={[styles.card, flush && styles.flush, style]}>{children}</View>
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {children}
      </Text>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  flush: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...type.title,
  },
})
