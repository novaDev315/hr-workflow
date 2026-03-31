import { gql, useQuery } from '@apollo/client'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useAuthSession } from '../../src/lib/auth-session'

const ME_QUERY = gql`
  query MobileAttendanceMe {
    me {
      employeeId
    }
  }
`

const ATTENDANCE_HISTORY_QUERY = gql`
  query MobileAttendanceHistory($filter: AttendanceFilterInput) {
    attendanceRecords(filter: $filter) {
      id
      attendanceDate
      clockInAt
      clockOutAt
      totalHours
      status
    }
  }
`

export default function AttendanceScreen() {
  const storedUser = useAuthSession((state) => state.user)
  const { data: meData } = useQuery(ME_QUERY)
  const employeeId = meData?.me?.employeeId ?? storedUser?.employeeId ?? null
  const { data, loading } = useQuery(ATTENDANCE_HISTORY_QUERY, {
    variables: {
      filter: employeeId
        ? {
            employeeId,
          }
        : null,
    },
    skip: !employeeId,
  })

  const attendanceHistory = data?.attendanceRecords ?? []

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>Track your attendance records</Text>
      </View>

      <View style={styles.content}>
        {!employeeId ? (
          <View style={styles.recordCard}>
            <Text style={styles.timeValue}>
              This account can sign in on mobile, but attendance history is only available for linked employee profiles.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.recordCard}>
            <Text style={styles.timeValue}>Loading attendance history...</Text>
          </View>
        ) : attendanceHistory.length === 0 ? (
          <View style={styles.recordCard}>
            <Text style={styles.timeValue}>No attendance history found yet.</Text>
          </View>
        ) : (
          attendanceHistory.map((record: {
            id: string
            attendanceDate: string
            clockInAt?: string | null
            clockOutAt?: string | null
            status: string
            totalHours?: number | null
          }) => (
          <View key={record.id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordDate}>{record.attendanceDate}</Text>
              <View style={[
                styles.statusBadge,
                record.status === 'COMPLETED' || record.status === 'CLOCKED_IN'
                  ? styles.statusPresent
                  : styles.statusLeave,
              ]}>
                <Text style={[
                  styles.statusText,
                  record.status === 'COMPLETED' || record.status === 'CLOCKED_IN'
                    ? styles.statusPresentText
                    : styles.statusLeaveText,
                ]}>
                  {record.status}
                </Text>
              </View>
            </View>

            <View style={styles.recordDetails}>
              <View style={styles.timeRow}>
                <MaterialCommunityIcons name="clock-in" size={16} color="#6b7280" />
                <Text style={styles.timeLabel}>Clock In:</Text>
                <Text style={styles.timeValue}>
                  {record.clockInAt ? new Date(record.clockInAt).toLocaleTimeString() : '-'}
                </Text>
              </View>
              <View style={styles.timeRow}>
                <MaterialCommunityIcons name="clock-out" size={16} color="#6b7280" />
                <Text style={styles.timeLabel}>Clock Out:</Text>
                <Text style={styles.timeValue}>
                  {record.clockOutAt ? new Date(record.clockOutAt).toLocaleTimeString() : '-'}
                </Text>
              </View>
              <View style={styles.timeRow}>
                <MaterialCommunityIcons name="clock" size={16} color="#6b7280" />
                <Text style={styles.timeLabel}>Total Hours:</Text>
                <Text style={styles.timeValue}>
                  {record.totalHours != null ? `${record.totalHours}h` : '-'}
                </Text>
              </View>
            </View>
          </View>
        )))}
      </View>
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
  content: {
    padding: 16,
  },
  recordCard: {
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
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  recordDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPresent: {
    backgroundColor: '#d1fae5',
  },
  statusLeave: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusPresentText: {
    color: '#065f46',
  },
  statusLeaveText: {
    color: '#991b1b',
  },
  recordDetails: {
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
