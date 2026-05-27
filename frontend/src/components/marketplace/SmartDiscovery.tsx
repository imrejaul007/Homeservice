// Smart Discovery Section - AI-powered recommendations
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MapPin, TrendingUp, Heart } from 'lucide-react';
import { recommendationEngine } from '../../services/marketplace/RecommendationEngine';
import { useRetentionStore } from '../../services/product/RetentionService';

interface SmartDiscoveryProps {
  services: any[];
  onServiceClick?: (service: any) => void;
  title?: string;
  maxItems?: number;
}

const reasonConfig = {
  personalized: { icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50', label: 'For you' },
  nearby: { icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Near you' },
  trending: { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', label: 'Trending' },
  popular: { icon: Heart, color: 'text-nilin-coral', bg: 'bg-nilin-blush', label: 'Popular' },
};

export function SmartDiscovery({
  services,
  onServiceClick,
  title = 'Recommended for you',
  maxItems = 6
}: SmartDiscoveryProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { recentlyViewed, engagement } = useRetentionStore();

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        // Update context
        recommendationEngine.updateContext({
          browsingHistory: recentlyViewed.filter(r => r.type === 'service').map(r => r.id),
          favorites: engagement.favoriteServices,
        });

        const recs = await recommendationEngine.getServiceRecommendations(services, maxItems);
        setRecommendations(recs);
      } catch (error) {
        console.error('Recommendations error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (services.length > 0) {
      fetchRecommendations();
    }
  }, [services, recentlyViewed, engagement.favoriteServices]);

  if (isLoading || recommendations.length === 0) {
    return null;
  }

  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-nilin-coral" />
          <h2 className="text-lg font-semibold text-nilin-charcoal">{title}</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4">
        {recommendations.map((rec, index) => {
          const service = services.find(s => s.id === rec.id);
          if (!service) return null;

          const reasonStyle = (reasonConfig as Record<string, typeof reasonConfig.popular>)[rec.reason] || reasonConfig.popular;
          const ReasonIcon = reasonStyle.icon;

          return (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onServiceClick?.(service)}
              className="relative bg-white rounded-2xl overflow-hidden shadow-aaa-card cursor-pointer"
            >
              {/* Image */}
              <div className="relative aspect-[4/3]">
                <img
                  src={service.image || '/placeholder.jpg'}
                  alt={service.name}
                  className="w-full h-full object-cover"
                />

                {/* Reason badge */}
                <div className={`absolute top-2 left-2 ${reasonStyle.bg} ${reasonStyle.color} px-2 py-0.5 rounded-full flex items-center gap-1 text-xs font-medium`}>
                  <ReasonIcon className="w-3 h-3" />
                  <span>{reasonStyle.label}</span>
                </div>

                {/* Price */}
                <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <span className="text-sm font-bold text-nilin-coral">₹{service.price}</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-3">
                <h3 className="font-medium text-sm text-nilin-charcoal line-clamp-1">
                  {service.name}
                </h3>
                {service.rating && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-yellow-500">★</span>
                    <span className="text-xs text-nilin-warmGray">{service.rating}</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

export default SmartDiscovery;
