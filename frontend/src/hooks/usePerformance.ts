import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
}

export function usePerformance() {
  const metricsRef = useRef<PerformanceMetrics>({});

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Core Web Vitals
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const metric = entry as PerformanceEntry & {
          processingStart?: number;
          loadTime?: number;
          value?: number;
          delta?: number;
          entries?: PerformanceEntry[];
        };

        // First Contentful Paint
        if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
          metricsRef.current.fcp = entry.startTime;
          if (import.meta.env.DEV) {
            console.log(`[Performance] FCP: ${entry.startTime.toFixed(2)}ms`);
          }
        }

        // Largest Contentful Paint
        if (entry.entryType === 'largest-contentful-paint') {
          metricsRef.current.lcp = entry.startTime;
          if (import.meta.env.DEV) {
            console.log(`[Performance] LCP: ${entry.startTime.toFixed(2)}ms`);
          }
        }

        // First Input Delay
        if (entry.entryType === 'first-input') {
          const fid = metric.processingStart
            ? metric.processingStart - entry.startTime
            : entry.duration;
          metricsRef.current.fid = fid;
          if (import.meta.env.DEV) {
            console.log(`[Performance] FID: ${fid.toFixed(2)}ms`);
          }
        }

        // Cumulative Layout Shift
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          const layoutShift = metric as any;
          if (layoutShift.value !== undefined) {
            metricsRef.current.cls = (metricsRef.current.cls || 0) + layoutShift.value;
            if (import.meta.env.DEV) {
              console.log(`[Performance] CLS: ${metricsRef.current.cls?.toFixed(4)}`);
            }
          }
        }
      }
    });

    // Network timing
    const navObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const nav = entry as PerformanceNavigationTiming;
          metricsRef.current.ttfb = nav.responseStart - nav.requestStart;
          if (import.meta.env.DEV) {
            console.log(`[Performance] TTFB: ${metricsRef.current.ttfb?.toFixed(2)}ms`);
          }
        }
      }
    });

    try {
      // Observe paint entries
      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });

      // Observe navigation timing
      navObserver.observe({ entryTypes: ['navigation'] });

      // Get initial FCP if available
      const fcpEntries = performance.getEntriesByType('paint') as PerformancePaintTiming[];
      const fcp = fcpEntries.find((entry) => entry.name === 'first-contentful-paint');
      if (fcp) {
        metricsRef.current.fcp = fcp.startTime;
      }
    } catch (e) {
      // PerformanceObserver not supported
      if (import.meta.env.DEV) {
        console.warn('[Performance] PerformanceObserver not supported');
      }
    }

    return () => {
      observer.disconnect();
      navObserver.disconnect();
    };
  }, []);

  return metricsRef.current;
}

// Hook to measure render performance
export function useRenderCount(componentName: string) {
  const countRef = useRef(0);

  useEffect(() => {
    countRef.current += 1;
    if (import.meta.env.DEV) {
      console.log(`[Render] ${componentName} rendered ${countRef.current} times`);
    }
  });

  return countRef.current;
}

export default usePerformance;
