import { Platform, Pressable, Text, View } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors } from '../theme'
import { formatLongDate } from '../lib/format'
import { dateFieldStyles as styles, type DateFieldProps } from './date-field-shared'

/** Native date picker: inline compact picker on iOS, system dialog on Android. */
export function DateField({ label, value, onChange, minimumDate }: DateFieldProps) {
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.field, styles.iosRow]}>
        <Text style={styles.label}>{label}</Text>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          minimumDate={minimumDate}
          accentColor={colors.accentStrong}
          themeVariant="light"
          accessibilityLabel={label}
          onChange={(_, date) => date && onChange(date)}
        />
      </View>
    )
  }

  const open = () =>
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(date)
      },
    })

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatLongDate(value)}`}
        accessibilityHint="Opens a date picker"
        style={({ pressed }) => [styles.input, pressed && styles.pressed]}
      >
        <Text style={styles.value}>{formatLongDate(value)}</Text>
        <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.accentStrong} />
      </Pressable>
    </View>
  )
}
