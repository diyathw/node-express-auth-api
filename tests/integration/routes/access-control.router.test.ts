import { afterEach, describe, expect, it } from '@jest/globals';
import express, { type Express, type RequestHandler } from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AccessControlController } from '../../../src/controllers/access-control.controller.js';
import { localeMiddleware } from '../../../src/i18n/locale.js';
import type { AuthMiddleware } from '../../../src/middleware/auth.middleware.js';
import { noStore, requestContext } from '../../../src/middleware/request-context.middleware.js';
import { AccessControlRouter } from '../../../src/routes/access-control.router.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

const request = async (app: Express, path: string, init?: RequestInit): Promise<Response> => {
  const server = createServer(app).listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}${path}`, init);
};

describe('AccessControlRouter', () => {
  const setup = () => {
    let permissionChecks = 0;
    const pass: RequestHandler = (_req, res) => { res.status(204).end(); };
    const controller = {
      listUsers: ((_req, res) => res.json(res.locals.input)) as RequestHandler,
      listRoles: pass,
      listPermissions: pass,
      listGroups: pass,
      listAuditLogs: pass,
      getRole: pass,
      getGroup: pass,
      createRole: pass,
      createGroup: pass,
      assignPermissionToRole: pass,
      removePermissionFromRole: pass,
      assignRoleToUser: pass,
      removeRoleFromUser: pass,
      assignRoleToGroup: pass,
      removeRoleFromGroup: pass,
      addUserToGroup: pass,
      removeUserFromGroup: pass,
    } as unknown as AccessControlController;
    const auth = {
      requireAuth: ((_req, _res, next) => next()) as RequestHandler,
      requirePermission: () => ((_req, _res, next) => {
        permissionChecks += 1;
        next();
      }) as RequestHandler,
    } as unknown as AuthMiddleware;
    const app = express();
    app.use(requestContext, localeMiddleware);
    app.use('/api/v1', new AccessControlRouter(controller, auth).router);
    return { app, permissionChecks: () => permissionChecks };
  };

  it('coerces and supplies bounded cursor pagination input', async () => {
    const { app, permissionChecks } = setup();
    const response = await request(app, '/api/v1/users?limit=10');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ query: { limit: 10 } });
    expect(permissionChecks()).toBe(1);
  });

  it('rejects invalid pagination before performing a permission lookup', async () => {
    const { app, permissionChecks } = setup();
    const response = await request(app, '/api/v1/users?limit=101', {
      headers: { 'X-Request-ID': 'route-test-123' },
    });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(response.headers.get('x-request-id')).toBe('route-test-123');
    expect(body).toMatchObject({ code: 'VALIDATION_ERROR', status: 400, traceId: 'route-test-123' });
    expect(permissionChecks()).toBe(0);
  });

  it('rejects malformed relationship UUIDs before authorization', async () => {
    const { app, permissionChecks } = setup();
    const response = await request(app, '/api/v1/users/not-a-uuid/roles/not-a-uuid', { method: 'PUT' });

    expect(response.status).toBe(400);
    expect(permissionChecks()).toBe(0);
  });

  it('prevents sensitive responses from being cached', async () => {
    const app = express();
    app.get('/sensitive', noStore, (_req, res) => res.json({ status: 'ok' }));

    const response = await request(app, '/sensitive');

    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });
});
