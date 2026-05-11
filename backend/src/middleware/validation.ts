import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// ===================================
// BOOKING VALIDATION SCHEMAS
// ===================================

const createBookingSchema = Joi.object({
  serviceId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid service ID format',
      'any.required': 'Service ID is required'
    }),

  providerId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid provider ID format',
      'any.required': 'Provider ID is required'
    }),

  scheduledDate: Joi.date()
    .required()
    .messages({
      'any.required': 'Scheduled date is required'
    }),

  scheduledTime: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid time format. Use HH:MM format',
      'any.required': 'Scheduled time is required'
    }),

  location: Joi.object({
    type: Joi.string()
      .valid('customer_address', 'provider_location', 'online')
      .optional()
      .default('customer_address'),
    address: Joi.object({
      street: Joi.string().allow('').optional(),
      city: Joi.string().allow('').optional(),
      state: Joi.string().allow('').optional(),
      zipCode: Joi.string().allow('').optional(),
      country: Joi.string().default('IN'),
      coordinates: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array()
          .items(Joi.number())
          .length(2)
          .optional()
      }).optional()
    }).optional(),
    notes: Joi.string().max(500).allow('').optional()
  }).optional(),

  customerInfo: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string()
      .pattern(/^\+?[\d\s\-\(\)]{7,}$/)
      .allow('')
      .optional()
      .messages({
        'string.pattern.base': 'Invalid phone number format'
      }),
    specialRequests: Joi.string().max(1000).allow('').optional(),
    accessInstructions: Joi.string().max(500).allow('').optional()
  }).optional(),

  addOns: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        price: Joi.number().min(0).required()
      })
    )
    .optional(),

  notes: Joi.string().max(1000).allow('').optional(),

  metadata: Joi.object({
    bookingSource: Joi.string()
      .valid('search', 'profile', 'recommendation', 'repeat')
      .default('search'),
    deviceType: Joi.string()
      .valid('mobile', 'desktop', 'tablet')
      .default('desktop'),
    sessionId: Joi.string().optional()
  }).optional(),

  // New booking flow fields
  locationType: Joi.string()
    .valid('at_home', 'hotel')
    .optional()
    .default('at_home'),

  selectedDuration: Joi.number()
    .min(15)
    .max(480)
    .optional(),

  professionalPreference: Joi.string()
    .valid('male', 'female', 'no_preference')
    .optional()
    .default('no_preference'),

  paymentMethod: Joi.string()
    .valid('apple_pay', 'credit_card', 'cash')
    .optional()
    .default('credit_card')
});

const bookingMessageSchema = Joi.object({
  message: Joi.string()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.empty': 'Message cannot be empty',
      'string.max': 'Message cannot exceed 1000 characters',
      'any.required': 'Message is required'
    })
});

const cancelBookingSchema = Joi.object({
  reason: Joi.string()
    .min(5)
    .max(500)
    .optional()
    .messages({
      'string.min': 'Cancellation reason must be at least 5 characters',
      'string.max': 'Cancellation reason cannot exceed 500 characters'
    })
});

const acceptBookingSchema = Joi.object({
  notes: Joi.string().max(500).optional(),
  estimatedArrival: Joi.date().min('now').optional()
});

const rejectBookingSchema = Joi.object({
  reason: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': 'Rejection reason must be at least 10 characters',
      'string.max': 'Rejection reason cannot exceed 500 characters',
      'any.required': 'Rejection reason is required'
    })
});

const completeBookingSchema = Joi.object({
  notes: Joi.string().max(500).optional(),
  actualDuration: Joi.number().min(15).max(480).optional()
});

// ===================================
// AVAILABILITY VALIDATION SCHEMAS
// ===================================

const timeSlotSchema = Joi.object({
  start: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid start time format. Use HH:MM format'
    }),
  end: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid end time format. Use HH:MM format'
    }),
  isActive: Joi.boolean().default(true)
});

const dayScheduleSchema = Joi.object({
  isAvailable: Joi.boolean().default(true),
  timeSlots: Joi.array().items(timeSlotSchema).optional()
});

const weeklyScheduleSchema = Joi.object({
  monday: dayScheduleSchema.optional(),
  tuesday: dayScheduleSchema.optional(),
  wednesday: dayScheduleSchema.optional(),
  thursday: dayScheduleSchema.optional(),
  friday: dayScheduleSchema.optional(),
  saturday: dayScheduleSchema.optional(),
  sunday: dayScheduleSchema.optional()
});

const bufferTimeSchema = Joi.object({
  beforeBooking: Joi.number().min(0).max(120).optional(),
  afterBooking: Joi.number().min(0).max(120).optional(),
  minimumGap: Joi.number().min(15).max(240).optional()
});

const advanceBookingSchema = Joi.object({
  minimumNotice: Joi.number().min(0).max(168).optional(),
  maximumAdvance: Joi.number().min(1).max(365).optional(),
  instantBookingEnabled: Joi.boolean().optional(),
  requiresApproval: Joi.boolean().optional()
});

const preferencesSchema = Joi.object({
  defaultBookingDuration: Joi.number().min(15).max(480).optional(),
  allowBackToBackBookings: Joi.boolean().optional(),
  allowWeekendBookings: Joi.boolean().optional(),
  allowHolidayBookings: Joi.boolean().optional(),
  maxBookingsPerDay: Joi.number().min(1).max(24).optional(),
  notificationPreferences: Joi.object({
    newBookingRequest: Joi.boolean().optional(),
    bookingConfirmation: Joi.boolean().optional(),
    bookingReminder: Joi.boolean().optional(),
    scheduleChanges: Joi.boolean().optional()
  }).optional()
});

const updateAvailabilitySchema = Joi.object({
  weeklySchedule: weeklyScheduleSchema.optional(),
  bufferTime: bufferTimeSchema.optional(),
  advanceBooking: advanceBookingSchema.optional(),
  preferences: preferencesSchema.optional(),
  timezone: Joi.string().optional(),
  autoAcceptBookings: Joi.boolean().optional(),
  autoAcceptRules: Joi.object({
    withinHours: Joi.number().min(1).optional(),
    maxBookingsPerDay: Joi.number().min(1).optional(),
    preferredCustomers: Joi.boolean().optional(),
    minimumRating: Joi.number().min(1.0).max(5.0).optional()
  }).optional()
});

const dateOverrideSchema = Joi.object({
  date: Joi.date()
    .min('now')
    .required()
    .messages({
      'date.min': 'Cannot set override for past dates',
      'any.required': 'Date is required'
    }),
  isAvailable: Joi.boolean().required(),
  timeSlots: Joi.array().items(timeSlotSchema).optional(),
  reason: Joi.string()
    .valid('vacation', 'sick', 'booked', 'special_event', 'maintenance', 'personal', 'holiday')
    .default('personal'),
  notes: Joi.string().max(500).optional()
});

const blockPeriodSchema = Joi.object({
  startDate: Joi.date()
    .required()
    .messages({
      'any.required': 'Start date is required'
    }),
  endDate: Joi.date()
    .greater(Joi.ref('startDate'))
    .required()
    .messages({
      'date.greater': 'End date must be after start date',
      'any.required': 'End date is required'
    }),
  reason: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'Reason must be at least 3 characters',
      'string.max': 'Reason cannot exceed 100 characters',
      'any.required': 'Reason is required'
    }),
  title: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title cannot exceed 100 characters',
      'any.required': 'Title is required'
    }),
  notes: Joi.string().max(500).optional()
});

// ===================================
// VALIDATION MIDDLEWARE FUNCTIONS
// ===================================

// Generic validation middleware factory
const createValidationMiddleware = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Debug logging for booking validation
    if (req.path === '/api/bookings' || req.originalUrl?.includes('/bookings')) {
      console.log('🔍 [BOOKING VALIDATION] Request body:', JSON.stringify(req.body, null, 2));
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      console.log('❌ [VALIDATION ERROR]', error.details);
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errorMessages
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    return next();
  };
};

// Specific validation middleware functions
export const validateBookingInput = createValidationMiddleware(createBookingSchema);
export const validateBookingMessage = createValidationMiddleware(bookingMessageSchema);
export const validateBookingCancellation = createValidationMiddleware(cancelBookingSchema);
export const validateBookingAcceptance = createValidationMiddleware(acceptBookingSchema);
export const validateBookingRejection = createValidationMiddleware(rejectBookingSchema);
export const validateBookingCompletion = createValidationMiddleware(completeBookingSchema);

export const validateAvailabilityInput = createValidationMiddleware(updateAvailabilitySchema);
export const validateDateOverride = createValidationMiddleware(dateOverrideSchema);
export const validateBlockPeriod = createValidationMiddleware(blockPeriodSchema);

// ===================================
// CUSTOM VALIDATION FUNCTIONS
// ===================================

// Validate time slot overlaps
export const validateTimeSlotOverlaps = (req: Request, res: Response, next: NextFunction) => {
  const { weeklySchedule } = req.body;

  if (!weeklySchedule) {
    return next();
  }

  for (const [day, schedule] of Object.entries(weeklySchedule)) {
    const daySchedule = schedule as any;
    if (!daySchedule.timeSlots || daySchedule.timeSlots.length <= 1) {
      continue;
    }

    const slots = daySchedule.timeSlots;

    // Check for overlaps within the day
    for (let i = 0; i < slots.length - 1; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const slot1 = slots[i];
        const slot2 = slots[j];

        const start1 = timeToMinutes(slot1.start);
        const end1 = timeToMinutes(slot1.end);
        const start2 = timeToMinutes(slot2.start);
        const end2 = timeToMinutes(slot2.end);

        if (start1 < end2 && start2 < end1) {
          return res.status(400).json({
            success: false,
            message: `Overlapping time slots detected on ${day}`,
            errors: [{
              field: `weeklySchedule.${day}.timeSlots`,
              message: `Time slots ${slot1.start}-${slot1.end} and ${slot2.start}-${slot2.end} overlap`
            }]
          });
        }
      }
    }

    // Validate that start time is before end time for each slot
    for (const slot of slots) {
      const start = timeToMinutes(slot.start);
      const end = timeToMinutes(slot.end);

      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: `Invalid time slot on ${day}`,
          errors: [{
            field: `weeklySchedule.${day}.timeSlots`,
            message: `Start time ${slot.start} must be before end time ${slot.end}`
          }]
        });
      }
    }
  }

  next();
};

// Validate business hours constraints
export const validateBusinessHours = (req: Request, res: Response, next: NextFunction) => {
  const { weeklySchedule } = req.body;

  if (!weeklySchedule) {
    return next();
  }

  for (const [day, schedule] of Object.entries(weeklySchedule)) {
    const daySchedule = schedule as any;
    if (!daySchedule.timeSlots) {
      continue;
    }

    for (const slot of daySchedule.timeSlots) {
      const start = timeToMinutes(slot.start);
      const end = timeToMinutes(slot.end);

      // Ensure reasonable business hours (5 AM to 11 PM)
      if (start < 300 || end > 1380) { // 5 AM = 300 minutes, 11 PM = 1380 minutes
        return res.status(400).json({
          success: false,
          message: `Unreasonable business hours on ${day}`,
          errors: [{
            field: `weeklySchedule.${day}.timeSlots`,
            message: `Time slot ${slot.start}-${slot.end} is outside reasonable business hours (5 AM - 11 PM)`
          }]
        });
      }

      // Ensure minimum slot duration (30 minutes)
      if ((end - start) < 30) {
        return res.status(400).json({
          success: false,
          message: `Time slot too short on ${day}`,
          errors: [{
            field: `weeklySchedule.${day}.timeSlots`,
            message: `Time slot ${slot.start}-${slot.end} must be at least 30 minutes long`
          }]
        });
      }
    }
  }

  next();
};

// Role-based access validation
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    return next();
  };
};

// Helper function to convert time string to minutes
function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Export all validation middleware
export default {
  validateBookingInput,
  validateBookingMessage,
  validateBookingCancellation,
  validateBookingAcceptance,
  validateBookingRejection,
  validateBookingCompletion,
  validateAvailabilityInput,
  validateDateOverride,
  validateBlockPeriod,
  validateTimeSlotOverlaps,
  validateBusinessHours,
  requireRole
};