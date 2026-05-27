import React, { useMemo } from 'react';

// =============================================================================
// NILIN Loading Shimmer Component
// CSS-based animation for 60fps performance
// Brand Colors: primary #E8B4A8, background #F5E6E0
// =============================================================================

export interface LoadingShimmerProps {
  /** Width of the shimmer element */
  width?: string | number;
  /** Height of the shimmer element */
  height?: string | number;
  /** Border radius */
  borderRadius?: string | number;
  /** Custom CSS class */
  className?: string;
  /** Shimmer speed in seconds */
  speed?: number;
  /** Direction of shimmer sweep */
  direction?: 'left-to-right' | 'right-to-left' | 'diagonal';
  /** Enable/disable animation */
  animate?: boolean;
  /** Custom shimmer gradient colors */
  gradientColors?: {
    base: string;
    highlight: string;
    end: string;
  };
}

// NILIN shimmer gradient colors (defaults)
const DEFAULT_GRADIENT = {
  base: '#F5E6E0', // NILIN blush
  highlight: '#FDFBF9', // NILIN cream
  end: '#F5E6E0', // NILIN blush
};

const SHIMMER_KEYFRAMES = `
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
`;

// Inject keyframes once
let keyframesInjected = false;
const injectKeyframes = () => {
  if (keyframesInjected) return;
  if (typeof document !== 'undefined') {
    const styleId = 'nilin-shimmer-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = SHIMMER_KEYFRAMES;
      document.head.appendChild(style);
    }
  }
  keyframesInjected = true;
};

/**
 * LoadingShimmer - Optimized CSS-based shimmer loading effect
 *
 * Uses CSS gradients and keyframe animations for smooth 60fps performance.
 * No JavaScript animation loops - pure CSS for GPU acceleration.
 *
 * @example
 * // Basic usage
 * <LoadingShimmer width="100%" height={20} />
 *
 * // Card skeleton
 * <LoadingShimmer width="100%" height={120} borderRadius={12} />
 *
 * // Custom colors
 * <LoadingShimmer gradientColors={{ base: '#eee', highlight: '#fff', end: '#eee' }} />
 */
const LoadingShimmer: React.FC<LoadingShimmerProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 4,
  className = '',
  speed = 1.5,
  direction = 'left-to-right',
  animate = true,
  gradientColors = DEFAULT_GRADIENT,
}) => {
  // Inject keyframes on mount
  React.useEffect(() => {
    injectKeyframes();
  }, []);

  // Calculate gradient based on direction
  const gradient = useMemo(() => {
    const { base, highlight, end } = gradientColors;

    switch (direction) {
      case 'right-to-left':
        return `linear-gradient(90deg, ${base} 0%, ${highlight} 50%, ${end} 100%)`;
      case 'diagonal':
        return `linear-gradient(135deg, ${base} 0%, ${highlight} 50%, ${end} 100%)`;
      case 'left-to-right':
      default:
        return `linear-gradient(90deg, ${base} 0%, ${highlight} 50%, ${end} 100%)`;
    }
  }, [gradientColors, direction]);

  // Parse dimensions
  const parsedWidth = typeof width === 'number' ? `${width}px` : width;
  const parsedHeight = typeof height === 'number' ? `${height}px` : height;
  const parsedBorderRadius = typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;

  // Animation style
  const animationStyle: React.CSSProperties = {
    width: parsedWidth,
    height: parsedHeight,
    borderRadius: parsedBorderRadius,
    background: gradient,
    backgroundSize: '200% 100%',
    animation: animate
      ? `shimmer ${speed}s ease-in-out infinite`
      : 'none',
    willChange: 'background-position',
  };

  return (
    <div
      className={`loading-shimmer ${className}`}
      style={animationStyle}
      role="status"
      aria-label="Loading..."
    />
  );
};

// =============================================================================
// Shimmer Skeleton Variants
// =============================================================================

/**
 * TextLine - Shimmer for single line of text
 */
export const ShimmerTextLine: React.FC<Omit<LoadingShimmerProps, 'height'>> = ({
  className = '',
  ...props
}) => (
  <LoadingShimmer
    height={14}
    borderRadius={4}
    className={`mb-2 last:mb-0 ${className}`}
    {...props}
  />
);

/**
 * ShimmerText - Shimmer for multiple lines of text
 */
export interface ShimmerTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string | number;
}

export const ShimmerText: React.FC<ShimmerTextProps> = ({
  lines = 3,
  className = '',
  lastLineWidth = '60%',
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <LoadingShimmer
        key={i}
        height={14}
        borderRadius={4}
        width={i === lines - 1 ? lastLineWidth : '100%'}
      />
    ))}
  </div>
);

/**
 * ShimmerAvatar - Shimmer for avatar/profile image
 */
export interface ShimmerAvatarProps {
  size?: number | string;
  className?: string;
}

export const ShimmerAvatar: React.FC<ShimmerAvatarProps> = ({
  size = 48,
  className = '',
}) => {
  const parsedSize = typeof size === 'number' ? `${size}px` : size;
  return (
    <LoadingShimmer
      width={parsedSize}
      height={parsedSize}
      borderRadius="50%"
      className={className}
    />
  );
};

/**
 * ShimmerCard - Shimmer for card/surface loading
 */
export interface ShimmerCardProps {
  className?: string;
  showImage?: boolean;
  imageHeight?: number;
  lines?: number;
}

export const ShimmerCard: React.FC<ShimmerCardProps> = ({
  className = '',
  showImage = true,
  imageHeight = 120,
  lines = 3,
}) => (
  <div
    className={`bg-white rounded-nilin-lg p-4 shadow-nilin ${className}`}
    style={{ minWidth: 200 }}
  >
    {showImage && (
      <LoadingShimmer
        width="100%"
        height={imageHeight}
        borderRadius={8}
        className="mb-4"
      />
    )}
    <div className="space-y-2">
      <LoadingShimmer width="70%" height={16} borderRadius={4} />
      <LoadingShimmer width="100%" height={12} borderRadius={4} />
      <LoadingShimmer width="85%" height={12} borderRadius={4} />
      {lines > 2 && <LoadingShimmer width="60%" height={12} borderRadius={4} />}
    </div>
    <div className="mt-4 flex gap-2">
      <LoadingShimmer width={80} height={32} borderRadius={6} />
      <LoadingShimmer width={80} height={32} borderRadius={6} />
    </div>
  </div>
);

/**
 * ShimmerButton - Shimmer for button placeholder
 */
export interface ShimmerButtonProps {
  width?: string | number;
  height?: number;
  className?: string;
}

export const ShimmerButton: React.FC<ShimmerButtonProps> = ({
  width = 120,
  height = 40,
  className = '',
}) => (
  <LoadingShimmer
    width={width}
    height={height}
    borderRadius={8}
    className={className}
  />
);

/**
 * ShimmerList - Shimmer for list items
 */
export interface ShimmerListProps {
  count?: number;
  className?: string;
}

export const ShimmerList: React.FC<ShimmerListProps> = ({
  count = 5,
  className = '',
}) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <LoadingShimmer width={48} height={48} borderRadius="50%" />
        <div className="flex-1 space-y-2">
          <LoadingShimmer width="60%" height={14} borderRadius={4} />
          <LoadingShimmer width="40%" height={12} borderRadius={4} />
        </div>
      </div>
    ))}
  </div>
);

/**
 * ShimmerGrid - Shimmer for grid layouts
 */
export interface ShimmerGridProps {
  columns?: number;
  rows?: number;
  gap?: number;
  className?: string;
}

export const ShimmerGrid: React.FC<ShimmerGridProps> = ({
  columns = 2,
  rows = 3,
  gap = 16,
  className = '',
}) => (
  <div
    className={`grid ${className}`}
    style={{
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap,
    }}
  >
    {Array.from({ length: columns * rows }).map((_, i) => (
      <LoadingShimmer
        key={i}
        width="100%"
        height={100}
        borderRadius={8}
      />
    ))}
  </div>
);

/**
 * ShimmerOverlay - Full-screen loading overlay
 */
export interface ShimmerOverlayProps {
  className?: string;
  opacity?: number;
}

export const ShimmerOverlay: React.FC<ShimmerOverlayProps> = ({
  className = '',
  opacity = 0.9,
}) => (
  <div
    className={`absolute inset-0 flex items-center justify-center bg-nilin-cream/90 backdrop-blur-sm z-50 ${className}`}
    style={{ backgroundColor: `rgba(245, 230, 224, ${opacity})` }}
  >
    <div className="flex flex-col items-center gap-4">
      {/* NILIN logo placeholder */}
      <LoadingShimmer width={80} height={80} borderRadius="50%" />
      <LoadingShimmer width={120} height={16} borderRadius={4} />
    </div>
  </div>
);

// =============================================================================
// Exports
// =============================================================================

export { LoadingShimmer };
export default LoadingShimmer;
