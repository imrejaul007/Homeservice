import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

// =============================================================================
// NILIN Design System - Input Component
// =============================================================================

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label text displayed above the input */
  label?: React.ReactNode;
  /** Error message (enables error state) */
  error?: string;
  /** Helper text displayed below the input */
  helperText?: string;
  /** Prefix icon component */
  prefix?: React.ReactNode;
  /** Suffix icon component */
  suffix?: React.ReactNode;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Full width input */
  fullWidth?: boolean;
  /** Container className */
  containerClassName?: string;
}

// =============================================================================
// Size Configurations
// =============================================================================

const sizeStyles = {
  sm: {
    input: 'px-3 py-1.5 text-sm',
    icon: 'h-4 w-4',
    gap: 'gap-2',
    label: 'text-xs',
    helper: 'text-xs',
  },
  md: {
    input: 'px-3.5 py-2.5 text-sm',
    icon: 'h-4 w-4',
    gap: 'gap-2.5',
    label: 'text-sm',
    helper: 'text-xs',
  },
  lg: {
    input: 'px-4 py-3 text-base',
    icon: 'h-5 w-5',
    gap: 'gap-3',
    label: 'text-base',
    helper: 'text-sm',
  },
} as const;

// =============================================================================
// Input Component
// =============================================================================

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      prefix,
      suffix,
      size = 'md',
      fullWidth = false,
      className,
      containerClassName,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    // Generate unique ID for accessibility
    const inputId = id || `input-${React.useId()}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const isDisabled = disabled;

    return (
      <div
        className={cn(
          'flex flex-col',
          fullWidth && 'w-full',
          containerClassName
        )}
      >
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'mb-1.5 font-medium text-nilin-charcoal',
              sizeStyles[size].label,
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {label}
          </label>
        )}

        {/* Input Wrapper */}
        <div
          className={cn(
            'relative flex items-center',
            sizeStyles[size].gap,
            // Full width
            fullWidth && 'w-full',
            // Error state adds margin for error message
            error && 'mb-1'
          )}
        >
          {/* Prefix Icon */}
          {prefix && (
            <span
              className={cn(
                'absolute left-3',
                'flex items-center justify-center',
                'text-nilin-warmGray',
                'pointer-events-none',
                sizeStyles[size].icon
              )}
              aria-hidden="true"
            >
              {prefix}
            </span>
          )}

          {/* Input Field */}
          <input
            ref={ref}
            id={inputId}
            disabled={isDisabled}
            aria-invalid={!!error}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              // Base NILIN input styles
              'input-nilin',
              // Rounded corners
              'rounded-lg',
              // Size-based padding
              sizeStyles[size].input,
              // Full width
              fullWidth && 'w-full',
              // Icon adjustments
              prefix && 'pl-10',
              suffix && 'pr-10',
              // Focus ring animation
              'transition-all duration-200 ease-out',
              // Focus state with warm coral border
              'focus:border-[#E8B4A8]',
              'focus:ring-[3px]',
              'focus:ring-[#E8B4A8]/20',
              'focus:shadow-[0_0_0_3px_rgba(232,180,168,0.15)]',
              // Error state styling
              error && 'border-[#C88B8B] border-2',
              error && 'focus:border-[#C88B8B]',
              error && 'focus:ring-[#C88B8B]/20',
              // Disabled state
              isDisabled && 'opacity-50 cursor-not-allowed bg-nilin-muted',
              // Custom className override
              className
            )}
            {...props}
          />

          {/* Suffix Icon */}
          {suffix && (
            <span
              className={cn(
                'absolute right-3',
                'flex items-center justify-center',
                'text-nilin-warmGray',
                sizeStyles[size].icon
              )}
              aria-hidden="true"
            >
              {suffix}
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <p
            id={errorId}
            className={cn(
              'mt-1.5 text-sm text-[#C88B8B] font-medium',
              'flex items-center gap-1'
            )}
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Helper Text */}
        {helperText && !error && (
          <p
            id={helperId}
            className={cn(
              'mt-1.5 text-nilin-warmGray',
              sizeStyles[size].helper
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// =============================================================================
// Textarea Variant
// =============================================================================

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Label text displayed above the textarea */
  label?: React.ReactNode;
  /** Error message (enables error state) */
  error?: string;
  /** Helper text displayed below the textarea */
  helperText?: string;
  /** Full width input */
  fullWidth?: boolean;
  /** Container className */
  containerClassName?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      containerClassName,
      disabled,
      className,
      id,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const inputId = id || `textarea-${React.useId()}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const isDisabled = disabled;

    return (
      <div
        className={cn(
          'flex flex-col',
          fullWidth && 'w-full',
          containerClassName
        )}
      >
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'mb-1.5 font-medium text-nilin-charcoal text-sm',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {label}
          </label>
        )}

        {/* Textarea Field */}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          disabled={isDisabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={cn(
            // Base NILIN input styles
            'input-nilin',
            // Rounded corners
            'rounded-lg',
            // Padding
            'px-3.5 py-2.5 text-sm',
            // Full width
            fullWidth && 'w-full',
            // Resize
            'resize-y min-h-[80px]',
            // Focus ring animation
            'transition-all duration-200 ease-out',
            // Focus state with warm coral border
            'focus:border-[#E8B4A8]',
            'focus:ring-[3px]',
            'focus:ring-[#E8B4A8]/20',
            'focus:shadow-[0_0_0_3px_rgba(232,180,168,0.15)]',
            // Error state styling
            error && 'border-[#C88B8B] border-2',
            error && 'focus:border-[#C88B8B]',
            error && 'focus:ring-[#C88B8B]/20',
            // Disabled state
            isDisabled && 'opacity-50 cursor-not-allowed bg-nilin-muted',
            // Custom className override
            className
          )}
          {...props}
        />

        {/* Error Message */}
        {error && (
          <p
            id={errorId}
            className={cn(
              'mt-1.5 text-sm text-[#C88B8B] font-medium',
              'flex items-center gap-1'
            )}
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Helper Text */}
        {helperText && !error && (
          <p
            id={helperId}
            className="mt-1.5 text-xs text-nilin-warmGray"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// =============================================================================
// Exports
// =============================================================================

export { Input, Textarea };
export default Input;
