
import { useCallback } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export function useHaptics() {
  const isAvailable = Capacitor.isNativePlatform();

  const impact = useCallback(async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!isAvailable) return;

    const styleMap = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy
    };

    try {
      await Haptics.impact({ style: styleMap[style] });
    } catch (e) {
      // Haptics not available
    }
  }, [isAvailable]);

  const selection = useCallback(async () => {
    if (!isAvailable) return;
    try {
      await Haptics.selectionChanged();
    } catch (e) {
      // Not available
    }
  }, [isAvailable]);

  const notification = useCallback(async (type: 'success' | 'warning' | 'error' = 'success') => {
    if (!isAvailable) return;
    try {
      await Haptics.notification({ type: type as any });
    } catch (e) {
      // Not available
    }
  }, [isAvailable]);

  return { impact, selection, notification };
}
