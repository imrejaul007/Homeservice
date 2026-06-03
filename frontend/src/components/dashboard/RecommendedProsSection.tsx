import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, BadgeCheck, Calendar, MapPin, ChevronRight, Users, Loader2, AlertCircle } from 'lucide-react';
import { FadeSection } from '../ui/FadeSection';
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
  },
  premium: {
    badge: 'bg-gradient-to-r from-violet-500 to-purple-500 text-white',
    label: 'Premium',
    borderColor: 'border-violet-200',
    bgGradient: 'from-violet-50/50 to-purple-50/50',
  },
  standard: {
    badge: 'bg-gray-500 text-white',
    label: 'Standard',
    borderColor: 'border-gray-200',
    bgGradient: 'from-gray-50/50 to-slate-50/50',
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

const RecommendedProCardSkeleton: React.FC = () => (
  <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-nilin-border/50 p-5 animate-pulse">
    <div className="flex items-start gap-4">
      {/* Avatar skeleton */}
      <div className="w-16 h-16 rounded-2xl bg-gray-200 flex-shrink-0" />

      {/* Content skeleton */}
      <div className="flex-1 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="flex gap-2 mt-3">
          <div className="h-6 bg-gray-100 rounded-full w-16" />
          <div className="h-6 bg-gray-100 rounded-full w-20" />
        </div>
      </div>
    </div>

    {/* Bottom actions skeleton */}
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
      <div className="h-4 bg-gray-100 rounded w-20" />
      <div className="h-10 bg-gray-100 rounded-xl w-24" />
    </div>
  </div>
);

// =============================================================================
// PRO CARD COMPONENT
// =============================================================================

interface RecommendedProCardProps {
  pro: RecommendedPro;
  onBook: (pro: RecommendedPro) => void;
  onViewProfile: (pro: RecommendedPro) => void;
  index: number;
}

const RecommendedProCard: React.FC<RecommendedProCardProps> = ({
  pro,
  onBook,
  onViewProfile,
  index
}) => {
  const [isHovered, setIsHovered] = useState(false);

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
    <FadeSection delay={index * 100}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative overflow-hidden rounded-2xl border ${tierConfig.borderColor}
                    bg-gradient-to-br ${tierConfig.bgGradient}
                    transition-all duration-300 hover:shadow-nilin-lg hover:-translate-y-1`}
      >
        <div className="p-5">
          {/* Top row: Avatar + info */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {pro.avatar ? (
                <img
                  src={pro.avatar}
                  alt={displayName}
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/50"
                />
              ) : (
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center ring-2 ring-white/50`}>
                  <span className="text-white font-bold text-lg">{initials}</span>
                </div>
              )}

              {/* Verified badge */}
              {pro.isVerified && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  <BadgeCheck className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-bold text-nilin-charcoal truncate group-hover:text-nilin-coral transition-colors">
                  {displayName}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${tierConfig.badge}`}>
                  {tierConfig.label}
                </span>
              </div>

              {/* Rating and reviews */}
              <div className="flex items-center gap-2 mb-2">
                {pro.averageRating > 0 ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="font-semibold text-nilin-charcoal text-sm">{pro.averageRating.toFixed(1)}</span>
                    </div>
                    <span className="text-nilin-warmGray text-xs">({pro.totalReviews} reviews)</span>
                  </>
                ) : (
                  <span className="text-nilin-warmGray text-xs">New on NILIN</span>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-nilin-warmGray">
                {pro.completedJobs > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {pro.completedJobs} jobs
                  </span>
                )}
                {pro.distance !== undefined && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {pro.distance < 1 ? '<1' : pro.distance.toFixed(1)} km
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Services tags */}
          {serviceNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {serviceNames.map((serviceName, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-white/60 text-nilin-charcoal text-xs rounded-full border border-nilin-border/30"
                >
                  {serviceName}
                </span>
              ))}
              {pro.services && pro.services.length > 3 && (
                <span className="px-2 py-0.5 bg-nilin-blush/40 text-nilin-rose text-xs rounded-full">
                  +{pro.services.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Bottom row: Price + CTA */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/30">
            <div>
              {lowestPrice !== null ? (
                <>
                  <span className="text-lg font-bold text-nilin-charcoal">AED {lowestPrice}</span>
                  <span className="text-nilin-warmGray text-xs ml-1">starting</span>
                </>
              ) : (
                <span className="text-sm text-nilin-warmGray">Contact for pricing</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onViewProfile(pro)}
                className="px-3 py-2 text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
              >
                View Profile
              </button>
              <button
                onClick={() => onBook(pro)}
                className="flex items-center gap-1.5 px-4 py-2 bg-nilin-coral text-white rounded-xl text-sm font-semibold hover:bg-nilin-rose transition-all shadow-sm hover:shadow-md"
              >
                <Calendar className="w-4 h-4" />
                Book
              </button>
            </div>
          </div>
        </div>
      </div>
    </FadeSection>
  );
};

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

interface EmptyStateProps {
  onBrowse: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onBrowse }) => (
  <div className="rounded-2xl border border-nilin-border/50 bg-white/40 p-8 text-center">
    <div className="w-16 h-16 rounded-full bg-nilin-blush/50 mx-auto mb-4 flex items-center justify-center">
      <Users className="w-8 h-8 text-nilin-coral/60" />
    </div>
    <h3 className="font-semibold text-nilin-charcoal mb-2">No recommended professionals yet</h3>
    <p className="text-sm text-nilin-warmGray mb-4 max-w-xs mx-auto">
      Our professionals will appear here once you book your first service
    </p>
    <button
      onClick={onBrowse}
      className="px-4 py-2 bg-nilin-coral text-white rounded-xl hover:bg-nilin-rose transition-colors text-sm font-medium"
    >
      Browse Services
    </button>
  </div>
);

// =============================================================================
// ERROR STATE COMPONENT
// =============================================================================

interface ErrorStateProps {
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ onRetry }) => (
  <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center">
    <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
      <AlertCircle className="w-8 h-8 text-red-500" />
    </div>
    <h3 className="font-semibold text-red-700 mb-2">Unable to load professionals</h3>
    <p className="text-sm text-red-600/80 mb-4">
      Please check your connection and try again
    </p>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm font-medium"
    >
      Try Again
    </button>
  </div>
);

// =============================================================================
// SECTION HEADER COMPONENT
// =============================================================================

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  badge?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  action,
  badge
}) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
          <span className="text-purple-600">{icon}</span>
        </div>
      )}
      <div>
        <h2 className="text-lg font-serif font-medium text-nilin-charcoal">{title}</h2>
        {badge && (
          <span className="text-xs text-nilin-warmGray">{badge}</span>
        )}
      </div>
    </div>
    {action && (
      <button
        onClick={action.onClick}
        className="flex items-center gap-1 text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors group"
      >
        {action.label}
        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    )}
  </div>
);

// =============================================================================
// MAIN RECOMMENDED PROS SECTION COMPONENT
// =============================================================================

interface RecommendedProsSectionProps {
  limit?: number;
  showViewAll?: boolean;
}

const RecommendedProsSection: React.FC<RecommendedProsSectionProps> = ({
  limit = 6,
  showViewAll = true
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

  // Initial load
  useEffect(() => {
    fetchPros();
  }, [fetchPros]);

  // Handle book action - navigate to search with provider pre-selected
  const handleBook = (pro: RecommendedPro) => {
    // Navigate to search with the provider's ID to pre-select them
    navigate(`/search?provider=${pro.userId}`);
  };

  // Handle view profile action
  const handleViewProfile = (pro: RecommendedPro) => {
    navigate(`/providers/${pro.userId}`);
  };

  // Handle browse all
  const handleViewAll = () => {
    navigate('/search?filter=recommended');
  };

  // Render loading state
  if (loading) {
    return (
      <div>
        <SectionHeader
          title="Recommended for You"
          icon={<Users className="w-5 h-5" />}
          badge="Based on your booking history"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <RecommendedProCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div>
        <SectionHeader
          title="Recommended for You"
          icon={<Users className="w-5 h-5" />}
        />
        <ErrorState onRetry={fetchPros} />
      </div>
    );
  }

  // Render empty state
  if (pros.length === 0) {
    return (
      <div>
        <SectionHeader
          title="Recommended for You"
          icon={<Users className="w-5 h-5" />}
        />
        <EmptyState onBrowse={() => navigate('/search')} />
      </div>
    );
  }

  // Render pros grid
  return (
    <div>
      <SectionHeader
        title="Recommended for You"
        icon={<Users className="w-5 h-5" />}
        badge={pros.length > 0 ? `${pros.length} professionals` : undefined}
        action={
          showViewAll && pros.length > 3
            ? { label: 'View all', onClick: handleViewAll }
            : undefined
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pros.map((pro, index) => (
          <RecommendedProCard
            key={pro._id}
            pro={pro}
            index={index}
            onBook={handleBook}
            onViewProfile={handleViewProfile}
          />
        ))}
      </div>
    </div>
  );
};

export default RecommendedProsSection;
