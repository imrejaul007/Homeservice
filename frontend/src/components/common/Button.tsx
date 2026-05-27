import React from 'react';
import { Loader2 } from 'lucide-react';

// =============================================================================
// NILIN Design System - Button Component
// =============================================================================

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Shows loading spinner and disables interaction */
  loading?: boolean;
  /** Optional pulse animation for premium CTAs */
  premium?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Left icon component */
  leftIcon?: React.ReactNode;
  /** Right icon component */
  rightIcon?: React.ReactNode;
}

// =============================================================================
// Style Configurations
// =============================================================================

const variantStyles = {
  primary: {
    base: 'bg-nilin-coral text-white border-transparent',
    hover: 'hover:bg-nilin-rose hover:shadow-nilin-warm-lg',
    active: 'active:bg-nilin-rose/90 active:shadow-none',
    disabled: 'disabled:bg-nilin-coral/50',
  },
  secondary: {
    base: 'bg-transparent text-nilin-coral border-2 border-nilin-coral',
    hover: 'hover:bg-nilin-coral/10 hover:shadow-nilin-warm',
    active: 'active:bg-nilin-coral/15 active:shadow-none',
    disabled: 'disabled:text-nilin-coral/50 disabled:border-nilin-coral/50',
  },
  ghost: {
    base: 'bg-transparent text-nilin-coral border-transparent',
    hover: 'hover:bg-nilin-coral/10 hover:shadow-nilin-warm',
    active: 'active:bg-nilin-coral/15 active:shadow-none',
    disabled: 'disabled:text-nilin-coral/50',
  },
  danger: {
    base: 'bg-nilin-error text-white border-transparent',
    hover: 'hover:bg-nilin-error/90 hover:shadow-nilin-warm-lg',
    active: 'active:bg-nilin-error/80 active:shadow-none',
    disabled: 'disabled:bg-nilin-error/50',
  },
  outline: {
    base: 'bg-transparent text-nilin-coral border-2 border-nilin-coral',
    hover: 'hover:bg-nilin-coral/10 hover:shadow-nilin-warm',
    active: 'active:bg-nilin-coral/15 active:shadow-none',
    disabled: 'disabled:text-nilin-coral/50 disabled:border-nilin-coral/50',
  },
} as const;

const sizeStyles = {
  sm: {
    padding: 'px-3 py-1.5',
    textSize: 'text-xs',
    borderRadius: 'rounded-lg',
    iconSize: 'h-3 w-3',
  },
  md: {
    padding: 'px-4 py-2.5',
    textSize: 'text-sm',
    borderRadius: 'rounded-nilin',
    iconSize: 'h-4 w-4',
  },
  lg: {
    padding: 'px-6 py-3',
    textSize: 'text-base',
    borderRadius: 'rounded-nilin-lg',
    iconSize: 'h-5 w-5',
  },
} as const;

// =============================================================================
// Component
// =============================================================================

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      premium = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

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
      'focus:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-nilin-coral',
      'focus-visible:ring-offset-2',

      // Size
      sizeStyles[size].padding,
      sizeStyles[size].textSize,
      sizeStyles[size].borderRadius,

      // Variant
      variantStyles[variant].base,
      variantStyles[variant].hover,
      variantStyles[variant].active,
      variantStyles[variant].disabled,

      // States
      'hover:-translate-y-0.5',
      'active:translate-y-0',
      'active:scale-[0.98]',

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

    return (
      <button
        ref={ref}
        className={baseClasses}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {/* Loading Spinner */}
        {loading && (
          <Loader2
            className={`${sizeStyles[size].iconSize} mr-2 animate-spin`}
            aria-hidden="true"
          />
        )}

        {/* Left Icon */}
        {leftIcon && !loading && (
          <span
            className={`${sizeStyles[size].iconSize} mr-2 flex-shrink-0`}
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
            className={`${sizeStyles[size].iconSize} ml-2 flex-shrink-0`}
            aria-hidden="true"
          >
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// =============================================================================
// Exports
// =============================================================================

export { Button };
export default Button;
