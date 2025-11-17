import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AttendanceScreen() {
  const attendanceHistory = [
    { date: '2024-11-16', clockIn: '09:00 AM', clockOut: '06:00 PM', status: 'Present', hours: '9h' },
    { date: '2024-11-15', clockIn: '09:15 AM', clockOut: '06:10 PM', status: 'Present', hours: '8.9h' },
    { date: '2024-11-14', clockIn: '09:00 AM', clockOut: '06:00 PM', status: 'Present', hours: '9h' },
    { date: '2024-11-13', clockIn: '09:05 AM', clockOut: '06:05 PM', status: 'Present', hours: '9h' },
    { date: '2024-11-12', clockIn: '-', clockOut: '-', status: 'Leave', hours: '-' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>Track your attendance records</Text>
      </View>

      <View style={styles.content}>
        {attendanceHistory.map((record, index) => (
          <View key={index} style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordDate}>{record.date}</Text>
              <View style={[
                styles.statusBadge,
                record.status === 'Present' ? styles.statusPresent : styles.statusLeave,
              ]}>
                <Text style={[
                  styles.statusText,
                  record.status === 'Present' ? styles.statusPresentText : styles.statusLeaveText,
                ]}>
                  {record.status}
                </Text>
              </View>
            </View>

            <View style={styles.recordDetails}>
              <View style={styles.timeRow}>
                <MaterialCommunityIcons name="clock-in" size={16} color="#6b7280" />
                <Text style={styles.timeLabel}>Clock In:</Text>
                <Text style={styles.timeValue}>{record.clockIn}</Text>
              </View>
              <View style={styles.timeRow}>
                <MaterialCommunityIcons name="clock-out" size={16} color="#6b7280" />
                <Text style={styles.timeLabel}>Clock Out:</Text>
                <Text style={styles.timeValue}>{record.clockOut}</Text>
              </View>
              <View style={styles.timeRow}>
                <MaterialCommunityIcons name="clock" size={16} color="#6b7280" />
                <Text style={styles.timeLabel}>Total Hours:</Text>
                <Text style={styles.timeValue}>{record.hours}</Text>
              </View>
            </View>
          </View>
        ))}
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
