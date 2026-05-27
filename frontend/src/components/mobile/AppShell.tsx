import React, { useEffect, useState } from 'react';
import { useCapacitor } from '../../hooks/useCapacitor';
import { usePerformance } from '../../hooks/usePerformance';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isCapacitor } = useCapacitor();
  const [isReady, setIsReady] = useState(false);

  // Monitor performance metrics
  usePerformance();

  useEffect(() => {
    if (isCapacitor) {
      // Add capacitor-app class to body for CSS targeting
      document.body.classList.add('capacitor-app');

      // Prevent pull-to-refresh gesture
      document.body.style.overscrollBehavior = 'none';

      // Mark as ready after a brief delay for smooth transition
      const timer = setTimeout(() => setIsReady(true), 50);
      return () => {
        clearTimeout(timer);
        document.body.classList.remove('capacitor-app');
      };
    } else {
      setIsReady(true);
    }
  }, [isCapacitor]);

  if (!isReady) {
    return (
      <div
        style={{
          backgroundColor: '#F5E6E0',
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      >
        <div style={{ color: '#E8B4A8', fontSize: '32px', fontWeight: 300, letterSpacing: '0.2em' }}>
          NILIN
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
