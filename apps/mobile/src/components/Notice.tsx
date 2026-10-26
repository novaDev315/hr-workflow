import { Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, radii, spacing, touchTarget, type } from '../theme'

type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

const tones: Record<NoticeTone, { background: string; text: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  info: { background: colors.accentSoft, text: colors.accentStrong, icon: 'information-outline' },
  success: { background: colors.successSoft, text: colors.success, icon: 'check-circle-outline' },
  warning: { background: colors.warningSoft, text: colors.warning, icon: 'alert-outline' },
  danger: { background: colors.dangerSoft, text: colors.danger, icon: 'alert-circle-outline' },
}

interface NoticeProps {
  message: string
  tone?: NoticeTone
  action?: { label: string; onPress: () => void }
  onDismiss?: () => void
}

/** Inline message that screen readers announce when it appears. */
export function Notice({ message, tone = 'info', action, onDismiss }: NoticeProps) {
  const palette = tones[tone]
  return (
    <View
      style={[styles.notice, { backgroundColor: palette.background }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <MaterialCommunityIcons name={palette.icon} size={20} color={palette.text} style={styles.icon} />
      <View style={styles.body}>
        <Text style={[styles.text, { color: palette.text }]}>{message}</Text>
        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={[styles.actionText, { color: palette.text }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          style={styles.dismiss}
        >
          <MaterialCommunityIcons name="close" size={18} color={palette.text} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  icon: {
    marginTop: 1,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  text: {
    ...type.label,
    fontWeight: '500',
  },
  action: {
    alignSelf: 'flex-start',
    minHeight: touchTarget,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  actionText: {
    ...type.label,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  dismiss: {
    width: touchTarget,
    height: touchTarget,
    marginVertical: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
