import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, spacing, touchTarget, type } from '../theme'

interface ListItemProps {
  title: string
  subtitle?: string
  value?: string
  icon?: keyof typeof MaterialCommunityIcons.glyphMap
  right?: ReactNode
  onPress?: () => void
  accessibilityHint?: string
  last?: boolean
}

/** A row; tappable (with chevron) only when `onPress` is given. */
export function ListItem({ title, subtitle, value, icon, right, onPress, accessibilityHint, last }: ListItemProps) {
  const content = (
    <>
      {icon ? (
        <View style={styles.icon}>
          <MaterialCommunityIcons name={icon} size={22} color={colors.accentStrong} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {right}
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} /> : null}
    </>
  )

  if (!onPress) {
    return <View style={[styles.row, !last && styles.divider]}>{content}</View>
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  )
}

/** Label above value, for read-only details. */
export function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detail, !last && styles.divider]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: Math.max(touchTarget, 56),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.bodyStrong,
  },
  subtitle: {
    ...type.label,
    fontWeight: '400',
  },
  value: {
    ...type.body,
    color: colors.ink,
  },
  detail: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  detailLabel: {
    ...type.label,
  },
  detailValue: {
    ...type.body,
  },
})
