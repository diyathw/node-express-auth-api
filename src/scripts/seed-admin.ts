import { z } from 'zod';
import { BcryptPasswordService } from '../services/password.service.js';

const seedSchema = z.object({
  ADMIN_SEED_NAME: z.string().trim().min(2).max(100),
  ADMIN_SEED_EMAIL: z.email().trim().toLowerCase().max(255),
  ADMIN_SEED_PASSWORD: z.string().min(12).max(72),
});

const result = seedSchema.safeParse(process.env);
if (!result.success) {
  const fields = Object.keys(result.error.flatten().fieldErrors).join(', ');
  throw new Error(`Admin seed configuration is invalid or missing: ${fields}. Set the values in .env before seeding.`);
}

const permissionNames = [
  'users:read',
  'users:roles:manage',
  'roles:read',
  'roles:manage',
  'groups:read',
  'groups:manage',
  'audit:read',
  'admins:manage',
] as const;

const { ADMIN_SEED_NAME: name, ADMIN_SEED_EMAIL: email, ADMIN_SEED_PASSWORD: password } = result.data;
const passwordHash = await new BcryptPasswordService().hash(password);
const { prisma } = await import('../config/prisma.js');

try {
  const user = await prisma.$transaction(async (transaction) => {
    const permissions = await transaction.permission.findMany({
      where: { name: { in: [...permissionNames] } },
      select: { id: true, name: true },
    });
    if (permissions.length !== permissionNames.length) {
      throw new Error('The permission catalog is incomplete; run `npm run db:deploy` before seeding');
    }

    const userRole = await transaction.role.upsert({
      where: { name: 'USER' },
      update: {},
      create: { name: 'USER', description: 'Default authenticated user' },
      select: { id: true },
    });
    const adminRole = await transaction.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Full local administration access' },
      select: { id: true },
    });

    await transaction.rolePermission.createMany({
      data: permissions.map(({ id: permissionId }) => ({ roleId: adminRole.id, permissionId })),
      skipDuplicates: true,
    });

    const seededUser = await transaction.user.upsert({
      where: { email },
      update: { name, passwordHash },
      create: { name, email, passwordHash },
      select: { id: true, email: true },
    });

    await transaction.userRole.createMany({
      data: [
        { userId: seededUser.id, roleId: userRole.id },
        { userId: seededUser.id, roleId: adminRole.id },
      ],
      skipDuplicates: true,
    });
    await transaction.accessAuditLog.create({ data: {
      actorUserId: seededUser.id,
      action: 'seed.admin.upsert',
      targetType: 'user',
      targetId: seededUser.id,
      metadata: { email: seededUser.email },
    } });

    return seededUser;
  });

  console.log(`Admin seed complete for ${user.email}`);
} finally {
  await prisma.$disconnect();
}
