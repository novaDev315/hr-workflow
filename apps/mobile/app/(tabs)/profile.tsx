import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useEmployee } from '../../src/lib/use-employee'
import { useRefresh } from '../../src/lib/use-refresh'
import { confirmAction, signOut } from '../../src/lib/session-actions'
import { employeeStatusLabel, formatRoles, initials } from '../../src/lib/format'
import {
  Button,
  Card,
  DetailRow,
  ErrorState,
  ListItem,
  LoadingState,
  Screen,
  ScreenHeader,
  SectionTitle,
} from '../../src/components'
import { colors, fonts, radii, spacing, type } from '../../src/theme'

export default function ProfileScreen() {
  const router = useRouter()
  const { account, error, refetch } = useEmployee()
  const { refreshing, onRefresh } = useRefresh(refetch)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (signingOut) return
    const confirmed = await confirmAction({
      title: 'Sign out?',
      message: "You'll need your email and password to sign in again.",
      confirmLabel: 'Sign out',
      destructive: true,
    })
    if (!confirmed) return
    setSigningOut(true)
    try {
      await signOut()
      router.replace('/(auth)/login')
    } finally {
      setSigningOut(false)
    }
  }

  if (!account) {
    return (
      <Screen>
        <ScreenHeader title="Profile" />
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : <LoadingState />}
      </Screen>
    )
  }

  const role = [account.designationTitle, account.departmentName].filter(Boolean).join(' · ')

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title="Profile" />

      <View style={styles.identity}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.avatarText}>{initials(account.fullName)}</Text>
        </View>
        <View style={styles.identityText}>
          <Text style={styles.name}>{account.fullName}</Text>
          {role ? <Text style={styles.role}>{role}</Text> : null}
        </View>
      </View>

      <SectionTitle>Personal details</SectionTitle>
      <Card flush>
        <DetailRow label="Full name" value={account.fullName} />
        <DetailRow label="Work email" value={account.email} last />
      </Card>

      <SectionTitle>Job details</SectionTitle>
      <Card flush>
        <DetailRow label="Employee number" value={account.employeeNumber ?? 'Not linked yet'} />
        <DetailRow label="Job title" value={account.designationTitle ?? 'Not set'} />
        <DetailRow label="Department" value={account.departmentName ?? 'Not set'} />
        <DetailRow
          label="Employment status"
          value={account.employeeStatus ? employeeStatusLabel(account.employeeStatus) : 'Not set'}
        />
        <DetailRow label="Access" value={formatRoles(account.roles)} last />
      </Card>

      <SectionTitle>Company</SectionTitle>
      <Card flush>
        <ListItem
          icon="book-open-variant"
          title="Company policies"
          subtitle="Handbook, leave and workplace rules"
          onPress={() => router.navigate('/policies')}
          last
        />
      </Card>

      <Button
        label="Sign out"
        icon="logout"
        variant="destructive"
        loading={signingOut}
        loadingLabel="Signing out"
        onPress={handleSignOut}
        style={styles.signOut}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.accentAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.ink,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...type.title,
    // Arabic names would otherwise align to the right edge, away from the avatar.
    textAlign: 'left',
  },
  role: {
    ...type.body,
    color: colors.muted,
  },
  signOut: {
    marginTop: spacing.md,
  },
})
