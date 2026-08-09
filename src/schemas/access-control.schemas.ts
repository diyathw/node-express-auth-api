import { z } from 'zod';

const uuid = z.uuid();

const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: uuid.optional(),
}).strict();

export const paginationSchema = z.object({ query: paginationQuery });

export const auditLogQuerySchema = z.object({
  query: paginationQuery.extend({
    actorUserId: uuid.optional(),
    action: z.string().trim().min(1).max(100).optional(),
    targetType: z.string().trim().min(1).max(50).optional(),
    targetId: z.string().trim().min(1).max(100).optional(),
    from: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional(),
    to: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  }).refine(({ from, to }) => !from || !to || from <= to, {
    message: 'from must be earlier than or equal to to',
    path: ['from'],
  }),
});

export type PaginationInput = z.infer<typeof paginationSchema>['query'];
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>['query'];

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(50).regex(/^[A-Za-z][A-Za-z0-9_-]*$/).transform((name) => name.toUpperCase()),
    description: z.string().trim().min(1).max(255).optional(),
  }).strict(),
});

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(1).max(255).optional(),
  }).strict(),
});

const relationSchema = <T extends z.ZodRawShape>(params: T) => z.object({ params: z.object(params).strict() });

export const rolePermissionSchema = relationSchema({ roleId: uuid, permissionId: uuid });
export const userRoleSchema = relationSchema({ userId: uuid, roleId: uuid });
export const groupRoleSchema = relationSchema({ groupId: uuid, roleId: uuid });
export const groupUserSchema = relationSchema({ groupId: uuid, userId: uuid });
export const roleIdSchema = relationSchema({ roleId: uuid });
export const groupIdSchema = relationSchema({ groupId: uuid });
