import { motion } from 'framer-motion';
import { Clock, ChevronRight, Star } from 'lucide-react';
import { cardChoreography, badgeReveal, itemReveal } from './motion';

interface AAAServiceCardProps {
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

export function AAAServiceCard({ service, index = 0, onClick }: AAAServiceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 80,
        damping: 16,
        mass: 0.8,
        delay: index * 0.08,
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative bg-white rounded-2xl overflow-hidden shadow-aaa-card cursor-pointer"
    >
      {/* Image with cinematic overlay */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <motion.img
          src={service.image}
          alt={service.name}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.06 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        />

        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#E8B4A8]/5" />

        {/* Rating badge - choreographed reveal */}
        {service.rating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              type: 'spring',
              stiffness: 80,
              damping: 16,
              delay: index * 0.08 + 0.2,
            }}
            className="absolute top-3 right-3"
          >
            <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-aaa-subtle">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-semibold text-[#2D2D2D]">{service.rating}</span>
            </div>
          </motion.div>
        )}

        {/* Price badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 80,
            damping: 16,
            delay: index * 0.08 + 0.3,
          }}
          className="absolute bottom-3 left-3"
        >
          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-aaa-subtle">
            <span className="text-sm font-bold text-[#E8B4A8]">₹{service.price}</span>
          </div>
        </motion.div>
      </div>

      {/* Content - choreographed reveal */}
      <div className="p-4">
        <motion.h3
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 80,
            damping: 16,
            delay: index * 0.08 + 0.35,
          }}
          className="font-semibold text-[#2D2D2D] mb-1 text-[0.9375rem] leading-tight line-clamp-1"
        >
          {service.name}
        </motion.h3>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 80,
            damping: 16,
            delay: index * 0.08 + 0.4,
          }}
          className="text-[#6B6B6B] text-sm leading-relaxed line-clamp-2 mb-3"
        >
          {service.description}
        </motion.p>

        {/* Meta - choreographed */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 80,
            damping: 16,
            delay: index * 0.08 + 0.45,
          }}
          className="flex items-center justify-between"
        >
          {service.duration && (
            <div className="flex items-center gap-1.5 text-[#6B6B6B] text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>{service.duration}</span>
            </div>
          )}

          <motion.span
            whileHover={{ x: 3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="text-[#E8B4A8] text-sm font-medium flex items-center gap-0.5"
          >
            View <ChevronRight className="w-3.5 h-3.5" />
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Skeleton
export function AAAServiceCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-white rounded-2xl overflow-hidden shadow-aaa-card"
    >
      <div
        className="aspect-[4/3] bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0]"
        style={{
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.8s ease-in-out infinite',
        }}
      />
      <div className="p-4 space-y-3">
        <div
          className="h-5 w-3/4 bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] rounded-lg"
          style={{
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s ease-in-out infinite',
            animationDelay: '0.1s',
          }}
        />
        <div
          className="h-4 w-full bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] rounded"
          style={{
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s ease-in-out infinite',
            animationDelay: '0.2s',
          }}
        />
        <div
          className="h-4 w-2/3 bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] rounded"
          style={{
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s ease-in-out infinite',
            animationDelay: '0.3s',
          }}
        />
        <div className="flex justify-between pt-2">
          <div
            className="h-4 w-16 bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] rounded"
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s ease-in-out infinite',
              animationDelay: '0.4s',
            }}
          />
          <div
            className="h-4 w-12 bg-gradient-to-r from-[#F5E6E0] via-[#FDFBF9] to-[#F5E6E0] rounded"
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s ease-in-out infinite',
              animationDelay: '0.5s',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default AAAServiceCard;
