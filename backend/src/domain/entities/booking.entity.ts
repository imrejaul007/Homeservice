/**
 * Booking Entity
 *
 * Core domain entity representing a booking in the NILIN marketplace.
 * Encapsulates booking-related business logic and state management.
 *
 * @module domain/entities/booking.entity
 */

import { Types } from 'mongoose';

/**
 * Booking status enumeration
 */
export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

/**
 * Location type enumeration
 */
export enum LocationType {
  AT_HOME = 'at_home',
  HOTEL = 'hotel',
}

/**
 * Professional preference enumeration
 */
export enum ProfessionalPreference {
  MALE = 'male',
  FEMALE = 'female',
  NO_PREFERENCE = 'no_preference',
}

/**
 * Payment method enumeration
 */
export enum PaymentMethod {
  APPLE_PAY = 'apple_pay',
  CREDIT_CARD = 'credit_card',
  CASH = 'cash',
}

/**
 * Status update actor enumeration
 */
export enum StatusUpdateActor {
  CUSTOMER = 'customer',
  PROVIDER = 'provider',
  SYSTEM = 'system',
  ADMIN = 'admin',
}

/**
 * Status history entry value object
 */
export interface StatusHistoryEntry {
  status: BookingStatus;
  timestamp: Date;
  reason?: string;
  updatedBy: StatusUpdateActor;
  notes?: string;
}

/**
 * Booking pricing value object
 */
export interface BookingPricing {
  basePrice: number;
  addOns: Array<{ name: string; price: number }>;
  discounts: Array<{ type: string; amount: number; description: string }>;
  subtotal: number;
  tax: number;
  totalAmount: number;
  currency: string;
}

/**
 * Booking location type
 */
export interface BookingLocation {
  type: 'customer_address' | 'provider_location' | 'online';
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: { type: 'Point'; coordinates: [number, number] };
  };
  notes?: string;
}

/**
 * Booking entity class
 */
export class Booking {
  private readonly _id: Types.ObjectId;
  private readonly _bookingNumber: string;
  private _customerId?: Types.ObjectId;
  private readonly _providerId: Types.ObjectId;
  private readonly _serviceId: Types.ObjectId;
  private _isGuestBooking: boolean;
  private _guestInfo?: { name: string; email: string; phone: string };
  private _scheduledDate: Date;
  private _scheduledTime: string;
  private _duration: number;
  private _estimatedEndTime: Date;
  private _locationType: LocationType;
  private _selectedDuration: number;
  private _professionalPreference: ProfessionalPreference;
  private _paymentMethod: PaymentMethod;
  private _location: BookingLocation;
  private _status: BookingStatus;
  private _statusHistory: StatusHistoryEntry[];
  private _pricing: BookingPricing;
  private _providerResponse?: {
    acceptedAt?: Date;
    rejectedAt?: Date;
    rejectionReason?: string;
    estimatedArrival?: Date;
    arrivalTime?: Date;
    completedAt?: Date;
    notes?: string;
  };
  private _cancellation?: {
    cancelledAt: Date;
    cancelledBy: StatusUpdateActor;
    reason: string;
    refundStatus: 'pending' | 'processed' | 'not_applicable';
    refundAmount?: number;
  };
  private _isReviewed: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(params: {
    id?: Types.ObjectId;
    bookingNumber: string;
    customerId?: Types.ObjectId;
    providerId: Types.ObjectId;
    serviceId: Types.ObjectId;
    isGuestBooking?: boolean;
    guestInfo?: { name: string; email: string; phone: string };
    scheduledDate: Date;
    scheduledTime: string;
    duration: number;
    estimatedEndTime: Date;
    locationType: LocationType;
    selectedDuration: number;
    professionalPreference: ProfessionalPreference;
    paymentMethod: PaymentMethod;
    location: Booking['location'];
    pricing: BookingPricing;
    status?: BookingStatus;
    statusHistory?: StatusHistoryEntry[];
    providerResponse?: Booking['_providerResponse'];
    cancellation?: Booking['_cancellation'];
    isReviewed?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this._id = params.id || new Types.ObjectId();
    this._bookingNumber = params.bookingNumber;
    this._customerId = params.customerId;
    this._providerId = params.providerId;
    this._serviceId = params.serviceId;
    this._isGuestBooking = params.isGuestBooking || false;
    this._guestInfo = params.guestInfo;
    this._scheduledDate = params.scheduledDate;
    this._scheduledTime = params.scheduledTime;
    this._duration = params.duration;
    this._estimatedEndTime = params.estimatedEndTime;
    this._locationType = params.locationType;
    this._selectedDuration = params.selectedDuration;
    this._professionalPreference = params.professionalPreference;
    this._paymentMethod = params.paymentMethod;
    this._location = params.location;
    this._status = params.status || BookingStatus.PENDING;
    this._statusHistory = params.statusHistory || [];
    this._pricing = params.pricing;
    this._providerResponse = params.providerResponse;
    this._cancellation = params.cancellation;
    this._isReviewed = params.isReviewed || false;
    this._createdAt = params.createdAt || new Date();
    this._updatedAt = params.updatedAt || new Date();

    // Add initial status to history
    if (this._statusHistory.length === 0) {
      this._statusHistory.push({
        status: this._status,
        timestamp: this._createdAt,
        updatedBy: StatusUpdateActor.SYSTEM,
        notes: 'Booking created',
      });
    }
  }

  // Getters
  get id(): Types.ObjectId {
    return this._id;
  }

  get bookingNumber(): string {
    return this._bookingNumber;
  }

  get customerId(): Types.ObjectId | undefined {
    return this._customerId;
  }

  get providerId(): Types.ObjectId {
    return this._providerId;
  }

  get serviceId(): Types.ObjectId {
    return this._serviceId;
  }

  get isGuestBooking(): boolean {
    return this._isGuestBooking;
  }

  get guestInfo(): Booking['_guestInfo'] {
    return this._guestInfo ? { ...this._guestInfo } : undefined;
  }

  get scheduledDate(): Date {
    return this._scheduledDate;
  }

  get scheduledTime(): string {
    return this._scheduledTime;
  }

  get duration(): number {
    return this._duration;
  }

  get estimatedEndTime(): Date {
    return this._estimatedEndTime;
  }

  get locationType(): LocationType {
    return this._locationType;
  }

  get professionalPreference(): ProfessionalPreference {
    return this._professionalPreference;
  }

  get paymentMethod(): PaymentMethod {
    return this._paymentMethod;
  }

  get location(): BookingLocation {
    return { ...this._location };
  }

  get status(): BookingStatus {
    return this._status;
  }

  get statusHistory(): StatusHistoryEntry[] {
    return [...this._statusHistory];
  }

  get pricing(): BookingPricing {
    return { ...this._pricing };
  }

  get providerResponse(): Booking['_providerResponse'] {
    return this._providerResponse ? { ...this._providerResponse } : undefined;
  }

  get cancellation(): Booking['_cancellation'] {
    return this._cancellation ? { ...this._cancellation } : undefined;
  }

  get isReviewed(): boolean {
    return this._isReviewed;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Computed properties

  get isPast(): boolean {
    return this._estimatedEndTime < new Date();
  }

  get isFuture(): boolean {
    return this._scheduledDate > new Date();
  }

  get isActive(): boolean {
    return [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    ].includes(this._status);
  }

  get canBeCancelled(): boolean {
    return [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
    ].includes(this._status);
  }

  get canBeModified(): boolean {
    return this._status === BookingStatus.PENDING;
  }

  // Business methods

  /**
   * Confirm the booking
   */
  confirm(actor: StatusUpdateActor, notes?: string): void {
    if (this._status !== BookingStatus.PENDING) {
      throw new Error('Only pending bookings can be confirmed');
    }

    this._status = BookingStatus.CONFIRMED;
    this._statusHistory.push({
      status: BookingStatus.CONFIRMED,
      timestamp: new Date(),
      updatedBy: actor,
      notes,
    });
    this._updatedAt = new Date();
  }

  /**
   * Start the booking (provider arrives)
   */
  start(actor: StatusUpdateActor, notes?: string): void {
    if (this._status !== BookingStatus.CONFIRMED) {
      throw new Error('Only confirmed bookings can be started');
    }

    this._status = BookingStatus.IN_PROGRESS;
    this._providerResponse = {
      ...this._providerResponse,
      arrivalTime: new Date(),
    };
    this._statusHistory.push({
      status: BookingStatus.IN_PROGRESS,
      timestamp: new Date(),
      updatedBy: actor,
      notes,
    });
    this._updatedAt = new Date();
  }

  /**
   * Complete the booking
   */
  complete(actor: StatusUpdateActor, notes?: string): void {
    if (this._status !== BookingStatus.IN_PROGRESS) {
      throw new Error('Only in-progress bookings can be completed');
    }

    this._status = BookingStatus.COMPLETED;
    this._providerResponse = {
      ...this._providerResponse,
      completedAt: new Date(),
      notes,
    };
    this._statusHistory.push({
      status: BookingStatus.COMPLETED,
      timestamp: new Date(),
      updatedBy: actor,
      notes,
    });
    this._updatedAt = new Date();
  }

  /**
   * Cancel the booking
   */
  cancel(
    cancelledBy: StatusUpdateActor,
    reason: string,
    refundStatus: 'pending' | 'processed' | 'not_applicable' = 'pending',
    refundAmount?: number
  ): void {
    if (!this.canBeCancelled) {
      throw new Error('This booking cannot be cancelled');
    }

    this._status = BookingStatus.CANCELLED;
    this._cancellation = {
      cancelledAt: new Date(),
      cancelledBy,
      reason,
      refundStatus,
      refundAmount,
    };
    this._statusHistory.push({
      status: BookingStatus.CANCELLED,
      timestamp: new Date(),
      updatedBy: cancelledBy,
      reason,
    });
    this._updatedAt = new Date();
  }

  /**
   * Mark as no-show
   */
  markNoShow(actor: StatusUpdateActor, reason?: string): void {
    if (this._status !== BookingStatus.CONFIRMED) {
      throw new Error('Only confirmed bookings can be marked as no-show');
    }

    this._status = BookingStatus.NO_SHOW;
    this._statusHistory.push({
      status: BookingStatus.NO_SHOW,
      timestamp: new Date(),
      updatedBy: actor,
      notes: reason,
    });
    this._updatedAt = new Date();
  }

  /**
   * Reject the booking (provider)
   */
  reject(providerId: Types.ObjectId, reason: string): void {
    if (!this._providerId.equals(providerId)) {
      throw new Error('Only the assigned provider can reject');
    }

    if (this._status !== BookingStatus.PENDING) {
      throw new Error('Only pending bookings can be rejected');
    }

    this._providerResponse = {
      ...this._providerResponse,
      rejectedAt: new Date(),
      rejectionReason: reason,
    };
    this._status = BookingStatus.CANCELLED;
    this._statusHistory.push({
      status: BookingStatus.CANCELLED,
      timestamp: new Date(),
      updatedBy: StatusUpdateActor.PROVIDER,
      reason,
      notes: 'Rejected by provider',
    });
    this._updatedAt = new Date();
  }

  /**
   * Accept the booking (provider)
   */
  accept(providerId: Types.ObjectId, estimatedArrival?: Date): void {
    if (!this._providerId.equals(providerId)) {
      throw new Error('Only the assigned provider can accept');
    }

    if (this._status !== BookingStatus.PENDING) {
      throw new Error('Only pending bookings can be accepted');
    }

    this._providerResponse = {
      ...this._providerResponse,
      acceptedAt: new Date(),
      estimatedArrival,
    };
    this._updatedAt = new Date();
  }

  /**
   * Mark as reviewed
   */
  markAsReviewed(): void {
    this._isReviewed = true;
    this._updatedAt = new Date();
  }

  /**
   * Check if booking conflicts with time slot
   */
  conflictsWith(startTime: string, durationMinutes: number): boolean {
    const [bookingHours, bookingMinutes] = this._scheduledTime.split(':').map(Number);
    const bookingStart = new Date(this._scheduledDate);
    bookingStart.setHours(bookingHours, bookingMinutes, 0, 0);

    const bookingEnd = new Date(bookingStart.getTime() + this._duration * 60 * 1000);

    const [slotHours, slotMinutes] = startTime.split(':').map(Number);
    const slotStart = new Date(this._scheduledDate);
    slotStart.setHours(slotHours, slotMinutes, 0, 0);

    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

    return bookingStart < slotEnd && slotStart < bookingEnd;
  }

  /**
   * Convert to plain object for persistence
   */
  toJSON(): Record<string, unknown> {
    return {
      _id: this._id,
      bookingNumber: this._bookingNumber,
      customerId: this._customerId,
      providerId: this._providerId,
      serviceId: this._serviceId,
      isGuestBooking: this._isGuestBooking,
      guestInfo: this._guestInfo,
      scheduledDate: this._scheduledDate,
      scheduledTime: this._scheduledTime,
      duration: this._duration,
      estimatedEndTime: this._estimatedEndTime,
      locationType: this._locationType,
      selectedDuration: this._selectedDuration,
      professionalPreference: this._professionalPreference,
      paymentMethod: this._paymentMethod,
      location: this._location,
      status: this._status,
      statusHistory: this._statusHistory,
      pricing: this._pricing,
      providerResponse: this._providerResponse,
      cancellation: this._cancellation,
      isReviewed: this._isReviewed,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
