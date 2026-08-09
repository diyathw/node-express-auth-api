import { auth, requiredScopes } from 'express-oauth2-jwt-bearer';
import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';

export class Auth0Middleware {
  readonly requireAccessToken: RequestHandler = auth({
    audience: env.AUTH0_AUDIENCE,
    issuerBaseURL: `https://${env.AUTH0_DOMAIN}`,
    tokenSigningAlg: 'RS256',
  });

  requireScopes(scopes: string | string[]): RequestHandler {
    return requiredScopes(scopes);
  }
}
