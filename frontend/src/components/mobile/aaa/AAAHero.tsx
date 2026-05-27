import { motion } from 'framer-motion';
import { Star, Shield, Clock } from 'lucide-react';
import { useScroll, useTransform, motionValue } from 'framer-motion';

interface AAAHeroProps {
  title: string;
  subtitle?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  showTrustIndicators?: boolean;
  backgroundImage?: string;
}

export function AAAHero({
  title,
  subtitle,
  ctaText,
  onCtaClick,
  showTrustIndicators = true,
  backgroundImage,
}: AAAHeroProps) {
  // Parallax scroll effect
  const { scrollY } = useScroll();
  const backgroundY = useTransform(scrollY, [0, 500], [0, 150]);
  const contentY = useTransform(scrollY, [0, 500], [0, 50]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0.8]);

  return (
    <div className="relative min-h-[520px] overflow-hidden">
      {/* Multi-layer background with parallax */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-[#F5E6E0] via-[#FAE5E0] to-[#FDFBF9]"
        style={{ y: backgroundY }}
      />

      {/* Ambient gradient orbs - subtle and organic */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.25, 0.4, 0.25],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-0 right-0 w-96 h-96 bg-[#E8B4A8]/15 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute bottom-0 left-0 w-80 h-80 bg-[#D4A89A]/12 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 4,
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#E8B4A8]/8 rounded-full blur-3xl"
      />

      {/* Background image with overlay */}
      {backgroundImage && (
        <>
          <motion.img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ y: backgroundY }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#F5E6E0]/95 via-[#FAE5E0]/90 to-[#FDFBF9]/85" />
        </>
      )}

      {/* Content with parallax */}
      <motion.div
        className="relative z-10 px-6 py-20"
        style={{ y: contentY, opacity }}
      >
        {/* Label - choreographed reveal */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 80,
            damping: 16,
            delay: 0.1,
          }}
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-[#E8B4A8] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E8B4A8]" />
            Home Services
          </span>
        </motion.div>

        {/* Title - emotional reveal */}
        <motion.h1
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 80,
            damping: 16,
            delay: 0.2,
          }}
          className="text-display-xl font-semibold text-[#2D2D2D] mt-3 mb-4"
        >
          {title}
        </motion.h1>

        {/* Subtitle - gentle reveal */}
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: 'spring',
              stiffness: 80,
              damping: 16,
              delay: 0.35,
            }}
            className="text-body-lg text-[#6B6B6B] mb-8 max-w-sm"
          >
            {subtitle}
          </motion.p>
        )}

        {/* CTA Button - responsive reveal */}
        {ctaText && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={{
              type: 'spring',
              stiffness: 80,
              damping: 16,
              delay: 0.45,
            }}
            onClick={onCtaClick}
            className="w-full py-4 bg-[#E8B4A8] text-white rounded-2xl font-semibold text-base shadow-aaa-float"
          >
            {ctaText}
          </motion.button>
        )}

        {/* Trust indicators - choreographed */}
        {showTrustIndicators && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex items-center justify-center gap-5 mt-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex items-center gap-1.5"
            >
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium text-[#2D2D2D]">4.8</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="w-px h-4 bg-gray-300/60"
            />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="flex items-center gap-1.5"
            >
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-[#2D2D2D]">Verified</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="w-px h-4 bg-gray-300/60"
            />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="flex items-center gap-1.5"
            >
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-[#2D2D2D]">24/7</span>
            </motion.div>
          </motion.div>
        )}

        {/* Floating badge - gentle entrance */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 80,
            damping: 16,
            delay: 0.6,
          }}
          className="absolute top-6 right-6"
        >
          <div className="bg-white/85 backdrop-blur-xl rounded-2xl px-4 py-2.5 shadow-aaa-subtle">
            <p className="text-xs text-[#6B6B6B]">Welcome</p>
            <p className="text-sm font-bold text-[#E8B4A8]">NILIN</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Bottom transition - organic wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 375 40" className="w-full" preserveAspectRatio="none">
          <path
            d="M0 40C69.5 20 137 0 187.5 0C238 0 305.5 20 375 40V40H0V40Z"
            fill="#FDFBF9"
          />
        </svg>
      </div>
    </div>
  );
}

export default AAAHero;
