import { useEffect, useState } from 'react';

/**
 * Defers mounting until browser idle or first user interaction.
 * Used to lazy-load non-critical widgets (chat, search modal shell).
 */
export function useDeferredMount(timeoutMs = 3000): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;

    const activate = () => setReady(true);

    let idleHandle: number | ReturnType<typeof setTimeout>;
    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(activate, { timeout: timeoutMs });
    } else {
      idleHandle = setTimeout(activate, Math.min(timeoutMs, 2000));
    }

    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((event) => {
      window.addEventListener(event, activate, { once: true, passive: true });
    });

    return () => {
      if (typeof window.cancelIdleCallback === 'function' && typeof idleHandle === 'number') {
        window.cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle as ReturnType<typeof setTimeout>);
      }
      events.forEach((event) => window.removeEventListener(event, activate));
    };
  }, [ready, timeoutMs]);

  return ready;
}

export default useDeferredMount;
