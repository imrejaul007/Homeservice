import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimatedItemSize?: number;
  overscan?: number;
  className?: string;
  renderEmpty?: () => ReactNode;
  renderLoading?: () => ReactNode;
  isLoading?: boolean;
  getItemKey?: (item: T, index: number) => string | number;
}

/**
 * VirtualizedList - A simple virtualization wrapper using Intersection Observer
 * for rendering long lists efficiently with minimal DOM nodes.
 *
 * Uses Intersection Observer to only render items that are within or near
 * the visible viewport, significantly improving performance for large lists.
 */
export function VirtualizedList<T>({
  items,
  renderItem,
  estimatedItemSize = 100,
  overscan = 3,
  className = '',
  renderEmpty,
  renderLoading,
  isLoading = false,
  getItemKey,
}: VirtualizedListProps<T>) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeightsRef = useRef<Map<number, number>>(new Map());
  const itemPositionsRef = useRef<number[]>([]);

  // Calculate positions for all items
  useEffect(() => {
    const positions: number[] = [];
    let currentPosition = 0;

    items.forEach((_, index) => {
      positions.push(currentPosition);
      const height = itemHeightsRef.current.get(index) || estimatedItemSize;
      currentPosition += height;
    });

    itemPositionsRef.current = positions;
  }, [items, estimatedItemSize]);

  // Measure container height
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    setContainerHeight(container.clientHeight);

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate total height
  const totalHeight = items.reduce((sum, _, index) => {
    return sum + (itemHeightsRef.current.get(index) || estimatedItemSize);
  }, 0);

  // Update visible range based on scroll position
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    // Binary search for start index
    let startIndex = 0;
    let endIndex = items.length - 1;

    while (startIndex < endIndex) {
      const mid = Math.floor((startIndex + endIndex) / 2);
      const position = itemPositionsRef.current[mid] || mid * estimatedItemSize;

      if (position < scrollTop) {
        startIndex = mid + 1;
      } else {
        endIndex = mid;
      }
    }

    // Calculate end index
    let endIdx = startIndex;
    let currentPos = itemPositionsRef.current[startIndex] || startIndex * estimatedItemSize;

    while (endIdx < items.length && currentPos < scrollTop + viewportHeight) {
      const height = itemHeightsRef.current.get(endIdx) || estimatedItemSize;
      currentPos += height;
      endIdx++;
    }

    // Apply overscan
    const finalStart = Math.max(0, startIndex - overscan);
    const finalEnd = Math.min(items.length, endIdx + overscan);

    setVisibleRange({ start: finalStart, end: finalEnd });
  }, [items.length, estimatedItemSize, overscan]);

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Measure item heights
  const measureRef = useCallback((index: number) => (node: HTMLElement | null) => {
    if (node) {
      const height = node.getBoundingClientRect().height;
      if (height > 0 && height !== itemHeightsRef.current.get(index)) {
        itemHeightsRef.current.set(index, height);
        // Recalculate positions
        const positions: number[] = [];
        let currentPosition = 0;
        for (let i = 0; i < items.length; i++) {
          positions.push(currentPosition);
          currentPosition += itemHeightsRef.current.get(i) || estimatedItemSize;
        }
        itemPositionsRef.current = positions;
      }
    }
  }, [items.length, estimatedItemSize]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`virtualized-list-loading ${className}`}>
        {renderLoading ? renderLoading() : (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral" />
          </div>
        )}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className={`virtualized-list-empty ${className}`}>
        {renderEmpty ? renderEmpty() : (
          <div className="text-center py-8 text-nilin-warmGray">
            No items to display
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`virtualized-list overflow-auto ${className}`}
      style={{ height: containerHeight || '100%' }}
    >
      <div
        className="virtualized-list-inner"
        style={{ height: totalHeight, position: 'relative' }}
      >
        {items.map((item, index) => {
          // Skip items outside visible range
          if (index < visibleRange.start || index >= visibleRange.end) {
            return (
              <div
                key={getItemKey ? getItemKey(item, index) : index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: itemHeightsRef.current.get(index) || estimatedItemSize,
                }}
                aria-hidden="true"
              />
            );
          }

          const top = itemPositionsRef.current[index] || index * estimatedItemSize;
          const height = itemHeightsRef.current.get(index) || estimatedItemSize;

          return (
            <div
              key={getItemKey ? getItemKey(item, index) : index}
              ref={measureRef(index)}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                minHeight: height,
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualizedList;
export type { VirtualizedListProps };
