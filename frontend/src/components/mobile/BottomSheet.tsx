import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

// =============================================================================
// NILIN Design System - Mobile Bottom Sheet Component
// =============================================================================

export interface BottomSheetProps {
  /** Controlled open state */
  isOpen: boolean;
  /** Callback when sheet should close */
  onClose: () => void;
  /** Sheet title text */
  title?: React.ReactNode;
  /** Sheet content */
  children?: React.ReactNode;
  /** Footer content (actions) */
  footer?: React.ReactNode;
  /** Prevent closing on backdrop click */
  preventClose?: boolean;
  /** Show close button in header */
  showCloseButton?: boolean;
  /** Custom className for the sheet */
  className?: string;
  /** Custom className for the overlay */
  overlayClassName?: string;
  /** Maximum height percentage of viewport */
  maxHeight?: number;
  /** Enable drag to dismiss */
  draggable?: boolean;
  /** Snap points for drag (in pixels from bottom) */
  snapPoints?: number[];
}

// =============================================================================
// Animation Keyframes (injected into document)
// =============================================================================

const injectBottomSheetStyles = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('bottom-sheet-styles')) return;

  const styleSheet = document.createElement('style');
  styleSheet.id = 'bottom-sheet-styles';
  styleSheet.textContent = `
    @keyframes nilin-sheet-slide-up {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes nilin-sheet-slide-down {
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(100%);
        opacity: 0;
      }
    }

    @keyframes nilin-sheet-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes nilin-sheet-fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    .nilin-sheet-overlay-enter {
      animation: nilin-sheet-fade-in 0.2s ease-out forwards;
    }

    .nilin-sheet-overlay-exit {
      animation: nilin-sheet-fade-out 0.15s ease-in forwards;
    }

    .nilin-sheet-content-enter {
      animation: nilin-sheet-slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    }

    .nilin-sheet-content-exit {
      animation: nilin-sheet-slide-down 0.25s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    }

    /* Prevent body scroll when sheet is open */
    body.sheet-open {
      overflow: hidden;
      position: fixed;
      width: 100%;
    }
  `;
  document.head.appendChild(styleSheet);
};

// =============================================================================
// Drag Handle Component
// =============================================================================

interface DragHandleProps {
  onDragStart?: () => void;
  onDrag?: (deltaY: number) => void;
  onDragEnd?: (velocity: number) => void;
  disabled?: boolean;
}

const DragHandle: React.FC<DragHandleProps> = ({
  onDragStart,
  onDrag,
  onDragEnd,
  disabled = false,
}) => {
  const dragRef = useRef<{ startY: number; currentY: number }>({
    startY: 0,
    currentY: 0,
  });
  const velocityRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      dragRef.current = { startY: touch.clientY, currentY: touch.clientY };
      lastUpdateRef.current = Date.now();
      onDragStart?.();
    },
    [disabled, onDragStart]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      const currentY = touch.clientY;
      const deltaY = currentY - dragRef.current.startY;

      // Calculate velocity
      const now = Date.now();
      const dt = now - lastUpdateRef.current;
      if (dt > 0) {
        velocityRef.current = (currentY - dragRef.current.currentY) / dt;
      }
      lastUpdateRef.current = now;
      dragRef.current.currentY = currentY;

      // Only drag down (positive delta)
      if (deltaY > 0) {
        onDrag?.(deltaY);
      }
    },
    [disabled, onDrag]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    onDragEnd?.(velocityRef.current);
  }, [disabled, onDragEnd]);

  if (disabled) return null;

  return (
    <div
      className={cn(
        'w-full h-8 flex items-center justify-center',
        'touch-none select-none cursor-grab active:cursor-grabbing'
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="slider"
      aria-label="Drag to resize"
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Drag Handle Bar */}
      <div
        className={cn(
          'w-10 h-1 rounded-full',
          'bg-[#E8E4E0]',
          'transition-colors duration-200',
          'group-hover:bg-[#D4A89A]'
        )}
      />
    </div>
  );
};

// =============================================================================
// Bottom Sheet Overlay
// =============================================================================

interface BottomSheetOverlayProps {
  isVisible: boolean;
  onClick?: () => void;
  className?: string;
}

const BottomSheetOverlay: React.FC<BottomSheetOverlayProps> = ({
  isVisible,
  onClick,
  className,
}) => (
  <div
    className={cn(
      'fixed inset-0 z-40',
      'bg-nilin-charcoal/40 backdrop-blur-sm',
      'transition-opacity duration-200',
      isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      className
    )}
    onClick={onClick}
    aria-hidden="true"
  />
);

// =============================================================================
// Bottom Sheet Content
// =============================================================================

interface BottomSheetContentProps {
  isVisible: boolean;
  isExiting: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  title?: React.ReactNode;
  showCloseButton?: boolean;
  onClose: () => void;
  maxHeight?: number;
  dragOffset?: number;
  className?: string;
}

const BottomSheetContent: React.FC<BottomSheetContentProps> = ({
  isVisible,
  isExiting,
  children,
  footer,
  title,
  showCloseButton = true,
  onClose,
  maxHeight = 90,
  dragOffset = 0,
  className,
}) => {
  const translateY = Math.max(0, dragOffset);

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-50',
        'bg-white',
        'rounded-t-nilin-xl',
        'shadow-nilin-lg',
        'transition-all duration-300 ease-out',
        isExiting
          ? 'nilin-sheet-content-exit'
          : isVisible
          ? 'nilin-sheet-content-enter'
          : 'opacity-0 pointer-events-none translate-y-full',
        className
      )}
      style={{
        bottom: 0,
        maxHeight: `${maxHeight}vh`,
        transform: `translateY(${translateY}px)`,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'bottom-sheet-title' : undefined}
    >
      {/* Drag Handle */}
      <DragHandle />

      {/* Header */}
      {(title || showCloseButton) && (
        <div className="px-5 pb-3 flex items-center justify-between">
          {title && (
            <h2
              id="bottom-sheet-title"
              className="text-lg font-semibold text-nilin-charcoal font-serif"
            >
              {title}
            </h2>
          )}
          {showCloseButton && (
            <button
              onClick={onClose}
              className={cn(
                'ml-auto p-2 rounded-full',
                'text-nilin-warmGray hover:text-nilin-charcoal',
                'hover:bg-nilin-muted',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/30'
              )}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div
        className="px-5 overflow-y-auto"
        style={{
          maxHeight: footer ? 'calc(90vh - 140px)' : 'calc(90vh - 80px)',
        }}
      >
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div
          className={cn(
            'px-5 py-4 border-t border-[#E8E4E0]',
            'bg-nilin-cream/50',
            'safe-area-pb'
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Bottom Sheet Component
// =============================================================================

const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  preventClose = false,
  showCloseButton = true,
  className,
  overlayClassName,
  maxHeight = 90,
  draggable = true,
  snapPoints = [0.5, 0.9],
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const closeThreshold = 100; // pixels to drag before closing

  // Inject styles on mount
  useEffect(() => {
    injectBottomSheetStyles();
  }, []);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsExiting(false);
      document.body.classList.add('sheet-open');
    } else {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsExiting(false);
        setDragOffset(0);
        document.body.classList.remove('sheet-open');
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !preventClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, preventClose]);

  // Handle drag to close
  const handleDragEnd = useCallback(
    (velocity: number) => {
      setIsDragging(false);
      if (velocity > 0.5 || dragOffset > closeThreshold) {
        onClose();
      } else {
        setDragOffset(0);
      }
    },
    [dragOffset, onClose]
  );

  // Handle backdrop click
  const handleOverlayClick = useCallback(() => {
    if (!preventClose) {
      onClose();
    }
  }, [preventClose, onClose]);

  // Don't render if not visible and not exiting
  if (!isVisible && !isExiting) return null;

  // Use portal to render at document body level
  return createPortal(
    <>
      <BottomSheetOverlay
        isVisible={isVisible || isExiting}
        onClick={handleOverlayClick}
        className={overlayClassName}
      />
      <BottomSheetContent
        isVisible={isVisible}
        isExiting={isExiting}
        children={children}
        footer={footer}
        title={title}
        showCloseButton={showCloseButton}
        onClose={onClose}
        maxHeight={maxHeight}
        dragOffset={dragOffset}
        className={className}
      />
    </>,
    document.body
  );
};

// =============================================================================
// Compound Component Pattern (for header/content/footer)
// =============================================================================

interface BottomSheetSectionProps {
  children: React.ReactNode;
  className?: string;
}

const BottomSheetHeader: React.FC<BottomSheetSectionProps> = ({ children, className }) => (
  <div className={cn('px-5 py-3 border-b border-[#E8E4E0]', className)}>
    {children}
  </div>
);

const BottomSheetBody: React.FC<BottomSheetSectionProps> = ({ children, className }) => (
  <div className={cn('px-5 py-4', className)}>{children}</div>
);

const BottomSheetFooter: React.FC<BottomSheetSectionProps> = ({ children, className }) => (
  <div
    className={cn(
      'px-5 py-4 border-t border-[#E8E4E0]',
      'bg-nilin-cream/50',
      className
    )}
  >
    {children}
  </div>
);

// Create compound component with static properties
interface BottomSheetComponent extends React.FC<BottomSheetProps> {
  Header: React.FC<BottomSheetSectionProps>;
  Body: React.FC<BottomSheetSectionProps>;
  Footer: React.FC<BottomSheetSectionProps>;
}

const BottomSheetCompound: BottomSheetComponent = Object.assign(BottomSheet, {
  Header: BottomSheetHeader,
  Body: BottomSheetBody,
  Footer: BottomSheetFooter,
});

// =============================================================================
// Exports
// =============================================================================

export { BottomSheetCompound as BottomSheet };
export default BottomSheetCompound;
