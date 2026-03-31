import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { ApolloProvider } from '@apollo/client'
import { apolloClient } from '../src/lib/apollo-client'
import { useAuthSession } from '../src/lib/auth-session'

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
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    )
  }

  return (
    <ApolloProvider client={apolloClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ApolloProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
})
