import { useMemo, type ReactElement } from 'react'
import { useQuery } from '@apollo/client'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { PAYSLIPS_QUERY, type Payslip } from '../../src/lib/queries'
import { useEmployee } from '../../src/lib/use-employee'
import { useRefresh } from '../../src/lib/use-refresh'
import { formatMoney, formatMonth, formatNumber } from '../../src/lib/format'
import { EmptyState, ErrorState, LoadingState, Screen, ScreenHeader } from '../../src/components'
import { colors, radii, spacing, type } from '../../src/theme'

export default function PayslipsScreen() {
  const router = useRouter()
  const { account, employeeId, error: accountError, refetch: refetchMe } = useEmployee()
  const { data, loading, error, refetch } = useQuery<{ payslips: Payslip[] }>(PAYSLIPS_QUERY, {
    variables: { filter: { employeeId } },
    skip: !employeeId,
  })
  const { refreshing, onRefresh } = useRefresh(refetchMe, employeeId ? refetch : undefined)

  const payslips = useMemo(
    () => [...(data?.payslips ?? [])].sort((a, b) => b.periodMonth.localeCompare(a.periodMonth)),
    [data],
  )

  let emptyContent: ReactElement | null = null
  if (!account) {
    emptyContent = accountError ? <ErrorState error={accountError} onRetry={() => void refetchMe()} /> : <LoadingState />
  } else if (!employeeId) {
    emptyContent = (
      <EmptyState
        icon="account-question-outline"
        title="No employee profile linked"
        message="Payslips are available once HR links this account to your employee profile."
      />
    )
  } else if (error && !data) {
    emptyContent = <ErrorState error={error} onRetry={() => void refetch()} retrying={loading} />
  } else if (loading && !data) {
    emptyContent = <LoadingState label="Loading payslips" />
  } else if (payslips.length === 0) {
    emptyContent = (
      <EmptyState
        icon="file-document-outline"
        title="No payslips yet"
        message="Your payslip appears here once payroll for the month has been paid."
      />
    )
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={emptyContent ? [] : payslips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<ScreenHeader title="Payslips" subtitle="Paid months, newest first." />}
        ListEmptyComponent={emptyContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentStrong}
            colors={[colors.accentStrong]}
          />
        }
        renderItem={({ item, index }) => (
          <Pressable
            // navigate, not push: expo-router 4 push adds `__EXPO_ROUTER_key=undefined-…` to web URLs.
            onPress={() => router.navigate(`/payslip/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${formatMonth(item.periodMonth)}, net pay ${formatMoney(item.netPay, item.currencyCode)}`}
            accessibilityHint="Opens the payslip"
            style={({ pressed }) => [styles.row, index === 0 && styles.rowFirst, pressed && styles.pressed]}
          >
            <View style={styles.main}>
              <Text style={styles.month}>{formatMonth(item.periodMonth)}</Text>
              <Text style={styles.meta}>
                {formatNumber(item.paidDays)} of {item.expectedWorkdays} days paid
              </Text>
            </View>
            <View style={styles.amountWrap}>
              <Text style={styles.amount}>{formatMoney(item.netPay, item.currencyCode)}</Text>
              <Text style={styles.meta}>Net pay</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
          </Pressable>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.sm,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  rowFirst: {
    marginTop: spacing.xl,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  month: {
    ...type.bodyStrong,
  },
  meta: {
    ...type.caption,
  },
  amountWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    ...type.bodyStrong,
    fontVariant: ['tabular-nums'],
  },
})
