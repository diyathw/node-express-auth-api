import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { sendProblem } from '../http/problem.js';
import { translate, type Locale } from '../i18n/locale.js';

export const validate = (schema: ZodType): RequestHandler => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body as unknown,
    params: req.params,
    query: req.query,
  });
  if (!result.success) {
    sendProblem(res, {
      status: 400,
      code: 'VALIDATION_ERROR',
      detail: translate(res.locals.locale as Locale, 'VALIDATION_ERROR'),
      instance: req.originalUrl,
      errors: result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
    });
    return;
  }
  res.locals.input = result.data;
  next();
};
