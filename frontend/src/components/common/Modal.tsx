import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

// =============================================================================
// NILIN Design System - Modal Component
// =============================================================================

export interface ModalProps {
  /** Controlled open state */
  open?: boolean;
  /** Initial open state for uncontrolled usage */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Modal title text */
  title?: React.ReactNode;
  /** Modal description text */
  description?: React.ReactNode;
  /** Modal content */
  children?: React.ReactNode;
  /** Footer content (actions) */
  footer?: React.ReactNode;
  /** Size preset variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Prevent closing on backdrop click */
  preventClose?: boolean;
  /** Show close button in header */
  showCloseButton?: boolean;
  /** Custom className for the modal content */
  className?: string;
  /** Custom className for the overlay */
  overlayClassName?: string;
}

// =============================================================================
// Size Configurations
// =============================================================================

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-3xl',
} as const;

// =============================================================================
// Dialog Overlay (Backdrop)
// =============================================================================

const ModalOverlay = React.forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
  ({ className, children }, forwardedRef) => (
    <DialogPrimitive.Overlay
      ref={forwardedRef}
      className={cn(
        // Glass backdrop with blur
        'fixed inset-0 z-[100]',
        'bg-nilin-charcoal/40',
        'backdrop-blur-sm',
        '-webkit-backdrop-blur-sm',
        // Fade animation
        'data-[state=closed]:animate-fade-out',
        'data-[state=open]:animate-fade-in',
        className
      )}
    >
      {children}
    </DialogPrimitive.Overlay>
  )
);
ModalOverlay.displayName = 'ModalOverlay';

// =============================================================================
// Dialog Content (Modal Card)
// =============================================================================

interface ModalContentProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ children, className, size = 'md' }, forwardedRef) => (
    <DialogPrimitive.Content
      ref={forwardedRef}
      aria-modal="true"
      className={cn(
        // Positioning
        'fixed left-[50%] top-[50%] z-[100] translate-x-[-50%] translate-y-[-50%]',
        // Glass effect background
        'bg-white',
        'border border-nilin-border',
        // NILIN rounded corners
        'rounded-nilin-lg',
        // Warm shadow - NILIN signature
        'shadow-nilin-warm-lg',
        // Dimensions
        'w-full',
        sizeStyles[size],
        'max-h-[90vh]',
        // Overflow handling
        'overflow-hidden',
        // Focus outline
        'focus:outline-none',
        // Focus-within ring
        'focus-within:ring-2 focus-within:ring-nilin-coral/20',
        // Scale animation on open/close
        'data-[state=closed]:animate-modal-scale-out',
        'data-[state=open]:animate-modal-scale-in',
        // Animation
        'duration-200',
        className
      )}
    >
      {children}
    </DialogPrimitive.Content>
  )
);
ModalContent.displayName = 'ModalContent';

// =============================================================================
// Dialog Header
// =============================================================================

interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({ children, className }) => (
  <div className={cn('px-6 pt-6 pb-4', className)}>{children}</div>
);

// =============================================================================
// Dialog Title
// =============================================================================

interface ModalTitleProps {
  children: React.ReactNode;
  className?: string;
}

const ModalTitle: React.FC<ModalTitleProps> = ({ children, className }) => (
  <DialogPrimitive.Title
    className={cn(
      'text-xl font-semibold text-nilin-charcoal',
      'font-serif',
      className
    )}
  >
    {children}
  </DialogPrimitive.Title>
);

// =============================================================================
// Dialog Description
// =============================================================================

interface ModalDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const ModalDescription: React.FC<ModalDescriptionProps> = ({ children, className }) => (
  <DialogPrimitive.Description
    className={cn('mt-1 text-sm text-nilin-charcoal/70', className)}
  >
    {children}
  </DialogPrimitive.Description>
);

// =============================================================================
// Dialog Body (Scrollable Content)
// =============================================================================

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

const ModalBody: React.FC<ModalBodyProps> = ({ children, className }) => (
  <div className={cn('px-6 pb-4 overflow-y-auto max-h-[60vh] scroll-smooth', className)}>
    {children}
  </div>
);

// =============================================================================
// Dialog Footer
// =============================================================================

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

const ModalFooter: React.FC<ModalFooterProps> = ({ children, className }) => (
  <div
    className={cn(
      'px-6 py-4 border-t border-nilin-border',
      'flex items-center justify-end gap-3',
      'bg-nilin-cream/50',
      className
    )}
  >
    {children}
  </div>
);

// =============================================================================
// Dialog Close Button (NILIN Style)
// =============================================================================

const ModalClose: React.FC<{ className?: string }> = ({ className }) => (
  <DialogPrimitive.Close
    className={cn(
      // NILIN button base
      'btn-nilin',
      // Positioning
      'absolute right-4 top-4',
      // Sizing
      'p-2 h-auto min-h-0',
      // Flex for icon centering
      'flex items-center justify-center',
      // Disable default button styles
      'rounded-full',
      // Focus visible styles
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2',
      // Custom className
      className
    )}
    aria-label="Close modal"
  >
    <X className="h-4 w-4" aria-hidden="true" />
  </DialogPrimitive.Close>
);

// =============================================================================
// Compound Modal Component
// =============================================================================

interface ModalCompoundProps extends ModalProps {
  Header: React.FC<ModalHeaderProps>;
  Title: React.FC<ModalTitleProps>;
  Description: React.FC<ModalDescriptionProps>;
  Body: React.FC<ModalBodyProps>;
  Footer: React.FC<ModalFooterProps>;
  Close: React.FC<{ className?: string }>;
}

const Modal: React.FC<ModalProps> & ModalCompoundProps = ({
  open,
  defaultOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  preventClose = false,
  showCloseButton = true,
  className,
  overlayClassName,
}) => {
  return (
    <DialogPrimitive.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={preventClose ? undefined : onOpenChange}
    >
      <DialogPrimitive.Portal>
        <ModalOverlay className={overlayClassName}>
          <ModalContent size={size} className={className}>
            {/* Close button */}
            {showCloseButton && !preventClose && <ModalClose />}

            {/* Title and Description */}
            {(title || description) && (
              <ModalHeader>
                {title && <ModalTitle>{title}</ModalTitle>}
                {description && <ModalDescription>{description}</ModalDescription>}
              </ModalHeader>
            )}

            {/* Body content */}
            <ModalBody>{children}</ModalBody>

            {/* Footer actions */}
            {footer && <ModalFooter>{footer}</ModalFooter>}
          </ModalContent>
        </ModalOverlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

// Attach sub-components
Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Description = ModalDescription;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
Modal.Close = ModalClose;

// =============================================================================
// Simple Modal Wrapper (Open/Close Trigger Pattern)
// =============================================================================

interface ModalTriggerProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger> {
  children: React.ReactNode;
}

const ModalTrigger: React.FC<ModalTriggerProps> = ({ children, ...props }) => (
  <DialogPrimitive.Trigger asChild {...props}>
    {children}
  </DialogPrimitive.Trigger>
);

// =============================================================================
// Exports
// =============================================================================

export { Modal, ModalTrigger };
export default Modal;
