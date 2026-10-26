import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import {
  ATTENDANCE_QUERY,
  CLOCK_IN_MUTATION,
  CLOCK_OUT_MUTATION,
  EMPLOYEE_LOCATIONS_QUERY,
  LEAVE_PAID_QUERY,
  LEAVE_QUERY,
  PAYSLIPS_QUERY,
  type AttendanceRecord,
  type LeaveBalance,
  type LeaveRequestRow,
  type LocationAssignment,
  type Payslip,
} from '../../src/lib/queries'
import { useEmployee } from '../../src/lib/use-employee'
import { useRefresh } from '../../src/lib/use-refresh'
import { clockErrorMessage } from '../../src/lib/errors'
import {
  formatHours,
  formatMoney,
  formatMonth,
  formatNumber,
  formatTime,
  greetingFor,
  todayKey,
} from '../../src/lib/format'
import { Button, Card, EmptyState, ErrorState, LoadingState, Notice, Screen, ScreenHeader } from '../../src/components'
import { colors, radii, spacing, touchTarget, type } from '../../src/theme'

const LOCATION_TIMEOUT_MS = 15000
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type ClockNotice = {
  tone: 'info' | 'success' | 'warning' | 'danger'
  message: string
  action?: { label: string; onPress: () => void }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export default function TodayScreen() {
  const router = useRouter()
  const { account, employeeId, loading: accountLoading, error: accountError, refetch: refetchMe } = useEmployee()
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'locating' | 'saving'>('idle')
  const [notice, setNotice] = useState<ClockNotice | null>(null)
  const busyRef = useRef(false)

  const locationsQuery = useQuery<{ employeeLocations: LocationAssignment[] }>(EMPLOYEE_LOCATIONS_QUERY, {
    variables: { employeeId },
    skip: !employeeId,
  })
  const attendanceQuery = useQuery<{ attendanceRecords: AttendanceRecord[] }>(ATTENDANCE_QUERY, {
    variables: { filter: { employeeId } },
    skip: !employeeId,
  })
  const leaveQuery = useQuery<{ leaveBalances: LeaveBalance[]; leaveRequests: LeaveRequestRow[] }>(LEAVE_QUERY, {
    variables: { employeeId, requestFilter: { employeeId } },
    skip: !employeeId,
  })
  // Errors ignored: an older backend without `isPaid` falls back to excluding the UNPAID code.
  const paidQuery = useQuery<{ leaveBalances: Array<{ leaveTypeId: string; leaveType: { id: string; isPaid?: boolean | null } }> }>(
    LEAVE_PAID_QUERY,
    { variables: { employeeId }, skip: !employeeId, errorPolicy: 'ignore' },
  )
  const payslipsQuery = useQuery<{ payslips: Payslip[] }>(PAYSLIPS_QUERY, {
    variables: { filter: { employeeId } },
    skip: !employeeId,
  })

  const [clockIn] = useMutation(CLOCK_IN_MUTATION)
  const [clockOut] = useMutation(CLOCK_OUT_MUTATION)

  const { refreshing, onRefresh } = useRefresh(
    refetchMe,
    employeeId ? locationsQuery.refetch : undefined,
    employeeId ? attendanceQuery.refetch : undefined,
    employeeId ? leaveQuery.refetch : undefined,
    employeeId ? paidQuery.refetch : undefined,
    employeeId ? payslipsQuery.refetch : undefined,
  )

  const assignments = locationsQuery.data?.employeeLocations ?? []
  const primary = assignments.find((assignment) => assignment.isPrimary) ?? assignments[0] ?? null
  const selected =
    assignments.find((assignment) => assignment.location.id === selectedLocationId) ?? primary

  const records = attendanceQuery.data?.attendanceRecords ?? []
  const { openRecord, todayRecord } = useMemo(() => {
    const today = todayKey()
    const open = records.find((record) => record.clockInAt && !record.clockOutAt) ?? null
    const latestToday = records.find((record) => record.attendanceDate?.slice(0, 10) === today) ?? null
    return { openRecord: open, todayRecord: open ?? latestToday }
  }, [records])
  const isClockedIn = Boolean(openRecord)

  const stats = useMemo(() => {
    const balances = leaveQuery.data?.leaveBalances ?? []
    const requests = leaveQuery.data?.leaveRequests ?? []
    const payslips = [...(payslipsQuery.data?.payslips ?? [])].sort((a, b) =>
      b.periodMonth.localeCompare(a.periodMonth),
    )
    const paidByType = new Map(
      (paidQuery.data?.leaveBalances ?? [])
        .filter((row) => typeof row.leaveType?.isPaid === 'boolean')
        .map((row) => [row.leaveTypeId, row.leaveType.isPaid as boolean]),
    )
    const isPaid = (balance: LeaveBalance) =>
      paidByType.get(balance.leaveTypeId) ?? balance.leaveType?.code?.toUpperCase() !== 'UNPAID'
    return {
      leaveAvailable: leaveQuery.data
        ? balances.filter(isPaid).reduce((sum, balance) => sum + (balance.availableDays ?? 0), 0)
        : null,
      pending: leaveQuery.data ? requests.filter((request) => request.status === 'PENDING').length : null,
      latestPayslip: payslips[0] ?? null,
    }
  }, [leaveQuery.data, paidQuery.data, payslipsQuery.data])

  const handleClockAction = async () => {
    // Guard from the first tap: permission and GPS can take seconds.
    if (busyRef.current) return
    busyRef.current = true
    setNotice(null)
    setPhase('locating')

    const siteName = isClockedIn ? openRecord?.location?.name : selected?.location.name

    try {
      if (!employeeId) return
      if (!isClockedIn && !selected) {
        setNotice({ tone: 'warning', message: 'You have no work site assigned yet. Ask your HR team to add one.' })
        return
      }

      let permission = await Location.getForegroundPermissionsAsync()
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync()
      }
      if (!permission.granted) {
        setNotice(
          permission.canAskAgain || Platform.OS === 'web'
            ? { tone: 'warning', message: 'HRFlow Pro needs your location to confirm you are at your work site.' }
            : {
                tone: 'warning',
                message: 'Location access is off for HRFlow Pro. Turn it on in Settings to clock in or out.',
                action: { label: 'Open settings', onPress: () => void Linking.openSettings() },
              },
        )
        return
      }

      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        LOCATION_TIMEOUT_MS,
        "We couldn't find your location in time. Try again near a window or outside.",
      )
      if (position.mocked) {
        setNotice({
          tone: 'danger',
          message: 'Your location looks simulated. Turn off mock location apps and try again.',
        })
        return
      }

      setPhase('saving')
      const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude }
      if (isClockedIn) {
        await clockOut({ variables: { input: { employeeId, ...coords } } })
      } else {
        await clockIn({ variables: { input: { employeeId, locationId: selected!.location.id, ...coords } } })
      }
      await attendanceQuery.refetch()
      setNotice(
        isClockedIn
          ? { tone: 'success', message: "You're clocked out. See you next time." }
          : { tone: 'success', message: `You're clocked in${siteName ? ` at ${siteName}` : ''}.` },
      )
    } catch (error) {
      setNotice({ tone: 'danger', message: clockErrorMessage(error, siteName, isClockedIn ? 'out' : 'in') })
    } finally {
      busyRef.current = false
      setPhase('idle')
    }
  }

  const now = new Date()
  const firstName = account?.firstName || account?.fullName?.split(' ')[0]
  const header = (
    <ScreenHeader
      eyebrow={`${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`}
      title={firstName ? `${greetingFor(now)}, ${firstName}` : greetingFor(now)}
    />
  )

  if (!account) {
    return (
      <Screen>
        {header}
        {accountLoading ? (
          <LoadingState label="Loading your day" />
        ) : (
          <ErrorState error={accountError} onRetry={() => void refetchMe()} />
        )}
      </Screen>
    )
  }

  if (!employeeId) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        {header}
        <EmptyState
          icon="account-question-outline"
          title="No employee profile linked"
          message="This account isn't linked to an employee profile yet, so attendance, leave and payslips aren't available. Ask your HR team to link it."
        />
      </Screen>
    )
  }

  const busy = phase !== 'idle'
  const statusTitle = isClockedIn
    ? "You're clocked in"
    : todayRecord?.clockOutAt
      ? "You're done for today"
      : "You're not clocked in"
  const statusDetail = isClockedIn
    ? `Clocked in at ${formatTime(openRecord?.clockInAt)}${openRecord?.location?.name ? ` · ${openRecord.location.name}` : ''}`
    : todayRecord?.clockOutAt
      ? `${formatTime(todayRecord.clockInAt)} – ${formatTime(todayRecord.clockOutAt)} · ${formatHours(todayRecord.totalHours)}`
      : selected
        ? `Your site today: ${selected.location.name}`
        : locationsQuery.loading
          ? 'Checking your work sites…'
          : 'No work site assigned yet'

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {header}

      <Card>
        {attendanceQuery.error && !attendanceQuery.data ? (
          <ErrorState
            title="Couldn't load today's attendance"
            error={attendanceQuery.error}
            onRetry={() => void attendanceQuery.refetch()}
          />
        ) : (
          <>
            <View style={styles.statusRow}>
              <View style={[styles.statusIcon, isClockedIn && styles.statusIconActive]}>
                <MaterialCommunityIcons
                  name={isClockedIn ? 'clock-check-outline' : todayRecord?.clockOutAt ? 'check-all' : 'clock-outline'}
                  size={26}
                  color={isClockedIn ? colors.success : colors.accentStrong}
                />
              </View>
              <View style={styles.statusText}>
                <Text style={styles.statusTitle} accessibilityRole="header">
                  {statusTitle}
                </Text>
                <Text style={styles.statusDetail}>{statusDetail}</Text>
              </View>
            </View>

            {!isClockedIn && assignments.length > 1 ? (
              <View style={styles.sites}>
                <Text style={styles.sitesLabel}>Clock in at</Text>
                <View style={styles.siteChips} accessibilityRole="radiogroup">
                  {assignments.map((assignment) => {
                    const active = selected?.location.id === assignment.location.id
                    return (
                      <Pressable
                        key={assignment.id}
                        onPress={() => setSelectedLocationId(assignment.location.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active, disabled: busy }}
                        disabled={busy}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        {active ? <MaterialCommunityIcons name="check" size={16} color={colors.onAccent} /> : null}
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {assignment.location.name}
                          {assignment.isPrimary ? ' (main)' : ''}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : null}

            {notice ? <Notice tone={notice.tone} message={notice.message} action={notice.action} /> : null}

            <Button
              label={isClockedIn ? 'Clock out' : 'Clock in'}
              icon={isClockedIn ? 'logout' : 'login'}
              variant={isClockedIn ? 'secondary' : 'primary'}
              loading={busy}
              loadingLabel={phase === 'locating' ? 'Checking your location' : isClockedIn ? 'Clocking out' : 'Clocking in'}
              disabled={!isClockedIn && !selected}
              onPress={handleClockAction}
              accessibilityHint="Uses your current location to confirm you are at your work site"
            />
          </>
        )}
      </Card>

      <View style={styles.stats}>
        <StatTile
          label="Paid leave days left"
          value={stats.leaveAvailable === null ? '—' : formatNumber(stats.leaveAvailable)}
          onPress={() => router.navigate('/(tabs)/leave')}
        />
        <StatTile
          label={stats.pending === 1 ? 'Pending request' : 'Pending requests'}
          value={stats.pending === null ? '—' : String(stats.pending)}
          onPress={() => router.navigate('/(tabs)/leave')}
        />
      </View>
      <StatTile
        wide
        label={stats.latestPayslip ? `Latest payslip · ${formatMonth(stats.latestPayslip.periodMonth)}` : 'Latest payslip'}
        value={
          stats.latestPayslip
            ? formatMoney(stats.latestPayslip.netPay, stats.latestPayslip.currencyCode)
            : payslipsQuery.loading
              ? '—'
              : 'None yet'
        }
        onPress={() =>
          stats.latestPayslip
            ? router.navigate(`/payslip/${stats.latestPayslip.id}`)
            : router.navigate('/(tabs)/payslips')
        }
      />
    </Screen>
  )
}

function StatTile({ label, value, onPress, wide }: { label: string; value: string; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.tile, wide ? styles.tileWide : styles.tileHalf, pressed && styles.tilePressed]}
    >
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconActive: {
    backgroundColor: colors.successSoft,
  },
  statusText: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    ...type.title,
  },
  statusDetail: {
    ...type.body,
    color: colors.muted,
  },
  sites: {
    gap: spacing.sm,
  },
  sitesLabel: {
    ...type.label,
  },
  siteChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: {
    backgroundColor: colors.accentStrong,
    borderColor: colors.accentStrong,
  },
  chipText: {
    ...type.label,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.onAccent,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tile: {
    minHeight: 88,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  tileHalf: {
    flex: 1,
  },
  tileWide: {
    alignSelf: 'stretch',
  },
  tilePressed: {
    backgroundColor: colors.surfaceMuted,
  },
  tileValue: {
    ...type.display,
    fontSize: 26,
    lineHeight: 32,
  },
  tileLabel: {
    ...type.label,
  },
})
