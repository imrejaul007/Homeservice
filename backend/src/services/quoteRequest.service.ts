import mongoose, { Types, Document } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Type Definitions
// ============================================

export type QuoteStatus = 'pending' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' | 'cancelled';
export type QuotePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteRequest {
  _id?: Types.ObjectId;
  requestId: string;
  customerId: Types.ObjectId;
  providerId?: Types.ObjectId;
  serviceId: Types.ObjectId;
  title: string;
  description: string;
  priority: QuotePriority;
  preferredDate?: Date;
  preferredTime?: string;
  location: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  photos?: string[];
  attachments?: string[];
  status: QuoteStatus;
  expiresAt?: Date;
  quotes: Types.ObjectId[];
  selectedQuoteId?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Quote {
  _id?: Types.ObjectId;
  quoteRequestId: Types.ObjectId;
  providerId: Types.ObjectId;
  status: QuoteStatus;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount?: {
    type: 'percentage' | 'fixed';
    amount: number;
    code?: string;
  };
  totalAmount: number;
  validUntil?: Date;
  estimatedDuration?: number;
  notes?: string;
  terms?: string;
  viewCount: number;
  lastViewedAt?: Date;
  respondedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface QuoteComparison {
  requestId: string;
  quotes: Array<{
    quoteId: string;
    providerId: string;
    providerName: string;
    totalAmount: number;
    lineItemsCount: number;
    estimatedDuration?: number;
    validUntil?: Date;
    respondedAt?: Date;
  }>;
}

export interface CreateQuoteRequestInput {
  customerId: string;
  serviceId: string;
  providerId?: string;
  title: string;
  description: string;
  priority?: QuotePriority;
  preferredDate?: Date;
  preferredTime?: string;
  location: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  photos?: string[];
  attachments?: string[];
}

export interface CreateQuoteInput {
  quoteRequestId: string;
  providerId: string;
  lineItems: QuoteLineItem[];
  taxRate?: number;
  discount?: Quote['discount'];
  validUntil?: Date;
  estimatedDuration?: number;
  notes?: string;
  terms?: string;
}

// ============================================
// Mongoose Interfaces
// ============================================

interface IQuoteRequest extends Document, Omit<QuoteRequest, '_id'> {}
interface IQuote extends Document, Omit<Quote, '_id'> {}

// ============================================
// Mongoose Schemas
// ============================================

const QuoteLineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true },
}, { _id: false });

const QuoteRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 2000 },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  preferredDate: { type: Date },
  preferredTime: { type: String },
  location: {
    address: { type: String, required: true },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
  },
  photos: [{ type: String }],
  attachments: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'cancelled'],
    default: 'pending',
  },
  expiresAt: { type: Date },
  quotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quote' }],
  selectedQuoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
}, {
  timestamps: true,
  collection: 'quote_requests',
});

QuoteRequestSchema.index({ customerId: 1, createdAt: -1 });
QuoteRequestSchema.index({ providerId: 1, status: 1 });
QuoteRequestSchema.index({ serviceId: 1 });
QuoteRequestSchema.index({ status: 1 });
QuoteRequestSchema.index({ requestId: 1 });

const DiscountSchema = new mongoose.Schema({
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  amount: { type: Number, required: true, min: 0 },
  code: { type: String },
}, { _id: false });

const QuoteSchema = new mongoose.Schema({
  quoteRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuoteRequest', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'cancelled'],
    default: 'sent',
  },
  lineItems: { type: [QuoteLineItemSchema], required: true },
  subtotal: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discount: { type: DiscountSchema },
  totalAmount: { type: Number, required: true },
  validUntil: { type: Date },
  estimatedDuration: { type: Number }, // in minutes
  notes: { type: String, maxlength: 1000 },
  terms: { type: String, maxlength: 2000 },
  viewCount: { type: Number, default: 0 },
  lastViewedAt: { type: Date },
  respondedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'quotes',
});

QuoteSchema.index({ quoteRequestId: 1 });
QuoteSchema.index({ providerId: 1, status: 1 });
QuoteSchema.index({ status: 1 });

// ============================================
// Model Registration
// ============================================

export const QuoteRequestModel = mongoose.models.QuoteRequest ||
  mongoose.model<IQuoteRequest>('QuoteRequest', QuoteRequestSchema);
export const QuoteModel = mongoose.models.Quote ||
  mongoose.model<IQuote>('Quote', QuoteSchema);

// ============================================
// Service Class
// ============================================

export class QuoteRequestService {

  // ========================================
  // Quote Request Management
  // ========================================

  /**
   * Create a quote request
   */
  async createQuoteRequest(input: CreateQuoteRequestInput): Promise<IQuoteRequest> {
    const {
      customerId,
      serviceId,
      providerId,
      title,
      description,
      priority,
      preferredDate,
      preferredTime,
      location,
      photos,
      attachments,
    } = input;

    if (!Types.ObjectId.isValid(customerId) || !Types.ObjectId.isValid(serviceId)) {
      throw ApiError.badRequest('Invalid customer or service ID');
    }

    const requestId = `QR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Default expiration: 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const quoteRequest = new QuoteRequestModel({
      requestId,
      customerId: new Types.ObjectId(customerId),
      providerId: providerId ? new Types.ObjectId(providerId) : undefined,
      serviceId: new Types.ObjectId(serviceId),
      title,
      description,
      priority: priority || 'normal',
      preferredDate,
      preferredTime,
      location,
      photos: photos || [],
      attachments: attachments || [],
      status: 'pending',
      expiresAt,
      quotes: [],
    });

    await quoteRequest.save();

    logger.info('Quote request created', {
      context: 'QuoteRequestService',
      action: 'QUOTE_REQUEST_CREATED',
      requestId,
      customerId,
      serviceId,
    });

    eventBus.publish(EVENT_TYPES.QUOTE_REQUEST_CREATED, {
      requestId: quoteRequest._id,
      customerId,
      serviceId,
      providerId,
    });

    return quoteRequest;
  }

  /**
   * Get quote request by ID
   */
  async getQuoteRequestById(requestId: string): Promise<IQuoteRequest | null> {
    if (!Types.ObjectId.isValid(requestId)) {
      throw ApiError.badRequest('Invalid request ID');
    }

    return QuoteRequestModel.findById(requestId)
      .populate('customerId', 'firstName lastName email phone')
      .populate('providerId', 'firstName lastName email')
      .populate('serviceId', 'name category')
      .populate('quotes');
  }

  /**
   * Get quote request by request ID string
   */
  async getQuoteRequestByRequestId(requestId: string): Promise<IQuoteRequest | null> {
    return QuoteRequestModel.findOne({ requestId })
      .populate('customerId', 'firstName lastName email phone')
      .populate('providerId', 'firstName lastName email')
      .populate('serviceId', 'name category')
      .populate('quotes');
  }

  /**
   * Get customer's quote requests
   */
  async getCustomerQuoteRequests(
    customerId: string,
    options: {
      status?: QuoteStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ requests: IQuoteRequest[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest('Invalid customer ID');
    }

    const { status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { customerId: new Types.ObjectId(customerId) };
    if (status) query.status = status;

    const [requests, total] = await Promise.all([
      QuoteRequestModel.find(query)
        .populate('serviceId', 'name category')
        .populate('quotes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      QuoteRequestModel.countDocuments(query),
    ]);

    return {
      requests,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get provider's quote requests
   */
  async getProviderQuoteRequests(
    providerId: string,
    options: {
      status?: QuoteStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ requests: IQuoteRequest[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const { status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      providerId: new Types.ObjectId(providerId),
    };
    if (status) query.status = status;

    const [requests, total] = await Promise.all([
      QuoteRequestModel.find(query)
        .populate('customerId', 'firstName lastName email phone')
        .populate('serviceId', 'name category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      QuoteRequestModel.countDocuments(query),
    ]);

    return {
      requests,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Cancel quote request
   */
  async cancelQuoteRequest(requestId: string, customerId: string): Promise<IQuoteRequest> {
    if (!Types.ObjectId.isValid(requestId) || !Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const quoteRequest = await QuoteRequestModel.findById(requestId);
    if (!quoteRequest) {
      throw ApiError.notFound('Quote request not found');
    }

    if (!quoteRequest.customerId.equals(new Types.ObjectId(customerId))) {
      throw ApiError.forbidden('Not authorized to cancel this request');
    }

    if (quoteRequest.status !== 'pending' && quoteRequest.status !== 'sent') {
      throw ApiError.badRequest('Cannot cancel request in current status');
    }

    quoteRequest.status = 'cancelled';
    await quoteRequest.save();

    logger.info('Quote request cancelled', {
      context: 'QuoteRequestService',
      action: 'QUOTE_REQUEST_CANCELLED',
      requestId,
      customerId,
    });

    return quoteRequest;
  }

  // ========================================
  // Quote Management
  // ========================================

  /**
   * Create a quote (provider responds to request)
   */
  async createQuote(input: CreateQuoteInput): Promise<IQuote> {
    const {
      quoteRequestId,
      providerId,
      lineItems,
      taxRate,
      discount,
      validUntil,
      estimatedDuration,
      notes,
      terms,
    } = input;

    if (!Types.ObjectId.isValid(quoteRequestId) || !Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const quoteRequest = await QuoteRequestModel.findById(quoteRequestId);
    if (!quoteRequest) {
      throw ApiError.notFound('Quote request not found');
    }

    if (quoteRequest.status === 'cancelled' || quoteRequest.status === 'expired') {
      throw ApiError.badRequest('Quote request is no longer active');
    }

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    let discountAmount = 0;

    if (discount) {
      discountAmount = discount.type === 'percentage'
        ? subtotal * (discount.amount / 100)
        : discount.amount;
    }

    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * ((taxRate || 0) / 100);
    const totalAmount = afterDiscount + taxAmount;

    // Default validity: 14 days
    const quoteValidUntil = validUntil || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const quote = new QuoteModel({
      quoteRequestId: new Types.ObjectId(quoteRequestId),
      providerId: new Types.ObjectId(providerId),
      status: 'sent',
      lineItems,
      subtotal,
      taxRate: taxRate || 0,
      taxAmount,
      discount,
      totalAmount: Math.round(totalAmount * 100) / 100,
      validUntil: quoteValidUntil,
      estimatedDuration,
      notes,
      terms,
      viewCount: 0,
      respondedAt: new Date(),
    });

    await quote.save();

    // Add quote to request
    quoteRequest.quotes.push(quote._id as Types.ObjectId);
    if (quoteRequest.status === 'pending') {
      quoteRequest.status = 'sent';
    }
    await quoteRequest.save();

    logger.info('Quote created', {
      context: 'QuoteRequestService',
      action: 'QUOTE_CREATED',
      quoteId: quote._id.toString(),
      quoteRequestId,
      providerId,
      totalAmount: quote.totalAmount,
    });

    eventBus.publish(EVENT_TYPES.QUOTE_SENT, {
      quoteId: quote._id,
      quoteRequestId,
      providerId,
      customerId: quoteRequest.customerId,
      totalAmount: quote.totalAmount,
    });

    return quote;
  }

  /**
   * Get quote by ID
   */
  async getQuoteById(quoteId: string): Promise<IQuote | null> {
    if (!Types.ObjectId.isValid(quoteId)) {
      throw ApiError.badRequest('Invalid quote ID');
    }

    return QuoteModel.findById(quoteId)
      .populate('providerId', 'firstName lastName email phone avatar')
      .populate('quoteRequestId', 'title description location');
  }

  /**
   * Get provider's quotes
   */
  async getProviderQuotes(
    providerId: string,
    options: {
      status?: QuoteStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ quotes: IQuote[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const { status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { providerId: new Types.ObjectId(providerId) };
    if (status) query.status = status;

    const [quotes, total] = await Promise.all([
      QuoteModel.find(query)
        .populate('quoteRequestId', 'title location preferredDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      QuoteModel.countDocuments(query),
    ]);

    return {
      quotes,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Record quote view
   */
  async recordQuoteView(quoteId: string): Promise<void> {
    if (!Types.ObjectId.isValid(quoteId)) {
      throw ApiError.badRequest('Invalid quote ID');
    }

    await QuoteModel.findByIdAndUpdate(quoteId, {
      $inc: { viewCount: 1 },
      $set: { lastViewedAt: new Date() },
    });

    // Update request status if first view
    const quote = await QuoteModel.findById(quoteId);
    if (quote && quote.viewCount === 0) {
      await QuoteRequestModel.findByIdAndUpdate(quote.quoteRequestId, {
        status: 'viewed',
      });
    }
  }

  /**
   * Update quote
   */
  async updateQuote(quoteId: string, updates: Partial<CreateQuoteInput>): Promise<IQuote> {
    if (!Types.ObjectId.isValid(quoteId)) {
      throw ApiError.badRequest('Invalid quote ID');
    }

    const quote = await QuoteModel.findById(quoteId);
    if (!quote) {
      throw ApiError.notFound('Quote not found');
    }

    if (quote.status === 'accepted' || quote.status === 'declined') {
      throw ApiError.badRequest('Cannot update quote in current status');
    }

    // Recalculate if line items changed
    if (updates.lineItems) {
      const subtotal = updates.lineItems.reduce((sum, item) => sum + item.total, 0);
      let discountAmount = 0;

      if (updates.discount) {
        discountAmount = updates.discount.type === 'percentage'
          ? subtotal * (updates.discount.amount / 100)
          : updates.discount.amount;
      } else if (quote.discount) {
        discountAmount = quote.discount.type === 'percentage'
          ? subtotal * (quote.discount.amount / 100)
          : quote.discount.amount;
      }

      const afterDiscount = subtotal - discountAmount;
      const taxRate = updates.taxRate ?? quote.taxRate;
      const taxAmount = afterDiscount * (taxRate / 100);

      (updates as Record<string, unknown>).subtotal = subtotal;
      (updates as Record<string, unknown>).taxAmount = taxAmount;
      (updates as Record<string, unknown>).totalAmount = Math.round((afterDiscount + taxAmount) * 100) / 100;
    }

    Object.assign(quote, updates);
    await quote.save();

    logger.info('Quote updated', {
      context: 'QuoteRequestService',
      action: 'QUOTE_UPDATED',
      quoteId,
    });

    return quote;
  }

  /**
   * Cancel quote
   */
  async cancelQuote(quoteId: string, providerId: string, reason: string): Promise<IQuote> {
    if (!Types.ObjectId.isValid(quoteId) || !Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const quote = await QuoteModel.findById(quoteId);
    if (!quote) {
      throw ApiError.notFound('Quote not found');
    }

    if (!quote.providerId.equals(new Types.ObjectId(providerId))) {
      throw ApiError.forbidden('Not authorized to cancel this quote');
    }

    quote.status = 'cancelled';
    await quote.save();

    logger.info('Quote cancelled', {
      context: 'QuoteRequestService',
      action: 'QUOTE_CANCELLED',
      quoteId,
      providerId,
      reason,
    });

    return quote;
  }

  // ========================================
  // Quote Comparison
  // ========================================

  /**
   * Get comparison of all quotes for a request
   */
  async getQuoteComparison(requestId: string): Promise<QuoteComparison> {
    if (!Types.ObjectId.isValid(requestId)) {
      throw ApiError.badRequest('Invalid request ID');
    }

    const quoteRequest = await QuoteRequestModel.findById(requestId)
      .populate({
        path: 'quotes',
        populate: { path: 'providerId', select: 'firstName lastName avatar' },
      });

    if (!quoteRequest) {
      throw ApiError.notFound('Quote request not found');
    }

    const quotes = quoteRequest.quotes.map((quote: unknown) => {
      const q = quote as unknown as IQuote;
      const provider = q.providerId as unknown as { _id: string; firstName: string; lastName: string };

      return {
        quoteId: q._id.toString(),
        providerId: provider._id.toString(),
        providerName: `${provider.firstName} ${provider.lastName}`,
        totalAmount: q.totalAmount,
        lineItemsCount: q.lineItems.length,
        estimatedDuration: q.estimatedDuration,
        validUntil: q.validUntil,
        respondedAt: q.respondedAt,
      };
    });

    return {
      requestId: quoteRequest.requestId,
      quotes,
    };
  }

  // ========================================
  // Accept/Decline
  // ========================================

  /**
   * Accept a quote
   */
  async acceptQuote(quoteId: string, customerId: string): Promise<IQuoteRequest> {
    if (!Types.ObjectId.isValid(quoteId) || !Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const quote = await QuoteModel.findById(quoteId);
    if (!quote) {
      throw ApiError.notFound('Quote not found');
    }

    if (quote.status !== 'sent' && quote.status !== 'viewed') {
      throw ApiError.badRequest('Quote is not available for acceptance');
    }

    const quoteRequest = await QuoteRequestModel.findById(quote.quoteRequestId);
    if (!quoteRequest) {
      throw ApiError.notFound('Quote request not found');
    }

    if (!quoteRequest.customerId.equals(new Types.ObjectId(customerId))) {
      throw ApiError.forbidden('Not authorized to accept this quote');
    }

    if (quoteRequest.status === 'expired' || quoteRequest.status === 'cancelled') {
      throw ApiError.badRequest('Quote request is no longer active');
    }

    // Check if quote is still valid
    if (quote.validUntil && quote.validUntil < new Date()) {
      quote.status = 'expired';
      await quote.save();
      throw ApiError.badRequest('Quote has expired');
    }

    // Accept the quote
    quote.status = 'accepted';
    await quote.save();

    // Update request
    quoteRequest.status = 'accepted';
    quoteRequest.selectedQuoteId = quote._id as Types.ObjectId;

    // Decline other quotes
    await QuoteModel.updateMany(
      {
        quoteRequestId: quoteRequest._id,
        _id: { $ne: quote._id },
        status: { $in: ['sent', 'viewed'] },
      },
      { status: 'declined' }
    );

    await quoteRequest.save();

    logger.info('Quote accepted', {
      context: 'QuoteRequestService',
      action: 'QUOTE_ACCEPTED',
      quoteId,
      requestId: quoteRequest.requestId,
      customerId,
    });

    eventBus.publish(EVENT_TYPES.QUOTE_ACCEPTED, {
      quoteId,
      quoteRequestId: quoteRequest._id,
      customerId,
      providerId: quote.providerId,
      totalAmount: quote.totalAmount,
    });

    return quoteRequest;
  }

  /**
   * Decline a quote
   */
  async declineQuote(quoteId: string, customerId: string, reason?: string): Promise<IQuote> {
    if (!Types.ObjectId.isValid(quoteId) || !Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const quote = await QuoteModel.findById(quoteId);
    if (!quote) {
      throw ApiError.notFound('Quote not found');
    }

    const quoteRequest = await QuoteRequestModel.findById(quote.quoteRequestId);
    if (!quoteRequest) {
      throw ApiError.notFound('Quote request not found');
    }

    if (!quoteRequest.customerId.equals(new Types.ObjectId(customerId))) {
      throw ApiError.forbidden('Not authorized to decline this quote');
    }

    quote.status = 'declined';
    await quote.save();

    logger.info('Quote declined', {
      context: 'QuoteRequestService',
      action: 'QUOTE_DECLINED',
      quoteId,
      customerId,
      reason,
    });

    return quote;
  }

  // ========================================
  // Expiration Handling
  // ========================================

  /**
   * Process expired quotes and requests
   */
  async processExpiredItems(): Promise<{ expiredRequests: number; expiredQuotes: number }> {
    const now = new Date();

    // Expire quote requests past their expiration date
    const requestResult = await QuoteRequestModel.updateMany(
      {
        status: { $in: ['pending', 'sent', 'viewed'] },
        expiresAt: { $lte: now },
      },
      { status: 'expired' }
    );

    // Expire quotes past their validity date
    const quoteResult = await QuoteModel.updateMany(
      {
        status: { $in: ['sent', 'viewed'] },
        validUntil: { $lte: now },
      },
      { status: 'expired' }
    );

    logger.info('Expired items processed', {
      context: 'QuoteRequestService',
      action: 'EXPIRED_ITEMS_PROCESSED',
      expiredRequests: requestResult.modifiedCount,
      expiredQuotes: quoteResult.modifiedCount,
    });

    return {
      expiredRequests: requestResult.modifiedCount,
      expiredQuotes: quoteResult.modifiedCount,
    };
  }

  // ========================================
  // Analytics
  // ========================================

  /**
   * Get quote statistics
   */
  async getQuoteStats(providerId?: string): Promise<{
    totalQuotes: number;
    pendingQuotes: number;
    acceptedQuotes: number;
    declinedQuotes: number;
    averageQuoteAmount: number;
    conversionRate: number;
    averageResponseTime: number; // in hours
  }> {
    const matchStage: Record<string, unknown> = {};
    if (providerId) {
      matchStage.providerId = new Types.ObjectId(providerId);
    }

    const stats = await QuoteModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]);

    const statusCounts: Record<string, number> = {};
    let totalAmount = 0;
    let totalQuotes = 0;

    for (const s of stats) {
      statusCounts[s._id] = s.count;
      totalQuotes += s.count;
      totalAmount += s.totalAmount;
    }

    const accepted = statusCounts['accepted'] || 0;
    const declined = statusCounts['declined'] || 0;
    const decided = accepted + declined;

    // Calculate average response time
    const responseTimes = await QuoteModel.aggregate([
      { $match: { ...matchStage, respondedAt: { $exists: true } } },
      {
        $project: {
          responseTime: {
            $divide: [
              { $subtract: ['$respondedAt', '$createdAt'] },
              3600000, // Convert to hours
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' },
        },
      },
    ]);

    return {
      totalQuotes,
      pendingQuotes: statusCounts['sent'] || 0,
      acceptedQuotes: accepted,
      declinedQuotes: declined,
      averageQuoteAmount: totalQuotes > 0 ? Math.round((totalAmount / totalQuotes) * 100) / 100 : 0,
      conversionRate: decided > 0 ? Math.round((accepted / decided) * 100 * 100) / 100 : 0,
      averageResponseTime: Math.round((responseTimes[0]?.avgResponseTime || 0) * 100) / 100,
    };
  }
}

// ============================================
// Export Singleton
// ============================================

export const quoteRequestService = new QuoteRequestService();
export default quoteRequestService;
