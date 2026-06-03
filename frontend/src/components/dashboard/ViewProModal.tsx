import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  BadgeCheck,
  Calendar,
  MapPin,
  X,
  Users,
  Loader2,
  AlertCircle,
  ChevronRight,
  Award,
  Gem,
  Sparkles
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';
import { customerDashboardApi, type RecommendedPro } from '../../services/customerDashboardApi';

// =============================================================================
// TIER CONFIGURATION
// =============================================================================

const TIER_CONFIG = {
  elite: {
    badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
    label: 'Elite',
    borderColor: 'border-amber-200',
    bgGradient: 'from-amber-50/50 to-yellow-50/50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  premium: {
    badge: 'bg-gradient-to-r from-violet-500 to-purple-500 text-white',
    label: 'Premium',
    borderColor: 'border-violet-200',
    bgGradient: 'from-violet-50/50 to-purple-50/50',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  standard: {
    badge: 'bg-gray-500 text-white',
    label: 'Standard',
    borderColor: 'border-gray-200',
    bgGradient: 'from-gray-50/50 to-slate-50/50',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
};

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
  <div className="bg-white/80 rounded-xl border border-nilin-border/30 p-4 animate-pulse">
    <div className="flex items-start gap-4">
      {/* Avatar skeleton */}
      <div className="w-14 h-14 rounded-xl bg-gray-200 flex-shrink-0" />

      {/* Content skeleton */}
      <div className="flex-1 space-y-2.5">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="flex gap-2 mt-2">
          <div className="h-6 bg-gray-100 rounded-full w-16" />
          <div className="h-6 bg-gray-100 rounded-full w-20" />
        </div>
      </div>
    </div>

    {/* Bottom actions skeleton */}
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
      <div className="h-4 bg-gray-100 rounded w-20" />
      <div className="h-9 bg-gray-100 rounded-lg w-24" />
    </div>
  </div>
);

// =============================================================================
// PRO CARD COMPONENT
// =============================================================================

interface ProCardProps {
  pro: RecommendedPro;
  onBook: (pro: RecommendedPro) => void;
  onViewProfile: (pro: RecommendedPro) => void;
}

const ProCard: React.FC<ProCardProps> = ({ pro, onBook, onViewProfile }) => {
  const tier = pro.tier || 'standard';
  const tierConfig = TIER_CONFIG[tier];
  const displayName = pro.businessName || `${pro.firstName} ${pro.lastName || ''}`.trim() || 'Professional';
  const initials = getInitials(pro.firstName, pro.lastName, pro.businessName);
  const avatarColor = getAvatarColor(displayName);

  // Get lowest price from services
  const lowestPrice = pro.services && pro.services.length > 0
    ? Math.min(...pro.services.map(s => s.price))
    : null;

  // Get top 3 service names
  const serviceNames = pro.services?.slice(0, 3).map(s => s.name) || [];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${tierConfig.borderColor}
                  bg-gradient-to-br ${tierConfig.bgGradient}
                  transition-all duration-200 hover:shadow-nilin-md hover:-translate-y-0.5`}
    >
      <div className="p-4">
        {/* Top row: Avatar + info */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {pro.avatar ? (
              <img
                src={pro.avatar}
                alt={displayName}
                className="w-14 h-14 rounded-xl object-cover ring-2 ring-white/50"
              />
            ) : (
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center ring-2 ring-white/50`}>
                <span className="text-white font-bold text-base">{initials}</span>
              </div>
            )}

            {/* Verified badge */}
            {pro.isVerified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                <BadgeCheck className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-nilin-charcoal text-sm truncate">
                {displayName}
              </h3>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold flex-shrink-0 ${tierConfig.badge}`}>
                {tierConfig.label}
              </span>
            </div>

            {/* Rating and reviews */}
            <div className="flex items-center gap-2 mb-1.5">
              {pro.averageRating > 0 ? (
                <>
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="font-semibold text-nilin-charcoal text-xs">{pro.averageRating.toFixed(1)}</span>
                  </div>
                  <span className="text-nilin-warmGray text-[10px]">({pro.totalReviews} reviews)</span>
                </>
              ) : (
                <span className="text-nilin-warmGray text-[10px]">New on NILIN</span>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 text-[10px] text-nilin-warmGray">
              {pro.completedJobs > 0 && (
                <span className="flex items-center gap-0.5">
                  <Users className="w-2.5 h-2.5" />
                  {pro.completedJobs} jobs
                </span>
              )}
              {pro.distance !== undefined && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {pro.distance < 1 ? '<1' : pro.distance.toFixed(1)} km
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Services tags */}
        {serviceNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {serviceNames.map((serviceName, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-white/60 text-nilin-charcoal text-[10px] rounded-full border border-nilin-border/30"
              >
                {serviceName}
              </span>
            ))}
            {pro.services && pro.services.length > 3 && (
              <span className="px-2 py-0.5 bg-nilin-blush/40 text-nilin-rose text-[10px] rounded-full">
                +{pro.services.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Bottom row: Price + CTA */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/30">
          <div>
            {lowestPrice !== null ? (
              <>
                <span className="text-base font-bold text-nilin-charcoal">AED {lowestPrice}</span>
                <span className="text-nilin-warmGray text-[10px] ml-1">starting</span>
              </>
            ) : (
              <span className="text-xs text-nilin-warmGray">Contact for pricing</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onViewProfile(pro)}
              className="px-2.5 py-1.5 text-xs font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
            >
              Profile
            </button>
            <button
              onClick={() => onBook(pro)}
              className="flex items-center gap-1 px-3 py-1.5 bg-nilin-coral text-white rounded-lg text-xs font-semibold hover:bg-nilin-rose transition-all shadow-sm hover:shadow-md"
            >
              <Calendar className="w-3 h-3" />
              Book
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
  <div className="rounded-xl border border-nilin-border/30 bg-nilin-blush/20 p-8 text-center">
    <div className="w-14 h-14 rounded-full bg-nilin-coral/10 mx-auto mb-4 flex items-center justify-center">
      <Users className="w-7 h-7 text-nilin-coral/60" />
    </div>
    <h3 className="font-semibold text-nilin-charcoal mb-2">No professionals available</h3>
    <p className="text-xs text-nilin-warmGray mb-5 max-w-xs mx-auto">
      We're curating professionals for you. Check back soon!
    </p>
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={onClose}
        className="px-4 py-2 text-sm font-medium text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
      >
        Close
      </button>
      <button
        onClick={onBrowse}
        className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors text-sm font-medium"
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
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ onRetry }) => (
  <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 text-center">
    <div className="w-12 h-12 rounded-full bg-red-100 mx-auto mb-3 flex items-center justify-center">
      <AlertCircle className="w-6 h-6 text-red-500" />
    </div>
    <h3 className="font-semibold text-red-700 mb-1 text-sm">Unable to load professionals</h3>
    <p className="text-xs text-red-600/80 mb-4">
      Please check your connection
    </p>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
    >
      Try Again
    </button>
  </div>
);

// =============================================================================
// MODAL OVERLAY
// =============================================================================

const ModalOverlay: React.FC<{ className?: string }> = ({ className }) => (
  <DialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50',
      'bg-nilin-charcoal/40',
      'backdrop-blur-sm',
      '-webkit-backdrop-blur-sm',
      'data-[state=closed]:animate-fade-out',
      'data-[state=open]:animate-fade-in',
      className
    )}
  />
);

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

  // State
  const [pros, setPros] = useState<RecommendedPro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch recommended pros
  const fetchPros = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await customerDashboardApi.getRecommendedPros(limit);
      setPros(data || []);
    } catch (err) {
      console.error('Error fetching recommended pros:', err);
      setError(err instanceof Error ? err.message : 'Failed to load professionals');
      setPros([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Fetch on open
  useEffect(() => {
    if (open) {
      fetchPros();
    }
  }, [open, fetchPros]);

  // Handle book action - navigate to search with provider pre-selected
  const handleBook = (pro: RecommendedPro) => {
    navigate(`/search?provider=${pro.userId}`);
    onOpenChange?.(false);
  };

  // Handle view profile action
  const handleViewProfile = (pro: RecommendedPro) => {
    navigate(`/providers/${pro.userId}`);
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
          className={cn(
            'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
            'bg-white',
            'border border-[#E8E4E0]',
            'rounded-nilin-lg',
            'shadow-nilin-warm-lg',
            'w-full',
            'max-w-2xl',
            'max-h-[85vh]',
            'overflow-hidden',
            'focus:outline-none',
            'data-[state=closed]:animate-modal-scale-out',
            'data-[state=open]:animate-modal-scale-in',
          )}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-nilin-border/30">
            {/* Close button */}
            <DialogPrimitive.Close
              className={cn(
                'absolute right-4 top-4',
                'p-2 h-auto min-h-0',
                'flex items-center justify-center',
                'rounded-full',
                'text-nilin-warmGray hover:text-nilin-charcoal',
                'hover:bg-nilin-blush/50',
                'transition-all duration-200'
              )}
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>

            {/* Title section */}
            <div className="flex items-center gap-3 pr-10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                <Gem className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-xl font-semibold text-nilin-charcoal font-serif">
                  View Pro
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-nilin-warmGray mt-0.5">
                  Recommended verified professionals for you
                </DialogPrimitive.Description>
              </div>
            </div>
          </div>

          {/* Body content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-140px)]">
            {/* Loading state */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <ProCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <ErrorState onRetry={fetchPros} />
            )}

            {/* Empty state */}
            {!loading && !error && pros.length === 0 && (
              <EmptyState onBrowse={handleBrowseAll} onClose={() => onOpenChange?.(false)} />
            )}

            {/* Pros grid */}
            {!loading && !error && pros.length > 0 && (
              <>
                {/* Results header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-nilin-coral" />
                    <span className="text-sm font-medium text-nilin-charcoal">
                      {pros.length} professional{pros.length !== 1 ? 's' : ''} found
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-nilin-warmGray">
                    <Award className="w-3.5 h-3.5" />
                    <span>Top rated in your area</span>
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pros.map((pro) => (
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
                  <div className="mt-6 pt-4 border-t border-nilin-border/20 text-center">
                    <button
                      onClick={handleBrowseAll}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-nilin-coral text-white rounded-xl text-sm font-semibold hover:bg-nilin-rose transition-all shadow-sm hover:shadow-md"
                    >
                      <span>View All Professionals</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-nilin-border/30 bg-nilin-cream/50 flex items-center justify-between">
            <p className="text-xs text-nilin-warmGray">
              All professionals are verified and background-checked
            </p>
            <DialogPrimitive.Close
              className="px-4 py-2 text-sm font-medium text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
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
