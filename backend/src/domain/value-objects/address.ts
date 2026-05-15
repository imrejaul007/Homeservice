/**
 * Address Value Object
 *
 * Immutable value object representing a physical address.
 * Provides validation and formatting operations.
 *
 * @module domain/value-objects/address
 */

/**
 * Coordinates value object
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Address value object class
 */
export class Address {
  private readonly _street: string;
  private readonly _city: string;
  private readonly _state: string;
  private readonly _zipCode: string;
  private readonly _country: string;
  private readonly _coordinates?: Coordinates;

  constructor(params: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: Coordinates;
  }) {
    this._street = params.street.trim();
    this._city = params.city.trim();
    this._state = params.state.trim();
    this._zipCode = params.zipCode.trim();
    this._country = params.country.trim();
    this._coordinates = params.coordinates;
  }

  // Getters
  get street(): string {
    return this._street;
  }

  get city(): string {
    return this._city;
  }

  get state(): string {
    return this._state;
  }

  get zipCode(): string {
    return this._zipCode;
  }

  get country(): string {
    return this._country;
  }

  get coordinates(): Coordinates | undefined {
    return this._coordinates ? { ...this._coordinates } : undefined;
  }

  /**
   * Get full address as single line
   */
  toSingleLine(): string {
    return `${this._street}, ${this._city}, ${this._state} ${this._zipCode}, ${this._country}`;
  }

  /**
   * Get address as array of lines
   */
  toLines(): string[] {
    const lines: string[] = [this._street, `${this._city}, ${this._state} ${this._zipCode}`, this._country];
    return lines;
  }

  /**
   * Get short format (city, country)
   */
  toShortFormat(): string {
    return `${this._city}, ${this._country}`;
  }

  /**
   * Format for display
   */
  format(locale: string = 'en-US'): string {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(this.toLines());
  }

  /**
   * Check if has coordinates
   */
  hasCoordinates(): boolean {
    return this._coordinates !== undefined;
  }

  /**
   * Calculate distance to another address (if both have coordinates)
   */
  distanceTo(other: Address): number | null {
    if (!this._coordinates || !other._coordinates) {
      return null;
    }

    return this.calculateDistance(
      this._coordinates.latitude,
      this._coordinates.longitude,
      other._coordinates.latitude,
      other._coordinates.longitude
    );
  }

  /**
   * Check if within radius of coordinates
   */
  isWithinRadius(latitude: number, longitude: number, radiusKm: number): boolean {
    if (!this._coordinates) {
      return false;
    }

    const distance = this.calculateDistance(
      this._coordinates.latitude,
      this._coordinates.longitude,
      latitude,
      longitude
    );

    return distance <= radiusKm;
  }

  /**
   * Check equality
   */
  equals(other: Address): boolean {
    return (
      this._street === other._street &&
      this._city === other._city &&
      this._state === other._state &&
      this._zipCode === other._zipCode &&
      this._country === other._country
    );
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
   * Convert to Mongoose format
   */
  toMongooseFormat(): {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: { type: 'Point'; coordinates: [number, number] };
  } {
    return {
      street: this._street,
      city: this._city,
      state: this._state,
      zipCode: this._zipCode,
      country: this._country,
      coordinates: this._coordinates
        ? { type: 'Point' as const, coordinates: [this._coordinates.longitude, this._coordinates.latitude] }
        : undefined,
    };
  }

  /**
   * Create from Mongoose format
   */
  static fromMongooseFormat(data: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: { type: string; coordinates: [number, number] };
  }): Address {
    return new Address({
      street: data.street,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country,
      coordinates: data.coordinates
        ? { latitude: data.coordinates.coordinates[1], longitude: data.coordinates.coordinates[0] }
        : undefined,
    });
  }

  /**
   * Convert to JSON
   */
  toJSON(): {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: Coordinates;
  } {
    return {
      street: this._street,
      city: this._city,
      state: this._state,
      zipCode: this._zipCode,
      country: this._country,
      coordinates: this._coordinates,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: Coordinates;
  }): Address {
    return new Address(data);
  }

  /**
   * String representation
   */
  toString(): string {
    return this.toSingleLine();
  }
}

/**
 * Validate address data
 */
export function validateAddressData(data: Partial<{
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.street?.trim()) {
    errors.push('Street address is required');
  }

  if (!data.city?.trim()) {
    errors.push('City is required');
  }

  if (!data.country?.trim()) {
    errors.push('Country is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
