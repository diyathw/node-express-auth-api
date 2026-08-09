import type { RequestHandler } from 'express';

export const supportedLocales = ['en', 'fr', 'es'] as const;
export type Locale = (typeof supportedLocales)[number];

type MessageKey =
  | 'BEARER_REQUIRED'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'INSUFFICIENT_SCOPE'
  | 'INTERNAL_ERROR'
  | 'INVALID_ACCESS_TOKEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR';

const messages: Record<Locale, Record<MessageKey, string>> = {
  en: {
    BEARER_REQUIRED: 'A Bearer token is required',
    CONFLICT: 'The requested resource already exists',
    FORBIDDEN: 'Insufficient permissions',
    INSUFFICIENT_SCOPE: 'The access token does not have the required scope',
    INTERNAL_ERROR: 'Internal server error',
    INVALID_ACCESS_TOKEN: 'Invalid or expired access token',
    NOT_FOUND: 'Resource not found',
    RATE_LIMITED: 'Too many requests; try again later',
    UNAUTHORIZED: 'Authentication failed',
    VALIDATION_ERROR: 'Validation failed',
  },
  fr: {
    BEARER_REQUIRED: 'Un jeton Bearer est requis',
    CONFLICT: 'La ressource demandée existe déjà',
    FORBIDDEN: 'Autorisations insuffisantes',
    INSUFFICIENT_SCOPE: "Le jeton d’accès ne dispose pas de la portée requise",
    INTERNAL_ERROR: 'Erreur interne du serveur',
    INVALID_ACCESS_TOKEN: "Jeton d’accès invalide ou expiré",
    NOT_FOUND: 'Ressource introuvable',
    RATE_LIMITED: 'Trop de requêtes; réessayez plus tard',
    UNAUTHORIZED: "Échec de l’authentification",
    VALIDATION_ERROR: 'Échec de la validation',
  },
  es: {
    BEARER_REQUIRED: 'Se requiere un token Bearer',
    CONFLICT: 'El recurso solicitado ya existe',
    FORBIDDEN: 'Permisos insuficientes',
    INSUFFICIENT_SCOPE: 'El token de acceso no tiene el alcance requerido',
    INTERNAL_ERROR: 'Error interno del servidor',
    INVALID_ACCESS_TOKEN: 'Token de acceso inválido o vencido',
    NOT_FOUND: 'Recurso no encontrado',
    RATE_LIMITED: 'Demasiadas solicitudes; inténtalo de nuevo más tarde',
    UNAUTHORIZED: 'Error de autenticación',
    VALIDATION_ERROR: 'Error de validación',
  },
};

const normalize = (value: string): Locale | undefined => {
  const language = value.trim().toLowerCase().split('-')[0];
  return supportedLocales.find((locale) => locale === language);
};

export function resolveLocale(queryLanguage: unknown, acceptLanguage?: string): Locale {
  if (typeof queryLanguage === 'string') {
    const queryLocale = normalize(queryLanguage);
    if (queryLocale) return queryLocale;
  }

  const preferences = (acceptLanguage ?? '')
    .split(',')
    .map((entry) => {
      const [language = '', quality = 'q=1'] = entry.trim().split(';');
      const score = Number.parseFloat(quality.replace(/^q=/, ''));
      return { language, score: Number.isNaN(score) ? 0 : score };
    })
    .sort((a, b) => b.score - a.score);

  for (const preference of preferences) {
    const locale = normalize(preference.language);
    if (locale) return locale;
  }
  return 'en';
}

export const localeMiddleware: RequestHandler = (req, res, next) => {
  const locale = resolveLocale(req.query.lang, req.headers['accept-language']);
  res.locals.locale = locale;
  res.setHeader('Content-Language', locale);
  res.vary('Accept-Language');
  next();
};

export function translate(locale: Locale, key: string, fallback?: string): string {
  return key in messages[locale]
    ? messages[locale][key as MessageKey]
    : (fallback ?? messages[locale].INTERNAL_ERROR);
}
