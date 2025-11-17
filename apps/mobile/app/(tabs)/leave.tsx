import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LeaveScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leave Management</Text>
        <Text style={styles.subtitle}>Apply and track your leave</Text>
      </View>

      {/* Leave Balance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Leave Balance</Text>
        <View style={styles.balanceGrid}>
          {[
            { type: 'Casual Leave', available: 8, total: 12 },
            { type: 'Sick Leave', available: 10, total: 12 },
            { type: 'Earned Leave', available: 15, total: 18 },
          ].map((leave, i) => (
            <View key={i} style={styles.balanceCard}>
              <Text style={styles.balanceType}>{leave.type}</Text>
              <Text style={styles.balanceValue}>
                {leave.available}/{leave.total}
              </Text>
              <Text style={styles.balanceLabel}>days available</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Apply Leave Button */}
      <TouchableOpacity style={styles.applyButton}>
        <MaterialCommunityIcons name="plus-circle" size={24} color="white" />
        <Text style={styles.applyButtonText}>Apply for Leave</Text>
      </TouchableOpacity>

      {/* Leave History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Applications</Text>
        {[
          { dates: 'Nov 12, 2024', type: 'Casual Leave', status: 'Approved', days: 1 },
          { dates: 'Nov 05 - 06, 2024', type: 'Sick Leave', status: 'Pending', days: 2 },
          { dates: 'Oct 20, 2024', type: 'Casual Leave', status: 'Approved', days: 1 },
        ].map((application, i) => (
          <View key={i} style={styles.applicationCard}>
            <View style={styles.applicationHeader}>
              <Text style={styles.applicationDates}>{application.dates}</Text>
              <View style={[
                styles.statusBadge,
                application.status === 'Approved' ? styles.statusApproved : styles.statusPending,
              ]}>
                <Text style={styles.statusText}>{application.status}</Text>
              </View>
            </View>
            <View style={styles.applicationDetails}>
              <Text style={styles.applicationType}>{application.type}</Text>
              <Text style={styles.applicationDays}>{application.days} day(s)</Text>
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
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#065f46',
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
});
