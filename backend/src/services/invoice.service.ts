import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import { pdfService, InvoiceData } from './pdf.service';
import emailService from './email.service';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// ============================================
// Invoice Service - Invoice Management
// ============================================

// Invoice status enum
export type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

// Invoice document interface
export interface IInvoice extends mongoose.Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  bookingId: Types.ObjectId;
  customerId?: Types.ObjectId;
  providerId: Types.ObjectId;
  tenantId?: Types.ObjectId;

  // Invoice details
  issueDate: Date;
  dueDate: Date;
  status: InvoiceStatus;

  // Customer info (snapshot)
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };

  // Provider info (snapshot)
  providerInfo: {
    name: string;
    email: string;
    phone?: string;
    businessName?: string;
    licenseNumber?: string;
  };

  // Service info (snapshot)
  serviceInfo: {
    name: string;
    category?: string;
    description?: string;
  };

  // Booking info (snapshot)
  bookingInfo: {
    number: string;
    date: Date;
    scheduledDate: Date;
    scheduledTime: string;
    locationType: string;
    duration: number;
  };

  // Line items
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    serviceId?: Types.ObjectId;
  }>;

  // Pricing
  pricing: {
    subtotal: number;
    discount: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    currency: string;
  };

  // Payment info
  paymentInfo: {
    status: 'pending' | 'paid' | 'refunded' | 'partial';
    method?: string;
    transactionId?: string;
    paidAt?: Date;
  };

  // PDF info
  pdfUrl?: string;
  pdfGeneratedAt?: Date;

  // Email tracking
  emailSentAt?: Date;
  emailSentTo?: string;
  lastReminderAt?: Date;
  reminderCount: number;

  // View tracking
  viewedAt?: Date;
  viewCount: number;

  // Notes and terms
  notes?: string;
  terms?: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: Types.ObjectId;
}

// Invoice schema
const invoiceSchema = new mongoose.Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },

    issueDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded'],
      default: 'draft',
      index: true,
    },

    customerInfo: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
      address: String,
    },

    providerInfo: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
      businessName: String,
      licenseNumber: String,
    },

    serviceInfo: {
      name: { type: String, required: true },
      category: String,
      description: String,
    },

    bookingInfo: {
      number: { type: String, required: true },
      date: Date,
      scheduledDate: Date,
      scheduledTime: String,
      locationType: String,
      duration: Number,
    },

    lineItems: [{
      description: { type: String, required: true },
      quantity: { type: Number, default: 1 },
      unitPrice: { type: Number, required: true },
      total: { type: Number, required: true },
      serviceId: mongoose.Schema.Types.ObjectId,
    }],

    pricing: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      taxRate: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      total: { type: Number, required: true },
      currency: { type: String, default: 'AED' },
    },

    paymentInfo: {
      status: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'partial'],
        default: 'pending',
      },
      method: String,
      transactionId: String,
      paidAt: Date,
    },

    pdfUrl: String,
    pdfGeneratedAt: Date,

    emailSentAt: Date,
    emailSentTo: String,
    lastReminderAt: Date,
    reminderCount: { type: Number, default: 0 },

    viewedAt: Date,
    viewCount: { type: Number, default: 0 },

    notes: String,
    terms: String,

    createdBy: mongoose.Schema.Types.ObjectId,
  },
  {
    timestamps: true,
    collection: 'invoices',
  }
);

// Indexes
invoiceSchema.index({ customerId: 1, status: 1, issueDate: -1 });
invoiceSchema.index({ providerId: 1, status: 1, issueDate: -1 });
invoiceSchema.index({ dueDate: 1, status: 1 }); // For overdue reminders
invoiceSchema.index({ tenantId: 1, status: 1 });

// Pre-save: Generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dateKey = `${year}${month}`;

    // Get sequence for this month
    const InvoiceCounter = mongoose.models.InvoiceCounter || mongoose.model('InvoiceCounter', new mongoose.Schema({
      _id: { type: String, required: true },
      sequence: { type: Number, default: 0 },
    }, { timestamps: true }));

    const counter = await InvoiceCounter.findByIdAndUpdate(
      `INV-${dateKey}`,
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );

    const sequence = String(counter.sequence).padStart(6, '0');
    this.invoiceNumber = `INV-${dateKey}-${sequence}`;
  }

  // Update overdue status
  if (this.status === 'pending' && this.dueDate < new Date()) {
    this.status = 'overdue';
  }

  next();
});

// Invoice Model
export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);

export class InvoiceService {
  /**
   * Create invoice from booking
   */
  async createInvoiceFromBooking(bookingId: string, options: {
    dueInDays?: number;
    notes?: string;
    terms?: string;
  } = {}): Promise<IInvoice> {
    const booking = await Booking.findById(bookingId)
      .populate('customerId', 'firstName lastName email phone')
      .populate('providerId', 'firstName lastName email phone')
      .populate('serviceId', 'name description category');

    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    // Build line items
    const lineItems = [
      {
        description: (booking.serviceId as any)?.name || 'Service',
        quantity: 1,
        unitPrice: booking.pricing.basePrice,
        total: booking.pricing.basePrice,
        serviceId: booking.serviceId,
      },
      ...booking.pricing.addOns.map(addon => ({
        description: addon.name,
        quantity: 1,
        unitPrice: addon.price,
        total: addon.price,
      })),
    ];

    // Calculate tax rate
    const taxRate = booking.pricing.totalAmount > 0
      ? (booking.pricing.tax / (booking.pricing.totalAmount - booking.pricing.tax)) * 100
      : 0;

    // Calculate discount
    const discount = booking.pricing.couponDiscount +
      booking.pricing.discounts.reduce((sum, d) => sum + d.amount, 0);

    // Provider info
    const provider = booking.providerId as any;
    const providerName = `${provider.firstName} ${provider.lastName}`;

    // Customer info
    const customer = booking.customerId as any;
    const customerName = customer
      ? `${customer.firstName} ${customer.lastName}`
      : booking.guestInfo?.name || 'Guest';

    const invoice = new Invoice({
      bookingId: booking._id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      tenantId: booking.tenantId,

      dueDate: new Date(Date.now() + (options.dueInDays || 14) * 24 * 60 * 60 * 1000),
      status: 'draft',

      customerInfo: {
        name: customerName,
        email: customer?.email || booking.guestInfo?.email || '',
        phone: customer?.phone || booking.guestInfo?.phone,
        address: this.formatAddress(booking.location.address),
      },

      providerInfo: {
        name: providerName,
        email: provider.email,
        phone: provider.phone,
      },

      serviceInfo: {
        name: (booking.serviceId as any)?.name || 'Service',
        category: (booking.serviceId as any)?.category,
        description: (booking.serviceId as any)?.description,
      },

      bookingInfo: {
        number: booking.bookingNumber,
        date: booking.createdAt,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        locationType: booking.locationType,
        duration: booking.duration,
      },

      lineItems,
      pricing: {
        subtotal: booking.pricing.subtotal,
        discount,
        taxRate,
        taxAmount: booking.pricing.tax,
        total: booking.pricing.totalAmount,
        currency: booking.pricing.currency,
      },

      paymentInfo: {
        status: booking.payment.status === 'completed' ? 'paid' : 'pending',
        method: booking.payment.method,
        transactionId: booking.payment.transactionId,
        paidAt: booking.payment.paidAt,
      },

      notes: options.notes,
      terms: options.terms || 'Payment due within 14 days of service completion.',
    });

    await invoice.save();

    logger.info('Invoice created', {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      bookingId,
      total: invoice.pricing.total,
    });

    return invoice;
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string): Promise<IInvoice | null> {
    if (!Types.ObjectId.isValid(invoiceId)) {
      throw ApiError.badRequest('Invalid invoice ID');
    }

    return Invoice.findById(invoiceId)
      .populate('bookingId')
      .populate('customerId', 'firstName lastName email')
      .populate('providerId', 'firstName lastName email');
  }

  /**
   * Get invoice by number
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<IInvoice | null> {
    return Invoice.findOne({ invoiceNumber })
      .populate('bookingId')
      .populate('customerId', 'firstName lastName email')
      .populate('providerId', 'firstName lastName email');
  }

  /**
   * List customer invoices
   */
  async listCustomerInvoices(
    customerId: string,
    options: {
      status?: InvoiceStatus;
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    invoices: IInvoice[];
    total: number;
    page: number;
    pages: number;
  }> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest('Invalid customer ID');
    }

    const {
      status,
      page = 1,
      limit = 20,
      startDate,
      endDate,
    } = options;

    const query: any = { customerId };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = startDate;
      if (endDate) query.issueDate.$lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ issueDate: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(query),
    ]);

    return {
      invoices,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * List provider invoices
   */
  async listProviderInvoices(
    providerId: string,
    options: {
      status?: InvoiceStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    invoices: IInvoice[];
    total: number;
    page: number;
    pages: number;
  }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const { status, page = 1, limit = 20 } = options;

    const query: any = { providerId };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ issueDate: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(query),
    ]);

    return {
      invoices,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus,
    paymentInfo?: {
      method?: string;
      transactionId?: string;
      paidAt?: Date;
    }
  ): Promise<IInvoice> {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    invoice.status = status;

    if (paymentInfo) {
      invoice.paymentInfo = {
        ...invoice.paymentInfo,
        ...paymentInfo,
      };

      if (status === 'paid') {
        invoice.paymentInfo.status = 'paid';
        invoice.paymentInfo.paidAt = paymentInfo.paidAt || new Date();
      }
    }

    await invoice.save();

    logger.info('Invoice status updated', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      newStatus: status,
    });

    return invoice;
  }

  /**
   * Mark invoice as viewed
   */
  async markAsViewed(invoiceId: string): Promise<IInvoice> {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    invoice.viewedAt = new Date();
    invoice.viewCount += 1;

    if (invoice.status === 'sent') {
      invoice.status = 'viewed';
    }

    await invoice.save();

    return invoice;
  }

  /**
   * Generate PDF for invoice
   */
  async generateInvoicePDF(invoiceId: string): Promise<Buffer> {
    const invoice = await this.getInvoiceById(invoiceId);

    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    const invoiceData: InvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.issueDate,
      dueDate: invoice.dueDate,

      customer: invoice.customerInfo,
      provider: invoice.providerInfo,

      service: invoice.serviceInfo,

      booking: {
        number: invoice.bookingInfo.number,
        date: invoice.bookingInfo.date || new Date(),
        scheduledDate: invoice.bookingInfo.scheduledDate,
        scheduledTime: invoice.bookingInfo.scheduledTime || '10:00',
        locationType: invoice.bookingInfo.locationType || 'at_home',
        duration: invoice.bookingInfo.duration || 60,
      },

      lineItems: invoice.lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),

      pricing: invoice.pricing,

      payment: invoice.paymentInfo,

      qrCodeData: `REZIN|${invoice.invoiceNumber}|${invoice.pricing.total}|${invoice.pricing.currency}`,

      notes: invoice.notes,
      terms: invoice.terms,
    };

    return pdfService.generateInvoicePDF(invoiceData);
  }

  /**
   * Send invoice email
   */
  async sendInvoiceEmail(
    invoiceId: string,
    options: {
      subject?: string;
      message?: string;
      cc?: string[];
      bcc?: string[];
    } = {}
  ): Promise<void> {
    const invoice = await this.getInvoiceById(invoiceId);

    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    // Generate PDF
    const pdfBuffer = await this.generateInvoicePDF(invoiceId);

    // Prepare email
    const subject = options.subject || `Invoice ${invoice.invoiceNumber} from ${COMPANY_NAME}`;
    const html = this.generateInvoiceEmailHtml(invoice, options.message);

    try {
      // Send email
      if (emailService && typeof emailService.sendEmail === 'function') {
        await emailService.sendEmail(
          invoice.customerInfo.email,
          subject,
          html
        );
      }

      // Update invoice
      invoice.status = 'sent';
      invoice.emailSentAt = new Date();
      invoice.emailSentTo = invoice.customerInfo.email;
      await invoice.save();

      logger.info('Invoice email sent', {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        sentTo: invoice.customerInfo.email,
      });
    } catch (error) {
      logger.error('Failed to send invoice email', {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        error,
      });
      throw error;
    }
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(invoiceId: string): Promise<void> {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    if (!['pending', 'overdue'].includes(invoice.status)) {
      throw ApiError.badRequest('Invoice is not pending payment');
    }

    const daysOverdue = Math.floor(
      (Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const subject = daysOverdue > 0
      ? `Reminder: Invoice ${invoice.invoiceNumber} is ${daysOverdue} days overdue`
      : `Reminder: Invoice ${invoice.invoiceNumber} is due soon`;

    const message = daysOverdue > 0
      ? `Your invoice of ${invoice.pricing.currency} ${invoice.pricing.total} is ${daysOverdue} days overdue. Please arrange payment at your earliest convenience.`
      : `This is a reminder that your invoice of ${invoice.pricing.currency} ${invoice.pricing.total} is due on ${invoice.dueDate.toLocaleDateString()}.`;

    // Generate PDF
    const pdfBuffer = await this.generateInvoicePDF(invoiceId);

    if (emailService && typeof emailService.sendEmail === 'function') {
      await emailService.sendEmail(
        invoice.customerInfo.email,
        subject,
        this.generateReminderEmailHtml(invoice, message)
      );
    }

    invoice.lastReminderAt = new Date();
    invoice.reminderCount += 1;
    await invoice.save();

    logger.info('Payment reminder sent', {
      invoiceId,
      reminderNumber: invoice.reminderCount,
    });
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string, reason?: string): Promise<IInvoice> {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    if (['paid', 'cancelled', 'refunded'].includes(invoice.status)) {
      throw ApiError.badRequest('Cannot cancel invoice with status: ' + invoice.status);
    }

    invoice.status = 'cancelled';
    invoice.notes = invoice.notes
      ? `${invoice.notes}\n\nCancelled: ${reason || 'No reason provided'}`
      : `Cancelled: ${reason || 'No reason provided'}`;

    await invoice.save();

    logger.info('Invoice cancelled', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      reason,
    });

    return invoice;
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(
    providerId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalInvoices: number;
    totalAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    paidAmount: number;
    averageAmount: number;
    byStatus: Record<string, number>;
  }> {
    const query: any = {};

    if (providerId) {
      query.providerId = new Types.ObjectId(providerId);
    }

    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = startDate;
      if (endDate) query.issueDate.$lte = endDate;
    }

    const invoices = await Invoice.find(query);

    let totalAmount = 0;
    let pendingAmount = 0;
    let overdueAmount = 0;
    let paidAmount = 0;
    const byStatus: Record<string, number> = {};

    invoices.forEach(invoice => {
      totalAmount += invoice.pricing.total;
      byStatus[invoice.status] = (byStatus[invoice.status] || 0) + 1;

      if (invoice.status === 'paid') {
        paidAmount += invoice.pricing.total;
      } else if (invoice.status === 'overdue') {
        overdueAmount += invoice.pricing.total;
      } else if (['pending', 'sent', 'viewed'].includes(invoice.status)) {
        pendingAmount += invoice.pricing.total;
      }
    });

    return {
      totalInvoices: invoices.length,
      totalAmount,
      pendingAmount,
      overdueAmount,
      paidAmount,
      averageAmount: invoices.length > 0 ? totalAmount / invoices.length : 0,
      byStatus,
    };
  }

  // ============================================
  // Private Methods
  // ============================================

  private formatAddress(address?: any): string {
    if (!address) return '';
    const parts = [
      address.street,
      address.city,
      address.state,
      address.zipCode,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  }

  private generateInvoiceEmailHtml(invoice: IInvoice, message?: string): string {
    const defaultMessage = message || `Please find attached your invoice ${invoice.invoiceNumber} for the services provided.`;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">${COMPANY_NAME}</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0;">Invoice ${invoice.invoiceNumber}</p>
        </div>

        <div style="padding: 30px; background: #fff;">
          <p>Dear ${invoice.customerInfo.name},</p>
          <p>${defaultMessage}</p>

          <div style="background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Invoice Number</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${invoice.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Issue Date</td>
                <td style="padding: 8px 0; text-align: right;">${invoice.issueDate.toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Due Date</td>
                <td style="padding: 8px 0; text-align: right;">${invoice.dueDate.toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Service</td>
                <td style="padding: 8px 0; text-align: right;">${invoice.serviceInfo.name}</td>
              </tr>
              <tr style="border-top: 2px solid #E5E7EB;">
                <td style="padding: 15px 0 0; font-size: 18px; font-weight: bold;">Total Due</td>
                <td style="padding: 15px 0 0; font-size: 18px; font-weight: bold; text-align: right; color: #2563EB;">
                  ${invoice.pricing.currency} ${invoice.pricing.total.toFixed(2)}
                </td>
              </tr>
            </table>
          </div>

          <p style="color: #6B7280; font-size: 14px;">
            Please find the detailed invoice attached to this email.
          </p>

          <p>If you have any questions, please don't hesitate to contact us.</p>

          <p>Best regards,<br/>The ${COMPANY_NAME} Team</p>
        </div>

        <div style="background: #F9FAFB; padding: 20px; text-align: center; color: #6B7280; font-size: 12px;">
          <p>${COMPANY_NAME} | Dubai, UAE | support@rezin.ae</p>
        </div>
      </div>
    `;
  }

  private generateReminderEmailHtml(invoice: IInvoice, message: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #F59E0B; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Reminder</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Invoice ${invoice.invoiceNumber}</p>
        </div>

        <div style="padding: 30px; background: #fff;">
          <p>Dear ${invoice.customerInfo.name},</p>
          <p>${message}</p>

          <div style="background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B;">
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #92400E;">
              Amount Due: ${invoice.pricing.currency} ${invoice.pricing.total.toFixed(2)}
            </p>
          </div>

          <p>To make a payment, please contact us or use the payment details in the attached invoice.</p>

          <p>If you have already made this payment, please disregard this reminder.</p>

          <p>Best regards,<br/>The ${COMPANY_NAME} Team</p>
        </div>

        <div style="background: #F9FAFB; padding: 20px; text-align: center; color: #6B7280; font-size: 12px;">
          <p>${COMPANY_NAME} | Dubai, UAE | support@rezin.ae</p>
        </div>
      </div>
    `;
  }
}

// Company name constant
const COMPANY_NAME = 'Rezin Home Services';

// Export singleton instance
export const invoiceService = new InvoiceService();
export default invoiceService;
