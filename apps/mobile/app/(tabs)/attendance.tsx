import { useMemo, type ReactElement } from 'react'
import { useQuery } from '@apollo/client'
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native'
import { ATTENDANCE_QUERY, type AttendanceRecord } from '../../src/lib/queries'
import { useEmployee } from '../../src/lib/use-employee'
import { useRefresh } from '../../src/lib/use-refresh'
import {
  attendanceStatus,
  formatHours,
  formatMonth,
  formatShortDate,
  formatTime,
  monthKey,
} from '../../src/lib/format'
import { Badge, EmptyState, ErrorState, LoadingState, Screen, ScreenHeader } from '../../src/components'
import { colors, radii, spacing, type } from '../../src/theme'

export default function AttendanceScreen() {
  const { employeeId, account, error: accountError, refetch: refetchMe } = useEmployee()
  const { data, loading, error, refetch } = useQuery<{ attendanceRecords: AttendanceRecord[] }>(ATTENDANCE_QUERY, {
    variables: { filter: { employeeId } },
    skip: !employeeId,
  })
  const { refreshing, onRefresh } = useRefresh(refetchMe, employeeId ? refetch : undefined)

  const sections = useMemo(() => {
    const records = [...(data?.attendanceRecords ?? [])].sort(
      (a, b) =>
        b.attendanceDate.localeCompare(a.attendanceDate) ||
        String(b.clockInAt ?? '').localeCompare(String(a.clockInAt ?? '')),
    )
    const groups = new Map<string, AttendanceRecord[]>()
    for (const record of records) {
      const key = monthKey(record.attendanceDate)
      groups.set(key, [...(groups.get(key) ?? []), record])
    }
    return [...groups.entries()].map(([key, items]) => ({
      key,
      title: formatMonth(key),
      days: items.length,
      data: items,
    }))
  }, [data])

  const header = <ScreenHeader title="Attendance" subtitle="Your clock-ins, newest first." />

  let emptyContent: ReactElement | null = null
  if (!account) {
    emptyContent = accountError ? <ErrorState error={accountError} onRetry={() => void refetchMe()} /> : <LoadingState />
  } else if (!employeeId) {
    emptyContent = (
      <EmptyState
        icon="account-question-outline"
        title="No employee profile linked"
        message="Attendance is available once HR links this account to your employee profile."
      />
    )
  } else if (error && !data) {
    emptyContent = <ErrorState error={error} onRetry={() => void refetch()} retrying={loading} />
  } else if (loading && !data) {
    emptyContent = <LoadingState label="Loading attendance" />
  } else if (sections.length === 0) {
    emptyContent = (
      <EmptyState
        icon="clock-outline"
        title="No attendance yet"
        message="Your days appear here after you clock in from the Today tab."
      />
    )
  }

  return (
    <Screen scroll={false}>
      <SectionList
        sections={emptyContent ? [] : sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentStrong}
            colors={[colors.accentStrong]}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {section.title}
            </Text>
            <Text style={styles.sectionMeta}>
              {section.days === 1 ? '1 day' : `${section.days} days`}
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <AttendanceRow record={item} first={index === 0} last={index === section.data.length - 1} />
        )}
      />
    </Screen>
  )
}

function AttendanceRow({ record, first, last }: { record: AttendanceRecord; first: boolean; last: boolean }) {
  const status = attendanceStatus(record.status)
  const inTime = formatTime(record.clockInAt)
  const outTime = record.clockOutAt ? formatTime(record.clockOutAt) : 'now'
  const hours = record.totalHours != null ? formatHours(record.totalHours) : null
  return (
    <View
      style={[styles.row, first && styles.rowFirst, last && styles.rowLast, !last && styles.rowDivider]}
      accessible
      accessibilityLabel={`${formatShortDate(record.attendanceDate)}, ${record.location?.name ?? ''}, ${inTime} to ${outTime}${hours ? `, ${hours}` : ''}, ${status.label}`}
    >
      <View style={styles.rowMain}>
        <Text style={styles.date}>{formatShortDate(record.attendanceDate)}</Text>
        {record.location?.name ? <Text style={styles.meta}>{record.location.name}</Text> : null}
        {/* Duration wraps as a whole under the times on narrow screens. */}
        <View style={styles.timesLine}>
          <Text style={styles.times}>
            {inTime} – {outTime}
          </Text>
          {hours ? <Text style={styles.duration}>{hours.replace(/ /g, '\u00a0')}</Text> : null}
        </View>
      </View>
      <Badge label={status.label} tone={status.tone} />
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...type.title,
  },
  sectionMeta: {
    ...type.label,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  rowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  rowDivider: {
    borderBottomWidth: 1,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  date: {
    ...type.bodyStrong,
  },
  meta: {
    ...type.label,
    fontWeight: '400',
  },
  timesLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.sm,
  },
  times: {
    ...type.body,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  duration: {
    ...type.label,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
})
