import { motion } from 'framer-motion';
import { Shield, Star, Clock, CheckCircle, Award, Users, Heart } from 'lucide-react';

// Trust Badge Component - Increases conversion and trust
interface TrustBadgeProps {
  type: 'verified' | 'rating' | 'response_time' | 'completed' | 'top_rated' | 'reviews';
  count?: number;
  value?: string | number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const badgeConfig = {
  verified: {
    icon: Shield,
    label: 'Verified',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  rating: {
    icon: Star,
    label: 'Rating',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  response_time: {
    icon: Clock,
    label: 'Response',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  top_rated: {
    icon: Award,
    label: 'Top Rated',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  reviews: {
    icon: Users,
    label: 'Reviews',
    color: 'text-nilin-coral',
    bgColor: 'bg-nilin-blush',
    borderColor: 'border-nilin-coral/20',
  },
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
  lg: 'px-4 py-2 text-base gap-2',
};

const iconSizes = {
  sm: 12,
  md: 14,
  lg: 16,
};

export function TrustBadge({
  type,
  count,
  value,
  size = 'md',
  showLabel = true,
}: TrustBadgeProps) {
  const config = badgeConfig[type];
  const Icon = config.icon;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className={`
        inline-flex items-center rounded-full border font-medium
        ${config.bgColor} ${config.color} ${config.borderColor}
        ${sizeClasses[size]}
      `}
    >
      <Icon size={iconSizes[size]} />
      {showLabel && <span>{value || count || config.label}</span>}
    </motion.span>
  );
}

// Provider Trust Card - Shows provider credibility
interface ProviderTrustCardProps {
  rating: number;
  reviewCount: number;
  completedJobs: number;
  responseTime: string;
  isVerified: boolean;
  isTopRated: boolean;
}

export function ProviderTrustCard({
  rating,
  reviewCount,
  completedJobs,
  responseTime,
  isVerified,
  isTopRated,
}: ProviderTrustCardProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {isVerified && <TrustBadge type="verified" value="Verified" size="sm" />}
      {isTopRated && <TrustBadge type="top_rated" size="sm" />}
      <TrustBadge type="rating" value={`${rating} ★`} size="sm" />
      <TrustBadge type="reviews" value={`${reviewCount} reviews`} size="sm" />
      <TrustBadge type="completed" value={`${completedJobs}+ jobs`} size="sm" />
      <TrustBadge type="response_time" value={responseTime} size="sm" />
    </div>
  );
}

// Social Proof Counter - Shows popularity
interface SocialProofProps {
  bookings: number;
  timeframe?: string;
}

export function SocialProofCounter({ bookings, timeframe = 'this month' }: SocialProofProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 text-sm text-nilin-warmGray"
    >
      <Users size={16} />
      <span>
        <span className="font-semibold text-nilin-charcoal">{bookings.toLocaleString()}</span>
        {' '}people booked {timeframe}
      </span>
    </motion.div>
  );
}

// Booking Reassurance - Reduces booking anxiety
interface BookingReassuranceProps {
  showMoneyBack?: boolean;
  showCancellation?: boolean;
  showSupport?: boolean;
}

export function BookingReassurance({
  showMoneyBack = true,
  showCancellation = true,
  showSupport = true,
}: BookingReassuranceProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-3">
      {showMoneyBack && (
        <div className="flex items-center gap-1.5 text-xs text-green-700">
          <Shield size={14} />
          <span>Money-back guarantee</span>
        </div>
      )}
      {showCancellation && (
        <div className="flex items-center gap-1.5 text-xs text-green-700">
          <CheckCircle size={14} />
          <span>Free cancellation</span>
        </div>
      )}
      {showSupport && (
        <div className="flex items-center gap-1.5 text-xs text-green-700">
          <Clock size={14} />
          <span>24/7 Support</span>
        </div>
      )}
    </div>
  );
}

// Favorite Button - Engagement feature
interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function FavoriteButton({ isFavorite, onToggle, size = 'md' }: FavoriteButtonProps) {
  const sizeConfig = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onToggle}
      className={`
        rounded-full flex items-center justify-center
        transition-colors duration-200
        ${sizeConfig[size]}
        ${isFavorite ? 'bg-nilin-coral/10 text-nilin-coral' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}
      `}
    >
      <Heart size={iconSizes[size]} fill={isFavorite ? 'currentColor' : 'none'} />
    </motion.button>
  );
}

// Trust Score Indicator
interface TrustScoreProps {
  score: number; // 0-100
  label?: string;
}

export function TrustScore({ score, label = 'Trust Score' }: TrustScoreProps) {
  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`px-2 py-1 rounded-md font-semibold text-sm ${getScoreColor()}`}>
        {score}%
      </div>
      <span className="text-xs text-nilin-warmGray">{label}</span>
    </div>
  );
}

export default TrustBadge;
