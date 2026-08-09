import { prisma } from '../config/prisma.js';
import type { CreateUserData, User } from '../domain/user.js';
import { ConflictError } from '../errors/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import type { UserRepository } from './user.repository.js';

export class PrismaUserRepository implements UserRepository {
  private readonly access = {
    roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    groups: { include: { group: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } } },
  } as const;

  async create(data: CreateUserData): Promise<User> {
    try {
      const user = await prisma.user.create({
        data: {
          ...data,
          roles: {
            create: {
              role: {
                connectOrCreate: {
                  where: { name: 'USER' },
                  create: { name: 'USER', description: 'Default authenticated user' },
                },
              },
            },
          },
        },
        include: this.access,
      });
      return this.toDomain(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('An account with this email already exists');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { email }, include: this.access });
    return user ? this.toDomain(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { id }, include: this.access });
    return user ? this.toDomain(user) : null;
  }

  private toDomain(user: Awaited<ReturnType<typeof this.findPrismaUser>>): User {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles.map(({ role }) => ({
        id: role.id,
        name: role.name,
        permissions: role.permissions.map(({ permission }) => ({ id: permission.id, name: permission.name })),
      })),
      groups: user.groups.map(({ group }) => ({
        id: group.id,
        name: group.name,
        roles: group.roles.map(({ role }) => ({
          id: role.id,
          name: role.name,
          permissions: role.permissions.map(({ permission }) => ({ id: permission.id, name: permission.name })),
        })),
      })),
    };
  }

  // This private query exists only to let TypeScript derive the relation payload once.
  private findPrismaUser(id: string) {
    return prisma.user.findUniqueOrThrow({ where: { id }, include: this.access });
  }
}
