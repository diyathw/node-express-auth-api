import type { AuditLogQuery, CreateAccessEntity, PageQuery } from '../domain/access-control.js';
import { prisma } from '../config/prisma.js';
import { BadRequestError, ConflictError } from '../errors/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import type { AccessControlRepository } from './access-control.repository.js';

export class PrismaAccessControlRepository implements AccessControlRepository {
  async listUsers(query: PageQuery) {
    const users = await prisma.user.findMany({
      orderBy: [{ email: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true, name: true, email: true,
        roles: { select: { role: { select: { id: true, name: true } } } },
        groups: { select: { group: { select: { id: true, name: true } } } },
      },
    });
    return this.toPage(users.map((user) => ({
      ...user,
      roles: user.roles.map(({ role }) => role),
      groups: user.groups.map(({ group }) => group),
    })), query.limit);
  }

  async listRoles(query: PageQuery) {
    const roles = await prisma.role.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { permissions: { include: { permission: true } } },
    });
    return this.toPage(roles.map((role) => ({
      id: role.id, name: role.name, description: role.description,
      permissions: role.permissions.map(({ permission }) => ({ id: permission.id, name: permission.name })),
    })), query.limit);
  }

  async listPermissions(query: PageQuery) {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: { id: true, name: true, description: true },
    });
    return this.toPage(permissions, query.limit);
  }

  async listGroups(query: PageQuery) {
    const groups = await prisma.group.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        roles: { include: { role: true } },
        users: { include: { user: true } },
      },
    });
    return this.toPage(groups.map((group) => ({
      id: group.id, name: group.name, description: group.description,
      roles: group.roles.map(({ role }) => ({ id: role.id, name: role.name })),
      users: group.users.map(({ user }) => ({ id: user.id, name: user.name, email: user.email })),
    })), query.limit);
  }

  async listAuditLogs(query: AuditLogQuery) {
    const logs = await prisma.accessAuditLog.findMany({
      where: {
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.targetId ? { targetId: query.targetId } : {}),
        ...(query.from || query.to ? { createdAt: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
    return this.toPage(logs, query.limit);
  }

  async findRole(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) return null;
    return {
      id: role.id, name: role.name, description: role.description,
      permissions: role.permissions.map(({ permission }) => ({
        id: permission.id, name: permission.name, description: permission.description,
      })),
    };
  }

  async findGroup(id: string) {
    const group = await prisma.group.findUnique({
      where: { id },
      include: { roles: { include: { role: true } }, users: { include: { user: true } } },
    });
    if (!group) return null;
    return {
      id: group.id, name: group.name, description: group.description,
      roles: group.roles.map(({ role }) => ({ id: role.id, name: role.name })),
      users: group.users.map(({ user }) => ({ id: user.id, name: user.name, email: user.email })),
    };
  }

  async createRole(actorUserId: string, data: CreateAccessEntity) {
    try {
      const role = await prisma.$transaction(async (transaction) => {
        const created = await transaction.role.create({
          data,
          include: { permissions: { include: { permission: true } } },
        });
        await transaction.accessAuditLog.create({ data: {
          actorUserId, action: 'role.create', targetType: 'role', targetId: created.id,
          metadata: { name: created.name },
        } });
        return created;
      });
      return { id: role.id, name: role.name, description: role.description, permissions: [] };
    } catch (error) {
      this.rethrowConflict(error, 'A role with this name already exists');
    }
  }

  async createGroup(actorUserId: string, data: CreateAccessEntity) {
    try {
      const group = await prisma.$transaction(async (transaction) => {
        const created = await transaction.group.create({ data });
        await transaction.accessAuditLog.create({ data: {
          actorUserId, action: 'group.create', targetType: 'group', targetId: created.id,
          metadata: { name: created.name },
        } });
        return created;
      });
      return { id: group.id, name: group.name, description: group.description, roles: [], users: [] };
    } catch (error) {
      this.rethrowConflict(error, 'A group with this name already exists');
    }
  }

  async roleExists(id: string) { return (await prisma.role.count({ where: { id } })) > 0; }
  async roleName(id: string) { return (await prisma.role.findUnique({ where: { id }, select: { name: true } }))?.name ?? null; }
  async permissionName(id: string) {
    return (await prisma.permission.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
  }
  async groupExists(id: string) { return (await prisma.group.count({ where: { id } })) > 0; }
  async groupHasRole(groupId: string, roleName: string) {
    return (await prisma.groupRole.count({ where: { groupId, role: { name: roleName } } })) > 0;
  }
  async userExists(id: string) { return (await prisma.user.count({ where: { id } })) > 0; }
  async userHasPermission(userId: string, permissionName: string) {
    return (await prisma.user.count({ where: {
      id: userId,
      OR: [
        { roles: { some: { role: { permissions: { some: { permission: { name: permissionName } } } } } } },
        { groups: { some: { group: { roles: { some: { role: { permissions: { some: { permission: { name: permissionName } } } } } } } } } },
      ],
    } })) > 0;
  }

  async assignPermissionToRole(actorUserId: string, roleId: string, permissionId: string) {
    await prisma.$transaction([
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        create: { roleId, permissionId }, update: {},
      }),
      this.audit(actorUserId, 'role.permission.assign', 'role', roleId, { permissionId }),
    ]);
  }

  async removePermissionFromRole(actorUserId: string, roleId: string, permissionId: string) {
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId, permissionId } }),
      this.audit(actorUserId, 'role.permission.remove', 'role', roleId, { permissionId }),
    ]);
  }

  async assignRoleToUser(actorUserId: string, userId: string, roleId: string) {
    await prisma.$transaction([
      prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId } }, create: { userId, roleId }, update: {},
      }),
      this.audit(actorUserId, 'user.role.assign', 'user', userId, { roleId }),
    ]);
  }

  async removeRoleFromUser(actorUserId: string, userId: string, roleId: string) {
    await prisma.$transaction(async (transaction) => {
      await transaction.userRole.deleteMany({ where: { userId, roleId } });
      await this.assertAdminRemains(transaction, roleId);
      await transaction.accessAuditLog.create({ data: {
        actorUserId, action: 'user.role.remove', targetType: 'user', targetId: userId, metadata: { roleId },
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async assignRoleToGroup(actorUserId: string, groupId: string, roleId: string) {
    await prisma.$transaction([
      prisma.groupRole.upsert({
        where: { groupId_roleId: { groupId, roleId } }, create: { groupId, roleId }, update: {},
      }),
      this.audit(actorUserId, 'group.role.assign', 'group', groupId, { roleId }),
    ]);
  }

  async removeRoleFromGroup(actorUserId: string, groupId: string, roleId: string) {
    await prisma.$transaction(async (transaction) => {
      await transaction.groupRole.deleteMany({ where: { groupId, roleId } });
      await this.assertAdminRemains(transaction, roleId);
      await transaction.accessAuditLog.create({ data: {
        actorUserId, action: 'group.role.remove', targetType: 'group', targetId: groupId, metadata: { roleId },
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async addUserToGroup(actorUserId: string, groupId: string, userId: string) {
    await prisma.$transaction([
      prisma.userGroup.upsert({
        where: { userId_groupId: { userId, groupId } }, create: { userId, groupId }, update: {},
      }),
      this.audit(actorUserId, 'group.user.add', 'group', groupId, { userId }),
    ]);
  }

  async removeUserFromGroup(actorUserId: string, groupId: string, userId: string) {
    await prisma.$transaction(async (transaction) => {
      const adminRole = await transaction.role.findUnique({ where: { name: 'ADMIN' }, select: { id: true } });
      const removesAdminAccess = adminRole
        ? (await transaction.groupRole.count({ where: { groupId, roleId: adminRole.id } })) > 0
        : false;
      await transaction.userGroup.deleteMany({ where: { groupId, userId } });
      if (removesAdminAccess && adminRole) await this.assertAdminRemains(transaction, adminRole.id);
      await transaction.accessAuditLog.create({ data: {
        actorUserId, action: 'group.user.remove', targetType: 'group', targetId: groupId, metadata: { userId },
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private audit(actorUserId: string, action: string, targetType: string, targetId: string, metadata: object) {
    return prisma.accessAuditLog.create({ data: { actorUserId, action, targetType, targetId, metadata } });
  }

  private toPage<T extends { id: string }>(items: T[], limit: number) {
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    return {
      data,
      pagination: {
        hasMore,
        nextCursor: hasMore ? data.at(-1)?.id ?? null : null,
      },
    };
  }

  private rethrowConflict(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError(message);
    }
    throw error;
  }

  private async assertAdminRemains(transaction: Prisma.TransactionClient, roleId: string) {
    const role = await transaction.role.findUnique({ where: { id: roleId }, select: { name: true } });
    if (role?.name !== 'ADMIN') return;
    const remaining = await transaction.user.count({ where: {
      OR: [
        { roles: { some: { roleId } } },
        { groups: { some: { group: { roles: { some: { roleId } } } } } },
      ],
    } });
    if (remaining === 0) throw new BadRequestError('The last effective ADMIN assignment cannot be removed');
  }
}
