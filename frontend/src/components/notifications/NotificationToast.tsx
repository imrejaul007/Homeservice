/**
 * Notification Toast Component
 * Real-time toast notifications with auto-dismiss and action buttons
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  Check,
  X,
  Calendar,
  CreditCard,
  Star,
  Gift,
  Settings,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ToastNotification {
  id: string;
  type: 'booking' | 'payment' | 'review' | 'promotion' | 'system' | 'success' | 'error' | 'info';
  title: string;
  message: string;
  duration?: number; // ms, default 5000
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  onDismiss?: (id: string) => void;
}

interface ToastItemProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
  isExiting?: boolean;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, isExiting }) => {
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const duration = toast.duration || 5000;

  // Auto-dismiss timer
  useEffect(() => {
    if (isHovered) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    const startTime = Date.now();
    const remainingProgress = progress;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = remainingProgress - (elapsed / duration) * 100;
      setProgress(Math.max(0, newProgress));

      if (newProgress <= 0) {
        onDismiss(toast.id);
      }
    }, 50);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [toast.id, duration, onDismiss, isHovered, progress]);

  // Get type styling
  const getTypeStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          iconBg: 'bg-green-100 text-green-600',
          progress: 'bg-green-500',
          icon: <Check className="w-5 h-5" />,
        };
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          iconBg: 'bg-red-100 text-red-600',
          progress: 'bg-red-500',
          icon: <AlertCircle className="w-5 h-5" />,
        };
      case 'info':
        return {
          bg: 'bg-blue-50 border-blue-200',
          iconBg: 'bg-blue-100 text-blue-600',
          progress: 'bg-blue-500',
          icon: <Bell className="w-5 h-5" />,
        };
      case 'booking':
        return {
          bg: 'bg-blue-50 border-blue-200',
          iconBg: 'bg-blue-100 text-blue-600',
          progress: 'bg-blue-500',
          icon: <Calendar className="w-5 h-5" />,
        };
      case 'payment':
        return {
          bg: 'bg-green-50 border-green-200',
          iconBg: 'bg-green-100 text-green-600',
          progress: 'bg-green-500',
          icon: <CreditCard className="w-5 h-5" />,
        };
      case 'review':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          iconBg: 'bg-yellow-100 text-yellow-600',
          progress: 'bg-yellow-500',
          icon: <Star className="w-5 h-5" />,
        };
      case 'promotion':
        return {
          bg: 'bg-purple-50 border-purple-200',
          iconBg: 'bg-purple-100 text-purple-600',
          progress: 'bg-purple-500',
          icon: <Gift className="w-5 h-5" />,
        };
      case 'system':
      default:
        return {
          bg: 'bg-white border-gray-200',
          iconBg: 'bg-gray-100 text-gray-600',
          progress: 'bg-[#E8B4A8]',
          icon: <Bell className="w-5 h-5" />,
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className={cn(
        'relative w-80 overflow-hidden rounded-lg border shadow-lg transition-all duration-300',
        styles.bg,
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Progress bar */}
      <div
        className={cn('absolute bottom-0 left-0 h-1 transition-all duration-100', styles.progress)}
        style={{ width: `${progress}%` }}
      />

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', styles.iconBg)}>
            {toast.icon || styles.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 text-sm">{toast.title}</h4>
            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{toast.message}</p>

            {/* Action Button */}
            {toast.action && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast.action?.onClick();
                  onDismiss(toast.id);
                }}
                className={cn(
                  'mt-2 flex items-center gap-1 text-sm font-medium transition-colors',
                  'text-[#E8B4A8] hover:text-[#D4A5A5]'
                )}
              >
                {toast.action.label}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 hover:bg-black/5 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
  maxToasts?: number;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position = 'top-right',
  maxToasts = 5,
}) => {
  const visibleToasts = toasts.slice(0, maxToasts);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 -translate-x-1/2';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-center':
        return 'bottom-4 left-1/2 -translate-x-1/2';
      case 'top-right':
      default:
        return 'top-4 right-4';
    }
  };

  return (
    <div
      className={cn(
        'fixed z-[100] flex flex-col gap-2',
        getPositionClasses()
      )}
      style={{ maxHeight: 'calc(100vh - 2rem)' }}
    >
      {visibleToasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

// Toast hook for easy usage
interface UseToastReturn {
  toasts: ToastNotification[];
  addToast: (toast: Omit<ToastNotification, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToast = (defaultDuration?: number): UseToastReturn => {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback((toast: Omit<ToastNotification, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastNotification = {
      ...toast,
      id,
      duration: toast.duration || defaultDuration || 5000,
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, [defaultDuration]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return { toasts, addToast, removeToast, clearAll };
};

// Export a global toast instance for app-wide usage
export const createToastStore = () => {
  let toasts: ToastNotification[] = [];
  let listeners: ((toasts: ToastNotification[]) => void)[] = [];

  const subscribe = (listener: (toasts: ToastNotification[]) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  };

  const notify = () => {
    listeners.forEach(l => l([...toasts]));
  };

  return {
    getToasts: () => toasts,
    addToast: (toast: Omit<ToastNotification, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastNotification = {
        ...toast,
        id,
        duration: toast.duration || 5000,
      };
      toasts = [...toasts, newToast];
      notify();

      // Auto-remove after duration
      setTimeout(() => {
        toasts = toasts.filter(t => t.id !== id);
        notify();
        toast.onDismiss?.(id);
      }, newToast.duration);

      return id;
    },
    removeToast: (id: string) => {
      toasts = toasts.filter(t => t.id !== id);
      notify();
    },
    clearAll: () => {
      toasts = [];
      notify();
    },
    subscribe,
  };
};

// Global toast instance
export const toast = createToastStore();

export default ToastContainer;
