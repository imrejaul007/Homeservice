import { motion } from 'framer-motion';
import { Star, Clock, ChevronRight } from 'lucide-react';

interface PremiumServiceCardProps {
  service: {
    id: string;
    name: string;
    description: string;
    image: string;
    rating?: number;
    duration?: string;
    price: number;
  };
  onClick?: () => void;
}

export function PremiumServiceCard({ service, onClick }: PremiumServiceCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-premium-md cursor-pointer"
    >
      {/* Image with overlay gradient */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={service.image}
          alt={service.name}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Rating badge */}
        {service.rating && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <Star size={12} className="text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-semibold text-nilin-charcoal">{service.rating}</span>
          </div>
        )}

        {/* Price tag */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm">
          <span className="text-sm font-bold text-nilin-coral">₹{service.price}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-nilin-charcoal mb-1 line-clamp-1 text-base">
          {service.name}
        </h3>
        <p className="text-sm text-nilin-warmGray mb-3 line-clamp-2 leading-relaxed">
          {service.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          {service.duration && (
            <div className="flex items-center gap-1.5 text-nilin-warmGray text-xs bg-nilin-blush/50 px-2.5 py-1 rounded-lg">
              <Clock size={12} />
              <span>{service.duration}</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-nilin-coral text-sm font-medium">
            <span>Book</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Skeleton version
export function PremiumServiceCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-premium-md">
      <div className="h-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-pulse" />
        <div className="h-4 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-pulse" />
        <div className="flex justify-between items-center">
          <div className="h-6 w-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-pulse" />
          <div className="h-6 w-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default PremiumServiceCard;
