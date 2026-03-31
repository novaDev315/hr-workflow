import { gql, useQuery } from '@apollo/client'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuthSession } from '../../src/lib/auth-session'

const ME_QUERY = gql`
  query MobileProfileMe {
    me {
      id
      email
      firstName
      lastName
      fullName
      roles
      employeeNumber
      departmentName
      designationTitle
      employeeStatus
    }
  }
`

const personalInfoIcons: Array<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  label: string
  value: string
}> = [
  { icon: 'email', label: 'Email', value: '' },
  { icon: 'briefcase', label: 'Designation', value: '' },
  { icon: 'badge-account', label: 'Roles', value: '' },
  { icon: 'clock-outline', label: 'Employee Status', value: '' },
]

const settingsIcons: Array<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  label: string
  value?: string
}> = [
  { icon: 'bell', label: 'Notifications', value: 'Enabled' },
  { icon: 'map-marker-radius', label: 'Department' },
  { icon: 'information', label: 'Employee Portal' },
]

export default function ProfileScreen() {
  const router = useRouter()
  const clearSession = useAuthSession((state) => state.clearSession)
  const storedUser = useAuthSession((state) => state.user)
  const { data } = useQuery(ME_QUERY)
  const user = data?.me ?? storedUser

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await clearSession()
            router.replace('/(auth)/login')
          },
        },
      ]
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.fullName ?? 'Employee')
              .split(' ')
              .slice(0, 2)
              .map((part: string) => part[0] ?? '')
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.fullName ?? 'Employee'}</Text>
        <Text style={styles.employeeId}>
          {user?.employeeNumber ?? 'No employee number'}
        </Text>
        <Text style={styles.department}>
          {user?.departmentName ?? 'No department assigned'}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          {personalInfoIcons
            .map((item) => ({
              ...item,
              value:
                item.label === 'Email'
                  ? user?.email ?? 'Not available'
                  : item.label === 'Designation'
                    ? user?.designationTitle ?? 'Not assigned'
                    : item.label === 'Roles'
                      ? (user?.roles ?? []).join(', ') || 'None'
                      : user?.employeeStatus ?? 'Unknown',
            }))
            .map((item, i) => (
            <View key={i} style={styles.infoRow}>
              <MaterialCommunityIcons name={item.icon} size={20} color="#6b7280" />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          {settingsIcons
            .map((item) => ({
              ...item,
              value:
                item.label === 'Department'
                  ? user?.departmentName ?? 'Unknown'
                  : item.value,
            }))
            .map((item, i) => (
            <TouchableOpacity key={i} style={styles.settingRow}>
              <MaterialCommunityIcons name={item.icon} size={20} color="#6b7280" />
              <Text style={styles.settingLabel}>{item.label}</Text>
              {item.value && (
                <Text style={styles.settingValue}>{item.value}</Text>
              )}
              <MaterialCommunityIcons name="chevron-right" size={20} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    paddingBottom: 40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  employeeId: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
    marginTop: 4,
  },
  department: {
    fontSize: 14,
    color: 'white',
    opacity: 0.8,
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
});
