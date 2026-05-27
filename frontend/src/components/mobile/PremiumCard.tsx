import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useHaptics } from '../../hooks/useHaptics';

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  elevated?: boolean;
  glassmorphic?: boolean;
  animated?: boolean;
}

export function PremiumCard({
  children,
  className,
  onClick,
  elevated = true,
  glassmorphic = false,
  animated = true,
}: PremiumCardProps) {
  const { impact } = useHaptics();

  const handleClick = () => {
    if (onClick) {
      impact('light');
      onClick();
    }
  };

  const baseClasses = 'rounded-2xl overflow-hidden transition-all duration-200';

  const elevatedClasses = elevated
    ? 'shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)]'
    : '';

  const glassClasses = glassmorphic
    ? 'bg-white/80 backdrop-blur-lg border border-white/20'
    : 'bg-white';

  const content = (
    <div className={cn(baseClasses, elevatedClasses, glassClasses, className)}>
      {children}
    </div>
  );

  if (!onClick) {
    return content;
  }

  if (!animated) {
    return (
      <button
        onClick={handleClick}
        className="w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 rounded-2xl"
      >
        {content}
      </button>
    );
  }

  return (
    <motion.button
      onClick={handleClick}
      whileTap={{ scale: 0.99 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 rounded-2xl"
    >
      {content}
    </motion.button>
  );
}

// Card Header Component
interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('px-4 py-3 border-b border-gray-100', className)}>
      {children}
    </div>
  );
}

// Card Body Component
interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn('p-4', className)}>{children}</div>;
}

// Card Footer Component
interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={cn(
        'px-4 py-3 border-t border-gray-100 bg-gray-50/50',
        className
      )}
    >
      {children}
    </div>
  );
}

// Skeleton Card for Loading States
interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
        className
      )}
    >
      <div className="p-4 space-y-3">
        {/* Image skeleton */}
        <div className="w-full h-32 rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />

        {/* Title skeleton */}
        <div className="h-5 w-3/4 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />

        {/* Description skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
        </div>

        {/* Button skeleton */}
        <div className="h-10 w-full rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse mt-4" />
      </div>
    </div>
  );
}

export default PremiumCard;
