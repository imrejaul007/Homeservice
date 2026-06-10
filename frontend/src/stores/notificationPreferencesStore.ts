import { create } from 'zustand';
import { notificationApi, type NotificationPreferencesResponse, type QuietHours } from '../services/notificationApi';

export interface NotificationPreferencesData {
  email: {
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
    marketing: boolean;
    newsletters: boolean;
    reviews?: boolean;
    paymentUpdates?: boolean;
    loyaltyUpdates?: boolean;
  };
  sms: {
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
    newMessages?: boolean;
  };
  push: {
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
    newMessages: boolean;
    marketing?: boolean;
  };
  quietHours: QuietHours;
  language: string;
  timezone: string;
  currency: string;
}

const defaultPreferences = (): NotificationPreferencesData => ({
  email: {
    bookingUpdates: true,
    reminders: true,
    promotions: false,
    marketing: false,
    newsletters: false,
    reviews: true,
    paymentUpdates: true,
    loyaltyUpdates: true,
  },
  sms: {
    bookingUpdates: true,
    reminders: true,
    promotions: false,
    newMessages: true,
  },
  push: {
    bookingUpdates: true,
    reminders: true,
    promotions: false,
    newMessages: true,
    marketing: false,
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  language: 'en',
  timezone: 'Asia/Dubai',
  currency: 'AED',
});

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosErr = error as { response?: { data?: { message?: string } } };
    if (axiosErr.response?.data?.message) {
      return axiosErr.response.data.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function mapApiToPreferences(prefs: NotificationPreferencesResponse): NotificationPreferencesData {
  return {
    email: {
      bookingUpdates: prefs.email?.bookingUpdates ?? true,
      reminders: prefs.email?.reminders ?? true,
      promotions: prefs.email?.promotions ?? false,
      marketing: prefs.email?.marketing ?? false,
      newsletters: prefs.email?.newsletters ?? false,
      reviews: prefs.email?.reviews ?? true,
      paymentUpdates: prefs.email?.paymentUpdates ?? true,
      loyaltyUpdates: prefs.email?.loyaltyUpdates ?? true,
    },
    sms: {
      bookingUpdates: prefs.sms?.bookingUpdates ?? true,
      reminders: prefs.sms?.reminders ?? true,
      promotions: prefs.sms?.promotions ?? false,
      newMessages: prefs.sms?.newMessages ?? true,
    },
    push: {
      bookingUpdates: prefs.push?.bookingUpdates ?? true,
      reminders: prefs.push?.reminders ?? true,
      promotions: prefs.push?.promotions ?? false,
      newMessages: prefs.push?.newMessages ?? true,
      marketing: prefs.push?.marketing ?? false,
    },
    quietHours: prefs.quietHours ?? defaultPreferences().quietHours,
    language: prefs.language ?? 'en',
    timezone: prefs.timezone ?? 'Asia/Dubai',
    currency: prefs.currency ?? 'AED',
  };
}

interface NotificationPreferencesState {
  preferences: NotificationPreferencesData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (partial: Partial<NotificationPreferencesData>) => Promise<void>;
  invalidate: () => void;
}

export const useNotificationPreferencesStore = create<NotificationPreferencesState>((set, get) => ({
  preferences: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchPreferences: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await notificationApi.getPreferences();
      const prefs = mapApiToPreferences({
        ...response.data,
        language: (response.data as NotificationPreferencesResponse & { language?: string }).language,
        timezone: (response.data as NotificationPreferencesResponse & { timezone?: string }).timezone,
        currency: (response.data as NotificationPreferencesResponse & { currency?: string }).currency,
      });
      set({ preferences: prefs, isLoading: false });
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Failed to load preferences');
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updatePreferences: async (partial) => {
    const current = get().preferences ?? defaultPreferences();
    set({ isSaving: true, error: null });
    try {
      await notificationApi.updatePreferences({
        email: partial.email ?? current.email,
        sms: partial.sms ?? current.sms,
        push: partial.push ?? current.push,
        quietHours: partial.quietHours ?? current.quietHours,
        language: partial.language ?? current.language,
        timezone: partial.timezone ?? current.timezone,
        currency: partial.currency ?? current.currency,
      });
      const merged: NotificationPreferencesData = {
        ...current,
        ...partial,
        email: { ...current.email, ...partial.email },
        sms: { ...current.sms, ...partial.sms },
        push: { ...current.push, ...partial.push },
        quietHours: { ...current.quietHours, ...partial.quietHours },
      };
      set({ preferences: merged, isSaving: false });

      if (partial.language) {
        const { useAuthStore } = await import('./authStore');
        const user = useAuthStore.getState().user;
        if (user) {
          useAuthStore.getState().setUser({ ...user, language: partial.language });
        }
      }
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Failed to save preferences');
      set({ error: message, isSaving: false });
      throw error;
    }
  },

  invalidate: () => {
    set({ preferences: null });
  },
}));

export { defaultPreferences, mapApiToPreferences };
