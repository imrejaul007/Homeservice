/**
 * Service Entity
 *
 * Core domain entity representing a service (product) in the NILIN marketplace.
 * Encapsulates service-related business logic and pricing management.
 *
 * @module domain/entities/service.entity
 */

import { Types } from 'mongoose';

/**
 * Duration option for variable pricing
 */
export interface DurationOption {
  duration: number; // in minutes
  price: number;
  label?: string;
}

/**
 * Add-on option
 */
export interface AddOn {
  name: string;
  price: number;
  description?: string;
}

/**
 * Service entity class
 */
export class Service {
  private readonly _id: Types.ObjectId;
  private _name: string;
  private _description: string;
  private readonly _providerId: Types.ObjectId;
  private _categoryId: Types.ObjectId;
  private _subcategoryId?: Types.ObjectId;
  private _basePrice: number;
  private _duration: number;
  private _durationOptions?: DurationOption[];
  private _addOns?: AddOn[];
  private _images: string[];
  private _isActive: boolean;
  private _isFeatured: boolean;
  private _averageRating: number;
  private _totalReviews: number;
  private _totalBookings: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(params: {
    id?: Types.ObjectId;
    name: string;
    description: string;
    providerId: Types.ObjectId;
    categoryId: Types.ObjectId;
    subcategoryId?: Types.ObjectId;
    basePrice: number;
    duration: number;
    durationOptions?: DurationOption[];
    addOns?: AddOn[];
    images?: string[];
    isActive?: boolean;
    isFeatured?: boolean;
    averageRating?: number;
    totalReviews?: number;
    totalBookings?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this._id = params.id || new Types.ObjectId();
    this._name = params.name;
    this._description = params.description;
    this._providerId = params.providerId;
    this._categoryId = params.categoryId;
    this._subcategoryId = params.subcategoryId;
    this._basePrice = params.basePrice;
    this._duration = params.duration;
    this._durationOptions = params.durationOptions;
    this._addOns = params.addOns;
    this._images = params.images || [];
    this._isActive = params.isActive !== undefined ? params.isActive : true;
    this._isFeatured = params.isFeatured || false;
    this._averageRating = params.averageRating || 0;
    this._totalReviews = params.totalReviews || 0;
    this._totalBookings = params.totalBookings || 0;
    this._createdAt = params.createdAt || new Date();
    this._updatedAt = params.updatedAt || new Date();
  }

  // Getters
  get id(): Types.ObjectId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get providerId(): Types.ObjectId {
    return this._providerId;
  }

  get categoryId(): Types.ObjectId {
    return this._categoryId;
  }

  get subcategoryId(): Types.ObjectId | undefined {
    return this._subcategoryId;
  }

  get basePrice(): number {
    return this._basePrice;
  }

  get duration(): number {
    return this._duration;
  }

  get durationOptions(): DurationOption[] | undefined {
    return this._durationOptions ? [...this._durationOptions] : undefined;
  }

  get addOns(): AddOn[] | undefined {
    return this._addOns ? [...this._addOns] : undefined;
  }

  get images(): string[] {
    return [...this._images];
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isFeatured(): boolean {
    return this._isFeatured;
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

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Computed properties

  /**
   * Get the minimum price considering duration options
   */
  get minPrice(): number {
    if (!this._durationOptions || this._durationOptions.length === 0) {
      return this._basePrice;
    }
    return Math.min(this._basePrice, ...this._durationOptions.map((o) => o.price));
  }

  /**
   * Get the maximum price considering duration options and add-ons
   */
  get maxPrice(): number {
    let maxPrice = this._durationOptions?.length
      ? Math.max(...this._durationOptions.map((o) => o.price))
      : this._basePrice;

    if (this._addOns?.length) {
      maxPrice += this._addOns.reduce((sum, addon) => sum + addon.price, 0);
    }

    return maxPrice;
  }

  /**
   * Get primary image or placeholder
   */
  get primaryImage(): string {
    return this._images[0] || '/images/service-placeholder.jpg';
  }

  // Business methods

  /**
   * Update service details
   */
  update(data: {
    name?: string;
    description?: string;
    basePrice?: number;
    duration?: number;
    durationOptions?: DurationOption[];
    addOns?: AddOn[];
    images?: string[];
  }): void {
    if (data.name) this._name = data.name;
    if (data.description !== undefined) this._description = data.description;
    if (data.basePrice !== undefined) this._basePrice = data.basePrice;
    if (data.duration !== undefined) this._duration = data.duration;
    if (data.durationOptions !== undefined) this._durationOptions = data.durationOptions;
    if (data.addOns !== undefined) this._addOns = data.addOns;
    if (data.images !== undefined) this._images = data.images;
    this._updatedAt = new Date();
  }

  /**
   * Update category
   */
  updateCategory(categoryId: Types.ObjectId, subcategoryId?: Types.ObjectId): void {
    this._categoryId = categoryId;
    this._subcategoryId = subcategoryId;
    this._updatedAt = new Date();
  }

  /**
   * Activate service
   */
  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  /**
   * Deactivate service
   */
  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /**
   * Set featured status
   */
  setFeatured(isFeatured: boolean): void {
    this._isFeatured = isFeatured;
    this._updatedAt = new Date();
  }

  /**
   * Add an image
   */
  addImage(imageUrl: string): void {
    if (!this._images.includes(imageUrl)) {
      this._images.push(imageUrl);
      this._updatedAt = new Date();
    }
  }

  /**
   * Remove an image
   */
  removeImage(imageUrl: string): void {
    this._images = this._images.filter((img) => img !== imageUrl);
    this._updatedAt = new Date();
  }

  /**
   * Add an add-on
   */
  addAddOn(addOn: AddOn): void {
    if (!this._addOns) {
      this._addOns = [];
    }
    if (!this._addOns.some((a) => a.name === addOn.name)) {
      this._addOns.push(addOn);
      this._updatedAt = new Date();
    }
  }

  /**
   * Remove an add-on
   */
  removeAddOn(addOnName: string): void {
    if (this._addOns) {
      this._addOns = this._addOns.filter((a) => a.name !== addOnName);
      this._updatedAt = new Date();
    }
  }

  /**
   * Update rating statistics
   */
  updateRating(newRating: number): void {
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
   * Calculate price for selected options
   */
  calculatePrice(selectedDuration: number, selectedAddOns: string[]): number {
    let price = this._basePrice;

    // Check duration options
    if (this._durationOptions?.length) {
      const durationOption = this._durationOptions.find((o) => o.duration === selectedDuration);
      if (durationOption) {
        price = durationOption.price;
      }
    }

    // Add add-on prices
    if (this._addOns?.length && selectedAddOns.length) {
      for (const addonName of selectedAddOns) {
        const addon = this._addOns.find((a) => a.name === addonName);
        if (addon) {
          price += addon.price;
        }
      }
    }

    return price;
  }

  /**
   * Check if service has duration options
   */
  hasDurationOptions(): boolean {
    return (this._durationOptions?.length || 0) > 0;
  }

  /**
   * Check if service has add-ons
   */
  hasAddOns(): boolean {
    return (this._addOns?.length || 0) > 0;
  }

  /**
   * Convert to plain object
   */
  toJSON(): Record<string, unknown> {
    return {
      _id: this._id,
      name: this._name,
      description: this._description,
      providerId: this._providerId,
      categoryId: this._categoryId,
      subcategoryId: this._subcategoryId,
      basePrice: this._basePrice,
      duration: this._duration,
      durationOptions: this._durationOptions,
      addOns: this._addOns,
      images: this._images,
      isActive: this._isActive,
      isFeatured: this._isFeatured,
      averageRating: this._averageRating,
      totalReviews: this._totalReviews,
      totalBookings: this._totalBookings,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
