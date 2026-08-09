import { z } from 'zod';
import { prisma } from '../config/prisma.js';

const email = z.email().parse(process.argv[2]?.trim().toLowerCase());

try {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) throw new Error(`No local user exists for ${email}; register the account first`);

  const role = await prisma.role.findUnique({ where: { name: 'ADMIN' }, select: { id: true } });
  if (!role) throw new Error('ADMIN role is missing; run database migrations first');

  await prisma.$transaction([
    prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    }),
    prisma.accessAuditLog.create({ data: {
      actorUserId: user.id,
      action: 'bootstrap.admin.assign',
      targetType: 'user',
      targetId: user.id,
      metadata: { email: user.email },
    } }),
  ]);

  console.log(`ADMIN role assigned to ${user.email}`);
} finally {
  await prisma.$disconnect();
}
