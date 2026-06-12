import { useCallback, useEffect, useRef } from 'react';

interface UseSearchKeyboardOptions {
  onOpen?: () => void;
  onClose?: () => void;
  onSubmit?: (query: string) => void;
  isOpen?: boolean;
}

interface KeyboardItem {
  type: string;
  id: string;
  label: string;
}

/**
 * Custom hook for search keyboard navigation
 * Provides ↑↓ arrow navigation, Enter to select, Escape to close
 * Global "/" shortcut to open search
 */
export function useSearchKeyboard({
  onOpen,
  onClose,
  onSubmit,
  isOpen = false,
}: UseSearchKeyboardOptions = {}) {
  const itemsRef = useRef<KeyboardItem[]>([]);
  const selectedIndexRef = useRef(-1);

  // Update items array
  const setItems = useCallback((items: KeyboardItem[]) => {
    itemsRef.current = items;
  }, []);

  // Select next item
  const selectNext = useCallback(() => {
    if (itemsRef.current.length === 0) return;
    selectedIndexRef.current = (selectedIndexRef.current + 1) % itemsRef.current.length;
    return selectedIndexRef.current;
  }, []);

  // Select previous item
  const selectPrevious = useCallback(() => {
    if (itemsRef.current.length === 0) return;
    selectedIndexRef.current = selectedIndexRef.current <= 0
      ? itemsRef.current.length - 1
      : selectedIndexRef.current - 1;
    return selectedIndexRef.current;
  }, []);

  // Get current selected index
  const getSelectedIndex = useCallback(() => {
    return selectedIndexRef.current;
  }, []);

  // Reset selection
  const resetSelection = useCallback(() => {
    selectedIndexRef.current = -1;
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent): boolean => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        return selectNext() !== undefined;

      case 'ArrowUp':
        e.preventDefault();
        return selectPrevious() !== undefined;

      case 'Enter':
        if (selectedIndexRef.current >= 0 && selectedIndexRef.current < itemsRef.current.length) {
          e.preventDefault();
          const item = itemsRef.current[selectedIndexRef.current];
          return true; // Signal that Enter was pressed on an item
        }
        return false;

      case 'Escape':
        e.preventDefault();
        onClose?.();
        return true;

      case '/':
        if (!['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
          e.preventDefault();
          onOpen?.();
          return true;
        }
        return false;

      default:
        return false;
    }
  }, [selectNext, selectPrevious, onClose, onOpen]);

  // Global keyboard listener for "/" shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only trigger "/" shortcut when not in an input field
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) &&
        !isOpen
      ) {
        e.preventDefault();
        onOpen?.();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onOpen, isOpen]);

  return {
    setItems,
    selectNext,
    selectPrevious,
    getSelectedIndex,
    resetSelection,
    handleKeyDown,
    selectedIndex: selectedIndexRef.current,
  };
}

/**
 * Hook for managing search modal open/close state
 * with keyboard support
 */
export function useSearchModal() {
  const isOpenRef = useRef(false);
  const triggerRef = useRef<(() => void) | null>(null);

  const open = useCallback(() => {
    isOpenRef.current = true;
    triggerRef.current?.();
  }, []);

  const close = useCallback(() => {
    isOpenRef.current = false;
  }, []);

  const toggle = useCallback(() => {
    if (isOpenRef.current) {
      close();
    } else {
      open();
    }
  }, [open, close]);

  return {
    isOpen: isOpenRef.current,
    open,
    close,
    toggle,
    trigger: (fn: () => void) => {
      triggerRef.current = fn;
    },
  };
}

export default useSearchKeyboard;