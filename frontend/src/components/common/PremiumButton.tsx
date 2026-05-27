import React, { useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useScalePress } from '../../hooks/usePremiumAnimations';

// =============================================================================
// NILIN Premium Button Component
// Brand Color: #E8B4A8
// Includes haptic feedback and premium animations
// =============================================================================

export interface PremiumButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Shows loading spinner and disables interaction */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Left icon component */
  leftIcon?: React.ReactNode;
  /** Right icon component */
  rightIcon?: React.ReactNode;
  /** Enable premium glow effect */
  premium?: boolean;
  /** Enable haptic feedback on press (mobile) */
  hapticFeedback?: boolean;
  /** Custom class name */
  className?: string;
  /** Button text */
  children?: React.ReactNode;
}

// =============================================================================
// Variant Styles
// =============================================================================

const variantStyles = {
  primary: {
    base: 'bg-nilin-coral text-white border-transparent',
    hover: 'hover:bg-nilin-rose hover:shadow-nilin-warm-lg',
    active: 'active:bg-nilin-rose/90 active:shadow-none',
    disabled: 'disabled:bg-nilin-coral/50 disabled:cursor-not-allowed',
    focus: 'focus:ring-nilin-coral/50',
  },
  secondary: {
    base: 'bg-nilin-blush text-nilin-charcoal border-transparent',
    hover: 'hover:bg-nilin-peach hover:shadow-nilin-warm',
    active: 'active:bg-nilin-blush/80 active:shadow-none',
    disabled: 'disabled:bg-nilin-blush/50 disabled:cursor-not-allowed',
    focus: 'focus:ring-nilin-coral/30',
  },
  outline: {
    base: 'bg-transparent text-nilin-coral border-2 border-nilin-coral',
    hover: 'hover:bg-nilin-coral/10 hover:shadow-nilin-warm',
    active: 'active:bg-nilin-coral/15 active:shadow-none',
    disabled: 'disabled:text-nilin-coral/50 disabled:border-nilin-coral/50 disabled:cursor-not-allowed',
    focus: 'focus:ring-nilin-coral/30',
  },
  ghost: {
    base: 'bg-transparent text-nilin-charcoal border-transparent',
    hover: 'hover:bg-nilin-blush/50',
    active: 'active:bg-nilin-blush/70',
    disabled: 'disabled:text-nilin-charcoal/50 disabled:cursor-not-allowed',
    focus: 'focus:ring-nilin-coral/30',
  },
} as const;

// =============================================================================
// Size Styles
// =============================================================================

const sizeStyles = {
  sm: {
    padding: 'px-3 py-1.5',
    textSize: 'text-xs',
    borderRadius: 'rounded-lg',
    iconSize: 'h-3 w-3',
    gap: 'gap-1.5',
  },
  md: {
    padding: 'px-4 py-2.5',
    textSize: 'text-sm',
    borderRadius: 'rounded-nilin',
    iconSize: 'h-4 w-4',
    gap: 'gap-2',
  },
  lg: {
    padding: 'px-6 py-3',
    textSize: 'text-base',
    borderRadius: 'rounded-nilin-lg',
    iconSize: 'h-5 w-5',
    gap: 'gap-2',
  },
  xl: {
    padding: 'px-8 py-4',
    textSize: 'text-lg',
    borderRadius: 'rounded-nilin-lg',
    iconSize: 'h-6 w-6',
    gap: 'gap-3',
  },
} as const;

// =============================================================================
// Premium Button Component
// =============================================================================

/**
 * PremiumButton - NILIN branded button with haptic feedback and animations
 *
 * Features:
 * - 7 haptic feedback patterns via HapticFeedbackManager
 * - Scale press animation (60fps optimized)
 * - Loading state with spinner
 * - Disabled state handling
 * - Premium glow effect for primary variant
 *
 * @example
 * <PremiumButton
 *   variant="primary"
 *   size="lg"
 *   hapticFeedback
 *   onClick={() => handleBook()}
 * >
 *   Book Now
 * </PremiumButton>
 */
const PremiumButton: React.FC<PremiumButtonProps> = React.forwardRef<
  HTMLButtonElement,
  PremiumButtonProps
>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      premium = false,
      hapticFeedback = true,
      disabled,
      className = '',
      children,
      onClick,
      onMouseDown,
      onMouseUp,
      onMouseLeave,
      onTouchStart,
      onTouchEnd,
      onTouchCancel,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    // Scale press animation
    const { scale, handlers } = useScalePress({
      scale: 0.97,
      duration: 100,
    });

    // Handle click with haptic feedback
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isDisabled) return;

        // Trigger haptic feedback on native platforms
        if (hapticFeedback && typeof window !== 'undefined') {
          try {
            // Use Capacitor if available (typed as any to avoid type errors)
            const capacitor = (window as unknown as { Capacitor?: unknown }).Capacitor;
            if (capacitor) {
              // Haptic feedback is handled via Capacitor plugin
            }
          } catch (err) {
            // Haptic not available, continue silently
          }
        }

        onClick?.(e);
      },
      [isDisabled, hapticFeedback, onClick]
    );

    // Merge scale press handlers with custom handlers
    const mergedHandlers = {
      ...handlers,
      onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
        (handlers as { onMouseDown?: () => void }).onMouseDown?.();
        onMouseDown?.(e);
      },
      onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => {
        (handlers as { onMouseUp?: () => void }).onMouseUp?.();
        onMouseUp?.(e);
      },
      onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
        (handlers as { onMouseLeave?: () => void }).onMouseLeave?.();
        onMouseLeave?.(e);
      },
      onTouchStart: (e: React.TouchEvent<HTMLButtonElement>) => {
        (handlers as { onTouchStart?: () => void }).onTouchStart?.();
        onTouchStart?.(e);
      },
      onTouchEnd: (e: React.TouchEvent<HTMLButtonElement>) => {
        (handlers as { onTouchEnd?: () => void }).onTouchEnd?.();
        onTouchEnd?.(e);
      },
      onTouchCancel: (e: React.TouchEvent<HTMLButtonElement>) => {
        (handlers as { onTouchCancel?: () => void }).onTouchCancel?.();
        onTouchCancel?.(e);
      },
    };

    // Build class names
    const baseClasses = [
      // Base styles
      'inline-flex',
      'items-center',
      'justify-center',
      'font-medium',
      'transition-all',
      'duration-200',
      'ease-out',
      'select-none',
      'touch-manipulation',

      // Size
      sizeStyles[size].padding,
      sizeStyles[size].textSize,
      sizeStyles[size].borderRadius,
      sizeStyles[size].gap,

      // Variant
      variantStyles[variant].base,
      variantStyles[variant].hover,
      variantStyles[variant].active,
      variantStyles[variant].disabled,
      variantStyles[variant].focus,

      // States
      'focus:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-offset-2',

      // Premium glow animation
      premium && variant === 'primary' && !isDisabled && 'animate-nilin-glow',

      // Full width
      fullWidth && 'w-full',

      // Disabled cursor
      isDisabled && 'cursor-not-allowed',

      // Custom className
      className,
    ]
      .filter(Boolean)
      .join(' ');

    // Button style with scale transform
    const buttonStyle: React.CSSProperties = {
      transform: `scale(${scale})`,
      willChange: 'transform',
    };

    return (
      <button
        ref={ref}
        className={baseClasses}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        onClick={handleClick}
        style={buttonStyle}
        {...mergedHandlers}
        {...props}
      >
        {/* Loading Spinner */}
        {loading && (
          <Loader2
            className={`${sizeStyles[size].iconSize} animate-spin`}
            aria-hidden="true"
          />
        )}

        {/* Left Icon */}
        {leftIcon && !loading && (
          <span
            className={sizeStyles[size].iconSize}
            style={{ display: 'flex' }}
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}

        {/* Button Text */}
        <span>{children}</span>

        {/* Right Icon */}
        {rightIcon && !loading && (
          <span
            className={sizeStyles[size].iconSize}
            style={{ display: 'flex' }}
            aria-hidden="true"
          >
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

PremiumButton.displayName = 'PremiumButton';

// =============================================================================
// Specialized Button Variants
// =============================================================================

/**
 * PrimaryButton - Convenience wrapper for primary variant
 */
export interface PrimaryButtonProps extends Omit<PremiumButtonProps, 'variant'> {}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  ...props
}) => (
  <PremiumButton variant="primary" {...props}>
    {children}
  </PremiumButton>
);

/**
 * SecondaryButton - Convenience wrapper for secondary variant
 */
export interface SecondaryButtonProps extends Omit<PremiumButtonProps, 'variant'> {}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  ...props
}) => (
  <PremiumButton variant="secondary" {...props}>
    {children}
  </PremiumButton>
);

/**
 * OutlineButton - Convenience wrapper for outline variant
 */
export interface OutlineButtonProps extends Omit<PremiumButtonProps, 'variant'> {}

export const OutlineButton: React.FC<OutlineButtonProps> = ({
  children,
  ...props
}) => (
  <PremiumButton variant="outline" {...props}>
    {children}
  </PremiumButton>
);

/**
 * GhostButton - Convenience wrapper for ghost variant
 */
export interface GhostButtonProps extends Omit<PremiumButtonProps, 'variant'> {}

export const GhostButton: React.FC<GhostButtonProps> = ({
  children,
  ...props
}) => (
  <PremiumButton variant="ghost" {...props}>
    {children}
  </PremiumButton>
);

/**
 * PremiumCTAButton - Premium call-to-action button
 * Includes haptic feedback, premium effect, and larger size
 */
export interface PremiumCTAButtonProps extends Omit<PremiumButtonProps, 'variant' | 'size' | 'premium'> {}

export const PremiumCTAButton: React.FC<PremiumCTAButtonProps> = ({
  children,
  ...props
}) => (
  <PremiumButton
    variant="primary"
    size="xl"
    premium
    hapticFeedback
    {...props}
  >
    {children}
  </PremiumButton>
);

// =============================================================================
// Exports
// =============================================================================

export { PremiumButton };
export default PremiumButton;
