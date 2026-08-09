import type { RequestHandler } from 'express';
import type { AuthService } from '../services/auth.service.js';
import type { TokenPayload, TokenService } from '../services/token.service.js';
import { sendProblem } from '../http/problem.js';
import { translate, type Locale } from '../i18n/locale.js';

export class AuthMiddleware {
  constructor(
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  readonly requireAuth: RequestHandler = (req, res, next) => {
    try {
      const [scheme, token] = (req.headers.authorization ?? '').split(' ');
      if (scheme !== 'Bearer' || !token) {
        sendProblem(res, {
          status: 401,
          code: 'UNAUTHORIZED',
          detail: translate(res.locals.locale as Locale, 'BEARER_REQUIRED'),
          instance: req.originalUrl,
        });
        return;
      }
      res.locals.auth = this.tokens.verify(token);
      next();
    } catch (error) {
      next(error);
    }
  };

  requirePermission = (...requiredPermissions: string[]): RequestHandler => async (req, res, next) => {
    try {
      const profile = await this.auth.getProfile(res.locals.auth as TokenPayload);
      const granted = new Set(profile.effectivePermissions.map(({ name }) => name));
      if (!requiredPermissions.every((permission) => granted.has(permission))) {
        sendProblem(res, {
          status: 403,
          code: 'FORBIDDEN',
          detail: translate(res.locals.locale as Locale, 'FORBIDDEN'),
          instance: req.originalUrl,
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
