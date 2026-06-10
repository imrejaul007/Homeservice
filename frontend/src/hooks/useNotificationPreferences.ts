import { useEffect, useCallback, useMemo } from 'react';
import {
  useNotificationPreferencesStore,
  type NotificationPreferencesData,
} from '../stores/notificationPreferencesStore';

export function useNotificationPreferences(options?: { autoFetch?: boolean }) {
  const {
    preferences,
    isLoading,
    isSaving,
    error,
    fetchPreferences,
    updatePreferences,
    invalidate,
  } = useNotificationPreferencesStore();

  const autoFetch = options?.autoFetch ?? true;

  useEffect(() => {
    if (autoFetch && !preferences && !isLoading) {
      fetchPreferences().catch(() => {
        // error stored in state
      });
    }
  }, [autoFetch, preferences, isLoading, fetchPreferences]);

  const isDirty = useCallback(
    (draft: Partial<NotificationPreferencesData>) => {
      if (!preferences) return false;
      return JSON.stringify(draft) !== JSON.stringify({
        ...preferences,
        ...draft,
        email: { ...preferences.email, ...draft.email },
        sms: { ...preferences.sms, ...draft.sms },
        push: { ...preferences.push, ...draft.push },
      });
    },
    [preferences]
  );

  const refresh = useCallback(async () => {
    invalidate();
    await fetchPreferences();
  }, [invalidate, fetchPreferences]);

  return useMemo(
    () => ({
      preferences,
      isLoading,
      isSaving,
      error,
      fetchPreferences,
      updatePreferences,
      refresh,
      isDirty,
    }),
    [preferences, isLoading, isSaving, error, fetchPreferences, updatePreferences, refresh, isDirty]
  );
}

export type { NotificationPreferencesData };
