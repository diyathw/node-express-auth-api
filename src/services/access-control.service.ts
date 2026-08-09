import type { AuditLogQuery, CreateAccessEntity, PageQuery } from '../domain/access-control.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/app-error.js';
import type { AccessControlRepository } from '../repositories/access-control.repository.js';

export class AccessControlService {
  constructor(private readonly access: AccessControlRepository) {}

  listUsers(query: PageQuery) { return this.access.listUsers(query); }
  listRoles(query: PageQuery) { return this.access.listRoles(query); }
  listPermissions(query: PageQuery) { return this.access.listPermissions(query); }
  listGroups(query: PageQuery) { return this.access.listGroups(query); }
  listAuditLogs(query: AuditLogQuery) { return this.access.listAuditLogs(query); }
  async getRole(id: string) {
    const role = await this.access.findRole(id);
    if (!role) throw new NotFoundError('Role not found');
    return role;
  }
  async getGroup(id: string) {
    const group = await this.access.findGroup(id);
    if (!group) throw new NotFoundError('Group not found');
    return group;
  }
  createRole(actorUserId: string, data: CreateAccessEntity) {
    if (['ADMIN', 'USER'].includes(data.name.toUpperCase())) {
      throw new BadRequestError('ADMIN and USER are reserved system roles');
    }
    return this.access.createRole(actorUserId, { ...data, name: data.name.toUpperCase() });
  }
  createGroup(actorUserId: string, data: CreateAccessEntity) { return this.access.createGroup(actorUserId, data); }

  async assignPermissionToRole(actorUserId: string, roleId: string, permissionId: string): Promise<void> {
    await this.requireRole(roleId);
    const permissionName = await this.requirePermission(permissionId);
    if (permissionName === 'admins:manage') await this.requireAdminManagement(actorUserId);
    await this.access.assignPermissionToRole(actorUserId, roleId, permissionId);
  }

  async removePermissionFromRole(actorUserId: string, roleId: string, permissionId: string): Promise<void> {
    const roleName = await this.requireRole(roleId);
    if (roleName === 'ADMIN') throw new BadRequestError('The built-in ADMIN permissions cannot be removed');
    const permissionName = await this.requirePermission(permissionId);
    if (permissionName === 'admins:manage') await this.requireAdminManagement(actorUserId);
    await this.access.removePermissionFromRole(actorUserId, roleId, permissionId);
  }

  async assignRoleToUser(actorUserId: string, userId: string, roleId: string): Promise<void> {
    const [, roleName] = await Promise.all([this.requireUser(userId), this.requireRole(roleId)]);
    if (roleName === 'ADMIN') await this.requireAdminManagement(actorUserId);
    await this.access.assignRoleToUser(actorUserId, userId, roleId);
  }

  async removeRoleFromUser(actorUserId: string, userId: string, roleId: string): Promise<void> {
    const [, roleName] = await Promise.all([this.requireUser(userId), this.requireRole(roleId)]);
    if (roleName === 'USER') throw new BadRequestError('The built-in USER role cannot be removed from an account');
    if (roleName === 'ADMIN') await this.requireAdminManagement(actorUserId);
    await this.access.removeRoleFromUser(actorUserId, userId, roleId);
  }

  async assignRoleToGroup(actorUserId: string, groupId: string, roleId: string): Promise<void> {
    const [, roleName] = await Promise.all([this.requireGroup(groupId), this.requireRole(roleId)]);
    if (roleName === 'ADMIN') await this.requireAdminManagement(actorUserId);
    await this.access.assignRoleToGroup(actorUserId, groupId, roleId);
  }

  async removeRoleFromGroup(actorUserId: string, groupId: string, roleId: string): Promise<void> {
    const [, roleName] = await Promise.all([this.requireGroup(groupId), this.requireRole(roleId)]);
    if (roleName === 'ADMIN') await this.requireAdminManagement(actorUserId);
    await this.access.removeRoleFromGroup(actorUserId, groupId, roleId);
  }

  async addUserToGroup(actorUserId: string, groupId: string, userId: string): Promise<void> {
    await Promise.all([this.requireGroup(groupId), this.requireUser(userId)]);
    if (await this.access.groupHasRole(groupId, 'ADMIN')) await this.requireAdminManagement(actorUserId);
    await this.access.addUserToGroup(actorUserId, groupId, userId);
  }

  async removeUserFromGroup(actorUserId: string, groupId: string, userId: string): Promise<void> {
    await Promise.all([this.requireGroup(groupId), this.requireUser(userId)]);
    if (await this.access.groupHasRole(groupId, 'ADMIN')) await this.requireAdminManagement(actorUserId);
    await this.access.removeUserFromGroup(actorUserId, groupId, userId);
  }

  private async requireRole(id: string): Promise<string> {
    const name = await this.access.roleName(id);
    if (!name) throw new NotFoundError('Role not found');
    return name;
  }

  private async requirePermission(id: string): Promise<string> {
    const name = await this.access.permissionName(id);
    if (!name) throw new NotFoundError('Permission not found');
    return name;
  }

  private async requireGroup(id: string): Promise<void> {
    if (!(await this.access.groupExists(id))) throw new NotFoundError('Group not found');
  }

  private async requireUser(id: string): Promise<void> {
    if (!(await this.access.userExists(id))) throw new NotFoundError('User not found');
  }

  private async requireAdminManagement(actorUserId: string): Promise<void> {
    if (!(await this.access.userHasPermission(actorUserId, 'admins:manage'))) {
      throw new ForbiddenError('The admins:manage permission is required to change effective ADMIN access');
    }
  }
}
