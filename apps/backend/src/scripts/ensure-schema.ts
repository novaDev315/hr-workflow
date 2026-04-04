import 'reflect-metadata';
import { PrismaService } from '../prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();

  try {
    await prisma.onModuleInit();
    console.log('Database schema verified successfully.');
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((error) => {
  console.error('Database schema verification failed.');
  console.error(error);
  process.exit(1);
});
