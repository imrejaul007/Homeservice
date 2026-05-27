import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PremiumStatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'coral' | 'green' | 'blue' | 'purple';
}

const colorClasses = {
  coral: {
    bg: 'bg-nilin-coral/10',
    icon: 'text-nilin-coral',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
  },
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
  },
};

export function PremiumStatCard({
  title,
  value,
  change,
  icon,
  trend,
  color = 'coral',
}: PremiumStatCardProps) {
  const isPositive = trend === 'up' || (change !== undefined && change >= 0);
  const colorClass = colorClasses[color];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl p-4 shadow-premium-sm"
    >
      <div className="flex items-start justify-between mb-3">
        {/* Icon */}
        {icon && (
          <div className={`w-10 h-10 rounded-xl ${colorClass.bg} flex items-center justify-center`}>
            <span className={colorClass.icon}>{icon}</span>
          </div>
        )}

        {/* Trend indicator */}
        {change !== undefined && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              isPositive
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {isPositive ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            <span>{isPositive ? '+' : ''}{change}%</span>
          </div>
        )}
      </div>

      {/* Value */}
      <h3 className="text-2xl font-bold text-nilin-charcoal mb-1">{value}</h3>

      {/* Title */}
      <p className="text-sm text-nilin-warmGray">{title}</p>
    </motion.div>
  );
}

// Compact stat for grids
export function PremiumStatCardCompact({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-premium-sm flex items-center gap-3">
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-nilin-blush/50 flex items-center justify-center text-nilin-coral">
          {icon}
        </div>
      )}
      <div>
        <p className="text-lg font-bold text-nilin-charcoal">{value}</p>
        <p className="text-xs text-nilin-warmGray">{title}</p>
      </div>
    </div>
  );
}

// Skeleton
export function PremiumStatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-premium-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse" />
        <div className="w-16 h-6 rounded-full bg-gray-200 animate-pulse" />
      </div>
      <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}

export default PremiumStatCard;
