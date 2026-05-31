import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export function useKeyboard() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // Check if Capacitor is available
    if (!Capacitor.isNativePlatform()) {
      // Web fallback - check visual viewport
      const handleResize = () => {
        const visualViewport = window.visualViewport;
        if (visualViewport) {
          const isOpen = window.innerHeight > visualViewport.height + 100;
          setIsKeyboardVisible(isOpen);
          setKeyboardHeight(isOpen ? window.innerHeight - visualViewport.height : 0);
        }
      };

      window.visualViewport?.addEventListener('resize', handleResize);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
      };
    }

    // For Capacitor, we rely on CSS viewport handling
    // The keyboard plugin will adjust the viewport automatically
    return () => {};
  }, []);

  return { isKeyboardVisible, keyboardHeight };
}
