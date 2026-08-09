import { Application } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

const server = new Application().app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  console.log(`Scalar API reference: http://localhost:${env.PORT}/docs`);
  console.log(`ReDoc API reference: http://localhost:${env.PORT}/redoc`);
});

const shutdown = (signal: string): void => {
  console.log(`${signal} received; shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
