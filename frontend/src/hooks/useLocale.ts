import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLocale, isRTL, SUPPORTED_LOCALES, LocaleCode } from '../i18n';

export const useLocale = () => {
  const { i18n } = useTranslation();

  const setLocale = useCallback((locale: LocaleCode) => {
    changeLanguage(locale);
  }, []);

  const currentLocale = getCurrentLocale();
  const rtl = isRTL();
  const supportedLocales = SUPPORTED_LOCALES;

  return {
    currentLocale,
    setLocale,
    isRTL: rtl,
    supportedLocales,
    t: i18n.t.bind(i18n),
  };
};
