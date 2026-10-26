import { formatGraphQLError } from './graphql-errors';

describe('formatGraphQLError', () => {
  it('maps a 409 HttpException to CONFLICT and keeps the message', () => {
    const result = formatGraphQLError({
      message: 'Employee with this email already exists',
      extensions: { code: 'INTERNAL_SERVER_ERROR', status: 409 },
    });
    expect(result.message).toBe('Employee with this email already exists');
    expect(result.extensions).toEqual({ code: 'CONFLICT', status: 409 });
  });

  it('leaves every other error untouched', () => {
    const notFound = { message: 'x', extensions: { code: 'INTERNAL_SERVER_ERROR', status: 404 } };
    expect(formatGraphQLError(notFound)).toBe(notFound);
    const bare = { message: 'y' };
    expect(formatGraphQLError(bare)).toBe(bare);
  });
});
