import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, radii, spacing, type } from '../theme'
import { errorMessage } from '../lib/errors'
import { Button } from './Button'

type IconName = keyof typeof MaterialCommunityIcons.glyphMap

export function EmptyState({
  icon = 'inbox-outline',
  title,
  message,
}: {
  icon?: IconName
  title: string
  message?: string
}) {
  return (
    <View style={styles.container} accessible accessibilityLabel={message ? `${title}. ${message}` : title}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={icon} size={28} color={colors.accentStrong} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  )
}

export function ErrorState({
  error,
  title = "Couldn't load this",
  onRetry,
  retrying = false,
}: {
  error: unknown
  title?: string
  onRetry: () => void
  retrying?: boolean
}) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={[styles.iconWrap, styles.errorIcon]}>
        <MaterialCommunityIcons name="cloud-off-outline" size={28} color={colors.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{errorMessage(error)}</Text>
      <Button
        label="Try again"
        icon="refresh"
        variant="secondary"
        onPress={onRetry}
        loading={retrying}
        loadingLabel="Trying again"
        style={styles.retry}
      />
    </View>
  )
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.accentStrong} />
      <Text style={styles.message}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  errorIcon: {
    backgroundColor: colors.dangerSoft,
  },
  title: {
    ...type.heading,
    textAlign: 'center',
  },
  message: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
  },
  retry: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
})
