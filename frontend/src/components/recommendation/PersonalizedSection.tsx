import React, { useMemo } from 'react';
import { Sparkles, AlertCircle, RefreshCw, ArrowRight, ChevronRight, Star, Image as ImageIcon } from 'lucide-react';
import type { ServiceRecommendation, ProviderRecommendation } from '@/hooks/useRecommendations';
import { useRecommendationFeedback } from '@/hooks/useRecommendations';

// =============================================================================
// Types
// =============================================================================

interface PersonalizedSectionProps {
  title?: string;
  subtitle?: string;
  recommendations: ServiceRecommendation[];
  providerRecommendations?: ProviderRecommendation[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onSeeAll?: () => void;
  onServicePress?: (serviceId: string) => void;
  onProviderPress?: (providerId: string) => void;
  variant?: 'grid' | 'list' | 'compact';
  showReasons?: boolean;
  showMatchFactors?: boolean;
  showProviderCard?: boolean;
  maxItems?: number;
  emptyMessage?: string;
  testID?: string;
}

// =============================================================================
// Personalized Section Component
// =============================================================================

const PersonalizedSection: React.FC<PersonalizedSectionProps> = ({
  title = 'Recommended for You',
  subtitle,
  recommendations,
  providerRecommendations = [],
  isLoading = false,
  error = null,
  onRefresh,
  onSeeAll,
  onServicePress,
  onProviderPress,
  variant = 'grid',
  showReasons = true,
  showMatchFactors = false,
  showProviderCard = false,
  maxItems,
  emptyMessage = 'No personalized recommendations yet',
  testID,
}) => {
  const { trackClick } = useRecommendationFeedback();

  const visibleItems = useMemo(() => {
    return maxItems ? recommendations.slice(0, maxItems) : recommendations;
  }, [recommendations, maxItems]);

  const handleServicePress = (serviceId: string) => {
    trackClick(serviceId);
    if (onServicePress) {
      onServicePress(serviceId);
    } else {
      // Navigate to service page
      window.location.href = `/services/${serviceId}`;
    }
  };

  const handleProviderPress = (providerId: string) => {
    if (onProviderPress) {
      onProviderPress(providerId);
    } else {
      window.location.href = `/provider/${providerId}`;
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6" data-testid={testID}>
        <SectionHeader title={title} subtitle={subtitle} />
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-8 h-8 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-gray-500">Finding best matches for you...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-6" data-testid={testID}>
        <SectionHeader title={title} subtitle={subtitle} />
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-sm text-gray-600">{error}</p>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty state
  if (visibleItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6" data-testid={testID}>
        <SectionHeader title={title} subtitle={subtitle} />
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Sparkles className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-base font-semibold text-gray-500">{emptyMessage}</p>
          <p className="text-sm text-gray-400 mt-1">
            Book more services to get personalized recommendations
          </p>
        </div>
      </div>
    );
  }

  // Content
  return (
    <div className="container mx-auto px-4 py-6" data-testid={testID}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        onSeeAll={onSeeAll && visibleItems.length > 4 ? onSeeAll : undefined}
      />

      {/* Provider Card (if enabled) */}
      {showProviderCard && providerRecommendations.length > 0 && (
        <div className="mb-4">
          <ProviderCard
            provider={providerRecommendations[0]}
            onPress={() => handleProviderPress(providerRecommendations[0].provider._id)}
          />
        </div>
      )}

      {/* Recommendations Grid/List */}
      <div className={`grid gap-3 ${variant === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : variant === 'compact' ? 'grid-cols-1' : 'grid-cols-1'}`}>
        {visibleItems.map((item, index) => (
          <RecommendationListItem
            key={item.service._id}
            recommendation={item}
            variant={variant}
            showReasons={showReasons}
            showMatchFactors={showMatchFactors}
            onPress={() => handleServicePress(item.service._id)}
            isLast={index === visibleItems.length - 1}
          />
        ))}
      </div>

      {/* See All Button (if not shown in header) */}
      {onSeeAll && visibleItems.length <= 4 && (
        <button
          onClick={onSeeAll}
          className="flex items-center justify-center w-full py-4 mt-2 text-blue-600 font-semibold hover:text-blue-700 transition-colors gap-1.5"
        >
          <span>View All Recommendations</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// =============================================================================
// Section Header Component
// =============================================================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  onSeeAll,
}) => (
  <div className="flex items-start justify-between mb-4">
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-gray-500 mt-1 ml-7">{subtitle}</p>}
    </div>
    {onSeeAll && (
      <button
        onClick={onSeeAll}
        className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
      >
        <span>See All</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    )}
  </div>
);

// =============================================================================
// Recommendation List Item Component
// =============================================================================

interface RecommendationListItemProps {
  recommendation: ServiceRecommendation;
  variant: 'grid' | 'list' | 'compact';
  showReasons: boolean;
  showMatchFactors: boolean;
  onPress: () => void;
  isLast: boolean;
}

const RecommendationListItem: React.FC<RecommendationListItemProps> = ({
  recommendation,
  variant,
  showReasons,
  showMatchFactors,
  onPress,
  isLast,
}) => {
  const { service, reasons, matchFactors, score } = recommendation;

  if (variant === 'compact') {
    return (
      <button
        onClick={onPress}
        className="flex items-center w-full bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow text-left"
      >
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
          {service.images?.[0] ? (
            <div className="w-12 h-12 rounded-lg bg-gray-100" />
          ) : (
            <ImageIcon className="w-6 h-6 text-gray-400" />
          )}
        </div>
        <div className="flex-1 ml-3 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{service.name}</p>
          <p className="text-xs text-gray-500">{service.category}</p>
        </div>
        <div className="ml-2">
          <p className="text-sm font-bold text-blue-600">
            {service.price.currency} {service.price.amount}
          </p>
        </div>
      </button>
    );
  }

  if (variant === 'grid') {
    return (
      <button
        onClick={onPress}
        className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-left"
      >
        <div className="h-24 bg-gray-100 flex items-center justify-center relative">
          {service.images?.[0] ? (
            <div className="w-full h-full bg-gray-100" />
          ) : (
            <ImageIcon className="w-8 h-8 text-gray-400" />
          )}
          {service.isFeatured && (
            <span className="absolute top-2 left-2 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">
              Featured
            </span>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-gray-900 line-clamp-2">{service.name}</h3>
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-gray-500">
              {service.rating.average.toFixed(1)}
            </span>
          </div>
          <p className="text-sm font-bold text-blue-600 mt-1">
            {service.price.currency} {service.price.amount}
          </p>
        </div>
      </button>
    );
  }

  // List variant (default)
  return (
    <button
      onClick={onPress}
      className="flex bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow text-left w-full"
    >
      <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center">
        {service.images?.[0] ? (
          <div className="w-16 h-16 rounded-lg bg-gray-100" />
        ) : (
          <ImageIcon className="w-6 h-6 text-gray-400" />
        )}
      </div>
      <div className="flex-1 ml-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">{service.name}</h3>
          <div className="text-center flex-shrink-0">
            <span className="text-sm font-bold text-green-600">{Math.round(score)}%</span>
            <span className="block text-[10px] text-green-600">match</span>
          </div>
        </div>

        <p className="text-xs text-blue-600 font-medium mt-0.5">{service.category}</p>

        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-gray-500">
              {service.rating.average.toFixed(1)} ({service.rating.count})
            </span>
          </div>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">{service.duration} min</span>
        </div>

        {/* Match Factors */}
        {showMatchFactors && matchFactors && (
          <div className="flex gap-1.5 mt-2">
            {matchFactors.categoryMatch && (
              <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs font-medium rounded-full">
                Category
              </span>
            )}
            {matchFactors.historyMatch && (
              <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs font-medium rounded-full">
                Past Booking
              </span>
            )}
          </div>
        )}

        {/* Reasons */}
        {showReasons && reasons.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {reasons.slice(0, 2).map((reason, index) => (
              <p key={index} className="text-xs text-gray-500 italic truncate">
                {reason}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="ml-2 flex-shrink-0 flex items-start pt-0.5">
        <p className="text-sm font-bold text-blue-600">
          {service.price.currency} {service.price.amount}
        </p>
      </div>
    </button>
  );
};

// =============================================================================
// Provider Card Component
// =============================================================================

interface ProviderCardProps {
  provider: ProviderRecommendation;
  onPress: () => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({ provider, onPress }) => {
  const { provider: p, reasons } = provider;

  return (
    <button
      onClick={onPress}
      className="flex items-center w-full bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors text-left"
    >
      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
        <span className="text-lg font-semibold text-white">
          {p.firstName?.[0]}{p.lastName?.[0]}
        </span>
      </div>
      <div className="flex-1 ml-3 min-w-0">
        <p className="font-semibold text-gray-900">
          {p.firstName} {p.lastName}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-gray-500">
            {p.rating.average.toFixed(1)} ({p.rating.count})
          </span>
          <span className="text-gray-300">•</span>
          <span className="text-xs text-gray-500">{p.completedBookings} bookings</span>
        </div>
        {reasons.length > 0 && (
          <p className="text-xs text-blue-600 italic mt-0.5 truncate">{reasons[0]}</p>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
    </button>
  );
};

export default PersonalizedSection;
