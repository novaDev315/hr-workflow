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
import { friendlyErrorMessage } from '../src/lib/errors'
import { useFlash } from '../src/lib/flash'
import { countWorkingDays, formatDateRange, formatNumber, nextWorkingDay, plural, toDateKey } from '../src/lib/format'
import { Button, DateField, ErrorState, LoadingState, Notice, Screen } from '../src/components'
import { colors, fontSizes, fonts, radii, spacing, touchTarget, type } from '../src/theme'

const REASON_MIN = 3
const REASON_MAX = 500

type Field = 'type' | 'dates' | 'reason'

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Earliest first day the backend accepts: one year back, so sick days can be logged afterwards. */
function oneYearAgo(today: Date) {
  return new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
}

export default function RequestLeaveScreen() {
  const router = useRouter()
  const showFlash = useFlash((state) => state.showFlash)
  const { employeeId } = useEmployee()
  const { data, loading, error, refetch, balances, refetchPending } = useLeaveData(employeeId)
  const [mutate, { loading: submitting }] = useMutation(REQUEST_LEAVE_MUTATION)
  const submittingRef = useRef(false)

  const today = useMemo(startOfToday, [])
  const firstAllowed = useMemo(() => oneYearAgo(today), [today])
  const [chosenTypeId, setChosenTypeId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<Date>(() => nextWorkingDay(startOfToday()))
  const [endDate, setEndDate] = useState<Date>(() => nextWorkingDay(startOfToday()))
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/leave'))

  const leaveTypes = useMemo(
    () => (data?.leaveTypes ?? []).filter((leaveType) => leaveType.isActive !== false),
    [data],
  )
  const balanceByType = useMemo(() => new Map(balances.map((balance) => [balance.leaveTypeId, balance])), [balances])
  const isUsedUp = (leaveTypeId: string) => {
    const balance = balanceByType.get(leaveTypeId)
    return balance ? balance.availableDays <= 0 : false
  }
  const selectable = leaveTypes.filter((leaveType) => !isUsedUp(leaveType.id))
  // With a single usable type there is nothing to choose.
  const leaveTypeId = chosenTypeId ?? (selectable.length === 1 ? selectable[0].id : null)
  const selectedType = leaveTypes.find((leaveType) => leaveType.id === leaveTypeId) ?? null
  const selectedBalance = leaveTypeId ? balanceByType.get(leaveTypeId) ?? null : null

  const datesInOrder = endDate >= startDate
  const workingDays = datesInOrder ? countWorkingDays(startDate, endDate) : 0
  const remaining = selectedBalance ? selectedBalance.availableDays - workingDays : null
  const overBalance = remaining !== null && remaining < 0 && datesInOrder && workingDays > 0
  const inPast = startDate < today

  const summary = !datesInOrder
    ? 'The last day is before the first day.'
    : workingDays === 0
      ? 'These dates are all on a weekend.'
      : remaining === null
        ? plural(workingDays, 'working day')
        : overBalance
          ? `${plural(workingDays, 'working day')} · ${formatNumber(-remaining)} more than you have`
          : `${plural(workingDays, 'working day')} · ${formatNumber(remaining)} left after this`

  const clearError = (field: Field) => {
    setServerError(null)
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const validate = (): Partial<Record<Field, string>> => {
    const problems: Partial<Record<Field, string>> = {}
    if (!selectedType) problems.type = 'Choose a leave type.'
    if (!datesInOrder) problems.dates = 'The last day is before the first day.'
    else if (workingDays === 0) problems.dates = 'Choose dates that include at least one working day.'
    else if (selectedType && selectedBalance && workingDays > selectedBalance.availableDays) {
      problems.dates = `You have ${plural(selectedBalance.availableDays, 'day')} of ${selectedType.name} left. Shorten the dates or choose another leave type.`
    }
    if (reason.trim().length < REASON_MIN) problems.reason = `Add a short reason (at least ${REASON_MIN} characters) so HR can review it.`
    return problems
  }

  const submit = async () => {
    if (submittingRef.current || !employeeId) return
    const problems = validate()
    setErrors(problems)
    if (Object.values(problems).some(Boolean)) {
      setServerError('Fix the highlighted fields to send your request.')
      return
    }
    submittingRef.current = true
    setServerError(null)
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
      showFlash(
        `Request sent: ${selectedType!.name}, ${formatDateRange(toDateKey(startDate), toDateKey(endDate))}. It's waiting for approval.`,
      )
      close()
    } catch (submitError) {
      setServerError(friendlyErrorMessage(submitError, "We couldn't send your request. Please try again."))
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
                  const usedUp = isUsedUp(leaveType.id)
                  const meta = balance ? (usedUp ? 'None left' : `${plural(balance.availableDays, 'day')} left`) : null
                  return (
                    <Pressable
                      key={leaveType.id}
                      onPress={() => {
                        setChosenTypeId(leaveType.id)
                        clearError('type')
                        clearError('dates')
                      }}
                      disabled={usedUp}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active, disabled: usedUp }}
                      accessibilityLabel={`${leaveType.name}${meta ? `, ${meta}` : ''}`}
                      style={({ pressed }) => [
                        styles.option,
                        errors.type && styles.optionError,
                        active && styles.optionActive,
                        usedUp && styles.optionDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={active ? 'radiobox-marked' : 'radiobox-blank'}
                        size={22}
                        color={active ? colors.accentStrong : colors.muted}
                      />
                      <Text style={[styles.optionName, usedUp && styles.optionNameDisabled]}>{leaveType.name}</Text>
                      {meta ? <Text style={styles.optionMeta}>{meta}</Text> : null}
                    </Pressable>
                  )
                })}
                {leaveTypes.length === 0 ? (
                  <Text style={styles.helper}>No leave types are set up yet. Ask your HR team.</Text>
                ) : null}
              </View>
              {errors.type ? <FieldError message={errors.type} /> : null}
            </View>

            <View style={styles.group}>
              <View style={styles.dates}>
                <DateField
                  label="First day"
                  value={startDate}
                  minimumDate={firstAllowed}
                  onChange={(date) => {
                    setStartDate(date)
                    if (date > endDate) setEndDate(date)
                    clearError('dates')
                  }}
                />
                <DateField
                  label="Last day"
                  value={endDate}
                  minimumDate={startDate}
                  onChange={(date) => {
                    setEndDate(date)
                    clearError('dates')
                  }}
                />
              </View>

              <View
                style={[styles.summary, (!datesInOrder || workingDays === 0 || overBalance) && styles.summaryWarn]}
                accessibilityLiveRegion="polite"
              >
                <MaterialCommunityIcons name="calendar-range" size={20} color={colors.accentStrong} />
                <Text style={styles.summaryText}>{summary}</Text>
              </View>
              {errors.dates ? <FieldError message={errors.dates} /> : null}
              <Text style={styles.helper}>
                {inPast ? 'These days have already passed, which is fine for sick leave. ' : ''}
                Weekends aren't counted. HR confirms the final number of days.
              </Text>
            </View>

            <View style={styles.group}>
              <Text style={styles.groupLabel} nativeID="reason-label">
                Reason
              </Text>
              <TextInput
                style={[styles.textArea, errors.reason && styles.inputError]}
                value={reason}
                onChangeText={(text) => {
                  setReason(text)
                  clearError('reason')
                }}
                multiline
                maxLength={REASON_MAX}
                placeholder="For example: family visit"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Reason"
                accessibilityHint={`Required, at least ${REASON_MIN} characters`}
                accessibilityLabelledBy="reason-label"
                textAlignVertical="top"
              />
              <View style={styles.reasonMeta}>
                {errors.reason ? (
                  <FieldError message={errors.reason} />
                ) : (
                  <Text style={styles.reasonHint}>Required. HR sees this with your request.</Text>
                )}
                <Text style={styles.counter}>
                  {reason.length}/{REASON_MAX}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Kept outside the scroll view so the action and its result are always visible. */}
          <View style={styles.footer}>
            {serverError ? <Notice tone="danger" message={serverError} /> : null}
            <Button
              label={workingDays > 0 && datesInOrder ? `Send request · ${plural(workingDays, 'day')}` : 'Send request'}
              loadingLabel="Sending"
              loading={submitting}
              onPress={submit}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  )
}

function FieldError({ message }: { message: string }) {
  return (
    <View style={styles.fieldError} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.danger} />
      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
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
  optionError: {
    borderColor: colors.danger,
  },
  optionActive: {
    borderColor: colors.accentStrong,
    borderWidth: 2,
    backgroundColor: colors.accentSoft,
  },
  optionDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  optionName: {
    ...type.bodyStrong,
    flex: 1,
  },
  optionNameDisabled: {
    color: colors.muted,
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
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    flex: 1,
  },
  fieldErrorText: {
    ...type.label,
    color: colors.danger,
    flex: 1,
  },
  reasonMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  reasonHint: {
    ...type.caption,
    flex: 1,
  },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
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
    fontVariant: ['tabular-nums'],
  },
})
