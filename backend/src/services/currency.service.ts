// Currency configurations
const CURRENCIES: Record<string, CurrencyConfig> = {
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', decimalPlaces: 2, exchangeRate: 1 },
  SAR: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', decimalPlaces: 2, exchangeRate: 1.02 },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimalPlaces: 2, exchangeRate: 22.5 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimalPlaces: 2, exchangeRate: 3.67 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimalPlaces: 2, exchangeRate: 3.4 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimalPlaces: 2, exchangeRate: 4.6 },
  BHD: { code: 'BHD', symbol: '.د.ب', name: 'Bahrain Dinar', decimalPlaces: 3, exchangeRate: 1.38 },
  KWD: { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', decimalPlaces: 3, exchangeRate: 1.12 },
  OMR: { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial', decimalPlaces: 3, exchangeRate: 1.41 },
  QAR: { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal', decimalPlaces: 2, exchangeRate: 1.34 },
  JOD: { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar', decimalPlaces: 3, exchangeRate: 2.67 },
  EGP: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', decimalPlaces: 2, exchangeRate: 0.12 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimalPlaces: 2, exchangeRate: 2.73 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimalPlaces: 2, exchangeRate: 2.45 },
};

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
  exchangeRate: number; // Rate to AED (base currency)
}

class CurrencyService {
  /**
   * Format amount with currency symbol
   */
  format(amount: number, currencyCode: string): string {
    const config = CURRENCIES[currencyCode];
    if (!config) return `${amount.toFixed(2)} ${currencyCode}`;

    const formatted = amount.toFixed(config.decimalPlaces);
    return `${config.symbol}${this.addThousandSeparators(formatted)}`;
  }

  /**
   * Convert amount between currencies
   */
  convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): number {
    const from = CURRENCIES[fromCurrency];
    const to = CURRENCIES[toCurrency];

    if (!from || !to) return amount;

    // Convert to base (AED), then to target
    const inBase = amount * from.exchangeRate;
    return inBase / to.exchangeRate;
  }

  /**
   * Get currency config
   */
  getCurrency(currencyCode: string): CurrencyConfig | undefined {
    return CURRENCIES[currencyCode];
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): CurrencyConfig[] {
    return Object.values(CURRENCIES);
  }

  /**
   * Format for locale
   */
  formatLocale(amount: number, currencyCode: string, locale: string): string {
    const config = CURRENCIES[currencyCode];
    if (!config) return amount.toString();

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  }

  private addThousandSeparators(value: string): string {
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
}

export const currencyService = new CurrencyService();
