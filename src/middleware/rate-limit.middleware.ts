import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env.js';
import { translate, type Locale } from '../i18n/locale.js';
import { sendProblem } from '../http/problem.js';

const common: Partial<Options> = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    sendProblem(res, {
      status: 429,
      code: 'RATE_LIMITED',
      detail: translate(res.locals.locale as Locale, 'RATE_LIMITED'),
      instance: req.originalUrl,
    });
  },
};

export const apiRateLimiter = rateLimit({
  ...common,
  limit: env.RATE_LIMIT_MAX,
});

export const authRateLimiter = rateLimit({
  ...common,
  limit: env.AUTH_RATE_LIMIT_MAX,
  // Successful login/registration should not consume the failed-attempt budget.
  skipSuccessfulRequests: true,
});
