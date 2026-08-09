const json = (schema: object) => ({ content: { 'application/json': { schema } } });
const problem = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } },
});
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const paginationParameters = [
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
  { name: 'cursor', in: 'query', schema: { type: 'string', format: 'uuid' } },
] as const;

const securedErrors = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  429: { $ref: '#/components/responses/RateLimited' },
} as const;

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Express Auth API',
    version: '1.2.0',
    description: 'TypeScript authentication API with local JWTs, Auth0, database-backed RBAC, cursor pagination, localized problem responses, and audited access administration.',
  },
  servers: [{ url: '/api/v1', description: 'Version 1 API' }],
  tags: [{ name: 'Auth' }, { name: 'Access control' }, { name: 'System' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      auth0Bearer: {
        type: 'oauth2',
        description: 'Auth0 Universal Login access token issued for this API audience.',
        flows: {
          authorizationCode: {
            authorizationUrl: `https://${process.env.AUTH0_DOMAIN ?? 'YOUR_AUTH0_DOMAIN'}/authorize`,
            tokenUrl: `https://${process.env.AUTH0_DOMAIN ?? 'YOUR_AUTH0_DOMAIN'}/oauth/token`,
            scopes: { openid: 'Authenticate user', profile: 'Read basic identity' },
          },
        },
      },
    },
    responses: {
      BadRequest: problem('The request is invalid'),
      Unauthorized: problem('Authentication is required or invalid'),
      Forbidden: problem('The authenticated principal lacks permission'),
      NotFound: problem('The resource does not exist'),
      Conflict: problem('The request conflicts with existing state'),
      RateLimited: problem('The request rate limit was exceeded'),
      ServiceUnavailable: problem('The service is not ready'),
    },
    schemas: {
      Problem: {
        type: 'object',
        required: ['type', 'title', 'status', 'detail', 'code', 'traceId'],
        properties: {
          type: { type: 'string', example: 'about:blank' },
          title: { type: 'string', example: 'Bad Request' },
          status: { type: 'integer', example: 400 },
          detail: { type: 'string', example: 'The request is invalid' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          instance: { type: 'string', example: '/api/v1/users' },
          traceId: { type: 'string', example: '4a21f246-08e5-42ec-986d-83c891e7a71f' },
          errors: { type: 'array', items: { type: 'object', required: ['field', 'message'], properties: {
            field: { type: 'string' }, message: { type: 'string' },
          } } },
        },
      },
      Pagination: {
        type: 'object', required: ['nextCursor', 'hasMore'], properties: {
          nextCursor: { type: 'string', format: 'uuid', nullable: true },
          hasMore: { type: 'boolean' },
        },
      },
      Permission: { type: 'object', required: ['id', 'name'], properties: {
        id: { type: 'string', format: 'uuid' }, name: { type: 'string', example: 'users:read' },
        description: { type: 'string', nullable: true },
      } },
      Role: { type: 'object', required: ['id', 'name', 'permissions'], properties: {
        id: { type: 'string', format: 'uuid' }, name: { type: 'string', example: 'SUPPORT' },
        description: { type: 'string', nullable: true },
        permissions: { type: 'array', items: ref('Permission') },
      } },
      Group: { type: 'object', required: ['id', 'name', 'roles'], properties: {
        id: { type: 'string', format: 'uuid' }, name: { type: 'string', example: 'Engineering' },
        description: { type: 'string', nullable: true },
        roles: { type: 'array', items: ref('Role') },
        users: { type: 'array', items: ref('UserSummary') },
      } },
      UserSummary: { type: 'object', required: ['id', 'name', 'email'], properties: {
        id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, email: { type: 'string', format: 'email' },
      } },
      User: { type: 'object', required: ['id', 'name', 'email', 'createdAt', 'roles', 'groups', 'effectiveRoles', 'effectivePermissions'], properties: {
        id: { type: 'string', format: 'uuid' }, name: { type: 'string', example: 'Ada Lovelace' },
        email: { type: 'string', format: 'email', example: 'ada@example.com' },
        createdAt: { type: 'string', format: 'date-time' },
        roles: { type: 'array', items: ref('Role') }, groups: { type: 'array', items: ref('Group') },
        effectiveRoles: { type: 'array', items: ref('Role') }, effectivePermissions: { type: 'array', items: ref('Permission') },
      } },
      AccessUser: { allOf: [ref('UserSummary'), { type: 'object', required: ['roles', 'groups'], properties: {
        roles: { type: 'array', items: ref('Role') }, groups: { type: 'array', items: ref('Group') },
      } }] },
      AuditLog: { type: 'object', required: ['id', 'actor', 'action', 'targetType', 'targetId', 'createdAt'], properties: {
        id: { type: 'string', format: 'uuid' }, actor: ref('UserSummary'), action: { type: 'string' },
        targetType: { type: 'string' }, targetId: { type: 'string' }, metadata: {},
        createdAt: { type: 'string', format: 'date-time' },
      } },
      AuthResponse: { type: 'object', required: ['user', 'accessToken', 'tokenType', 'expiresIn'], properties: {
        user: ref('User'), accessToken: { type: 'string' }, tokenType: { type: 'string', enum: ['Bearer'] },
        expiresIn: { type: 'string', example: '1h' },
      } },
    },
  },
  paths: {
    '/health/live': { get: {
      servers: [{ url: '/' }], tags: ['System'], summary: 'Process liveness probe',
      responses: { 200: { description: 'Process is alive', ...json({ type: 'object', properties: { status: { type: 'string', enum: ['ok'] } } }) } },
    } },
    '/health/ready': { get: {
      servers: [{ url: '/' }], tags: ['System'], summary: 'Database readiness probe',
      responses: {
        200: { description: 'Service is ready', ...json({ type: 'object', properties: { status: { type: 'string', enum: ['ready'] } } }) },
        503: { $ref: '#/components/responses/ServiceUnavailable' },
      },
    } },
    '/locales': { get: {
      tags: ['System'], summary: 'List supported API locales',
      parameters: [{ name: 'lang', in: 'query', schema: { type: 'string', enum: ['en', 'fr', 'es'] } }],
      responses: { 200: { description: 'Locale configuration and current selection' }, 429: { $ref: '#/components/responses/RateLimited' } },
    } },
    '/auth/register': { post: {
      tags: ['Auth'], summary: 'Create an account', requestBody: authBody(true),
      responses: {
        201: authSuccess('Account created', true),
        400: { $ref: '#/components/responses/BadRequest' },
        409: { $ref: '#/components/responses/Conflict' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    } },
    '/auth/login': { post: {
      tags: ['Auth'], summary: 'Log in', requestBody: authBody(false),
      responses: {
        200: authSuccess('Authenticated'),
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
      },
    } },
    '/auth/me': { get: {
      tags: ['Auth'], summary: 'Get current user', security: [{ bearerAuth: [] }],
      responses: { 200: { description: 'Current user', ...json({ type: 'object', properties: { user: ref('User') } }) }, 401: { $ref: '#/components/responses/Unauthorized' }, 404: { $ref: '#/components/responses/NotFound' }, 429: { $ref: '#/components/responses/RateLimited' } },
    } },
    '/users': { get: listOperation('List users and access assignments', 'users:read', 'AccessUser') },
    '/users/{userId}/roles/{roleId}': relationshipPath('Assign a direct role to a user', 'Remove a direct role from a user', 'users:roles:manage', 'userId', 'roleId', 'admins:manage when changing ADMIN access'),
    '/permissions': { get: listOperation('List the code-managed permission catalog', 'roles:read', 'Permission') },
    '/roles': {
      get: listOperation('List roles and permissions', 'roles:read', 'Role'),
      post: createOperation('Create a role', 'roles:manage', 50, 'Role', '/api/v1/roles/{id}'),
    },
    '/roles/{roleId}': { get: detailOperation('Get a role', 'roles:read', 'Role', 'roleId') },
    '/roles/{roleId}/permissions/{permissionId}': relationshipPath('Assign a permission to a role', 'Remove a permission from a role', 'roles:manage', 'roleId', 'permissionId', 'admins:manage when delegating admins:manage'),
    '/groups': {
      get: listOperation('List groups, roles, and members', 'groups:read', 'Group'),
      post: createOperation('Create a group', 'groups:manage', 100, 'Group', '/api/v1/groups/{id}'),
    },
    '/groups/{groupId}': { get: detailOperation('Get a group', 'groups:read', 'Group', 'groupId') },
    '/groups/{groupId}/roles/{roleId}': relationshipPath('Assign a role to a group', 'Remove a role from a group', 'groups:manage', 'groupId', 'roleId', 'admins:manage when changing ADMIN access'),
    '/groups/{groupId}/users/{userId}': relationshipPath('Add a user to a group', 'Remove a user from a group', 'groups:manage', 'groupId', 'userId', 'admins:manage when the group has ADMIN'),
    '/audit-logs': { get: {
      ...listOperation('Search access-control audit records', 'audit:read', 'AuditLog'),
      parameters: [
        ...paginationParameters,
        { name: 'actorUserId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        { name: 'action', in: 'query', schema: { type: 'string', maxLength: 100 } },
        { name: 'targetType', in: 'query', schema: { type: 'string', maxLength: 50 } },
        { name: 'targetId', in: 'query', schema: { type: 'string', maxLength: 100 } },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
      ],
    } },
    '/auth0/me': { get: {
      tags: ['Auth'], summary: 'Read validated Auth0 identity claims', security: [{ auth0Bearer: ['openid', 'profile'] }],
      responses: { 200: { description: 'Validated Auth0 identity' }, 401: { $ref: '#/components/responses/Unauthorized' }, 429: { $ref: '#/components/responses/RateLimited' } },
    } },
  },
} as const;

function paginatedSchema(item: string) {
  return { type: 'object', required: ['data', 'pagination'], properties: {
    data: { type: 'array', items: ref(item) }, pagination: ref('Pagination'),
  } };
}

function listOperation(summary: string, permission: string, item: string) {
  return {
    tags: ['Access control'], summary, security: [{ bearerAuth: [] }], parameters: paginationParameters,
    responses: {
      200: { description: 'Cursor-paginated results', ...json(paginatedSchema(item)) },
      ...securedErrors,
    },
    'x-required-permission': permission,
  };
}

function accessPairParameters(first: string, second: string) {
  return [pathParameter(first), pathParameter(second)];
}

function pathParameter(name: string) {
  return { name, in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
}

function detailOperation(summary: string, permission: string, entity: string, parameter: string) {
  return {
    tags: ['Access control'], summary, security: [{ bearerAuth: [] }], parameters: [pathParameter(parameter)],
    responses: {
      200: { description: `${entity} details`, ...json({ type: 'object', properties: { [entity.toLowerCase()]: ref(entity) } }) },
      ...securedErrors,
      404: { $ref: '#/components/responses/NotFound' },
    },
    'x-required-permission': permission,
  };
}

function relationshipPath(
  putSummary: string,
  deleteSummary: string,
  permission: string,
  first: string,
  second: string,
  additionalPermission?: string,
) {
  const operation = (summary: string) => ({
    tags: ['Access control'], summary, security: [{ bearerAuth: [] }], parameters: accessPairParameters(first, second),
    responses: { 204: { description: 'Relationship updated' }, ...securedErrors, 404: { $ref: '#/components/responses/NotFound' } },
    'x-required-permission': permission,
    ...(additionalPermission ? { 'x-additional-permission': additionalPermission } : {}),
  });
  return { put: operation(putSummary), delete: operation(deleteSummary) };
}

function accessEntityBody(maxNameLength: number) {
  return { required: true, content: { 'application/json': { schema: {
    type: 'object', required: ['name'], additionalProperties: false, properties: {
      name: { type: 'string', minLength: 2, maxLength: maxNameLength },
      description: { type: 'string', minLength: 1, maxLength: 255 },
    },
  } } } };
}

function createOperation(summary: string, permission: string, maxNameLength: number, entity: string, locationExample: string) {
  return {
    tags: ['Access control'], summary, security: [{ bearerAuth: [] }], requestBody: accessEntityBody(maxNameLength),
    responses: {
      201: { description: `${entity} created`, headers: { Location: { schema: { type: 'string' }, example: locationExample } }, ...json({ type: 'object', properties: { [entity.toLowerCase()]: ref(entity) } }) },
      ...securedErrors,
      409: { $ref: '#/components/responses/Conflict' },
    },
    'x-required-permission': permission,
  };
}

function authBody(registration: boolean) {
  return { required: true, content: { 'application/json': { schema: {
    type: 'object', required: registration ? ['name', 'email', 'password'] : ['email', 'password'], additionalProperties: false,
    properties: {
      ...(registration ? { name: { type: 'string', minLength: 2, maxLength: 100 } } : {}),
      email: { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', format: 'password', minLength: registration ? 8 : 1, maxLength: 72 },
    },
  } } } };
}

function authSuccess(description: string, created = false) {
  return {
    description,
    headers: {
      ...(created ? { Location: { schema: { type: 'string' }, example: '/api/v1/auth/me' } } : {}),
      'Cache-Control': { schema: { type: 'string' }, example: 'no-store' },
      Pragma: { schema: { type: 'string' }, example: 'no-cache' },
    },
    ...json(ref('AuthResponse')),
  };
}
