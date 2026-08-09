import type {
  AccessGroup,
  AccessAuditRecord,
  AccessPermission,
  AccessRole,
  AccessUserSummary,
  AuditLogQuery,
  CreateAccessEntity,
  Page,
  PageQuery,
} from '../domain/access-control.js';

export interface AccessControlRepository {
  listUsers(query: PageQuery): Promise<Page<AccessUserSummary>>;
  listRoles(query: PageQuery): Promise<Page<AccessRole>>;
  listPermissions(query: PageQuery): Promise<Page<AccessPermission>>;
  listGroups(query: PageQuery): Promise<Page<AccessGroup>>;
  listAuditLogs(query: AuditLogQuery): Promise<Page<AccessAuditRecord>>;
  findRole(id: string): Promise<AccessRole | null>;
  findGroup(id: string): Promise<AccessGroup | null>;
  createRole(actorUserId: string, data: CreateAccessEntity): Promise<AccessRole>;
  createGroup(actorUserId: string, data: CreateAccessEntity): Promise<AccessGroup>;
  roleExists(id: string): Promise<boolean>;
  roleName(id: string): Promise<string | null>;
  permissionName(id: string): Promise<string | null>;
  groupExists(id: string): Promise<boolean>;
  groupHasRole(groupId: string, roleName: string): Promise<boolean>;
  userExists(id: string): Promise<boolean>;
  userHasPermission(userId: string, permissionName: string): Promise<boolean>;
  assignPermissionToRole(actorUserId: string, roleId: string, permissionId: string): Promise<void>;
  removePermissionFromRole(actorUserId: string, roleId: string, permissionId: string): Promise<void>;
  assignRoleToUser(actorUserId: string, userId: string, roleId: string): Promise<void>;
  removeRoleFromUser(actorUserId: string, userId: string, roleId: string): Promise<void>;
  assignRoleToGroup(actorUserId: string, groupId: string, roleId: string): Promise<void>;
  removeRoleFromGroup(actorUserId: string, groupId: string, roleId: string): Promise<void>;
  addUserToGroup(actorUserId: string, groupId: string, userId: string): Promise<void>;
  removeUserFromGroup(actorUserId: string, groupId: string, userId: string): Promise<void>;
}
