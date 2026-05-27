import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';

export const SUPPORTED_LOCALES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: 'EN', dir: 'ltr' },
  { code: 'ar', name: 'العربية', nativeName: 'العربية', flag: 'AR', dir: 'rtl' },
  { code: 'hi', name: 'हिन्दी', nativeName: 'हिन्दी', flag: 'HI', dir: 'ltr' },
] as const;

export type LocaleCode = typeof SUPPORTED_LOCALES[number]['code'];

export interface LocaleConfig {
  code: LocaleCode;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export const getLocaleConfig = (code: LocaleCode): LocaleConfig | undefined => {
  return SUPPORTED_LOCALES.find(l => l.code === code);
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    hi: { translation: hi },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

export const changeLanguage = (locale: LocaleCode) => {
  i18n.changeLanguage(locale);

  // Update document direction
  const localeInfo = SUPPORTED_LOCALES.find(l => l.code === locale);
  document.documentElement.dir = localeInfo?.dir || 'ltr';
  document.documentElement.lang = locale;
};

export const getCurrentLocale = (): LocaleCode => {
  return i18n.language as LocaleCode;
};

export const isRTL = (): boolean => {
  const localeInfo = SUPPORTED_LOCALES.find(l => l.code === i18n.language);
  return localeInfo?.dir === 'rtl';
};
