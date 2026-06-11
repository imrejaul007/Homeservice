import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, BadgeCheck, Calendar, MapPin, ChevronRight, Users, Loader2, AlertCircle, Sparkles, Heart } from 'lucide-react';
import { FadeSection } from '../ui/FadeSection';
import { customerDashboardApi, type RecommendedPro } from '../../services/customerDashboardApi';
import { locationService } from '../../services/locationService';
import { usePriceConversion } from '../../utils/priceConverter';

// =============================================================================
// TIER CONFIGURATION
// =============================================================================

const TIER_CONFIG = {
  elite: {
    badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
    label: 'Elite',
    borderColor: 'border-amber-300/50',
    bgGradient: 'from-amber-50/80 to-yellow-50/60',
    accentColor: 'text-amber-600',
    glowColor: 'shadow-amber-200/50',
    icon: <Sparkles className="w-3 h-3" />,
  },
  premium: {
    badge: 'bg-gradient-to-r from-violet-500 to-purple-500 text-white',
    label: 'Premium',
    borderColor: 'border-violet-300/50',
    bgGradient: 'from-violet-50/80 to-purple-50/60',
    accentColor: 'text-violet-600',
    glowColor: 'shadow-violet-200/50',
    icon: <BadgeCheck className="w-3 h-3" />,
  },
  standard: {
    badge: 'bg-gradient-to-r from-slate-400 to-gray-500 text-white',
    label: 'Standard',
    borderColor: 'border-gray-200',
    bgGradient: 'from-gray-50/80 to-slate-50/60',
    accentColor: 'text-slate-600',
    glowColor: 'shadow-gray-200/50',
    icon: null,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getAvatarColor = (name: string): string => {
  const colors = [
    'from-indigo-500 to-purple-500',
    'from-pink-500 to-rose-500',
    'from-amber-500 to-orange-500',
    'from-emerald-500 to-teal-500',
    'from-blue-500 to-cyan-500',
    'from-violet-500 to-fuchsia-500',
    'from-rose-400 to-pink-500',
    'from-cyan-400 to-blue-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

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
  <div className="bg-white rounded-2xl border border-nilin-border/30 p-5 animate-pulse shadow-sm">
    <div className="flex items-start gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="flex gap-2 mt-3">
          <div className="h-6 bg-gray-100 rounded-full w-16" />
          <div className="h-6 bg-gray-100 rounded-full w-20" />
        </div>
      </div>
    </div>
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
  const { convert, format, currency } = usePriceConversion();
  const tier = pro.tier || 'standard';
  const tierConfig = TIER_CONFIG[tier];
  const displayName = pro.businessName || `${pro.firstName} ${pro.lastName || ''}`.trim() || 'Professional';
  const initials = getInitials(pro.firstName, pro.lastName, pro.businessName);
  const avatarColor = getAvatarColor(displayName);

  const getNumericPrice = (price: number | { amount: number; currency?: string; type?: string; }): number => {
    return typeof price === 'number' ? price : price.amount;
  };
  const lowestPrice = pro.services && pro.services.length > 0
    ? Math.min(...pro.services.map(s => getNumericPrice(s.price)))
    : null;
  const lowestPriceSource = pro.services?.[0]?.price
    && typeof pro.services[0].price === 'object'
    && pro.services[0].price.currency
    ? pro.services[0].price.currency
    : 'AED';
  const displayStartingPrice = lowestPrice != null
    ? format(convert(lowestPrice, lowestPriceSource), currency)
    : null;

  const serviceNames = pro.services?.slice(0, 3).map(s => s.name) || [];
  const isTopPro = tier === 'elite' || pro.averageRating >= 4.8;

  return (
    <FadeSection delay={index * 100}>
      <div
        className={`relative overflow-hidden rounded-2xl border ${tierConfig.borderColor}
                    bg-gradient-to-br ${tierConfig.bgGradient}
                    transition-all duration-300 hover:shadow-nilin-lg hover:-translate-y-1.5 group cursor-pointer`}
        onClick={() => onViewProfile(pro)}
      >
        {/* Top Pro Badge */}
        {isTopPro && (
          <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-amber-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl flex items-center gap-1 shadow-lg z-10">
            <Sparkles className="w-3 h-3" />
            TOP PRO
          </div>
        )}

        <div className="p-5">
          {/* Avatar + Info Row */}
          <div className="flex items-start gap-4">
            {/* Avatar with ring */}
            <div className="relative flex-shrink-0">
              <div className="relative">
                {pro.avatar ? (
                  <img
                    src={pro.avatar}
                    alt={displayName}
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white shadow-md group-hover:ring-nilin-coral/30 transition-all"
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center ring-2 ring-white shadow-md group-hover:ring-nilin-coral/30 transition-all`}>
                    <span className="text-white font-bold text-lg">{initials}</span>
                  </div>
                )}

                {/* Online/Available indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm" title="Available" />
              </div>

              {/* Verified badge */}
              {pro.isVerified && (
                <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center border-2 border-white shadow-lg shadow-emerald-200/50">
                  <BadgeCheck className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            {/* Info Column */}
            <div className="flex-1 min-w-0 pt-1">
              {/* Name + Tier Badge */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-bold text-nilin-charcoal truncate group-hover:text-nilin-coral transition-colors text-base">
                  {displayName}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 flex-shrink-0 ${tierConfig.badge}`}>
                  {tierConfig.icon}
                  {tierConfig.label}
                </span>
              </div>

              {/* Rating Row */}
              <div className="flex items-center gap-2 mb-2">
                {pro.averageRating > 0 ? (
                  <>
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="font-bold text-nilin-charcoal text-sm">{pro.averageRating.toFixed(1)}</span>
                    </div>
                    <span className="text-nilin-warmGray text-xs">({pro.totalReviews} reviews)</span>
                  </>
                ) : (
                  <span className="text-nilin-warmGray text-xs bg-slate-100 px-2 py-0.5 rounded-full">New on NILIN</span>
                )}
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4 text-xs text-nilin-warmGray">
                {pro.completedJobs > 0 && (
                  <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-full">
                    <Users className="w-3 h-3" />
                    {pro.completedJobs} jobs
                  </span>
                )}
                {pro.distance !== undefined && (
                  <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-full">
                    <MapPin className="w-3 h-3" />
                    {pro.distance < 1 ? '<1' : pro.distance.toFixed(1)} km
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Services Tags */}
          {serviceNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {serviceNames.map((serviceName, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-white/80 backdrop-blur-sm text-nilin-charcoal text-xs rounded-full border border-nilin-border/30 hover:border-nilin-coral/50 hover:text-nilin-coral transition-colors cursor-default"
                >
                  {serviceName}
                </span>
              ))}
              {pro.services && pro.services.length > 3 && (
                <span className="px-3 py-1 bg-nilin-coral/10 text-nilin-coral text-xs rounded-full font-medium">
                  +{pro.services.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Bottom: Price + CTA */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-nilin-border/20">
            <div>
              {displayStartingPrice ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-nilin-charcoal">{displayStartingPrice}</span>
                  <span className="text-nilin-warmGray text-xs">starting</span>
                </div>
              ) : (
                <span className="text-sm text-nilin-warmGray">Contact for pricing</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onViewProfile(pro); }}
                className="px-3 py-2 text-sm font-medium text-nilin-coral hover:text-nilin-rose hover:bg-nilin-coral/5 rounded-lg transition-colors"
              >
                View Profile
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onBook(pro); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-nilin-coral/25 transition-all active:scale-95"
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
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  onBrowse: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onBrowse }) => (
  <div className="rounded-2xl border-2 border-dashed border-nilin-border/50 bg-gradient-to-br from-white to-gray-50 p-10 text-center">
    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-nilin-blush/60 to-nilin-coral/20 mx-auto mb-5 flex items-center justify-center">
      <Users className="w-10 h-10 text-nilin-coral/70" />
    </div>
    <h3 className="font-bold text-nilin-charcoal text-lg mb-2">No recommendations yet</h3>
    <p className="text-sm text-nilin-warmGray mb-6 max-w-sm mx-auto">
      Book your first service and we'll recommend the best professionals for you
    </p>
    <button
      onClick={onBrowse}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl hover:shadow-lg transition-all font-medium"
    >
      Browse Services
      <ChevronRight className="w-4 h-4" />
    </button>
  </div>
);

// =============================================================================
// ERROR STATE
// =============================================================================

interface ErrorStateProps {
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ onRetry }) => (
  <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50/50 to-red-100/30 p-8 text-center">
    <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
      <AlertCircle className="w-8 h-8 text-red-500" />
    </div>
    <h3 className="font-bold text-red-700 mb-2">Unable to load professionals</h3>
    <p className="text-sm text-red-600/80 mb-5">
      Please check your connection and try again
    </p>
    <button
      onClick={onRetry}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-medium"
    >
      <Loader2 className="w-4 h-4" />
      Try Again
    </button>
  </div>
);

// =============================================================================
// SECTION HEADER
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
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-4">
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 flex items-center justify-center">
          <span className="text-nilin-coral">{icon}</span>
        </div>
      )}
      <div>
        <h2 className="text-2xl font-serif font-bold text-nilin-charcoal">{title}</h2>
        {badge && (
          <span className="text-sm text-nilin-warmGray mt-0.5 block">{badge}</span>
        )}
      </div>
    </div>
    {action && (
      <button
        onClick={action.onClick}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-nilin-coral hover:text-nilin-rose hover:bg-nilin-coral/5 rounded-xl transition-all group"
      >
        {action.label}
        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
    )}
  </div>
);

// =============================================================================
// MAIN COMPONENT
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

  const [pros, setPros] = useState<RecommendedPro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPros = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
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
        console.warn('Could not get user location:', locError);
      }

      const { pros: recommendedPros } = await customerDashboardApi.getRecommendedPros(limit, userLocation);
      setPros(recommendedPros || []);
    } catch (err) {
      console.error('Error fetching recommended pros:', err);
      setError(err instanceof Error ? err.message : 'Failed to load professionals');
      setPros([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchPros();
  }, [fetchPros]);

  const handleBook = (pro: RecommendedPro) => {
    navigate(`/search?provider=${pro.userId}`);
  };

  const handleViewProfile = (pro: RecommendedPro) => {
    navigate(`/provider/${pro.userId}`);
  };

  const handleViewAll = () => {
    navigate('/search?filter=recommended');
  };

  if (loading) {
    return (
      <section className="py-12 px-4 bg-gradient-to-b from-nilin-cream to-white">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title="Recommended for You"
            icon={<Users className="w-5 h-5" />}
            badge="Based on your preferences"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <RecommendedProCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-12 px-4 bg-gradient-to-b from-nilin-cream to-white">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title="Recommended for You"
            icon={<Users className="w-5 h-5" />}
          />
          <ErrorState onRetry={fetchPros} />
        </div>
      </section>
    );
  }

  if (pros.length === 0) {
    return (
      <section className="py-12 px-4 bg-gradient-to-b from-nilin-cream to-white">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title="Recommended for You"
            icon={<Users className="w-5 h-5" />}
          />
          <EmptyState onBrowse={() => navigate('/search')} />
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-4 bg-gradient-to-b from-nilin-cream to-white">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          title="Recommended for You"
          icon={<Heart className="w-5 h-5" />}
          badge={pros.length > 0 ? `${pros.length} professionals matched to your preferences` : undefined}
          action={
            showViewAll && pros.length > 3
              ? { label: 'View all professionals', onClick: handleViewAll }
              : undefined
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
    </section>
  );
};

export default RecommendedProsSection;