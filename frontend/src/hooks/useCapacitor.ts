import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useCapacitor() {
  const [isCapacitor, setIsCapacitor] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    const capacitor = Capacitor.isNativePlatform();
    setIsCapacitor(capacitor);

    if (capacitor) {
      setPlatform(Capacitor.getPlatform());
    }

    // Mobile detection based on screen size and touch capability
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isTouchDevice && isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return { isCapacitor, isMobile, platform };
}

export function useIsMobile() {
  const { isMobile } = useCapacitor();
  return isMobile;
}
