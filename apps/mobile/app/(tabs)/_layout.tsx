import { Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, fonts } from '../../src/theme'

type IconName = keyof typeof MaterialCommunityIcons.glyphMap

const tabIcon =
  (name: IconName) =>
  ({ color, size }: { color: string; size: number }) => (
    <MaterialCommunityIcons name={name} size={size} color={color} />
  )

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentStrong,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Web has no bottom inset, so give labels room for descenders.
          ...Platform.select({ web: { height: 60, paddingBottom: 6 }, default: {} }),
        },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarLabelStyle: {
          fontFamily: fonts.sans,
          fontSize: 11,
          lineHeight: 14,
          fontWeight: '500',
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('white-balance-sunny') }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarIcon: tabIcon('clock-outline') }} />
      <Tabs.Screen name="leave" options={{ title: 'Leave', tabBarIcon: tabIcon('calendar-blank-outline') }} />
      <Tabs.Screen name="payslips" options={{ title: 'Payslips', tabBarIcon: tabIcon('file-document-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('account-circle-outline') }} />
    </Tabs>
  )
}
