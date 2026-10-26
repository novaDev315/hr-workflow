import { Alert, Platform } from 'react-native'
import { apolloClient } from './apollo-client'
import { useAuthSession } from './auth-session'
import { LOGOUT_MUTATION } from './queries'

const LOGOUT_TIMEOUT_MS = 4000

/**
 * Sign out: tell the backend (best effort, bounded), then forget the token
 * and every cached query so the next person on this device starts clean.
 */
export async function signOut(): Promise<void> {
  try {
    await Promise.race([
      apolloClient.mutate({ mutation: LOGOUT_MUTATION }),
      new Promise((resolve) => setTimeout(resolve, LOGOUT_TIMEOUT_MS)),
    ])
  } catch {
    // The local sign-out below still happens.
  }
  await useAuthSession.getState().clearSession()
  await apolloClient.clearStore().catch(() => undefined)
}

/** Confirmation that also works in the web preview, where Alert is a no-op. */
export function confirmAction(options: {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    const confirmFn = (globalThis as { confirm?: (message: string) => boolean }).confirm
    return Promise.resolve(confirmFn ? confirmFn(`${options.title}\n\n${options.message}`) : true)
  }
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: options.confirmLabel,
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  })
}
