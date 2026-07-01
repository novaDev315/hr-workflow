import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as drizzleSchema from './drizzle/schema';
import { seedDatabase } from './seeds';

export type AppDrizzleDatabase = NodePgDatabase<typeof drizzleSchema>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  readonly drizzle: AppDrizzleDatabase = drizzle(this.pool, {
    schema: drizzleSchema,
  });

  async onModuleInit() {
    await this.drizzle.execute(sql`SELECT 1`);
    await this.ensureSeedData();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async ensureSeedData() {
    await seedDatabase(this.drizzle);
  }
}
