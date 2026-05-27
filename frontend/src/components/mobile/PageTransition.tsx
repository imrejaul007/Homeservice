import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setIsTransitioning(true);

      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setIsTransitioning(false);
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [location, displayLocation.pathname]);

  return (
    <div
      className="page-transition-container"
      style={{
        opacity: isTransitioning ? 0.7 : 1,
        transform: isTransitioning ? 'translateX(10px)' : 'translateX(0)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out'
      }}
    >
      {children}
    </div>
  );
}
