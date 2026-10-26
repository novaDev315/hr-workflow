import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { useAuthSession } from './auth-session'

const PRODUCTION_ENDPOINT = 'https://api.hrflow.lab.novadev.tech/graphql'
const DEVELOPMENT_ENDPOINT = 'http://localhost:4001/graphql'

export const GRAPHQL_ENDPOINT =
  process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT?.trim() ||
  (__DEV__ ? DEVELOPMENT_ENDPOINT : PRODUCTION_ENDPOINT)

export const SESSION_ENDED_NOTICE = 'Your session ended. Please sign in again.'

const httpLink = new HttpLink({ uri: GRAPHQL_ENDPOINT })

const authLink = setContext((_, { headers }) => {
  const token = useAuthSession.getState().token
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }
})

let sessionEnding = false

/**
 * A rejected token (expired, revoked, or signed by an old secret) ends the
 * session: clear the token and cached data, and let the root layout route to
 * the sign-in screen with a calm notice. Requests without a token (sign-in
 * with a wrong password) are left alone so their own message is shown.
 */
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  const sentToken = Boolean(operation.getContext().headers?.authorization)
  if (!sentToken || sessionEnding) return

  const unauthenticated =
    graphQLErrors?.some(
      (error) =>
        error.extensions?.code === 'UNAUTHENTICATED' ||
        /^unauthori[sz]ed$/i.test(error.message.trim()),
    ) ||
    (networkError && 'statusCode' in networkError && networkError.statusCode === 401)

  if (!unauthenticated) return

  sessionEnding = true
  void useAuthSession
    .getState()
    .clearSession(SESSION_ENDED_NOTICE)
    .then(() => apolloClient.clearStore())
    .catch(() => undefined)
    .finally(() => {
      sessionEnding = false
    })
})

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      // Balances have no id; key them by leave type so the balance query and
      // the separate pendingDays query merge instead of overwriting each other.
      LeaveBalanceType: { keyFields: ['leaveTypeId'] },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
      notifyOnNetworkStatusChange: true,
    },
  },
})
