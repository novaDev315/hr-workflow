import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async check() {
    await this.database.drizzle.execute(sql`SELECT 1`);

    return {
      status: 'ok',
      service: 'backend',
      timestamp: new Date().toISOString(),
    };
  }
}
