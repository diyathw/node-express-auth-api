import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const validRequestId = /^[A-Za-z0-9._:-]{1,100}$/;

export const requestContext: RequestHandler = (req, res, next) => {
  const supplied = req.header('x-request-id');
  const requestId = supplied && validRequestId.test(supplied) ? supplied : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
};
