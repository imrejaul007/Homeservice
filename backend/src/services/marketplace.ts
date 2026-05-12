/**
 * Surge Pricing Service
 * Dynamic pricing engine for the marketplace
 */

import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';

// ============================================
// Type Definitions
// ============================================

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface SurgeBreakdown {
  timeMultiplier: number;
  demandMultiplier: number;
  locationMultiplier: number;
  eventMultiplier: number;
}

export interface SurgePricing {
  multiplier: number;
  breakdown: SurgeBreakdown;
  effectiveUntil: Date;
  zone: string;
  reason: string;
  appliedAt: Date;
}

export interface DemandLevel {
  level: 'low' | 'moderate' | 'high' | 'very_high' | 'extreme';
  multiplier: number;
  bookingCount: number;
  avgWaitTime: number;
}

export interface HighDemandZone {
  zone: string;
  center: LocationCoordinates;
  radius: number;
  demandLevel: DemandLevel['level'];
  activeProviders: number;
  pendingBookings: number;
  surgeMultiplier: number;
}

export interface UpcomingSurge {
  date: Date;
  multiplier: number;
  reason: string;
  confidence: number;
}

// ============================================
// Configuration
// ============================================

// Time-based multipliers
const TIME_MULTIPLIERS = {
  weekday: {
    morning: { start: 6, end: 12, multiplier: 1.0 },       // 6am-12pm: 1.0x
    afternoon: { start: 12, end: 17, multiplier: 1.1 },   // 12pm-5pm: 1.1x
    evening: { start: 17, end: 22, multiplier: 1.2 },     // 5pm-10pm: 1.2x
    night: { start: 22, end: 6, multiplier: 0.9 },        // 10pm-6am: 0.9x (off-peak)
  },
  saturday: {
    base: 1.3,
    nightStart: 18,
    nightEnd: 23,
    nightMultiplier: 1.5,
  },
  sunday: {
    base: 1.25,
  },
  friday: {
    base: 1.1,
    nightStart: 18,
    nightEnd: 23,
    nightMultiplier: 1.5,
  },
};

// Demand thresholds
const DEMAND_THRESHOLDS = {
  low: { maxBookings: 10, multiplier: 1.0 },
  moderate: { maxBookings: 25, multiplier: 1.1 },
  high: { maxBookings: 50, multiplier: 1.2 },
  very_high: { maxBookings: 100, multiplier: 1.35 },
  extreme: { maxBookings: Infinity, multiplier: 1.5 },
};

// Location multipliers (premium areas)
const LOCATION_MULTIPLIERS: Record<string, number> = {
  'downtown': 1.2,
  'marina': 1.15,
  'palm': 1.3,
  'jbr': 1.15,
  'business-bay': 1.1,
  'difc': 1.1,
  'motors': 1.1,
  'jumeirah': 1.2,
  'al-barsha': 1.0,
  'deira': 0.95,
  'bur-dubai': 1.0,
  'default': 1.0,
};

// UAE Public Holidays for 2024-2026
const UAE_HOLIDAYS: string[] = [
  // 2024
  '2024-01-01', // New Year's Day
  '2024-01-03', // New Year observed
  '2024-02-10', // Prophet Muhammad's Birthday (approximate)
  '2024-04-10', // Eid al-Fitr (approximate)
  '2024-04-11', // Eid al-Fitr Day 2 (approximate)
  '2024-04-12', // Eid al-Fitr Day 3 (approximate)
  '2024-06-06', // Arafat Day (approximate)
  '2024-06-07', // Eid al-Adha (approximate)
  '2024-06-08', // Eid al-Adha Day 2 (approximate)
  '2024-06-09', // Eid al-Adha Day 3 (approximate)
  '2024-08-09', // Hijri New Year (approximate)
  '2024-09-16', // Martyrs' Day
  '2024-12-01', // UAE National Day
  '2024-12-02', // UAE National Day Day 2
  // 2025
  '2025-01-01', // New Year's Day
  '2025-01-07', // New Year observed
  '2025-01-27', // Prophet Muhammad's Birthday (approximate)
  '2025-03-30', // Eid al-Fitr (approximate)
  '2025-03-31', // Eid al-Fitr Day 2 (approximate)
  '2025-05-27', // Arafat Day (approximate)
  '2025-05-28', // Eid al-Adha (approximate)
  '2025-05-29', // Eid al-Adha Day 2 (approximate)
  '2025-06-27', // Hijri New Year (approximate)
  '2025-09-16', // Martyrs' Day
  '2025-12-01', // UAE National Day
  '2025-12-02', // UAE National Day Day 2
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-16', // New Year observed
  '2026-01-17', // Prophet Muhammad's Birthday (approximate)
  '2026-02-19', // Eid al-Fitr (approximate)
  '2026-02-20', // Eid al-Fitr Day 2 (approximate)
  '2026-02-21', // Eid al-Fitr Day 3 (approximate)
  '2026-05-17', // Arafat Day (approximate)
  '2026-05-18', // Eid al-Adha (approximate)
  '2026-05-19', // Eid al-Adha Day 2 (approximate)
  '2026-06-07', // Eid al-Adha Day 3 (approximate)
  '2026-06-16', // Hijri New Year (approximate)
  '2026-09-16', // Martyrs' Day
  '2026-12-01', // UAE National Day
  '2026-12-02', // UAE National Day Day 2
];

// Cache for surge calculations (5 minute TTL)
const surgeCache = new Map<string, { surge: SurgePricing; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================
// Helper Functions
// ============================================

/**
 * Check if a date is a UAE public holiday
 */
function isUAEPublicHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return UAE_HOLIDAYS.includes(dateStr);
}

/**
 * Get time multiplier based on day and hour
 */
function getTimeMultiplier(date: Date): { multiplier: number; reason: string } {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = date.getHours();

  // Check for public holiday
  if (isUAEPublicHoliday(date)) {
    return { multiplier: 1.75, reason: 'UAE Public Holiday' };
  }

  // Sunday
  if (day === 0) {
    return { multiplier: TIME_MULTIPLIERS.sunday.base, reason: 'Sunday' };
  }

  // Saturday
  if (day === 6) {
    if (hour >= TIME_MULTIPLIERS.saturday.nightStart && hour < TIME_MULTIPLIERS.saturday.nightEnd) {
      return { multiplier: TIME_MULTIPLIERS.saturday.nightMultiplier, reason: 'Saturday Night' };
    }
    return { multiplier: TIME_MULTIPLIERS.saturday.base, reason: 'Saturday' };
  }

  // Friday
  if (day === 5) {
    if (hour >= TIME_MULTIPLIERS.friday.nightStart && hour < TIME_MULTIPLIERS.friday.nightEnd) {
      return { multiplier: TIME_MULTIPLIERS.friday.nightMultiplier, reason: 'Friday Night' };
    }
    return { multiplier: TIME_MULTIPLIERS.friday.base, reason: 'Friday' };
  }

  // Weekday multipliers
  if (hour >= 6 && hour < 12) {
    return { multiplier: TIME_MULTIPLIERS.weekday.morning.multiplier, reason: 'Weekday Morning' };
  }
  if (hour >= 12 && hour < 17) {
    return { multiplier: TIME_MULTIPLIERS.weekday.afternoon.multiplier, reason: 'Weekday Afternoon' };
  }
  if (hour >= 17 && hour < 22) {
    return { multiplier: TIME_MULTIPLIERS.weekday.evening.multiplier, reason: 'Weekday Evening' };
  }

  // Night (22:00 - 06:00)
  return { multiplier: TIME_MULTIPLIERS.weekday.night.multiplier, reason: 'Night (Off-Peak)' };
}

/**
 * Get location zone from coordinates
 */
function getLocationZone(coordinates: LocationCoordinates): { zone: string; multiplier: number } {
  // In a real implementation, this would use a geocoding service or predefined zones
  // For now, we'll use approximate bounding boxes for Dubai areas

  const { lat, lng } = coordinates;

  // Downtown Dubai
  if (lat >= 25.19 && lat <= 25.22 && lng >= 55.26 && lng <= 55.30) {
    return { zone: 'downtown', multiplier: LOCATION_MULTIPLIERS.downtown };
  }

  // Dubai Marina
  if (lat >= 25.07 && lat <= 25.10 && lng >= 55.12 && lng <= 55.16) {
    return { zone: 'marina', multiplier: LOCATION_MULTIPLIERS.marina };
  }

  // Palm Jumeirah
  if (lat >= 25.11 && lat <= 25.14 && lng >= 55.17 && lng <= 55.22) {
    return { zone: 'palm', multiplier: LOCATION_MULTIPLIERS.palm };
  }

  // JBR
  if (lat >= 25.08 && lat <= 25.10 && lng >= 55.13 && lng <= 55.16) {
    return { zone: 'jbr', multiplier: LOCATION_MULTIPLIERS.jbr };
  }

  // Business Bay
  if (lat >= 25.17 && lat <= 25.20 && lng >= 55.24 && lng <= 55.27) {
    return { zone: 'business-bay', multiplier: LOCATION_MULTIPLIERS['business-bay'] };
  }

  // DIFC
  if (lat >= 25.21 && lat <= 25.23 && lng >= 55.27 && lng <= 55.30) {
    return { zone: 'difc', multiplier: LOCATION_MULTIPLIERS.difc };
  }

  // Deira (generally lower demand)
  if (lat >= 25.26 && lat <= 25.30 && lng >= 55.29 && lng <= 55.35) {
    return { zone: 'deira', multiplier: LOCATION_MULTIPLIERS.deira };
  }

  // Jumeirah
  if (lat >= 25.15 && lat <= 25.22 && lng >= 55.18 && lng <= 55.24) {
    return { zone: 'jumeirah', multiplier: LOCATION_MULTIPLIERS.jumeirah };
  }

  return { zone: 'default', multiplier: LOCATION_MULTIPLIERS.default };
}

/**
 * Calculate demand level for a service/time slot
 */
function getDemandLevelValue(bookingCount: number): DemandLevel {
  if (bookingCount <= DEMAND_THRESHOLDS.low.maxBookings) {
    return { level: 'low', multiplier: 1.0, bookingCount, avgWaitTime: 15 };
  }
  if (bookingCount <= DEMAND_THRESHOLDS.moderate.maxBookings) {
    return { level: 'moderate', multiplier: 1.1, bookingCount, avgWaitTime: 30 };
  }
  if (bookingCount <= DEMAND_THRESHOLDS.high.maxBookings) {
    return { level: 'high', multiplier: 1.2, bookingCount, avgWaitTime: 45 };
  }
  if (bookingCount <= DEMAND_THRESHOLDS.very_high.maxBookings) {
    return { level: 'very_high', multiplier: 1.35, bookingCount, avgWaitTime: 60 };
  }
  return { level: 'extreme', multiplier: 1.5, bookingCount, avgWaitTime: 90 };
}

/**
 * Get cache key for surge calculation
 */
function getSurgeCacheKey(date: Date, location?: LocationCoordinates): string {
  const dateKey = date.toISOString().slice(0, 13); // Hour precision
  const locationKey = location ? `${location.lat.toFixed(3)}_${location.lng.toFixed(3)}` : 'none';
  return `${dateKey}_${locationKey}`;
}

/**
 * Check and get cached surge
 */
function getCachedSurge(cacheKey: string): SurgePricing | null {
  const cached = surgeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.surge;
  }
  surgeCache.delete(cacheKey);
  return null;
}

/**
 * Set surge in cache
 */
function setSurgeCache(cacheKey: string, surge: SurgePricing): void {
  // Limit cache size
  if (surgeCache.size > 1000) {
    // Remove oldest entries
    const entries = Array.from(surgeCache.entries());
    for (const [key, value] of entries) {
      if (value.expiresAt < Date.now()) {
        surgeCache.delete(key);
      }
    }
  }
  surgeCache.set(cacheKey, { surge, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============================================
// Main Service Functions
// ============================================

/**
 * Calculate surge multiplier for a given date and location
 */
export async function calculateSurgeMultiplier(
  date: Date,
  location?: LocationCoordinates
): Promise<SurgePricing> {
  const cacheKey = getSurgeCacheKey(date, location);
  const cached = getCachedSurge(cacheKey);
  if (cached) {
    return cached;
  }

  // Calculate time multiplier
  const timeResult = getTimeMultiplier(date);
  const timeMultiplier = timeResult.multiplier;
  const reasons: string[] = [timeResult.reason];

  // Calculate location multiplier
  let locationMultiplier = 1.0;
  let zone = 'default';

  if (location) {
    const locationResult = getLocationZone(location);
    locationMultiplier = locationResult.multiplier;
    zone = locationResult.zone;
    if (locationResult.multiplier > 1.0) {
      reasons.push(`Premium Area: ${zone}`);
    }
  }

  // Calculate demand multiplier
  const hour = date.getHours();
  const day = date.toISOString().split('T')[0];

  // Get historical booking count for this time slot
  const bookings = await Booking.find({
    scheduledDate: {
      $gte: new Date(`${day}T00:00:00.000Z`),
      $lt: new Date(`${day}T23:59:59.999Z`),
    },
    status: { $in: ['pending', 'confirmed', 'completed'] },
  }).lean();

  const bookingsThisHour = bookings.filter((b) => {
    const bookingHour = new Date(b.scheduledDate).getHours();
    return bookingHour === hour;
  }).length;

  const demandLevel = getDemandLevelValue(bookingsThisHour);
  const demandMultiplier = demandLevel.multiplier;

  if (demandLevel.level !== 'low') {
    reasons.push(`High Demand: ${demandLevel.level.replace('_', ' ')}`);
  }

  // Event multiplier (special events - would be configurable in production)
  let eventMultiplier = 1.0;
  const month = date.getMonth();
  const dayOfMonth = date.getDate();

  // Ramadan period (approximate - typically March/April)
  if (month === 2 || month === 3) {
    // During Ramadan, evening demand is typically higher
    if (hour >= 18 && hour < 22) {
      eventMultiplier = 1.1;
      reasons.push('Ramadan Period');
    }
  }

  // Dubai Shopping Festival (January)
  if (month === 0 && dayOfMonth >= 1 && dayOfMonth <= 31) {
    eventMultiplier = Math.max(eventMultiplier, 1.15);
    reasons.push('Dubai Shopping Festival');
  }

  // Dubai Summer Surprises (July/August)
  if (month === 6 || month === 7) {
    eventMultiplier = Math.max(eventMultiplier, 1.1);
    reasons.push('Dubai Summer Surprises');
  }

  // Calculate total multiplier (cap at 2.5x)
  const totalMultiplier = Math.min(
    timeMultiplier * locationMultiplier * demandMultiplier * eventMultiplier,
    2.5
  );

  // Round to 2 decimal places
  const roundedMultiplier = Math.round(totalMultiplier * 100) / 100;

  const surge: SurgePricing = {
    multiplier: roundedMultiplier,
    breakdown: {
      timeMultiplier: Math.round(timeMultiplier * 100) / 100,
      demandMultiplier: Math.round(demandMultiplier * 100) / 100,
      locationMultiplier: Math.round(locationMultiplier * 100) / 100,
      eventMultiplier: Math.round(eventMultiplier * 100) / 100,
    },
    effectiveUntil: new Date(date.getTime() + 60 * 60 * 1000), // 1 hour
    zone,
    reason: reasons.join(', '),
    appliedAt: new Date(),
  };

  // Cache the result
  setSurgeCache(cacheKey, surge);

  return surge;
}

/**
 * Get demand level for a service at a specific time
 */
export async function getDemandLevel(
  serviceId: string,
  date: Date,
  hour: number
): Promise<DemandLevel> {
  const day = date.toISOString().split('T')[0];

  // Build query
  const query: any = {
    scheduledDate: {
      $gte: new Date(`${day}T00:00:00.000Z`),
      $lt: new Date(`${day}T23:59:59.999Z`),
    },
    status: { $in: ['pending', 'confirmed'] },
  };

  if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
    query.serviceId = new Types.ObjectId(serviceId);
  }

  // Get bookings for this hour
  const bookings = await Booking.find(query).lean();
  const bookingsThisHour = bookings.filter((b) => {
    const bookingHour = new Date(b.scheduledDate).getHours();
    return bookingHour === hour;
  });

  return getDemandLevelValue(bookingsThisHour.length);
}

/**
 * Get upcoming surges for the next N days
 */
export async function getUpcomingSurges(daysAhead: number = 7): Promise<UpcomingSurge[]> {
  const daysClamped = Math.min(Math.max(1, daysAhead), 30);
  const surges: UpcomingSurge[] = [];
  const now = new Date();

  for (let i = 0; i < daysClamped; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);

    // Check each hour of the day
    let maxMultiplier = 1.0;
    let maxReason = 'Standard pricing';
    let maxHour = 12;

    for (let hour = 6; hour < 23; hour++) {
      const hourDate = new Date(date);
      hourDate.setHours(hour);

      const surge = await calculateSurgeMultiplier(hourDate);
      if (surge.multiplier > maxMultiplier) {
        maxMultiplier = surge.multiplier;
        maxReason = surge.reason;
        maxHour = hour;
      }
    }

    // Calculate confidence based on how far ahead
    const confidence = Math.max(0.5, 1 - (i * 0.05));

    surges.push({
      date: new Date(date.setHours(maxHour)),
      multiplier: maxMultiplier,
      reason: maxReason,
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  return surges;
}

/**
 * Get areas with currently high demand
 */
export async function getHighDemandZones(
  options?: {
    minDemandLevel?: DemandLevel['level'];
    limit?: number;
  }
): Promise<HighDemandZone[]> {
  const minLevel = options?.minDemandLevel || 'high';
  const limit = Math.min(options?.limit || 20, 100);

  const now = new Date();
  const day = now.toISOString().split('T')[0];

  // Get all active bookings
  const bookings = await Booking.find({
    scheduledDate: {
      $gte: new Date(`${day}T00:00:00.000Z`),
      $lt: new Date(`${day}T23:59:59.999Z`),
    },
    status: { $in: ['pending', 'confirmed'] },
    'location.address.coordinates': { $exists: true },
  }).lean();

  // Get active providers
  const providers = await ProviderProfile.find({
    isActive: true,
    isDeleted: false,
  })
    .select('userId locationInfo.primaryAddress.coordinates')
    .lean();

  const providerCountByZone: Record<string, number> = {};
  const bookingCountByZone: Record<string, number> = {};

  // Count providers by zone
  for (const provider of providers) {
    const coords = provider.locationInfo?.primaryAddress?.coordinates;
    if (coords) {
      const zone = getLocationZone({ lat: coords.lat, lng: coords.lng }).zone;
      providerCountByZone[zone] = (providerCountByZone[zone] || 0) + 1;
    }
  }

  // Count bookings by zone
  for (const booking of bookings) {
    const coords = booking.location?.address?.coordinates?.coordinates;
    if (coords) {
      const zone = getLocationZone({ lat: coords[1], lng: coords[0] }).zone;
      bookingCountByZone[zone] = (bookingCountByZone[zone] || 0) + 1;
    }
  }

  // Build zones with high demand
  const zones: HighDemandZone[] = [];

  for (const zoneName of Object.keys(bookingCountByZone)) {
    const bookingCount = bookingCountByZone[zoneName];
    const activeProviders = providerCountByZone[zoneName] || 1;
    const pendingBookings = bookingCount;
    const demandRatio = pendingBookings / activeProviders;

    // Calculate demand level
    let level: DemandLevel['level'] = 'low';
    let surgeMultiplier = 1.0;

    if (demandRatio > 3 || pendingBookings > 50) {
      level = 'extreme';
      surgeMultiplier = 1.5;
    } else if (demandRatio > 2 || pendingBookings > 30) {
      level = 'very_high';
      surgeMultiplier = 1.35;
    } else if (demandRatio > 1.5 || pendingBookings > 15) {
      level = 'high';
      surgeMultiplier = 1.2;
    } else if (demandRatio > 0.8 || pendingBookings > 5) {
      level = 'moderate';
      surgeMultiplier = 1.1;
    }

    // Check if meets minimum level
    const levelOrder = ['low', 'moderate', 'high', 'very_high', 'extreme'];
    const minLevelIndex = levelOrder.indexOf(minLevel);
    const currentLevelIndex = levelOrder.indexOf(level);

    if (currentLevelIndex >= minLevelIndex) {
      // Get zone center (approximate based on zone name)
      const center = getZoneCenter(zoneName);

      zones.push({
        zone: zoneName,
        center,
        radius: 5, // km
        demandLevel: level,
        activeProviders,
        pendingBookings,
        surgeMultiplier,
      });
    }
  }

  // Sort by surge multiplier descending
  zones.sort((a, b) => b.surgeMultiplier - a.surgeMultiplier);

  return zones.slice(0, limit);
}

/**
 * Get approximate center coordinates for a zone
 */
function getZoneCenter(zone: string): LocationCoordinates {
  const zoneCenters: Record<string, LocationCoordinates> = {
    downtown: { lat: 25.205, lng: 55.278 },
    marina: { lat: 25.082, lng: 55.138 },
    palm: { lat: 25.125, lng: 55.195 },
    jbr: { lat: 25.092, lng: 55.145 },
    'business-bay': { lat: 25.185, lng: 55.255 },
    difc: { lat: 25.215, lng: 55.280 },
    deira: { lat: 25.280, lng: 55.320 },
    jumeirah: { lat: 25.185, lng: 55.210 },
    motors: { lat: 25.065, lng: 55.220 },
    'al-barsha': { lat: 25.110, lng: 55.195 },
    'bur-dubai': { lat: 25.260, lng: 55.300 },
    default: { lat: 25.205, lng: 55.270 },
  };

  return zoneCenters[zone] || zoneCenters.default;
}

/**
 * Calculate price with surge
 */
export function calculatePriceWithSurge(
  basePrice: number,
  surge: SurgePricing
): {
  originalPrice: number;
  surgeAmount: number;
  surgePercentage: number;
  finalPrice: number;
} {
  const surgeAmount = basePrice * (surge.multiplier - 1);
  const finalPrice = basePrice * surge.multiplier;

  return {
    originalPrice: Math.round(basePrice * 100) / 100,
    surgeAmount: Math.round(surgeAmount * 100) / 100,
    surgePercentage: Math.round((surge.multiplier - 1) * 100),
    finalPrice: Math.round(finalPrice * 100) / 100,
  };
}

/**
 * Get surge pricing rules/configuration
 */
export function getSurgeConfiguration(): {
  timeMultipliers: typeof TIME_MULTIPLIERS;
  demandThresholds: typeof DEMAND_THRESHOLDS;
  locationMultipliers: typeof LOCATION_MULTIPLIERS;
  maxSurgeCap: number;
  cacheTTLMinutes: number;
} {
  return {
    timeMultipliers: TIME_MULTIPLIERS,
    demandThresholds: DEMAND_THRESHOLDS,
    locationMultipliers: LOCATION_MULTIPLIERS,
    maxSurgeCap: 2.5,
    cacheTTLMinutes: 5,
  };
}

/**
 * Clear surge cache (for testing or manual invalidation)
 */
export function clearSurgeCache(): void {
  surgeCache.clear();
}

/**
 * A/B test bucket assignment
 */
export function experimentBucket(userId: string, experimentId: string): string {
  // Simple hash-based bucket assignment
  const hash = `${userId}:${experimentId}`.split('').reduce((a, c) => {
    return ((a << 5) - a + c.charCodeAt(0)) | 0;
  }, 0);
  const bucket = Math.abs(hash) % 100;
  return bucket < 50 ? 'control' : 'variant';
}

// ============================================
// Service Export
// ============================================

export const marketplaceService = {
  calculateSurgeMultiplier,
  getDemandLevel,
  getUpcomingSurges,
  getHighDemandZones,
  calculatePriceWithSurge,
  getSurgeConfiguration,
  clearSurgeCache,
  experimentBucket,
};

export default marketplaceService;
