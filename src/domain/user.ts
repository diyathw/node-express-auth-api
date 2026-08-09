export interface RoleSummary {
  id: string;
  name: string;
  permissions: PermissionSummary[];
}

export interface PermissionSummary {
  id: string;
  name: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  roles: RoleSummary[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  roles: RoleSummary[];
  groups: GroupSummary[];
}

export type PublicUser = Omit<User, 'passwordHash' | 'updatedAt'> & {
  effectiveRoles: RoleSummary[];
  effectivePermissions: PermissionSummary[];
};

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
}
