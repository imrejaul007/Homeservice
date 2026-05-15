import { Request, Response, NextFunction, RequestHandler } from 'express';
import { localizationService, LocaleConfig } from '../services/localization.service';

declare global {
  namespace Express {
    interface Request {
      locale: string;
      localeConfig: LocaleConfig;
      t: (key: string, params?: Record<string, string | number>) => string;
    }
  }
}

export interface LocaleMiddlewareOptions {
  defaultLocale?: string;
  cookieName?: string;
  queryParam?: string;
  headerName?: string;
  setCookie?: boolean;
  cookieMaxAge?: number;
}

const defaultOptions: Required<LocaleMiddlewareOptions> = {
  defaultLocale: 'en',
  cookieName: 'locale',
  queryParam: 'locale',
  headerName: 'accept-language',
  setCookie: true,
  cookieMaxAge: 365 * 24 * 60 * 60 * 1000,
};

export function localeMiddleware(options: LocaleMiddlewareOptions = {}): RequestHandler {
  const opts = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    const detectedLocale = detectLocale(req, opts);

    req.locale = detectedLocale;
    req.localeConfig = localizationService.getLocaleConfig(detectedLocale)!;

    req.t = (key: string, params?: Record<string, string | number>): string => {
      return localizationService.translate(key, req.locale, params);
    };

    if (opts.setCookie && res.cookie) {
      const cookieOptions = {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: opts.cookieMaxAge,
        path: '/',
      };

      res.cookie(opts.cookieName, req.locale, cookieOptions);
    }

    if (res.locals) {
      res.locals.locale = req.locale;
      res.locals.localeConfig = req.localeConfig;
      res.locals.t = req.t;
      res.locals.isRTL = localizationService.isRTL(req.locale);
      res.locals.supportedLocales = localizationService.getSupportedLocales();
    }

    next();
  };
}

function detectLocale(req: Request, options: Required<LocaleMiddlewareOptions>): string {
  const supportedLocales = localizationService.getSupportedLocaleCodes();

  const cookieLocale = extractCookieLocale(req, options.cookieName);
  if (cookieLocale && supportedLocales.includes(cookieLocale)) {
    return localizationService.normalizeLocaleCode(cookieLocale);
  }

  const queryLocale = req.query[options.queryParam] as string | undefined;
  if (queryLocale && supportedLocales.includes(queryLocale)) {
    return localizationService.normalizeLocaleCode(queryLocale);
  }

  const headerLocale = extractHeaderLocale(req.headers[options.headerName]);
  if (headerLocale) {
    return headerLocale;
  }

  if (req.user && typeof req.user === 'object' && 'preferredLocale' in req.user) {
    const userLocale = req.user.preferredLocale as string;
    if (userLocale && supportedLocales.includes(userLocale)) {
      return localizationService.normalizeLocaleCode(userLocale);
    }
  }

  return options.defaultLocale;
}

function extractCookieLocale(req: Request, cookieName: string): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;

  const pattern = new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`);
  const match = cookies.match(pattern);
  return match ? match[1] : null;
}

function extractHeaderLocale(acceptLanguage: string | string[] | undefined): string | null {
  if (!acceptLanguage) return null;

  const headerValue = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;

  const languages = headerValue
    .split(',')
    .map((lang) => {
      const [code, qValue] = lang.trim().split(';q=');
      return {
        code: code.trim().toLowerCase(),
        quality: qValue ? parseFloat(qValue) : 1.0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  const supportedLocales = localizationService.getSupportedLocaleCodes();

  for (const { code } of languages) {
    if (supportedLocales.includes(code)) {
      return code;
    }

    const baseCode = code.split('-')[0];
    if (supportedLocales.includes(baseCode)) {
      return baseCode;
    }
  }

  return null;
}

export function createLocaleDetector(options?: Partial<LocaleMiddlewareOptions>) {
  const opts = { ...defaultOptions, ...options };

  return (req: Request): string => {
    return detectLocale(req, opts as Required<LocaleMiddlewareOptions>);
  };
}

export function setLocaleHandler(options?: Partial<LocaleMiddlewareOptions>): RequestHandler {
  const opts = { ...defaultOptions, ...options };

  return (req: Request, res: Response): void => {
    const { locale } = req.body;

    if (!locale || !localizationService.isSupportedLocale(locale)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCALE',
          message: localizationService.translate('errors.badRequest', 'en'),
          details: `Invalid locale: ${locale}`,
        },
      });
      return;
    }

    const normalizedLocale = localizationService.normalizeLocaleCode(locale);

    res.cookie(opts.cookieName, normalizedLocale, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: opts.cookieMaxAge,
      path: '/',
    });

    req.locale = normalizedLocale;
    req.localeConfig = localizationService.getLocaleConfig(normalizedLocale)!;

    res.json({
      success: true,
      data: {
        locale: normalizedLocale,
        localeConfig: req.localeConfig,
        isRTL: localizationService.isRTL(normalizedLocale),
      },
    });
  };
}

export function getSupportedLocalesHandler(): RequestHandler {
  return (_req: Request, res: Response): void => {
    const locales = localizationService.getSupportedLocales();
    const defaultLocale = localizationService.getDefaultLocale();

    res.json({
      success: true,
      data: {
        locales,
        defaultLocale,
      },
    });
  };
}

export function getTranslationsHandler(namespace?: string): RequestHandler {
  return (req: Request, res: Response): void => {
    const locale = req.locale || localizationService.getDefaultLocale();

    if (namespace) {
      const translations = localizationService.getTranslationsForNamespace(locale, namespace);
      res.json({
        success: true,
        data: {
          locale,
          namespace,
          translations,
        },
      });
    } else {
      const translations = localizationService.getAllTranslations(locale);
      res.json({
        success: true,
        data: {
          locale,
          translations,
        },
      });
    }
  };
}

export function rtlRedirectMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const locale = req.locale;

    if (locale === 'ar') {
      res.locals.layout = 'layouts/rtl-layout';
    } else {
      res.locals.layout = 'layouts/ltr-layout';
    }

    next();
  };
}

export function getLocaleFromPath(path: string): string | null {
  const match = path.match(/^\/([a-z]{2})(?:\/|$)/);
  if (match) {
    const potentialLocale = match[1];
    if (localizationService.isSupportedLocale(potentialLocale)) {
      return potentialLocale;
    }
  }
  return null;
}

export function createLocalePathMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const pathLocale = getLocaleFromPath(req.path);

    if (pathLocale) {
      req.locale = pathLocale;
      req.localeConfig = localizationService.getLocaleConfig(pathLocale)!;
      req.url = req.url.replace(`/${pathLocale}`, '');
      if (req.url === '') {
        req.url = '/';
      }
    }

    next();
  };
}

export function createApiResponseFormatter() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (body?: unknown) {
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const formattedBody = body as Record<string, unknown>;

        if (formattedBody.success === true && formattedBody.data) {
          if (typeof formattedBody.data === 'object') {
            (formattedBody.data as Record<string, unknown>).locale = req.locale;
            (formattedBody.data as Record<string, unknown>).isRTL = localizationService.isRTL(req.locale);
          }
        }
      }

      return originalJson(body);
    };

    next();
  };
}

export function createLocaleContextProvider() {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.locals.locale = req.locale;
    res.locals.localeConfig = req.localeConfig;
    res.locals.t = req.t;
    res.locals.isRTL = localizationService.isRTL(req.locale);
    res.locals.supportedLocales = localizationService.getSupportedLocales();
    res.locals.formatCurrency = (amount: number, currencyCode: string) =>
      localizationService.formatCurrency(amount, currencyCode, req.locale);
    res.locals.formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions) =>
      localizationService.formatDate(date, req.locale, options);
    res.locals.formatTime = (date: Date | string, options?: Intl.DateTimeFormatOptions) =>
      localizationService.formatTime(date, req.locale, options);
    res.locals.formatDateTime = (date: Date | string) =>
      localizationService.formatDateTime(date, req.locale);
    res.locals.formatNumber = (value: number) =>
      localizationService.formatNumber(value, req.locale);

    next();
  };
}

export default localeMiddleware;
