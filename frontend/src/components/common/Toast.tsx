import React, { createContext, useContext, useState, useCallback } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

// =============================================================================
// NILIN Design System - Toast Component
// =============================================================================

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// =============================================================================
// Variant Styles
// =============================================================================

const variantStyles: Record<ToastVariant, { container: string; icon: string; progress: string }> = {
  default: {
    container: 'bg-white border border-gray-200',
    icon: 'text-nilin-coral',
    progress: 'bg-nilin-coral/30',
  },
  success: {
    container: 'bg-white/80 backdrop-blur-md border border-green-200/50 shadow-[0_8px_30px_rgba(123,168,137,0.15)]',
    icon: 'text-nilin-success',
    progress: 'bg-nilin-success/40',
  },
  error: {
    container: 'bg-white/80 backdrop-blur-md border border-red-200/50 shadow-[0_8px_30px_rgba(200,139,139,0.15)]',
    icon: 'text-nilin-error',
    progress: 'bg-nilin-error/40',
  },
  warning: {
    container: 'bg-white/80 backdrop-blur-md border border-amber-200/50 shadow-[0_8px_30px_rgba(232,196,168,0.2)]',
    icon: 'text-nilin-warning',
    progress: 'bg-nilin-warning/40',
  },
  info: {
    container: 'bg-white/80 backdrop-blur-md border border-blue-200/50 shadow-[0_8px_30px_rgba(59,130,246,0.1)]',
    icon: 'text-blue-500',
    progress: 'bg-blue-500/40',
  },
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="w-5 h-5" />,
  success: <CheckCircle className="w-5 h-5" />,
  error: <AlertCircle className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
};

// =============================================================================
// Toast Component
// =============================================================================

interface ToastProps {
  toast: ToastData;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const { title, description, variant = 'default', duration = 5000, action } = toast;
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  // Use refs for timers to ensure proper cleanup
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = React.useRef<number>(Date.now());
  const onCloseRef = React.useRef(onClose);

  // Keep onClose ref updated to avoid stale closures
  onCloseRef.current = onClose;

  React.useEffect(() => {
    // Reset start time when duration changes
    startTimeRef.current = Date.now();

    // Clear any existing timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (duration === 0 || isPaused) return;

    // Calculate remaining time based on current progress
    const remainingTime = (progress / 100) * duration;

    // Set close timer
    timerRef.current = setTimeout(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      onCloseRef.current();
    }, remainingTime);

    // Set progress interval
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(newProgress);

      if (newProgress <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 50);

    // Cleanup function - critical for preventing memory leaks
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [duration, progress, isPaused]);

  // Cleanup on unmount - ensures all timers are cleared when component unmounts
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const styles = variantStyles[variant];

  return (
    <ToastPrimitive.Root
      className={cn(
        'relative overflow-hidden rounded-xl p-4',
        'shadow-nilin-lg',
        'flex items-start gap-3',
        'transition-all duration-300',
        'data-[state=open]:animate-toast-slide-in data-[state=closed]:animate-toast-fade-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/30',
        styles.container
      )}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 mt-0.5', styles.icon)}>
        {variantIcons[variant]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <ToastPrimitive.Title className="font-medium text-nilin-charcoal text-sm">
          {title}
        </ToastPrimitive.Title>
        {description && (
          <ToastPrimitive.Description className="mt-1 text-sm text-nilin-warmGray">
            {description}
          </ToastPrimitive.Description>
        )}
        {action && (
          <ToastPrimitive.Action
            asChild
            altText={action.label}
            className="mt-2"
          >
            <button
              onClick={action.onClick}
              className="text-xs font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
            >
              {action.label}
            </button>
          </ToastPrimitive.Action>
        )}
      </div>

      {/* Close Button */}
      <ToastPrimitive.Close
        className={cn(
          'flex-shrink-0 p-1 rounded-full',
          'hover:bg-gray-100 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/30'
        )}
        aria-label="Close"
        onClick={onClose}
      >
        <X className="w-4 h-4 text-nilin-warmGray" />
      </ToastPrimitive.Close>

      {/* Progress Bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
          <div
            className={cn('h-full transition-all duration-50 ease-linear', styles.progress)}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </ToastPrimitive.Root>
  );
};

// =============================================================================
// Toast Provider
// =============================================================================

interface ToastProviderProps {
  children: React.ReactNode;
  defaultDuration?: number;
}

const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultDuration = 5000,
}) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const recentToastKeysRef = React.useRef<Map<string, number>>(new Map());
  const TOAST_COOLDOWN = 5000;

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const dedupeKey = `${toast.variant ?? 'default'}:${toast.title}:${toast.description ?? ''}`;
    const now = Date.now();
    const lastShown = recentToastKeysRef.current.get(dedupeKey);
    if (lastShown !== undefined && now - lastShown < TOAST_COOLDOWN) {
      return;
    }
    recentToastKeysRef.current.set(dedupeKey, now);

    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => {
      // Cap visible toasts at 3: dismiss oldest first
      const next = [...prev, { ...toast, id, duration: toast.duration ?? defaultDuration }];
      if (next.length > 3) {
        return next.slice(next.length - 3);
      }
      return next;
    });
  }, [defaultDuration]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={defaultDuration}>
        {children}

        {/* Toast Viewport */}
        <ToastPrimitive.Viewport
          className={cn(
            // CRITICAL FIX: z-[9999] ensures toasts appear above all modals, drawers, and overlays
            // Standard modal z-index is 50-100, drawers are 100-200, but we need to be above everything
            'fixed bottom-4 right-4 z-[9999]',
            'flex flex-col gap-2 w-[380px] max-w-[calc(100vw-32px)]',
            'outline-none'
          )}
        />

        {/* Render Toasts */}
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
};

// =============================================================================
// Convenience Hooks
// =============================================================================

const useToastActions = () => {
  const { addToast } = useToast();

  return {
    success: (title: string, description?: string) =>
      addToast({ title, description, variant: 'success' }),
    error: (title: string, description?: string) =>
      addToast({ title, description, variant: 'error' }),
    warning: (title: string, description?: string) =>
      addToast({ title, description, variant: 'warning' }),
    info: (title: string, description?: string) =>
      addToast({ title, description, variant: 'info' }),
    default: (title: string, description?: string) =>
      addToast({ title, description, variant: 'default' }),
    undo: (title: string, action: () => void, description?: string, duration = 8000) =>
      addToast({
        title,
        description,
        variant: 'success',
        duration,
        action: {
          label: 'Undo',
          onClick: action,
        },
      }),
  };
};

// =============================================================================
// Exports
// =============================================================================

export { Toast, ToastProvider, useToast, useToastActions };
