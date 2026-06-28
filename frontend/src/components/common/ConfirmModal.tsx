import React, { useEffect, useRef, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap implementation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    // Focus trap for Tab key
    if (e.key === 'Tab') {
      const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: move to last element if on first
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: move to first element if on last
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }, [isOpen, onCancel]);

  // Handle focus on open and restore on close
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Lock body scroll
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';

      // Focus the cancel button (less destructive action first)
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);

      return () => {
        document.body.style.overflow = originalStyle;
        // Restore focus to previously focused element
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen]);

  // Add keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const buttonStyles = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    default: 'bg-nilin-coral hover:bg-nilin-coral/90 text-white',
  };

  const iconBgColors = {
    danger: 'bg-red-100',
    warning: 'bg-amber-100',
    default: 'bg-nilin-blush',
  };

  const iconColors = {
    danger: 'text-red-600',
    warning: 'text-amber-600',
    default: 'text-nilin-coral',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative glass-nilin-strong rounded-nilin-xl p-6 max-w-md w-full shadow-nilin-lg"
      >
        <div className="text-center">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${iconBgColors[variant]}`}>
            <AlertCircle className={`w-6 h-6 ${iconColors[variant]}`} aria-hidden="true" />
          </div>
          <h3 id="confirm-modal-title" className="text-lg font-serif text-nilin-charcoal mb-2">{title}</h3>
          <p className="text-sm text-nilin-warmGray mb-6">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 rounded-nilin font-medium transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${buttonStyles[variant]} ${
              variant === 'danger' ? 'focus-visible:ring-red-500' :
              variant === 'warning' ? 'focus-visible:ring-amber-500' :
              'focus-visible:ring-nilin-coral'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
