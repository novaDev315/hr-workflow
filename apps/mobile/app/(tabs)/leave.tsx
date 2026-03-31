import { useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useAuthSession } from '../../src/lib/auth-session'

const ME_QUERY = gql`
  query MobileLeaveMe {
    me {
      employeeId
      fullName
      employeeNumber
    }
  }
`

const LEAVE_SCREEN_QUERY = gql`
  query MobileLeaveScreen($employeeId: ID!) {
    leaveTypes {
      id
      code
      name
      defaultDays
    }
    leaveBalances(employeeId: $employeeId) {
      leaveTypeId
      allocatedDays
      usedDays
      availableDays
      leaveType {
        id
        code
        name
      }
    }
    leaveRequests(filter: { employeeId: $employeeId }) {
      id
      startDate
      endDate
      totalDays
      status
      reason
      requestedAt
      leaveType {
        id
        name
      }
    }
  }
`

const REQUEST_LEAVE_MUTATION = gql`
  mutation RequestLeave($input: RequestLeaveInput!) {
    requestLeave(input: $input) {
      id
      status
    }
  }
`

export default function LeaveScreen() {
  const storedAccount = useAuthSession((state) => state.account)
  const { data: meData } = useQuery(ME_QUERY)
  const account = meData?.me ?? storedAccount
  const employeeId = account?.employeeId ?? null
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const { data, loading, refetch } = useQuery(LEAVE_SCREEN_QUERY, {
    variables: {
      employeeId,
    },
    skip: !employeeId,
  })

  const [requestLeave, { loading: submittingRequest }] = useMutation(
    REQUEST_LEAVE_MUTATION
  )

  const leaveTypes = data?.leaveTypes ?? []
  const leaveBalances = data?.leaveBalances ?? []
  const leaveRequests = data?.leaveRequests ?? []

  const handleRequestLeave = async () => {
    if (!employeeId) {
      Alert.alert('Missing Profile', 'No employee profile is linked to this account.')
      return
    }

    if (!leaveTypeId || !startDate || !endDate || !reason.trim()) {
      Alert.alert('Missing Details', 'Complete the leave type, dates, and reason.')
      return
    }

    try {
      await requestLeave({
        variables: {
          input: {
            employeeId,
            leaveTypeId,
            startDate,
            endDate,
            reason: reason.trim(),
          },
        },
      })

      setLeaveTypeId('')
      setStartDate('')
      setEndDate('')
      setReason('')
      await refetch()
      Alert.alert('Success', 'Leave request submitted.')
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Unable to submit leave request.'
      )
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leave Management</Text>
        <Text style={styles.subtitle}>Apply and track your leave</Text>
      </View>

      {!employeeId ? (
        <View style={styles.section}>
          <View style={styles.messageCard}>
            <Text style={styles.messageText}>
              This account can sign in on mobile, but leave self-service is only available for linked employee profiles.
            </Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leave Balance</Text>
            {loading ? (
              <View style={styles.balanceCard}>
                <Text style={styles.balanceType}>Loading leave balances...</Text>
              </View>
            ) : (
              <View style={styles.balanceGrid}>
                {leaveBalances.map((balance: {
                  leaveTypeId: string
                  availableDays: number
                  allocatedDays: number
                  usedDays: number
                  leaveType: { name: string }
                }) => (
                  <View key={balance.leaveTypeId} style={styles.balanceCard}>
                    <Text style={styles.balanceType}>{balance.leaveType.name}</Text>
                    <Text style={styles.balanceValue}>
                      {balance.availableDays}/{balance.allocatedDays}
                    </Text>
                    <Text style={styles.balanceLabel}>
                      {balance.usedDays} used this year
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Apply for Leave</Text>
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>Leave Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leaveTypeRow}>
                {leaveTypes.map((leaveType: { id: string; name: string; code: string }) => (
                  <TouchableOpacity
                    key={leaveType.id}
                    style={[
                      styles.leaveTypeChip,
                      leaveTypeId === leaveType.id && styles.leaveTypeChipSelected,
                    ]}
                    onPress={() => setLeaveTypeId(leaveType.id)}
                  >
                    <Text
                      style={[
                        styles.leaveTypeChipText,
                        leaveTypeId === leaveType.id && styles.leaveTypeChipTextSelected,
                      ]}
                    >
                      {leaveType.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Start Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={startDate}
                onChangeText={setStartDate}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>End Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={endDate}
                onChangeText={setEndDate}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Reason</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Reason for leave"
                value={reason}
                onChangeText={setReason}
                multiline
              />

              <TouchableOpacity
                style={[styles.applyButton, submittingRequest && styles.buttonDisabled]}
                onPress={handleRequestLeave}
                disabled={submittingRequest}
              >
                <MaterialCommunityIcons name="plus-circle" size={24} color="white" />
                <Text style={styles.applyButtonText}>
                  {submittingRequest ? 'Submitting...' : 'Submit Leave Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Applications</Text>
            {loading ? (
              <View style={styles.applicationCard}>
                <Text style={styles.applicationType}>Loading leave requests...</Text>
              </View>
            ) : leaveRequests.length === 0 ? (
              <View style={styles.applicationCard}>
                <Text style={styles.applicationType}>No leave requests submitted yet.</Text>
              </View>
            ) : (
              leaveRequests.map((application: {
                id: string
                startDate: string
                endDate: string
                status: string
                totalDays: number
                leaveType: { name: string }
              }) => (
                <View key={application.id} style={styles.applicationCard}>
                  <View style={styles.applicationHeader}>
                    <Text style={styles.applicationDates}>
                      {application.startDate} to {application.endDate}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        application.status === 'APPROVED'
                          ? styles.statusApproved
                          : application.status === 'REJECTED'
                            ? styles.statusRejected
                            : styles.statusPending,
                      ]}
                    >
                      <Text style={styles.statusText}>{application.status}</Text>
                    </View>
                  </View>
                  <View style={styles.applicationDetails}>
                    <Text style={styles.applicationType}>{application.leaveType.name}</Text>
                    <Text style={styles.applicationDays}>{application.totalDays} day(s)</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  )
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  balanceGrid: {
    gap: 12,
  },
  balanceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceType: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  leaveTypeRow: {
    gap: 8,
    paddingBottom: 8,
  },
  leaveTypeChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
  },
  leaveTypeChipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  leaveTypeChipText: {
    color: '#374151',
    fontWeight: '500',
  },
  leaveTypeChipTextSelected: {
    color: '#1d4ed8',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: 'white',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  applicationCard: {
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
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  applicationDates: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    paddingRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusApproved: {
    backgroundColor: '#d1fae5',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusRejected: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  applicationDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  applicationType: {
    fontSize: 14,
    color: '#6b7280',
  },
  applicationDays: {
    fontSize: 14,
    color: '#6b7280',
  },
  messageCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
});
