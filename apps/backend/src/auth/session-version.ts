import { eq, sql } from 'drizzle-orm';
import { users } from '../database/drizzle/schema';

/** Structural type so both the pooled database and a transaction work. */
interface UpdatableDatabase {
  update: (table: typeof users) => any;
}

/**
 * Revokes every outstanding access token of a user by incrementing the
 * session version that each token is checked against on every request.
 */
export async function bumpSessionVersion(db: UpdatableDatabase, userId: string) {
  await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: sql`NOW()` })
    .where(eq(users.id, userId));
}
