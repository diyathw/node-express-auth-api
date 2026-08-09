import type { Response } from 'express';

interface ProblemOptions {
  status: number;
  code: string;
  detail: string;
  instance?: string;
  errors?: { field: string; message: string }[];
  headers?: Record<string, string | string[]>;
}

const titles: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

export const sendProblem = (res: Response, options: ProblemOptions): void => {
  if (options.headers) res.set(options.headers);
  res.status(options.status).type('application/problem+json').json({
    type: 'about:blank',
    title: titles[options.status] ?? 'Request Failed',
    status: options.status,
    detail: options.detail,
    code: options.code,
    ...(options.instance ? { instance: options.instance } : {}),
    traceId: res.locals.requestId as string,
    ...(options.errors ? { errors: options.errors } : {}),
  });
};
