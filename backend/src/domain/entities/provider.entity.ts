/**
 * Provider Entity
 *
 * Core domain entity representing a service provider in the NILIN marketplace.
 * Encapsulates provider-related business logic and profile management.
 *
 * @module domain/entities/provider.entity
 */

import { Types } from 'mongoose';

/**
 * Verification status enumeration
 */
export enum VerificationStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Working hours for a day value object
 */
export interface WorkingHoursDay {
  enabled: boolean;
  slots: Array<{ start: string; end: string }>;
}

/**
 * Service area configuration
 */
export interface ServiceArea {
  type: 'radius' | 'zone';
  radius?: number; // in kilometers
  zones?: string[];
}

/**
 * Provider entity class
 */
export class Provider {
  private readonly _id: Types.ObjectId;
  private readonly _userId: Types.ObjectId;
  private _businessName: string;
  private _displayName?: string;
  private _description?: string;
  private _categories: Types.ObjectId[];
  private _services: Types.ObjectId[];
  private _location: {
    type: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: { type: 'Point'; coordinates: [number, number] };
  };
  private _workingHours: { [day: string]: WorkingHoursDay };
  private _serviceArea?: ServiceArea;
  private _isMobile: boolean;
  private _isVerified: boolean;
  private _verificationStatus: VerificationStatus;
  private _verificationDocuments?: Array<{
    type: string;
    documentUrl: string;
    documentNumber?: string;
    expiryDate?: Date;
    verifiedAt?: Date;
  }>;
  private _averageRating: number;
  private _totalReviews: number;
  private _totalBookings: number;
  private _responseRate: number;
  private _responseTime: number; // in minutes
  private _images: string[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(params: {
    id?: Types.ObjectId;
    userId: Types.ObjectId;
    businessName: string;
    displayName?: string;
    description?: string;
    categories: Types.ObjectId[];
    services?: Types.ObjectId[];
    location: Provider['_location'];
    workingHours?: { [day: string]: WorkingHoursDay };
    serviceArea?: ServiceArea;
    isMobile?: boolean;
    isVerified?: boolean;
    verificationStatus?: VerificationStatus;
    verificationDocuments?: Provider['_verificationDocuments'];
    averageRating?: number;
    totalReviews?: number;
    totalBookings?: number;
    responseRate?: number;
    responseTime?: number;
    images?: string[];
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this._id = params.id || new Types.ObjectId();
    this._userId = params.userId;
    this._businessName = params.businessName;
    this._displayName = params.displayName;
    this._description = params.description;
    this._categories = params.categories;
    this._services = params.services || [];
    this._location = params.location;
    this._workingHours = params.workingHours || this.getDefaultWorkingHours();
    this._serviceArea = params.serviceArea;
    this._isMobile = params.isMobile || false;
    this._isVerified = params.isVerified || false;
    this._verificationStatus = params.verificationStatus || VerificationStatus.PENDING;
    this._verificationDocuments = params.verificationDocuments;
    this._averageRating = params.averageRating || 0;
    this._totalReviews = params.totalReviews || 0;
    this._totalBookings = params.totalBookings || 0;
    this._responseRate = params.responseRate || 100;
    this._responseTime = params.responseTime || 0;
    this._images = params.images || [];
    this._createdAt = params.createdAt || new Date();
    this._updatedAt = params.updatedAt || new Date();
  }

  // Getters
  get id(): Types.ObjectId {
    return this._id;
  }

  get userId(): Types.ObjectId {
    return this._userId;
  }

  get businessName(): string {
    return this._businessName;
  }

  get displayName(): string {
    return this._displayName || this._businessName;
  }

  get description(): string | undefined {
    return this._description;
  }

  get categories(): Types.ObjectId[] {
    return [...this._categories];
  }

  get services(): Types.ObjectId[] {
    return [...this._services];
  }

  get location(): Provider['_location'] {
    return { ...this._location };
  }

  get workingHours(): { [day: string]: WorkingHoursDay } {
    return { ...this._workingHours };
  }

  get serviceArea(): ServiceArea | undefined {
    return this._serviceArea ? { ...this._serviceArea } : undefined;
  }

  get isMobile(): boolean {
    return this._isMobile;
  }

  get isVerified(): boolean {
    return this._isVerified;
  }

  get verificationStatus(): VerificationStatus {
    return this._verificationStatus;
  }

  get verificationDocuments(): Provider['_verificationDocuments'] {
    return this._verificationDocuments ? [...this._verificationDocuments] : undefined;
  }

  get averageRating(): number {
    return this._averageRating;
  }

  get totalReviews(): number {
    return this._totalReviews;
  }

  get totalBookings(): number {
    return this._totalBookings;
  }

  get responseRate(): number {
    return this._responseRate;
  }

  get responseTime(): number {
    return this._responseTime;
  }

  get images(): string[] {
    return [...this._images];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Computed properties
  get isAvailable(): boolean {
    return this._verificationStatus === VerificationStatus.APPROVED;
  }

  get locationString(): string {
    return `${this._location.city}, ${this._location.state}, ${this._location.country}`;
  }

  // Business methods

  /**
   * Update profile information
   */
  updateProfile(data: {
    businessName?: string;
    displayName?: string;
    description?: string;
    isMobile?: boolean;
    images?: string[];
  }): void {
    if (data.businessName) this._businessName = data.businessName;
    if (data.displayName !== undefined) this._displayName = data.displayName;
    if (data.description !== undefined) this._description = data.description;
    if (data.isMobile !== undefined) this._isMobile = data.isMobile;
    if (data.images) this._images = data.images;
    this._updatedAt = new Date();
  }

  /**
   * Update location
   */
  updateLocation(location: Provider['_location']): void {
    this._location = location;
    this._updatedAt = new Date();
  }

  /**
   * Update working hours
   */
  updateWorkingHours(workingHours: { [day: string]: WorkingHoursDay }): void {
    this._workingHours = workingHours;
    this._updatedAt = new Date();
  }

  /**
   * Update service area
   */
  updateServiceArea(serviceArea: ServiceArea): void {
    this._serviceArea = serviceArea;
    this._updatedAt = new Date();
  }

  /**
   * Add a service
   */
  addService(serviceId: Types.ObjectId): void {
    if (!this._services.some((s) => s.equals(serviceId))) {
      this._services.push(serviceId);
      this._updatedAt = new Date();
    }
  }

  /**
   * Remove a service
   */
  removeService(serviceId: Types.ObjectId): void {
    this._services = this._services.filter((s) => !s.equals(serviceId));
    this._updatedAt = new Date();
  }

  /**
   * Submit verification documents
   */
  submitDocuments(documents: Provider['_verificationDocuments']): void {
    this._verificationDocuments = documents;
    this._verificationStatus = VerificationStatus.IN_REVIEW;
    this._updatedAt = new Date();
  }

  /**
   * Approve verification
   */
  approve(): void {
    this._verificationStatus = VerificationStatus.APPROVED;
    this._isVerified = true;
    this._updatedAt = new Date();
  }

  /**
   * Reject verification
   */
  reject(): void {
    this._verificationStatus = VerificationStatus.REJECTED;
    this._isVerified = false;
    this._updatedAt = new Date();
  }

  /**
   * Update rating statistics
   */
  updateRating(newRating: number): void {
    // Weighted average calculation
    const totalRatingPoints = this._averageRating * this._totalReviews + newRating;
    this._totalReviews += 1;
    this._averageRating = totalRatingPoints / this._totalReviews;
    this._updatedAt = new Date();
  }

  /**
   * Increment booking count
   */
  incrementBookingCount(): void {
    this._totalBookings += 1;
    this._updatedAt = new Date();
  }

  /**
   * Update response metrics
   */
  updateResponseMetrics(responseRate: number, responseTime: number): void {
    this._responseRate = responseRate;
    this._responseTime = responseTime;
    this._updatedAt = new Date();
  }

  /**
   * Check if provider works on a given day
   */
  worksOnDay(dayOfWeek: number): boolean {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    return this._workingHours[dayName]?.enabled || false;
  }

  /**
   * Get working hours for a day
   */
  getWorkingHoursForDay(dayOfWeek: number): WorkingHoursDay | null {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return this._workingHours[dayNames[dayOfWeek]] || null;
  }

  /**
   * Check if coordinates are within service area
   */
  isWithinServiceArea(lat: number, lng: number): boolean {
    if (!this._location.coordinates) return true; // No specific location set
    if (!this._serviceArea || this._serviceArea.type !== 'radius') return true;

    const distance = this.calculateDistance(
      this._location.coordinates.coordinates[1],
      this._location.coordinates.coordinates[0],
      lat,
      lng
    );

    return distance <= (this._serviceArea.radius || 10);
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Get default working hours
   */
  private getDefaultWorkingHours(): { [day: string]: WorkingHoursDay } {
    return {
      monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
      tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
      wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
      thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
      friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
      saturday: { enabled: false, slots: [] },
      sunday: { enabled: false, slots: [] },
    };
  }

  /**
   * Convert to plain object
   */
  toJSON(): Record<string, unknown> {
    return {
      _id: this._id,
      userId: this._userId,
      businessName: this._businessName,
      displayName: this._displayName,
      description: this._description,
      categories: this._categories,
      services: this._services,
      location: this._location,
      workingHours: this._workingHours,
      serviceArea: this._serviceArea,
      isMobile: this._isMobile,
      isVerified: this._isVerified,
      verificationStatus: this._verificationStatus,
      verificationDocuments: this._verificationDocuments,
      averageRating: this._averageRating,
      totalReviews: this._totalReviews,
      totalBookings: this._totalBookings,
      responseRate: this._responseRate,
      responseTime: this._responseTime,
      images: this._images,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
