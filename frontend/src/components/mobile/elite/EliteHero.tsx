import { motion } from 'framer-motion';
import { Star, Shield, Clock } from 'lucide-react';
import { springs, orbAnimation } from './animations';

interface EliteHeroProps {
  title: string;
  subtitle?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  showTrustIndicators?: boolean;
  backgroundImage?: string;
}

export function EliteHero({
  title,
  subtitle,
  ctaText,
  onCtaClick,
  showTrustIndicators = true,
  backgroundImage,
}: EliteHeroProps) {
  return (
    <div className="relative min-h-[480px] overflow-hidden">
      {/* Multi-layer background */}
      <div className="absolute inset-0 bg-ambient-warm" />

      {/* Animated gradient orbs */}
      <motion.div
        {...orbAnimation}
        className="absolute top-0 right-0 w-80 h-80 bg-[#E8B4A8]/10 rounded-full blur-3xl"
      />
      <motion.div
        {...orbAnimation}
        transition={{ ...orbAnimation.transition, delay: 2 }}
        className="absolute bottom-0 left-0 w-64 h-64 bg-[#D4A89A]/10 rounded-full blur-3xl"
      />

      {/* Background image overlay */}
      {backgroundImage && (
        <>
          <img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#F5E6E0]/90 via-[#FAE5E0]/90 to-[#FDFBF9]/90" />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 px-6 py-16">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.1 }}
        >
          <span className="text-xs font-semibold tracking-[0.15em] text-[#E8B4A8] uppercase">
            Home Services
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.2 }}
          className="text-hero font-display text-[#2D2D2D] mt-2 mb-4"
        >
          {title}
        </motion.h1>

        {/* Subtitle */}
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.gentle, delay: 0.3 }}
            className="text-body text-[#6B6B6B] mb-8 max-w-sm"
          >
            {subtitle}
          </motion.p>
        )}

        {/* CTA Button */}
        {ctaText && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ ...springs.snappy, delay: 0.4 }}
            onClick={onCtaClick}
            className="w-full py-4 bg-[#E8B4A8] text-white rounded-2xl font-semibold text-base shadow-elite-glow"
          >
            {ctaText}
          </motion.button>
        )}

        {/* Trust indicators */}
        {showTrustIndicators && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-6 mt-8"
          >
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium text-[#2D2D2D]">4.8 Rating</span>
            </div>
            <div className="w-px h-4 bg-gray-300" />
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-[#2D2D2D]">Verified</span>
            </div>
            <div className="w-px h-4 bg-gray-300" />
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-[#2D2D2D]">24/7</span>
            </div>
          </motion.div>
        )}

        {/* Floating badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
          className="absolute top-6 right-6"
        >
          <div className="bg-white/80 backdrop-blur-md rounded-2xl px-4 py-2 shadow-elite-sm">
            <p className="text-xs text-[#6B6B6B]">Welcome</p>
            <p className="text-sm font-bold text-[#E8B4A8]">NILIN</p>
          </div>
        </motion.div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 375 32" className="w-full" fill="none">
          <path d="M0 32L187.5 0L375 32H0Z" fill="#FDFBF9" />
        </svg>
      </div>
    </div>
  );
}

export default EliteHero;
