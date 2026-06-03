/**
 * Invoice Management Routes
 *
 * Handles invoice operations including listing, viewing, sending, and PDF download
 */

import { Router, Request, Response, NextFunction } from 'express';
import { param, query, validationResult, body } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import { send as emailSend } from '../services/email.service';
import { pdfService, InvoiceData } from '../services/pdf.service';

const router = Router();

// Helper to transform invoice data to match frontend expectations
const transformInvoiceForFrontend = (inv: any) => {
  const customer = inv.customerId || {};
  const provider = inv.providerId || {};
  const booking = inv.bookingId || {};

  return {
    id: inv._id?.toString() || inv.id,
    invoiceNumber: inv.invoiceNumber,
    type: 'booking',
    status: inv.status,
    customerId: customer._id?.toString() || '',
    customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
    customerEmail: customer.email || '',
    customerPhone: customer.phone,
    customerAddress: undefined,
    providerId: provider._id?.toString(),
    providerName: `${provider.firstName || ''} ${provider.lastName || ''}`.trim(),
    bookingId: booking._id?.toString(),
    bookingDetails: booking.bookingNumber ? {
      serviceName: 'Service',
      scheduledDate: booking.scheduledDate?.toISOString(),
      address: booking.location?.address,
    } : undefined,
    // Transform lineItems to items for frontend compatibility
    items: (inv.lineItems || []).map((item: any, index: number) => ({
      id: `${index}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.total,
    })),
    subtotal: inv.subtotal,
    taxRate: inv.taxRate,
    taxAmount: inv.taxAmount,
    discountAmount: inv.discount || 0,
    totalAmount: inv.total,
    currency: inv.currency || 'AED',
    dueDate: inv.dueDate?.toISOString(),
    paidAt: inv.paidAt?.toISOString(),
    sentAt: inv.sentAt?.toISOString(),
    notes: inv.notes,
    terms: inv.terms,
    pdfUrl: inv.pdfUrl,
    createdAt: inv.createdAt?.toISOString(),
    updatedAt: inv.updatedAt?.toISOString(),
  };
};

// Invoice model interface
interface InvoiceDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  customerId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: 'draft' | 'pending' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  dueDate: Date;
  paidAt?: Date;
  sentAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Populated invoice types
interface PopulatedInvoice {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  customerId: {
    _id: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  providerId: {
    _id: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  bookingId?: {
    _id: mongoose.Types.ObjectId;
    bookingNumber: string;
    status?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: 'draft' | 'pending' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  dueDate: Date;
  paidAt?: Date;
  sentAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Invoice schema for dynamic model creation
const createInvoiceSchema = () => {
  const InvoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    lineItems: [{
      description: { type: String, required: true },
      quantity: { type: Number, default: 1 },
      unitPrice: { type: Number, required: true },
      total: { type: Number, required: true },
    }],
    subtotal: { type: Number, required: true },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'AED' },
    status: {
      type: String,
      enum: ['draft', 'pending', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded'],
      default: 'pending'
    },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date },
    sentAt: { type: Date },
    notes: { type: String },
  }, { timestamps: true });

  InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
  InvoiceSchema.index({ customerId: 1, status: 1 });
  InvoiceSchema.index({ providerId: 1, status: 1 });
  InvoiceSchema.index({ bookingId: 1 });
  InvoiceSchema.index({ dueDate: 1 });

  return mongoose.models.Invoice || mongoose.model<InvoiceDocument>('Invoice', InvoiceSchema);
};

/**
 * GET /api/invoices
 * List invoices (filtered by user role)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        status,
        customerId,
        providerId,
        startDate,
        endDate,
        page = '1',
        limit = '20',
      } = req.query;

      const user = req.user as any;
      const isAdmin = user.role === 'admin';
      const isProvider = user.role === 'provider';

      // Build query based on user role
      const query: Record<string, any> = {};

      if (status) query.status = status;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate as string);
        if (endDate) query.createdAt.$lte = new Date(endDate as string);
      }

      // Filter based on role
      if (isAdmin) {
        // Admins can filter by customerId or providerId
        if (customerId) query.customerId = new mongoose.Types.ObjectId(customerId as string);
        if (providerId) query.providerId = new mongoose.Types.ObjectId(providerId as string);
      } else if (isProvider) {
        // Providers see their invoices
        query.providerId = user._id;
      } else {
        // Customers see their invoices
        query.customerId = user._id;
      }

      const Invoice = createInvoiceSchema();
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [invoices, total] = await Promise.all([
        Invoice.find(query)
          .populate('customerId', 'firstName lastName email')
          .populate('providerId', 'firstName lastName email')
          .populate('bookingId', 'bookingNumber')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Invoice.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: {
          invoices: invoices.map(transformInvoiceForFrontend),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching invoices', { error });
      next(error);
    }
  })
);

/**
 * GET /api/invoices/:id
 * Get invoice details
 */
router.get(
  '/:id',
  authenticate,
  param('id').isMongoId().withMessage('Valid invoice ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const user = req.user as any;
      const isAdmin = user.role === 'admin';
      const isProvider = user.role === 'provider';

      const Invoice = createInvoiceSchema();
      const invoice = await Invoice.findById(id)
        .populate<{ customerId: PopulatedInvoice['customerId'] }>('customerId', 'firstName lastName email phone')
        .populate<{ providerId: PopulatedInvoice['providerId'] }>('providerId', 'firstName lastName email phone')
        .populate<{ bookingId: PopulatedInvoice['bookingId'] }>('bookingId', 'bookingNumber status')
        .lean<PopulatedInvoice>();

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      // Authorization check
      const userId = user._id.toString();
      const isCustomer = invoice.customerId?._id?.toString() === userId;
      const isInvoiceProvider = invoice.providerId?._id?.toString() === userId;

      if (!isAdmin && !isCustomer && !isInvoiceProvider) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to view this invoice',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: transformInvoiceForFrontend(invoice),
      });
    } catch (error) {
      logger.error('Error fetching invoice', { error });
      next(error);
    }
  })
);

/**
 * POST /api/invoices/:id/send
 * Send invoice to customer
 */
router.post(
  '/:id/send',
  authenticate,
  param('id').isMongoId().withMessage('Valid invoice ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const { email, sendCopy = true } = req.body;
      const user = req.user as any;
      const isProvider = user.role === 'provider';
      const isAdmin = user.role === 'admin';

      // Only provider or admin can send invoices
      if (!isProvider && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Only providers or admins can send invoices',
        });
        return;
      }

      const Invoice = createInvoiceSchema();
      const invoice = await Invoice.findById(id)
        .populate<{ customerId: { email?: string; firstName?: string; lastName?: string } }>('customerId', 'firstName lastName email')
        .populate<{ providerId: { firstName?: string; lastName?: string } }>('providerId', 'firstName lastName')
        .lean() as (PopulatedInvoice & { customerId: { email?: string; firstName?: string; lastName?: string }; providerId: { firstName?: string; lastName?: string } }) | null;

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      // Check authorization for providers
      if (isProvider && !isAdmin) {
        const providerId = (invoice as any).providerId?._id?.toString();
        if (providerId !== user._id.toString()) {
          res.status(403).json({
            success: false,
            message: 'Not authorized to send this invoice',
          });
          return;
        }
      }

      // Get email address
      const customerEmail = email || (invoice as any).customerId?.email;
      if (!customerEmail) {
        res.status(400).json({
          success: false,
          message: 'Customer email not found',
        });
        return;
      }

      // Update invoice status to sent
      invoice.status = 'sent';
      invoice.sentAt = new Date();
      await Invoice.findByIdAndUpdate(id, {
        status: 'sent',
        sentAt: invoice.sentAt,
      });

      // Send email with invoice details (simplified - in production would attach PDF)
      try {
        const customerName = `${(invoice as any).customerId?.firstName || ''} ${(invoice as any).customerId?.lastName || ''}`.trim();
        const invoiceHtml = `
          <h2>Invoice ${invoice.invoiceNumber}</h2>
          <p>Dear ${customerName},</p>
          <p>Your invoice is ready.</p>
          <p><strong>Amount:</strong> ${invoice.currency} ${invoice.total}</p>
          <p><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString()}</p>
          <p>Thank you for your business.</p>
        `;
        await emailSend(
          customerEmail,
          `Invoice ${invoice.invoiceNumber} from ${(invoice as any).providerId?.firstName || 'Provider'}`,
          invoiceHtml
        );
      } catch (emailError) {
        logger.warn('Failed to send invoice email', { invoiceId: id, error: emailError });
        // Don't fail the request if email fails
      }

      logger.info('Invoice sent', {
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        sentTo: customerEmail,
      });

      res.status(200).json({
        success: true,
        message: 'Invoice sent successfully',
        data: {
          invoiceId: id,
          sentTo: customerEmail,
          sentAt: invoice.sentAt,
        },
      });
    } catch (error) {
      logger.error('Error sending invoice', { error });
      next(error);
    }
  })
);

/**
 * POST /api/invoices
 * Create a new invoice
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { body } = req;
      const user = req.user as any;
      const isProvider = user.role === 'provider';
      const isAdmin = user.role === 'admin';

      // Only provider or admin can create invoices
      if (!isProvider && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Only providers or admins can create invoices',
        });
        return;
      }

      // Validate required fields
      const { customerId, lineItems, subtotal, total, dueDate } = body;
      if (!customerId || !lineItems || !subtotal || !total || !dueDate) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: customerId, lineItems, subtotal, total, dueDate',
        });
        return;
      }

      const Invoice = createInvoiceSchema();

      // Generate invoice number
      const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
      const count = await Invoice.countDocuments({
        invoiceNumber: new RegExp(`^${yearMonth}-`),
      });
      const invoiceNumber = `${yearMonth}-${String(count + 1).padStart(4, '0')}`;

      // Validate line items totals
      for (const item of lineItems) {
        const calculatedTotal = item.quantity * item.unitPrice;
        if (Math.abs(calculatedTotal - item.total) > 0.01) {
          res.status(400).json({
            success: false,
            message: `Line item total mismatch for "${item.description}". Expected ${calculatedTotal}, got ${item.total}`,
          });
          return;
        }
      }

      const invoice = new Invoice({
        invoiceNumber,
        customerId: new mongoose.Types.ObjectId(customerId),
        providerId: user._id,
        bookingId: body.bookingId ? new mongoose.Types.ObjectId(body.bookingId) : undefined,
        lineItems: lineItems.map((item: any) => ({
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        subtotal,
        taxRate: body.taxRate || 0,
        taxAmount: body.taxAmount || 0,
        total,
        currency: body.currency || 'AED',
        status: 'draft',
        dueDate: new Date(dueDate),
        notes: body.notes,
      });

      await invoice.save();

      logger.info('Invoice created', {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        createdBy: user._id,
      });

      res.status(201).json({
        success: true,
        data: transformInvoiceForFrontend(invoice.toObject()),
      });
    } catch (error) {
      logger.error('Error creating invoice', { error });
      next(error);
    }
  })
);

/**
 * PATCH /api/invoices/:id
 * Update an existing invoice (only draft invoices can be fully edited)
 */
router.patch(
  '/:id',
  authenticate,
  param('id').isMongoId().withMessage('Valid invoice ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const { body } = req;
      const user = req.user as any;
      const isAdmin = user.role === 'admin';

      const Invoice = createInvoiceSchema();
      const invoice = await Invoice.findById(id);

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      // Only draft invoices can be edited, or admin can update status
      if (invoice.status !== 'draft' && !isAdmin) {
        res.status(400).json({
          success: false,
          message: 'Only draft invoices can be edited',
        });
        return;
      }

      // Authorization check for providers
      if (!isAdmin && invoice.providerId.toString() !== user._id.toString()) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to update this invoice',
        });
        return;
      }

      // Update allowed fields
      const allowedFields = ['lineItems', 'subtotal', 'taxRate', 'taxAmount', 'total', 'dueDate', 'notes'];
      const updates: Record<string, any> = {};

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }

      // If admin is updating status
      if (isAdmin && body.status) {
        const validStatuses = ['draft', 'pending', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded'];
        if (validStatuses.includes(body.status)) {
          updates.status = body.status;
          if (body.status === 'paid') {
            updates.paidAt = new Date();
          }
        }
      }

      const updatedInvoice = await Invoice.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true }
      ).lean() as (typeof invoice & { _id: mongoose.Types.ObjectId }) | null;

      if (!updatedInvoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found after update',
        });
        return;
      }

      logger.info('Invoice updated', {
        invoiceId: id,
        updatedBy: user._id,
        updates: Object.keys(updates),
      });

      res.status(200).json({
        success: true,
        data: {
          id: updatedInvoice._id.toString(),
          invoiceNumber: updatedInvoice.invoiceNumber,
          status: updatedInvoice.status,
          updatedAt: updatedInvoice.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Error updating invoice', { error });
      next(error);
    }
  })
);

/**
 * DELETE /api/invoices/:id
 * Delete a draft invoice
 */
router.delete(
  '/:id',
  authenticate,
  param('id').isMongoId().withMessage('Valid invoice ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const user = req.user as any;
      const isAdmin = user.role === 'admin';

      const Invoice = createInvoiceSchema();
      const invoice = await Invoice.findById(id);

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      // Only draft invoices can be deleted
      if (invoice.status !== 'draft') {
        res.status(400).json({
          success: false,
          message: 'Only draft invoices can be deleted',
        });
        return;
      }

      // Authorization check
      if (!isAdmin && invoice.providerId.toString() !== user._id.toString()) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to delete this invoice',
        });
        return;
      }

      await Invoice.findByIdAndDelete(id);

      logger.info('Invoice deleted', {
        invoiceId: id,
        deletedBy: user._id,
      });

      res.status(200).json({
        success: true,
        message: 'Invoice deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting invoice', { error });
      next(error);
    }
  })
);

/**
 * POST /api/invoices/:id/pay
 * Mark invoice as paid
 */
router.post(
  '/:id/pay',
  authenticate,
  param('id').isMongoId().withMessage('Valid invoice ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const { paymentMethod, transactionId, notes } = req.body;
      const user = req.user as any;
      const isAdmin = user.role === 'admin';
      const isCustomer = user.role === 'customer';

      const Invoice = createInvoiceSchema();
      const invoice = await Invoice.findById(id);

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      // Check if invoice can be paid
      if (invoice.status === 'paid') {
        res.status(400).json({
          success: false,
          message: 'Invoice is already paid',
        });
        return;
      }

      if (invoice.status === 'cancelled') {
        res.status(400).json({
          success: false,
          message: 'Cannot pay a cancelled invoice',
        });
        return;
      }

      // Authorization: customer must own the invoice, or admin
      if (!isAdmin) {
        if (isCustomer && invoice.customerId.toString() !== user._id.toString()) {
          res.status(403).json({
            success: false,
            message: 'Not authorized to pay this invoice',
          });
          return;
        }
        if (user.role === 'provider' && invoice.providerId.toString() !== user._id.toString()) {
          res.status(403).json({
            success: false,
            message: 'Not authorized to pay this invoice',
          });
          return;
        }
      }

      // Update invoice status
      invoice.status = 'paid';
      invoice.paidAt = new Date();
      await invoice.save();

      logger.info('Invoice marked as paid', {
        invoiceId: id,
        paidBy: user._id,
        paymentMethod,
        transactionId,
      });

      res.status(200).json({
        success: true,
        data: {
          id: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          status: 'paid',
          paidAt: invoice.paidAt,
          paymentMethod,
          transactionId,
        },
      });
    } catch (error) {
      logger.error('Error marking invoice as paid', { error });
      next(error);
    }
  })
);

/**
 * POST /api/invoices/:id/cancel
 * Cancel an invoice
 */
router.post(
  '/:id/cancel',
  authenticate,
  param('id').isMongoId().withMessage('Valid invoice ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const { reason } = req.body;
      const user = req.user as any;
      const isAdmin = user.role === 'admin';
      const isProvider = user.role === 'provider';

      const Invoice = createInvoiceSchema();
      const invoice = await Invoice.findById(id);

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      // Cannot cancel paid invoices
      if (invoice.status === 'paid') {
        res.status(400).json({
          success: false,
          message: 'Cannot cancel a paid invoice. Process a refund instead.',
        });
        return;
      }

      // Authorization: provider who created it or admin
      if (!isAdmin) {
        if (isProvider && invoice.providerId.toString() !== user._id.toString()) {
          res.status(403).json({
            success: false,
            message: 'Not authorized to cancel this invoice',
          });
          return;
        }
      }

      invoice.status = 'cancelled';
      if (reason) {
        invoice.notes = invoice.notes ? `${invoice.notes}\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`;
      }
      await invoice.save();

      logger.info('Invoice cancelled', {
        invoiceId: id,
        cancelledBy: user._id,
        reason,
      });

      res.status(200).json({
        success: true,
        data: {
          id: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          status: 'cancelled',
        },
      });
    } catch (error) {
      logger.error('Error cancelling invoice', { error });
      next(error);
    }
  })
);

/**
 * GET /api/invoices/:id/pdf
 * Download invoice as PDF
 */
router.get(
  '/:id/pdf',
  authenticate,
  param('id').isMongoId().withMessage('Valid invoice ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const user = req.user as any;
      const isAdmin = user.role === 'admin';

      const Invoice = createInvoiceSchema();
      const invoice = await Invoice.findById(id)
        .populate<{ customerId: { firstName?: string; lastName?: string; email?: string } }>('customerId', 'firstName lastName email')
        .populate<{ providerId: { firstName?: string; lastName?: string } }>('providerId', 'firstName lastName')
        .lean() as (PopulatedInvoice & { customerId: { firstName?: string; lastName?: string; email?: string }; providerId: { firstName?: string; lastName?: string } }) | null;

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      // Authorization check
      const userId = user._id.toString();
      const isCustomer = (invoice as any).customerId?._id?.toString() === userId;
      const isInvoiceProvider = (invoice as any).providerId?._id?.toString() === userId;

      if (!isAdmin && !isCustomer && !isInvoiceProvider) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to download this invoice',
        });
        return;
      }

      // Build PDF-compatible invoice data
      const customer = (invoice as any).customerId || {};
      const provider = (invoice as any).providerId || {};
      const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      const providerName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim();

      const invoicePdfData: InvoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.createdAt,
        dueDate: invoice.dueDate,
        customer: {
          name: customerName,
          email: customer.email || '',
          phone: undefined,
          address: undefined,
        },
        provider: {
          name: providerName,
          email: provider.email || '',
          phone: undefined,
          address: undefined,
          businessName: undefined,
          licenseNumber: undefined,
        },
        service: {
          name: 'Service',
          category: undefined,
          description: undefined,
        },
        booking: {
          number: invoice.invoiceNumber,
          date: invoice.createdAt,
          scheduledDate: invoice.dueDate,
          scheduledTime: 'N/A',
          locationType: 'N/A',
          address: undefined,
          duration: 0,
        },
        lineItems: invoice.lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        pricing: {
          subtotal: invoice.subtotal,
          discount: 0,
          taxRate: invoice.taxRate,
          taxAmount: invoice.taxAmount,
          total: invoice.total,
          currency: invoice.currency || 'AED',
        },
        payment: {
          status: invoice.status === 'paid' ? 'paid' : invoice.status === 'refunded' ? 'refunded' : 'pending',
        },
        notes: invoice.notes,
        terms: 'Payment due within 14 days of service completion.',
      };

      // Generate actual PDF using pdfService
      const pdfBuffer = await pdfService.generateInvoicePDF(invoicePdfData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).send(pdfBuffer);

      logger.info('Invoice PDF generated', {
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        downloadedBy: user._id,
      });
    } catch (error) {
      logger.error('Error generating invoice PDF', { error });
      next(error);
    }
  })
);

/**
 * GET /api/invoices/stats
 * Get invoice statistics
 */
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { startDate, endDate, customerId, providerId } = req.query;
      const user = req.user as any;
      const isAdmin = user.role === 'admin';
      const isProvider = user.role === 'provider';

      const Invoice = createInvoiceSchema();
      const query: Record<string, any> = {};

      // Apply date filters
      if (startDate || endDate) {
        query.dueDate = {};
        if (startDate) query.dueDate.$gte = new Date(startDate as string);
        if (endDate) query.dueDate.$lte = new Date(endDate as string);
      }

      // Role-based filtering
      if (!isAdmin) {
        if (isProvider) {
          query.providerId = user._id;
        } else {
          query.customerId = user._id;
        }
      } else {
        // Admin can filter by customer or provider
        if (customerId) query.customerId = new mongoose.Types.ObjectId(customerId as string);
        if (providerId) query.providerId = new mongoose.Types.ObjectId(providerId as string);
      }

      const invoices = await Invoice.find(query).lean();

      // Calculate stats
      const stats = {
        totalInvoices: invoices.length,
        totalRevenue: invoices.reduce((sum, inv) => sum + (inv.status === 'paid' ? inv.total : 0), 0),
        pendingAmount: invoices.reduce((sum, inv) => sum + (inv.status === 'pending' || inv.status === 'sent' ? inv.total : 0), 0),
        overdueAmount: invoices.reduce((sum, inv) => sum + (inv.status === 'overdue' ? inv.total : 0), 0),
        paidThisMonth: invoices.filter(inv =>
          inv.status === 'paid' &&
          inv.paidAt &&
          new Date(inv.paidAt).getMonth() === new Date().getMonth()
        ).length,
        byStatus: {
          draft: invoices.filter(inv => inv.status === 'draft').length,
          pending: invoices.filter(inv => inv.status === 'pending').length,
          sent: invoices.filter(inv => inv.status === 'sent').length,
          viewed: invoices.filter(inv => inv.status === 'viewed').length,
          paid: invoices.filter(inv => inv.status === 'paid').length,
          overdue: invoices.filter(inv => inv.status === 'overdue').length,
          cancelled: invoices.filter(inv => inv.status === 'cancelled').length,
          refunded: invoices.filter(inv => inv.status === 'refunded').length,
        },
      };

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching invoice stats', { error });
      next(error);
    }
  })
);

export default router;
