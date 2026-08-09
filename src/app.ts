import { apiReference } from '@scalar/express-api-reference';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { openapi } from './config/openapi.js';
import { registerRedoc } from './config/redoc.js';
import { prisma } from './config/prisma.js';
import { AuthController } from './controllers/auth.controller.js';
import { AccessControlController } from './controllers/access-control.controller.js';
import { AuthMiddleware } from './middleware/auth.middleware.js';
import { Auth0Controller } from './integrations/auth0/auth0.controller.js';
import { Auth0Middleware } from './integrations/auth0/auth0.middleware.js';
import { Auth0Router } from './integrations/auth0/auth0.router.js';
import { localeMiddleware, supportedLocales, type Locale } from './i18n/locale.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { apiRateLimiter } from './middleware/rate-limit.middleware.js';
import { requestContext } from './middleware/request-context.middleware.js';
import { PrismaUserRepository } from './repositories/prisma-user.repository.js';
import { PrismaAccessControlRepository } from './repositories/prisma-access-control.repository.js';
import { AuthRouter } from './routes/auth.router.js';
import { AccessControlRouter } from './routes/access-control.router.js';
import { SystemRouter } from './routes/system.router.js';
import { AccessControlService } from './services/access-control.service.js';
import { AuthService } from './services/auth.service.js';
import { BcryptPasswordService } from './services/password.service.js';
import { JwtTokenService } from './services/token.service.js';

export class Application {
  readonly app: Express = express();

  constructor() {
    const tokens = new JwtTokenService();
    const service = new AuthService(new PrismaUserRepository(), new BcryptPasswordService(), tokens);
    const authorization = new AuthMiddleware(tokens, service);
    const router = new AuthRouter(new AuthController(service), authorization);
    const accessControl = new AccessControlService(new PrismaAccessControlRepository());
    const accessControlRouter = new AccessControlRouter(new AccessControlController(accessControl), authorization);
    const auth0 = new Auth0Middleware();
    const auth0Router = new Auth0Router(new Auth0Controller(), auth0);
    const systemRouter = new SystemRouter(async () => {
      await prisma.$queryRaw`SELECT 1`;
    }, env.READINESS_TIMEOUT_MS);

    this.app.disable('x-powered-by');
    this.app.set('trust proxy', env.TRUST_PROXY);
    this.app.use(requestContext);
    this.app.use(helmet());
    this.app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) }));
    this.app.use(express.json({ limit: '10kb' }));
    this.app.use(localeMiddleware);
    if (env.DOCS_ENABLED) {
      this.app.use(
        '/docs',
        helmet.contentSecurityPolicy({
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
            connectSrc: ["'self'", `https://${env.AUTH0_DOMAIN}`],
            frameSrc: ["'self'", `https://${env.AUTH0_DOMAIN}`],
          },
        }),
        apiReference({
          content: openapi,
          layout: 'modern',
          pageTitle: 'Express Auth API Reference',
          theme: 'purple',
        }),
      );
      this.app.get('/openapi.json', (_req, res) => res.json(openapi));
      this.app.use('/redoc', helmet.contentSecurityPolicy({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      }));
      registerRedoc(this.app);
    }
    this.app.use('/health', systemRouter.router);
    this.app.use('/api/v1', apiRateLimiter);
    this.app.get('/api/v1/locales', (_req, res) => res.json({
      defaultLocale: 'en',
      supportedLocales,
      selectedLocale: res.locals.locale as Locale,
    }));
    this.app.use('/api/v1/auth', router.router);
    this.app.use('/api/v1/auth0', auth0Router.router);
    this.app.use('/api/v1', accessControlRouter.router);
    this.app.use(notFound);
    this.app.use(errorHandler);
  }
}
