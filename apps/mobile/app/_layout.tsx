import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ApolloProvider } from '@apollo/client'
import { apolloClient } from '../src/lib/apollo-client'
import { useAuthSession } from '../src/lib/auth-session'
import { colors } from '../src/theme'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const isHydrated = useAuthSession((state) => state.isHydrated)
  const token = useAuthSession((state) => state.token)
  const hydrate = useAuthSession((state) => state.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    const inAuthGroup = segments[0] === '(auth)'

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login')
      return
    }

    if (token && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [isHydrated, router, segments, token])

  if (!isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.accentStrong} accessibilityLabel="Loading" />
      </View>
    )
  }

  return (
    <ApolloProvider client={apolloClient}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="request-leave" options={{ presentation: 'modal' }} />
        <Stack.Screen name="payslip/[id]" />
        <Stack.Screen name="policies/index" />
        <Stack.Screen name="policies/[id]" />
      </Stack>
    </ApolloProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
})
