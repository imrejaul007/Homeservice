import { motion } from 'framer-motion';
import { Clock, ChevronRight, Star } from 'lucide-react';
import { springs, staggerItem } from './animations';

interface EliteServiceCardProps {
  service: {
    id: string;
    name: string;
    description: string;
    image: string;
    rating?: number;
    duration?: string;
    price: number;
  };
  index?: number;
  onClick?: () => void;
}

export function EliteServiceCard({ service, index = 0, onClick }: EliteServiceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...springs.balanced,
        delay: index * 0.06,
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      layout
      onClick={onClick}
      className="relative bg-white rounded-2xl overflow-hidden shadow-elite-md cursor-pointer"
    >
      {/* Image with gradient overlay */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <motion.img
          src={service.image}
          alt={service.name}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.4 }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent" />

        {/* Rating badge - positioned elegantly */}
        {service.rating && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 + 0.2 }}
            className="absolute top-3 right-3"
          >
            <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-elite-sm">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-semibold text-[#2D2D2D]">{service.rating}</span>
            </div>
          </motion.div>
        )}

        {/* Price badge - bottom left */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.06 + 0.3 }}
          className="absolute bottom-3 left-3"
        >
          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-elite-sm">
            <span className="text-sm font-bold text-[#E8B4A8]">₹{service.price}</span>
          </div>
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-[#2D2D2D] mb-1 text-[0.9375rem] leading-tight line-clamp-1">
          {service.name}
        </h3>
        <p className="text-[#6B6B6B] text-sm leading-relaxed line-clamp-2 mb-3">
          {service.description}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between">
          {service.duration && (
            <div className="flex items-center gap-1.5 text-[#6B6B6B] text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>{service.duration}</span>
            </div>
          )}
          <motion.span
            whileHover={{ x: 2 }}
            className="text-[#E8B4A8] text-sm font-medium flex items-center gap-0.5"
          >
            View <ChevronRight className="w-3.5 h-3.5" />
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}

// Skeleton
export function EliteServiceCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.06 }}
      className="bg-white rounded-2xl overflow-hidden shadow-elite-md"
    >
      <div
        className="aspect-[4/3] bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] animate-pulse"
        style={{
          backgroundSize: '200% 100%',
        }}
      />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] rounded animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] rounded animate-pulse" />
        </div>
        <div className="flex justify-between pt-2">
          <div className="h-4 w-16 bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] rounded animate-pulse" />
          <div className="h-4 w-12 bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] rounded animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

export default EliteServiceCard;
