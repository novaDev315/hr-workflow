import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, spacing, touchTarget, type } from '../theme'

interface ScreenHeaderProps {
  title: string
  eyebrow?: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
}

export function ScreenHeader({ title, eyebrow, subtitle, onBack, right }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.ink} />
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <View style={styles.text}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  back: {
    width: touchTarget,
    height: touchTarget,
    marginLeft: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: touchTarget / 2,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    ...type.label,
  },
  title: {
    ...type.display,
  },
  subtitle: {
    ...type.body,
    color: colors.muted,
  },
  right: {
    paddingBottom: spacing.xs,
  },
})
