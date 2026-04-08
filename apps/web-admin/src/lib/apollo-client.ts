import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import { clearAdminSession, readAuthToken } from "./auth-session";

const ACTIVE_GRAPHQL_ENDPOINT_STORAGE_KEY = "hrflow_active_graphql_endpoint";

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
    "http://localhost:4001/graphql",
    "http://127.0.0.1:4001/graphql",
    "http://localhost:4000/graphql",
  ]
    .map((candidate) => normalizeGraphqlEndpoint(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));

  return [...new Set(candidates)];
}

function readStoredActiveGraphqlEndpoint() {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeGraphqlEndpoint(
    window.localStorage.getItem(ACTIVE_GRAPHQL_ENDPOINT_STORAGE_KEY),
  );
}

function persistActiveGraphqlEndpoint(endpoint: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_GRAPHQL_ENDPOINT_STORAGE_KEY, endpoint);
}

export function getActiveGraphqlEndpoint() {
  return readStoredActiveGraphqlEndpoint() ?? getGraphqlEndpointCandidates()[0];
}

function getGraphqlAttemptOrder(uri?: string) {
  const normalizedUri = normalizeGraphqlEndpoint(uri);
  const activeEndpoint = getActiveGraphqlEndpoint();
  const candidates = getGraphqlEndpointCandidates();

  return [normalizedUri, activeEndpoint, ...candidates].filter(
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

async function failoverGraphqlFetch(
  uri: RequestInfo | URL,
  options?: RequestInit,
) {
  const requestedUri =
    typeof uri === "string"
      ? uri
      : uri instanceof URL
        ? uri.toString()
        : uri.url;

  let lastError: unknown = null;
  const canRetryRequest = isRetryableGraphqlRequest(options);

  for (const endpoint of getGraphqlAttemptOrder(requestedUri)) {
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

      persistActiveGraphqlEndpoint(endpoint);
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
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  const hasAuthToken =
    typeof window !== "undefined" && Boolean(readAuthToken());
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

  clearAdminSession();

  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
});

const httpLink = new HttpLink({
  uri: () => getActiveGraphqlEndpoint() ?? "http://localhost:4001/graphql",
  fetch: failoverGraphqlFetch,
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
  },
});
