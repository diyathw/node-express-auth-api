import type { PublicUser, User } from '../domain/user.js';
import { NotFoundError, UnauthorizedError } from '../errors/app-error.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { PasswordService } from './password.service.js';
import { env } from '../config/env.js';
import type { TokenPayload, TokenService } from './token.service.js';

export interface RegisterInput { name: string; email: string; password: string }
export interface LoginInput { email: string; password: string }
export interface AuthResult { user: PublicUser; accessToken: string; tokenType: 'Bearer'; expiresIn: string }

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const user = await this.users.create({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await this.passwords.hash(input.password),
    });
    return this.authResult(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email.toLowerCase());
    if (!user || !(await this.passwords.verify(input.password, user.passwordHash))) {
      throw new UnauthorizedError();
    }
    return this.authResult(user);
  }

  async getProfile(payload: TokenPayload): Promise<PublicUser> {
    const user = await this.users.findById(payload.userId);
    if (!user) throw new NotFoundError('User not found');
    return this.toPublicUser(user);
  }

  private authResult(user: User): AuthResult {
    return {
      user: this.toPublicUser(user),
      accessToken: this.tokens.sign({ userId: user.id, email: user.email }),
      tokenType: 'Bearer',
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }

  private toPublicUser({ passwordHash: _passwordHash, updatedAt: _updatedAt, ...user }: User): PublicUser {
    const effectiveRoles = new Map(user.roles.map((role) => [role.id, role]));
    for (const group of user.groups) {
      for (const role of group.roles) effectiveRoles.set(role.id, role);
    }
    const effectivePermissions = new Map(
      [...effectiveRoles.values()].flatMap((role) => role.permissions).map((permission) => [permission.id, permission]),
    );
    return { ...user, effectiveRoles: [...effectiveRoles.values()], effectivePermissions: [...effectivePermissions.values()] };
  }
}
