import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('[Database] Connected to SQLite/Postgres via Prisma successfully');
  } catch (err: any) {
    console.error('[Database] Connection failed:', err.message);
  }
}
