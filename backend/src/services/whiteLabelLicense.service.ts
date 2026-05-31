import mongoose, { Types } from 'mongoose';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type LicenseTier = 'starter' | 'professional' | 'enterprise';
export type LicenseStatus = 'trial' | 'active' | 'suspended' | 'cancelled' | 'expired';
export type BillingCycle = 'monthly' | 'quarterly' | 'annually';

export interface WhiteLabelConfig {
  branding: {
    companyName: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily?: string;
    customCss?: string;
  };
  domain: {
    subdomain?: string;
    customDomain?: string;
    domainVerified: boolean;
    sslEnabled: boolean;
  };
  features: {
    customColors: boolean;
    customDomain: boolean;
    apiAccess: boolean;
    whiteLabelReports: boolean;
    customEmailTemplates: boolean;
    multiLanguage: boolean;
    analytics: boolean;
    apiRateLimit: number; // requests per minute
  };
  contact: {
    supportEmail: string;
    supportPhone?: string;
    website?: string;
  };
}

export interface License {
  _id?: Types.ObjectId;
  licenseId: string;
  licenseKey: string;
  organizationId: Types.ObjectId;
  organizationName: string;
  licenseTier: LicenseTier;
  status: LicenseStatus;
  billingCycle: BillingCycle;
  trialEndsAt?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  pricing: {
    basePrice: number;
    setupFee: number;
    userCount: number;
    pricePerUser: number;
    subtotal: number;
    discount: number;
    discountPercent: number;
    total: number;
    currency: string;
  };
  config: WhiteLabelConfig;
  usage: {
    activeUsers: number;
    maxUsers: number;
    apiCalls: number;
    apiCallsLimit: number;
    storage: number; // in MB
    storageLimit: number; // in MB
  };
  allowedCategories: Types.ObjectId[];
  restrictedFeatures: string[];
  metadata?: {
    partnerId?: string;
    referralCode?: string;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WhiteLabelInvoice {
  _id?: Types.ObjectId;
  invoiceId: string;
  invoiceNumber: string;
  licenseId: Types.ObjectId;
  licenseKey: string;
  organizationId: Types.ObjectId;
  organizationName: string;
  period: { start: Date; end: Date };
  billingCycle: BillingCycle;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  discount: number;
  discountPercent: number;
  tax: number;
  taxRate: number;
  total: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  dueDate: Date;
  paidAt?: Date;
  paymentMethod?: string;
  paymentReference?: string;
  createdAt: Date;
}

// ============================================
// Pricing Configuration
// ============================================

const TIER_PRICING: Record<LicenseTier, {
  monthly: number;
  quarterly: number;
  annually: number;
  setupFee: number;
  maxUsers: number;
  pricePerUser: number;
  features: string[];
}> = {
  starter: {
    monthly: 99,
    quarterly: 89,
    annually: 79,
    setupFee: 0,
    maxUsers: 5,
    pricePerUser: 10,
    features: [
      'Basic white labeling',
      'Custom subdomain',
      'Basic analytics',
      'Email support',
      '5 users included',
    ],
  },
  professional: {
    monthly: 299,
    quarterly: 269,
    annually: 239,
    setupFee: 199,
    maxUsers: 25,
    pricePerUser: 8,
    features: [
      'Full white labeling',
      'Custom domain',
      'Advanced analytics',
      'API access',
      'Priority support',
      '25 users included',
      'Custom email templates',
    ],
  },
  enterprise: {
    monthly: 999,
    quarterly: 899,
    annually: 799,
    setupFee: 499,
    maxUsers: -1, // unlimited
    pricePerUser: 5,
    features: [
      'Enterprise white labeling',
      'Multiple domains',
      'Full API access',
      'Dedicated support',
      'Unlimited users',
      'Custom integrations',
      'SLA guarantee',
      'Custom contracts',
    ],
  },
};

// ============================================
// White Label License Service
// ============================================

export class WhiteLabelLicenseService {
  private licenseModel: any;
  private invoiceModel: any;

  constructor() {
    this.initializeModels();
  }

  private initializeModels(): void {
    try {
      this.licenseModel = mongoose.models.WhiteLabelLicense || this.createLicenseSchema();
      this.invoiceModel = mongoose.models.WhiteLabelInvoice || this.createInvoiceSchema();
    } catch {
      this.licenseModel = this.createLicenseSchema();
      this.invoiceModel = this.createInvoiceSchema();
    }
  }

  private createLicenseSchema(): any {
    const LicenseSchema = new mongoose.Schema({
      licenseId: { type: String, required: true, unique: true },
      licenseKey: { type: String, required: true, unique: true },
      organizationId: { type: mongoose.Schema.Types.ObjectId, required: true },
      organizationName: { type: String, required: true },
      licenseTier: {
        type: String,
        enum: ['starter', 'professional', 'enterprise'],
        required: true,
      },
      status: {
        type: String,
        enum: ['trial', 'active', 'suspended', 'cancelled', 'expired'],
        default: 'trial',
      },
      billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'annually'],
        default: 'monthly',
      },
      trialEndsAt: Date,
      currentPeriodStart: { type: Date, required: true },
      currentPeriodEnd: { type: Date, required: true },
      pricing: {
        basePrice: { type: Number, required: true },
        setupFee: { type: Number, default: 0 },
        userCount: { type: Number, default: 1 },
        pricePerUser: { type: Number, default: 0 },
        subtotal: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        discountPercent: { type: Number, default: 0 },
        total: { type: Number, required: true },
        currency: { type: String, default: 'USD' },
      },
      config: {
        branding: {
          companyName: { type: String, required: true },
          logoUrl: String,
          faviconUrl: String,
          primaryColor: { type: String, default: '#6366f1' },
          secondaryColor: { type: String, default: '#8b5cf6' },
          accentColor: { type: String, default: '#ec4899' },
          fontFamily: String,
          customCss: String,
        },
        domain: {
          subdomain: String,
          customDomain: String,
          domainVerified: { type: Boolean, default: false },
          sslEnabled: { type: Boolean, default: false },
        },
        features: {
          customColors: { type: Boolean, default: false },
          customDomain: { type: Boolean, default: false },
          apiAccess: { type: Boolean, default: false },
          whiteLabelReports: { type: Boolean, default: false },
          customEmailTemplates: { type: Boolean, default: false },
          multiLanguage: { type: Boolean, default: false },
          analytics: { type: Boolean, default: false },
          apiRateLimit: { type: Number, default: 60 },
        },
        contact: {
          supportEmail: { type: String, required: true },
          supportPhone: String,
          website: String,
        },
      },
      usage: {
        activeUsers: { type: Number, default: 0 },
        maxUsers: { type: Number, default: 5 },
        apiCalls: { type: Number, default: 0 },
        apiCallsLimit: { type: Number, default: 1000 },
        storage: { type: Number, default: 0 },
        storageLimit: { type: Number, default: 1000 }, // MB
      },
      allowedCategories: [{ type: mongoose.Schema.Types.ObjectId }],
      restrictedFeatures: [String],
      metadata: {
        partnerId: String,
        referralCode: String,
        notes: String,
      },
    }, { timestamps: true });

    LicenseSchema.index({ licenseId: 1 }, { unique: true });
    LicenseSchema.index({ licenseKey: 1 }, { unique: true });
    LicenseSchema.index({ organizationId: 1 });
    LicenseSchema.index({ status: 1, currentPeriodEnd: 1 });

    return mongoose.model('WhiteLabelLicense', LicenseSchema);
  }

  private createInvoiceSchema(): any {
    const InvoiceSchema = new mongoose.Schema({
      invoiceId: { type: String, required: true, unique: true },
      invoiceNumber: { type: String, required: true, unique: true },
      licenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhiteLabelLicense', required: true },
      licenseKey: { type: String, required: true },
      organizationId: { type: mongoose.Schema.Types.ObjectId, required: true },
      organizationName: { type: String, required: true },
      period: {
        start: { type: Date, required: true },
        end: { type: Date, required: true },
      },
      billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'annually'],
        required: true,
      },
      lineItems: [{
        description: String,
        quantity: Number,
        unitPrice: Number,
        amount: Number,
      }],
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      discountPercent: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      taxRate: { type: Number, default: 0 },
      total: { type: Number, required: true },
      currency: { type: String, default: 'USD' },
      status: {
        type: String,
        enum: ['pending', 'paid', 'overdue', 'cancelled', 'refunded'],
        default: 'pending',
      },
      dueDate: { type: Date, required: true },
      paidAt: Date,
      paymentMethod: String,
      paymentReference: String,
    }, { timestamps: true });

    InvoiceSchema.index({ invoiceId: 1 }, { unique: true });
    InvoiceSchema.index({ licenseId: 1 });
    InvoiceSchema.index({ organizationId: 1 });
    InvoiceSchema.index({ status: 1, dueDate: 1 });

    return mongoose.model('WhiteLabelInvoice', InvoiceSchema);
  }

  // ============================================
  // Tier Management
  // ============================================

  /**
   * Get available license tiers
   */
  getTiers(): typeof TIER_PRICING {
    return TIER_PRICING;
  }

  /**
   * Calculate pricing for a tier and billing cycle
   */
  calculatePricing(tier: LicenseTier, billingCycle: BillingCycle, userCount: number): {
    basePrice: number;
    setupFee: number;
    userCount: number;
    pricePerUser: number;
    subtotal: number;
    discount: number;
    discountPercent: number;
    total: number;
    currency: string;
  } {
    const tierConfig = TIER_PRICING[tier];
    let basePrice = tierConfig[billingCycle];

    // Apply discount based on billing cycle
    let discountPercent = 0;
    if (billingCycle === 'quarterly') discountPercent = 10;
    if (billingCycle === 'annually') discountPercent = 20;

    // Calculate users (first N users included based on tier)
    const includedUsers = TIER_PRICING[tier].maxUsers;
    const additionalUsers = includedUsers === -1 ? 0 : Math.max(0, userCount - includedUsers);
    const userCost = additionalUsers * tierConfig.pricePerUser;

    const subtotal = basePrice + userCost + tierConfig.setupFee;
    const discount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
    const total = Math.round((subtotal - discount) * 100) / 100;

    return {
      basePrice,
      setupFee: tierConfig.setupFee,
      userCount,
      pricePerUser: tierConfig.pricePerUser,
      subtotal,
      discount,
      discountPercent,
      total,
      currency: 'USD',
    };
  }

  // ============================================
  // License Management
  // ============================================

  /**
   * Create a new white label license
   */
  async createLicense(data: {
    organizationId: string;
    organizationName: string;
    tier: LicenseTier;
    billingCycle?: BillingCycle;
    userCount?: number;
    config: Partial<WhiteLabelConfig>;
    metadata?: {
      partnerId?: string;
      referralCode?: string;
      notes?: string;
    };
    trialDays?: number;
  }): Promise<{ success: boolean; license?: License; error?: string }> {
    try {
      const licenseId = this.generateLicenseId();
      const licenseKey = this.generateLicenseKey();

      const billingCycle = data.billingCycle || 'monthly';
      const userCount = data.userCount || TIER_PRICING[data.tier].maxUsers;

      const pricing = this.calculatePricing(data.tier, billingCycle, userCount);

      const now = new Date();
      let currentPeriodStart = now;
      let currentPeriodEnd = new Date();

      let status: LicenseStatus = 'trial';
      let trialEndsAt: Date | undefined;

      if (data.trialDays && data.trialDays > 0) {
        trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + data.trialDays);
        currentPeriodEnd = trialEndsAt;
      } else {
        status = 'active';
        this.setPeriodEndDate(currentPeriodStart, currentPeriodEnd, billingCycle);
      }

      // Build default config
      const defaultConfig: WhiteLabelConfig = {
        branding: {
          companyName: data.organizationName,
          primaryColor: '#6366f1',
          secondaryColor: '#8b5cf6',
          accentColor: '#ec4899',
          ...data.config.branding,
        },
        domain: {
          subdomain: data.organizationName.toLowerCase().replace(/\s+/g, '-'),
          domainVerified: false,
          sslEnabled: false,
          ...data.config.domain,
        },
        features: this.getDefaultFeatures(data.tier),
        contact: data.config.contact || {
          supportEmail: `support@${data.organizationName.toLowerCase().replace(/\s+/g, '')}.com`,
        },
      };

      const license = new this.licenseModel({
        licenseId,
        licenseKey,
        organizationId: new Types.ObjectId(data.organizationId),
        organizationName: data.organizationName,
        licenseTier: data.tier,
        status,
        billingCycle,
        trialEndsAt,
        currentPeriodStart,
        currentPeriodEnd,
        pricing,
        config: defaultConfig,
        usage: {
          activeUsers: 0,
          maxUsers: TIER_PRICING[data.tier].maxUsers,
          apiCalls: 0,
          apiCallsLimit: this.getDefaultFeatures(data.tier).apiAccess ? 1000 : 100,
          storage: 0,
          storageLimit: data.tier === 'enterprise' ? 10000 : 1000,
        },
        metadata: data.metadata,
      });

      await license.save();

      logger.info('White label license created', {
        licenseId,
        licenseKey,
        organizationId: data.organizationId,
        tier: data.tier,
        status,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.WHITE_LABEL_LICENSE_CREATED, {
        licenseId,
        licenseKey,
        organizationId: data.organizationId,
        tier: data.tier,
        status,
      });

      return { success: true, license };
    } catch (error) {
      logger.error('Error creating white label license', {
        organizationId: data.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create license',
      };
    }
  }

  /**
   * Get license by ID
   */
  async getLicense(licenseId: string): Promise<License | null> {
    return this.licenseModel.findOne({ licenseId });
  }

  /**
   * Get license by license key
   */
  async getLicenseByKey(licenseKey: string): Promise<License | null> {
    return this.licenseModel.findOne({ licenseKey });
  }

  /**
   * Get organization's licenses
   */
  async getOrganizationLicenses(organizationId: string): Promise<License[]> {
    return this.licenseModel.find({ organizationId: new Types.ObjectId(organizationId) })
      .sort({ createdAt: -1 });
  }

  /**
   * Update license configuration
   */
  async updateConfig(
    licenseId: string,
    config: Partial<WhiteLabelConfig>
  ): Promise<{ success: boolean; license?: License; error?: string }> {
    try {
      const license = await this.licenseModel.findOne({ licenseId });
      if (!license) {
        return { success: false, error: 'License not found' };
      }

      // Merge config updates
      license.config = {
        ...license.config,
        branding: { ...license.config.branding, ...config.branding },
        domain: { ...license.config.domain, ...config.domain },
        features: { ...license.config.features, ...config.features },
        contact: { ...license.config.contact, ...config.contact },
      };

      await license.save();

      logger.info('White label license config updated', { licenseId });
      return { success: true, license };
    } catch (error) {
      logger.error('Error updating license config', {
        licenseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update config',
      };
    }
  }

  /**
   * Upgrade/downgrade license tier
   */
  async changeTier(
    licenseId: string,
    newTier: LicenseTier,
    newBillingCycle?: BillingCycle
  ): Promise<{ success: boolean; license?: License; error?: string; proration?: number }> {
    try {
      const license = await this.licenseModel.findOne({ licenseId });
      if (!license) {
        return { success: false, error: 'License not found' };
      }

      const billingCycle = newBillingCycle || license.billingCycle;
      const newPricing = this.calculatePricing(newTier, billingCycle, license.usage.activeUsers);

      // Calculate prorated amount (simplified)
      const daysRemaining = Math.ceil(
        (license.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      const totalDays = Math.ceil(
        (license.currentPeriodEnd.getTime() - license.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      const proration = Math.round(
        ((newPricing.total - license.pricing.total) * (daysRemaining / totalDays)) * 100
      ) / 100;

      license.licenseTier = newTier;
      license.billingCycle = billingCycle;
      license.pricing = newPricing;
      license.usage.maxUsers = TIER_PRICING[newTier].maxUsers;
      license.config.features = this.getDefaultFeatures(newTier);
      license.config.features.apiRateLimit = newTier === 'enterprise' ? 1000 : newTier === 'professional' ? 500 : 100;

      await license.save();

      logger.info('White label license tier changed', {
        licenseId,
        newTier,
        proration,
      });

      return { success: true, license, proration };
    } catch (error) {
      logger.error('Error changing license tier', {
        licenseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to change tier',
      };
    }
  }

  /**
   * Update usage statistics
   */
  async updateUsage(
    licenseId: string,
    usage: Partial<{
      activeUsers: number;
      apiCalls: number;
      storage: number;
    }>
  ): Promise<{ success: boolean; overLimit: boolean; error?: string }> {
    try {
      const license = await this.licenseModel.findOne({ licenseId });
      if (!license) {
        return { success: false, overLimit: false, error: 'License not found' };
      }

      if (usage.activeUsers !== undefined) {
        license.usage.activeUsers = usage.activeUsers;
        if (license.usage.maxUsers !== -1 && usage.activeUsers > license.usage.maxUsers) {
          return { success: true, overLimit: true, error: 'User limit exceeded' };
        }
      }

      if (usage.apiCalls !== undefined) {
        license.usage.apiCalls += usage.apiCalls;
        if (license.usage.apiCalls > license.usage.apiCallsLimit) {
          return { success: true, overLimit: true, error: 'API rate limit exceeded' };
        }
      }

      if (usage.storage !== undefined) {
        license.usage.storage += usage.storage;
        if (license.usage.storage > license.usage.storageLimit) {
          return { success: true, overLimit: true, error: 'Storage limit exceeded' };
        }
      }

      await license.save();
      return { success: true, overLimit: false };
    } catch (error) {
      logger.error('Error updating usage', {
        licenseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        overLimit: false,
        error: error instanceof Error ? error.message : 'Failed to update usage',
      };
    }
  }

  /**
   * Activate license (end trial or reactivate)
   */
  async activateLicense(licenseId: string): Promise<{ success: boolean; invoice?: WhiteLabelInvoice; error?: string }> {
    try {
      const license = await this.licenseModel.findOne({ licenseId });
      if (!license) {
        return { success: false, error: 'License not found' };
      }

      if (license.status === 'active') {
        return { success: false, error: 'License is already active' };
      }

      // Generate invoice
      const invoice = await this.generateInvoice(licenseId);
      if (!invoice) {
        return { success: false, error: 'Failed to generate invoice' };
      }

      // Activate license
      license.status = 'active';
      license.trialEndsAt = undefined;
      license.currentPeriodStart = new Date();
      this.setPeriodEndDate(license.currentPeriodStart, license.currentPeriodEnd, license.billingCycle);

      await license.save();

      logger.info('White label license activated', { licenseId, invoiceId: invoice.invoiceId });

      return { success: true, invoice };
    } catch (error) {
      logger.error('Error activating license', {
        licenseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate license',
      };
    }
  }

  /**
   * Suspend license
   */
  async suspendLicense(licenseId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const license = await this.licenseModel.findOneAndUpdate(
        { licenseId },
        { $set: { status: 'suspended' } },
        { new: true }
      );

      if (!license) {
        return { success: false, error: 'License not found' };
      }

      logger.info('White label license suspended', { licenseId, reason });
      return { success: true };
    } catch (error) {
      logger.error('Error suspending license', {
        licenseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to suspend license',
      };
    }
  }

  /**
   * Cancel license
   */
  async cancelLicense(licenseId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const license = await this.licenseModel.findOneAndUpdate(
        { licenseId },
        { $set: { status: 'cancelled' } },
        { new: true }
      );

      if (!license) {
        return { success: false, error: 'License not found' };
      }

      logger.info('White label license cancelled', { licenseId });
      return { success: true };
    } catch (error) {
      logger.error('Error cancelling license', {
        licenseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel license',
      };
    }
  }

  // ============================================
  // Domain Management
  // ============================================

  /**
   * Verify custom domain
   */
  async verifyDomain(licenseId: string, domain: string): Promise<{
    success: boolean;
    verificationSteps?: string[];
    error?: string;
  }> {
    try {
      const license = await this.licenseModel.findOne({ licenseId });
      if (!license) {
        return { success: false, error: 'License not found' };
      }

      if (!license.config.features.customDomain) {
        return { success: false, error: 'Custom domain not included in your plan' };
      }

      // Generate verification steps
      const verificationSteps = [
        `Add a CNAME record for "${domain}" pointing to "${license.config.domain.subdomain}.whitelabel.platform.com"`,
        'Wait 5-10 minutes for DNS propagation',
        'Click "Verify Domain" to complete setup',
      ];

      logger.info('Domain verification initiated', { licenseId, domain });
      return { success: true, verificationSteps };
    } catch (error) {
      logger.error('Error initiating domain verification', {
        licenseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate verification',
      };
    }
  }

  /**
   * Complete domain verification
   */
  async completeDomainVerification(licenseId: string, domain: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const license = await this.licenseModel.findOneAndUpdate(
        { licenseId, 'config.domain.customDomain': domain },
        {
          $set: {
            'config.domain.domainVerified': true,
            'config.domain.sslEnabled': true,
          },
        },
        { new: true }
      );

      if (!license) {
        return { success: false, error: 'License or domain not found' };
      }

      logger.info('Domain verification completed', { licenseId, domain });
      return { success: true };
    } catch (error) {
      logger.error('Error completing domain verification', {
        licenseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete verification',
      };
    }
  }

  // ============================================
  // Invoice Management
  // ============================================

  /**
   * Generate invoice for license
   */
  async generateInvoice(licenseId: string): Promise<WhiteLabelInvoice | null> {
    try {
      const license = await this.licenseModel.findOne({ licenseId });
      if (!license) {
        return null;
      }

      const invoiceId = this.generateInvoiceId();
      const invoiceNumber = `WL-${Date.now().toString(36).toUpperCase()}`;

      const lineItems = [
        {
          description: `${license.licenseTier.charAt(0).toUpperCase() + license.licenseTier.slice(1)} Plan (${license.billingCycle})`,
          quantity: 1,
          unitPrice: license.pricing.basePrice,
          amount: license.pricing.basePrice,
        },
      ];

      if (license.pricing.userCount > 0) {
        const includedUsers = TIER_PRICING[license.licenseTier as LicenseTier].maxUsers;
        const additionalUsers = includedUsers === -1 ? 0 : Math.max(0, license.pricing.userCount - includedUsers);
        if (additionalUsers > 0) {
          lineItems.push({
            description: `Additional users (${additionalUsers})`,
            quantity: additionalUsers,
            unitPrice: license.pricing.pricePerUser,
            amount: additionalUsers * license.pricing.pricePerUser,
          });
        }
      }

      if (license.pricing.setupFee > 0) {
        lineItems.push({
          description: 'Setup Fee',
          quantity: 1,
          unitPrice: license.pricing.setupFee,
          amount: license.pricing.setupFee,
        });
      }

      const taxRate = 0;
      const tax = Math.round(license.pricing.subtotal * taxRate * 100) / 100;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const invoice = new this.invoiceModel({
        invoiceId,
        invoiceNumber,
        licenseId: license._id,
        licenseKey: license.licenseKey,
        organizationId: license.organizationId,
        organizationName: license.organizationName,
        period: {
          start: license.currentPeriodStart,
          end: license.currentPeriodEnd,
        },
        billingCycle: license.billingCycle,
        lineItems,
        subtotal: license.pricing.subtotal,
        discount: license.pricing.discount,
        discountPercent: license.pricing.discountPercent,
        tax,
        taxRate,
        total: license.pricing.total,
        currency: license.pricing.currency,
        status: 'pending',
        dueDate,
      });

      await invoice.save();
      return invoice;
    } catch (error) {
      logger.error('Error generating invoice', {
        licenseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get license invoices
   */
  async getLicenseInvoices(licenseId: string): Promise<WhiteLabelInvoice[]> {
    return this.invoiceModel.find({ licenseId: new Types.ObjectId(licenseId) })
      .sort({ createdAt: -1 });
  }

  // ============================================
  // Helper Methods
  // ============================================

  private setPeriodEndDate(start: Date, end: Date, billingCycle: BillingCycle): void {
    end.setTime(start.getTime());
    switch (billingCycle) {
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'quarterly':
        end.setMonth(end.getMonth() + 3);
        break;
      case 'annually':
        end.setFullYear(end.getFullYear() + 1);
        break;
    }
  }

  private getDefaultFeatures(tier: LicenseTier): WhiteLabelConfig['features'] {
    const tierFeatures = TIER_PRICING[tier].features;
    return {
      customColors: tier !== 'starter',
      customDomain: tier === 'professional' || tier === 'enterprise',
      apiAccess: tier === 'professional' || tier === 'enterprise',
      whiteLabelReports: tier === 'professional' || tier === 'enterprise',
      customEmailTemplates: tier === 'professional' || tier === 'enterprise',
      multiLanguage: tier === 'enterprise',
      analytics: true,
      apiRateLimit: tier === 'enterprise' ? 1000 : tier === 'professional' ? 500 : 100,
    };
  }

  private generateLicenseId(): string {
    return `WLID-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  private generateLicenseKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 4; i++) {
      if (i > 0) key += '-';
      for (let j = 0; j < 4; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return key;
  }

  private generateInvoiceId(): string {
    return `WLI-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const whiteLabelLicenseService = new WhiteLabelLicenseService();
export default whiteLabelLicenseService;
