import { createElement } from 'react'
import { Text, View } from 'react-native'
import { colors, fonts, fontSizes, radii, spacing } from '../theme'
import { parseDateOnly, toDateKey } from '../lib/format'
import { dateFieldStyles as styles, type DateFieldProps } from './date-field-shared'

/** Web preview: the browser's own date input (the native picker has no web build). */
export function DateField({ label, value, onChange, minimumDate }: DateFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {createElement('input', {
        type: 'date',
        'aria-label': label,
        value: toDateKey(value),
        min: minimumDate ? toDateKey(minimumDate) : undefined,
        onChange: (event: { target: { value: string } }) => {
          const next = parseDateOnly(event.target.value)
          if (next) onChange(next)
        },
        style: {
          minHeight: 48,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: radii.md,
          background: colors.surfaceRaised,
          color: colors.ink,
          padding: `0 ${spacing.md}px`,
          fontSize: fontSizes.body,
          fontFamily: fonts.sans,
          boxSizing: 'border-box',
          width: '100%',
        },
      })}
    </View>
  )
}
