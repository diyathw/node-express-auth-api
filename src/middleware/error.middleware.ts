import type { ErrorRequestHandler, RequestHandler } from 'express';
import {
  InsufficientScopeError,
  UnauthorizedError as Auth0UnauthorizedError,
} from 'express-oauth2-jwt-bearer';
import { AppError } from '../errors/app-error.js';
import { sendProblem } from '../http/problem.js';
import { translate, type Locale } from '../i18n/locale.js';

export const notFound: RequestHandler = (req, res) => {
  sendProblem(res, {
    status: 404,
    code: 'NOT_FOUND',
    detail: translate(res.locals.locale as Locale, 'NOT_FOUND'),
    instance: req.originalUrl,
  });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const locale = res.locals.locale as Locale;
  if (error instanceof InsufficientScopeError) {
    sendProblem(res, {
      status: 403,
      code: 'INSUFFICIENT_SCOPE',
      detail: translate(locale, 'INSUFFICIENT_SCOPE'),
      instance: req.originalUrl,
      headers: error.headers,
    });
    return;
  }
  if (error instanceof Auth0UnauthorizedError) {
    sendProblem(res, {
      status: error.statusCode,
      code: 'INVALID_ACCESS_TOKEN',
      detail: translate(locale, 'INVALID_ACCESS_TOKEN'),
      instance: req.originalUrl,
      headers: error.headers,
    });
    return;
  }
  if (error instanceof AppError) {
    sendProblem(res, {
      status: error.statusCode,
      code: error.code,
      detail: translate(locale, error.code, error.message),
      instance: req.originalUrl,
    });
    return;
  }
  console.error(error);
  sendProblem(res, {
    status: 500,
    code: 'INTERNAL_ERROR',
    detail: translate(locale, 'INTERNAL_ERROR'),
    instance: req.originalUrl,
  });
};
