import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --import tsx src/scripts/seed-admin.ts',
  },
  // Generation is offline; runtime config still requires DATABASE_URL via src/config/env.ts.
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/auth_api' },
});
