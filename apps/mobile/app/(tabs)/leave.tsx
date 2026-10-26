import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { LeaveRequestRow } from '../../src/lib/queries'
import { useEmployee } from '../../src/lib/use-employee'
import { useLeaveData } from '../../src/lib/use-leave-data'
import { useRefresh } from '../../src/lib/use-refresh'
import { formatDateRange, formatNumber, leaveStatus, plural } from '../../src/lib/format'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
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

  const requests = useMemo(
    () => [...(data?.leaveRequests ?? [])].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [data],
  )

  const header = (
    <>
      <ScreenHeader title="Leave" subtitle="Your balances and requests." />
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
          <SectionTitle>Balances</SectionTitle>
          {balances.length === 0 ? (
            <Card>
              <EmptyState
                icon="calendar-blank-outline"
                title="No leave balances yet"
                message="HR hasn't set up your leave allowance yet."
              />
            </Card>
          ) : (
            balances.map((balance) => (
              <Card key={balance.leaveTypeId}>
                <View style={styles.balanceHead}>
                  <Text style={styles.balanceName}>{balance.leaveType.name}</Text>
                  <Text style={styles.balanceAvailable}>
                    {formatNumber(balance.availableDays)}
                    <Text style={styles.balanceUnit}> {balance.availableDays === 1 ? 'day' : 'days'} left</Text>
                  </Text>
                </View>
                <View style={styles.balanceStats}>
                  <BalanceStat label="Allocated" value={balance.allocatedDays} />
                  <BalanceStat label="Used" value={balance.usedDays} />
                  <BalanceStat label="Pending" value={balance.pendingDays} />
                </View>
              </Card>
            ))
          )}

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
        </>
      )}
    </Screen>
  )
}

function BalanceStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{formatNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
            {formatDateRange(request.startDate, request.endDate)} · {plural(request.totalDays, 'working day')}
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
  balanceHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  balanceName: {
    ...type.heading,
  },
  balanceAvailable: {
    ...type.title,
    fontSize: 24,
  },
  balanceUnit: {
    ...type.label,
  },
  balanceStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statValue: {
    ...type.bodyStrong,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
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
