import { describe, expect, it } from '@jest/globals';
import type { CreateAccessEntity, Page } from '../../../src/domain/access-control.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../src/errors/app-error.js';
import type { AccessControlRepository } from '../../../src/repositories/access-control.repository.js';
import { AccessControlService } from '../../../src/services/access-control.service.js';

class InMemoryAccessControlRepository implements AccessControlRepository {
  readonly roles = new Map<string, string>([['role-admin', 'ADMIN'], ['role-user', 'USER']]);
  readonly permissions = new Map([
    ['permission-read', 'users:read'],
    ['permission-admins-manage', 'admins:manage'],
  ]);
  readonly users = new Set(['actor', 'target']);
  readonly groups = new Set(['group-engineering']);
  readonly adminGroups = new Set<string>();
  readonly actorPermissions = new Set<string>();
  readonly operations: string[] = [];

  async listUsers() { return this.emptyPage(); }
  async listRoles() { return this.emptyPage(); }
  async listPermissions() { return this.emptyPage(); }
  async listGroups() { return this.emptyPage(); }
  async listAuditLogs() { return this.emptyPage(); }
  async findRole(id: string) {
    const name = this.roles.get(id);
    return name ? { id, name, description: null, permissions: [] } : null;
  }
  async findGroup(id: string) {
    return this.groups.has(id) ? { id, name: 'Engineering', description: null, roles: [], users: [] } : null;
  }
  async createRole(_actorUserId: string, data: CreateAccessEntity) {
    return { id: 'created-role', name: data.name, description: data.description ?? null, permissions: [] };
  }
  async createGroup(_actorUserId: string, data: CreateAccessEntity) {
    return { id: 'created-group', name: data.name, description: data.description ?? null, roles: [], users: [] };
  }
  async roleExists(id: string) { return this.roles.has(id); }
  async roleName(id: string) { return this.roles.get(id) ?? null; }
  async permissionName(id: string) { return this.permissions.get(id) ?? null; }
  async groupExists(id: string) { return this.groups.has(id); }
  async groupHasRole(id: string, roleName: string) { return roleName === 'ADMIN' && this.adminGroups.has(id); }
  async userExists(id: string) { return this.users.has(id); }
  async userHasPermission(id: string, permissionName: string) {
    return id === 'actor' && this.actorPermissions.has(permissionName);
  }
  async assignPermissionToRole(actor: string, role: string, permission: string) {
    this.operations.push(`permission.assign:${actor}:${role}:${permission}`);
  }
  async removePermissionFromRole(actor: string, role: string, permission: string) {
    this.operations.push(`permission.remove:${actor}:${role}:${permission}`);
  }
  async assignRoleToUser(actor: string, user: string, role: string) {
    this.operations.push(`user.role.assign:${actor}:${user}:${role}`);
  }
  async removeRoleFromUser(actor: string, user: string, role: string) {
    this.operations.push(`user.role.remove:${actor}:${user}:${role}`);
  }
  async assignRoleToGroup(actor: string, group: string, role: string) {
    this.operations.push(`group.role.assign:${actor}:${group}:${role}`);
  }
  async removeRoleFromGroup(actor: string, group: string, role: string) {
    this.operations.push(`group.role.remove:${actor}:${group}:${role}`);
  }
  async addUserToGroup(actor: string, group: string, user: string) {
    this.operations.push(`group.user.add:${actor}:${group}:${user}`);
  }
  async removeUserFromGroup(actor: string, group: string, user: string) {
    this.operations.push(`group.user.remove:${actor}:${group}:${user}`);
  }

  private emptyPage(): Page<never> {
    return { data: [], pagination: { nextCursor: null, hasMore: false } };
  }
}

describe('AccessControlService', () => {
  const setup = () => {
    const repository = new InMemoryAccessControlRepository();
    return { repository, service: new AccessControlService(repository) };
  };

  it('prevents replacement of reserved system roles', () => {
    const { service } = setup();
    expect(() => service.createRole('actor', { name: 'admin' })).toThrow(BadRequestError);
  });

  it('prevents removal of the built-in USER assignment', async () => {
    const { repository, service } = setup();

    await expect(service.removeRoleFromUser('actor', 'target', 'role-user')).rejects.toBeInstanceOf(BadRequestError);
    expect(repository.operations).toEqual([]);
  });

  it('requires both relationship targets to exist', async () => {
    const { service } = setup();

    await expect(service.assignRoleToUser('actor', 'missing', 'role-user')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('passes the authenticated actor into audited mutations', async () => {
    const { repository, service } = setup();

    await service.assignPermissionToRole('actor', 'role-user', 'permission-read');

    expect(repository.operations).toEqual(['permission.assign:actor:role-user:permission-read']);
  });

  it('rejects direct ADMIN assignment without admins:manage', async () => {
    const { repository, service } = setup();

    await expect(service.assignRoleToUser('actor', 'target', 'role-admin')).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.operations).toEqual([]);
  });

  it('allows direct ADMIN assignment with admins:manage', async () => {
    const { repository, service } = setup();
    repository.actorPermissions.add('admins:manage');

    await service.assignRoleToUser('actor', 'target', 'role-admin');

    expect(repository.operations).toEqual(['user.role.assign:actor:target:role-admin']);
  });

  it('rejects direct ADMIN removal without admins:manage', async () => {
    const { repository, service } = setup();

    await expect(service.removeRoleFromUser('actor', 'target', 'role-admin')).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.operations).toEqual([]);
  });

  it('rejects assigning ADMIN to a group without admins:manage', async () => {
    const { repository, service } = setup();

    await expect(service.assignRoleToGroup('actor', 'group-engineering', 'role-admin')).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.operations).toEqual([]);
  });

  it('rejects membership changes for an ADMIN-bearing group without admins:manage', async () => {
    const { repository, service } = setup();
    repository.adminGroups.add('group-engineering');

    await expect(service.addUserToGroup('actor', 'group-engineering', 'target')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.removeUserFromGroup('actor', 'group-engineering', 'target')).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.operations).toEqual([]);
  });

  it('rejects granting admins:manage without already holding it', async () => {
    const { repository, service } = setup();

    await expect(
      service.assignPermissionToRole('actor', 'role-user', 'permission-admins-manage'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.operations).toEqual([]);
  });
});
