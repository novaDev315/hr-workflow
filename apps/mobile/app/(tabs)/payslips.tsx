import { gql, useQuery } from '@apollo/client';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthSession } from '../../src/lib/auth-session';

const ME_QUERY = gql`
  query MobilePayslipMe {
    me {
      employeeId
    }
  }
`

const PAYSLIPS_QUERY = gql`
  query MobilePayslips($employeeId: String!) {
    payslips(filter: { employeeId: $employeeId }) {
      id
      periodMonth
      grossPay
      netPay
      attendanceDeduction
      deductionAmount
      allowanceAmount
      paidDays
      expectedWorkdays
      currencyCode
      status
    }
  }
`

export default function PayslipsScreen() {
  const storedAccount = useAuthSession((state) => state.account)
  const { data: meData } = useQuery(ME_QUERY)
  const employeeId = meData?.me?.employeeId ?? storedAccount?.employeeId ?? null

  const { data, loading } = useQuery(PAYSLIPS_QUERY, {
    variables: {
      employeeId,
    },
    skip: !employeeId,
  })

  const payslips = data?.payslips ?? []

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payslips</Text>
        <Text style={styles.subtitle}>View your processed payroll history</Text>
      </View>

      <View style={styles.content}>
        {!employeeId ? (
          <View style={styles.payslipCard}>
            <Text style={styles.helperText}>
              This account can sign in on mobile, but payslips are only available for linked employee profiles.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.payslipCard}>
            <Text style={styles.helperText}>Loading payslips...</Text>
          </View>
        ) : payslips.length === 0 ? (
          <View style={styles.payslipCard}>
            <Text style={styles.helperText}>No payslips have been generated yet.</Text>
          </View>
        ) : (
          payslips.map((payslip: {
            id: string
            periodMonth: string
            netPay: number
            grossPay: number
            allowanceAmount: number
            deductionAmount: number
            attendanceDeduction: number
            paidDays: number
            expectedWorkdays: number
            currencyCode: string
            status: string
          }) => (
            <View key={payslip.id} style={styles.payslipCard}>
              <View style={styles.payslipHeader}>
                <MaterialCommunityIcons name="file-document" size={40} color="#3b82f6" />
                <View style={styles.payslipInfo}>
                  <Text style={styles.payslipMonth}>{payslip.periodMonth}</Text>
                  <Text style={styles.payslipAmount}>
                    {payslip.currencyCode} {payslip.netPay.toFixed(2)}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  payslip.status === 'PAID' ? styles.statusPaid : styles.statusGenerated,
                ]}>
                  <Text style={styles.statusText}>{payslip.status}</Text>
                </View>
              </View>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Gross Pay</Text>
                  <Text style={styles.summaryValue}>
                    {payslip.currencyCode} {payslip.grossPay.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Allowance</Text>
                  <Text style={styles.summaryValue}>
                    {payslip.currencyCode} {payslip.allowanceAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Deductions</Text>
                  <Text style={styles.summaryValue}>
                    {payslip.currencyCode} {(payslip.deductionAmount + payslip.attendanceDeduction).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Paid Days</Text>
                  <Text style={styles.summaryValue}>
                    {payslip.paidDays}/{payslip.expectedWorkdays}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
    marginTop: 4,
  },
  content: {
    padding: 16,
  },
  payslipCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  payslipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  payslipInfo: {
    flex: 1,
    marginLeft: 12,
  },
  payslipMonth: {
    fontSize: 16,
    fontWeight: '600',
  },
  payslipAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPaid: {
    backgroundColor: '#d1fae5',
  },
  statusGenerated: {
    backgroundColor: '#dbeafe',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#065f46',
  },
  summaryGrid: {
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  helperText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
});
