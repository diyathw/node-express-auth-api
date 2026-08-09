import { describe, expect, it } from '@jest/globals';
import { openapi } from '../../../src/config/openapi.js';

describe('OpenAPI route contract', () => {
  it('documents production routes and omits diagnostic examples', () => {
    expect(openapi.paths).toHaveProperty('/health/live');
    expect(openapi.paths).toHaveProperty('/health/ready');
    expect(openapi.paths).toHaveProperty('/roles/{roleId}');
    expect(openapi.paths).toHaveProperty('/groups/{groupId}');
    expect(Object.keys(openapi.paths).some((path) => path.startsWith('/admin'))).toBe(false);
    expect(openapi.paths).not.toHaveProperty('/auth0/admin');
  });

  it('publishes reusable problem and pagination contracts', () => {
    expect(openapi.components.schemas).toHaveProperty('Problem');
    expect(openapi.components.schemas).toHaveProperty('Pagination');
    expect(openapi.paths['/users'].get.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'limit', in: 'query' }),
      expect.objectContaining({ name: 'cursor', in: 'query' }),
    ]));
  });

  it('documents the additional administrator delegation permission', () => {
    expect(openapi.paths['/users/{userId}/roles/{roleId}'].put['x-additional-permission']).toBe('admins:manage when changing ADMIN access');
    expect(openapi.paths['/groups/{groupId}/users/{userId}'].delete['x-additional-permission']).toBe('admins:manage when the group has ADMIN');
  });
});
