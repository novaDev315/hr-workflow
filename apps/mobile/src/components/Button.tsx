import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, fontSizes, fonts, radii, spacing, touchTarget } from '../theme'

type Variant = 'primary' | 'secondary' | 'destructive'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: Variant
  icon?: keyof typeof MaterialCommunityIcons.glyphMap
  loading?: boolean
  loadingLabel?: string
  disabled?: boolean
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
}

const palette: Record<Variant, { background: string; border: string; text: string }> = {
  // white on #7c3d28 = 8.2:1
  primary: { background: colors.accentStrong, border: colors.accentStrong, text: colors.onAccent },
  // #7c3d28 on white = 8.2:1; outline #8a8880 = 3.5:1
  secondary: { background: colors.surfaceRaised, border: colors.borderStrong, text: colors.accentStrong },
  // #8f2a1c on white = 8.3:1
  destructive: { background: colors.surfaceRaised, border: colors.danger, text: colors.danger },
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  loadingLabel,
  disabled = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const tone = palette[variant]
  const inactive = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: tone.background, borderColor: tone.border },
        pressed && !inactive && styles.pressed,
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator size="small" color={tone.text} />
        ) : icon ? (
          <MaterialCommunityIcons name={icon} size={20} color={tone.text} />
        ) : null}
        <Text style={[styles.label, { color: tone.text }]} numberOfLines={1}>
          {loading && loadingLabel ? loadingLabel : label}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: Math.max(touchTarget, 48),
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
})
