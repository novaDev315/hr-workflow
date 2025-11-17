import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClockAction = async () => {
    setLoading(true);

    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for attendance');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});

      // TODO: Call GraphQL mutation to clock in/out
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIsClockedIn(!isClockedIn);
      Alert.alert(
        'Success',
        `Successfully clocked ${isClockedIn ? 'out' : 'in'}!`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to process attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good Morning</Text>
        <Text style={styles.name}>John Doe</Text>
        <Text style={styles.employeeId}>EMP20240001</Text>
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
          {isClockedIn && (
            <Text style={styles.timeText}>Since 09:00 AM</Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.clockButton,
            isClockedIn ? styles.clockOutButton : styles.clockInButton,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleClockAction}
          disabled={loading}
        >
          <MaterialCommunityIcons
            name={isClockedIn ? 'logout' : 'login'}
            size={24}
            color="white"
          />
          <Text style={styles.clockButtonText}>
            {loading ? 'Processing...' : isClockedIn ? 'Clock Out' : 'Clock In'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>23</Text>
          <Text style={styles.statLabel}>Days Present</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>1.5</Text>
          <Text style={styles.statLabel}>Days Leave</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Leave Balance</Text>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {[
          { date: 'Today', action: 'Clocked in at 09:00 AM', icon: 'clock-in' },
          { date: 'Yesterday', action: 'Leave approved', icon: 'check-circle' },
          { date: '2 days ago', action: 'Payslip generated', icon: 'file-document' },
        ].map((item, i) => (
          <View key={i} style={styles.activityItem}>
            <MaterialCommunityIcons name={item.icon} size={24} color="#3b82f6" />
            <View style={styles.activityText}>
              <Text style={styles.activityAction}>{item.action}</Text>
              <Text style={styles.activityDate}>{item.date}</Text>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
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
});
