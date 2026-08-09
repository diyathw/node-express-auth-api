import type { GroupSummary, PermissionSummary, RoleSummary } from './user.js';

export interface AccessUserSummary {
  id: string;
  name: string;
  email: string;
  roles: { id: string; name: string }[];
  groups: { id: string; name: string }[];
}

export interface AccessRole extends RoleSummary {
  description: string | null;
}

export interface AccessPermission extends PermissionSummary {
  description: string | null;
}

export interface AccessGroup extends Omit<GroupSummary, 'roles'> {
  description: string | null;
  roles: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
}

export interface CreateAccessEntity {
  name: string;
  description?: string;
}

export interface PageQuery {
  limit: number;
  cursor?: string | undefined;
}

export interface Page<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface AuditLogQuery extends PageQuery {
  actorUserId?: string | undefined;
  action?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export interface AccessAuditRecord {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: Date;
  actor: { id: string; name: string; email: string };
}
