import { Router } from 'express';
import { sendProblem } from '../http/problem.js';

export class SystemRouter {
  readonly router = Router();

  constructor(readinessCheck: () => Promise<void>, timeoutMs = 2_000) {
    this.router.get('/live', (_req, res) => {
      res.json({ status: 'ok' });
    });
    this.router.get('/ready', async (req, res) => {
      try {
        let timeout: NodeJS.Timeout | undefined;
        try {
          await Promise.race([
            readinessCheck(),
            new Promise<never>((_resolve, reject) => {
              timeout = setTimeout(() => reject(new Error('Readiness check timed out')), timeoutMs);
            }),
          ]);
        } finally {
          if (timeout) clearTimeout(timeout);
        }
        res.json({ status: 'ready' });
      } catch {
        sendProblem(res, {
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          detail: 'The service is not ready to accept traffic',
          instance: req.originalUrl,
        });
      }
    });
  }
}
