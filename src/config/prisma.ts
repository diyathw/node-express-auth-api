import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// Keep one client (and therefore one connection pool) for the application process.
export const prisma = new PrismaClient({ adapter });
