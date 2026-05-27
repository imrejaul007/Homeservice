import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { springs } from './animations';

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop' | 'onDragExit' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onTransitionEnd'>;

interface EliteButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  magnetic?: boolean;
  children: React.ReactNode;
}

const variantClasses = {
  primary: 'bg-[#E8B4A8] text-white shadow-elite-glow hover:bg-[#D4A89A]',
  secondary: 'bg-white text-[#2D2D2D] shadow-elite-md hover:shadow-elite-lg',
  ghost: 'bg-transparent text-[#E8B4A8]',
  outline: 'bg-transparent text-[#E8B4A8] border-2 border-[#E8B4A8]',
};

const sizeClasses = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3.5 text-base',
  lg: 'px-8 py-4 text-lg',
};

export function EliteButton({
  variant = 'primary',
  size = 'md',
  magnetic = false,
  children,
  className = '',
  ...props
}: EliteButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!magnetic || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.15;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.15;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onHoverStart={() => setIsHovered(true)}
      animate={{
        x: position.x,
        y: position.y,
        scale: magnetic && isHovered ? 1.02 : 1,
      }}
      whileTap={{ scale: 0.97 }}
      transition={springs.snappy}
      className={`
        relative overflow-hidden
        rounded-xl font-medium
        transition-all duration-200
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {/* Shine effect on hover */}
      {magnetic && (
        <motion.div
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: isHovered ? '100%' : '-100%', opacity: isHovered ? 0.3 : 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none"
        />
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}

// Floating action button variant
interface EliteFABProps extends ButtonProps {
  icon: React.ReactNode;
}

export function EliteFAB({ icon, className = '', ...props }: EliteFABProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        fixed bottom-24 right-6 z-40
        w-14 h-14 rounded-full
        bg-[#E8B4A8] text-white
        shadow-elite-float
        flex items-center justify-center
        ${className}
      `}
      {...props}
    >
      {icon}
    </motion.button>
  );
}

export default EliteButton;
