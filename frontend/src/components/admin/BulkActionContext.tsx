/**
 * BulkActionContext - Context provider for bulk selection state
 *
 * Provides a shared state management for bulk selection across admin pages,
 * enabling consistent behavior for selecting/deselecting items.
 *
 * @example
 * ```tsx
 * // Wrap your component with the provider
 * <BulkActionProvider entityType="customers">
 *   <CustomerManagement />
 * </BulkActionProvider>
 *
 * // Or use the hook directly
 * const { selectedIds, toggleSelection, selectAll, clearSelection } = useBulkSelection();
 * ```
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';

// ============================================
// Types
// ============================================

export interface BulkActionContextValue {
  /** Currently selected item IDs */
  selectedIds: Set<string>;
  /** Number of selected items */
  selectedCount: number;
  /** Whether any items are selected */
  hasSelection: boolean;
  /** Check if a specific item is selected */
  isSelected: (id: string) => boolean;
  /** Toggle selection for a single item */
  toggleSelection: (id: string) => void;
  /** Select a single item */
  selectItem: (id: string) => void;
  /** Deselect a single item */
  deselectItem: (id: string) => void;
  /** Select all items from a list */
  selectAll: (ids: string[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Replace all selected items with a new set */
  setSelection: (ids: string[]) => void;
  /** Toggle select all - selects all if none selected, deselects all if some/all selected */
  toggleSelectAll: (allIds: string[]) => void;
}

interface BulkActionProviderProps {
  children: React.ReactNode;
  /** Entity type for accessibility labels */
  entityType?: string;
  /** Initial selected IDs */
  initialSelected?: string[];
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

interface BulkActionProviderState {
  selectedIds: Set<string>;
}

// ============================================
// Context
// ============================================

const BulkActionContext = createContext<BulkActionContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

export const BulkActionProvider: React.FC<BulkActionProviderProps> = ({
  children,
  entityType = 'items',
  initialSelected = [],
  onSelectionChange,
}) => {
  const [selectedIds, setSelectedIds] = useState<BulkActionProviderState['selectedIds']>(
    new Set(initialSelected)
  );

  // Track previous selected count for change detection
  const prevSelectedRef = useRef(selectedIds.size);

  // Notify parent of selection changes (debounced)
  const notifySelectionChange = useCallback((newSelection: Set<string>) => {
    if (prevSelectedRef.current !== newSelection.size) {
      prevSelectedRef.current = newSelection.size;
      onSelectionChange?.(newSelection);
    }
  }, [onSelectionChange]);

  const isSelected = useCallback(
    (id: string): boolean => {
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  const toggleSelection = useCallback(
    (id: string): void => {
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        notifySelectionChange(newSet);
        return newSet;
      });
    },
    [notifySelectionChange]
  );

  const selectItem = useCallback(
    (id: string): void => {
      setSelectedIds((prev) => {
        if (prev.has(id)) return prev;
        const newSet = new Set(prev);
        newSet.add(id);
        notifySelectionChange(newSet);
        return newSet;
      });
    },
    [notifySelectionChange]
  );

  const deselectItem = useCallback(
    (id: string): void => {
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const newSet = new Set(prev);
        newSet.delete(id);
        notifySelectionChange(newSet);
        return newSet;
      });
    },
    [notifySelectionChange]
  );

  const selectAll = useCallback(
    (ids: string[]): void => {
      setSelectedIds((prev) => {
        const newSet = new Set([...prev, ...ids]);
        notifySelectionChange(newSet);
        return newSet;
      });
    },
    [notifySelectionChange]
  );

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set());
    notifySelectionChange(new Set());
  }, [notifySelectionChange]);

  const setSelection = useCallback(
    (ids: string[]): void => {
      setSelectedIds(new Set(ids));
      notifySelectionChange(new Set(ids));
    },
    [notifySelectionChange]
  );

  const toggleSelectAll = useCallback(
    (allIds: string[]): void => {
      setSelectedIds((prev) => {
        let newSet: Set<string>;
        if (prev.size === allIds.length && allIds.every((id) => prev.has(id))) {
          // All selected - deselect all
          newSet = new Set();
        } else {
          // Not all selected - select all
          newSet = new Set(allIds);
        }
        notifySelectionChange(newSet);
        return newSet;
      });
    },
    [notifySelectionChange]
  );

  const value = useMemo<BulkActionContextValue>(
    () => ({
      selectedIds,
      selectedCount: selectedIds.size,
      hasSelection: selectedIds.size > 0,
      isSelected,
      toggleSelection,
      selectItem,
      deselectItem,
      selectAll,
      clearSelection,
      setSelection,
      toggleSelectAll,
    }),
    [
      selectedIds,
      isSelected,
      toggleSelection,
      selectItem,
      deselectItem,
      selectAll,
      clearSelection,
      setSelection,
      toggleSelectAll,
    ]
  );

  return (
    <BulkActionContext.Provider value={value}>
      {children}
    </BulkActionContext.Provider>
  );
};

// ============================================
// Hook
// ============================================

/**
 * Hook to access bulk selection context
 *
 * @returns Bulk selection context value
 * @throws Error if used outside of BulkActionProvider
 *
 * @example
 * ```tsx
 * const { selectedIds, toggleSelection, clearSelection } = useBulkSelection();
 * ```
 */
export const useBulkSelection = (): BulkActionContextValue => {
  const context = useContext(BulkActionContext);
  if (!context) {
    throw new Error('useBulkSelection must be used within a BulkActionProvider');
  }
  return context;
};

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook for managing selection state with a list of items
 * Use this when you need selection tied to a specific data list
 *
 * @param getId - Function to extract ID from an item
 * @param items - Current list of items
 * @returns Selection helpers for use with BulkActionToolbar
 *
 * @example
 * ```tsx
 * const { selectedIds, toggleItem, selectAll, clearSelection, isAllSelected } = useBulkSelectionWithItems(
 *   (customer) => customer.id,
 *   customers
 * );
 * ```
 */
export function useBulkSelectionWithItems<T>(
  getId: (item: T) => string,
  items: T[]
): {
  selectedIds: Set<string>;
  selectedCount: number;
  hasSelection: boolean;
  toggleItem: (item: T) => void;
  isItemSelected: (item: T) => boolean;
  selectAllItems: () => void;
  clearSelection: () => void;
  toggleSelectAll: () => void;
  isAllSelected: boolean;
} {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allIds = useMemo(() => items.map(getId), [items, getId]);
  const selectedCount = selectedIds.size;
  const hasSelection = selectedIds.size > 0;
  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  const isItemSelected = useCallback(
    (item: T): boolean => selectedIds.has(getId(item)),
    [selectedIds, getId]
  );

  const toggleItem = useCallback(
    (item: T): void => {
      const id = getId(item);
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    },
    [getId]
  );

  const selectAllItems = useCallback((): void => {
    setSelectedIds(new Set(allIds));
  }, [allIds]);

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback((): void => {
    setSelectedIds((prev) => {
      if (prev.size === items.length && items.every((item) => prev.has(getId(item)))) {
        return new Set();
      }
      return new Set(allIds);
    });
  }, [items, allIds, getId]);

  return {
    selectedIds,
    selectedCount,
    hasSelection,
    toggleItem,
    isItemSelected,
    selectAllItems,
    clearSelection,
    toggleSelectAll,
    isAllSelected,
  };
}
