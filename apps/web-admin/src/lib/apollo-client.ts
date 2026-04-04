import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

function resolveGraphqlEndpoint(): string {
  if (import.meta.env.VITE_GRAPHQL_ENDPOINT) {
    return import.meta.env.VITE_GRAPHQL_ENDPOINT;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:4001/graphql';
  }

  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:4001/graphql';
  }

  return `${protocol}//${hostname}/graphql`;
}

const httpLink = new HttpLink({
  uri: resolveGraphqlEndpoint(),
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('auth_token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
