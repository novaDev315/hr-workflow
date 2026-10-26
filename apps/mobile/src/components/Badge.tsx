import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSizes, fonts, radii, spacing } from '../theme'
import type { Tone } from '../lib/format'

// Every pair is at least 6:1.
const tones: Record<Tone, { background: string; text: string }> = {
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  danger: { background: colors.dangerSoft, text: colors.danger },
  neutral: { background: colors.neutralSoft, text: colors.neutral },
  info: { background: colors.accentSoft, text: colors.accentStrong },
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const palette = tones[tone]
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    fontFamily: fonts.sans,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
})
