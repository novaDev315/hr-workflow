import { Stack } from 'expo-router';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '../src/lib/apollo-client';

export default function RootLayout() {
  return (
    <ApolloProvider client={apolloClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ApolloProvider>
  );
}
