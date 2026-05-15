/**
 * User Entity
 *
 * Core domain entity representing a user in the NILIN marketplace.
 * Encapsulates user-related business logic and validation.
 *
 * @module domain/entities/user.entity
 */

import { Types } from 'mongoose';

/**
 * User role enumeration
 */
export enum UserRole {
  CUSTOMER = 'customer',
  PROVIDER = 'provider',
  ADMIN = 'admin',
}

/**
 * User preferences value object
 */
export interface UserPreferences {
  language: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

/**
 * User entity class
 */
export class User {
  private readonly _id: Types.ObjectId;
  private _email: string;
  private _firstName: string;
  private _lastName: string;
  private _role: UserRole;
  private _phone?: string;
  private _isEmailVerified: boolean;
  private _isActive: boolean;
  private _isProvider: boolean;
  private _preferences: UserPreferences;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(params: {
    id?: Types.ObjectId;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    phone?: string;
    isEmailVerified?: boolean;
    isActive?: boolean;
    isProvider?: boolean;
    preferences?: Partial<UserPreferences>;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this._id = params.id || new Types.ObjectId();
    this._email = params.email.toLowerCase();
    this._firstName = params.firstName;
    this._lastName = params.lastName;
    this._role = params.role;
    this._phone = params.phone;
    this._isEmailVerified = params.isEmailVerified || false;
    this._isActive = params.isActive !== undefined ? params.isActive : true;
    this._isProvider = params.isProvider || false;
    this._preferences = {
      language: 'en',
      currency: 'USD',
      notifications: { email: true, push: true, sms: true },
      ...params.preferences,
    };
    this._createdAt = params.createdAt || new Date();
    this._updatedAt = params.updatedAt || new Date();
  }

  // Getters
  get id(): Types.ObjectId {
    return this._id;
  }

  get email(): string {
    return this._email;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get fullName(): string {
    return `${this._firstName} ${this._lastName}`;
  }

  get role(): UserRole {
    return this._role;
  }

  get phone(): string | undefined {
    return this._phone;
  }

  get isEmailVerified(): boolean {
    return this._isEmailVerified;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isProvider(): boolean {
    return this._isProvider;
  }

  get isCustomer(): boolean {
    return this._role === UserRole.CUSTOMER;
  }

  get isAdmin(): boolean {
    return this._role === UserRole.ADMIN;
  }

  get preferences(): UserPreferences {
    return { ...this._preferences };
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business methods

  /**
   * Update user profile
   */
  updateProfile(data: { firstName?: string; lastName?: string; phone?: string }): void {
    if (data.firstName) this._firstName = data.firstName;
    if (data.lastName) this._lastName = data.lastName;
    if (data.phone !== undefined) this._phone = data.phone;
    this._updatedAt = new Date();
  }

  /**
   * Update preferences
   */
  updatePreferences(preferences: Partial<UserPreferences>): void {
    this._preferences = {
      ...this._preferences,
      ...preferences,
      notifications: {
        ...this._preferences.notifications,
        ...preferences.notifications,
      },
    };
    this._updatedAt = new Date();
  }

  /**
   * Verify email
   */
  verifyEmail(): void {
    this._isEmailVerified = true;
    this._updatedAt = new Date();
  }

  /**
   * Deactivate user account
   */
  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /**
   * Activate user account
   */
  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  /**
   * Promote to provider
   */
  promoteToProvider(): void {
    this._isProvider = true;
    if (this._role === UserRole.CUSTOMER) {
      this._role = UserRole.PROVIDER;
    }
    this._updatedAt = new Date();
  }

  /**
   * Check if user can perform action based on role
   */
  hasPermission(action: string): boolean {
    const permissions: Record<UserRole, string[]> = {
      [UserRole.ADMIN]: ['*'], // All permissions
      [UserRole.PROVIDER]: [
        'manage_services',
        'view_bookings',
        'manage_bookings',
        'view_earnings',
        'update_availability',
      ],
      [UserRole.CUSTOMER]: ['view_services', 'create_bookings', 'manage_profile'],
    };

    const rolePermissions = permissions[this._role];
    return rolePermissions.includes('*') || rolePermissions.includes(action);
  }

  /**
   * Convert to plain object for persistence
   */
  toJSON(): Record<string, unknown> {
    return {
      _id: this._id,
      email: this._email,
      firstName: this._firstName,
      lastName: this._lastName,
      role: this._role,
      phone: this._phone,
      isEmailVerified: this._isEmailVerified,
      isActive: this._isActive,
      isProvider: this._isProvider,
      preferences: this._preferences,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: Record<string, unknown>): User {
    return new User({
      id: data._id as Types.ObjectId,
      email: data.email as string,
      firstName: data.firstName as string,
      lastName: data.lastName as string,
      role: data.role as UserRole,
      phone: data.phone as string | undefined,
      isEmailVerified: data.isEmailVerified as boolean,
      isActive: data.isActive as boolean,
      isProvider: data.isProvider as boolean,
      preferences: data.preferences as Partial<UserPreferences>,
      createdAt: data.createdAt as Date,
      updatedAt: data.updatedAt as Date,
    });
  }
}
