import { useRef, useState, useEffect, useCallback, type RefObject } from 'react';

export interface UseHorizontalCarouselOptions {
  autoScrollInterval?: number;
  gap?: number;
  enabled?: boolean;
}

export interface UseHorizontalCarouselReturn {
  scrollRef: RefObject<HTMLDivElement>;
  scroll: (direction: 'left' | 'right') => void;
  isPaused: boolean;
  prefersReducedMotion: boolean;
  isVisible: boolean;
  pause: () => void;
  resume: () => void;
}

export function useHorizontalCarousel(
  options: UseHorizontalCarouselOptions = {}
): UseHorizontalCarouselReturn {
  const { autoScrollInterval = 4000, gap = 20, enabled = true } = options;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const getScrollStep = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return 320;
    const firstCard = container.querySelector<HTMLElement>('[data-carousel-card]');
    if (firstCard) {
      return firstCard.offsetWidth + gap;
    }
    return 320;
  }, [gap]);

  const scroll = useCallback(
    (direction: 'left' | 'right') => {
      const container = scrollRef.current;
      if (!container) return;

      const step = getScrollStep();
      container.scrollBy({
        left: direction === 'left' ? -step : step,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    },
    [getScrollStep, prefersReducedMotion]
  );

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setPrefersReducedMotion(mediaQuery.matches);
    updateMotion();
    mediaQuery.addEventListener('change', updateMotion);
    return () => mediaQuery.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!enabled || prefersReducedMotion || isPaused || !isVisible) return undefined;

    const interval = setInterval(() => {
      const container = scrollRef.current;
      if (!container || document.hidden) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      const step = getScrollStep();

      if (scrollLeft >= scrollWidth - clientWidth - 10) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, autoScrollInterval);

    return () => clearInterval(interval);
  }, [enabled, prefersReducedMotion, isPaused, isVisible, autoScrollInterval, getScrollStep]);

  return {
    scrollRef,
    scroll,
    isPaused,
    prefersReducedMotion,
    isVisible,
    pause,
    resume,
  };
}
