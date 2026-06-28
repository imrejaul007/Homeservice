/**
 * BulkActionToolbar - Reusable bulk action toolbar for admin pages
 *
 * Provides a floating toolbar for bulk actions when items are selected,
 * with support for custom actions, loading states, and confirmation dialogs.
 *
 * @example
 * ```tsx
 * const actions: BulkAction[] = [
 *   { id: 'activate', label: 'Activate', icon: <CheckCircle />, variant: 'success' },
 *   { id: 'deactivate', label: 'Deactivate', icon: <Ban />, variant: 'warning' },
 *   { id: 'delete', label: 'Delete', icon: <Trash />, variant: 'danger', requiresConfirm: true },
 * ];
 *
 * <BulkActionToolbar
 *   selectedItems={selectedCustomers}
 *   totalCount={totalCustomers}
 *   entityName="customers"
 *   actions={actions}
 *   onAction={handleBulkAction}
 *   onClear={clearSelection}
 * />
 * ```
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import {
  X,
  CheckCircle,
  Ban,
  Trash2,
  Download,
  Loader2,
  AlertTriangle,
  Check,
} from 'lucide-react';

// ============================================
// Types
// ============================================

export interface BulkAction {
  /** Unique identifier for the action */
  id: string;
  /** Display label for the button */
  label: string;
  /** Icon component to display */
  icon: React.ReactNode;
  /** Visual variant of the button */
  variant?: 'default' | 'success' | 'warning' | 'danger';
  /** Whether this action requires a confirmation dialog */
  requiresConfirm?: boolean;
  /** Confirmation dialog title (defaults to action label) */
  confirmTitle?: string;
  /** Confirmation dialog description */
  confirmDescription?: string;
  /** Whether this action is disabled */
  disabled?: boolean;
  /** Loading state for this specific action */
  loading?: boolean;
}

export interface BulkActionToolbarProps {
  /** Currently selected items */
  selectedItems: any[];
  /** Total count of items in the list */
  totalCount?: number;
  /** Name of the entity being managed (e.g., "customers", "providers") */
  entityName: string;
  /** Available actions */
  actions: BulkAction[];
  /** Callback when an action is executed */
  onAction: (actionId: string, selectedIds: string[], items: any[]) => Promise<void> | void;
  /** Callback when selection should be cleared */
  onClear: () => void;
  /** Optional className for the container */
  className?: string;
  /** Whether the toolbar should be visible */
  visible?: boolean;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Custom ID extractor function */
  getItemId?: (item: any) => string;
  /** Auto-hide toolbar after successful action */
  hideOnSuccess?: boolean;
}

// ============================================
// Confirmation Dialog Component
// ============================================

interface ConfirmDialogProps {
  action: BulkAction;
  selectedCount: number;
  entityName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  action,
  selectedCount,
  entityName,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const isDanger = action.variant === 'danger';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div
        className={cn(
          'bg-white rounded-2xl w-full max-w-md shadow-2xl animate-scale-in',
          isDanger && 'border-t-4 border-red-500'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                isDanger ? 'bg-red-100' : 'bg-amber-100'
              )}
            >
              {isDanger ? (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              <h3
                id="confirm-dialog-title"
                className="text-lg font-semibold text-gray-900"
              >
                {action.confirmTitle || `Confirm ${action.label}`}
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                {action.confirmDescription ||
                  `Are you sure you want to ${action.label.toLowerCase()} ${selectedCount} ${entityName}?`}
              </p>
              {isDanger && (
                <p className="text-sm text-red-600 mt-2 font-medium">
                  This action cannot be undone.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-6 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex-1 px-4 py-2.5 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-2',
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : action.variant === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : action.variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-nilin-coral hover:bg-nilin-rose'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {action.label}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Success Animation Component
// ============================================

interface SuccessAnimationProps {
  count: number;
  action: string;
  onComplete: () => void;
}

const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  count,
  action,
  onComplete,
}) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 shadow-2xl animate-scale-in text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center animate-bounce-in">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <p className="text-lg font-semibold text-gray-900">
          {count} {count === 1 ? 'item' : 'items'} {action.toLowerCase()} successfully
        </p>
      </div>
    </div>
  );
};

// ============================================
// Default Actions Factory
// ============================================

export const createDefaultBulkActions = (): BulkAction[] => [
  {
    id: 'activate',
    label: 'Activate',
    icon: <CheckCircle className="w-4 h-4" />,
    variant: 'success',
  },
  {
    id: 'deactivate',
    label: 'Deactivate',
    icon: <Ban className="w-4 h-4" />,
    variant: 'warning',
  },
  {
    id: 'export',
    label: 'Export',
    icon: <Download className="w-4 h-4" />,
    variant: 'default',
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="w-4 h-4" />,
    variant: 'danger',
    requiresConfirm: true,
    confirmTitle: 'Confirm Deletion',
    confirmDescription:
      'Are you sure you want to delete the selected items? This action cannot be undone.',
  },
];

// ============================================
// Main Component
// ============================================

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedItems,
  totalCount,
  entityName,
  actions,
  onAction,
  onClear,
  className,
  visible,
  onVisibilityChange,
  getItemId = (item: any) => item._id || item.id,
  hideOnSuccess = true,
}) => {
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const [successState, setSuccessState] = useState<{
    count: number;
    action: string;
  } | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Calculate derived state
  const selectedCount = selectedItems.length;
  const hasSelection = selectedCount > 0;
  const selectedIds = useMemo(
    () => selectedItems.map(getItemId).filter(Boolean),
    [selectedItems, getItemId]
  );

  // Handle visibility changes
  useEffect(() => {
    if (visible !== undefined && onVisibilityChange) {
      onVisibilityChange(hasSelection);
    }
  }, [hasSelection, visible, onVisibilityChange]);

  // Don't render if no selection (unless explicitly controlled)
  const shouldRender = visible !== undefined ? visible && hasSelection : hasSelection;
  if (!shouldRender) return null;

  // Get button styles based on variant
  const getButtonStyles = useCallback(
    (variant?: BulkAction['variant']) => {
      const base =
        'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

      switch (variant) {
        case 'success':
          return cn(
            base,
            'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500'
          );
        case 'warning':
          return cn(
            base,
            'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500'
          );
        case 'danger':
          return cn(
            base,
            'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500'
          );
        default:
          return cn(
            base,
            'bg-nilin-coral text-white hover:bg-nilin-rose focus-visible:ring-nilin-coral'
          );
      }
    },
    []
  );

  // Handle action execution
  const handleAction = useCallback(
    async (action: BulkAction) => {
      // Check if action requires confirmation
      if (action.requiresConfirm) {
        setConfirmAction(action);
        return;
      }

      // Execute the action with progress tracking
      setLoadingActionId(action.id);
      setProgress({ current: 0, total: selectedCount });
      try {
        await onAction(action.id, selectedIds, selectedItems);
        setProgress({ current: selectedCount, total: selectedCount });
        toast.success(`${selectedCount} ${entityName} ${action.label.toLowerCase()}ed successfully`);

        if (hideOnSuccess) {
          setSuccessState({ count: selectedCount, action: action.label });
        }
      } catch (error) {
        // Check for partial success (error contains successCount)
        const partialSuccess = (error as { successCount?: number })?.successCount;
        const failedCount = (error as { failedCount?: number })?.failedCount;

        if (partialSuccess !== undefined && failedCount !== undefined) {
          setProgress({ current: partialSuccess, total: selectedCount });
          if (partialSuccess > 0) {
            toast.success(`${partialSuccess} ${entityName} ${action.label.toLowerCase()}ed successfully`);
          }
          if (failedCount > 0) {
            toast.error(`${failedCount} ${entityName} failed to ${action.label.toLowerCase()}`);
          }
        } else {
          toast.error(
            error instanceof Error
              ? error.message
              : `Failed to ${action.label.toLowerCase()} ${entityName}`
          );
        }
      } finally {
        setLoadingActionId(null);
        setProgress(null);
      }
    },
    [selectedIds, selectedItems, selectedCount, entityName, onAction, hideOnSuccess]
  );

  // Handle confirmed action
  const handleConfirm = useCallback(async () => {
    if (!confirmAction) return;

    setLoadingActionId(confirmAction.id);
    setConfirmAction(null);
    setProgress({ current: 0, total: selectedCount });

    try {
      await onAction(confirmAction.id, selectedIds, selectedItems);
      setProgress({ current: selectedCount, total: selectedCount });
      toast.success(
        `${selectedCount} ${entityName} ${confirmAction.label.toLowerCase()}ed successfully`
      );

      if (hideOnSuccess) {
        setSuccessState({ count: selectedCount, action: confirmAction.label });
      }
    } catch (error) {
      // Check for partial success (error contains successCount)
      const partialSuccess = (error as { successCount?: number })?.successCount;
      const failedCount = (error as { failedCount?: number })?.failedCount;

      if (partialSuccess !== undefined && failedCount !== undefined) {
        setProgress({ current: partialSuccess, total: selectedCount });
        if (partialSuccess > 0) {
          toast.success(`${partialSuccess} ${entityName} ${confirmAction.label.toLowerCase()}ed successfully`);
        }
        if (failedCount > 0) {
          toast.error(`${failedCount} ${entityName} failed to ${confirmAction.label.toLowerCase()}`);
        }
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to ${confirmAction.label.toLowerCase()} ${entityName}`
        );
      }
    } finally {
      setLoadingActionId(null);
      setProgress(null);
    }
  }, [confirmAction, selectedIds, selectedItems, selectedCount, entityName, onAction, hideOnSuccess]);

  // Handle clear selection
  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

  // Handle success animation complete
  const handleSuccessComplete = useCallback(() => {
    setSuccessState(null);
    onClear();
  }, [onClear]);

  return (
    <>
      {/* Main Toolbar */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up',
          'bg-white rounded-2xl shadow-2xl border border-gray-200',
          'flex items-center gap-4 px-4 py-3',
          'min-w-[400px] max-w-[90vw]',
          className
        )}
        role="toolbar"
        aria-label={`Bulk actions for ${entityName}`}
      >
        {/* Selection Count */}
        <div className="flex items-center gap-3 pr-4 border-r border-gray-200">
          <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
            <span className="text-lg font-bold text-nilin-coral">{selectedCount}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {selectedCount === 1 ? 'item' : 'items'} selected
            </p>
            {totalCount !== undefined && (
              <p className="text-xs text-gray-500">
                of {totalCount.toLocaleString()} total
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-1">
          {actions.map((action) => {
            const isLoading = loadingActionId === action.id || action.loading;
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                disabled={isLoading || action.disabled}
                className={getButtonStyles(action.variant)}
                aria-label={`${action.label} ${selectedCount} ${entityName}`}
                title={action.label}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  action.icon
                )}
                <span className="hidden sm:inline">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Clear Selection */}
        <button
          onClick={handleClear}
          className={cn(
            'w-10 h-10 flex items-center justify-center rounded-xl',
            'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
            'transition-colors focus:outline-none focus-visible:ring-2',
            'focus-visible:ring-nilin-coral focus-visible:ring-offset-2'
          )}
          aria-label="Clear selection"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          action={confirmAction}
          selectedCount={selectedCount}
          entityName={entityName}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
          loading={loadingActionId === confirmAction.id}
        />
      )}

      {/* Success Animation */}
      {successState && (
        <SuccessAnimation
          count={successState.count}
          action={successState.action}
          onComplete={handleSuccessComplete}
        />
      )}
    </>
  );
};

// ============================================
// Compact Toolbar Variant
// ============================================

export interface CompactBulkToolbarProps {
  selectedCount: number;
  totalCount?: number;
  entityName: string;
  actions: BulkAction[];
  onAction: (actionId: string) => void;
  onClear: () => void;
  className?: string;
}

export const CompactBulkToolbar: React.FC<CompactBulkToolbarProps> = ({
  selectedCount,
  totalCount,
  entityName,
  actions,
  onAction,
  onClear,
  className,
}) => {
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  if (selectedCount === 0) return null;

  const getButtonStyles = (variant?: BulkAction['variant']) => {
    const base =
      'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50';

    switch (variant) {
      case 'success':
        return cn(base, 'bg-emerald-600 text-white hover:bg-emerald-700');
      case 'warning':
        return cn(base, 'bg-amber-600 text-white hover:bg-amber-700');
      case 'danger':
        return cn(base, 'bg-red-600 text-white hover:bg-red-700');
      default:
        return cn(base, 'bg-nilin-coral text-white hover:bg-nilin-rose');
    }
  };

  return (
    <div
      className={cn(
        'bg-nilin-coral/5 border border-nilin-coral/20 rounded-xl p-3',
        'flex items-center justify-between gap-4',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-nilin-charcoal">
          <span className="text-nilin-coral font-bold">{selectedCount}</span>{' '}
          {entityName} selected
        </span>
        {totalCount !== undefined && (
          <span className="text-xs text-nilin-warmGray">
            (of {totalCount.toLocaleString()})
          </span>
        )}
        <button
          onClick={onClear}
          className="text-xs text-nilin-coral hover:underline ml-2"
        >
          Clear
        </button>
      </div>
      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            disabled={loadingActionId === action.id}
            className={getButtonStyles(action.variant)}
          >
            {loadingActionId === action.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              action.icon
            )}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================
// Inline Selection Header Component
// ============================================

export interface SelectionHeaderProps {
  selectedCount: number;
  totalVisible: number;
  onSelectAll: () => void;
  onClear: () => void;
  className?: string;
}

export const SelectionHeader: React.FC<SelectionHeaderProps> = ({
  selectedCount,
  totalVisible,
  onSelectAll,
  onClear,
  className,
}) => {
  const isAllSelected = selectedCount === totalVisible && totalVisible > 0;

  return (
    <div className={cn('flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200', className)}>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isAllSelected}
          ref={(el) => {
            if (el) el.indeterminate = selectedCount > 0 && selectedCount < totalVisible;
          }}
          onChange={onSelectAll}
          className="w-4 h-4 text-nilin-coral rounded border-gray-300 focus:ring-nilin-coral"
        />
        <span className="text-sm text-gray-600">
          {isAllSelected
            ? 'Deselect all'
            : selectedCount > 0
            ? `Select all (${totalVisible})`
            : 'Select all on this page'}
        </span>
      </label>
      {selectedCount > 0 && (
        <span className="text-xs text-gray-400">
          {selectedCount} of {totalVisible} selected
        </span>
      )}
    </div>
  );
};
