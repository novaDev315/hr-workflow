import { useMemo, useRef, useState } from 'react'
import { useMutation } from '@apollo/client'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { REQUEST_LEAVE_MUTATION } from '../src/lib/queries'
import { useEmployee } from '../src/lib/use-employee'
import { useLeaveData } from '../src/lib/use-leave-data'
import { errorMessage } from '../src/lib/errors'
import { countWorkingDays, formatNumber, plural, toDateKey } from '../src/lib/format'
import { Button, DateField, ErrorState, LoadingState, Notice, Screen } from '../src/components'
import { colors, fontSizes, fonts, radii, spacing, touchTarget, type } from '../src/theme'

const REASON_MIN = 3
const REASON_MAX = 500

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export default function RequestLeaveScreen() {
  const router = useRouter()
  const { employeeId } = useEmployee()
  const { data, loading, error, refetch, balances, refetchPending } = useLeaveData(employeeId)
  const [mutate, { loading: submitting }] = useMutation(REQUEST_LEAVE_MUTATION)
  const submittingRef = useRef(false)

  const today = useMemo(startOfToday, [])
  const [leaveTypeId, setLeaveTypeId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<Date>(today)
  const [endDate, setEndDate] = useState<Date>(today)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/leave'))

  const leaveTypes = useMemo(
    () => (data?.leaveTypes ?? []).filter((leaveType) => leaveType.isActive !== false),
    [data],
  )
  const balanceByType = useMemo(() => new Map(balances.map((balance) => [balance.leaveTypeId, balance])), [balances])
  const selectedType = leaveTypes.find((leaveType) => leaveType.id === leaveTypeId) ?? null
  const selectedBalance = leaveTypeId ? balanceByType.get(leaveTypeId) ?? null : null

  const datesInOrder = endDate >= startDate
  const workingDays = datesInOrder ? countWorkingDays(startDate, endDate) : 0
  const remaining = selectedBalance ? selectedBalance.availableDays - workingDays : null

  const summary = !datesInOrder
    ? 'The end date is before the start date.'
    : workingDays === 0
      ? 'These dates are all on a weekend.'
      : remaining === null
        ? plural(workingDays, 'working day')
        : `${plural(workingDays, 'working day')} · ${formatNumber(Math.max(remaining, 0))} left after this request`

  const validate = (): string | null => {
    if (!selectedType) return 'Choose a leave type.'
    if (!datesInOrder) return 'The end date is before the start date.'
    if (workingDays === 0) return 'Choose dates that include at least one working day.'
    if (selectedBalance && workingDays > selectedBalance.availableDays) {
      return `You have ${plural(selectedBalance.availableDays, 'day')} of ${selectedType.name} left. Shorten the dates or choose another leave type.`
    }
    if (reason.trim().length < REASON_MIN) return 'Add a short reason so HR can review your request.'
    return null
  }

  const submit = async () => {
    if (submittingRef.current || !employeeId) return
    const problem = validate()
    if (problem) {
      setFormError(problem)
      return
    }
    submittingRef.current = true
    setFormError(null)
    try {
      await mutate({
        variables: {
          input: {
            employeeId,
            leaveTypeId,
            startDate: toDateKey(startDate),
            endDate: toDateKey(endDate),
            reason: reason.trim(),
          },
        },
        refetchQueries: ['MobileLeave'],
        awaitRefetchQueries: true,
      })
      // Best effort: older backends reject the pendingDays query.
      void refetchPending().catch(() => undefined)
      close()
    } catch (submitError) {
      setFormError(errorMessage(submitError, "We couldn't send your request. Please try again."))
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <Screen scroll={false} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Request leave
        </Text>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="close" size={24} color={colors.ink} />
        </Pressable>
      </View>

      {error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={loading} />
      ) : !data ? (
        <LoadingState label="Loading leave types" />
      ) : (
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.group}>
              <Text style={styles.groupLabel} nativeID="leave-type-label">
                Leave type
              </Text>
              <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabelledBy="leave-type-label">
                {leaveTypes.map((leaveType) => {
                  const active = leaveType.id === leaveTypeId
                  const balance = balanceByType.get(leaveType.id)
                  return (
                    <Pressable
                      key={leaveType.id}
                      onPress={() => {
                        setLeaveTypeId(leaveType.id)
                        setFormError(null)
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={`${leaveType.name}${balance ? `, ${plural(balance.availableDays, 'day')} left` : ''}`}
                      style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}
                    >
                      <MaterialCommunityIcons
                        name={active ? 'radiobox-marked' : 'radiobox-blank'}
                        size={22}
                        color={active ? colors.accentStrong : colors.muted}
                      />
                      <Text style={styles.optionName}>{leaveType.name}</Text>
                      {balance ? <Text style={styles.optionMeta}>{plural(balance.availableDays, 'day')} left</Text> : null}
                    </Pressable>
                  )
                })}
                {leaveTypes.length === 0 ? (
                  <Text style={styles.helper}>No leave types are set up yet. Ask your HR team.</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.dates}>
              <DateField
                label="First day"
                value={startDate}
                minimumDate={today}
                onChange={(date) => {
                  setStartDate(date)
                  if (date > endDate) setEndDate(date)
                  setFormError(null)
                }}
              />
              <DateField
                label="Last day"
                value={endDate}
                minimumDate={startDate}
                onChange={(date) => {
                  setEndDate(date)
                  setFormError(null)
                }}
              />
            </View>

            <View
              style={[styles.summary, (!datesInOrder || workingDays === 0 || (remaining !== null && remaining < 0)) && styles.summaryWarn]}
              accessibilityLiveRegion="polite"
            >
              <MaterialCommunityIcons name="calendar-range" size={20} color={colors.accentStrong} />
              <Text style={styles.summaryText}>
                {summary}
                {remaining !== null && remaining < 0 && datesInOrder && workingDays > 0
                  ? ` — ${formatNumber(-remaining)} more than you have`
                  : ''}
              </Text>
            </View>
            <Text style={styles.helper}>Weekends aren't counted. HR confirms the final number of days.</Text>

            <View style={styles.group}>
              <Text style={styles.groupLabel} nativeID="reason-label">
                Reason
              </Text>
              <TextInput
                style={styles.textArea}
                value={reason}
                onChangeText={(text) => {
                  setReason(text)
                  setFormError(null)
                }}
                multiline
                maxLength={REASON_MAX}
                placeholder="For example: family visit"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Reason"
                accessibilityLabelledBy="reason-label"
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {reason.length}/{REASON_MAX}
              </Text>
            </View>

            {formError ? <Notice tone="danger" message={formError} /> : null}

            <Button label="Send request" loadingLabel="Sending" loading={submitting} onPress={submit} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingTop: spacing.md,
  },
  title: {
    ...type.display,
  },
  close: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    ...type.label,
    color: colors.ink,
    fontWeight: '600',
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  optionActive: {
    borderColor: colors.accentStrong,
    borderWidth: 2,
    backgroundColor: colors.accentSoft,
  },
  optionName: {
    ...type.bodyStrong,
    flex: 1,
  },
  optionMeta: {
    ...type.label,
  },
  dates: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accentAlt,
  },
  summaryWarn: {
    backgroundColor: colors.warningSoft,
  },
  summaryText: {
    ...type.bodyStrong,
    flex: 1,
  },
  helper: {
    ...type.caption,
    marginTop: -spacing.sm,
  },
  textArea: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    fontSize: fontSizes.body,
    fontFamily: fonts.sans,
    color: colors.ink,
  },
  counter: {
    ...type.caption,
    alignSelf: 'flex-end',
  },
})
