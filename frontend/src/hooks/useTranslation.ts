
import { useCallback, useMemo, useEffect, useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import {
  changeLanguage,
  getCurrentLocale,
  isRTL,
  getLocaleConfig,
  SUPPORTED_LOCALES,
} from '../i18n';
import type { LocaleConfig, LocaleCode } from '../i18n';

export type TranslationKey = string;

export interface UseTranslationReturn {
  t: ReturnType<typeof useI18nTranslation>['t'];
  i18n: ReturnType<typeof useI18nTranslation>['i18n'];
  ready: ReturnType<typeof useI18nTranslation>['ready'];
  locale: string;
  isRTL: boolean;
  localeConfig: LocaleConfig | undefined;
  changeLocale: (language: string) => Promise<void>;
  tCurrency: (amount: number, currency?: string) => string;
  tDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  tTime: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  tDateTime: (date: Date | string) => string;
  tNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  tRelativeTime: (date: Date | string, options?: { numeric?: 'always' | 'auto' }) => string;
  supportedLocales: LocaleConfig[];
}

export function useTranslation(ns?: string | readonly string[]): UseTranslationReturn {
  const translation = useI18nTranslation(ns);

  const [locale, setLocale] = useState<string>(getCurrentLocale());

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setLocale(lng);
    };

    translation.i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      translation.i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [translation.i18n]);

  const direction = useMemo(() => isRTL(), [locale]);
  const localeConfig = useMemo(() => getLocaleConfig(locale as "en" | "hi" | "ar"), [locale]);

  const changeLocale = useCallback(async (language: string) => {
    await changeLanguage(language as LocaleCode);
    setLocale(language);
  }, []);

  const tCurrency = useCallback(
    (amount: number, currency: string = 'USD'): string => {
      const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === 'JPY' ? 0 : 2,
        maximumFractionDigits: currency === 'JPY' ? 0 : 2,
      };

      try {
        return new Intl.NumberFormat(locale, options).format(amount);
      } catch {
        return `${currency} ${amount.toFixed(2)}`;
      }
    },
    [locale]
  );

  const tDate = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options,
      };

      try {
        return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
      } catch {
        return dateObj.toLocaleDateString();
      }
    },
    [locale]
  );

  const tTime = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      const defaultOptions: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: 'numeric',
        hour12: locale === 'en',
        ...options,
      };

      try {
        return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
      } catch {
        return dateObj.toLocaleTimeString();
      }
    },
    [locale]
  );

  const tDateTime = useCallback(
    (date: Date | string): string => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: locale === 'en',
      };

      try {
        return new Intl.DateTimeFormat(locale, options).format(dateObj);
      } catch {
        return dateObj.toLocaleString();
      }
    },
    [locale]
  );

  const tNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions): string => {
      try {
        return new Intl.NumberFormat(locale, options).format(value);
      } catch {
        return value.toString();
      }
    },
    [locale]
  );

  const tRelativeTime = useCallback(
    (date: Date | string, options?: { numeric?: 'always' | 'auto' }): string => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      const diffMs = now.getTime() - dateObj.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      const diffWeek = Math.floor(diffDay / 7);
      const diffMonth = Math.floor(diffDay / 30);
      const diffYear = Math.floor(diffDay / 365);

      const numeric = options?.numeric || 'auto';

      try {
        if (Math.abs(diffSec) < 60) {
          return new Intl.RelativeTimeFormat(locale, { numeric }).format(-diffSec, 'second');
        }
        if (Math.abs(diffMin) < 60) {
          return new Intl.RelativeTimeFormat(locale, { numeric }).format(-diffMin, 'minute');
        }
        if (Math.abs(diffHour) < 24) {
          return new Intl.RelativeTimeFormat(locale, { numeric }).format(-diffHour, 'hour');
        }
        if (Math.abs(diffDay) < 7) {
          return new Intl.RelativeTimeFormat(locale, { numeric }).format(-diffDay, 'day');
        }
        if (Math.abs(diffWeek) < 4) {
          return new Intl.RelativeTimeFormat(locale, { numeric }).format(-diffWeek, 'week');
        }
        if (Math.abs(diffMonth) < 12) {
          return new Intl.RelativeTimeFormat(locale, { numeric }).format(-diffMonth, 'month');
        }
        return new Intl.RelativeTimeFormat(locale, { numeric }).format(-diffYear, 'year');
      } catch {
        return tDate(dateObj);
      }
    },
    [locale, tDate]
  );

  const supportedLocales = useMemo(() => {
    return Object.values(SUPPORTED_LOCALES);
  }, []);

  return {
    ...translation,
    locale,
    isRTL: direction,
    localeConfig,
    changeLocale,
    tCurrency,
    tDate,
    tTime,
    tDateTime,
    tNumber,
    tRelativeTime,
    supportedLocales,
  };
}

export default useTranslation;
