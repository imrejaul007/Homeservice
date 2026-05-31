/**
 * Lead Generation Routes
 *
 * Handles lead capture and management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import mongoose from 'mongoose';
import logger from '../utils/logger';

const router = Router();

// Lead model interface
interface LeadDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phone: string;
  serviceType: string;
  categoryId?: mongoose.Types.ObjectId;
  description?: string;
  preferredDate?: Date;
  address?: string;
  source?: string;
  utmData?: Record<string, any>;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  assignedTo?: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;
  notes?: string;
  nextFollowUp?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Populated lead type for .lean() results with populate
interface PopulatedLead {
  _id: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phone: string;
  serviceType: string;
  categoryId?: {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
  description?: string;
  preferredDate?: Date;
  address?: string;
  source?: string;
  utmData?: Record<string, any>;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  assignedTo?: {
    _id: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  assignedBy?: {
    _id: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
  };
  notes?: string;
  nextFollowUp?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Validation for lead creation
const createLeadValidation = [
  body('name').isString().notEmpty().withMessage('Name is required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').isString().notEmpty().withMessage('Phone is required'),
  body('serviceType').isString().notEmpty().withMessage('Service type is required'),
  body('categoryId').optional().isMongoId().withMessage('Valid category ID required'),
  body('description').optional().isString(),
  body('preferredDate').optional().isISO8601().withMessage('Valid date required'),
  body('address').optional().isString(),
  body('source').optional().isString(),
  body('utmData').optional().isObject().withMessage('UTM data must be an object'),
];

// Lead schema for dynamic model creation
const createLeadSchema = () => {
  const LeadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String, required: true },
    serviceType: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory' },
    description: { type: String },
    preferredDate: { type: Date },
    address: { type: String },
    source: { type: String },
    utmData: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
      default: 'new'
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    nextFollowUp: { type: Date },
  }, { timestamps: true });

  LeadSchema.index({ status: 1, createdAt: -1 });
  LeadSchema.index({ assignedTo: 1 });
  LeadSchema.index({ email: 1 });
  LeadSchema.index({ phone: 1 });

  return mongoose.models.Lead || mongoose.model<LeadDocument>('Lead', LeadSchema);
};

/**
 * GET /api/leads
 * List leads (admin/provider only)
 */
router.get(
  '/',
  authenticate,
  requireRole(['admin', 'provider']),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        status,
        source,
        categoryId,
        providerId,
        assignedTo,
        startDate,
        endDate,
        page = '1',
        limit = '20',
      } = req.query;

      const user = req.user as any;
      const isAdmin = user.role === 'admin';

      // Build query
      const query: Record<string, any> = {};

      if (status) query.status = status;
      if (source) query.source = source;
      if (categoryId) query.categoryId = new mongoose.Types.ObjectId(categoryId as string);
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate as string);
        if (endDate) query.createdAt.$lte = new Date(endDate as string);
      }

      // Providers see only assigned leads, admins see all
      if (!isAdmin) {
        query.assignedTo = user._id;
      } else if (assignedTo) {
        query.assignedTo = new mongoose.Types.ObjectId(assignedTo as string);
      }

      const Lead = createLeadSchema();
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [leads, total] = await Promise.all([
        Lead.find(query)
          .populate('categoryId', 'name')
          .populate('assignedTo', 'firstName lastName email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Lead.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: {
          leads: leads.map((lead: any) => ({
            id: lead._id.toString(),
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            serviceType: lead.serviceType,
            category: lead.categoryId,
            description: lead.description,
            preferredDate: lead.preferredDate,
            address: lead.address,
            source: lead.source,
            status: lead.status,
            assignedTo: lead.assignedTo,
            notes: lead.notes,
            nextFollowUp: lead.nextFollowUp,
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt,
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
      logger.error('Error fetching leads', { error });
      next(error);
    }
  })
);

/**
 * POST /api/leads
 * Create a new lead (public or authenticated)
 */
router.post(
  '/',
  createLeadValidation,
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

      const leadData = req.body;
      const user = req.user as any;
      const userId = user?._id;

      const Lead = createLeadSchema();

      const lead = new Lead({
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone,
        serviceType: leadData.serviceType,
        categoryId: leadData.categoryId,
        description: leadData.description,
        preferredDate: leadData.preferredDate,
        address: leadData.address,
        source: leadData.source || 'website',
        utmData: leadData.utmData,
        status: 'new',
        assignedTo: userId,
      });

      await lead.save();

      logger.info('Lead created', {
        leadId: lead._id.toString(),
        serviceType: lead.serviceType,
        source: lead.source,
      });

      res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        data: {
          id: lead._id.toString(),
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          serviceType: lead.serviceType,
          categoryId: lead.categoryId,
          status: lead.status,
          assignedTo: userId,
          createdAt: lead.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error creating lead', { error });
      next(error);
    }
  })
);

/**
 * GET /api/leads/:id
 * Get lead details
 */
router.get(
  '/:id',
  authenticate,
  requireRole(['admin', 'provider']),
  param('id').isMongoId().withMessage('Valid lead ID required'),
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

      const Lead = createLeadSchema();
      const lead = await Lead.findById(id)
        .populate<{ categoryId: PopulatedLead['categoryId'] }>('categoryId', 'name')
        .populate<{ assignedTo: PopulatedLead['assignedTo'] }>('assignedTo', 'firstName lastName email phone')
        .populate<{ assignedBy: PopulatedLead['assignedBy'] }>('assignedBy', 'firstName lastName')
        .lean<PopulatedLead>();

      if (!lead) {
        res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
        return;
      }

      // Authorization check
      if (!isAdmin && lead.assignedTo?._id?.toString() !== user._id.toString()) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to view this lead',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: lead._id.toString(),
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          serviceType: lead.serviceType,
          category: lead.categoryId,
          description: lead.description,
          preferredDate: lead.preferredDate,
          address: lead.address,
          source: lead.source,
          utmData: lead.utmData,
          status: lead.status,
          assignedTo: lead.assignedTo,
          assignedBy: lead.assignedBy,
          notes: lead.notes,
          nextFollowUp: lead.nextFollowUp,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Error fetching lead', { error });
      next(error);
    }
  })
);

/**
 * PUT /api/leads/:id/status
 * Update lead status
 */
router.put(
  '/:id/status',
  authenticate,
  requireRole(['admin', 'provider']),
  [
    param('id').isMongoId().withMessage('Valid lead ID required'),
    body('status')
      .isIn(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])
      .withMessage('Invalid status'),
    body('notes').optional().isString(),
    body('nextFollowUp').optional().isISO8601().withMessage('Valid date required'),
  ],
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
      const { status, notes, nextFollowUp } = req.body;
      const user = req.user as any;
      const updatedBy = user._id;

      const Lead = createLeadSchema();
      const lead = await Lead.findById(id);

      if (!lead) {
        res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
        return;
      }

      // Authorization check
      const isAdmin = user.role === 'admin';
      if (!isAdmin && lead.assignedTo?.toString() !== user._id.toString()) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to update this lead',
        });
        return;
      }

      lead.status = status;
      if (notes !== undefined) lead.notes = notes;
      if (nextFollowUp !== undefined) lead.nextFollowUp = new Date(nextFollowUp);

      await lead.save();

      logger.info('Lead status updated', {
        leadId: id,
        status,
        updatedBy: updatedBy.toString(),
      });

      res.status(200).json({
        success: true,
        message: 'Lead status updated successfully',
        data: {
          id: lead._id.toString(),
          status: lead.status,
          notes: lead.notes,
          nextFollowUp: lead.nextFollowUp,
          updatedBy: updatedBy.toString(),
          updatedAt: lead.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Error updating lead status', { error });
      next(error);
    }
  })
);

export default router;
