import { createHash } from 'crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

import { adoptBaselineIfNeeded, Queryable } from '../scripts/migrate';

describe('migrate baseline adoption', () => {
  let folder: string;
  const sql = 'CREATE TABLE "users" ("id" text);';

  beforeEach(() => {
    folder = mkdtempSync(path.join(os.tmpdir(), 'migrate-spec-'));
    mkdirSync(path.join(folder, 'meta'));
    writeFileSync(path.join(folder, '0000_baseline.sql'), sql);
    writeFileSync(
      path.join(folder, 'meta', '_journal.json'),
      JSON.stringify({
        version: '7',
        dialect: 'postgresql',
        entries: [{ idx: 0, version: '7', when: 1234, tag: '0000_baseline', breakpoints: true }],
      }),
    );
  });

  afterEach(() => rmSync(folder, { recursive: true, force: true }));

  function fakeClient(opts: { history: boolean; applied: number; users: boolean }) {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const client: Queryable = {
      query: async (text, params) => {
        calls.push({ sql: text, params });
        if (text.includes('to_regclass') && text.includes('__drizzle_migrations')) {
          return { rows: [{ name: opts.history ? 'x' : null }] };
        }
        if (text.includes('count(*)')) return { rows: [{ count: opts.applied }] };
        if (text.includes("'public.users'")) {
          return { rows: [{ name: opts.users ? 'users' : null }] };
        }
        return { rows: [] };
      },
    };
    return { client, calls };
  }

  it('records the baseline when users exists and history is empty', async () => {
    const { client, calls } = fakeClient({ history: false, applied: 0, users: true });
    expect(await adoptBaselineIfNeeded(client, folder, () => undefined)).toBe(true);
    const insert = calls.find((c) => c.sql.startsWith('insert into'));
    expect(insert.params).toEqual([createHash('sha256').update(sql).digest('hex'), 1234]);
  });

  it('does nothing on an empty database', async () => {
    const { client, calls } = fakeClient({ history: false, applied: 0, users: false });
    expect(await adoptBaselineIfNeeded(client, folder, () => undefined)).toBe(false);
    expect(calls.some((c) => c.sql.startsWith('insert into'))).toBe(false);
  });

  it('does nothing when history already exists', async () => {
    const { client, calls } = fakeClient({ history: true, applied: 1, users: true });
    expect(await adoptBaselineIfNeeded(client, folder, () => undefined)).toBe(false);
    expect(calls.some((c) => c.sql.startsWith('insert into'))).toBe(false);
  });
});
