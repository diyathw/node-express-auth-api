import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import type { AuthMiddleware } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rate-limit.middleware.js';
import { noStore } from '../middleware/request-context.middleware.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../schemas/auth.schemas.js';

export class AuthRouter {
  readonly router = Router();

  constructor(controller: AuthController, auth: AuthMiddleware) {
    this.router.use(noStore);
    this.router.post('/register', authRateLimiter, validate(registerSchema), controller.register);
    this.router.post('/login', authRateLimiter, validate(loginSchema), controller.login);
    this.router.get('/me', auth.requireAuth, controller.me);
  }
}
