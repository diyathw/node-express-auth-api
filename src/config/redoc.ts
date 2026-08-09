import { createRequire } from 'node:module';
import type { Express } from 'express';

const require = createRequire(`${process.cwd()}/package.json`);
const redocBundlePath = require.resolve('redoc/bundles/redoc.standalone.js');

export function renderRedocHtml(title: string, specUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <redoc spec-url="${escapeHtml(specUrl)}"></redoc>
    <script src="/redoc/redoc.standalone.js"></script>
  </body>
</html>`;
}

export function registerRedoc(app: Express): void {
  app.get('/redoc/redoc.standalone.js', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=31536000, immutable').sendFile(redocBundlePath);
  });
  app.get('/redoc', (_req, res) => {
    res.type('html').send(renderRedocHtml('Express Auth API Reference', '/openapi.json'));
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}
