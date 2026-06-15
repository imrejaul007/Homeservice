import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  BadgeCheck,
  Calendar,
  MapPin,
  X,
  Users,
  AlertCircle,
  ChevronRight,
  Award,
  UserCircle,
  Sparkles,
  Search,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  Heart
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';
import { customerDashboardApi, CustomerDashboardApiError, type RecommendedPro } from '../../services/customerDashboardApi';
import { locationService } from '../../services/locationService';
import { usePriceConversion } from '../../utils/priceConverter';

// =============================================================================
// PRICE DISPLAY
// =============================================================================

const ProStartingPrice: React.FC<{
  amount: number;
  sourceCurrency?: string;
  className?: string;
  suffixClassName?: string;
  showSuffix?: boolean;
  align?: 'left' | 'right';
}> = ({
  amount,
  sourceCurrency = 'AED',
  className = 'text-xl font-bold text-nilin-charcoal',
  suffixClassName = 'text-xs text-nilin-warmGray ml-1',
  showSuffix = true,
  align,
}) => {
  const { convert, format, currency } = usePriceConversion();
  return (
    <div className={cn(
      align === 'right' && 'text-right',
      align === 'left' && 'text-left'
    )}>
      <span className={className}>{format(convert(amount, sourceCurrency), currency)}</span>
      {showSuffix && <span className={suffixClassName}>starting</span>}
    </div>
  );
};

// =============================================================================
// TIER CONFIGURATION
// =============================================================================

const TIER_CONFIG = {
  elite: {
    badge: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-white shadow-lg shadow-amber-500/25',
    label: 'Elite',
    borderColor: 'border-amber-200/50',
    bgGradient: 'from-amber-50/80 via-yellow-50/40 to-orange-50/30',
    iconBg: 'bg-gradient-to-br from-amber-500 to-yellow-500',
    iconColor: 'text-white',
    accentColor: 'amber',
    glowColor: 'shadow-amber-500/20',
  },
  premium: {
    badge: 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25',
    label: 'Premium',
    borderColor: 'border-violet-200/50',
    bgGradient: 'from-violet-50/80 via-purple-50/40 to-fuchsia-50/30',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-500',
    iconColor: 'text-white',
    accentColor: 'violet',
    glowColor: 'shadow-violet-500/20',
  },
  standard: {
    badge: 'bg-gradient-to-r from-slate-500 to-gray-500 text-white shadow-lg shadow-slate-500/25',
    label: 'Standard',
    borderColor: 'border-gray-200/50',
    bgGradient: 'from-gray-50/80 via-slate-50/40 to-zinc-50/30',
    iconBg: 'bg-gradient-to-br from-slate-500 to-gray-500',
    iconColor: 'text-white',
    accentColor: 'slate',
    glowColor: 'shadow-slate-500/20',
  },
};

// =============================================================================
// CATEGORY FILTERS
// =============================================================================

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'hair', label: 'Hair', icon: Users },
  { id: 'nails', label: 'Nails', icon: CheckCircle2 },
  { id: 'skincare', label: 'Skincare', icon: Star },
  { id: 'massage', label: 'Massage', icon: Heart },
  { id: 'makeup', label: 'Makeup', icon: Award },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Generate a consistent color from a name string */
const getAvatarColor = (name: string): string => {
  const colors = [
    'from-indigo-500 to-purple-500',
    'from-pink-500 to-rose-500',
    'from-amber-500 to-orange-500',
    'from-emerald-500 to-teal-500',
    'from-blue-500 to-cyan-500',
    'from-violet-500 to-fuchsia-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

/** Get initials from name */
const getInitials = (firstName?: string, lastName?: string, businessName?: string): string => {
  if (businessName) {
    const words = businessName.split(' ');
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return businessName.substring(0, 2).toUpperCase();
  }
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return (first + last).toUpperCase() || 'PR';
};

// =============================================================================
// SKELETON LOADER
// =============================================================================

const ProCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-nilin-border/20 p-5 animate-pulse">
    <div className="flex items-start gap-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300" />
      <div className="flex-1 space-y-3">
        <div className="h-6 bg-gray-200 rounded-lg w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-7 bg-gray-100 rounded-full w-20" />
          <div className="h-7 bg-gray-100 rounded-full w-16" />
        </div>
      </div>
    </div>
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
      <div className="h-5 bg-gray-100 rounded w-24" />
      <div className="h-10 bg-gray-100 rounded-xl w-28" />
    </div>
  </div>
);

// =============================================================================
// CONSTANTS
// =============================================================================

const SKELETON_COUNT = 4;
const HEADER_HEIGHT = 280; // px offset for scroll area calculation

// =============================================================================
// RECENT PRO CARD COMPONENT - Larger, more prominent for "Book Again"
// =============================================================================

interface RecentProCardProps {
  pro: RecommendedPro;
  onBook: (pro: RecommendedPro) => void;
  onViewProfile: (pro: RecommendedPro) => void;
}

const RecentProCard: React.FC<RecentProCardProps> = ({ pro, onBook, onViewProfile }) => {
  const tier = pro.tier || 'standard';
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.standard;
  const displayName = pro.businessName || `${pro.firstName} ${pro.lastName || ''}`.trim() || 'Professional';
  const initials = getInitials(pro.firstName, pro.lastName, pro.businessName);
  const avatarColor = getAvatarColor(displayName);

  // Get lowest price from services
  const getNumericPrice = (price: number | { amount: number; currency?: string; type?: string }): number => {
    return typeof price === 'number' ? price : price.amount;
  };
  const validPrices = pro.services
    ?.map(s => getNumericPrice(s.price))
    .filter(p => typeof p === 'number' && Number.isFinite(p) && p >= 0) || [];
  const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border',
        tierConfig.borderColor,
        'bg-gradient-to-br',
        tierConfig.bgGradient,
        'transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group'
      )}
      onClick={() => onViewProfile(pro)}
    >
      {/* Decorative corner gradient */}
      <div className={cn(
        'absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/40 to-transparent rounded-bl-full',
        tier === 'elite' && 'from-amber-200/40',
        tier === 'premium' && 'from-violet-200/40',
      )} />

      <div className="relative p-5">
        {/* Top row: Avatar + info */}
        <div className="flex items-start gap-4">
          {/* Avatar with glow effect */}
          <div className="relative flex-shrink-0">
            {pro.avatar ? (
              <img
                src={pro.avatar}
                alt={displayName}
                className={cn(
                  'w-20 h-20 rounded-2xl object-cover',
                  'ring-4 ring-white',
                  'shadow-lg',
                  'group-hover:scale-105 transition-transform duration-300'
                )}
              />
            ) : (
              <div className={cn(
                'w-20 h-20 rounded-2xl bg-gradient-to-br',
                avatarColor,
                'flex items-center justify-center',
                'ring-4 ring-white',
                'shadow-lg',
                'group-hover:scale-105 transition-transform duration-300'
              )}>
                <span className="text-white font-bold text-2xl">{initials}</span>
              </div>
            )}

            {/* Verified badge - larger */}
            {pro.isVerified && (
              <div className={cn(
                'absolute -bottom-1.5 -right-1.5 w-7 h-7',
                tier === 'elite' ? 'bg-gradient-to-br from-amber-500 to-yellow-500' : 'bg-emerald-500',
                'rounded-full flex items-center justify-center',
                'border-3 border-white',
                'shadow-lg'
              )}>
                <BadgeCheck className="w-4 h-4 text-white" />
              </div>
            )}

            {/* Tier badge - positioned at top of avatar */}
            <div className={cn(
              'absolute -top-1.5 -left-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
              tierConfig.badge
            )}>
              {tierConfig.label}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-2">
            <h3 className={cn(
              'font-bold text-nilin-charcoal text-lg mb-1',
              'group-hover:text-nilin-coral transition-colors',
              'truncate'
            )}>
              {displayName}
            </h3>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-2">
              {pro.averageRating > 0 ? (
                <>
                  <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-nilin-charcoal text-sm">{pro.averageRating.toFixed(1)}</span>
                  </div>
                  <span className="text-nilin-warmGray text-xs">({pro.totalReviews} reviews)</span>
                </>
              ) : (
                <span className="text-xs text-nilin-warmGray bg-white/60 px-2 py-1 rounded-lg">New on NILIN</span>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs">
              {pro.completedJobs > 0 && (
                <span className="flex items-center gap-1.5 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className={cn('w-3.5 h-3.5', tier === 'elite' ? 'text-amber-500' : tier === 'premium' ? 'text-violet-500' : 'text-slate-500')} />
                  <span className="text-nilin-charcoal font-medium">{pro.completedJobs} jobs</span>
                </span>
              )}
              {pro.distance !== undefined && (
                <span className="flex items-center gap-1.5 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                  <MapPin className={cn('w-3.5 h-3.5', tier === 'elite' ? 'text-amber-500' : tier === 'premium' ? 'text-violet-500' : 'text-slate-500')} />
                  <span className="text-nilin-charcoal font-medium">
                    {pro.distance < 1 ? '<1' : pro.distance.toFixed(1)} km
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom row: Services + Price + CTAs */}
        <div className="mt-4 pt-4 border-t border-white/40">
          <div className="flex items-center justify-between">
            {/* Services preview */}
            <div className="flex items-center gap-2">
              {pro.services?.slice(0, 2).map((service) => (
                <span
                  key={service.name}
                  className="px-2.5 py-1 bg-white/80 backdrop-blur-sm text-nilin-charcoal text-xs rounded-full border border-nilin-border/20 font-medium"
                >
                  {service.name}
                </span>
              ))}
              {pro.services && pro.services.length > 2 && (
                <span className="px-2.5 py-1 bg-nilin-blush/60 text-nilin-rose text-xs rounded-full font-medium">
                  +{pro.services.length - 2}
                </span>
              )}
            </div>

            {/* Price */}
            {lowestPrice !== null && (
              <ProStartingPrice amount={lowestPrice} align="right" />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={(e) => { e.stopPropagation(); onViewProfile(pro); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5',
                'bg-white border border-nilin-border/30',
                'rounded-xl font-semibold text-sm text-nilin-charcoal',
                'hover:bg-nilin-blush/30 focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 focus:ring-offset-2',
                'transition-all duration-200',
                'group/btn'
              )}
            >
              <span>View Profile</span>
              <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onBook(pro); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5',
                tier === 'elite'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600'
                  : tier === 'premium'
                    ? 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600'
                    : 'bg-gradient-to-r from-nilin-coral to-nilin-rose hover:from-nilin-rose hover:to-nilin-coral',
                'rounded-xl font-semibold text-sm text-white',
                'shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nilin-coral/50',
                'transition-all duration-200',
                'transform hover:scale-[1.02] active:scale-[0.98]'
              )}
            >
              <Calendar className="w-4 h-4" />
              <span>Book Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// PRO CARD COMPONENT - Enhanced grid card
// =============================================================================

interface ProCardProps {
  pro: RecommendedPro;
  onBook: (pro: RecommendedPro) => void;
  onViewProfile: (pro: RecommendedPro) => void;
  isCompact?: boolean;
}

const ProCard: React.FC<ProCardProps> = ({ pro, onBook, onViewProfile, isCompact = false }) => {
  const tier = pro.tier || 'standard';
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.standard;
  const displayName = pro.businessName || `${pro.firstName} ${pro.lastName || ''}`.trim() || 'Professional';
  const initials = getInitials(pro.firstName, pro.lastName, pro.businessName);
  const avatarColor = getAvatarColor(displayName);

  // Get lowest price from services - use consistent helper like RecentProCard
  const getNumericPrice = (price: number | { amount: number; currency?: string; type?: string }): number => {
    return typeof price === 'number' ? price : price.amount;
  };
  const validPrices = pro.services
    ?.map(s => getNumericPrice(s.price))
    .filter(p => typeof p === 'number' && Number.isFinite(p) && p >= 0) || [];
  const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

  // Get top 3 service names
  const serviceNames = pro.services?.slice(0, 3).map(s => s.name) || [];

  if (isCompact) {
    // Compact horizontal card for smaller displays
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border',
          tierConfig.borderColor,
          'bg-gradient-to-br',
          tierConfig.bgGradient,
          'p-3',
          'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer group'
        )}
        onClick={() => onViewProfile(pro)}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {pro.avatar ? (
              <img
                src={pro.avatar}
                alt={displayName}
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow"
              />
            ) : (
              <div className={cn(
                'w-12 h-12 rounded-xl bg-gradient-to-br',
                avatarColor,
                'flex items-center justify-center ring-2 ring-white shadow'
              )}>
                <span className="text-white font-bold text-sm">{initials}</span>
              </div>
            )}
            {pro.isVerified && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                <BadgeCheck className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="font-semibold text-nilin-charcoal text-sm truncate group-hover:text-nilin-coral transition-colors">
                {displayName}
              </h3>
              <span className={cn('px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide flex-shrink-0', tierConfig.badge)}>
                {tierConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              {pro.averageRating > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                  <span className="font-medium">{pro.averageRating.toFixed(1)}</span>
                </span>
              )}
              {pro.completedJobs > 0 && (
                <span className="text-nilin-warmGray">{pro.completedJobs} jobs</span>
              )}
            </div>
          </div>

          {/* Price + Book */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {lowestPrice !== null && (
              <ProStartingPrice
                amount={lowestPrice}
                className="font-bold text-nilin-charcoal text-sm"
                showSuffix={false}
              />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onBook(pro); }}
              className={cn(
                'p-1.5 rounded-lg',
                tier === 'elite'
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : tier === 'premium'
                    ? 'bg-violet-500 hover:bg-violet-600'
                    : 'bg-nilin-coral hover:bg-nilin-rose',
                'text-white transition-colors'
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full card
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border',
        tierConfig.borderColor,
        'bg-gradient-to-br',
        tierConfig.bgGradient,
        'transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group'
      )}
      onClick={() => onViewProfile(pro)}
    >
      {/* Decorative elements */}
      <div className={cn(
        'absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/50 to-transparent rounded-bl-full',
        tier === 'elite' && 'from-amber-200/50',
        tier === 'premium' && 'from-violet-200/50',
      )} />

      <div className="relative p-5">
        {/* Top row: Avatar + info */}
        <div className="flex items-start gap-4">
          {/* Avatar with glow */}
          <div className="relative flex-shrink-0">
            {pro.avatar ? (
              <img
                src={pro.avatar}
                alt={displayName}
                className={cn(
                  'w-16 h-16 rounded-2xl object-cover',
                  'ring-3 ring-white',
                  'shadow-lg',
                  'group-hover:scale-105 transition-transform duration-300'
                )}
              />
            ) : (
              <div className={cn(
                'w-16 h-16 rounded-2xl bg-gradient-to-br',
                avatarColor,
                'flex items-center justify-center',
                'ring-3 ring-white',
                'shadow-lg',
                'group-hover:scale-105 transition-transform duration-300'
              )}>
                <span className="text-white font-bold text-lg">{initials}</span>
              </div>
            )}

            {/* Verified badge */}
            {pro.isVerified && (
              <div className={cn(
                'absolute -bottom-1 -right-1 w-6 h-6',
                tier === 'elite' ? 'bg-gradient-to-br from-amber-500 to-yellow-500' : 'bg-emerald-500',
                'rounded-full flex items-center justify-center',
                'border-2 border-white',
                'shadow-md'
              )}>
                <BadgeCheck className="w-3.5 h-3.5 text-white" />
              </div>
            )}

            {/* Tier badge */}
            <div className={cn(
              'absolute -top-1.5 -left-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider',
              tierConfig.badge
            )}>
              {tierConfig.label}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              'font-bold text-nilin-charcoal text-base mb-1',
              'group-hover:text-nilin-coral transition-colors truncate'
            )}>
              {displayName}
            </h3>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-1.5">
              {pro.averageRating > 0 ? (
                <>
                  <div className="flex items-center gap-0.5 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded-lg">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-nilin-charcoal text-xs">{pro.averageRating.toFixed(1)}</span>
                  </div>
                  <span className="text-nilin-warmGray text-[10px]">({pro.totalReviews})</span>
                </>
              ) : (
                <span className="text-[10px] text-nilin-warmGray bg-white/60 px-1.5 py-0.5 rounded-lg">New</span>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 text-[10px]">
              {pro.completedJobs > 0 && (
                <span className="flex items-center gap-1 bg-white/70 px-1.5 py-0.5 rounded-md">
                  <CheckCircle2 className={cn('w-3 h-3', tier === 'elite' ? 'text-amber-500' : tier === 'premium' ? 'text-violet-500' : 'text-slate-500')} />
                  <span className="font-medium">{pro.completedJobs} jobs</span>
                </span>
              )}
              {pro.distance !== undefined && (
                <span className="flex items-center gap-1 bg-white/70 px-1.5 py-0.5 rounded-md">
                  <MapPin className={cn('w-3 h-3', tier === 'elite' ? 'text-amber-500' : tier === 'premium' ? 'text-violet-500' : 'text-slate-500')} />
                  <span className="font-medium">{pro.distance < 1 ? '<1' : pro.distance.toFixed(1)} km</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Services tags */}
        {serviceNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {serviceNames.map((serviceName) => (
              <span
                key={serviceName}
                className="px-2 py-0.5 bg-white/80 text-nilin-charcoal text-[10px] rounded-full border border-nilin-border/20 font-medium"
              >
                {serviceName}
              </span>
            ))}
            {pro.services && pro.services.length > 3 && (
              <span className="px-2 py-0.5 bg-nilin-blush/60 text-nilin-rose text-[10px] rounded-full font-medium">
                +{pro.services.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Bottom row: Price + CTA */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/40">
          <div>
            {lowestPrice !== null ? (
              <ProStartingPrice
                amount={lowestPrice}
                className="text-lg font-bold text-nilin-charcoal"
                suffixClassName="text-[10px] text-nilin-warmGray ml-1"
              />
            ) : (
              <span className="text-xs text-nilin-warmGray">Contact for pricing</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onViewProfile(pro); }}
              className="px-3 py-1.5 text-xs font-medium text-nilin-coral hover:text-nilin-rose transition-colors rounded-lg hover:bg-nilin-coral/10"
            >
              Profile
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onBook(pro); }}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white',
                'shadow-md hover:shadow-lg transition-all duration-200',
                tier === 'elite'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600'
                  : tier === 'premium'
                    ? 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600'
                    : 'bg-gradient-to-r from-nilin-coral to-nilin-rose hover:from-nilin-rose hover:to-nilin-coral',
                'transform hover:scale-105 active:scale-95'
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

interface EmptyStateProps {
  onBrowse: () => void;
  onClose: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onBrowse, onClose }) => (
  <div className="rounded-2xl border border-nilin-border/30 bg-gradient-to-br from-nilin-blush/30 via-white to-nilin-peach/20 p-10 text-center">
    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 mx-auto mb-5 flex items-center justify-center">
      <Users className="w-10 h-10 text-nilin-coral/70" />
    </div>
    <h3 className="font-bold text-nilin-charcoal text-xl mb-2">No professionals found</h3>
    <p className="text-sm text-nilin-warmGray mb-6 max-w-sm mx-auto">
      We're curating amazing professionals for you. Try adjusting your filters or check back soon!
    </p>
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={onClose}
        className="px-5 py-2.5 text-sm font-medium text-nilin-warmGray hover:text-nilin-charcoal transition-colors rounded-xl hover:bg-nilin-blush/30"
      >
        Close
      </button>
      <button
        onClick={onBrowse}
        className="px-5 py-2.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold"
      >
        Browse Services
      </button>
    </div>
  </div>
);

// =============================================================================
// ERROR STATE COMPONENT
// =============================================================================

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
  onLogin?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, onLogin }) => (
  <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50/50 to-red-100/30 p-8 text-center">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-red-200 mx-auto mb-4 flex items-center justify-center">
      <AlertCircle className="w-8 h-8 text-red-500" />
    </div>
    <h3 className="font-semibold text-red-700 mb-2 text-lg">Unable to load professionals</h3>
    <p className="text-sm text-red-600/80 mb-5">
      {message || 'Please check your connection and try again.'}
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      {onLogin && (
        <button
          type="button"
          onClick={onLogin}
          className="px-5 py-2.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold"
        >
          Sign In
        </button>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="px-5 py-2.5 border border-red-300 text-red-700 rounded-xl hover:bg-red-100 transition-all text-sm font-medium"
      >
        Try Again
      </button>
    </div>
  </div>
);

// =============================================================================
// MODAL OVERLAY
// =============================================================================

const ModalOverlay = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50',
        'bg-nilin-charcoal/50',
        'backdrop-blur-md',
        'data-[state=closed]:animate-fade-out',
        'data-[state=open]:animate-fade-in',
        className
      )}
    />
  )
);
ModalOverlay.displayName = 'ModalOverlay';

// =============================================================================
// MAIN VIEW PRO MODAL COMPONENT
// =============================================================================

interface ViewProModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  limit?: number;
}

const ViewProModal: React.FC<ViewProModalProps> = ({
  open,
  onOpenChange,
  limit = 12
}) => {
  const navigate = useNavigate();
  const abortControllerRef = useRef<AbortController | null>(null);

  // State
  const [pros, setPros] = useState<RecommendedPro[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<RecommendedPro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter pros based on search and category
  const filteredPros = useMemo(() => {
    let filtered = pros;

    // Filter by category (if pro has categories/services)
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(pro =>
        pro.services?.some(s =>
          s.name?.toLowerCase().includes(selectedCategory) ||
          s.category?.toLowerCase().includes(selectedCategory) ||
          s.name?.toLowerCase().split(' ').some(word => word === selectedCategory) ||
          s.category?.toLowerCase().split(' ').some(word => word === selectedCategory)
        )
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pro =>
        pro.businessName?.toLowerCase().includes(query) ||
        pro.firstName?.toLowerCase().includes(query) ||
        pro.lastName?.toLowerCase().includes(query) ||
        pro.services?.some(s => s.name?.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [pros, searchQuery, selectedCategory]);

  // Fetch recommended pros with AbortController for race condition prevention
  const fetchPros = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Get user's current location for distance calculation
      let userLocation: { latitude: number; longitude: number } | undefined;
      try {
        const location = await locationService.getCurrentLocation();
        if (location?.coordinates) {
          userLocation = {
            latitude: location.coordinates.latitude,
            longitude: location.coordinates.longitude,
          };
        }
      } catch (locError) {
        // Continue without location - distance won't be shown
      }

      const { pros: recommendedPros, recentlyUsed: recent } = await customerDashboardApi.getRecommendedPros(limit, userLocation);
      // Only update state if request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        setPros(recommendedPros || []);
        setRecentlyUsed(recent || []);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (err instanceof CustomerDashboardApiError && err.statusCode === 401) {
        setError('Your session expired. Please sign in again to view professionals.');
      } else if (err instanceof CustomerDashboardApiError && err.statusCode === 404) {
        setError('No professionals are available in your area yet. Try again later.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load professionals');
      }
      setPros([]);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [limit]);

  // Fetch on open, cleanup on close
  useEffect(() => {
    if (open) {
      fetchPros();
      // Reset filters
      setSearchQuery('');
      setSelectedCategory('all');
    }
  }, [open, fetchPros]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setPros([]);
      setRecentlyUsed([]);
      setError(null);
      setLoading(false);
      setSearchQuery('');
      setSelectedCategory('all');
    }
  }, [open]);

  // Handle book action - navigate to search with provider pre-selected
  const handleBook = (pro: RecommendedPro) => {
    navigate(`/search?provider=${pro.userId}`);
    onOpenChange?.(false);
  };

  // Handle view profile action
  const handleViewProfile = (pro: RecommendedPro) => {
    navigate(`/provider/${pro.userId}`);
    onOpenChange?.(false);
  };

  // Handle browse all
  const handleBrowseAll = () => {
    navigate('/search');
    onOpenChange?.(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <ModalOverlay />
        <DialogPrimitive.Content
          aria-labelledby='view-pro-modal-title'
          className={cn(
            'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
            'bg-white',
            'border border-nilin-border',
            'rounded-3xl',
            'shadow-2xl shadow-nilin-charcoal/20',
            'w-full',
            'max-w-4xl',
            'max-h-[90vh]',
            'overflow-hidden',
            'focus:outline-none',
            'data-[state=closed]:animate-modal-scale-out',
            'data-[state=open]:animate-modal-scale-in',
          )}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-5 border-b border-nilin-border/20 bg-gradient-to-r from-nilin-blush/30 via-white to-nilin-peach/20">
            {/* Decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-50/50 via-transparent to-pink-50/50 pointer-events-none" />

            {/* Close button */}
            <DialogPrimitive.Close
              className={cn(
                'absolute right-4 top-4',
                'p-2.5 h-auto min-h-0',
                'flex items-center justify-center',
                'rounded-full',
                'bg-white/80 backdrop-blur-sm',
                'text-nilin-warmGray hover:text-nilin-charcoal',
                'hover:bg-white hover:shadow-md',
                'transition-all duration-200'
              )}
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>

            {/* Title section */}
            <div className="flex items-center gap-4 pr-12">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <UserCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <DialogPrimitive.Title id='view-pro-modal-title' className="text-2xl font-bold text-nilin-charcoal">
                  Find Your Professional
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm text-nilin-warmGray mt-0.5 flex items-center gap-2">
                  <span>Discover verified experts tailored for you</span>
                  <BadgeCheck className="w-4 h-4 text-emerald-500" />
                </DialogPrimitive.Description>
              </div>
            </div>

            {/* Search bar */}
            <div className="mt-4 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
              <input
                type="text"
                placeholder="Search by name, service, or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-12 pr-4 py-3',
                  'bg-white/90 backdrop-blur-sm',
                  'border border-nilin-border/30',
                  'rounded-xl',
                  'text-sm text-nilin-charcoal',
                  'placeholder:text-nilin-warmGray/70',
                  'focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral/50',
                  'transition-all duration-200'
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-nilin-blush/50 text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category filters */}
            <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 [-webkit-scrollbar:hidden] [scrollbar-width:none]">
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isActive = selectedCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium',
                      'whitespace-nowrap transition-all duration-200',
                      'border',
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-md'
                        : 'bg-white/80 text-nilin-charcoal border-nilin-border/30 hover:border-nilin-coral/30 hover:bg-nilin-blush/30'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{category.label}</span>
                  </button>
                );
              })}

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium',
                  'whitespace-nowrap transition-all duration-200 border',
                  showFilters
                    ? 'bg-nilin-coral text-white border-nilin-coral'
                    : 'bg-white/80 text-nilin-charcoal border-nilin-border/30 hover:border-nilin-coral/30 hover:bg-nilin-blush/30'
                )}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {/* Body content */}
          <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: `calc(90vh - ${HEADER_HEIGHT}px)` }}>
            {/* Loading state */}
            {loading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                  <ProCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <ErrorState
                message={error}
                onRetry={fetchPros}
                onLogin={error.includes('sign in') ? () => { onOpenChange?.(false); navigate('/login'); } : undefined}
              />
            )}

            {/* Empty state */}
            {!loading && !error && pros.length === 0 && (
              <EmptyState onBrowse={handleBrowseAll} onClose={() => onOpenChange?.(false)} />
            )}

            {/* Recently Booked / Book Again section - Featured cards */}
            {!loading && !error && recentlyUsed.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-nilin-coral" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-nilin-charcoal">Book Again</h3>
                    <p className="text-xs text-nilin-warmGray">Your recently booked professionals</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {recentlyUsed.slice(0, 4).map((pro) => (
                    <RecentProCard
                      key={pro._id}
                      pro={pro}
                      onBook={handleBook}
                      onViewProfile={handleViewProfile}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Filtered results info */}
            {!loading && !error && filteredPros.length > 0 && (searchQuery || selectedCategory !== 'all') && (
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-nilin-warmGray">
                  Showing <span className="font-semibold text-nilin-charcoal">{filteredPros.length}</span> result{filteredPros.length !== 1 ? 's' : ''}
                  {searchQuery && <> for "<span className="font-medium">{searchQuery}</span>"</>}
                  {selectedCategory !== 'all' && <> in <span className="font-medium capitalize">{selectedCategory}</span></>}
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                  className="text-sm text-nilin-coral hover:text-nilin-rose font-medium"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Pros grid */}
            {!loading && !error && filteredPros.length > 0 && (
              <>
                {/* Results header */}
                {!recentlyUsed.length && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-nilin-coral" />
                      <span className="text-base font-semibold text-nilin-charcoal">
                        {filteredPros.length} Professional{filteredPros.length !== 1 ? 's' : ''} Available
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-nilin-warmGray bg-white/80 px-3 py-1.5 rounded-lg border border-nilin-border/20">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Top rated & verified</span>
                    </div>
                  </div>
                )}

                {/* Grid - 2 columns on larger screens */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredPros.map((pro) => (
                    <ProCard
                      key={pro._id}
                      pro={pro}
                      onBook={handleBook}
                      onViewProfile={handleViewProfile}
                    />
                  ))}
                </div>

                {/* View all button */}
                {pros.length >= limit && (
                  <div className="mt-8 pt-6 border-t border-nilin-border/20 text-center">
                    <button
                      onClick={handleBrowseAll}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-2xl text-sm font-semibold hover:shadow-xl hover:shadow-nilin-coral/30 transition-all duration-300 transform hover:scale-105 active:scale-95"
                    >
                      <span>View All Professionals</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* No results after filtering */}
            {!loading && !error && pros.length > 0 && filteredPros.length === 0 && (
              <div className="rounded-2xl border border-nilin-border/30 bg-nilin-blush/20 p-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-nilin-coral/10 mx-auto mb-4 flex items-center justify-center">
                  <Search className="w-8 h-8 text-nilin-coral/60" />
                </div>
                <h3 className="font-semibold text-nilin-charcoal mb-2">No matches found</h3>
                <p className="text-sm text-nilin-warmGray mb-4">
                  Try adjusting your search or filters
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                  className="px-5 py-2.5 bg-nilin-coral text-white rounded-xl hover:bg-nilin-rose transition-colors text-sm font-medium"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-nilin-border/20 bg-gradient-to-r from-nilin-blush/30 via-white to-nilin-peach/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs text-nilin-warmGray">
                All professionals are verified and background-checked
              </p>
            </div>
            <DialogPrimitive.Close
              className="px-4 py-2 text-sm font-medium text-nilin-warmGray hover:text-nilin-charcoal transition-colors rounded-lg hover:bg-nilin-blush/50"
            >
              Close
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ViewProModal;
