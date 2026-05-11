// Supported locales
export const SUPPORTED_LOCALES = ['en', 'ar', 'fr', 'es', 'de', 'hi'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

// Supported currencies
export const SUPPORTED_CURRENCIES = ['AED', 'USD', 'EUR', 'GBP'] as const;
export type Currency = typeof SUPPORTED_CURRENCIES[number];

// Currency configurations
export const CURRENCY_CONFIG: Record<Currency, {
  symbol: string;
  code: Currency;
  name: string;
  exchangeRateToUSD: number;
  decimalPlaces: number;
}> = {
  AED: { symbol: 'د.إ', code: 'AED', name: 'UAE Dirham', exchangeRateToUSD: 3.67, decimalPlaces: 2 },
  USD: { symbol: '$', code: 'USD', name: 'US Dollar', exchangeRateToUSD: 1, decimalPlaces: 2 },
  EUR: { symbol: '€', code: 'EUR', name: 'Euro', exchangeRateToUSD: 0.92, decimalPlaces: 2 },
  GBP: { symbol: '£', code: 'GBP', name: 'British Pound', exchangeRateToUSD: 0.79, decimalPlaces: 2 },
};

// Timezone configurations
export const TIMEZONES = {
  'Asia/Dubai': { name: 'Dubai', offset: '+04:00' },
  'Asia/Kolkata': { name: 'India', offset: '+05:30' },
  'Europe/London': { name: 'London', offset: '+00:00' },
  'America/New_York': { name: 'New York', offset: '-05:00' },
} as const;

export type Timezone = keyof typeof TIMEZONES;

// Translations (subset)
export const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: {
    'welcome': 'Welcome',
    'login': 'Login',
    'register': 'Register',
    'bookings': 'Bookings',
    'services': 'Services',
    'profile': 'Profile',
    'logout': 'Logout',
    'search': 'Search',
    'book_now': 'Book Now',
    'pending': 'Pending',
    'confirmed': 'Confirmed',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
  },
  ar: {
    'welcome': 'مرحبا',
    'login': 'تسجيل الدخول',
    'register': 'التسجيل',
    'bookings': 'الحجوزات',
    'services': 'الخدمات',
    'profile': 'الملف الشخصي',
    'logout': 'تسجيل الخروج',
    'search': 'بحث',
    'book_now': 'احجز الآن',
    'pending': 'قيد الانتظار',
    'confirmed': 'مؤكد',
    'completed': 'مكتمل',
    'cancelled': 'ملغى',
  },
  fr: {
    'welcome': 'Bienvenue',
    'login': 'Connexion',
    'register': "S'inscrire",
    'bookings': 'Réservations',
    'services': 'Services',
    'profile': 'Profil',
    'logout': 'Déconnexion',
    'search': 'Rechercher',
    'book_now': 'Réserver',
    'pending': 'En attente',
    'confirmed': 'Confirmé',
    'completed': 'Terminé',
    'cancelled': 'Annulé',
  },
  es: {
    'welcome': 'Bienvenido',
    'login': 'Iniciar sesión',
    'register': 'Registrarse',
    'bookings': 'Reservas',
    'services': 'Servicios',
    'profile': 'Perfil',
    'logout': 'Cerrar sesión',
    'search': 'Buscar',
    'book_now': 'Reservar ahora',
    'pending': 'Pendiente',
    'confirmed': 'Confirmado',
    'completed': 'Completado',
    'cancelled': 'Cancelado',
  },
  de: {
    'welcome': 'Willkommen',
    'login': 'Anmelden',
    'register': 'Registrieren',
    'bookings': 'Buchungen',
    'services': 'Dienstleistungen',
    'profile': 'Profil',
    'logout': 'Abmelden',
    'search': 'Suchen',
    'book_now': 'Jetzt buchen',
    'pending': 'Ausstehend',
    'confirmed': 'Bestätigt',
    'completed': 'Abgeschlossen',
    'cancelled': 'Storniert',
  },
  hi: {
    'welcome': 'स्वागत है',
    'login': 'लॉगिन करें',
    'register': 'रजिस्टर करें',
    'bookings': 'बुकिंग',
    'services': 'सेवाएं',
    'profile': 'प्रोफाइल',
    'logout': 'लॉग आउट',
    'search': 'खोजें',
    'book_now': 'अभी बुक करें',
    'pending': 'लंबित',
    'confirmed': 'पुष्टि हो गई',
    'completed': 'पूर्ण',
    'cancelled': 'रद्द',
  },
};

// Format currency
export const formatCurrency = (
  amount: number,
  currency: Currency = 'AED',
  locale: Locale = 'en'
): string => {
  const config = CURRENCY_CONFIG[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: config.decimalPlaces,
    maximumFractionDigits: config.decimalPlaces,
  }).format(amount);
};

// Format date
export const formatDate = (
  date: Date,
  locale: Locale = 'en',
  options?: Intl.DateTimeFormatOptions
): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };
  return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
};

// Convert timezone
export const convertTimezone = (
  date: Date,
  fromTz: Timezone,
  toTz: Timezone
): Date => {
  // Simple timezone conversion
  const fromOffset = TIMEZONES[fromTz]?.offset || '+00:00';
  const toOffset = TIMEZONES[toTz]?.offset || '+00:00';

  const fromMs = parseInt(fromOffset.replace(':', '')) * 15 * 60 * 1000;
  const toMs = parseInt(toOffset.replace(':', '')) * 15 * 60 * 1000;
  const diff = toMs - fromMs;

  return new Date(date.getTime() + diff);
};

// Get user locale from request
export const getLocaleFromAcceptLanguage = (acceptLanguage: string | undefined): Locale => {
  if (!acceptLanguage) return 'en';

  const locales = acceptLanguage.split(',').map(l => l.split('-')[0].trim());
  for (const locale of locales) {
    if (SUPPORTED_LOCALES.includes(locale as Locale)) {
      return locale as Locale;
    }
  }
  return 'en';
};

export default {
  SUPPORTED_LOCALES,
  SUPPORTED_CURRENCIES,
  CURRENCY_CONFIG,
  TIMEZONES,
  TRANSLATIONS,
  formatCurrency,
  formatDate,
  convertTimezone,
  getLocaleFromAcceptLanguage,
};
