import { useCallback, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { LeaveRequestRow } from '../../src/lib/queries'
import { useEmployee } from '../../src/lib/use-employee'
import { useLeaveData } from '../../src/lib/use-leave-data'
import { useRefresh } from '../../src/lib/use-refresh'
import { formatDateRange, formatNumber, leaveStatus, plural } from '../../src/lib/format'
import { useFlash } from '../../src/lib/flash'
import type { BalanceWithPending } from '../../src/lib/use-leave-data'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  Screen,
  ScreenHeader,
  SectionTitle,
} from '../../src/components'
import { colors, radii, spacing, type } from '../../src/theme'

export default function LeaveScreen() {
  const router = useRouter()
  const { account, employeeId, error: accountError, refetch: refetchMe } = useEmployee()
  const { data, loading, error, refetch, balances, refetchPending } = useLeaveData(employeeId)
  const { refreshing, onRefresh } = useRefresh(
    refetchMe,
    employeeId ? refetch : undefined,
    employeeId ? refetchPending : undefined,
  )

  const flash = useFlash((state) => state.flash)
  const clearFlash = useFlash((state) => state.clearFlash)
  // The confirmation belongs to this visit: drop it when the employee moves on.
  useFocusEffect(useCallback(() => clearFlash, [clearFlash]))

  // Pending first (what the employee is waiting on), then newest first.
  const requests = useMemo(
    () =>
      [...(data?.leaveRequests ?? [])].sort(
        (a, b) =>
          Number(b.status === 'PENDING') - Number(a.status === 'PENDING') ||
          b.requestedAt.localeCompare(a.requestedAt),
      ),
    [data],
  )

  const header = (
    <>
      <ScreenHeader title="Leave" subtitle="Your requests and days left." />
      {flash ? <Notice tone={flash.tone} message={flash.message} onDismiss={clearFlash} /> : null}
      {employeeId && data ? (
        <Button label="Request leave" icon="plus" onPress={() => router.navigate('/request-leave')} />
      ) : null}
    </>
  )

  if (!account) {
    return (
      <Screen>
        {header}
        {accountError ? <ErrorState error={accountError} onRetry={() => void refetchMe()} /> : <LoadingState />}
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
          message="Leave is available once HR links this account to your employee profile."
        />
      </Screen>
    )
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {header}

      {error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={loading} />
      ) : loading && !data ? (
        <LoadingState label="Loading leave" />
      ) : (
        <>
          <SectionTitle>Requests</SectionTitle>
          {requests.length === 0 ? (
            <Card>
              <EmptyState
                icon="calendar-check-outline"
                title="No requests yet"
                message="Requests you send appear here with their status."
              />
            </Card>
          ) : (
            requests.map((request) => <RequestCard key={request.id} request={request} />)
          )}

          <SectionTitle>Days left</SectionTitle>
          {balances.length === 0 ? (
            <Card>
              <EmptyState
                icon="calendar-blank-outline"
                title="No leave balances yet"
                message="HR hasn't set up your leave allowance yet."
              />
            </Card>
          ) : (
            <View style={styles.balanceGrid}>
              {balances.map((balance) => (
                <BalanceTile key={balance.leaveTypeId} balance={balance} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  )
}

function BalanceTile({ balance }: { balance: BalanceWithPending }) {
  const details = [
    `${formatNumber(balance.usedDays)} of ${formatNumber(balance.allocatedDays)} used`,
    balance.pendingDays ? `${formatNumber(balance.pendingDays)} pending` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <View
      style={styles.balanceTile}
      accessible
      accessibilityLabel={`${balance.leaveType.name}: ${plural(balance.availableDays, 'day')} left, ${details}`}
    >
      <Text style={styles.balanceName} numberOfLines={2}>
        {balance.leaveType.name}
      </Text>
      <Text style={styles.balanceAvailable}>
        {formatNumber(balance.availableDays)}
        <Text style={styles.balanceUnit}> {balance.availableDays === 1 ? 'day' : 'days'} left</Text>
      </Text>
      <Text style={styles.balanceDetail}>{details}</Text>
    </View>
  )
}

function RequestCard({ request }: { request: LeaveRequestRow }) {
  const status = leaveStatus(request.status)
  const decided = request.status === 'APPROVED' || request.status === 'REJECTED'
  return (
    <Card>
      <View style={styles.requestHead}>
        <View style={styles.requestMain}>
          <Text style={styles.requestType}>{request.leaveType.name}</Text>
          <Text style={styles.requestDates}>
            {formatDateRange(request.startDate, request.endDate)} ·{' '}
            {/* No-break spaces keep "3 working days" on one line. */}
            {plural(request.totalDays, 'working day').replace(/ /g, '\u00a0')}
          </Text>
        </View>
        <Badge label={status.label} tone={status.tone} />
      </View>
      {request.reason ? <Text style={styles.reason}>“{request.reason}”</Text> : null}
      {decided && (request.reviewedByName || request.decisionNotes) ? (
        <View style={styles.decision}>
          {request.reviewedByName ? (
            <Text style={styles.decisionBy}>
              {status.label} by {request.reviewedByName}
            </Text>
          ) : null}
          {request.decisionNotes ? <Text style={styles.decisionNote}>{request.decisionNotes}</Text> : null}
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  balanceTile: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 140,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  balanceName: {
    ...type.label,
    color: colors.ink,
    fontWeight: '600',
  },
  balanceAvailable: {
    ...type.title,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  balanceUnit: {
    ...type.label,
  },
  balanceDetail: {
    ...type.caption,
  },
  requestHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  requestMain: {
    flex: 1,
    gap: 2,
  },
  requestType: {
    ...type.bodyStrong,
  },
  requestDates: {
    ...type.label,
    fontWeight: '400',
  },
  reason: {
    ...type.body,
    color: colors.muted,
  },
  decision: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  decisionBy: {
    ...type.label,
    color: colors.ink,
    fontWeight: '600',
  },
  decisionNote: {
    ...type.body,
  },
})
