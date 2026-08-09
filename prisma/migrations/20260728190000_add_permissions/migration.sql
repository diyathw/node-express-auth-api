CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "access_audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "access_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
CREATE INDEX "access_audit_logs_actor_user_id_idx" ON "access_audit_logs"("actor_user_id");
CREATE INDEX "access_audit_logs_created_at_idx" ON "access_audit_logs"("created_at");

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_audit_logs" ADD CONSTRAINT "access_audit_logs_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "roles" ("id", "name", "description", "updated_at") VALUES
    ('00000000-0000-4000-8000-000000000001', 'USER', 'Default authenticated user', CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000002', 'ADMIN', 'Full local administration access', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "permissions" ("id", "name", "description", "updated_at") VALUES
    ('00000000-0000-4000-8000-000000000101', 'users:read', 'View users and their access', CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000102', 'users:roles:manage', 'Assign and remove user roles', CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000103', 'roles:read', 'View roles and permissions', CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000104', 'roles:manage', 'Create roles and assign permissions', CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000105', 'groups:read', 'View groups and memberships', CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000106', 'groups:manage', 'Create groups and manage memberships', CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000107', 'audit:read', 'View access-control audit records', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "roles" role CROSS JOIN "permissions" permission
WHERE role."name" = 'ADMIN'
ON CONFLICT DO NOTHING;
