import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export interface Invoice {
  _id?: Types.ObjectId;
  invoiceId: string;
  corporateAccountId: Types.ObjectId;
  invoiceNumber: string;
  periodStart: Date;
  periodEnd: Date;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    category?: string;
    employeeId?: string;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  paymentTerms: number; // Days until due
  issueDate: Date;
  dueDate: Date;
  paidAt?: Date;
  paymentMethod?: string;
  notes?: string;
  attachments?: string[];
  metadata?: {
    bookingCount?: number;
    serviceCategories?: string[];
    lastBookingDate?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageReport {
  _id?: Types.ObjectId;
  reportId: string;
  corporateAccountId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  employeeId?: string;
  department?: string;
  summary: {
    totalBookings: number;
    totalAmount: number;
    totalTax: number;
    totalDiscount: number;
    netAmount: number;
    averageOrderValue: number;
    topCategories: Array<{
      category: string;
      count: number;
      amount: number;
    }>;
    topServices: Array<{
      serviceId: string;
      serviceName: string;
      count: number;
      amount: number;
    }>;
  };
  bookings: Array<{
    bookingId: string;
    bookingNumber: string;
    employeeName: string;
    serviceName: string;
    amount: number;
    date: Date;
  }>;
  generatedAt: Date;
}

export interface PaymentTermConfig {
  termId: string;
  name: string;
  days: number;
  earlyPaymentDiscount?: {
    percentage: number;
    days: number; // Must pay within this many days for discount
  };
  lateFeePercentage?: number;
}

// ============================================
// Payment Terms Configuration
// ============================================

const PAYMENT_TERMS: PaymentTermConfig[] = [
  {
    termId: 'PREPAID',
    name: 'Prepaid',
    days: 0,
  },
  {
    termId: 'NET15',
    name: 'Net 15',
    days: 15,
    earlyPaymentDiscount: {
      percentage: 2,
      days: 5,
    },
    lateFeePercentage: 1.5,
  },
  {
    termId: 'NET30',
    name: 'Net 30',
    days: 30,
    earlyPaymentDiscount: {
      percentage: 2,
      days: 10,
    },
    lateFeePercentage: 1.5,
  },
  {
    termId: 'NET60',
    name: 'Net 60',
    days: 60,
    earlyPaymentDiscount: {
      percentage: 3,
      days: 15,
    },
    lateFeePercentage: 2,
  },
];

// ============================================
// B2B Billing Service
// ============================================

export class B2BBillingService {
  private invoiceModel: any;
  private reportModel: any;

  constructor() {
    this.initializeModels();
  }

  private initializeModels(): void {
    this.invoiceModel = this.createInvoiceSchema();
    this.reportModel = this.createReportSchema();
  }

  private createInvoiceSchema(): any {
    const InvoiceSchema = new mongoose.Schema({
      invoiceId: { type: String, required: true, unique: true },
      corporateAccountId: { type: mongoose.Schema.Types.ObjectId, required: true },
      invoiceNumber: { type: String, required: true, unique: true },
      periodStart: { type: Date, required: true },
      periodEnd: { type: Date, required: true },
      lineItems: [{
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        amount: { type: Number, required: true },
        category: String,
        employeeId: String,
      }],
      subtotal: { type: Number, required: true },
      taxRate: { type: Number, default: 5 }, // 5% VAT
      taxAmount: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
      currency: { type: String, default: 'AED' },
      status: { type: String, enum: ['draft', 'pending', 'sent', 'paid', 'overdue', 'cancelled'], default: 'draft' },
      paymentTerms: { type: Number, default: 30 },
      issueDate: { type: Date, default: Date.now },
      dueDate: { type: Date, required: true },
      paidAt: Date,
      paymentMethod: String,
      notes: String,
      attachments: [String],
      metadata: {
        bookingCount: Number,
        serviceCategories: [String],
        lastBookingDate: Date,
      },
    }, { timestamps: true });

    InvoiceSchema.index({ invoiceId: 1 }, { unique: true });
    InvoiceSchema.index({ corporateAccountId: 1, status: 1 });
    InvoiceSchema.index({ dueDate: 1 });

    return mongoose.model('Invoice', InvoiceSchema);
  }

  private createReportSchema(): any {
    const ReportSchema = new mongoose.Schema({
      reportId: { type: String, required: true, unique: true },
      corporateAccountId: { type: mongoose.Schema.Types.ObjectId, required: true },
      periodStart: { type: Date, required: true },
      periodEnd: { type: Date, required: true },
      employeeId: String,
      department: String,
      summary: {
        totalBookings: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        totalTax: { type: Number, default: 0 },
        totalDiscount: { type: Number, default: 0 },
        netAmount: { type: Number, default: 0 },
        averageOrderValue: { type: Number, default: 0 },
        topCategories: [{
          category: String,
          count: Number,
          amount: Number,
        }],
        topServices: [{
          serviceId: String,
          serviceName: String,
          count: Number,
          amount: Number,
        }],
      },
      bookings: [{
        bookingId: String,
        bookingNumber: String,
        employeeName: String,
        serviceName: String,
        amount: Number,
        date: Date,
      }],
      generatedAt: { type: Date, default: Date.now },
    }, { timestamps: true });

    ReportSchema.index({ reportId: 1 }, { unique: true });
    ReportSchema.index({ corporateAccountId: 1, periodStart: 1, periodEnd: 1 });

    return mongoose.model('UsageReport', ReportSchema);
  }

  /**
   * Get available payment terms
   */
  getPaymentTerms(): PaymentTermConfig[] {
    return PAYMENT_TERMS;
  }

  /**
   * Get payment term by ID
   */
  getPaymentTerm(termId: string): PaymentTermConfig | undefined {
    return PAYMENT_TERMS.find(t => t.termId === termId);
  }

  /**
   * Generate monthly invoice for corporate account
   */
  async generateMonthlyInvoice(
    corporateAccountId: string | Types.ObjectId,
    options: {
      periodStart: Date;
      periodEnd: Date;
      employeeId?: string;
      department?: string;
    } = {} as any
  ): Promise<{ success: boolean; invoice?: Invoice; error?: string }> {
    try {
      const accountObjectId = typeof corporateAccountId === 'string'
        ? new Types.ObjectId(corporateAccountId)
        : corporateAccountId;

      // Get all bookings for the period
      const query: any = {
        corporateAccountId: accountObjectId,
        scheduledDate: { $gte: options.periodStart, $lte: options.periodEnd },
        status: 'completed',
      };

      if (options.employeeId) {
        query['metadata.employeeId'] = options.employeeId;
      }

      const bookings = await Booking.find(query).populate('serviceId');

      if (bookings.length === 0) {
        return { success: false, error: 'No completed bookings in this period' };
      }

      // Aggregate bookings by category
      const lineItems: Invoice['lineItems'] = [];
      const categoryMap = new Map<string, { count: number; amount: number }>();
      const serviceMap = new Map<string, { name: string; count: number; amount: number }>();
      let totalAmount = 0;
      let totalTax = 0;
      let totalDiscount = 0;

      for (const booking of bookings) {
        const pricing = booking.pricing as any;
        const amount = pricing?.totalAmount || 0;
        const tax = pricing?.tax || 0;
        const discount = pricing?.discounts?.reduce(
          (sum: number, d: any) => sum + (d.amount || 0), 0
        ) || 0;

        totalAmount += amount;
        totalTax += tax;
        totalDiscount += discount;

        // Group by service category
        const service = booking.serviceId as any;
        const category = service?.categoryName || 'Other Services';

        const existingCategory = categoryMap.get(category) || { count: 0, amount: 0 };
        existingCategory.count++;
        existingCategory.amount += amount;
        categoryMap.set(category, existingCategory);

        // Group by service
        const serviceName = service?.name || 'Unknown Service';
        const existingService = serviceMap.get(service._id.toString()) || {
          name: serviceName,
          count: 0,
          amount: 0,
        };
        existingService.count++;
        existingService.amount += amount;
        serviceMap.set(service._id.toString(), existingService);
      }

      // Create line items from categories
      for (const [category, data] of categoryMap.entries()) {
        lineItems.push({
          description: `${category} (${data.count} bookings)`,
          quantity: data.count,
          unitPrice: data.amount / data.count,
          amount: data.amount,
          category,
        });
      }

      const subtotal = totalAmount;
      const taxRate = 5; // 5% VAT
      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const netAmount = subtotal + taxAmount - totalDiscount;

      const invoiceId = this.generateInvoiceId();
      const invoiceNumber = await this.generateInvoiceNumber();
      const paymentTerms = 30; // Default Net 30
      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + paymentTerms);

      const invoice = new this.invoiceModel({
        invoiceId,
        corporateAccountId: accountObjectId,
        invoiceNumber,
        periodStart: options.periodStart,
        periodEnd: options.periodEnd,
        lineItems,
        subtotal,
        taxRate,
        taxAmount,
        discountAmount: totalDiscount,
        totalAmount: netAmount,
        currency: 'AED',
        status: 'draft',
        paymentTerms,
        issueDate,
        dueDate,
        metadata: {
          bookingCount: bookings.length,
          serviceCategories: Array.from(categoryMap.keys()),
          lastBookingDate: bookings[bookings.length - 1]?.scheduledDate,
        },
      });

      await invoice.save();

      logger.info('Invoice generated', {
        invoiceId,
        corporateAccountId: accountObjectId.toString(),
        totalAmount: netAmount,
        bookingCount: bookings.length,
      });

      return { success: true, invoice };
    } catch (error) {
      logger.error('Error generating invoice', {
        corporateAccountId: corporateAccountId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate invoice',
      };
    }
  }

  /**
   * Generate usage report
   */
  async generateUsageReport(
    corporateAccountId: string | Types.ObjectId,
    periodStart: Date,
    periodEnd: Date,
    options: {
      employeeId?: string;
      department?: string;
    } = {}
  ): Promise<UsageReport | null> {
    try {
      const accountObjectId = typeof corporateAccountId === 'string'
        ? new Types.ObjectId(corporateAccountId)
        : corporateAccountId;

      const query: any = {
        corporateAccountId: accountObjectId,
        scheduledDate: { $gte: periodStart, $lte: periodEnd },
        status: 'completed',
      };

      if (options.employeeId) {
        query['metadata.employeeId'] = options.employeeId;
      }

      const bookings = await Booking.find(query).populate('serviceId');

      if (bookings.length === 0) {
        return null;
      }

      // Calculate summary
      let totalAmount = 0;
      let totalTax = 0;
      let totalDiscount = 0;
      const categoryMap = new Map<string, { count: number; amount: number }>();
      const serviceMap = new Map<string, { name: string; count: number; amount: number }>();
      const bookingDetails: UsageReport['bookings'] = [];

      for (const booking of bookings) {
        const pricing = booking.pricing as any;
        const amount = pricing?.totalAmount || 0;
        const tax = pricing?.tax || 0;
        const discount = pricing?.discounts?.reduce(
          (sum: number, d: any) => sum + (d.amount || 0), 0
        ) || 0;

        totalAmount += amount;
        totalTax += tax;
        totalDiscount += discount;

        const service = booking.serviceId as any;
        const category = service?.categoryName || 'Other Services';

        const existingCategory = categoryMap.get(category) || { count: 0, amount: 0 };
        existingCategory.count++;
        existingCategory.amount += amount;
        categoryMap.set(category, existingCategory);

        const serviceName = service?.name || 'Unknown Service';
        const existingService = serviceMap.get(service._id.toString()) || {
          name: serviceName,
          count: 0,
          amount: 0,
        };
        existingService.count++;
        existingService.amount += amount;
        serviceMap.set(service._id.toString(), existingService);

        bookingDetails.push({
          bookingId: booking._id.toString(),
          bookingNumber: booking.bookingNumber,
          employeeName: (booking.metadata as any)?.employeeName || 'Unknown',
          serviceName,
          amount,
          date: booking.scheduledDate,
        });
      }

      const netAmount = totalAmount + totalTax - totalDiscount;
      const averageOrderValue = bookings.length > 0 ? totalAmount / bookings.length : 0;

      const topCategories = Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const topServices = Array.from(serviceMap.entries())
        .map(([serviceId, data]) => ({ serviceId, ...data }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      const reportId = this.generateReportId();

      const report = new this.reportModel({
        reportId,
        corporateAccountId: accountObjectId,
        periodStart,
        periodEnd,
        employeeId: options.employeeId,
        department: options.department,
        summary: {
          totalBookings: bookings.length,
          totalAmount,
          totalTax,
          totalDiscount,
          netAmount,
          averageOrderValue,
          topCategories,
          topServices,
        },
        bookings: bookingDetails,
      });

      await report.save();

      logger.info('Usage report generated', {
        reportId,
        corporateAccountId: accountObjectId.toString(),
        bookingCount: bookings.length,
      });

      return report;
    } catch (error) {
      logger.error('Error generating usage report', {
        corporateAccountId: corporateAccountId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Send invoice
   */
  async sendInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const invoice = await this.invoiceModel.findOne({ invoiceId });
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      if (invoice.status !== 'draft') {
        return { success: false, error: 'Invoice cannot be sent' };
      }

      invoice.status = 'sent';
      await invoice.save();

      logger.info('Invoice sent', { invoiceId });

      // Emit event for email notification
      eventBus.publish(EVENT_TYPES.INVOICE_SENT, {
        invoiceId,
        corporateAccountId: invoice.corporateAccountId.toString(),
        totalAmount: invoice.totalAmount,
        dueDate: invoice.dueDate,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send invoice',
      };
    }
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(
    invoiceId: string,
    paymentMethod: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const invoice = await this.invoiceModel.findOne({ invoiceId });
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      if (invoice.status === 'paid') {
        return { success: false, error: 'Invoice already paid' };
      }

      invoice.status = 'paid';
      invoice.paidAt = new Date();
      invoice.paymentMethod = paymentMethod;
      await invoice.save();

      logger.info('Invoice marked as paid', {
        invoiceId,
        paidAt: invoice.paidAt,
        paymentMethod,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark invoice as paid',
      };
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    return this.invoiceModel.findOne({ invoiceId });
  }

  /**
   * Get invoices for corporate account
   */
  async getInvoices(
    corporateAccountId: string | Types.ObjectId,
    options: {
      status?: Invoice['status'];
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ invoices: Invoice[]; total: number }> {
    const accountObjectId = typeof corporateAccountId === 'string'
      ? new Types.ObjectId(corporateAccountId)
      : corporateAccountId;

    const query: any = { corporateAccountId: accountObjectId };

    if (options.status) {
      query.status = options.status;
    }

    if (options.startDate || options.endDate) {
      query.issueDate = {};
      if (options.startDate) query.issueDate.$gte = options.startDate;
      if (options.endDate) query.issueDate.$lte = options.endDate;
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      this.invoiceModel.find(query)
        .sort({ issueDate: -1 })
        .skip(skip)
        .limit(limit),
      this.invoiceModel.countDocuments(query),
    ]);

    return { invoices, total };
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(): Promise<Invoice[]> {
    return this.invoiceModel.find({
      status: 'sent',
      dueDate: { $lt: new Date() },
    }).sort({ dueDate: 1 });
  }

  /**
   * Update credit limit for corporate account
   */
  async updateCreditLimit(
    corporateAccountId: string | Types.ObjectId,
    creditLimit: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This would update the corporate account's credit limit
      // For now, we'll just log it
      logger.info('Credit limit updated', {
        corporateAccountId: corporateAccountId.toString(),
        newLimit: creditLimit,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update credit limit',
      };
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generateInvoiceId(): string {
    return `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  private generateReportId(): string {
    return `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  private async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const count = await this.invoiceModel.countDocuments({
      issueDate: {
        $gte: new Date(year, now.getMonth(), 1),
        $lt: new Date(year, now.getMonth() + 1, 1),
      },
    });
    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const b2bBillingService = new B2BBillingService();
export default b2bBillingService;
