/**
 * Invoice Management Routes
 *
 * Handles invoice operations including listing, viewing, sending, and PDF download
 */

import { Router, Request, Response, NextFunction } from 'express';
import { param, query, validationResult } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import { send as emailSend } from '../services/email.service';

const router = Router();

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
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';
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
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';
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
      enum: ['draft', 'pending', 'sent', 'paid', 'overdue', 'cancelled'],
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
          invoices: invoices.map((inv: any) => ({
            id: inv._id.toString(),
            invoiceNumber: inv.invoiceNumber,
            customer: inv.customerId,
            provider: inv.providerId,
            booking: inv.bookingId,
            lineItems: inv.lineItems,
            subtotal: inv.subtotal,
            taxRate: inv.taxRate,
            taxAmount: inv.taxAmount,
            total: inv.total,
            currency: inv.currency,
            status: inv.status,
            dueDate: inv.dueDate,
            paidAt: inv.paidAt,
            sentAt: inv.sentAt,
            notes: inv.notes,
            createdAt: inv.createdAt,
          })),
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
        data: {
          id: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customerId,
          provider: invoice.providerId,
          booking: invoice.bookingId,
          lineItems: invoice.lineItems,
          subtotal: invoice.subtotal,
          taxRate: invoice.taxRate,
          taxAmount: invoice.taxAmount,
          total: invoice.total,
          currency: invoice.currency,
          status: invoice.status,
          dueDate: invoice.dueDate,
          paidAt: invoice.paidAt,
          sentAt: invoice.sentAt,
          notes: invoice.notes,
          createdAt: invoice.createdAt,
        },
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

      // Generate simple text-based invoice response
      // In production, would use a PDF library like pdfkit or puppeteer
      const invoiceText = `
INVOICE
=======
Invoice Number: ${invoice.invoiceNumber}
Date: ${invoice.createdAt.toLocaleDateString()}
Due Date: ${invoice.dueDate.toLocaleDateString()}

BILL TO:
${(invoice as any).customerId?.firstName} ${(invoice as any).customerId?.lastName}
${(invoice as any).customerId?.email}

FROM:
${(invoice as any).providerId?.firstName} ${(invoice as any).providerId?.lastName}

SERVICES:
${invoice.lineItems.map((item, i) => `${i + 1}. ${item.description} x${item.quantity} @ ${invoice.currency} ${item.unitPrice} = ${invoice.currency} ${item.total}`).join('\n')}

---------------------------------
Subtotal: ${invoice.currency} ${invoice.subtotal}
Tax (${invoice.taxRate}%): ${invoice.currency} ${invoice.taxAmount}
TOTAL: ${invoice.currency} ${invoice.total}
---------------------------------

Status: ${invoice.status}
`;

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.txt`);
      res.status(200).send(invoiceText);
    } catch (error) {
      logger.error('Error generating invoice PDF', { error });
      next(error);
    }
  })
);

export default router;
