import { useEffect, useRef } from 'react';

export const usePullToRefresh = (onRefresh: () => void) => {
  const startY = useRef(0);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) startY.current = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0].clientY;
      if (endY - startY.current > 100) onRefresh();
    };
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh]);
};