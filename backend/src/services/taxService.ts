import mongoose, { Types, Schema as MongooseSchema } from 'mongoose';
import { Commission } from '../models/commission.model';
import logger from '../utils/logger';

// Tax Configuration Interface
export interface TaxConfig {
  region: string;
  rate: number;
  type: 'gst' | 'vat' | 'sales_tax' | 'custom';
  threshold: number; // Minimum amount for tax to apply
  includedInPrice: boolean; // Whether tax is already included in price
  name: string; // Display name (e.g., "VAT", "GST", "Sales Tax")
  registrationNumber?: string; // Business tax registration number
  applicableTo: 'booking' | 'commission' | 'payout' | 'all';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Tax Calculation Result
export interface TaxCalculationResult {
  grossAmount: number;
  taxRate: number;
  taxType: TaxConfig['type'];
  taxAmount: number;
  netAmount: number;
  currency: string;
  region: string;
  calculatedAt: Date;
}

// Tax Document/Invoice Interface
export interface TaxDocument {
  _id: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  type: 'invoice' | 'receipt' | 'tax_certificate' | '1099' | 'annual_statement';
  period: {
    start: Date;
    end: Date;
  };
  documentNumber: string;
  // Provider details
  providerDetails: {
    name: string;
    address?: string;
    taxRegistrationNumber?: string;
    email: string;
  };
  // Customer details (for invoices)
  customerDetails?: {
    name: string;
    address?: string;
    taxId?: string;
    email: string;
  };
  // Line items
  lineItems: Array<{
    description: string;
    bookingId?: mongoose.Types.ObjectId;
    bookingNumber?: string;
    amount: number;
    taxRate: number;
    taxAmount: number;
    date: Date;
  }>;
  // Summary
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  currency: string;
  // Tax calculation details
  taxBreakdown: Array<{
    type: TaxConfig['type'];
    rate: number;
    taxableAmount: number;
    taxAmount: number;
  }>;
  // Status
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  issuedAt?: Date;
  paidAt?: Date;
  // Metadata
  metadata?: {
    invoiceId?: string; // External invoice ID
    paymentReference?: string;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Regional Tax Rates
const DEFAULT_TAX_RATES: Record<string, Omit<TaxConfig, 'createdAt' | 'updatedAt'>> = {
  AE: {
    region: 'AE',
    rate: 5, // UAE VAT rate
    type: 'vat',
    threshold: 375000, // AED threshold (in dirhams)
    includedInPrice: false,
    name: 'Value Added Tax (VAT)',
    applicableTo: 'booking',
    isActive: true,
  },
  IN: {
    region: 'IN',
    rate: 18, // India GST rate (can vary by service)
    type: 'gst',
    threshold: 0, // No threshold for GST
    includedInPrice: false,
    name: 'Goods and Services Tax (GST)',
    applicableTo: 'all',
    isActive: true,
  },
  UK: {
    region: 'UK',
    rate: 20, // UK VAT rate
    type: 'vat',
    threshold: 85000, // GBP threshold
    includedInPrice: false,
    name: 'Value Added Tax (VAT)',
    applicableTo: 'booking',
    isActive: true,
  },
  US: {
    region: 'US',
    rate: 0, // No federal sales tax - varies by state
    type: 'sales_tax',
    threshold: 0,
    includedInPrice: false,
    name: 'Sales Tax',
    applicableTo: 'booking',
    isActive: true,
  },
  SA: {
    region: 'SA',
    rate: 15, // Saudi Arabia VAT rate
    type: 'vat',
    threshold: 0,
    includedInPrice: false,
    name: 'Value Added Tax (VAT)',
    applicableTo: 'booking',
    isActive: true,
  },
};

// Tax Configuration Schema (for database storage)
const taxConfigSchema = new mongoose.Schema<TaxConfig>(
  {
    region: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      enum: ['AE', 'IN', 'UK', 'US', 'SA', 'EU', 'OTHER'],
    },
    rate: {
      type: Number,
      required: true,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%'],
    },
    type: {
      type: String,
      enum: ['gst', 'vat', 'sales_tax', 'custom'],
      required: true,
    },
    threshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    includedInPrice: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    registrationNumber: String,
    applicableTo: {
      type: String,
      enum: ['booking', 'commission', 'payout', 'all'],
      default: 'all',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'tax_configs',
  }
);

// Tax Document Schema
const taxDocumentSchema = new mongoose.Schema<TaxDocument>(
  {
    providerId: {
      type: MongooseSchema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['invoice', 'receipt', 'tax_certificate', '1099', 'annual_statement'],
      required: true,
    },
    period: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
    documentNumber: {
      type: String,
      required: true,
      unique: true,
    },
    providerDetails: {
      name: { type: String, required: true },
      address: String,
      taxRegistrationNumber: String,
      email: { type: String, required: true },
    },
    customerDetails: {
      name: String,
      address: String,
      taxId: String,
      email: String,
    },
    lineItems: [
      {
        description: { type: String, required: true },
        bookingId: { type: MongooseSchema.Types.ObjectId, ref: 'Booking' },
        bookingNumber: String,
        amount: { type: Number, required: true, min: 0 },
        taxRate: { type: Number, required: true, min: 0 },
        taxAmount: { type: Number, required: true, min: 0 },
        date: { type: Date, required: true },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    totalTax: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'AED',
      enum: ['AED', 'USD', 'INR', 'EUR', 'GBP', 'SAR'],
    },
    taxBreakdown: [
      {
        type: { type: String, enum: ['gst', 'vat', 'sales_tax', 'custom'] },
        rate: { type: Number, required: true },
        taxableAmount: { type: Number, required: true },
        taxAmount: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'issued', 'paid', 'cancelled'],
      default: 'draft',
    },
    issuedAt: Date,
    paidAt: Date,
    metadata: {
      invoiceId: String,
      paymentReference: String,
      notes: String,
    },
  },
  {
    timestamps: true,
    collection: 'tax_documents',
  }
);

// Mongoose Schemas for internal storage
const Schema = mongoose.Schema;

// Tax Configuration Model
export const TaxConfigModel: mongoose.Model<TaxConfig> = mongoose.model<TaxConfig>(
  'TaxConfig',
  taxConfigSchema
);

// Tax Document Model
export const TaxDocumentModel: mongoose.Model<TaxDocument> = mongoose.model<TaxDocument>(
  'TaxDocument',
  taxDocumentSchema
);

// Tax Service Class
export class TaxService {
  /**
   * Get tax configuration for a region
   */
  async getTaxConfig(region: string): Promise<TaxConfig | null> {
    const normalizedRegion = region.toUpperCase();

    // Try database first
    const dbConfig = await TaxConfigModel.findOne({
      region: normalizedRegion,
      isActive: true,
    });

    if (dbConfig) {
      return dbConfig;
    }

    // Fall back to defaults
    const defaultConfig = DEFAULT_TAX_RATES[normalizedRegion];
    if (defaultConfig) {
      return {
        ...defaultConfig,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TaxConfig;
    }

    // No tax configured for region
    return null;
  }

  /**
   * Calculate tax for an amount
   */
  async calculateTax(
    amount: number,
    region: string,
    options: {
      type?: 'booking' | 'commission' | 'payout';
      currency?: string;
      taxOverride?: number; // For manual override
    } = {}
  ): Promise<TaxCalculationResult> {
    const currency = options.currency || 'AED';
    const taxConfig = await this.getTaxConfig(region);

    // No tax applicable
    if (!taxConfig || !taxConfig.isActive || taxConfig.rate === 0) {
      return {
        grossAmount: amount,
        taxRate: 0,
        taxType: 'vat',
        taxAmount: 0,
        netAmount: amount,
        currency,
        region,
        calculatedAt: new Date(),
      };
    }

    // Check threshold
    if (amount < taxConfig.threshold) {
      return {
        grossAmount: amount,
        taxRate: 0,
        taxType: taxConfig.type,
        taxAmount: 0,
        netAmount: amount,
        currency,
        region,
        calculatedAt: new Date(),
      };
    }

    // Use override rate if provided
    const taxRate = options.taxOverride ?? taxConfig.rate;

    let taxAmount: number;
    let netAmount: number;

    if (taxConfig.includedInPrice) {
      // Tax is already included - extract it
      taxAmount = (amount * taxRate) / (100 + taxRate);
      netAmount = amount - taxAmount;
    } else {
      // Tax is added on top
      taxAmount = amount * (taxRate / 100);
      netAmount = amount + taxAmount;
    }

    // Round to 2 decimal places
    taxAmount = Math.round(taxAmount * 100) / 100;
    netAmount = Math.round(netAmount * 100) / 100;

    return {
      grossAmount: amount,
      taxRate,
      taxType: taxConfig.type,
      taxAmount,
      netAmount,
      currency,
      region,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate tax on provider commission (payout tax)
   */
  async calculateCommissionTax(
    commissionAmount: number,
    providerId: string | Types.ObjectId,
    region: string = 'AE'
  ): Promise<TaxCalculationResult> {
    const taxConfig = await this.getTaxConfig(region);

    // Check if tax applies to payouts
    if (!taxConfig || !taxConfig.isActive) {
      return {
        grossAmount: commissionAmount,
        taxRate: 0,
        taxType: 'vat',
        taxAmount: 0,
        netAmount: commissionAmount,
        currency: 'AED',
        region,
        calculatedAt: new Date(),
      };
    }

    if (taxConfig.applicableTo === 'booking') {
      // Tax does not apply to payouts
      return {
        grossAmount: commissionAmount,
        taxRate: 0,
        taxType: taxConfig.type,
        taxAmount: 0,
        netAmount: commissionAmount,
        currency: 'AED',
        region,
        calculatedAt: new Date(),
      };
    }

    // Apply tax to commission payout
    return this.calculateTax(commissionAmount, region, { type: 'payout' });
  }

  /**
   * Calculate tax for a booking
   */
  async calculateBookingTax(
    bookingAmount: number,
    region: string,
    currency: string = 'AED'
  ): Promise<TaxCalculationResult> {
    return this.calculateTax(bookingAmount, region, { type: 'booking', currency });
  }

  /**
   * Generate tax document number
   */
  private async generateDocumentNumber(type: TaxDocument['type']): Promise<string> {
    const prefix = {
      invoice: 'INV',
      receipt: 'RCP',
      tax_certificate: 'TAX',
      '1099': '1099',
      annual_statement: 'ANN',
    }[type];

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Get count for the month
    const countResult = await TaxDocumentModel.aggregate([
      {
        $match: {
          type,
          createdAt: {
            $gte: new Date(year, date.getMonth(), 1),
            $lt: new Date(year, date.getMonth() + 1, 1),
          },
        },
      },
      {
        $count: 'count',
      },
    ]);

    const count = (countResult[0]?.count || 0) + 1;
    const sequence = String(count).padStart(5, '0');

    return `${prefix}-${year}${month}-${sequence}`;
  }

  /**
   * Generate invoice for provider
   */
  async generateProviderInvoice(
    providerId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date,
    options: {
      customerInfo?: {
        name: string;
        address?: string;
        taxId?: string;
        email: string;
      };
    } = {}
  ): Promise<TaxDocument> {
    const providerObjectId =
      typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

    // Get provider details
    const User = mongoose.model('User');
    const provider = await User.findById(providerObjectId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    // Get commissions in period
    const commissions = await Commission.find({
      providerId: providerObjectId,
      'metadata.bookingDate': { $gte: startDate, $lte: endDate },
      status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
    });

    // Get region from provider or use default
    const region = (provider as any).address?.country || 'AE';
    const taxConfig = await this.getTaxConfig(region);

    // Build line items from commissions
    const lineItems: TaxDocument['lineItems'] = [];
    let subtotal = 0;
    let totalTax = 0;
    const taxBreakdown: TaxDocument['taxBreakdown'] = [];

    for (const comm of commissions) {
      const amount = comm.commissionAmount;
      const taxRate = taxConfig?.rate || 0;
      const taxAmount = taxRate > 0 ? Math.round((amount * taxRate / 100) * 100) / 100 : 0;

      lineItems.push({
        description: `Commission - ${comm.metadata?.serviceTitle || 'Service'} (${comm.bookingNumber})`,
        bookingId: comm.bookingId,
        bookingNumber: comm.bookingNumber,
        amount,
        taxRate,
        taxAmount,
        date: comm.calculatedAt,
      });

      subtotal += amount;
      totalTax += taxAmount;
    }

    // Build tax breakdown
    if (taxConfig && taxConfig.rate > 0) {
      taxBreakdown.push({
        type: taxConfig.type,
        rate: taxConfig.rate,
        taxableAmount: subtotal,
        taxAmount: totalTax,
      });
    }

    const totalAmount = subtotal + totalTax;

    // Generate document number
    const documentNumber = await this.generateDocumentNumber('invoice');

    // Create document
    const taxDocument = new TaxDocumentModel({
      providerId: providerObjectId,
      type: 'invoice',
      period: { start: startDate, end: endDate },
      documentNumber,
      providerDetails: {
        name: `${provider.firstName || ''} ${provider.lastName || ''}`.trim(),
        email: provider.email || '',
        taxRegistrationNumber: (provider as any).taxRegistrationNumber,
      },
      customerDetails: options.customerInfo,
      lineItems,
      subtotal,
      totalTax,
      totalAmount,
      currency: 'AED',
      taxBreakdown,
      status: 'draft',
    });

    await taxDocument.save();

    logger.info('Provider invoice generated', {
      documentId: taxDocument._id,
      documentNumber,
      providerId: providerObjectId,
      period: { start: startDate, end: endDate },
      totalAmount,
    });

    return taxDocument;
  }

  /**
   * Generate annual tax statement for provider
   */
  async generateAnnualTaxStatement(
    providerId: string | Types.ObjectId,
    year: number
  ): Promise<TaxDocument> {
    const providerObjectId =
      typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

    const startDate = new Date(year, 0, 1); // January 1
    const endDate = new Date(year, 11, 31, 23, 59, 59); // December 31

    // Get provider details
    const User = mongoose.model('User');
    const provider = await User.findById(providerObjectId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    // Get region
    const region = (provider as any).address?.country || 'AE';
    const taxConfig = await this.getTaxConfig(region);

    // Get all commissions for the year
    const commissions = await Commission.find({
      providerId: providerObjectId,
      'metadata.bookingDate': { $gte: startDate, $lte: endDate },
      status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
    });

    // Aggregate by month
    const monthlyData = new Map<string, { count: number; amount: number; tax: number }>();
    let totalGross = 0;
    let totalTax = 0;

    for (const comm of commissions) {
      const monthKey = new Date(comm.calculatedAt).toISOString().substring(0, 7); // YYYY-MM
      const existing = monthlyData.get(monthKey) || { count: 0, amount: 0, tax: 0 };

      const taxRate = taxConfig?.rate || 0;
      const taxAmount = taxRate > 0 ? Math.round((comm.commissionAmount * taxRate / 100) * 100) / 100 : 0;

      monthlyData.set(monthKey, {
        count: existing.count + 1,
        amount: existing.amount + comm.commissionAmount,
        tax: existing.tax + taxAmount,
      });

      totalGross += comm.commissionAmount;
      totalTax += taxAmount;
    }

    // Build line items (one per month)
    const lineItems: TaxDocument['lineItems'] = [];
    for (const [month, data] of monthlyData) {
      lineItems.push({
        description: `Commission earnings for ${month}`,
        amount: data.amount,
        taxRate: taxConfig?.rate || 0,
        taxAmount: data.tax,
        date: new Date(`${month}-01`),
      });
    }

    // Build tax breakdown
    const taxBreakdown: TaxDocument['taxBreakdown'] = [];
    if (taxConfig && taxConfig.rate > 0) {
      taxBreakdown.push({
        type: taxConfig.type,
        rate: taxConfig.rate,
        taxableAmount: totalGross,
        taxAmount: totalTax,
      });
    }

    // Generate document number
    const documentNumber = await this.generateDocumentNumber('annual_statement');

    const taxDocument = new TaxDocumentModel({
      providerId: providerObjectId,
      type: 'annual_statement',
      period: { start: startDate, end: endDate },
      documentNumber,
      providerDetails: {
        name: `${provider.firstName || ''} ${provider.lastName || ''}`.trim(),
        email: provider.email || '',
        taxRegistrationNumber: (provider as any).taxRegistrationNumber,
      },
      lineItems,
      subtotal: totalGross,
      totalTax,
      totalAmount: totalGross + totalTax,
      currency: 'AED',
      taxBreakdown,
      status: 'issued',
      issuedAt: new Date(),
    });

    await taxDocument.save();

    logger.info('Annual tax statement generated', {
      documentId: taxDocument._id,
      documentNumber,
      providerId: providerObjectId,
      year,
      totalGross,
      totalTax,
    });

    return taxDocument;
  }

  /**
   * Get tax documents for provider
   */
  async getProviderTaxDocuments(
    providerId: string | Types.ObjectId,
    options: {
      type?: TaxDocument['type'];
      year?: number;
      status?: TaxDocument['status'];
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ documents: TaxDocument[]; total: number; page: number; totalPages: number }> {
    const providerObjectId =
      typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { providerId: providerObjectId };

    if (options.type) {
      query.type = options.type;
    }

    if (options.status) {
      query.status = options.status;
    }

    if (options.year) {
      query['period.start'] = {
        $gte: new Date(options.year, 0, 1),
      };
      query['period.end'] = {
        $lte: new Date(options.year, 11, 31, 23, 59, 59),
      };
    }

    const [documents, total] = await Promise.all([
      TaxDocumentModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      TaxDocumentModel.countDocuments(query),
    ]);

    return {
      documents,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get tax document by ID
   */
  async getTaxDocumentById(documentId: string | Types.ObjectId): Promise<TaxDocument | null> {
    const objectId = typeof documentId === 'string' ? new Types.ObjectId(documentId) : documentId;
    return TaxDocumentModel.findById(objectId);
  }

  /**
   * Update tax configuration for a region
   */
  async updateTaxConfig(
    region: string,
    updates: Partial<Omit<TaxConfig, 'region' | 'createdAt' | 'updatedAt'>>
  ): Promise<TaxConfig> {
    const normalizedRegion = region.toUpperCase();

    const taxConfig = await TaxConfigModel.findOneAndUpdate(
      { region: normalizedRegion },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    logger.info('Tax configuration updated', {
      region: normalizedRegion,
      updates,
    });

    return taxConfig;
  }

  /**
   * Initialize default tax configurations
   */
  async initializeDefaultTaxConfigs(): Promise<void> {
    for (const [region, config] of Object.entries(DEFAULT_TAX_RATES)) {
      const existing = await TaxConfigModel.findOne({ region });
      if (!existing) {
        await TaxConfigModel.create({
          ...config,
        });
        logger.info('Default tax config created', { region, rate: config.rate });
      }
    }
  }
}

// Export singleton instance
export const taxService = new TaxService();

export default taxService;
