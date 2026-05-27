import Tenant from '../models/tenant.model';

// Tax rates by region
const TAX_RATES: Record<string, TaxConfig> = {
  UAE: { rate: 5, name: 'VAT', inclusive: false },
  KSA: { rate: 15, name: 'VAT', inclusive: false },
  INDIA: { rate: 18, name: 'GST', inclusive: false },
  UK: { rate: 20, name: 'VAT', inclusive: false },
  EU: { rate: 21, name: 'VAT', inclusive: false },
};

export interface TaxConfig {
  rate: number;
  name: string;
  inclusive: boolean;
}

export interface TaxCalculation {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  taxName: string;
}

class TaxService {
  /**
   * Calculate tax for an amount
   */
  calculateTax(
    amount: number,
    regionCode: string,
    inclusive: boolean = false
  ): TaxCalculation {
    const taxConfig = TAX_RATES[regionCode] || TAX_RATES.UAE;
    const rate = taxConfig.rate / 100;

    let subtotal: number;
    let taxAmount: number;

    if (inclusive) {
      // Price already includes tax
      subtotal = amount / (1 + rate);
      taxAmount = amount - subtotal;
    } else {
      // Tax is added on top
      subtotal = amount;
      taxAmount = amount * rate;
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxRate: taxConfig.rate,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round((subtotal + taxAmount) * 100) / 100,
      taxName: taxConfig.name,
    };
  }

  /**
   * Calculate tax from tenant
   */
  async calculateTenantTax(
    amount: number,
    tenantId: string,
    inclusive: boolean = false
  ): Promise<TaxCalculation> {
    const tenant = await Tenant.findById(tenantId);
    const regionCode = tenant?.region?.code || 'UAE';
    const tenantTaxConfig = tenant?.taxConfig;

    if (tenantTaxConfig && !tenantTaxConfig.enabled) {
      return {
        subtotal: amount,
        taxRate: 0,
        taxAmount: 0,
        total: amount,
        taxName: 'No Tax',
      };
    }

    return this.calculateTax(
      amount,
      regionCode,
      tenantTaxConfig?.inclusive || inclusive
    );
  }

  /**
   * Get tax rate for region
   */
  getTaxRate(regionCode: string): TaxConfig {
    return TAX_RATES[regionCode] || TAX_RATES.UAE;
  }

  /**
   * Get all supported tax rates
   */
  getAllTaxRates(): Record<string, TaxConfig> {
    return { ...TAX_RATES };
  }
}

export const taxService = new TaxService();
