import { useRef, useState } from 'react'
import { gql, useMutation } from '@apollo/client'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useAuthSession } from '../../src/lib/auth-session'
import { apolloClient } from '../../src/lib/apollo-client'
import { friendlyErrorMessage } from '../../src/lib/errors'
import { Button, Card, Notice } from '../../src/components'
import { colors, fontSizes, fonts, radii, spacing, touchTarget, type } from '../../src/theme'

const LOGIN_MUTATION = gql`
  mutation MobileLogin($input: LoginInput!) {
    login(input: $input) {
      accessToken
      account {
        id
        email
        firstName
        lastName
        fullName
        isActive
        roles
        employeeId
        employeeNumber
        departmentName
        designationTitle
        employeeStatus
      }
    }
  }
`

export default function LoginScreen() {
  const router = useRouter()
  const saveSession = useAuthSession((state) => state.setSession)
  const notice = useAuthSession((state) => state.notice)
  const dismissNotice = useAuthSession((state) => state.dismissNotice)
  const lastEmail = useAuthSession((state) => state.lastEmail)
  const [email, setEmail] = useState(lastEmail ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const passwordRef = useRef<TextInput>(null)
  const [login, { loading }] = useMutation(LOGIN_MUTATION)

  const handleLogin = async () => {
    if (loading) return
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setFormError(!trimmedEmail ? 'Enter your work email.' : 'Enter your password.')
      if (trimmedEmail) passwordRef.current?.focus()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Enter your full work email, for example name@company.com.')
      return
    }
    // Every account password has at least 8 characters, so a shorter one can't match.
    if (password.length < 8) {
      setFormError("That email and password don't match. Check them and try again.")
      return
    }

    setFormError(null)
    try {
      const result = await login({
        variables: { input: { email: trimmedEmail.toLowerCase(), password } },
      })

      const payload = result.data?.login
      if (!payload) {
        throw new Error("We couldn't sign you in. Please try again.")
      }

      // Drop anything cached for a previous account on this device.
      await apolloClient.clearStore().catch(() => undefined)
      await saveSession({ token: payload.accessToken, account: payload.account })
      router.replace('/(tabs)')
    } catch (error) {
      setFormError(friendlyErrorMessage(error, "We couldn't sign you in. Please try again."))
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.markText}>H</Text>
            </View>
            <Text style={styles.title} accessibilityRole="header">
              HRFlow Pro
            </Text>
            <Text style={styles.subtitle}>
              Clock in, request leave and find your payslips.
            </Text>
          </View>

          {notice ? <Notice message={notice} tone="info" onDismiss={dismissNotice} /> : null}

          <Card style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label} nativeID="email-label">
                Work email
              </Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(text) => {
                  setEmail(text)
                  if (formError) setFormError(null)
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="name@company.com"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Work email"
                accessibilityLabelledBy="email-label"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label} nativeID="password-label">
                Password
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text)
                    if (formError) setFormError(null)
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Password"
                  accessibilityLabelledBy="password-label"
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  style={({ pressed }) => [styles.reveal, pressed && styles.revealPressed]}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.muted}
                  />
                </Pressable>
              </View>
            </View>

            {formError ? <Notice message={formError} tone="danger" /> : null}

            <Button
              label="Sign in"
              loadingLabel="Signing in"
              loading={loading}
              onPress={handleLogin}
            />
          </Card>

          <Text style={styles.footnote}>
            Trouble signing in? Ask your HR team to reset your account.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.accentStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  markText: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.onAccent,
  },
  title: {
    ...type.display,
    textAlign: 'center',
  },
  subtitle: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
  },
  card: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...type.label,
    color: colors.ink,
  },
  input: {
    minHeight: Math.max(touchTarget, 48),
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.body,
    fontFamily: fonts.sans,
    color: colors.ink,
  },
  passwordRow: {
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: touchTarget + spacing.xs,
  },
  reveal: {
    position: 'absolute',
    right: spacing.xs,
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  footnote: {
    ...type.caption,
    textAlign: 'center',
  },
})
