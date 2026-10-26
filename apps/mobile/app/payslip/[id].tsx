import { useRef, useState } from 'react'
import { useApolloClient, useQuery } from '@apollo/client'
import { StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { EXPORT_PAYSLIP_QUERY, PAYSLIPS_QUERY, type Payslip } from '../../src/lib/queries'
import { useEmployee } from '../../src/lib/use-employee'
import { errorMessage } from '../../src/lib/errors'
import { saveAndShareDocument, type ExportedDocument } from '../../src/lib/save-document'
import { formatMoney, formatMonth, formatNumber, payslipStatus } from '../../src/lib/format'
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
} from '../../src/components'
import { colors, spacing, type } from '../../src/theme'

export default function PayslipDetailScreen() {
  const router = useRouter()
  const client = useApolloClient()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { employeeId } = useEmployee()
  const { data, loading, error, refetch } = useQuery<{ payslips: Payslip[] }>(PAYSLIPS_QUERY, {
    variables: { filter: { employeeId } },
    skip: !employeeId,
  })
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadDone, setDownloadDone] = useState<string | null>(null)
  const busyRef = useRef(false)

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/payslips'))
  const payslip = data?.payslips.find((item) => item.id === id) ?? null

  const download = async () => {
    if (!payslip || busyRef.current) return
    busyRef.current = true
    setDownloading(true)
    setDownloadError(null)
    setDownloadDone(null)
    try {
      const result = await client.query<{ exportPayslipPdf: ExportedDocument }>({
        query: EXPORT_PAYSLIP_QUERY,
        variables: { payslipId: payslip.id },
        fetchPolicy: 'no-cache',
      })
      setDownloadDone(await saveAndShareDocument(result.data.exportPayslipPdf))
    } catch (exportError) {
      setDownloadError(errorMessage(exportError, "We couldn't prepare the PDF. Please try again."))
    } finally {
      busyRef.current = false
      setDownloading(false)
    }
  }

  if (!payslip) {
    return (
      <Screen>
        <ScreenHeader title="Payslip" onBack={back} />
        {error && !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} retrying={loading} />
        ) : loading || !employeeId ? (
          <LoadingState label="Loading payslip" />
        ) : (
          <EmptyState icon="file-document-outline" title="Payslip not found" message="It may have been withdrawn by payroll." />
        )}
      </Screen>
    )
  }

  const status = payslipStatus(payslip.status)
  const money = (value: number) => formatMoney(value, payslip.currencyCode)

  return (
    <Screen>
      <ScreenHeader eyebrow="Payslip" title={formatMonth(payslip.periodMonth)} onBack={back} />

      <Card>
        <View style={styles.netRow}>
          <Text style={styles.netLabel}>Net pay</Text>
          <Badge label={status.label} tone={status.tone} />
        </View>
        <Text style={styles.netValue} accessibilityLabel={`Net pay ${money(payslip.netPay)}`}>
          {money(payslip.netPay)}
        </Text>
        <Text style={styles.caption}>
          {formatNumber(payslip.paidDays)} of {payslip.expectedWorkdays} working days paid
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle} accessibilityRole="header">
          Breakdown
        </Text>
        <Line label="Base salary" value={money(payslip.baseSalary)} />
        <Line label="Allowances" value={money(payslip.allowanceAmount)} />
        <Line label="Gross pay" value={money(payslip.grossPay)} strong divider />
        <Line label="Absence deduction" value={`− ${money(payslip.attendanceDeduction)}`} />
        <Line label="Other deductions" value={`− ${money(payslip.deductionAmount)}`} />
        <Line label="Net pay" value={money(payslip.netPay)} strong divider />
      </Card>

      <Card>
        <Text style={styles.cardTitle} accessibilityRole="header">
          Days
        </Text>
        <Line label="Working days in month" value={String(payslip.expectedWorkdays)} />
        <Line label="Paid days" value={formatNumber(payslip.paidDays)} />
        <Line label="Unpaid days" value={formatNumber(payslip.unpaidDays)} />
      </Card>

      {downloadError ? <Notice tone="danger" message={downloadError} /> : null}
      {downloadDone ? <Notice tone="success" message={downloadDone} onDismiss={() => setDownloadDone(null)} /> : null}
      <Button
        label="Download PDF"
        icon="download"
        loading={downloading}
        loadingLabel="Preparing PDF"
        onPress={download}
        accessibilityHint="Saves the payslip as a PDF and opens the share sheet"
      />
    </Screen>
  )
}

function Line({ label, value, strong, divider }: { label: string; value: string; strong?: boolean; divider?: boolean }) {
  return (
    <View style={[styles.line, divider && styles.lineDivider]}>
      <Text style={strong ? styles.lineLabelStrong : styles.lineLabel}>{label}</Text>
      <Text style={strong ? styles.lineValueStrong : styles.lineValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netLabel: {
    ...type.label,
  },
  netValue: {
    ...type.display,
    fontSize: 34,
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    ...type.label,
    fontWeight: '400',
  },
  cardTitle: {
    ...type.heading,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  lineDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  lineLabel: {
    ...type.body,
    color: colors.muted,
    flexShrink: 1,
  },
  lineLabelStrong: {
    ...type.bodyStrong,
    flexShrink: 1,
  },
  lineValue: {
    ...type.body,
    fontVariant: ['tabular-nums'],
  },
  lineValueStrong: {
    ...type.bodyStrong,
    fontVariant: ['tabular-nums'],
  },
})
