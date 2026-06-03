import Service from '../models/service.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import { validateProviderSlotAvailability } from '../utils/availabilityHelper';
import { getPlatformPolicySync } from './platformSettingsPolicy.service';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

export interface AssignProviderInput {
  serviceId: string;
  scheduledDate: string | Date;
  scheduledTime: string;
  serviceDurationMinutes?: number;
  professionalPreference?: 'male' | 'female' | 'no_preference';
}

export interface AssignProviderResult {
  providerId: string;
  assignmentMethod: 'auto';
  assignmentCandidateCount: number;
}

interface ScoredCandidate {
  providerId: string;
  score: number;
  rating: number;
  dailyBookings: number;
}

async function countDailyBookings(providerId: string, scheduledDate: string | Date): Promise<number> {
  const dayStart = new Date(scheduledDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return Booking.countDocuments({
    providerId,
    scheduledDate: { $gte: dayStart, $lt: dayEnd },
    status: { $nin: ['cancelled', 'failed', 'rejected'] },
    deletedAt: { $exists: false },
  });
}

function matchesProfessionalPreference(
  provider: { gender?: string },
  preference?: 'male' | 'female' | 'no_preference'
): boolean {
  if (!preference || preference === 'no_preference') return true;
  if (!provider.gender) return true;
  return provider.gender.toLowerCase() === preference;
}

export async function assignMarketplaceProvider(
  input: AssignProviderInput
): Promise<AssignProviderResult> {
  const policy = getPlatformPolicySync();
  if (!policy.autoAssignmentEnabled) {
    throw new ApiError(400, 'Provider is required when auto-assignment is disabled');
  }

  const service = await Service.findById(input.serviceId).lean();
  if (!service || !service.isActive) {
    throw new ApiError(404, 'Service not found or inactive');
  }

  const categoryId = String(service.category);

  const offerings = await Service.find({
    isActive: true,
    $or: [{ _id: input.serviceId }, { category: categoryId }],
  })
    .select('providerId')
    .limit(50)
    .lean();

  const providerIds = [
    ...new Set(
      offerings
        .map((s) => s.providerId?.toString())
        .filter((id): id is string => Boolean(id))
    ),
  ].slice(0, 20);

  if (!providerIds.length) {
    throw new ApiError(409, 'No providers available for this service');
  }

  const providers = await User.find({
    _id: { $in: providerIds },
    role: 'provider',
    isSuspended: { $ne: true },
    'verificationStatus.overall': 'approved',
  })
    .select('_id firstName lastName gender averageRating')
    .lean();

  const duration = input.serviceDurationMinutes || service.duration || 60;
  const scored: ScoredCandidate[] = [];

  for (const provider of providers) {
    const providerId = provider._id.toString();
    if (!matchesProfessionalPreference(provider as { gender?: string }, input.professionalPreference)) {
      continue;
    }

    const availability = await validateProviderSlotAvailability({
      providerId,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      serviceDurationMinutes: duration,
    });

    if (!availability.isValid) continue;

    const dailyBookings = await countDailyBookings(providerId, input.scheduledDate);
    const rating = (provider as { averageRating?: number }).averageRating ?? 0;
    const score = rating * 10 - dailyBookings;

    scored.push({ providerId, score, rating, dailyBookings });
  }

  if (!scored.length) {
    throw new ApiError(409, 'No available provider found for the selected time slot');
  }

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  logger.info('Auto-assigned marketplace provider', {
    providerId: winner.providerId,
    assignmentMethod: 'auto',
    assignmentCandidateCount: scored.length,
    action: 'PROVIDER_AUTO_ASSIGNED',
  });

  return {
    providerId: winner.providerId,
    assignmentMethod: 'auto',
    assignmentCandidateCount: scored.length,
  };
}

export async function validateProviderForService(
  serviceId: string,
  providerId: string
): Promise<void> {
  const service = await Service.findById(serviceId).lean();
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  const ownsService =
    service.providerId?.toString() === providerId ||
    (await Service.exists({
      _id: serviceId,
      providerId,
      isActive: true,
    }));

  const categoryMatch = await Service.exists({
    providerId,
    category: service.category,
    isActive: true,
  });

  if (!ownsService && !categoryMatch) {
    throw new ApiError(400, 'Selected provider does not offer this service');
  }
}
