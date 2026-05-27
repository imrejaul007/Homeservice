import { Variants } from 'framer-motion';

// Emotional spring configurations - feels alive and responsive
export const emotionSprings = {
  // For content reveals - feels alive and organic
  reveal: {
    type: 'spring' as const,
    stiffness: 80,
    damping: 16,
    mass: 0.8,
  },

  // For interactive feedback - feels instant and responsive
  responsive: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 30,
    mass: 0.5,
  },

  // For emphasis - feels dramatic and intentional
  emphasis: {
    type: 'spring' as const,
    stiffness: 60,
    damping: 12,
    mass: 1.0,
  },

  // For navigation - feels smooth and predictable
  navigation: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 24,
    mass: 0.8,
  },
};

// Section reveal choreography - staggered for emotional impact
export const sectionChoreography: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

// Content item reveal
export const itemReveal: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: emotionSprings.reveal,
  },
};

// Card interaction choreography
export const cardChoreography = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: emotionSprings.reveal,
  },
  whileHover: {
    y: -4,
    scale: 1.02,
    transition: emotionSprings.responsive,
  },
  whileTap: {
    scale: 0.98,
    transition: { ...emotionSprings.responsive, damping: 35 },
  },
};

// Button choreography - feels tactile and physical
export const buttonChoreography = {
  whileHover: {
    y: -2,
    scale: 1.02,
    transition: emotionSprings.responsive,
  },
  whileTap: {
    scale: 0.96,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 28,
      mass: 0.5,
    },
  },
};

// Hero text reveal - emotional and cinematic
export const heroTextReveal = {
  initial: { opacity: 0, y: 30, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...emotionSprings.reveal,
      delay: 0.15,
    },
  },
};

// Badge reveal - subtle and elegant
export const badgeReveal: Variants = {
  initial: { opacity: 0, scale: 0.8, y: -8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: emotionSprings.reveal,
  },
};

// Floating animation - ambient and organic
export const floatOrganic = {
  animate: {
    y: [0, -8, 0],
    scale: [1, 1.02, 1],
  },
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

// Pulse ambient - subtle breathing
export const pulseAmbient = {
  animate: {
    opacity: [0.3, 0.5, 0.3],
    scale: [1, 1.05, 1],
  },
  transition: {
    duration: 5,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

// Skeleton shimmer - premium and realistic
export const shimmerPremium = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
  },
  transition: {
    duration: 1.8,
    repeat: Infinity,
    ease: 'linear',
  },
};

export default emotionSprings;
