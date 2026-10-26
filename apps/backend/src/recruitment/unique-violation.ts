/**
 * Returns the Postgres unique-violation details (SQLSTATE 23505) when the
 * error, or one of its `cause`s (Drizzle wraps driver errors), is one.
 */
export function findUniqueViolation(
  error: unknown,
): { constraint: string } | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (candidate.code === '23505') {
      return {
        constraint: typeof candidate.constraint === 'string' ? candidate.constraint : '',
      };
    }
    current = candidate.cause;
  }

  return null;
}
