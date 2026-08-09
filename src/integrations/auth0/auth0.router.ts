import { Router } from 'express';
import type { Auth0Controller } from './auth0.controller.js';
import type { Auth0Middleware } from './auth0.middleware.js';
import { noStore } from '../../middleware/request-context.middleware.js';

export class Auth0Router {
  readonly router = Router();

  constructor(controller: Auth0Controller, auth0: Auth0Middleware) {
    this.router.use(noStore);
    this.router.get('/me', auth0.requireAccessToken, controller.profile);
  }
}
