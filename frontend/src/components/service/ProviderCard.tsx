import React from 'react';
import { Star, BadgeCheck, ChevronRight } from 'lucide-react';

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

interface ProviderCardProps {
  provider: Provider;
  onClick: () => void;
  onViewProfile: () => void;
  currency?: string;
}

const TIER_CONFIG = {
  elite: {
    badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
    label: 'Elite',
  },
  premium: {
    badge: 'bg-gradient-to-r from-violet-500 to-purple-500 text-white',
    label: 'Premium',
  },
  standard: {
    badge: 'bg-gray-500 text-white',
    label: 'Standard',
  },
};

// Generate a consistent color from a name string
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

const getInitials = (provider: Provider): string => {
  if (provider.businessName) {
    const words = provider.businessName.split(' ');
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return provider.businessName.substring(0, 2).toUpperCase();
  }
  const first = provider.firstName?.[0] || '';
  const last = provider.lastName?.[0] || '';
  return (first + last).toUpperCase() || 'PR';
};

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  onClick,
  onViewProfile,
  currency = 'AED'
}) => {
  const tier = provider.tier || 'standard';
  const tierConfig = TIER_CONFIG[tier];
  const displayName = provider.businessName || `${provider.firstName} ${provider.lastName || ''}`.trim() || 'Professional';
  const minPrice = provider.startingPrice || 500;
  const rating = provider.rating || 0;
  const reviewCount = provider.reviewCount || 0;
  const initials = getInitials(provider);
  const avatarColor = getAvatarColor(displayName);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group overflow-hidden"
    >
      <div className="p-5">
        {/* Top row: Avatar + info */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {provider.profilePhoto ? (
              <img
                src={provider.profilePhoto}
                alt={displayName}
                className="w-16 h-16 rounded-2xl object-cover"
              />
            ) : (
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center`}>
                <span className="text-white font-bold text-lg">{initials}</span>
              </div>
            )}
            {provider.isVerified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                <BadgeCheck className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-gray-900 truncate group-hover:text-nilin-primary transition-colors">
                {displayName}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${tierConfig.badge}`}>
                {tierConfig.label}
              </span>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-2">
              {rating > 0 ? (
                <>
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="font-semibold text-gray-900 text-sm">{rating.toFixed(1)}</span>
                  </div>
                  {reviewCount > 0 && (
                    <span className="text-gray-400 text-xs">({reviewCount} reviews)</span>
                  )}
                </>
              ) : (
                <span className="text-gray-400 text-xs">New on NILIN</span>
              )}
            </div>

            {/* Verified badge */}
            {provider.isVerified && (
              <span className="text-emerald-600 text-xs font-medium">Verified by NILIN</span>
            )}
          </div>
        </div>

        {/* Bottom row: Price + CTA */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div>
            <span className="text-lg font-bold text-gray-900">{currency} {minPrice}</span>
            <span className="text-gray-400 text-xs ml-1">onwards</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile();
            }}
            className="flex items-center gap-1 px-4 py-2 bg-nilin-primary/10 text-nilin-primary rounded-full text-sm font-semibold hover:bg-nilin-primary hover:text-white transition-all"
          >
            View Profile
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProviderCard;
