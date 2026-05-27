// Provider Performance Card - Trust scores and tiers
import { motion } from 'framer-motion';
import { Shield, Star, Clock, CheckCircle, Award, TrendingUp } from 'lucide-react';

interface ProviderPerformanceProps {
  provider: {
    id: string;
    name: string;
    avatar?: string;
    rating: number;
    completedJobs: number;
    acceptanceRate: number;
    responseRate: number;
    isVerified: boolean;
    isTopRated: boolean;
    cancellationRate?: number;
    responseTime?: string;
  };
  onClick?: () => void;
}

// Calculate trust score (0-100)
function calculateTrustScore(provider: ProviderPerformanceProps['provider']): number {
  let score = 0;

  // Rating contribution (40%)
  score += Math.min(provider.rating * 20, 40);

  // Completed jobs contribution (20%)
  score += Math.min(provider.completedJobs * 0.5, 20);

  // Acceptance rate contribution (20%)
  score += (provider.acceptanceRate || 95) * 0.2;

  // Response rate contribution (10%)
  score += (provider.responseRate || 95) * 0.1;

  // Verified bonus (10%)
  if (provider.isVerified) score += 10;
  if (provider.isTopRated) score += 10;

  return Math.min(Math.round(score), 100);
}

// Get tier based on score
function getProviderTier(score: number): { name: string; color: string; bgColor: string } {
  if (score >= 90) return { name: 'Top Rated', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
  if (score >= 75) return { name: 'Gold', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
  if (score >= 60) return { name: 'Silver', color: 'text-gray-600', bgColor: 'bg-gray-50' };
  return { name: 'Bronze', color: 'text-amber-600', bgColor: 'bg-amber-50' };
}

export function ProviderPerformanceCard({ provider, onClick }: ProviderPerformanceProps) {
  const trustScore = calculateTrustScore(provider);
  const tier = getProviderTier(trustScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="bg-white rounded-2xl p-4 shadow-aaa-card cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <img
          src={provider.avatar || '/placeholder-provider.jpg'}
          alt={provider.name}
          className="w-14 h-14 rounded-xl object-cover"
        />

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-nilin-charcoal">{provider.name}</h3>
            {provider.isVerified && (
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                <Shield className="w-3 h-3 text-blue-600" />
              </div>
            )}
          </div>

          {/* Tier badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tier.bgColor} ${tier.color}`}>
            {provider.isTopRated && <Award className="w-3 h-3" />}
            {tier.name}
          </span>
        </div>

        {/* Trust score */}
        <div className="text-right">
          <div className="text-2xl font-bold text-nilin-charcoal">{trustScore}%</div>
          <div className="text-xs text-nilin-warmGray">Trust</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="font-semibold text-nilin-charcoal">{provider.rating}</span>
          </div>
          <div className="text-xs text-nilin-warmGray">Rating</div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-nilin-charcoal">{provider.completedJobs}</span>
          </div>
          <div className="text-xs text-nilin-warmGray">Jobs</div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-nilin-charcoal">{provider.acceptanceRate}%</span>
          </div>
          <div className="text-xs text-nilin-warmGray">Accept</div>
        </div>
      </div>

      {/* Response time */}
      {provider.responseTime && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          <TrendingUp className="w-4 h-4 text-nilin-coral" />
          <span className="text-sm text-nilin-warmGray">Responds {provider.responseTime}</span>
        </div>
      )}

      {/* Top rated indicator */}
      {provider.isTopRated && (
        <div className="mt-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
            <Award className="w-4 h-4 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-yellow-800">Top Rated Provider</p>
            <p className="text-xs text-yellow-600">Consistently excellent service</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Provider performance stats for provider dashboard
export function ProviderStatsOverview({ provider }: { provider: ProviderPerformanceProps['provider'] }) {
  const trustScore = calculateTrustScore(provider);
  const tier = getProviderTier(trustScore);

  const stats = [
    { label: 'Trust Score', value: `${trustScore}%`, trend: '+2%', positive: true },
    { label: 'Completed', value: provider.completedJobs.toString(), trend: '+12', positive: true },
    { label: 'Acceptance', value: `${provider.acceptanceRate}%`, trend: provider.acceptanceRate >= 90 ? 'Excellent' : 'Needs work', positive: provider.acceptanceRate >= 90 },
    { label: 'Response', value: `${provider.responseRate}%`, trend: provider.responseRate >= 95 ? 'Fast' : 'Slow', positive: provider.responseRate >= 95 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, index) => (
        <div key={index} className="bg-white rounded-xl p-4 shadow-aaa-subtle">
          <p className="text-xs text-nilin-warmGray mb-1">{stat.label}</p>
          <p className="text-xl font-bold text-nilin-charcoal">{stat.value}</p>
          <p className={`text-xs ${stat.positive ? 'text-green-600' : 'text-yellow-600'}`}>
            {stat.trend}
          </p>
        </div>
      ))}
    </div>
  );
}

export default ProviderPerformanceCard;
