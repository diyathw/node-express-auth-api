import { afterEach, describe, expect, it } from '@jest/globals';
import express, { type Express } from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { requestContext } from '../../../src/middleware/request-context.middleware.js';
import { SystemRouter } from '../../../src/routes/system.router.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

const request = async (app: Express, path: string): Promise<Response> => {
  const server = createServer(app).listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}${path}`);
};

describe('SystemRouter', () => {
  it('reports liveness without checking dependencies', async () => {
    const app = express();
    app.use(requestContext);
    app.use('/health', new SystemRouter(async () => { throw new Error('database unavailable'); }).router);

    const response = await request(app, '/health/live');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('reports readiness when dependencies respond', async () => {
    const app = express();
    app.use(requestContext);
    app.use('/health', new SystemRouter(async () => undefined).router);

    const response = await request(app, '/health/ready');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ready' });
  });

  it('reports readiness failure as a traceable problem document', async () => {
    const app = express();
    app.use(requestContext);
    app.use('/health', new SystemRouter(async () => { throw new Error('database unavailable'); }).router);

    const response = await request(app, '/health/ready');
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' });
    expect(body.traceId).toBe(response.headers.get('x-request-id'));
  });
});
