import type { RequestHandler } from 'express';
import type { AuthService, LoginInput, RegisterInput } from '../services/auth.service.js';
import type { TokenPayload } from '../services/token.service.js';

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  readonly register: RequestHandler = async (_req, res, next) => {
    try {
      const { body } = res.locals.input as { body: RegisterInput };
      res.location('/api/v1/auth/me').status(201).json(await this.auth.register(body));
    } catch (error) { next(error); }
  };

  readonly login: RequestHandler = async (_req, res, next) => {
    try {
      const { body } = res.locals.input as { body: LoginInput };
      res.json(await this.auth.login(body));
    } catch (error) { next(error); }
  };

  readonly me: RequestHandler = async (_req, res, next) => {
    try {
      res.json({ user: await this.auth.getProfile(res.locals.auth as TokenPayload) });
    } catch (error) { next(error); }
  };
}
