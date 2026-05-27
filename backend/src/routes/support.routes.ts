import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
import Joi from 'joi';
import {
  // Admin Controllers
  getAllTickets,
  getTicketStats,
  getTicketById,
  updateTicket,
  assignTicket,
  addTicketMessage,
  resolveTicket,
  closeTicket,
  getAdminList,
  // User Controllers
  getUserTickets,
  createTicket,
  getUserTicketById,
  addUserMessage,
  closeUserTicket
} from '../controllers/support.controller';

const router = Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createTicketSchema = Joi.object({
  category: Joi.string()
    .valid('technical', 'billing', 'account', 'service', 'other')
    .required()
    .messages({
      'any.only': 'Category must be one of: technical, billing, account, service, other',
      'any.required': 'Category is required'
    }),
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .optional()
    .default('medium'),
  subject: Joi.string()
    .min(5)
    .max(200)
    .required()
    .messages({
      'string.min': 'Subject must be at least 5 characters',
      'string.max': 'Subject cannot exceed 200 characters',
      'any.required': 'Subject is required'
    }),
  description: Joi.string()
    .min(20)
    .max(5000)
    .required()
    .messages({
      'string.min': 'Description must be at least 20 characters',
      'string.max': 'Description cannot exceed 5000 characters',
      'any.required': 'Description is required'
    })
});

const addMessageSchema = Joi.object({
  message: Joi.string()
    .min(1)
    .max(5000)
    .required()
    .messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message cannot exceed 5000 characters',
      'any.required': 'Message content is required'
    })
});

const updateTicketSchema = Joi.object({
  status: Joi.string()
    .valid('open', 'in_progress', 'pending_response', 'resolved', 'closed')
    .optional(),
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .optional(),
  category: Joi.string()
    .valid('technical', 'billing', 'account', 'service', 'other')
    .optional(),
  subject: Joi.string()
    .min(5)
    .max(200)
    .optional(),
  description: Joi.string()
    .min(20)
    .max(5000)
    .optional()
});

const assignTicketSchema = Joi.object({
  adminId: Joi.string()
    .required()
    .messages({
      'any.required': 'Admin ID is required'
    }),
  adminName: Joi.string()
    .optional()
});

const resolveTicketSchema = Joi.object({
  resolutionNote: Joi.string()
    .max(1000)
    .optional()
});

const closeTicketSchema = Joi.object({
  note: Joi.string()
    .max(1000)
    .optional()
});

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

const validateCreateTicket = (req: any, res: any, next: any) => {
  const { error, value } = createTicketSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  req.body = value;
  next();
};

const validateAddMessage = (req: any, res: any, next: any) => {
  const { error, value } = addMessageSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  req.body = value;
  next();
};

const validateUpdateTicket = (req: any, res: any, next: any) => {
  const { error, value } = updateTicketSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  req.body = value;
  next();
};

const validateAssignTicket = (req: any, res: any, next: any) => {
  const { error, value } = assignTicketSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  req.body = value;
  next();
};

const validateResolveTicket = (req: any, res: any, next: any) => {
  const { error, value } = resolveTicketSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  req.body = value;
  next();
};

const validateCloseTicket = (req: any, res: any, next: any) => {
  const { error, value } = closeTicketSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  req.body = value;
  next();
};

// ============================================
// USER SUPPORT ROUTES (authenticated users)
// ============================================

// Get user's own tickets
router.get('/tickets', authenticate, getUserTickets);

// Create new support ticket
router.post('/tickets', authenticate, validateCreateTicket, createTicket);

// Get single ticket (user's own)
router.get('/tickets/:id', authenticate, getUserTicketById);

// Add message to ticket (user side)
router.post('/tickets/:id/message', authenticate, validateAddMessage, addUserMessage);

// Close ticket (user side - only resolved tickets)
router.patch('/tickets/:id/close', authenticate, validateCloseTicket, closeUserTicket);

// ============================================
// LEGACY ROUTES (backward compatibility)
// ============================================

router.get('/faqs', (_req, res) => {
  res.json({ faqs: [] });
});

// ============================================
// ADMIN TICKET MANAGEMENT ROUTES
// ============================================

// All admin routes require authentication, admin role, and rate limiting
router.use('/admin/tickets', authenticate, requireRole('admin'), adminLimiter);

// Get all tickets with filtering and pagination
// Query params: page, limit, status, priority, category, search, assignedTo
router.get('/admin/tickets', getAllTickets);

// Get ticket statistics for dashboard
router.get('/admin/tickets/stats', getTicketStats);

// Get list of admins for assignment dropdown
router.get('/admin/tickets/admins', getAdminList);

// Get single ticket by ID
router.get('/admin/tickets/:id', getTicketById);

// Update ticket (status, priority, category)
router.patch('/admin/tickets/:id', validateUpdateTicket, updateTicket);

// Assign ticket to admin
router.post('/admin/tickets/:id/assign', validateAssignTicket, assignTicket);

// Add message to ticket thread
router.post('/admin/tickets/:id/message', validateAddMessage, addTicketMessage);

// Resolve ticket
router.patch('/admin/tickets/:id/resolve', validateResolveTicket, resolveTicket);

// Close ticket
router.patch('/admin/tickets/:id/close', validateCloseTicket, closeTicket);

export default router;
