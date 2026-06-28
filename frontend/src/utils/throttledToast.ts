const lastShownAt = new Map<string, number>();

/**
 * Shows a toast at most once per key within the cooldown window.
 */
export function shouldShowThrottledToast(key: string, cooldownMs = 5000): boolean {
  const now = Date.now();
  const last = lastShownAt.get(key);
  if (last !== undefined && now - last < cooldownMs) {
    return false;
  }
  lastShownAt.set(key, now);
  return true;
}

export function createThrottledNotifier<T extends (...args: never[]) => void>(
  key: string,
  notify: T,
  cooldownMs = 5000
): T {
  return ((...args: Parameters<T>) => {
    if (!shouldShowThrottledToast(key, cooldownMs)) return;
    notify(...args);
  }) as T;
}
