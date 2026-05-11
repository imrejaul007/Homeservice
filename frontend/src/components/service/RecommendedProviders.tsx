import React from 'react';
import { Users, Loader2 } from 'lucide-react';
import ProviderCard from './ProviderCard';

interface Provider {
  id: string;
  firstName: string;
  lastName?: string;
  businessName?: string;
  profilePhoto?: string;
  tier?: 'elite' | 'premium' | 'standard';
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
  startingPrice?: number;
  maxPrice?: number;
}

interface RecommendedProvidersProps {
  providers: Provider[];
  isLoading: boolean;
  onProviderClick: (provider: Provider) => void;
  onViewProfile: (providerId: string) => void;
}

// Loading skeleton with animation
const ProvidersSkeleton: React.FC = () => (
  <section className="py-12 md:py-16 bg-white">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded-lg w-72 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-56 mb-10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="h-52 bg-gradient-to-br from-gray-100 to-gray-200" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
                <div className="h-10 bg-gray-100 rounded-xl mt-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

// No providers available state
const NoProvidersAvailable: React.FC = () => (
  <section className="py-12 md:py-16 bg-white">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-2">
        Recommended Professionals
      </h2>
      <p className="text-gray-500 mb-10">
        Verified experts ready to serve you
      </p>

      <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-10 md:p-14 text-center border-2 border-dashed border-gray-200">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
          <Users className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Coming Soon
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          We're onboarding verified professionals for this service. Check back soon or explore other categories.
        </p>
      </div>
    </div>
  </section>
);

const RecommendedProviders: React.FC<RecommendedProvidersProps> = ({
  providers,
  isLoading,
  onProviderClick,
  onViewProfile,
}) => {
  if (isLoading) {
    return <ProvidersSkeleton />;
  }

  if (!providers || providers.length === 0) {
    return <NoProvidersAvailable />;
  }

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-2">
              Recommended Professionals
            </h2>
            <p className="text-gray-500 text-sm md:text-base">
              Verified experts ready to serve you
            </p>
          </div>

          {providers.length > 3 && (
            <button className="text-indigo-600 font-semibold text-sm hover:text-indigo-700 transition-colors">
              View all ({providers.length})
            </button>
          )}
        </div>

        {/* Provider Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.slice(0, 6).map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onClick={() => onProviderClick(provider)}
              onViewProfile={() => onViewProfile(provider.id)}
            />
          ))}
        </div>

        {/* Show more indicator */}
        {providers.length > 6 && (
          <div className="mt-8 text-center">
            <button className="
              inline-flex items-center gap-2 px-6 py-3
              bg-gray-50 hover:bg-gray-100
              text-gray-700 font-semibold text-sm
              rounded-xl border border-gray-200
              transition-all duration-200
            ">
              <Loader2 className="w-4 h-4" />
              Load more professionals
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default RecommendedProviders;
