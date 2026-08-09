import { describe, expect, it } from '@jest/globals';
import { resolveLocale, translate } from '../../../src/i18n/locale.js';

describe('locale resolution', () => {
  it('gives a supported query locale precedence over the header', () => {
    expect(resolveLocale('fr-CA', 'es;q=1')).toBe('fr');
  });

  it('uses the highest-quality supported Accept-Language preference', () => {
    expect(resolveLocale(undefined, 'de-DE;q=1, es-MX;q=0.8, fr;q=0.5')).toBe('es');
  });

  it('falls back to English for unsupported languages', () => {
    expect(resolveLocale(undefined, 'de-DE, ja-JP')).toBe('en');
  });

  it('translates a known message key', () => {
    expect(translate('fr', 'RATE_LIMITED')).toBe('Trop de requêtes; réessayez plus tard');
  });
});
