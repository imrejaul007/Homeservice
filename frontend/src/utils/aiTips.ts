import type { AITip } from '../components/provider/AITipsAlerts';
import { providerInsightsApi, type InsightTipPreferences } from '../services/providerInsightsApi';
import {
  getPreventionActionLabel,
  getPreventionTipActionRoute,
  getRevenueTipActionRoute,
} from './aiTipRoutes';

export {
  getPreventionActionLabel,
  getPreventionTipActionRoute,
  getRevenueTipActionRoute,
} from './aiTipRoutes';

const STORAGE_PREFIX = 'nilin_ai_tip_prefs';

function storageKey(providerId: string): string {
  return `${STORAGE_PREFIX}:${providerId}`;
}

function loadLocalPreferences(providerId: string): InsightTipPreferences {
  try {
    const raw = localStorage.getItem(storageKey(providerId));
    if (!raw) return { dismissed: [], read: [] };
    const parsed = JSON.parse(raw) as Partial<InsightTipPreferences>;
    return {
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
      read: Array.isArray(parsed.read) ? parsed.read : [],
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return { dismissed: [], read: [] };
  }
}

export function saveTipPreferencesCache(providerId: string, prefs: InsightTipPreferences): void {
  try {
    localStorage.setItem(storageKey(providerId), JSON.stringify(prefs));
  } catch {
    // Ignore quota / private browsing errors
  }
}

function mergePreferences(
  server: InsightTipPreferences,
  local: InsightTipPreferences
): InsightTipPreferences {
  return {
    dismissed: [...new Set([...server.dismissed, ...local.dismissed])],
    read: [...new Set([...server.read, ...local.read])],
    updatedAt: server.updatedAt || local.updatedAt,
  };
}

function needsServerSync(server: InsightTipPreferences, merged: InsightTipPreferences): boolean {
  const serverDismissed = new Set(server.dismissed);
  const serverRead = new Set(server.read);
  return (
    merged.dismissed.some((id) => !serverDismissed.has(id)) ||
    merged.read.some((id) => !serverRead.has(id))
  );
}

export async function syncLocalTipPreferencesToServer(providerId: string): Promise<void> {
  const local = loadLocalPreferences(providerId);
  if (local.dismissed.length === 0 && local.read.length === 0) {
    return;
  }

  try {
    const synced = await providerInsightsApi.syncInsightPreferences({
      dismissed: local.dismissed,
      read: local.read,
    });
    saveTipPreferencesCache(providerId, synced);
  } catch {
    // Server sync can happen on next successful request
  }
}

export async function loadTipPreferences(providerId: string): Promise<InsightTipPreferences> {
  const local = loadLocalPreferences(providerId);

  try {
    const server = await providerInsightsApi.getInsightPreferences();
    const merged = mergePreferences(server, local);

    if (needsServerSync(server, merged)) {
      const synced = await providerInsightsApi.syncInsightPreferences({
        dismissed: merged.dismissed,
        read: merged.read,
      });
      saveTipPreferencesCache(providerId, synced);
      return synced;
    }

    saveTipPreferencesCache(providerId, merged);
    return merged;
  } catch {
    return local;
  }
}

export function applyTipPreferences(tips: AITip[], prefs: InsightTipPreferences): AITip[] {
  return tips.map((tip) => ({
    ...tip,
    isRead: prefs.read.includes(tip.id),
    isDismissed: prefs.dismissed.includes(tip.id),
  }));
}

export async function dismissAiTip(providerId: string, tipId: string): Promise<void> {
  const local = loadLocalPreferences(providerId);
  if (!local.dismissed.includes(tipId)) {
    local.dismissed.push(tipId);
  }
  saveTipPreferencesCache(providerId, local);

  try {
    const synced = await providerInsightsApi.updateInsightPreferences({ dismissTipId: tipId });
    saveTipPreferencesCache(providerId, synced);
  } catch {
    // Local cache remains; will sync on next loadTipPreferences
  }
}

export async function markAiTipRead(providerId: string, tipId: string): Promise<void> {
  const local = loadLocalPreferences(providerId);
  if (!local.read.includes(tipId)) {
    local.read.push(tipId);
  }
  saveTipPreferencesCache(providerId, local);

  try {
    const synced = await providerInsightsApi.updateInsightPreferences({ readTipId: tipId });
    saveTipPreferencesCache(providerId, synced);
  } catch {
    // Local cache remains; will sync on next loadTipPreferences
  }
}

export function getTipActionRoute(tip: Pick<AITip, 'id' | 'category' | 'actionRoute'>): string {
  if (tip.actionRoute) return tip.actionRoute;

  if (tip.id.startsWith('rev-')) {
    const category = tip.id.replace('rev-', '');
    return getRevenueTipActionRoute(category);
  }

  if (tip.id.startsWith('prev-')) {
    const type = tip.id.replace('prev-', '');
    return getPreventionTipActionRoute(type);
  }

  switch (tip.category) {
    case 'revenue':
      return '/provider/services';
    case 'bookings':
      return '/provider/bookings';
    case 'efficiency':
      return '/provider/calendar';
    case 'rating':
      return '/provider/reviews';
    default:
      return '/provider/analytics?tab=insights';
  }
}

export function getInsightsRouteForRevenueCategory(category: string): string {
  return getRevenueTipActionRoute(category);
}

export function getInsightsRouteForPreventionType(type: string): string {
  return getPreventionTipActionRoute(type);
}
