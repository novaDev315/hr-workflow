import { StyleSheet } from 'react-native'
import { colors, radii, spacing, touchTarget, type } from '../theme'

export interface DateFieldProps {
  label: string
  value: Date
  onChange: (date: Date) => void
  minimumDate?: Date
}

export const dateFieldStyles = StyleSheet.create({
  field: {
    flex: 1,
    gap: spacing.xs,
  },
  iosRow: {
    alignItems: 'flex-start',
  },
  label: {
    ...type.label,
  },
  input: {
    minHeight: Math.max(touchTarget, 48),
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  value: {
    ...type.body,
  },
})
