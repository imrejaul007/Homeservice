import { useState } from 'react';
import { motion } from 'framer-motion';

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop' | 'onDragExit' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onTransitionEnd'>;

interface AAATactileButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  haptic?: boolean;
  children: React.ReactNode;
}

const variantClasses = {
  primary: 'bg-[#E8B4A8] text-white shadow-aaa-float',
  secondary: 'bg-white text-[#2D2D2D] shadow-aaa-card',
  ghost: 'bg-transparent text-[#E8B4A8]',
  outline: 'bg-transparent text-[#E8B4A8] border-2 border-[#E8B4A8]',
};

const sizeClasses = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3.5 text-base',
  lg: 'px-8 py-4 text-lg',
};

// Tactile spring - feels physical and responsive
const tactileSpring = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 28,
  mass: 0.5,
};

// Hover spring - smooth and confident
const hoverSpring = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25,
  mass: 0.6,
};

export function AAATactileButton({
  variant = 'primary',
  size = 'md',
  haptic = true,
  children,
  className = '',
  onClick,
  disabled,
  ...props
}: AAATactileButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerDown = () => {
    setIsPressed(true);
  };

  const handlePointerUp = () => {
    setIsPressed(false);
  };

  const handlePointerLeave = () => {
    setIsPressed(false);
    setIsHovered(false);
  };

  return (
    <motion.button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{
        scale: isPressed ? 0.96 : isHovered ? 1.02 : 1,
        y: isPressed ? 1 : isHovered ? -2 : 0,
      }}
      transition={{
        scale: isPressed ? tactileSpring : isHovered ? hoverSpring : { duration: 0.15 },
        y: isPressed ? tactileSpring : isHovered ? hoverSpring : { duration: 0.15 },
      }}
      whileTap={!disabled ? { scale: 0.96, y: 1 } : {}}
      whileHover={!disabled ? { scale: 1.02, y: -2 } : {}}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative overflow-hidden
        rounded-xl font-semibold
        transition-colors duration-200
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      {...props}
    >
      {/* Subtle inner glow on hover */}
      {variant === 'primary' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent pointer-events-none"
        />
      )}

      {/* Press feedback */}
      {variant === 'primary' && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: isPressed ? 0.1 : 0,
            scale: isPressed ? 1 : 0,
          }}
          transition={{ duration: 0.1 }}
          className="absolute inset-0 bg-white pointer-events-none"
        />
      )}

      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}

// Floating Action Button - premium feel
type ButtonBaseProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop' | 'onDragExit' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onTransitionEnd'>;

interface AAAFABProps extends ButtonBaseProps {
  icon: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const fabSizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-14 h-14',
  lg: 'w-16 h-16',
};

export function AAAFAB({
  icon,
  size = 'md',
  className = '',
  onClick,
  ...props
}: AAAFABProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        fixed bottom-24 right-6 z-50
        rounded-full
        bg-[#E8B4A8] text-white
        shadow-aaa-float
        flex items-center justify-center
        ${fabSizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {icon}
    </motion.button>
  );
}

// Icon Button - tactile feedback
interface AAAIconButtonProps extends ButtonBaseProps {
  icon: React.ReactNode;
  variant?: 'default' | 'filled' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const iconVariantClasses = {
  default: 'bg-transparent text-[#6B6B6B]',
  filled: 'bg-[#F5E6E0] text-[#E8B4A8]',
  ghost: 'bg-transparent text-[#E8B4A8]',
};

const iconSizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export function AAAIconButton({
  icon,
  variant = 'default',
  size = 'md',
  className = '',
  onClick,
  ...props
}: AAAIconButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`
        rounded-full
        flex items-center justify-center
        ${iconVariantClasses[variant]}
        ${iconSizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {icon}
    </motion.button>
  );
}

export default AAATactileButton;
