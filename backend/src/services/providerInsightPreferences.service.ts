import ProviderProfile from '../models/providerProfile.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

export interface InsightTipPreferences {
  dismissed: string[];
  read: string[];
  updatedAt?: Date;
}

const DEFAULT_PREFERENCES: InsightTipPreferences = {
  dismissed: [],
  read: [],
};

function normalizeTipIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))];
}

export async function getInsightTipPreferences(providerId: string): Promise<InsightTipPreferences> {
  const profile = await ProviderProfile.findOne({ userId: providerId })
    .select('settings.insightPreferences')
    .lean();

  if (!profile?.settings?.insightPreferences) {
    return { ...DEFAULT_PREFERENCES };
  }

  const prefs = profile.settings.insightPreferences as InsightTipPreferences;
  return {
    dismissed: normalizeTipIds(prefs.dismissed),
    read: normalizeTipIds(prefs.read),
    updatedAt: prefs.updatedAt,
  };
}

export async function updateInsightTipPreferences(
  providerId: string,
  updates: {
    dismissTipId?: string;
    readTipId?: string;
    dismissed?: string[];
    read?: string[];
  }
): Promise<InsightTipPreferences> {
  const profile = await ProviderProfile.findOne({ userId: providerId }).select('settings');

  if (!profile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  const current = profile.settings?.insightPreferences || { ...DEFAULT_PREFERENCES };
  const dismissed = new Set(normalizeTipIds(current.dismissed));
  const read = new Set(normalizeTipIds(current.read));

  if (updates.dismissed) {
    updates.dismissed.forEach((id) => dismissed.add(id));
  }
  if (updates.read) {
    updates.read.forEach((id) => read.add(id));
  }
  if (updates.dismissTipId) {
    dismissed.add(updates.dismissTipId);
  }
  if (updates.readTipId) {
    read.add(updates.readTipId);
  }

  const nextPreferences: InsightTipPreferences = {
    dismissed: [...dismissed],
    read: [...read],
    updatedAt: new Date(),
  };

  profile.settings = profile.settings || ({} as typeof profile.settings);
  profile.settings.insightPreferences = nextPreferences;
  profile.markModified('settings');
  await profile.save();

  logger.debug('Insight tip preferences updated', {
    providerId,
    dismissedCount: nextPreferences.dismissed.length,
    readCount: nextPreferences.read.length,
  });

  return nextPreferences;
}
