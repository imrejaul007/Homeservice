/**
 * Money Value Object
 *
 * Immutable value object representing monetary amounts with currency.
 * Provides type-safe arithmetic and formatting operations.
 *
 * @module domain/value-objects/money
 */

/**
 * Supported currency codes
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'AED' | 'SAR';

/**
 * Currency configuration
 */
interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  decimals: number;
  name: string;
}

const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', decimals: 2, name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', decimals: 2, name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', decimals: 2, name: 'British Pound' },
  AED: { code: 'AED', symbol: 'د.إ', decimals: 2, name: 'UAE Dirham' },
  SAR: { code: 'SAR', symbol: 'ر.س', decimals: 2, name: 'Saudi Riyal' },
};

/**
 * Money value object class
 */
export class Money {
  private readonly _amount: number; // Stored in smallest unit (cents)
  private readonly _currency: CurrencyCode;

  /**
   * Create Money from amount in major currency unit (dollars, euros, etc.)
   */
  static fromDecimal(amount: number, currency: CurrencyCode): Money {
    const config = CURRENCIES[currency];
    const smallestUnit = Math.round(amount * Math.pow(10, config.decimals));
    return new Money(smallestUnit, currency);
  }

  /**
   * Create Money from smallest unit (cents)
   */
  static fromSmallestUnit(amount: number, currency: CurrencyCode): Money {
    return new Money(amount, currency);
  }

  /**
   * Create zero money
   */
  static zero(currency: CurrencyCode = 'USD'): Money {
    return new Money(0, currency);
  }

  /**
   * Create Money from string (e.g., "19.99")
   */
  static parse(value: string, currency: CurrencyCode): Money {
    const amount = parseFloat(value);
    if (isNaN(amount)) {
      throw new Error(`Invalid money string: ${value}`);
    }
    return Money.fromDecimal(amount, currency);
  }

  private constructor(amount: number, currency: CurrencyCode) {
    this._amount = Math.round(amount);
    this._currency = currency;
  }

  // Getters
  get amount(): number {
    return this._amount;
  }

  get currency(): CurrencyCode {
    return this._currency;
  }

  get currencyConfig(): CurrencyConfig {
    return CURRENCIES[this._currency];
  }

  /**
   * Get amount in decimal format (major currency unit)
   */
  toDecimal(): number {
    return this._amount / Math.pow(10, this.currencyConfig.decimals);
  }

  /**
   * Format for display
   */
  format(locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this._currency,
    }).format(this.toDecimal());
  }

  /**
   * Simple format with symbol
   */
  toString(): string {
    const decimal = this.toDecimal();
    const fixed = decimal.toFixed(this.currencyConfig.decimals);
    return `${this.currencyConfig.symbol}${fixed}`;
  }

  // Comparison operations

  /**
   * Check if equal to another Money
   */
  equals(other: Money): boolean {
    return this._amount === other._amount && this._currency === other._currency;
  }

  /**
   * Check if greater than another Money
   */
  greaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this._amount > other._amount;
  }

  /**
   * Check if greater than or equal to another Money
   */
  greaterThanOrEqual(other: Money): boolean {
    return this.equals(other) || this.greaterThan(other);
  }

  /**
   * Check if less than another Money
   */
  lessThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this._amount < other._amount;
  }

  /**
   * Check if less than or equal to another Money
   */
  lessThanOrEqual(other: Money): boolean {
    return this.equals(other) || this.lessThan(other);
  }

  /**
   * Check if zero
   */
  isZero(): boolean {
    return this._amount === 0;
  }

  /**
   * Check if positive
   */
  isPositive(): boolean {
    return this._amount > 0;
  }

  /**
   * Check if negative
   */
  isNegative(): boolean {
    return this._amount < 0;
  }

  // Arithmetic operations

  /**
   * Add another Money
   */
  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  /**
   * Subtract another Money
   */
  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  /**
   * Multiply by a number
   */
  multiply(factor: number): Money {
    return new Money(Math.round(this._amount * factor), this._currency);
  }

  /**
   * Divide by a number
   */
  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Cannot divide by zero');
    }
    return new Money(Math.round(this._amount / divisor), this._currency);
  }

  /**
   * Calculate percentage
   */
  percentage(percent: number): Money {
    return new Money(Math.round(this._amount * (percent / 100)), this._currency);
  }

  /**
   * Apply discount
   */
  discount(amount: Money): Money {
    return this.subtract(amount);
  }

  /**
   * Apply percentage discount
   */
  discountPercent(percent: number): Money {
    return this.subtract(this.percentage(percent));
  }

  /**
   * Add tax
   */
  addTax(taxRate: number): Money {
    const taxAmount = Math.round(this._amount * taxRate);
    return new Money(this._amount + taxAmount, this._currency);
  }

  // Helper methods
  private ensureSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(
        `Cannot operate on different currencies: ${this._currency} and ${other._currency}`
      );
    }
  }

  /**
   * Clone the Money object
   */
  clone(): Money {
    return new Money(this._amount, this._currency);
  }

  /**
   * Convert to JSON
   */
  toJSON(): { amount: number; currency: CurrencyCode } {
    return {
      amount: this._amount,
      currency: this._currency,
    };
  }

  /**
   * Convert to string representation
   */
  [Symbol.toStringTag](): string {
    return this.toString();
  }
}
