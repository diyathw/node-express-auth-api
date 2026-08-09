import { describe, expect, it } from '@jest/globals';
import type { CreateUserData, User } from '../../../src/domain/user.js';
import { NotFoundError, UnauthorizedError } from '../../../src/errors/app-error.js';
import type { UserRepository } from '../../../src/repositories/user.repository.js';
import { AuthService } from '../../../src/services/auth.service.js';
import type { PasswordService } from '../../../src/services/password.service.js';
import type { TokenPayload, TokenService } from '../../../src/services/token.service.js';

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  private sequence = 0;

  async create(data: CreateUserData): Promise<User> {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const user: User = {
      ...data,
      id: String(++this.sequence),
      createdAt: now,
      updatedAt: now,
      roles: [{ id: 'role-user', name: 'USER', permissions: [] }],
      groups: [],
    };
    this.users.set(user.id, user);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  save(user: User): void {
    this.users.set(user.id, user);
  }
}

class FakePasswordService implements PasswordService {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `hashed:${password}`;
  }
}

class FakeTokenService implements TokenService {
  sign(payload: TokenPayload): string {
    return `token:${payload.userId}:${payload.email}`;
  }

  verify(token: string): TokenPayload {
    const [, userId = '', email = ''] = token.split(':');
    return { userId, email };
  }
}

describe('AuthService', () => {
  const setup = () => {
    const users = new InMemoryUserRepository();
    return { users, service: new AuthService(users, new FakePasswordService(), new FakeTokenService()) };
  };

  it('registers a user with a normalized email and no secret fields in the response', async () => {
    const { service } = setup();

    const result = await service.register({ name: 'Ada', email: 'ADA@Example.com', password: 'password-123' });

    expect(result.user).toMatchObject({ name: 'Ada', email: 'ada@example.com' });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.accessToken).toBe('token:1:ada@example.com');
    expect(result).toMatchObject({ tokenType: 'Bearer', expiresIn: '1h' });
  });

  it('logs in with valid credentials', async () => {
    const { service } = setup();
    await service.register({ name: 'Ada', email: 'ada@example.com', password: 'password-123' });

    const result = await service.login({ email: 'ADA@example.com', password: 'password-123' });

    expect(result.user.email).toBe('ada@example.com');
  });

  it.each([
    ['unknown email', 'missing@example.com', 'password-123'],
    ['incorrect password', 'ada@example.com', 'incorrect'],
  ])('rejects login with %s', async (_case, email, password) => {
    const { service } = setup();
    await service.register({ name: 'Ada', email: 'ada@example.com', password: 'password-123' });

    await expect(service.login({ email, password })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('combines direct and group roles without duplicates', async () => {
    const { service, users } = setup();
    const registered = await service.register({ name: 'Ada', email: 'ada@example.com', password: 'password-123' });
    const user = await users.findById(registered.user.id);
    if (!user) throw new Error('Test fixture user was not created');
    users.save({
      ...user,
      roles: [{ id: 'role-user', name: 'USER', permissions: [] }],
      groups: [{
        id: 'group-engineering',
        name: 'Engineering',
        roles: [
          { id: 'role-user', name: 'USER', permissions: [] },
          { id: 'role-admin', name: 'ADMIN', permissions: [{ id: 'permission-users-read', name: 'users:read' }] },
        ],
      }],
    });

    const profile = await service.getProfile({ userId: user.id, email: user.email });

    expect(profile.effectiveRoles.map(({ name }) => name)).toEqual(['USER', 'ADMIN']);
    expect(profile.effectivePermissions.map(({ name }) => name)).toEqual(['users:read']);
  });

  it('rejects a profile request when the user no longer exists', async () => {
    const { service } = setup();

    await expect(service.getProfile({ userId: 'missing', email: 'missing@example.com' }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
