import { Request, Response } from 'express';
import { ApiError, ERROR_CODES } from '../utils/ApiError';

export interface LocaleConfig {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  timeFormat: '12h' | '24h';
  flag: string;
}

export interface TranslationValue {
  value: string;
  context?: string;
  description?: string;
}

export type TranslationNamespace = Record<string, TranslationValue | string | Record<string, unknown>>;
export type TranslationStore = Record<string, TranslationNamespace>;

class LocalizationService {
  private supportedLocales: Map<string, LocaleConfig>;
  private translations: Map<string, TranslationStore>;
  private defaultLocale: string;
  private fallbackLocale: string;

  constructor() {
    this.supportedLocales = new Map();
    this.translations = new Map();
    this.defaultLocale = 'en';
    this.fallbackLocale = 'en';
    this.initializeSupportedLocales();
    this.initializeDefaultTranslations();
  }

  private initializeSupportedLocales(): void {
    const locales: LocaleConfig[] = [
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        flag: '🇺🇸',
      },
      {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        direction: 'rtl',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        flag: '🇦🇪',
      },
      {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        direction: 'ltr',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        flag: '🇫🇷',
      },
      {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        direction: 'ltr',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        flag: '🇪🇸',
      },
      {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        direction: 'ltr',
        dateFormat: 'DD.MM.YYYY',
        timeFormat: '24h',
        flag: '🇩🇪',
      },
      {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文',
        direction: 'ltr',
        dateFormat: 'YYYY/MM/DD',
        timeFormat: '24h',
        flag: '🇨🇳',
      },
      {
        code: 'hi',
        name: 'Hindi',
        nativeName: 'हिन्दी',
        direction: 'ltr',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h',
        flag: '🇮🇳',
      },
    ];

    locales.forEach((locale) => {
      this.supportedLocales.set(locale.code, locale);
    });
  }

  private initializeDefaultTranslations(): void {
    const enTranslations: TranslationStore = {
      common: {
        welcome: 'Welcome',
        goodbye: 'Goodbye',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        confirm: 'Confirm',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        view: 'View',
        search: 'Search',
        filter: 'Filter',
        sort: 'Sort',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
        submit: 'Submit',
        close: 'Close',
        yes: 'Yes',
        no: 'No',
        all: 'All',
        none: 'None',
        select: 'Select',
        required: 'Required',
        optional: 'Optional',
        actions: 'Actions',
        status: 'Status',
        details: 'Details',
        home: 'Home',
        settings: 'Settings',
        profile: 'Profile',
        logout: 'Logout',
        login: 'Login',
        register: 'Register',
        forgotPassword: 'Forgot Password?',
        rememberMe: 'Remember Me',
        noData: 'No data available',
        retry: 'Retry',
        refresh: 'Refresh',
      },
      auth: {
        signIn: 'Sign In',
        signOut: 'Sign Out',
        signUp: 'Sign Up',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        firstName: 'First Name',
        lastName: 'Last Name',
        phone: 'Phone Number',
        forgotPasswordTitle: 'Reset Password',
        resetPassword: 'Reset Password',
        checkEmail: 'Check your email for reset instructions',
        passwordChanged: 'Password Changed Successfully',
        invalidCredentials: 'Invalid email or password',
        emailRequired: 'Email is required',
        passwordRequired: 'Password is required',
        passwordsMismatch: 'Passwords do not match',
        weakPassword: 'Password is too weak',
        emailTaken: 'Email is already registered',
        accountLocked: 'Account is locked',
        sessionExpired: 'Session expired. Please login again',
      },
      marketplace: {
        title: 'Marketplace',
        categories: 'Categories',
        products: 'Products',
        services: 'Services',
        featured: 'Featured',
        newArrivals: 'New Arrivals',
        bestSellers: 'Best Sellers',
        onSale: 'On Sale',
        addToCart: 'Add to Cart',
        buyNow: 'Buy Now',
        outOfStock: 'Out of Stock',
        inStock: 'In Stock',
        price: 'Price',
        quantity: 'Quantity',
        total: 'Total',
        subtotal: 'Subtotal',
        discount: 'Discount',
        shipping: 'Shipping',
        tax: 'Tax',
        checkout: 'Checkout',
        cart: 'Cart',
        wishlist: 'Wishlist',
        compare: 'Compare',
        reviews: 'Reviews',
        rating: 'Rating',
        description: 'Description',
        specifications: 'Specifications',
        relatedProducts: 'Related Products',
        recentlyViewed: 'Recently Viewed',
        noProductsFound: 'No products found',
        filterByPrice: 'Filter by Price',
        sortBy: 'Sort By',
        viewAll: 'View All',
        addToWishlist: 'Add to Wishlist',
        removeFromWishlist: 'Remove from Wishlist',
      },
      orders: {
        title: 'Orders',
        orderId: 'Order ID',
        orderDate: 'Order Date',
        orderStatus: 'Order Status',
        orderTotal: 'Order Total',
        orderHistory: 'Order History',
        trackOrder: 'Track Order',
        reorder: 'Reorder',
        cancelOrder: 'Cancel Order',
        orderPlaced: 'Order Placed',
        orderProcessing: 'Processing',
        orderShipped: 'Shipped',
        orderDelivered: 'Delivered',
        orderCancelled: 'Cancelled',
        orderRefunded: 'Refunded',
        deliveryAddress: 'Delivery Address',
        paymentMethod: 'Payment Method',
        orderSummary: 'Order Summary',
        estimatedDelivery: 'Estimated Delivery',
        noOrders: 'No orders yet',
        orderDetails: 'Order Details',
      },
      errors: {
        notFound: 'Not Found',
        serverError: 'Server Error',
        networkError: 'Network Error',
        unauthorized: 'Unauthorized',
        forbidden: 'Forbidden',
        badRequest: 'Bad Request',
        validationError: 'Validation Error',
        somethingWentWrong: 'Something went wrong',
        tryAgain: 'Please try again',
        pageNotFound: 'Page not found',
        resourceNotFound: 'Resource not found',
      },
      validation: {
        required: 'This field is required',
        invalidEmail: 'Invalid email address',
        invalidPhone: 'Invalid phone number',
        minLength: 'Minimum {min} characters required',
        maxLength: 'Maximum {max} characters allowed',
        invalidFormat: 'Invalid format',
        passwordsMustMatch: 'Passwords must match',
        invalidDate: 'Invalid date',
        minValue: 'Minimum value is {min}',
        maxValue: 'Maximum value is {max}',
      },
    };

    const arTranslations: TranslationStore = {
      common: {
        welcome: 'مرحباً',
        goodbye: 'وداعاً',
        loading: 'جاري التحميل...',
        error: 'خطأ',
        success: 'نجاح',
        cancel: 'إلغاء',
        confirm: 'تأكيد',
        save: 'حفظ',
        delete: 'حذف',
        edit: 'تعديل',
        view: 'عرض',
        search: 'بحث',
        filter: 'تصفية',
        sort: 'ترتيب',
        back: 'رجوع',
        next: 'التالي',
        previous: 'السابق',
        submit: 'إرسال',
        close: 'إغلاق',
        yes: 'نعم',
        no: 'لا',
        all: 'الكل',
        none: 'لا شيء',
        select: 'اختيار',
        required: 'مطلوب',
        optional: 'اختياري',
        actions: 'الإجراءات',
        status: 'الحالة',
        details: 'التفاصيل',
        home: 'الرئيسية',
        settings: 'الإعدادات',
        profile: 'الملف الشخصي',
        logout: 'تسجيل الخروج',
        login: 'تسجيل الدخول',
        register: 'التسجيل',
        forgotPassword: 'نسيت كلمة المرور؟',
        rememberMe: 'تذكرني',
        noData: 'لا توجد بيانات',
        retry: 'إعادة المحاولة',
        refresh: 'تحديث',
      },
      auth: {
        signIn: 'تسجيل الدخول',
        signOut: 'تسجيل الخروج',
        signUp: 'التسجيل',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        confirmPassword: 'تأكيد كلمة المرور',
        firstName: 'الاسم الأول',
        lastName: 'اسم العائلة',
        phone: 'رقم الهاتف',
        forgotPasswordTitle: 'إعادة تعيين كلمة المرور',
        resetPassword: 'إعادة تعيين كلمة المرور',
        checkEmail: 'تحقق من بريدك الإلكتروني للحصول على تعليمات إعادة التعيين',
        passwordChanged: 'تم تغيير كلمة المرور بنجاح',
        invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
        emailRequired: 'البريد الإلكتروني مطلوب',
        passwordRequired: 'كلمة المرور مطلوبة',
        passwordsMismatch: 'كلمات المرور غير متطابقة',
        weakPassword: 'كلمة المرور ضعيفة جداً',
        emailTaken: 'البريد الإلكتروني مسجل مسبقاً',
        accountLocked: 'الحساب مقفل',
        sessionExpired: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى',
      },
      marketplace: {
        title: 'السوق',
        categories: 'الفئات',
        products: 'المنتجات',
        services: 'الخدمات',
        featured: 'مميز',
        newArrivals: 'جديد',
        bestSellers: 'الأكثر مبيعاً',
        onSale: 'تخفيضات',
        addToCart: 'أضف للسلة',
        buyNow: 'اشتر الآن',
        outOfStock: 'نفذ من المخزون',
        inStock: 'متوفر',
        price: 'السعر',
        quantity: 'الكمية',
        total: 'الإجمالي',
        subtotal: 'المجموع الفرعي',
        discount: 'خصم',
        shipping: 'الشحن',
        tax: 'الضريبة',
        checkout: 'الدفع',
        cart: 'السلة',
        wishlist: 'قائمة الأمنيات',
        compare: 'مقارنة',
        reviews: 'المراجعات',
        rating: 'التقييم',
        description: 'الوصف',
        specifications: 'المواصفات',
        relatedProducts: 'منتجات ذات صلة',
        recentlyViewed: 'شاهدته مؤخراً',
        noProductsFound: 'لم يتم العثور على منتجات',
        filterByPrice: 'تصفية حسب السعر',
        sortBy: 'ترتيب حسب',
        viewAll: 'عرض الكل',
        addToWishlist: 'أضف إلى قائمة الأمنيات',
        removeFromWishlist: 'إزالة من قائمة الأمنيات',
      },
      orders: {
        title: 'الطلبات',
        orderId: 'رقم الطلب',
        orderDate: 'تاريخ الطلب',
        orderStatus: 'حالة الطلب',
        orderTotal: 'إجمالي الطلب',
        orderHistory: 'سجل الطلبات',
        trackOrder: 'تتبع الطلب',
        reorder: 'إعادة الطلب',
        cancelOrder: 'إلغاء الطلب',
        orderPlaced: 'تم الطلب',
        orderProcessing: 'قيد المعالجة',
        orderShipped: 'تم الشحن',
        orderDelivered: 'تم التوصيل',
        orderCancelled: 'ملغي',
        orderRefunded: 'تم الاسترداد',
        deliveryAddress: 'عنوان التوصيل',
        paymentMethod: 'طريقة الدفع',
        orderSummary: 'ملخص الطلب',
        estimatedDelivery: 'التوصيل المتوقع',
        noOrders: 'لا توجد طلبات بعد',
        orderDetails: 'تفاصيل الطلب',
      },
      errors: {
        notFound: 'غير موجود',
        serverError: 'خطأ في الخادم',
        networkError: 'خطأ في الشبكة',
        unauthorized: 'غير مصرح',
        forbidden: 'محظور',
        badRequest: 'طلب سيء',
        validationError: 'خطأ في التحقق',
        somethingWentWrong: 'حدث خطأ ما',
        tryAgain: 'يرجى المحاولة مرة أخرى',
        pageNotFound: 'الصفحة غير موجودة',
        resourceNotFound: 'المورد غير موجود',
      },
      validation: {
        required: 'هذا الحقل مطلوب',
        invalidEmail: 'عنوان البريد الإلكتروني غير صالح',
        invalidPhone: 'رقم الهاتف غير صالح',
        minLength: 'الحد الأدنى {min} أحرف مطلوب',
        maxLength: 'الحد الأقصى {max} أحرف مسموح',
        invalidFormat: 'تنسيق غير صالح',
        passwordsMustMatch: 'يجب أن تتطابق كلمات المرور',
        invalidDate: 'تاريخ غير صالح',
        minValue: 'الحد الأدنى للقيمة هو {min}',
        maxValue: 'الحد الأقصى للقيمة هو {max}',
      },
    };

    this.translations.set('en', enTranslations);
    this.translations.set('ar', arTranslations);
  }

  public getSupportedLocales(): LocaleConfig[] {
    return Array.from(this.supportedLocales.values());
  }

  public getSupportedLocaleCodes(): string[] {
    return Array.from(this.supportedLocales.keys());
  }

  public getLocaleConfig(localeCode: string): LocaleConfig | undefined {
    return this.supportedLocales.get(localeCode);
  }

  public isRTL(localeCode: string): boolean {
    const config = this.supportedLocales.get(localeCode);
    return config?.direction === 'rtl';
  }

  public isSupportedLocale(localeCode: string): boolean {
    return this.supportedLocales.has(localeCode);
  }

  public getDefaultLocale(): string {
    return this.defaultLocale;
  }

  public setDefaultLocale(localeCode: string): void {
    if (this.isSupportedLocale(localeCode)) {
      this.defaultLocale = localeCode;
    } else {
      throw ApiError.badRequest(`Locale ${localeCode} is not supported`, [], ERROR_CODES.INVALID_INPUT);
    }
  }

  public getFallbackLocale(): string {
    return this.fallbackLocale;
  }

  public normalizeLocaleCode(localeCode: string): string {
    if (this.isSupportedLocale(localeCode)) {
      return localeCode;
    }

    const baseLocale = localeCode.split('-')[0];
    if (this.isSupportedLocale(baseLocale)) {
      return baseLocale;
    }

    return this.defaultLocale;
  }

  public translate(
    key: string,
    locale: string,
    params?: Record<string, string | number>
  ): string {
    const normalizedLocale = this.normalizeLocaleCode(locale);
    const translationStore = this.translations.get(normalizedLocale);

    if (!translationStore) {
      return this.translate(key, this.fallbackLocale, params);
    }

    const keys = key.split('.');
    let value: unknown = translationStore;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        if (normalizedLocale !== this.fallbackLocale) {
          return this.translate(key, this.fallbackLocale, params);
        }
        return key;
      }
    }

    if (typeof value !== 'string') {
      if (normalizedLocale !== this.fallbackLocale) {
        return this.translate(key, this.fallbackLocale, params);
      }
      return key;
    }

    if (params) {
      return this.interpolate(value, params);
    }

    return value;
  }

  private interpolate(
    template: string,
    params: Record<string, string | number>
  ): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() ?? match;
    });
  }

  public t(key: string, locale?: string, params?: Record<string, string | number>): string {
    return this.translate(key, locale ?? this.defaultLocale, params);
  }

  public detectLocaleFromRequest(req: Request): string {
    const headers = req.headers;

    const cookieLocale = this.extractCookieLocale(req);
    if (cookieLocale) {
      return this.normalizeLocaleCode(cookieLocale);
    }

    const queryLocale = req.query.locale as string;
    if (queryLocale && this.isSupportedLocale(queryLocale)) {
      return this.normalizeLocaleCode(queryLocale);
    }

    const acceptLanguage = headers['accept-language'];
    if (acceptLanguage) {
      const detectedLocale = this.parseAcceptLanguage(acceptLanguage);
      if (detectedLocale) {
        return detectedLocale;
      }
    }

    return this.defaultLocale;
  }

  private extractCookieLocale(req: Request): string | null {
    const cookies = req.headers.cookie;
    if (!cookies) return null;

    const match = cookies.match(/locale=([^;]+)/);
    return match ? match[1] : null;
  }

  private parseAcceptLanguage(acceptLanguage: string): string | null {
    const languages = acceptLanguage
      .split(',')
      .map((lang) => {
        const [code, qValue] = lang.trim().split(';q=');
        return {
          code: code.trim(),
          quality: qValue ? parseFloat(qValue) : 1.0,
        };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const { code } of languages) {
      if (this.isSupportedLocale(code)) {
        return code;
      }

      const baseCode = code.split('-')[0];
      if (this.isSupportedLocale(baseCode)) {
        return baseCode;
      }
    }

    return null;
  }

  public setLocaleCookie(res: Response, locale: string): void {
    if (!this.isSupportedLocale(locale)) {
      locale = this.defaultLocale;
    }

    res.cookie('locale', locale, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  public addTranslations(
    locale: string,
    namespace: string,
    translations: Record<string, string>
  ): void {
    if (!this.translations.has(locale)) {
      this.translations.set(locale, {});
    }

    const translationStore = this.translations.get(locale)!;
    translationStore[namespace] = translations;
  }

  public getAllTranslations(locale: string): TranslationStore | null {
    const normalizedLocale = this.normalizeLocaleCode(locale);
    return this.translations.get(normalizedLocale) ?? null;
  }

  public getTranslationsForNamespace(locale: string, namespace: string): Record<string, string> {
    const normalizedLocale = this.normalizeLocaleCode(locale);
    const translationStore = this.translations.get(normalizedLocale);

    if (!translationStore) {
      const fallbackStore = this.translations.get(this.fallbackLocale);
      return (fallbackStore?.[namespace] as Record<string, string>) ?? {};
    }

    return (translationStore[namespace] as Record<string, string>) ?? {};
  }

  public formatCurrency(
    amount: number,
    currencyCode: string,
    locale?: string
  ): string {
    const localeCode = locale ?? this.defaultLocale;

    const currencyFormats: Record<string, { symbol: string; position: 'before' | 'after' }> = {
      USD: { symbol: '$', position: 'before' },
      EUR: { symbol: '€', position: 'after' },
      GBP: { symbol: '£', position: 'before' },
      AED: { symbol: 'د.إ', position: 'after' },
      INR: { symbol: '₹', position: 'before' },
    };

    const format = currencyFormats[currencyCode] ?? { symbol: currencyCode, position: 'before' };
    const formattedAmount = this.formatNumber(amount, localeCode);

    return format.position === 'before'
      ? `${format.symbol}${formattedAmount}`
      : `${formattedAmount} ${format.symbol}`;
  }

  public formatNumber(value: number, locale?: string): string {
    const localeCode = locale ?? this.defaultLocale;
    return new Intl.NumberFormat(localeCode).format(value);
  }

  public formatDate(date: Date | string, locale?: string, options?: Intl.DateTimeFormatOptions): string {
    const localeCode = locale ?? this.defaultLocale;
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    return new Intl.DateTimeFormat(localeCode, options ?? defaultOptions).format(dateObj);
  }

  public formatTime(date: Date | string, locale?: string, options?: Intl.DateTimeFormatOptions): string {
    const localeCode = locale ?? this.defaultLocale;
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
      hour12: localeCode === 'en',
    };

    return new Intl.DateTimeFormat(localeCode, options ?? defaultOptions).format(dateObj);
  }

  public formatDateTime(date: Date | string, locale?: string): string {
    const localeCode = locale ?? this.defaultLocale;
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    return new Intl.DateTimeFormat(localeCode, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: localeCode === 'en',
    }).format(dateObj);
  }

  public pluralize(
    count: number,
    locale: string,
    options: { zero?: string; one: string; two?: string; few?: string; many?: string; other: string }
  ): string {
    const localeCode = this.normalizeLocaleCode(locale);

    const pr = new Intl.PluralRules(localeCode);
    const rule = pr.select(count);

    switch (rule) {
      case 'zero':
        return options.zero ?? options.other;
      case 'one':
        return options.one;
      case 'two':
        return options.two ?? options.few ?? options.many ?? options.other;
      case 'few':
        return options.few ?? options.many ?? options.other;
      case 'many':
        return options.many ?? options.other;
      default:
        return options.other;
    }
  }

  public getRelativeTime(date: Date | string, locale?: string): string {
    const localeCode = locale ?? this.defaultLocale;
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

    const rtf = new Intl.RelativeTimeFormat(localeCode, { numeric: 'auto' });

    if (Math.abs(diffSec) < 60) {
      return rtf.format(-diffSec, 'second');
    }
    if (Math.abs(diffMin) < 60) {
      return rtf.format(-diffMin, 'minute');
    }
    if (Math.abs(diffHour) < 24) {
      return rtf.format(-diffHour, 'hour');
    }
    if (Math.abs(diffDay) < 7) {
      return rtf.format(-diffDay, 'day');
    }
    if (Math.abs(diffWeek) < 4) {
      return rtf.format(-diffWeek, 'week');
    }
    if (Math.abs(diffMonth) < 12) {
      return rtf.format(-diffMonth, 'month');
    }
    return rtf.format(-diffYear, 'year');
  }
}

export const localizationService = new LocalizationService();
export default localizationService;
