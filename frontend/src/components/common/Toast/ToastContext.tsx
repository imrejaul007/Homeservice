import React, { createContext, useContext, useState, useCallback } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

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

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a no-op context if not within provider
    return {
      addToast: () => {},
      removeToast: () => {},
      toasts: [],
    };
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
    icon: 'text-green-600',
    progress: 'bg-green-600/40',
  },
  error: {
    container: 'bg-white/80 backdrop-blur-md border border-red-200/50 shadow-[0_8px_30px_rgba(200,139,139,0.15)]',
    icon: 'text-red-600',
    progress: 'bg-red-600/40',
  },
  warning: {
    container: 'bg-white/80 backdrop-blur-md border border-amber-200/50 shadow-[0_8px_30px_rgba(232,196,168,0.2)]',
    icon: 'text-amber-600',
    progress: 'bg-amber-600/40',
  },
  info: {
    container: 'bg-white/80 backdrop-blur-md border border-blue-200/50 shadow-[0_8px_30px_rgba(59,130,246,0.1)]',
    icon: 'text-blue-600',
    progress: 'bg-blue-600/40',
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

  React.useEffect(() => {
    if (duration === 0) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(newProgress);
      if (newProgress <= 0) {
        clearInterval(interval);
      }
    }, 50);

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [duration, onClose]);

  const styles = variantStyles[variant];

  return (
    <ToastPrimitive.Root
      className={`relative overflow-hidden rounded-xl p-4 shadow-lg flex items-start gap-3 transition-all duration-300 data-[state=open]:animate-toast-slide-in data-[state=closed]:animate-toast-fade-out focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/30 ${styles.container}`}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className={styles.icon}>{variantIcons[variant]}</div>
      <div className="flex-1 min-w-0">
        <ToastPrimitive.Title className="font-medium text-nilin-charcoal text-sm">{title}</ToastPrimitive.Title>
        {description && (
          <ToastPrimitive.Description className="mt-1 text-sm text-nilin-warmGray">{description}</ToastPrimitive.Description>
        )}
        {action && (
          <ToastPrimitive.Action asChild altText={action.label} className="mt-2">
            <button onClick={action.onClick} className="text-xs font-medium text-nilin-coral hover:text-nilin-rose transition-colors">
              {action.label}
            </button>
          </ToastPrimitive.Action>
        )}
      </div>
      <ToastPrimitive.Close className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 transition-colors" aria-label="Close" onClick={onClose}>
        <X className="w-4 h-4 text-nilin-warmGray" />
      </ToastPrimitive.Close>
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
          <div className={`h-full transition-all duration-50 ${styles.progress}`} style={{ width: `${progress}%` }} />
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

export const ToastProvider: React.FC<ToastProviderProps> = ({ children, defaultDuration = 5000 }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id, duration: toast.duration ?? defaultDuration }]);
  }, [defaultDuration]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={defaultDuration}>
        {children}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[380px] max-w-[calc(100vw-32px)] outline-none" />
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
