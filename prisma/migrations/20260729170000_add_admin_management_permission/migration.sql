INSERT INTO "permissions" ("id", "name", "description", "created_at", "updated_at")
VALUES (
  '00000000-0000-4000-8000-000000000108',
  'admins:manage',
  'Grant or revoke effective administrator access',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE
SET "description" = EXCLUDED."description", "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role_record."id", permission_record."id"
FROM "roles" AS role_record
CROSS JOIN "permissions" AS permission_record
WHERE role_record."name" = 'ADMIN'
  AND permission_record."name" = 'admins:manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
