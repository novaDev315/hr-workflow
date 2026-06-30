import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { DATABASE_SCHEMA_STATEMENTS } from './schema';
import { DATABASE_SEED_STATEMENTS } from './seeds';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  async onModuleInit() {
    await this.pool.query('SELECT 1');
    await this.ensureSchema();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
    client?: PoolClient,
  ): Promise<QueryResult<T>> {
    return (client ?? this.pool).query<T>(text, values);
  }

  async one<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
    client?: PoolClient,
  ): Promise<T | null> {
    const result = await this.query<T>(text, values, client);
    return result.rows[0] ?? null;
  }

  async many<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
    client?: PoolClient,
  ): Promise<T[]> {
    const result = await this.query<T>(text, values, client);
    return result.rows;
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureSchema() {
    await this.runStatements(DATABASE_SCHEMA_STATEMENTS);
    await this.runStatements(DATABASE_SEED_STATEMENTS);
  }

  private async runStatements(statements: string[]) {
    for (const statement of statements) {
      await this.pool.query(statement);
    }
  }
}
