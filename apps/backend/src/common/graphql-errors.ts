import type { GraphQLFormattedError } from 'graphql';

/**
 * Nest's Apollo driver only maps 400/401/403/422 HttpExceptions to specific
 * GraphQL codes; everything else (including ConflictException, 409) surfaces as
 * INTERNAL_SERVER_ERROR with the status in `extensions.status`. A duplicate is a
 * client error, so report it as CONFLICT while keeping the readable message.
 */
export function formatGraphQLError(formattedError: GraphQLFormattedError) {
  const extensions = formattedError.extensions;
  if (extensions?.status === 409) {
    return { ...formattedError, extensions: { ...extensions, code: 'CONFLICT' } };
  }
  return formattedError;
}
