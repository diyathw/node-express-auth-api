import type { RequestHandler } from 'express';

export class Auth0Controller {
  readonly profile: RequestHandler = (req, res) => {
    const claims = req.auth?.payload;
    const permissions = Array.isArray(claims?.permissions)
      ? claims.permissions.filter((permission): permission is string => typeof permission === 'string')
      : [];

    res.json({
      identity: {
        subject: claims?.sub,
        scope: typeof claims?.scope === 'string' ? claims.scope.split(' ') : [],
        permissions,
      },
    });
  };
}
