import { Router } from 'express';
import type { AccessControlController } from '../controllers/access-control.controller.js';
import type { AuthMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  createGroupSchema,
  createRoleSchema,
  auditLogQuerySchema,
  groupRoleSchema,
  groupIdSchema,
  groupUserSchema,
  rolePermissionSchema,
  paginationSchema,
  roleIdSchema,
  userRoleSchema,
} from '../schemas/access-control.schemas.js';

export class AccessControlRouter {
  readonly router = Router();

  constructor(controller: AccessControlController, auth: AuthMiddleware) {
    this.router.use(auth.requireAuth);
    this.router.get('/users', validate(paginationSchema), auth.requirePermission('users:read'), controller.listUsers);
    this.router.put('/users/:userId/roles/:roleId', validate(userRoleSchema), auth.requirePermission('users:roles:manage'), controller.assignRoleToUser);
    this.router.delete('/users/:userId/roles/:roleId', validate(userRoleSchema), auth.requirePermission('users:roles:manage'), controller.removeRoleFromUser);

    this.router.get('/permissions', validate(paginationSchema), auth.requirePermission('roles:read'), controller.listPermissions);
    this.router.get('/audit-logs', validate(auditLogQuerySchema), auth.requirePermission('audit:read'), controller.listAuditLogs);
    this.router.get('/roles', validate(paginationSchema), auth.requirePermission('roles:read'), controller.listRoles);
    this.router.post('/roles', validate(createRoleSchema), auth.requirePermission('roles:manage'), controller.createRole);
    this.router.get('/roles/:roleId', validate(roleIdSchema), auth.requirePermission('roles:read'), controller.getRole);
    this.router.put('/roles/:roleId/permissions/:permissionId', validate(rolePermissionSchema), auth.requirePermission('roles:manage'), controller.assignPermissionToRole);
    this.router.delete('/roles/:roleId/permissions/:permissionId', validate(rolePermissionSchema), auth.requirePermission('roles:manage'), controller.removePermissionFromRole);

    this.router.get('/groups', validate(paginationSchema), auth.requirePermission('groups:read'), controller.listGroups);
    this.router.post('/groups', validate(createGroupSchema), auth.requirePermission('groups:manage'), controller.createGroup);
    this.router.get('/groups/:groupId', validate(groupIdSchema), auth.requirePermission('groups:read'), controller.getGroup);
    this.router.put('/groups/:groupId/roles/:roleId', validate(groupRoleSchema), auth.requirePermission('groups:manage'), controller.assignRoleToGroup);
    this.router.delete('/groups/:groupId/roles/:roleId', validate(groupRoleSchema), auth.requirePermission('groups:manage'), controller.removeRoleFromGroup);
    this.router.put('/groups/:groupId/users/:userId', validate(groupUserSchema), auth.requirePermission('groups:manage'), controller.addUserToGroup);
    this.router.delete('/groups/:groupId/users/:userId', validate(groupUserSchema), auth.requirePermission('groups:manage'), controller.removeUserFromGroup);
  }
}
