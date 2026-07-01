import 'reflect-metadata';
import { DatabaseService } from '../database/database.service';

async function main() {
  const database = new DatabaseService();

  try {
    await database.onModuleInit();
    console.log('Database connection and seed data verified successfully.');
  } finally {
    await database.onModuleDestroy();
  }
}

main().catch((error) => {
  console.error('Database connection or seed verification failed.');
  console.error(error);
  process.exit(1);
});
