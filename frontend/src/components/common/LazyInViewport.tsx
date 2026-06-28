import React, { useEffect, useRef, useState } from 'react';

interface LazyInViewportProps {
  children: React.ReactNode;
  rootMargin?: string;
  minHeight?: string | number;
  className?: string;
}

/**
 * Renders children only after the placeholder enters the viewport.
 */
export const LazyInViewport: React.FC<LazyInViewportProps> = ({
  children,
  rootMargin = '200px',
  minHeight = 1,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return (
    <div ref={ref} className={className} style={{ minHeight }}>
      {visible ? children : null}
    </div>
  );
};

export default LazyInViewport;
