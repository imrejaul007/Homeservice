import { motion } from 'framer-motion';

type BadgeStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'inProgress' | 'new' | 'popular' | 'sale';

interface PremiumBadgeProps {
  status: BadgeStatus;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

const statusConfig: Record<BadgeStatus, { bg: string; text: string; dot: string; label: string }> = {
  pending: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    dot: 'bg-yellow-500',
    label: 'Pending',
  },
  confirmed: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-500',
    label: 'Confirmed',
  },
  completed: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    label: 'Completed',
  },
  cancelled: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Cancelled',
  },
  inProgress: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    dot: 'bg-purple-500',
    label: 'In Progress',
  },
  new: {
    bg: 'bg-nilin-coral/10',
    text: 'text-nilin-coral',
    dot: 'bg-nilin-coral',
    label: 'New',
  },
  popular: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    label: 'Popular',
  },
  sale: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-500',
    label: 'Sale',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
  lg: 'px-4 py-1.5 text-base gap-2',
};

export function PremiumBadge({ status, size = 'md', showDot = true }: PremiumBadgeProps) {
  const config = statusConfig[status];

  return (
    <motion.span
      whileTap={{ scale: 0.95 }}
      className={`inline-flex items-center rounded-full font-medium border ${config.bg} ${config.text} ${sizeClasses[size]} border-current/10`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      )}
      {config.label}
    </motion.span>
  );
}

// Notification count badge
interface NotificationBadgeProps {
  count: number;
  max?: number;
}

export function NotificationBadge({ count, max = 99 }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const display = count > max ? `${max}+` : count.toString();

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1"
    >
      {display}
    </motion.span>
  );
}

// Rating badge
interface RatingBadgeProps {
  rating: number;
  count?: number;
  size?: 'sm' | 'md';
}

export function RatingBadge({ rating, count, size = 'md' }: RatingBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm ${
      size === 'sm' ? 'text-xs' : 'text-sm'
    }`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      <span className="font-semibold text-nilin-charcoal">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-nilin-warmGray">({count})</span>
      )}
    </div>
  );
}

// Price badge with discount
interface PriceBadgeProps {
  originalPrice: number;
  discountedPrice: number;
  size?: 'sm' | 'md';
}

export function PriceBadge({ originalPrice, discountedPrice, size = 'md' }: PriceBadgeProps) {
  const discount = Math.round((1 - discountedPrice / originalPrice) * 100);

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`font-bold text-nilin-coral ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
        ₹{discountedPrice}
      </span>
      <span className={`text-nilin-warmGray line-through ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        ₹{originalPrice}
      </span>
      <span className="bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
        {discount}% OFF
      </span>
    </div>
  );
}

export default PremiumBadge;
