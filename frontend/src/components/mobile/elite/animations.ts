import { Transition, Variants } from 'framer-motion';

// Elite spring configurations
export const springs = {
  // Gentle - for subtle interactions
  gentle: {
    type: 'spring' as const,
    stiffness: 120,
    damping: 14,
    mass: 0.8,
  },

  // Balanced - default for most interactions
  balanced: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 20,
    mass: 1,
  },

  // Snappy - for quick feedback
  snappy: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 25,
    mass: 0.8,
  },

  // Dramatic - for emphasis
  dramatic: {
    type: 'spring' as const,
    stiffness: 100,
    damping: 12,
    mass: 1.2,
  },
};

// Page transitions
export const pageTransitions: Record<string, Variants> = {
  enter: {
    initial: { opacity: 0, y: 12, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.98 },
  },
  slide: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
};

// Stagger container for lists
export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

// Stagger item
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: springs.balanced,
  },
};

// Fade in variants
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Slide up variants
export const slideUp: Variants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

// Scale in variants
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

// Card hover interaction
export const cardHover = {
  whileHover: {
    y: -4,
    scale: 1.02,
    transition: springs.balanced,
  },
  whileTap: {
    scale: 0.98,
    transition: springs.snappy,
  },
};

// Button press interaction
export const buttonPress = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: springs.snappy,
};

// Skeleton shimmer animation
export const skeletonAnimation = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'linear' as const,
  },
};

// Floating animation
export const floatAnimation = {
  animate: {
    y: [0, -6, 0],
  },
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

// Orb animation
export const orbAnimation = {
  animate: {
    scale: [1, 1.1, 1],
    opacity: [0.3, 0.5, 0.3],
  },
  transition: {
    duration: 8,
    repeat: Infinity,
  },
};

export default springs;
