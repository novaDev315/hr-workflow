import { useCallback, useMemo, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@apollo/client'
import { useFocusEffect, useRouter } from 'expo-router'
import { CANCEL_LEAVE_MUTATION, type LeaveRequestRow } from '../../src/lib/queries'
import { friendlyErrorMessage } from '../../src/lib/errors'
import { confirmAction } from '../../src/lib/session-actions'
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
  const showFlash = useFlash((state) => state.showFlash)
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

  const [cancelLeave, { loading: cancelling }] = useMutation(CANCEL_LEAVE_MUTATION)
  const cancellingRef = useRef(false)
  const handleCancel = async (request: LeaveRequestRow) => {
    if (cancellingRef.current) return
    const confirmed = await confirmAction({
      title: 'Cancel this request?',
      message: `${request.leaveType.name}, ${formatDateRange(request.startDate, request.endDate)}. Your manager won't need to review it, and the days go back to your balance.`,
      confirmLabel: 'Cancel request',
      destructive: true,
    })
    if (!confirmed) return
    cancellingRef.current = true
    clearFlash()
    try {
      await cancelLeave({
        variables: { input: { requestId: request.id } },
        refetchQueries: ['MobileLeave', 'MobileLeavePending'],
        awaitRefetchQueries: true,
      })
      showFlash(`Request cancelled: ${request.leaveType.name}, ${formatDateRange(request.startDate, request.endDate)}.`)
    } catch (cancelError) {
      showFlash(friendlyErrorMessage(cancelError, "We couldn't cancel this request. Please try again."), 'danger')
    } finally {
      cancellingRef.current = false
    }
  }

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
            requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                cancelling={cancelling}
                onCancel={() => void handleCancel(request)}
              />
            ))
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

function RequestCard({
  request,
  cancelling,
  onCancel,
}: {
  request: LeaveRequestRow
  cancelling: boolean
  onCancel: () => void
}) {
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
      {request.status === 'PENDING' ? (
        <Button
          label="Cancel request"
          icon="close"
          variant="secondary"
          disabled={cancelling}
          accessibilityHint="Withdraws this request before it is reviewed"
          onPress={onCancel}
        />
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
