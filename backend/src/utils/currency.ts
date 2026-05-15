export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
  exchangeRate: number;
  locale?: string;
  symbolPosition: 'before' | 'after';
}

export interface ConversionResult {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: Date;
}

export interface FormattedCurrency {
  value: string;
  symbol: string;
  code: string;
  decimalPlaces: number;
}

export interface CurrencyRates {
  base: string;
  rates: Record<string, number>;
  timestamp: Date;
}

const defaultExchangeRates: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  INR: 83.12,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.38,
  OMR: 0.38,
  JOD: 0.71,
  EGP: 30.9,
  TRY: 32.15,
  CNY: 7.24,
  JPY: 155.5,
  KRW: 1350.0,
  AUD: 1.53,
  CAD: 1.36,
  CHF: 0.9,
  MXN: 17.15,
  BRL: 5.05,
  RUB: 92.5,
  THB: 35.8,
  SGD: 1.35,
  HKD: 7.82,
  NZD: 1.64,
  SEK: 10.45,
  NOK: 10.65,
  DKK: 6.87,
  PLN: 3.98,
  ZAR: 18.75,
};

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    decimalPlaces: 2,
    exchangeRate: 1.0,
    locale: 'en-US',
    symbolPosition: 'before',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    decimalPlaces: 2,
    exchangeRate: 0.92,
    locale: 'de-DE',
    symbolPosition: 'after',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    decimalPlaces: 2,
    exchangeRate: 0.79,
    locale: 'en-GB',
    symbolPosition: 'before',
  },
  AED: {
    code: 'AED',
    symbol: 'د.إ',
    name: 'UAE Dirham',
    decimalPlaces: 2,
    exchangeRate: 3.67,
    locale: 'ar-AE',
    symbolPosition: 'after',
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    decimalPlaces: 2,
    exchangeRate: 83.12,
    locale: 'en-IN',
    symbolPosition: 'before',
  },
  SAR: {
    code: 'SAR',
    symbol: 'ر.س',
    name: 'Saudi Riyal',
    decimalPlaces: 2,
    exchangeRate: 3.75,
    locale: 'ar-SA',
    symbolPosition: 'after',
  },
  QAR: {
    code: 'QAR',
    symbol: 'ر.ق',
    name: 'Qatari Riyal',
    decimalPlaces: 2,
    exchangeRate: 3.64,
    locale: 'ar-QA',
    symbolPosition: 'after',
  },
  KWD: {
    code: 'KWD',
    symbol: 'د.ك',
    name: 'Kuwaiti Dinar',
    decimalPlaces: 3,
    exchangeRate: 0.31,
    locale: 'ar-KW',
    symbolPosition: 'after',
  },
  BHD: {
    code: 'BHD',
    symbol: 'د.ب',
    name: 'Bahraini Dinar',
    decimalPlaces: 3,
    exchangeRate: 0.38,
    locale: 'ar-BH',
    symbolPosition: 'after',
  },
  OMR: {
    code: 'OMR',
    symbol: 'ر.ع',
    name: 'Omani Rial',
    decimalPlaces: 3,
    exchangeRate: 0.38,
    locale: 'ar-OM',
    symbolPosition: 'after',
  },
  CNY: {
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan',
    decimalPlaces: 2,
    exchangeRate: 7.24,
    locale: 'zh-CN',
    symbolPosition: 'before',
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    decimalPlaces: 0,
    exchangeRate: 155.5,
    locale: 'ja-JP',
    symbolPosition: 'before',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    decimalPlaces: 2,
    exchangeRate: 1.53,
    locale: 'en-AU',
    symbolPosition: 'before',
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    name: 'Canadian Dollar',
    decimalPlaces: 2,
    exchangeRate: 1.36,
    locale: 'en-CA',
    symbolPosition: 'before',
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Swiss Franc',
    decimalPlaces: 2,
    exchangeRate: 0.9,
    locale: 'de-CH',
    symbolPosition: 'before',
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    decimalPlaces: 2,
    exchangeRate: 1.35,
    locale: 'en-SG',
    symbolPosition: 'before',
  },
  HKD: {
    code: 'HKD',
    symbol: 'HK$',
    name: 'Hong Kong Dollar',
    decimalPlaces: 2,
    exchangeRate: 7.82,
    locale: 'en-HK',
    symbolPosition: 'before',
  },
  EGP: {
    code: 'EGP',
    symbol: 'ج.م',
    name: 'Egyptian Pound',
    decimalPlaces: 2,
    exchangeRate: 30.9,
    locale: 'ar-EG',
    symbolPosition: 'after',
  },
  TRY: {
    code: 'TRY',
    symbol: '₺',
    name: 'Turkish Lira',
    decimalPlaces: 2,
    exchangeRate: 32.15,
    locale: 'tr-TR',
    symbolPosition: 'after',
  },
};

export const DEFAULT_CURRENCY = 'USD';

export const DEFAULT_LOCALE_CURRENCIES: Record<string, string> = {
  'en-US': 'USD',
  'en-GB': 'GBP',
  'en-AU': 'AUD',
  'en-CA': 'CAD',
  'de-DE': 'EUR',
  'de-AT': 'EUR',
  'de-CH': 'CHF',
  'fr-FR': 'EUR',
  'fr-CA': 'CAD',
  'fr-CH': 'CHF',
  'es-ES': 'EUR',
  'es-MX': 'MXN',
  'ar-AE': 'AED',
  'ar-SA': 'SAR',
  'ar-KW': 'KWD',
  'ar-BH': 'BHD',
  'ar-OM': 'OMR',
  'ar-QA': 'QAR',
  'ar-EG': 'EGP',
  'zh-CN': 'CNY',
  'zh-TW': 'TWD',
  'ja-JP': 'JPY',
  'ko-KR': 'KRW',
  'hi-IN': 'INR',
  'pt-BR': 'BRL',
  'ru-RU': 'RUB',
  'th-TH': 'THB',
  'nl-NL': 'EUR',
  'pl-PL': 'PLN',
  'tr-TR': 'TRY',
  'sv-SE': 'SEK',
  'nb-NO': 'NOK',
  'da-DK': 'DKK',
};

class CurrencyService {
  private exchangeRates: Record<string, number>;
  private ratesTimestamp: Date;
  private baseCurrency: string;
  private cacheExpiry: number;
  private lastFetchTime: Date | null;

  constructor() {
    this.exchangeRates = { ...defaultExchangeRates };
    this.ratesTimestamp = new Date();
    this.baseCurrency = 'USD';
    this.cacheExpiry = 60 * 60 * 1000;
    this.lastFetchTime = null;
  }

  public getCurrencyConfig(code: string): CurrencyConfig | undefined {
    return SUPPORTED_CURRENCIES[code];
  }

  public getSupportedCurrencies(): CurrencyConfig[] {
    return Object.values(SUPPORTED_CURRENCIES);
  }

  public getSupportedCurrencyCodes(): string[] {
    return Object.keys(SUPPORTED_CURRENCIES);
  }

  public isSupportedCurrency(code: string): boolean {
    return code in SUPPORTED_CURRENCIES;
  }

  public getBaseCurrency(): string {
    return this.baseCurrency;
  }

  public setBaseCurrency(currency: string): void {
    if (this.isSupportedCurrency(currency)) {
      this.baseCurrency = currency;
    } else {
      throw new Error(`Currency ${currency} is not supported`);
    }
  }

  public getExchangeRate(fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const fromRate = this.exchangeRates[fromCurrency];
    const toRate = this.exchangeRates[toCurrency];

    if (!fromRate || !toRate) {
      throw new Error(`Exchange rate not found for ${fromCurrency} or ${toCurrency}`);
    }

    return toRate / fromRate;
  }

  public convert(amount: number, fromCurrency: string, toCurrency: string): ConversionResult {
    if (fromCurrency === toCurrency) {
      return {
        amount,
        fromCurrency,
        toCurrency,
        rate: 1,
        timestamp: new Date(),
      };
    }

    const rate = this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * rate;

    return {
      amount: this.round(convertedAmount, SUPPORTED_CURRENCIES[toCurrency]?.decimalPlaces ?? 2),
      fromCurrency,
      toCurrency,
      rate,
      timestamp: new Date(),
    };
  }

  public convertToBase(amount: number, fromCurrency: string): number {
    const rate = this.getExchangeRate(fromCurrency, this.baseCurrency);
    return this.round(amount * rate, 2);
  }

  public convertFromBase(amount: number, toCurrency: string): number {
    const rate = this.getExchangeRate(this.baseCurrency, toCurrency);
    return this.round(amount * rate, SUPPORTED_CURRENCIES[toCurrency]?.decimalPlaces ?? 2);
  }

  public format(
    amount: number,
    currencyCode: string,
    locale?: string,
    options?: { showSymbol?: boolean; showCode?: boolean }
  ): string {
    const config = this.getCurrencyConfig(currencyCode);
    if (!config) {
      return amount.toFixed(2);
    }

    const formatLocale = locale || config.locale || 'en-US';
    const decimalPlaces = config.decimalPlaces;

    const formattedNumber = new Intl.NumberFormat(formatLocale, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(this.round(amount, decimalPlaces));

    const showSymbol = options?.showSymbol ?? true;
    const showCode = options?.showCode ?? false;

    let result: string;

    if (showSymbol) {
      if (config.symbolPosition === 'before') {
        result = `${config.symbol}${formattedNumber}`;
      } else {
        result = `${formattedNumber} ${config.symbol}`;
      }
    } else {
      result = formattedNumber;
    }

    if (showCode && currencyCode !== config.symbol) {
      result = `${result} ${currencyCode}`;
    }

    return result;
  }

  public formatWithSymbol(amount: number, currencyCode: string, locale?: string): string {
    return this.format(amount, currencyCode, locale, { showSymbol: true, showCode: false });
  }

  public formatWithCode(amount: number, currencyCode: string, locale?: string): string {
    return this.format(amount, currencyCode, locale, { showSymbol: true, showCode: true });
  }

  public parse(value: string, currencyCode: string): number | null {
    const config = this.getCurrencyConfig(currencyCode);
    if (!config) {
      return null;
    }

    const cleanedValue = value
      .replace(/[^\d.,\-]/g, '')
      .replace(config.symbol, '')
      .trim();

    const decimalSeparator = cleanedValue.includes(',') && cleanedValue.includes('.')
      ? (cleanedValue.lastIndexOf(',') > cleanedValue.lastIndexOf('.') ? ',' : '.')
      : cleanedValue.includes(',') ? ',' : '.';

    const normalizedValue = cleanedValue.replace(decimalSeparator === ',' ? /[.\s]/g : /[,\s]/g, '');

    const normalizedDecimal = decimalSeparator === ',' ? normalizedValue.replace(',', '.') : normalizedValue;

    const parsedValue = parseFloat(normalizedDecimal);

    return isNaN(parsedValue) ? null : parsedValue;
  }

  public round(value: number, decimalPlaces: number): number {
    const multiplier = Math.pow(10, decimalPlaces);
    return Math.round(value * multiplier) / multiplier;
  }

  public add(amount1: number, currency1: string, amount2: number, currency2: string): number {
    const baseAmount1 = this.convertToBase(amount1, currency1);
    const baseAmount2 = this.convertToBase(amount2, currency2);
    return this.round(baseAmount1 + baseAmount2, 2);
  }

  public subtract(amount1: number, currency1: string, amount2: number, currency2: string): number {
    const baseAmount1 = this.convertToBase(amount1, currency1);
    const baseAmount2 = this.convertToBase(amount2, currency2);
    return this.round(baseAmount1 - baseAmount2, 2);
  }

  public multiply(amount: number, multiplier: number): number {
    return this.round(amount * multiplier, 2);
  }

  public divide(amount: number, divisor: number): number {
    if (divisor === 0) {
      throw new Error('Division by zero');
    }
    return this.round(amount / divisor, 2);
  }

  public sum(amounts: Array<{ amount: number; currency: string }>, targetCurrency: string): number {
    let total = 0;
    for (const { amount, currency } of amounts) {
      const converted = this.convert(amount, currency, targetCurrency);
      total += converted.amount;
    }
    return this.round(total, SUPPORTED_CURRENCIES[targetCurrency]?.decimalPlaces ?? 2);
  }

  public applyTax(amount: number, taxRate: number, currencyCode: string): { subtotal: number; tax: number; total: number } {
    const subtotal = amount;
    const tax = this.round(amount * taxRate, SUPPORTED_CURRENCIES[currencyCode]?.decimalPlaces ?? 2);
    const total = this.round(subtotal + tax, SUPPORTED_CURRENCIES[currencyCode]?.decimalPlaces ?? 2);
    return { subtotal, tax, total };
  }

  public applyDiscount(
    amount: number,
    discount: number,
    currencyCode: string,
    discountType: 'percentage' | 'fixed' = 'percentage'
  ): { originalAmount: number; discount: number; finalAmount: number } {
    const discountAmount = discountType === 'percentage'
      ? this.round(amount * (discount / 100), SUPPORTED_CURRENCIES[currencyCode]?.decimalPlaces ?? 2)
      : discount;
    const finalAmount = this.round(amount - discountAmount, SUPPORTED_CURRENCIES[currencyCode]?.decimalPlaces ?? 2);
    return {
      originalAmount: amount,
      discount: discountAmount,
      finalAmount: finalAmount,
    };
  }

  public getCurrencyForLocale(locale: string): string {
    return DEFAULT_LOCALE_CURRENCIES[locale] || DEFAULT_CURRENCY;
  }

  public getExchangeRates(): CurrencyRates {
    return {
      base: this.baseCurrency,
      rates: { ...this.exchangeRates },
      timestamp: this.ratesTimestamp,
    };
  }

  public async updateExchangeRates(rates: Record<string, number>): Promise<void> {
    this.exchangeRates = { ...defaultExchangeRates, ...rates };
    this.ratesTimestamp = new Date();
    this.lastFetchTime = new Date();
  }

  public async refreshRates(): Promise<boolean> {
    try {
      this.ratesTimestamp = new Date();
      return true;
    } catch {
      return false;
    }
  }

  public areRatesStale(): boolean {
    if (!this.lastFetchTime) {
      return true;
    }
    return Date.now() - this.lastFetchTime.getTime() > this.cacheExpiry;
  }

  public getCurrencySymbol(code: string): string {
    return SUPPORTED_CURRENCIES[code]?.symbol || code;
  }

  public getCurrencyName(code: string): string {
    return SUPPORTED_CURRENCIES[code]?.name || code;
  }

  public getCurrencyDecimalPlaces(code: string): number {
    return SUPPORTED_CURRENCIES[code]?.decimalPlaces ?? 2;
  }

  public getLocaleForCurrency(currencyCode: string): string {
    return SUPPORTED_CURRENCIES[currencyCode]?.locale || 'en-US';
  }

  public compare(amount1: number, currency1: string, amount2: number, currency2: string): number {
    const baseAmount1 = this.convertToBase(amount1, currency1);
    const baseAmount2 = this.convertToBase(amount2, currency2);
    return baseAmount1 - baseAmount2;
  }

  public isGreaterThan(amount1: number, currency1: string, amount2: number, currency2: string): boolean {
    return this.compare(amount1, currency1, amount2, currency2) > 0;
  }

  public isLessThan(amount1: number, currency1: string, amount2: number, currency2: string): boolean {
    return this.compare(amount1, currency1, amount2, currency2) < 0;
  }

  public isEqual(amount1: number, currency1: string, amount2: number, currency2: string): boolean {
    return this.compare(amount1, currency1, amount2, currency2) === 0;
  }

  public parseAmountInput(input: string, currencyCode: string): { valid: boolean; value: number | null; error?: string } {
    const config = this.getCurrencyConfig(currencyCode);
    if (!config) {
      return { valid: false, value: null, error: 'Unsupported currency' };
    }

    const cleanedInput = input.replace(/[^\d.,\-]/g, '').trim();

    if (!cleanedInput) {
      return { valid: false, value: null, error: 'Empty input' };
    }

    const decimalSeparator = cleanedInput.includes(',') && cleanedInput.includes('.')
      ? (cleanedInput.lastIndexOf(',') > cleanedInput.lastIndexOf('.') ? ',' : '.')
      : cleanedInput.includes(',') ? ',' : '.';

    const normalizedValue = cleanedInput.replace(decimalSeparator === ',' ? /[.\s]/g : /[,\s]/g, '');

    const normalizedDecimal = decimalSeparator === ',' ? normalizedValue.replace(',', '.') : normalizedValue;

    const parsedValue = parseFloat(normalizedDecimal);

    if (isNaN(parsedValue)) {
      return { valid: false, value: null, error: 'Invalid number format' };
    }

    if (parsedValue < 0) {
      return { valid: false, value: null, error: 'Amount cannot be negative' };
    }

    const decimalParts = normalizedDecimal.split('.');
    const decimalCount = decimalParts.length > 1 ? decimalParts[1].length : 0;

    if (decimalCount > config.decimalPlaces) {
      return {
        valid: true,
        value: this.round(parsedValue, config.decimalPlaces),
        error: `Rounded to ${config.decimalPlaces} decimal places`,
      };
    }

    return { valid: true, value: parsedValue };
  }

  public calculateTotal(
    items: Array<{ amount: number; currency: string; quantity: number }>,
    targetCurrency: string
  ): { subtotal: number; currency: string } {
    const subtotal = this.sum(
      items.map((item) => ({
        amount: item.amount * item.quantity,
        currency: item.currency,
      })),
      targetCurrency
    );
    return { subtotal, currency: targetCurrency };
  }

  public validateAmount(amount: number, currencyCode: string): { valid: boolean; error?: string } {
    if (!this.isSupportedCurrency(currencyCode)) {
      return { valid: false, error: `Unsupported currency: ${currencyCode}` };
    }

    if (isNaN(amount)) {
      return { valid: false, error: 'Invalid amount' };
    }

    if (!isFinite(amount)) {
      return { valid: false, error: 'Amount must be a finite number' };
    }

    if (amount < 0) {
      return { valid: false, error: 'Amount cannot be negative' };
    }

    return { valid: true };
  }
}

export const currencyService = new CurrencyService();
export default currencyService;
