import { useState } from 'react'
import { gql, useMutation } from '@apollo/client'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthSession } from '../../src/lib/auth-session'

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [login, { loading }] = useMutation(LOGIN_MUTATION)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password')
      return
    }

    try {
      const result = await login({
        variables: {
          input: {
            email: email.trim().toLowerCase(),
            password,
          },
        },
      })

      const payload = result.data?.login
      if (!payload) {
        throw new Error('Login response was empty.')
      }

      await saveSession({
        token: payload.accessToken,
        account: payload.account,
      })

      router.replace('/(tabs)')
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Login failed. Please try again.'
      )
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>HRFlow Pro</Text>
        <Text style={styles.subtitle}>Mobile Portal</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e40af',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
