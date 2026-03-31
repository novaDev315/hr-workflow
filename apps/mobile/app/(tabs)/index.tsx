import { useEffect, useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { useAuthSession } from '../../src/lib/auth-session'

const ME_QUERY = gql`
  query MobileMe {
    me {
      id
      email
      firstName
      lastName
      fullName
      roles
      employeeId
      employeeNumber
      departmentName
      designationTitle
      employeeStatus
    }
  }
`

const EMPLOYEE_LOCATIONS_QUERY = gql`
  query MobileEmployeeLocations($employeeId: ID!) {
    employeeLocations(employeeId: $employeeId) {
      id
      isPrimary
      location {
        id
        code
        name
        geofenceRadius
      }
    }
  }
`

const ATTENDANCE_RECORDS_QUERY = gql`
  query MobileAttendance($filter: AttendanceFilterInput) {
    attendanceRecords(filter: $filter) {
      id
      attendanceDate
      clockInAt
      clockOutAt
      totalHours
      status
      location {
        id
        code
        name
      }
    }
  }
`

const CLOCK_IN_MUTATION = gql`
  mutation MobileClockIn($input: ClockInInput!) {
    clockIn(input: $input) {
      id
    }
  }
`

const CLOCK_OUT_MUTATION = gql`
  mutation MobileClockOut($input: ClockOutInput!) {
    clockOut(input: $input) {
      id
    }
  }
`

export default function HomeScreen() {
  const storedAccount = useAuthSession((state) => state.account)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const { data: meData } = useQuery(ME_QUERY)
  const account = meData?.me ?? storedAccount
  const employeeId = account?.employeeId ?? null

  const {
    data: locationsData,
  } = useQuery(EMPLOYEE_LOCATIONS_QUERY, {
    variables: {
      employeeId,
    },
    skip: !employeeId,
  })

  const {
    data: attendanceData,
    loading,
    refetch,
  } = useQuery(ATTENDANCE_RECORDS_QUERY, {
    variables: {
      filter: employeeId
        ? {
            employeeId,
          }
        : null,
    },
    skip: !employeeId,
  })

  const [clockIn, { loading: clockingIn }] = useMutation(CLOCK_IN_MUTATION)
  const [clockOut, { loading: clockingOut }] = useMutation(CLOCK_OUT_MUTATION)

  const employeeLocations = locationsData?.employeeLocations ?? []
  const attendanceRecords = attendanceData?.attendanceRecords ?? []
  const primaryAssignment =
    employeeLocations.find((assignment: { isPrimary: boolean }) => assignment.isPrimary) ??
    employeeLocations[0] ??
    null
  const selectedAssignment =
    employeeLocations.find(
      (assignment: { location: { id: string } }) =>
        assignment.location.id === selectedLocationId
    ) ?? primaryAssignment
  const today = new Date().toISOString().slice(0, 10)
  const todayRecord =
    attendanceRecords.find(
      (record: { attendanceDate: string }) => record.attendanceDate === today
    ) ?? null
  const isClockedIn = Boolean(todayRecord?.clockInAt && !todayRecord?.clockOutAt)
  const actionLoading = clockingIn || clockingOut

  useEffect(() => {
    if (!selectedLocationId && primaryAssignment?.location?.id) {
      setSelectedLocationId(primaryAssignment.location.id)
    }
  }, [primaryAssignment, selectedLocationId])

  const handleClockAction = async () => {
    try {
      if (!employeeId) {
        Alert.alert('Missing Profile', 'No employee profile is linked to this account.')
        return
      }

      if (!selectedAssignment?.location?.id) {
        Alert.alert(
          'No Location',
          'No active location assignment is available for this employee.'
        )
        return
      }

      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for attendance')
        return
      }

      const location = await Location.getCurrentPositionAsync({})

      if (isClockedIn) {
        await clockOut({
          variables: {
            input: {
              employeeId,
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
          },
        })
      } else {
        await clockIn({
          variables: {
            input: {
              employeeId,
              locationId: selectedAssignment.location.id,
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
          },
        })
      }

      await refetch()
      Alert.alert(
        'Success',
        `Successfully clocked ${isClockedIn ? 'out' : 'in'}!`
      )
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to process attendance'
      )
    }
  }

  const presentDays = attendanceRecords.filter(
    (record: { status: string }) => record.status === 'COMPLETED' || record.status === 'CLOCKED_IN'
  ).length
  const recentActivity = attendanceRecords.slice(0, 3)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good Morning</Text>
        <Text style={styles.name}>{account?.fullName ?? 'Employee'}</Text>
        <Text style={styles.employeeId}>{account?.employeeNumber ?? 'No employee number'}</Text>
      </View>

      {/* Clock In/Out Card */}
      <View style={styles.card}>
        <View style={styles.statusContainer}>
          <MaterialCommunityIcons
            name={isClockedIn ? 'check-circle' : 'clock-outline'}
            size={48}
            color={isClockedIn ? '#10b981' : '#6b7280'}
          />
          <Text style={styles.statusText}>
            {isClockedIn ? 'Clocked In' : 'Not Clocked In'}
          </Text>
          {todayRecord?.clockInAt && (
            <Text style={styles.timeText}>
              Since {new Date(todayRecord.clockInAt).toLocaleTimeString()}
            </Text>
          )}
          {selectedAssignment?.location?.name && (
            <Text style={styles.timeText}>
              Location: {selectedAssignment.location.name}
            </Text>
          )}
          {!employeeId && (
            <Text style={styles.timeText}>
              Attendance actions are only available for accounts linked to an employee profile.
            </Text>
          )}
        </View>

        {employeeLocations.length > 1 && (
          <View style={styles.locationSelector}>
            {employeeLocations.map(
              (assignment: {
                id: string
                isPrimary: boolean
                location: { id: string; name: string }
              }) => (
                <TouchableOpacity
                  key={assignment.id}
                  style={[
                    styles.locationChip,
                    selectedAssignment?.location?.id === assignment.location.id &&
                      styles.locationChipActive,
                  ]}
                  onPress={() => setSelectedLocationId(assignment.location.id)}
                >
                  <Text
                    style={[
                      styles.locationChipText,
                      selectedAssignment?.location?.id === assignment.location.id &&
                        styles.locationChipTextActive,
                    ]}
                  >
                    {assignment.location.name}
                    {assignment.isPrimary ? ' • Primary' : ''}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.clockButton,
            isClockedIn ? styles.clockOutButton : styles.clockInButton,
            actionLoading && styles.buttonDisabled,
          ]}
          onPress={handleClockAction}
          disabled={actionLoading || !employeeId || !selectedAssignment?.location?.id}
        >
          <MaterialCommunityIcons
            name={isClockedIn ? 'logout' : 'login'}
            size={24}
            color="white"
          />
          <Text style={styles.clockButtonText}>
            {actionLoading ? 'Processing...' : isClockedIn ? 'Clock Out' : 'Clock In'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{presentDays}</Text>
          <Text style={styles.statLabel}>Attendance Days</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{employeeLocations.length}</Text>
          <Text style={styles.statLabel}>Assigned Locations</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todayRecord?.status ?? 'READY'}</Text>
          <Text style={styles.statLabel}>Today Status</Text>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {loading ? (
          <View style={styles.activityItem}>
            <Text style={styles.activityAction}>Loading attendance activity...</Text>
          </View>
        ) : recentActivity.length === 0 ? (
          <View style={styles.activityItem}>
            <Text style={styles.activityAction}>No attendance activity yet.</Text>
          </View>
        ) : (
          recentActivity.map(
            (item: {
              id: string
              attendanceDate: string
              clockInAt?: string | null
              clockOutAt?: string | null
              totalHours?: number | null
              location: { name: string }
            }) => (
              <View key={item.id} style={styles.activityItem}>
                <MaterialCommunityIcons
                  name={item.clockOutAt ? 'clock-check' : 'clock-outline'}
                  size={24}
                  color="#3b82f6"
                />
                <View style={styles.activityText}>
                  <Text style={styles.activityAction}>
                    {item.location.name} •{' '}
                    {item.clockOutAt
                      ? `Completed ${item.totalHours ?? '0'}h`
                      : item.clockInAt
                        ? 'Clocked in'
                        : 'Pending'}
                  </Text>
                  <Text style={styles.activityDate}>{item.attendanceDate}</Text>
                </View>
              </View>
            )
          )
        )}
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
    paddingBottom: 40,
  },
  greeting: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
  },
  employeeId: {
    fontSize: 14,
    color: 'white',
    opacity: 0.8,
    marginTop: 4,
  },
  card: {
    backgroundColor: 'white',
    marginTop: -20,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
  },
  timeText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  clockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  clockInButton: {
    backgroundColor: '#10b981',
  },
  clockOutButton: {
    backgroundColor: '#ef4444',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  clockButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  activityText: {
    flex: 1,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '500',
  },
  activityDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  locationSelector: {
    marginBottom: 16,
    gap: 8,
  },
  locationChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe4f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  locationChipActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  locationChipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
  },
  locationChipTextActive: {
    color: '#1d4ed8',
  },
});
