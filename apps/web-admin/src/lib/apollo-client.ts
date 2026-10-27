import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import {
  clearAdminSession,
  readAuthToken,
  registerSessionTeardown,
} from "./auth-session";

// Older builds persisted whichever endpoint answered first. That value is
// never trusted again; it is removed on startup.
const LEGACY_ACTIVE_ENDPOINT_STORAGE_KEY = "hrflow_active_graphql_endpoint";

const IS_DEV = Boolean(import.meta.env.DEV);

// Local fallbacks are only for `vite dev`. A production build talks to
// VITE_GRAPHQL_ENDPOINT (or same-origin /graphql) and nothing else.
const DEV_FALLBACK_ENDPOINTS: string[] = import.meta.env.DEV
  ? [
      "http://localhost:4001/graphql",
      "http://127.0.0.1:4001/graphql",
      "http://localhost:4000/graphql",
    ]
  : [];

function clearLegacyStoredEndpoint() {
  try {
    window.localStorage.removeItem(LEGACY_ACTIVE_ENDPOINT_STORAGE_KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}

if (typeof window !== "undefined") {
  clearLegacyStoredEndpoint();
}

function normalizeGraphqlEndpoint(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (typeof window === "undefined") {
    return trimmedValue;
  }

  try {
    return new URL(trimmedValue, window.location.origin).toString();
  } catch {
    return trimmedValue;
  }
}

export function getGraphqlEndpointCandidates() {
  const candidates = [
    import.meta.env.VITE_GRAPHQL_ENDPOINT,
    typeof window === "undefined" ? null : "/graphql",
    ...(IS_DEV ? DEV_FALLBACK_ENDPOINTS : []),
  ]
    .map((candidate) => normalizeGraphqlEndpoint(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));

  return [...new Set(candidates)];
}

// In dev, remember (in memory only) which local endpoint answered so we stop
// probing dead ports on every request. Never persisted.
let devActiveEndpoint: string | null = null;

export function getActiveGraphqlEndpoint() {
  return (IS_DEV ? devActiveEndpoint : null) ?? getGraphqlEndpointCandidates()[0];
}

function getGraphqlAttemptOrder() {
  if (!IS_DEV) {
    return [getGraphqlEndpointCandidates()[0]].filter(Boolean) as string[];
  }

  return [devActiveEndpoint, ...getGraphqlEndpointCandidates()].filter(
    (candidate, index, values): candidate is string =>
      Boolean(candidate) && values.indexOf(candidate) === index,
  );
}

function isTransientGraphqlResponse(status: number) {
  return [404, 502, 503, 504].includes(status);
}

function isRetryableGraphqlRequest(options?: RequestInit) {
  const method = options?.method?.toUpperCase() ?? "POST";

  if (method === "GET") {
    return true;
  }

  if (typeof options?.body !== "string") {
    return false;
  }

  try {
    const parsedBody = JSON.parse(options.body) as { query?: string };
    return !parsedBody.query?.trimStart().startsWith("mutation");
  } catch {
    return false;
  }
}

async function devFailoverGraphqlFetch(
  _uri: RequestInfo | URL,
  options?: RequestInit,
) {
  let lastError: unknown = null;
  const canRetryRequest = isRetryableGraphqlRequest(options);

  for (const endpoint of getGraphqlAttemptOrder()) {
    try {
      const response = await fetch(endpoint, options);

      if (isTransientGraphqlResponse(response.status)) {
        if (!canRetryRequest) {
          return response;
        }

        lastError = new Error(
          `GraphQL endpoint ${endpoint} responded with ${response.status}`,
        );
        continue;
      }

      devActiveEndpoint = endpoint;
      return response;
    } catch (error) {
      if (!canRetryRequest) {
        throw error;
      }

      lastError = error;
    }
  }

  throw (
    lastError ?? new Error("Unable to reach any configured GraphQL endpoint")
  );
}

const authLink = setContext((_, { headers }) => {
  const token = typeof window === "undefined" ? null : readAuthToken();
  return {
    // Remembered so the error link can tell a stale token from the current one.
    authToken: token,
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  const currentToken = typeof window === "undefined" ? null : readAuthToken();
  // A request sent with an older token (before a password change or a new
  // sign-in) must not end the session that replaced it.
  const hasAuthToken =
    Boolean(currentToken) && operation.getContext().authToken === currentToken;
  const graphQlAuthFailure = (graphQLErrors ?? []).some((error) => {
    const code = error.extensions?.code;
    return (
      code === "UNAUTHENTICATED" || /unauthorized|jwt/i.test(error.message)
    );
  });

  const networkStatus =
    typeof networkError === "object" &&
    networkError !== null &&
    "statusCode" in networkError
      ? Number(networkError.statusCode)
      : null;

  if (!hasAuthToken || (!graphQlAuthFailure && networkStatus !== 401)) {
    return;
  }

  // The server already rejected this token; just clear local state.
  void clearAdminSession({ serverLogout: false });

  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
});

const httpLink = new HttpLink({
  uri: () => getActiveGraphqlEndpoint() ?? "/graphql",
  ...(IS_DEV ? { fetch: devFailoverGraphqlFetch } : {}),
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      // Non-normalized report objects: merge instead of replace so separate
      // queries for optional fields don't wipe each other.
      ReportsDashboardType: { merge: true },
      ReportsOverviewType: { merge: true },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
  },
});

const LOGOUT_MUTATION = "mutation Logout { logout }";

// Revoke the server session with the token we had (sent directly, so it does
// not pass through the error link), then drop every cached query result.
registerSessionTeardown((token) => {
  if (token) {
    const endpoint = getActiveGraphqlEndpoint();
    if (endpoint) {
      void fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: LOGOUT_MUTATION }),
        keepalive: true,
      }).catch(() => undefined);
    }
  }

  return apolloClient.clearStore().catch(() => undefined);
});
