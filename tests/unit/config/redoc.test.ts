import { describe, expect, it } from '@jest/globals';
import { renderRedocHtml } from '../../../src/config/redoc.js';

describe('ReDoc page', () => {
  it('uses the local ReDoc bundle and public OpenAPI document', () => {
    const html = renderRedocHtml('Express Auth API Reference', '/openapi.json');

    expect(html).toContain('spec-url="/openapi.json"');
    expect(html).toContain('src="/redoc/redoc.standalone.js"');
    expect(html).not.toContain('cdn.jsdelivr.net');
  });
});
