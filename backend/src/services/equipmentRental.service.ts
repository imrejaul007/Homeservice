import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type EquipmentCategory = 'cleaning' | 'plumbing' | 'electrical' | 'landscaping' | 'construction' | 'general';
export type EquipmentCondition = 'new' | 'good' | 'fair' | 'needs_repair';
export type RentalStatus = 'available' | 'rented' | 'reserved' | 'maintenance' | 'retired';
export type DamageSeverity = 'none' | 'minor' | 'moderate' | 'severe' | 'total_loss';

export interface Equipment {
  _id?: Types.ObjectId;
  equipmentId: string;
  name: string;
  description: string;
  category: EquipmentCategory;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  condition: EquipmentCondition;
  conditionNotes?: string;
  images: string[];
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  depositAmount: number;
  depositRefundable: boolean;
  maxRentalDays: number;
  minRentalDays: number;
  requiresLicense?: string;
  requiresTraining: boolean;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  providerId?: Types.ObjectId;
  isPlatformOwned: boolean;
  status: RentalStatus;
  currentRenter?: Types.ObjectId;
  location?: {
    type: 'Point';
    coordinates: [number, number];
    address?: string;
  };
  availabilityCalendar: Array<{
    date: Date;
    status: 'available' | 'booked' | 'maintenance';
  }>;
  damageHistory: Array<{
    reportId: string;
    reportedAt: Date;
    reportedBy: Types.ObjectId;
    severity: DamageSeverity;
    description: string;
    repairCost?: number;
    depositDeducted?: number;
    resolvedAt?: Date;
  }>;
  metadata?: {
    tags?: string[];
    instructions?: string;
    safetyWarnings?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface RentalBooking {
  _id?: Types.ObjectId;
  rentalId: string;
  rentalNumber: string;
  equipmentId: Types.ObjectId;
  equipmentName: string;
  customerId: Types.ObjectId;
  customerName: string;
  bookingId?: Types.ObjectId;
  providerId?: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  rentalDays: number;
  dailyRate: number;
  subtotal: number;
  depositAmount: number;
  depositStatus: 'pending' | 'held' | 'refunded' | 'forfeited';
  depositRefundAmount: number;
  taxes: number;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'damaged';
  damageReport?: {
    reportId: string;
    severity: DamageSeverity;
    description: string;
    repairCost: number;
    depositDeducted: number;
    resolvedAt?: Date;
  };
  pickupTime?: string;
  returnTime?: string;
  pickupLocation?: string;
  returnLocation?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DamageAssessment {
  _id?: Types.ObjectId;
  assessmentId: string;
  rentalId: Types.ObjectId;
  equipmentId: Types.ObjectId;
  assessorId: Types.ObjectId;
  customerId: Types.ObjectId;
  assessmentType: 'pickup' | 'return' | 'mid_rental' | 'incident';
  preAssessment?: {
    photos: string[];
    notes: string;
    condition: EquipmentCondition;
    assessedAt: Date;
  };
  postAssessment?: {
    photos: string[];
    notes: string;
    condition: EquipmentCondition;
    assessedAt: Date;
  };
  damageFound: boolean;
  damageDetails?: Array<{
    component: string;
    description: string;
    severity: DamageSeverity;
    estimatedRepairCost: number;
    photos: string[];
  }>;
  totalEstimatedCost: number;
  depositAmount: number;
  depositDeduction: number;
  status: 'pending' | 'in_review' | 'resolved' | 'disputed';
  resolution?: {
    type: 'repair' | 'replace' | 'refund' | 'no_action';
    notes: string;
    resolvedAt: Date;
  };
  createdAt: Date;
}

// ============================================
// Equipment Rental Service
// ============================================

export class EquipmentRentalService {
  private equipmentModel: any;
  private rentalModel: any;
  private assessmentModel: any;

  constructor() {
    this.initializeModels();
  }

  private initializeModels(): void {
    try {
      this.equipmentModel = mongoose.models.Equipment || this.createEquipmentSchema();
      this.rentalModel = mongoose.models.RentalBooking || this.createRentalSchema();
      this.assessmentModel = mongoose.models.DamageAssessment || this.createAssessmentSchema();
    } catch {
      this.equipmentModel = this.createEquipmentSchema();
      this.rentalModel = this.createRentalSchema();
      this.assessmentModel = this.createAssessmentSchema();
    }
  }

  private createEquipmentSchema(): any {
    const EquipmentSchema = new mongoose.Schema({
      equipmentId: { type: String, required: true, unique: true },
      name: { type: String, required: true, trim: true },
      description: { type: String, required: true },
      category: {
        type: String,
        enum: ['cleaning', 'plumbing', 'electrical', 'landscaping', 'construction', 'general'],
        required: true,
      },
      manufacturer: String,
      model: String,
      serialNumber: String,
      condition: {
        type: String,
        enum: ['new', 'good', 'fair', 'needs_repair'],
        default: 'good',
      },
      conditionNotes: String,
      images: [String],
      dailyRate: { type: Number, required: true, min: 0 },
      weeklyRate: Number,
      monthlyRate: Number,
      depositAmount: { type: Number, required: true, min: 0 },
      depositRefundable: { type: Boolean, default: true },
      maxRentalDays: { type: Number, default: 30 },
      minRentalDays: { type: Number, default: 1 },
      requiresLicense: String,
      requiresTraining: { type: Boolean, default: false },
      weight: Number,
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
      },
      providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      isPlatformOwned: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['available', 'rented', 'reserved', 'maintenance', 'retired'],
        default: 'available',
      },
      currentRenter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number],
        address: String,
      },
      availabilityCalendar: [{
        date: Date,
        status: { type: String, enum: ['available', 'booked', 'maintenance'] },
      }],
      damageHistory: [{
        reportId: String,
        reportedAt: Date,
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        severity: { type: String, enum: ['none', 'minor', 'moderate', 'severe', 'total_loss'] },
        description: String,
        repairCost: Number,
        depositDeducted: Number,
        resolvedAt: Date,
      }],
      metadata: {
        tags: [String],
        instructions: String,
        safetyWarnings: [String],
      },
    }, { timestamps: true });

    EquipmentSchema.index({ category: 1, status: 1 });
    EquipmentSchema.index({ providerId: 1 });
    EquipmentSchema.index({ status: 1, 'availabilityCalendar.date': 1 });
    EquipmentSchema.index({ location: '2dsphere' });

    return mongoose.model('Equipment', EquipmentSchema);
  }

  private createRentalSchema(): any {
    const RentalSchema = new mongoose.Schema({
      rentalId: { type: String, required: true, unique: true },
      rentalNumber: { type: String, required: true, unique: true },
      equipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
      equipmentName: { type: String, required: true },
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      customerName: { type: String, required: true },
      bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
      providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      rentalDays: { type: Number, required: true, min: 1 },
      dailyRate: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      depositAmount: { type: Number, required: true },
      depositStatus: {
        type: String,
        enum: ['pending', 'held', 'refunded', 'forfeited'],
        default: 'pending',
      },
      depositRefundAmount: { type: Number, default: 0 },
      taxes: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
      currency: { type: String, default: 'AED' },
      status: {
        type: String,
        enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'damaged'],
        default: 'pending',
      },
      damageReport: {
        reportId: String,
        severity: { type: String, enum: ['none', 'minor', 'moderate', 'severe', 'total_loss'] },
        description: String,
        repairCost: Number,
        depositDeducted: Number,
        resolvedAt: Date,
      },
      pickupTime: String,
      returnTime: String,
      pickupLocation: String,
      returnLocation: String,
      notes: String,
    }, { timestamps: true });

    RentalSchema.index({ rentalId: 1 }, { unique: true });
    RentalSchema.index({ customerId: 1 });
    RentalSchema.index({ equipmentId: 1 });
    RentalSchema.index({ status: 1, startDate: 1 });

    return mongoose.model('RentalBooking', RentalSchema);
  }

  private createAssessmentSchema(): any {
    const AssessmentSchema = new mongoose.Schema({
      assessmentId: { type: String, required: true, unique: true },
      rentalId: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalBooking', required: true },
      equipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
      assessorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      assessmentType: {
        type: String,
        enum: ['pickup', 'return', 'mid_rental', 'incident'],
        required: true,
      },
      preAssessment: {
        photos: [String],
        notes: String,
        condition: { type: String, enum: ['new', 'good', 'fair', 'needs_repair'] },
        assessedAt: Date,
      },
      postAssessment: {
        photos: [String],
        notes: String,
        condition: { type: String, enum: ['new', 'good', 'fair', 'needs_repair'] },
        assessedAt: Date,
      },
      damageFound: { type: Boolean, default: false },
      damageDetails: [{
        component: String,
        description: String,
        severity: { type: String, enum: ['none', 'minor', 'moderate', 'severe', 'total_loss'] },
        estimatedRepairCost: Number,
        photos: [String],
      }],
      totalEstimatedCost: { type: Number, default: 0 },
      depositAmount: { type: Number, required: true },
      depositDeduction: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['pending', 'in_review', 'resolved', 'disputed'],
        default: 'pending',
      },
      resolution: {
        type: { type: String, enum: ['repair', 'replace', 'refund', 'no_action'] },
        notes: String,
        resolvedAt: Date,
      },
    }, { timestamps: true });

    AssessmentSchema.index({ assessmentId: 1 }, { unique: true });
    AssessmentSchema.index({ rentalId: 1 });
    AssessmentSchema.index({ equipmentId: 1 });

    return mongoose.model('DamageAssessment', AssessmentSchema);
  }

  // ============================================
  // Equipment Catalog Management
  // ============================================

  /**
   * Add new equipment to the catalog
   */
  async addEquipment(data: {
    name: string;
    description: string;
    category: EquipmentCategory;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    condition?: EquipmentCondition;
    images?: string[];
    dailyRate: number;
    weeklyRate?: number;
    monthlyRate?: number;
    depositAmount: number;
    depositRefundable?: boolean;
    maxRentalDays?: number;
    minRentalDays?: number;
    requiresLicense?: string;
    requiresTraining?: boolean;
    weight?: number;
    dimensions?: { length: number; width: number; height: number };
    providerId?: string;
    isPlatformOwned?: boolean;
    location?: { coordinates: [number, number]; address?: string };
    metadata?: {
      tags?: string[];
      instructions?: string;
      safetyWarnings?: string[];
    };
  }): Promise<{ success: boolean; equipment?: Equipment; error?: string }> {
    try {
      const equipmentId = this.generateEquipmentId();

      const equipment = new this.equipmentModel({
        equipmentId,
        ...data,
        providerId: data.providerId ? new Types.ObjectId(data.providerId) : undefined,
        status: 'available',
      });

      await equipment.save();

      logger.info('Equipment added to catalog', {
        equipmentId,
        name: data.name,
        category: data.category,
        dailyRate: data.dailyRate,
      });

      return { success: true, equipment };
    } catch (error) {
      logger.error('Error adding equipment', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add equipment',
      };
    }
  }

  /**
   * Get equipment catalog with filters
   */
  async getCatalog(options: {
    category?: EquipmentCategory;
    providerId?: string;
    status?: RentalStatus;
    minPrice?: number;
    maxPrice?: number;
    availableFrom?: Date;
    availableTo?: Date;
    searchQuery?: string;
    page?: number;
    limit?: number;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
  } = {}): Promise<{ equipment: Equipment[]; total: number }> {
    const query: any = { status: { $in: ['available', 'rented'] } };

    if (options.category) {
      query.category = options.category;
    }

    if (options.providerId) {
      query.providerId = new Types.ObjectId(options.providerId);
    }

    if (options.status) {
      query.status = options.status;
    }

    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      query.dailyRate = {};
      if (options.minPrice !== undefined) query.dailyRate.$gte = options.minPrice;
      if (options.maxPrice !== undefined) query.dailyRate.$lte = options.maxPrice;
    }

    if (options.searchQuery) {
      query.$or = [
        { name: { $regex: options.searchQuery, $options: 'i' } },
        { description: { $regex: options.searchQuery, $options: 'i' } },
        { manufacturer: { $regex: options.searchQuery, $options: 'i' } },
        { model: { $regex: options.searchQuery, $options: 'i' } },
      ];
    }

    if (options.latitude !== undefined && options.longitude !== undefined) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [options.longitude, options.latitude],
          },
          $maxDistance: (options.radiusKm || 10) * 1000,
        },
      };
    }

    // Check availability if dates provided
    if (options.availableFrom && options.availableTo) {
      query.$and = [
        {
          $or: [
            { 'availabilityCalendar.date': { $exists: false } },
            {
              'availabilityCalendar': {
                $not: {
                  $elemMatch: {
                    date: {
                      $gte: options.availableFrom,
                      $lte: options.availableTo,
                    },
                    status: 'booked',
                  },
                },
              },
            },
          ],
        },
      ];
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [equipment, total] = await Promise.all([
      this.equipmentModel.find(query)
        .populate('providerId', 'firstName lastName businessName')
        .sort({ dailyRate: 1, name: 1 })
        .skip(skip)
        .limit(limit),
      this.equipmentModel.countDocuments(query),
    ]);

    return { equipment, total };
  }

  /**
   * Get single equipment by ID
   */
  async getEquipmentById(equipmentId: string): Promise<Equipment | null> {
    return this.equipmentModel.findOne({ equipmentId })
      .populate('providerId', 'firstName lastName businessName phone email');
  }

  /**
   * Check equipment availability
   */
  async checkAvailability(
    equipmentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ available: boolean; conflictingBookings?: string[] }> {
    const conflictingRentals = await this.rentalModel.find({
      equipmentId: new Types.ObjectId(equipmentId),
      status: { $in: ['pending', 'confirmed', 'active'] },
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
      ],
    });

    return {
      available: conflictingRentals.length === 0,
      conflictingBookings: conflictingRentals.map((r: { rentalNumber: string }) => r.rentalNumber),
    };
  }

  // ============================================
  // Rental Pricing
  // ============================================

  /**
   * Calculate rental pricing
   */
  calculateRentalPrice(data: {
    equipment: Equipment;
    startDate: Date;
    endDate: Date;
    includeDeposit?: boolean;
    includeTaxes?: boolean;
  }): {
    rentalDays: number;
    subtotal: number;
    weeklyDiscount: number;
    monthlyDiscount: number;
    depositAmount: number;
    depositRefundable: boolean;
    taxes: number;
    totalAmount: number;
    currency: string;
    breakdown: Array<{ description: string; amount: number }>;
  } {
    const { equipment, startDate, endDate, includeDeposit = true, includeTaxes = true } = data;

    // Calculate rental days
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const rentalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    // Calculate base rental cost
    let subtotal = 0;
    let weeklyDiscount = 0;
    let monthlyDiscount = 0;

    if (rentalDays >= 30 && equipment.monthlyRate) {
      // Use monthly rate
      const months = Math.floor(rentalDays / 30);
      const remainingDays = rentalDays % 30;
      subtotal = (months * equipment.monthlyRate) + (remainingDays * equipment.dailyRate);
      monthlyDiscount = subtotal * 0.15; // 15% monthly discount
    } else if (rentalDays >= 7 && equipment.weeklyRate) {
      // Use weekly rate
      const weeks = Math.floor(rentalDays / 7);
      const remainingDays = rentalDays % 7;
      subtotal = (weeks * equipment.weeklyRate) + (remainingDays * equipment.dailyRate);
      weeklyDiscount = subtotal * 0.08; // 8% weekly discount
    } else {
      subtotal = rentalDays * equipment.dailyRate;
    }

    // Apply discount
    subtotal = subtotal - weeklyDiscount - monthlyDiscount;

    // Calculate deposit
    const depositAmount = includeDeposit ? equipment.depositAmount : 0;

    // Calculate taxes (5% VAT)
    const taxRate = 0.05;
    const taxes = includeTaxes ? subtotal * taxRate : 0;

    // Calculate total
    const totalAmount = subtotal + (includeDeposit ? depositAmount : 0) + taxes;

    // Build breakdown
    const breakdown: Array<{ description: string; amount: number }> = [
      { description: `${rentalDays} day${rentalDays > 1 ? 's' : ''} @ ${new Intl.NumberFormat('en-AE', { style: 'currency', currency: equipment.dailyRate.toString() }).format(equipment.dailyRate)}/day`, amount: rentalDays * equipment.dailyRate },
    ];

    if (weeklyDiscount > 0) {
      breakdown.push({ description: 'Weekly discount (8%)', amount: -weeklyDiscount });
    }

    if (monthlyDiscount > 0) {
      breakdown.push({ description: 'Monthly discount (15%)', amount: -monthlyDiscount });
    }

    breakdown.push({ description: 'Subtotal', amount: subtotal });

    if (includeTaxes) {
      breakdown.push({ description: 'VAT (5%)', amount: taxes });
    }

    if (includeDeposit) {
      breakdown.push({
        description: `Security deposit ${equipment.depositRefundable ? '(refundable)' : '(non-refundable)'}`,
        amount: depositAmount,
      });
    }

    return {
      rentalDays,
      subtotal,
      weeklyDiscount,
      monthlyDiscount,
      depositAmount,
      depositRefundable: equipment.depositRefundable,
      taxes,
      totalAmount,
      currency: 'AED',
      breakdown,
    };
  }

  // ============================================
  // Rental Booking
  // ============================================

  /**
   * Create rental booking
   */
  async createRental(data: {
    equipmentId: string;
    customerId: string;
    customerName: string;
    startDate: Date;
    endDate: Date;
    providerId?: string;
    bookingId?: string;
    pickupLocation?: string;
    notes?: string;
  }): Promise<{ success: boolean; rental?: RentalBooking; error?: string }> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const equipment = await this.equipmentModel.findById(data.equipmentId).session(session);
      if (!equipment) {
        await session.abortTransaction();
        return { success: false, error: 'Equipment not found' };
      }

      // Check availability
      const availability = await this.checkAvailability(data.equipmentId, data.startDate, data.endDate);
      if (!availability.available) {
        await session.abortTransaction();
        return { success: false, error: 'Equipment not available for selected dates' };
      }

      // Calculate pricing
      const pricing = this.calculateRentalPrice({
        equipment,
        startDate: data.startDate,
        endDate: data.endDate,
      });

      // Check rental day limits
      if (pricing.rentalDays < equipment.minRentalDays) {
        await session.abortTransaction();
        return { success: false, error: `Minimum rental is ${equipment.minRentalDays} day(s)` };
      }

      if (pricing.rentalDays > equipment.maxRentalDays) {
        await session.abortTransaction();
        return { success: false, error: `Maximum rental is ${equipment.maxRentalDays} day(s)` };
      }

      const rentalId = this.generateRentalId();
      const rentalNumber = `RN-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const rental = new this.rentalModel({
        rentalId,
        rentalNumber,
        equipmentId: equipment._id,
        equipmentName: equipment.name,
        customerId: new Types.ObjectId(data.customerId),
        customerName: data.customerName,
        bookingId: data.bookingId ? new Types.ObjectId(data.bookingId) : undefined,
        providerId: data.providerId ? new Types.ObjectId(data.providerId) : undefined,
        startDate: data.startDate,
        endDate: data.endDate,
        rentalDays: pricing.rentalDays,
        dailyRate: equipment.dailyRate,
        subtotal: pricing.subtotal,
        depositAmount: pricing.depositAmount,
        depositStatus: 'pending',
        depositRefundAmount: 0,
        taxes: pricing.taxes,
        totalAmount: pricing.totalAmount,
        currency: 'AED',
        status: 'pending',
        pickupLocation: data.pickupLocation || equipment.location?.address,
        notes: data.notes,
      });

      await rental.save({ session });

      // Update equipment status
      equipment.status = 'reserved';
      equipment.availabilityCalendar.push({
        date: data.startDate,
        status: 'booked',
      });
      await equipment.save({ session });

      await session.commitTransaction();

      logger.info('Rental booking created', {
        rentalId,
        rentalNumber,
        equipmentId: equipment.equipmentId,
        customerId: data.customerId,
        rentalDays: pricing.rentalDays,
        totalAmount: pricing.totalAmount,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.EQUIPMENT_RENTAL_CREATED, {
        rentalId,
        rentalNumber,
        equipmentId: equipment.equipmentId,
        customerId: data.customerId,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        totalAmount: pricing.totalAmount,
      });

      return { success: true, rental };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error creating rental booking', {
        equipmentId: data.equipmentId,
        customerId: data.customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create rental booking',
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Confirm rental
   */
  async confirmRental(rentalId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const rental = await this.rentalModel.findOne({ rentalId });
      if (!rental) {
        return { success: false, error: 'Rental not found' };
      }

      if (rental.status !== 'pending') {
        return { success: false, error: 'Rental is not in pending status' };
      }

      rental.status = 'confirmed';
      rental.depositStatus = 'held';
      await rental.save();

      // Update equipment status
      await this.equipmentModel.updateOne(
        { _id: rental.equipmentId },
        { $set: { status: 'rented', currentRenter: rental.customerId } }
      );

      logger.info('Rental confirmed', { rentalId });
      return { success: true };
    } catch (error) {
      logger.error('Error confirming rental', {
        rentalId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm rental',
      };
    }
  }

  /**
   * Complete rental and process deposit return
   */
  async completeRental(
    rentalId: string,
    damageAssessment?: {
      damageFound: boolean;
      damageDescription?: string;
      repairCost?: number;
    }
  ): Promise<{ success: boolean; depositRefund: number; error?: string }> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const rental = await this.rentalModel.findOne({ rentalId }).session(session);
      if (!rental) {
        await session.abortTransaction();
        return { success: false, depositRefund: 0, error: 'Rental not found' };
      }

      if (!['pending', 'confirmed', 'active'].includes(rental.status)) {
        await session.abortTransaction();
        return { success: false, depositRefund: 0, error: 'Rental cannot be completed' };
      }

      let depositRefund = rental.depositAmount;

      // Process damage if any
      if (damageAssessment?.damageFound) {
        rental.status = 'damaged';
        rental.damageReport = {
          reportId: this.generateAssessmentId(),
          severity: 'moderate',
          description: damageAssessment.damageDescription || 'Damage reported',
          repairCost: damageAssessment.repairCost || 0,
          depositDeducted: Math.min(damageAssessment.repairCost || 0, rental.depositAmount),
          resolvedAt: new Date(),
        };
        depositRefund = Math.max(0, rental.depositAmount - (damageAssessment.repairCost || 0));
        rental.depositStatus = 'forfeited';
      } else {
        rental.status = 'completed';
        rental.depositStatus = 'refunded';
      }

      rental.depositRefundAmount = depositRefund;
      rental.returnTime = new Date().toISOString().split('T')[1].slice(0, 5);
      await rental.save({ session });

      // Update equipment status and condition
      const updateData: any = {
        status: 'available',
        currentRenter: null,
      };

      if (damageAssessment?.damageFound) {
        updateData.condition = 'needs_repair';
      }

      await this.equipmentModel.updateOne(
        { _id: rental.equipmentId },
        { $set: updateData }
      );

      await session.commitTransaction();

      logger.info('Rental completed', {
        rentalId,
        status: rental.status,
        depositRefund,
      });

      return { success: true, depositRefund };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error completing rental', {
        rentalId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        depositRefund: 0,
        error: error instanceof Error ? error.message : 'Failed to complete rental',
      };
    } finally {
      session.endSession();
    }
  }

  // ============================================
  // Damage Assessment
  // ============================================

  /**
   * Submit damage assessment
   */
  async submitDamageAssessment(data: {
    rentalId: string;
    equipmentId: string;
    assessorId: string;
    customerId: string;
    assessmentType: 'pickup' | 'return' | 'mid_rental' | 'incident';
    preAssessment?: {
      photos: string[];
      notes: string;
      condition: EquipmentCondition;
    };
    postAssessment?: {
      photos: string[];
      notes: string;
      condition: EquipmentCondition;
    };
    damageDetails?: Array<{
      component: string;
      description: string;
      severity: DamageSeverity;
      estimatedRepairCost: number;
      photos: string[];
    }>;
    depositAmount: number;
  }): Promise<{ success: boolean; assessment?: DamageAssessment; error?: string }> {
    try {
      const assessmentId = this.generateAssessmentId();
      const damageFound = (data.damageDetails?.length || 0) > 0;
      const totalEstimatedCost = data.damageDetails?.reduce((sum, d) => sum + d.estimatedRepairCost, 0) || 0;
      const depositDeduction = Math.min(totalEstimatedCost, data.depositAmount);

      const assessment = new this.assessmentModel({
        assessmentId,
        rentalId: new Types.ObjectId(data.rentalId),
        equipmentId: new Types.ObjectId(data.equipmentId),
        assessorId: new Types.ObjectId(data.assessorId),
        customerId: new Types.ObjectId(data.customerId),
        assessmentType: data.assessmentType,
        preAssessment: data.preAssessment ? {
          ...data.preAssessment,
          assessedAt: new Date(),
        } : undefined,
        postAssessment: data.postAssessment ? {
          ...data.postAssessment,
          assessedAt: new Date(),
        } : undefined,
        damageFound,
        damageDetails: data.damageDetails,
        totalEstimatedCost,
        depositAmount: data.depositAmount,
        depositDeduction,
      });

      await assessment.save();

      logger.info('Damage assessment submitted', {
        assessmentId,
        rentalId: data.rentalId,
        damageFound,
        totalEstimatedCost,
      });

      return { success: true, assessment };
    } catch (error) {
      logger.error('Error submitting damage assessment', {
        rentalId: data.rentalId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit assessment',
      };
    }
  }

  // ============================================
  // Analytics
  // ============================================

  /**
   * Get rental analytics
   */
  async getAnalytics(options: {
    startDate?: Date;
    endDate?: Date;
    category?: EquipmentCategory;
    providerId?: string;
  } = {}): Promise<{
    totalRentals: number;
    activeRentals: number;
    completedRentals: number;
    totalRevenue: number;
    totalDepositsHeld: number;
    totalDepositsRefunded: number;
    totalDepositsForfeited: number;
    averageRentalDuration: number;
    topEquipment: Array<{ equipmentId: string; name: string; rentalCount: number; revenue: number }>;
    damageReportCount: number;
    damageReportCost: number;
  }> {
    const matchQuery: any = {};
    if (options.startDate || options.endDate) {
      matchQuery.createdAt = {};
      if (options.startDate) matchQuery.createdAt.$gte = options.startDate;
      if (options.endDate) matchQuery.createdAt.$lte = options.endDate;
    }

    const rentals = await this.rentalModel.find(matchQuery);

    let totalDepositsHeld = 0;
    let totalDepositsRefunded = 0;
    let totalDepositsForfeited = 0;
    let damageReportCost = 0;
    const equipmentMap = new Map<string, { name: string; count: number; revenue: number }>();

    for (const rental of rentals) {
      if (rental.depositStatus === 'held') totalDepositsHeld += rental.depositAmount;
      if (rental.depositStatus === 'refunded') totalDepositsRefunded += rental.depositRefundAmount;
      if (rental.depositStatus === 'forfeited') totalDepositsForfeited += rental.depositAmount;

      if (rental.damageReport) {
        damageReportCost += rental.damageReport.depositDeducted || 0;
      }

      const eqId = rental.equipmentId.toString();
      const existing = equipmentMap.get(eqId) || { name: rental.equipmentName, count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += rental.subtotal;
      equipmentMap.set(eqId, existing);
    }

    const topEquipment = Array.from(equipmentMap.entries())
      .map(([equipmentId, data]) => ({
        equipmentId,
        name: data.name,
        rentalCount: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalRentals: rentals.length,
      activeRentals: rentals.filter((r: { status: string }) => ['pending', 'confirmed', 'active'].includes(r.status)).length,
      completedRentals: rentals.filter((r: { status: string }) => r.status === 'completed').length,
      totalRevenue: rentals.reduce((sum: number, r: { subtotal: number }) => sum + r.subtotal, 0),
      totalDepositsHeld,
      totalDepositsRefunded,
      totalDepositsForfeited,
      averageRentalDuration: rentals.length > 0
        ? rentals.reduce((sum: number, r: { rentalDays: number }) => sum + r.rentalDays, 0) / rentals.length
        : 0,
      topEquipment,
      damageReportCount: rentals.filter((r: { status: string }) => r.status === 'damaged').length,
      damageReportCost,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generateEquipmentId(): string {
    return `EQ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  private generateRentalId(): string {
    return `RNT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  private generateAssessmentId(): string {
    return `Dmg-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const equipmentRentalService = new EquipmentRentalService();
export default equipmentRentalService;
