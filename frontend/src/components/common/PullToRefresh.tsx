import React, { useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { cn } from '../../lib/utils';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
  pullThreshold?: number; // Minimum distance to trigger refresh (px)
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  className,
  pullThreshold = 80,
  disabled = false,
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const isPullingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current || disabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      e.preventDefault();
      setIsPulling(true);
      // Apply resistance curve
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, pullThreshold * 1.5);
      setPullDistance(distance);
    }
  }, [disabled, isRefreshing, pullThreshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;

    isPullingRef.current = false;
    setIsPulling(false);

    if (pullDistance >= pullThreshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(0);

      // Trigger haptic feedback
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.impact({ style: ImpactStyle.Medium });
        } catch (e) {
          console.log('Haptics not available');
        }
      }

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);

        // Success haptic
        if (Capacitor.isNativePlatform()) {
          try {
            await Haptics.impact({ style: ImpactStyle.Light });
          } catch (e) {
            // Ignore
          }
        }
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, pullThreshold, isRefreshing, onRefresh]);

  const indicatorHeight = Math.max(0, pullDistance - pullThreshold);

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          'absolute left-0 right-0 flex items-center justify-center overflow-hidden transition-all duration-200',
          'pointer-events-none'
        )}
        style={{
          height: isPulling || isRefreshing ? `${indicatorHeight}px` : '0px',
          top: isPulling || isRefreshing ? `-${indicatorHeight}px` : '0px',
        }}
      >
        <div className="flex flex-col items-center gap-2">
          {/* Spinner */}
          <div
            className={cn(
              'w-5 h-5 rounded-full border-2 border-nilin-coral border-t-transparent',
              'transition-transform duration-300',
              isRefreshing ? 'animate-spin' : 'opacity-50'
            )}
            style={{
              transform: isRefreshing ? 'rotate(360deg)' : `rotate(${pullDistance * 3}deg)`,
            }}
          />
          <span className="text-xs text-nilin-warmGray font-medium">
            {isRefreshing ? 'Refreshing...' : isPulling ? 'Pull to refresh' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: isPulling ? `translateY(${pullDistance * 0.5}px)` : 'translateY(0)',
        }}
      >
        {children}
      </div>

      {/* Refresh overlay */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-nilin-cream/50 flex items-center justify-center z-10">
          <div className="w-8 h-8 border-3 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default PullToRefresh;
