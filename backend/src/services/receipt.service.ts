import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import { pdfService, ReceiptData } from './pdf.service';
import emailService from './email.service';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// ============================================
// Receipt Service - Receipt Generation & Management
// ============================================

// Receipt status enum
export type ReceiptStatus = 'pending' | 'completed' | 'cancelled' | 'refunded';

// Receipt document interface
export interface IReceipt extends mongoose.Document {
  _id: Types.ObjectId;
  receiptNumber: string;
  bookingId: Types.ObjectId;
  customerId?: Types.ObjectId;
  providerId: Types.ObjectId;
  tenantId?: Types.ObjectId;

  // Receipt details
  issueDate: Date;
  status: ReceiptStatus;

  // Customer info (snapshot)
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
  };

  // Provider info (snapshot)
  providerInfo: {
    name: string;
    businessName?: string;
  };

  // Service info (snapshot)
  serviceInfo: {
    name: string;
  };

  // Booking info (snapshot)
  bookingInfo: {
    number: string;
    date: Date;
    scheduledDate: Date;
  };

  // Payment details
  payment: {
    amount: number;
    method: string;
    transactionId: string;
    currency: string;
    paidAt: Date;
  };

  // Optional breakdown
  breakdown?: {
    subtotal: number;
    tax: number;
    tip?: number;
    discount?: number;
    total: number;
  };

  // PDF info
  pdfUrl?: string;
  pdfGeneratedAt?: Date;

  // Email info
  emailSentAt?: Date;
  emailSentTo?: string;

  // Refund info
  refundedAt?: Date;
  refundAmount?: number;
  refundReason?: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

// Receipt schema
const receiptSchema = new mongoose.Schema<IReceipt>(
  {
    receiptNumber: {
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
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled', 'refunded'],
      default: 'pending',
      index: true,
    },

    customerInfo: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
    },

    providerInfo: {
      name: { type: String, required: true },
      businessName: String,
    },

    serviceInfo: {
      name: { type: String, required: true },
    },

    bookingInfo: {
      number: { type: String, required: true },
      date: Date,
      scheduledDate: Date,
    },

    payment: {
      amount: { type: Number, required: true },
      method: { type: String, required: true },
      transactionId: { type: String, required: true },
      currency: { type: String, default: 'AED' },
      paidAt: { type: Date, required: true },
    },

    breakdown: {
      subtotal: { type: Number, required: true },
      tax: { type: Number, required: true },
      tip: Number,
      discount: Number,
      total: { type: Number, required: true },
    },

    pdfUrl: String,
    pdfGeneratedAt: Date,

    emailSentAt: Date,
    emailSentTo: String,

    refundedAt: Date,
    refundAmount: Number,
    refundReason: String,
  },
  {
    timestamps: true,
    collection: 'receipts',
  }
);

// Indexes
receiptSchema.index({ customerId: 1, issueDate: -1 });
receiptSchema.index({ providerId: 1, issueDate: -1 });
receiptSchema.index({ 'payment.transactionId': 1 });
receiptSchema.index({ tenantId: 1, status: 1 });

// Pre-save: Generate receipt number
receiptSchema.pre('save', async function(next) {
  if (this.isNew && !this.receiptNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dateKey = `${year}${month}`;

    // Get sequence for this month using atomic counter
    const ReceiptCounter = mongoose.models.ReceiptCounter || mongoose.model('ReceiptCounter', new mongoose.Schema({
      _id: { type: String, required: true },
      sequence: { type: Number, default: 0 },
    }, { timestamps: true }));

    const counter = await ReceiptCounter.findByIdAndUpdate(
      `RCP-${dateKey}`,
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );

    const sequence = String(counter.sequence).padStart(6, '0');
    this.receiptNumber = `RCP-${dateKey}-${sequence}`;
  }

  next();
});

// Receipt Model
export const Receipt = mongoose.model<IReceipt>('Receipt', receiptSchema);

export class ReceiptService {
  /**
   * Generate receipt from booking/payment
   */
  async generateReceiptFromBooking(
    bookingId: string,
    paymentDetails?: {
      amount?: number;
      method?: string;
      transactionId?: string;
      tip?: number;
    }
  ): Promise<IReceipt> {
    const booking = await Booking.findById(bookingId)
      .populate('customerId', 'firstName lastName email phone')
      .populate('providerId', 'firstName lastName email');

    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    // Check if receipt already exists
    const existingReceipt = await Receipt.findOne({ bookingId: booking._id });
    if (existingReceipt) {
      throw ApiError.conflict('Receipt already exists for this booking');
    }

    // Get provider info
    const provider = booking.providerId as any;
    const providerName = `${provider.firstName} ${provider.lastName}`;
    const providerBusinessName = provider.providerProfile?.businessInfo?.businessName;

    // Get customer info
    const customer = booking.customerId as any;
    const customerName = customer
      ? `${customer.firstName} ${customer.lastName}`
      : booking.guestInfo?.name || 'Guest';

    // Calculate amounts
    const subtotal = booking.pricing.subtotal;
    const tax = booking.pricing.tax;
    const discount = booking.pricing.couponDiscount +
      booking.pricing.discounts.reduce((sum, d) => sum + d.amount, 0);
    const tip = paymentDetails?.tip || 0;
    const total = booking.pricing.totalAmount + tip;

    const receipt = new Receipt({
      bookingId: booking._id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      tenantId: booking.tenantId,

      status: 'completed',

      customerInfo: {
        name: customerName,
        email: customer?.email || booking.guestInfo?.email || '',
        phone: customer?.phone || booking.guestInfo?.phone,
      },

      providerInfo: {
        name: providerName,
        businessName: providerBusinessName,
      },

      serviceInfo: {
        name: (booking.serviceId as any)?.name || 'Service',
      },

      bookingInfo: {
        number: booking.bookingNumber,
        date: booking.createdAt,
        scheduledDate: booking.scheduledDate,
      },

      payment: {
        amount: total,
        method: paymentDetails?.method || booking.payment.method || 'card',
        transactionId: paymentDetails?.transactionId || booking.payment.transactionId || `TXN-${Date.now()}`,
        currency: booking.pricing.currency,
        paidAt: booking.payment.paidAt || new Date(),
      },

      breakdown: {
        subtotal,
        tax,
        tip: tip > 0 ? tip : undefined,
        discount: discount > 0 ? discount : undefined,
        total,
      },
    });

    await receipt.save();

    logger.info('Receipt generated', {
      receiptId: receipt._id,
      receiptNumber: receipt.receiptNumber,
      bookingId,
      amount: total,
    });

    return receipt;
  }

  /**
   * Get receipt by ID
   */
  async getReceiptById(receiptId: string): Promise<IReceipt | null> {
    if (!Types.ObjectId.isValid(receiptId)) {
      throw ApiError.badRequest('Invalid receipt ID');
    }

    return Receipt.findById(receiptId)
      .populate('bookingId')
      .populate('customerId', 'firstName lastName email')
      .populate('providerId', 'firstName lastName email');
  }

  /**
   * Get receipt by number
   */
  async getReceiptByNumber(receiptNumber: string): Promise<IReceipt | null> {
    return Receipt.findOne({ receiptNumber })
      .populate('bookingId')
      .populate('customerId', 'firstName lastName email')
      .populate('providerId', 'firstName lastName email');
  }

  /**
   * Get receipt by booking ID
   */
  async getReceiptByBookingId(bookingId: string): Promise<IReceipt | null> {
    return Receipt.findOne({ bookingId: new Types.ObjectId(bookingId) });
  }

  /**
   * List customer receipts
   */
  async listCustomerReceipts(
    customerId: string,
    options: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    receipts: IReceipt[];
    total: number;
    page: number;
    pages: number;
  }> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest('Invalid customer ID');
    }

    const { page = 1, limit = 20, startDate, endDate } = options;

    const query: any = { customerId };

    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = startDate;
      if (endDate) query.issueDate.$lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [receipts, total] = await Promise.all([
      Receipt.find(query)
        .sort({ issueDate: -1 })
        .skip(skip)
        .limit(limit),
      Receipt.countDocuments(query),
    ]);

    return {
      receipts,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * List provider receipts
   */
  async listProviderReceipts(
    providerId: string,
    options: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    receipts: IReceipt[];
    total: number;
    page: number;
    pages: number;
  }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const { page = 1, limit = 20, startDate, endDate } = options;

    const query: any = { providerId };

    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = startDate;
      if (endDate) query.issueDate.$lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [receipts, total] = await Promise.all([
      Receipt.find(query)
        .sort({ issueDate: -1 })
        .skip(skip)
        .limit(limit),
      Receipt.countDocuments(query),
    ]);

    return {
      receipts,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Generate PDF for receipt
   */
  async generateReceiptPDF(receiptId: string): Promise<Buffer> {
    const receipt = await this.getReceiptById(receiptId);

    if (!receipt) {
      throw ApiError.notFound('Receipt not found');
    }

    const receiptData: ReceiptData = {
      receiptNumber: receipt.receiptNumber,
      receiptDate: receipt.issueDate,

      customer: receipt.customerInfo,
      provider: receipt.providerInfo,

      service: receipt.serviceInfo,

      booking: {
        number: receipt.bookingInfo.number,
        date: receipt.bookingInfo.date || new Date(),
      },

      payment: receipt.payment,

      breakdown: receipt.breakdown,
    };

    return pdfService.generateReceiptPDF(receiptData);
  }

  /**
   * Send receipt email
   */
  async sendReceiptEmail(
    receiptId: string,
    options: {
      subject?: string;
      message?: string;
    } = {}
  ): Promise<void> {
    const receipt = await this.getReceiptById(receiptId);

    if (!receipt) {
      throw ApiError.notFound('Receipt not found');
    }

    // Generate PDF
    const pdfBuffer = await this.generateReceiptPDF(receiptId);

    const subject = options.subject || `Receipt ${receipt.receiptNumber} from Rezin Home Services`;
    const html = this.generateReceiptEmailHtml(receipt, options.message);

    if (emailService && typeof emailService.sendEmail === 'function') {
      await emailService.sendEmail(
        receipt.customerInfo.email,
        subject,
        html
      );
    }

    receipt.emailSentAt = new Date();
    receipt.emailSentTo = receipt.customerInfo.email;
    await receipt.save();

    logger.info('Receipt email sent', {
      receiptId,
      receiptNumber: receipt.receiptNumber,
      sentTo: receipt.customerInfo.email,
    });
  }

  /**
   * Add tip to existing receipt
   */
  async addTip(
    receiptId: string,
    tipAmount: number,
    paymentDetails?: {
      method?: string;
      transactionId?: string;
    }
  ): Promise<IReceipt> {
    const receipt = await Receipt.findById(receiptId);

    if (!receipt) {
      throw ApiError.notFound('Receipt not found');
    }

    if (receipt.status === 'refunded') {
      throw ApiError.badRequest('Cannot add tip to refunded receipt');
    }

    receipt.breakdown = receipt.breakdown || {
      subtotal: receipt.payment.amount,
      tax: 0,
      total: receipt.payment.amount,
    };

    receipt.breakdown.tip = tipAmount;
    receipt.breakdown.total = receipt.breakdown.subtotal + receipt.breakdown.tax + tipAmount;
    receipt.payment.amount = receipt.breakdown.total;

    if (paymentDetails) {
      receipt.payment.method = paymentDetails.method || receipt.payment.method;
      receipt.payment.transactionId = paymentDetails.transactionId || receipt.payment.transactionId;
    }

    await receipt.save();

    logger.info('Tip added to receipt', {
      receiptId,
      receiptNumber: receipt.receiptNumber,
      tipAmount,
      newTotal: receipt.payment.amount,
    });

    return receipt;
  }

  /**
   * Process refund for receipt
   */
  async processRefund(
    receiptId: string,
    refundAmount: number,
    reason?: string
  ): Promise<IReceipt> {
    const receipt = await Receipt.findById(receiptId);

    if (!receipt) {
      throw ApiError.notFound('Receipt not found');
    }

    if (receipt.status === 'refunded') {
      throw ApiError.badRequest('Receipt is already refunded');
    }

    if (refundAmount > receipt.payment.amount) {
      throw ApiError.badRequest('Refund amount exceeds original payment');
    }

    receipt.status = 'refunded';
    receipt.refundedAt = new Date();
    receipt.refundAmount = refundAmount;
    receipt.refundReason = reason;

    await receipt.save();

    logger.info('Receipt refunded', {
      receiptId,
      receiptNumber: receipt.receiptNumber,
      refundAmount,
      reason,
    });

    return receipt;
  }

  /**
   * Cancel receipt
   */
  async cancelReceipt(receiptId: string): Promise<IReceipt> {
    const receipt = await Receipt.findById(receiptId);

    if (!receipt) {
      throw ApiError.notFound('Receipt not found');
    }

    if (receipt.status === 'refunded') {
      throw ApiError.badRequest('Cannot cancel refunded receipt');
    }

    receipt.status = 'cancelled';
    await receipt.save();

    logger.info('Receipt cancelled', {
      receiptId,
      receiptNumber: receipt.receiptNumber,
    });

    return receipt;
  }

  /**
   * Get receipt statistics
   */
  async getReceiptStats(
    providerId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalReceipts: number;
    totalAmount: number;
    averageAmount: number;
    totalTips: number;
    refundedAmount: number;
    byMethod: Record<string, { count: number; amount: number }>;
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

    const receipts = await Receipt.find(query);

    let totalAmount = 0;
    let totalTips = 0;
    let refundedAmount = 0;
    const byMethod: Record<string, { count: number; amount: number }> = {};

    receipts.forEach(receipt => {
      totalAmount += receipt.payment.amount;
      totalTips += receipt.breakdown?.tip || 0;

      if (receipt.status === 'refunded') {
        refundedAmount += receipt.refundAmount || 0;
      }

      const method = receipt.payment.method;
      if (!byMethod[method]) {
        byMethod[method] = { count: 0, amount: 0 };
      }
      byMethod[method].count++;
      byMethod[method].amount += receipt.payment.amount;
    });

    return {
      totalReceipts: receipts.length,
      totalAmount,
      averageAmount: receipts.length > 0 ? totalAmount / receipts.length : 0,
      totalTips,
      refundedAmount,
      byMethod,
    };
  }

  // ============================================
  // Private Methods
  // ============================================

  private generateReceiptEmailHtml(receipt: IReceipt, message?: string): string {
    const defaultMessage = message || 'Thank you for your payment!';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Confirmed</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Receipt ${receipt.receiptNumber}</p>
        </div>

        <div style="padding: 30px; background: #fff;">
          <p>Dear ${receipt.customerInfo.name},</p>
          <p>${defaultMessage}</p>

          <div style="background: #F0FDF4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #166534;">Amount Paid</p>
            <p style="margin: 5px 0 0; font-size: 32px; font-weight: bold; color: #166534;">
              ${receipt.payment.currency} ${receipt.payment.amount.toFixed(2)}
            </p>
          </div>

          <div style="background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Receipt Number</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${receipt.receiptNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Date</td>
                <td style="padding: 8px 0; text-align: right;">${receipt.issueDate.toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Service</td>
                <td style="padding: 8px 0; text-align: right;">${receipt.serviceInfo.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Payment Method</td>
                <td style="padding: 8px 0; text-align: right;">${receipt.payment.method.toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Transaction ID</td>
                <td style="padding: 8px 0; text-align: right; font-size: 12px;">${receipt.payment.transactionId}</td>
              </tr>
            </table>
          </div>

          ${receipt.breakdown ? `
            <div style="background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 15px; color: #1F2937;">Payment Breakdown</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #6B7280;">Subtotal</td>
                  <td style="padding: 6px 0; text-align: right;">${receipt.payment.currency} ${receipt.breakdown.subtotal.toFixed(2)}</td>
                </tr>
                ${receipt.breakdown.discount ? `
                  <tr>
                    <td style="padding: 6px 0; color: #10B981;">Discount</td>
                    <td style="padding: 6px 0; text-align: right; color: #10B981;">-${receipt.payment.currency} ${receipt.breakdown.discount.toFixed(2)}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="padding: 6px 0; color: #6B7280;">Tax</td>
                  <td style="padding: 6px 0; text-align: right;">${receipt.payment.currency} ${receipt.breakdown.tax.toFixed(2)}</td>
                </tr>
                ${receipt.breakdown.tip ? `
                  <tr>
                    <td style="padding: 6px 0; color: #6B7280;">Tip</td>
                    <td style="padding: 6px 0; text-align: right;">${receipt.payment.currency} ${receipt.breakdown.tip.toFixed(2)}</td>
                  </tr>
                ` : ''}
                <tr style="border-top: 2px solid #E5E7EB;">
                  <td style="padding: 10px 0 0; font-weight: bold;">Total</td>
                  <td style="padding: 10px 0 0; text-align: right; font-weight: bold; color: #10B981;">
                    ${receipt.payment.currency} ${receipt.breakdown.total.toFixed(2)}
                  </td>
                </tr>
              </table>
            </div>
          ` : ''}

          <p style="color: #6B7280; font-size: 14px;">
            Please find the detailed receipt attached to this email.
          </p>

          <p>Thank you for choosing Rezin Home Services!</p>

          <p>Best regards,<br/>The Rezin Home Services Team</p>
        </div>

        <div style="background: #F9FAFB; padding: 20px; text-align: center; color: #6B7280; font-size: 12px;">
          <p>Rezin Home Services | Dubai, UAE | support@rezin.ae</p>
        </div>
      </div>
    `;
  }
}

// Export singleton instance
export const receiptService = new ReceiptService();
export default receiptService;
