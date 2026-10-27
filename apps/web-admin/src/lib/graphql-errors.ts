// Turn Apollo / network / thrown errors into one calm, human sentence.
// The server sends readable validation messages in errors[0].message; we show
// those as-is and hide transport noise ("Response not successful",
// "Bad Request Exception", raw status codes).

const NOISE_PATTERNS = [
  /^response not successful/i,
  /^bad request exception$/i,
  /^bad request$/i,
  /^internal server error$/i,
  /^failed to fetch$/i,
  /^networkerror/i,
  /^load failed$/i,
  /^unexpected token/i,
]

const NETWORK_MESSAGE =
  'We could not reach the server. Check your connection and try again.'

const RATE_LIMIT_MESSAGE =
  'Too many attempts in a short time. Please wait a minute and try again.'

type GraphqlErrorLike = {
  message?: string
  extensions?: Record<string, unknown> | null
}

type ApolloLikeError = {
  message?: string
  graphQLErrors?: ReadonlyArray<GraphqlErrorLike>
  networkError?: unknown
}

function isNoise(message: string) {
  const trimmed = message.trim()
  return !trimmed || NOISE_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function fromExtensions(error: GraphqlErrorLike): string | null {
  const extensions = error.extensions ?? {}
  const original = (extensions as { originalError?: { message?: unknown } }).originalError
  const originalMessage = original?.message

  if (Array.isArray(originalMessage)) {
    const joined = originalMessage.filter((part) => typeof part === 'string').join(' ')
    if (joined && !isNoise(joined)) return joined
  }
  if (typeof originalMessage === 'string' && !isNoise(originalMessage)) {
    return originalMessage
  }
  return null
}

function readNetworkError(networkError: unknown): string | null {
  if (!networkError || typeof networkError !== 'object') return null

  const statusCode =
    'statusCode' in networkError ? Number((networkError as { statusCode: unknown }).statusCode) : null

  if (statusCode === 429) return RATE_LIMIT_MESSAGE

  // A 4xx/5xx with a GraphQL body: prefer the server message inside it.
  const result = (networkError as { result?: unknown }).result
  if (result && typeof result === 'object') {
    const errors = (result as { errors?: GraphqlErrorLike[] }).errors
    const first = errors?.find((entry) => entry?.message && !isNoise(entry.message))
    if (first?.message) return first.message
    const fallback = errors?.map(fromExtensions).find(Boolean)
    if (fallback) return fallback
  }

  if (statusCode === 401) return 'Your session has ended. Please sign in again.'
  if (statusCode === 403) return 'You do not have access to this action.'
  if (statusCode && statusCode >= 500) {
    return 'The server had a problem completing this request. Please try again.'
  }

  const message = (networkError as { message?: unknown }).message
  if (typeof message === 'string' && !isNoise(message)) return message
  return NETWORK_MESSAGE
}

const CANCELLED_MESSAGE = 'The request was interrupted. Please try again.'

// Apollo cancels queries in flight when its cache is cleared (sign-in and
// sign-out). The cancellation is a ts-invariant error, wrapped as the network
// error, and in production builds its message is only a go.apollo.dev link.
export function isRequestCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const isInvariant = (value: unknown) =>
    typeof value === 'object' && value !== null && (value as { name?: unknown }).name === 'Invariant Violation'
  return isInvariant(error) || isInvariant((error as ApolloLikeError).networkError)
}

export function readableError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!error) return fallback
  if (typeof error === 'string') return isNoise(error) ? fallback : error
  if (isRequestCancelled(error)) return CANCELLED_MESSAGE

  const apolloError = error as ApolloLikeError

  for (const graphQlError of apolloError.graphQLErrors ?? []) {
    const code = graphQlError.extensions?.code
    if (code === 'TOO_MANY_REQUESTS' || /too many requests|throttl/i.test(graphQlError.message ?? '')) {
      return RATE_LIMIT_MESSAGE
    }
    if (graphQlError.message && !isNoise(graphQlError.message)) {
      return graphQlError.message
    }
    const extensionMessage = fromExtensions(graphQlError)
    if (extensionMessage) return extensionMessage
  }

  if (apolloError.networkError) {
    const networkMessage = readNetworkError(apolloError.networkError)
    if (networkMessage) return networkMessage
  }

  const message = apolloError.message
  if (typeof message === 'string') {
    if (/too many requests|throttl/i.test(message)) return RATE_LIMIT_MESSAGE
    if (/failed to fetch|networkerror|load failed/i.test(message)) return NETWORK_MESSAGE
    if (!isNoise(message)) return message
  }

  return fallback
}

// True when the server rejected a query because a field does not exist yet
// (older backend). Pages use this to fall back quietly instead of erroring.
export function isSchemaMismatch(error: unknown): boolean {
  const apolloError = error as ApolloLikeError | null
  if (!apolloError) return false
  const messages = [
    apolloError.message ?? '',
    ...(apolloError.graphQLErrors ?? []).map((entry) => entry.message ?? ''),
  ]
  const network = apolloError.networkError as { result?: { errors?: GraphqlErrorLike[] } } | undefined
  for (const entry of network?.result?.errors ?? []) messages.push(entry.message ?? '')
  return messages.some((message) => /cannot query field|unknown argument|unknown type/i.test(message))
}
