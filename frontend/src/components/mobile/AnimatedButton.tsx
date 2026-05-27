import { motion } from 'framer-motion';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { useHaptics } from '../../hooks/useHaptics';
import { Loader2 } from 'lucide-react';

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop' | 'onDragExit' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onTransitionEnd'>;

interface AnimatedButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses = {
  primary:
    'bg-nilin-coral text-white hover:bg-nilin-rose active:bg-[#C4A090]',
  secondary:
    'bg-nilin-blush text-nilin-charcoal hover:bg-nilin-peach active:bg-nilin-blush',
  ghost:
    'bg-transparent text-nilin-coral hover:bg-nilin-blush/50 active:bg-nilin-blush',
  outline:
    'bg-transparent text-nilin-coral border-2 border-nilin-coral hover:bg-nilin-coral/10 active:bg-nilin-coral/20',
  danger:
    'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
};

const sizeClasses = {
  sm: 'px-4 py-2 text-sm rounded-lg min-h-[40px]',
  md: 'px-6 py-3 text-base rounded-xl min-h-[48px]',
  lg: 'px-8 py-4 text-lg rounded-xl min-h-[56px]',
};

export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      className,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const { impact } = useHaptics();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !isLoading) {
        impact('light');
      }
      onClick?.(e);
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={cn(
          'relative inline-flex items-center justify-center gap-2',
          'font-medium transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || isLoading}
        onClick={handleClick}
        {...props}
      >
        {/* Loading spinner */}
        {isLoading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
          </motion.div>
        )}

        {/* Left icon */}
        {!isLoading && leftIcon && (
          <span className="flex-shrink-0">{leftIcon}</span>
        )}

        {/* Button text */}
        <span>{children}</span>

        {/* Right icon */}
        {!isLoading && rightIcon && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </motion.button>
    );
  }
);

AnimatedButton.displayName = 'AnimatedButton';

export default AnimatedButton;
