import { useId, useRef } from 'react';

/**
 * Stable ID hook for SSR/hydration-safe element IDs
 *
 * Problem: React.useId() can produce different values on server vs client during hydration,
 * causing hydration mismatches. This hook uses a stable prefix combined with useId() to
 * ensure consistent IDs across the SSR boundary while maintaining uniqueness per component instance.
 *
 * @param prefix - Optional prefix for the ID (e.g., 'input', 'textarea'). Defaults to 'id'
 * @returns A stable ID string prefixed with the given prefix
 *
 * @example
 * // Returns something like 'input-a1b2c3d4' on both server and client
 * const id = useStableId('input');
 */
export function useStableId(prefix: string = 'id'): string {
  // Generate the React ID (unique per component instance)
  const reactId = useId();

  // Use a ref to store the stable ID to avoid regeneration on each render
  // This ensures the same ID is returned even if useId() produces different values
  // during hydration (though useId() should be stable, this provides extra safety)
  const stableIdRef = useRef<string | null>(null);

  if (stableIdRef.current === null) {
    // Generate stable ID: prefix + sanitized reactId
    // Replace any non-alphanumeric characters with underscores for valid HTML IDs
    const sanitizedReactId = reactId.replace(/[^a-zA-Z0-9]/g, '_');
    stableIdRef.current = `${prefix}_${sanitizedReactId}`;
  }

  return stableIdRef.current;
}

export default useStableId;
