import React, { useEffect, useState } from 'react';
import { tokens } from '../../theme/tokens';

interface AnimatedDotsLoadingProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  backgroundColor?: string;
  message?: string;
  fullScreen?: boolean;
}

/**
 * Animated Dots Loading Component
 * Inspired by the UI design with NILIN luxury color theme
 * Features staggered bounce animation with squash/stretch effects
 */
export const AnimatedDotsLoading: React.FC<AnimatedDotsLoadingProps> = ({
  size = 'md',
  color,
  backgroundColor,
  message,
  fullScreen = true,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small delay to trigger entrance animation
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const sizeConfig = {
    sm: { dotSize: 8, gap: 12, containerWidth: 80 },
    md: { dotSize: 12, gap: 16, containerWidth: 120 },
    lg: { dotSize: 16, gap: 20, containerWidth: 160 },
  };

  const config = sizeConfig[size];
  const dotColor = color || tokens.colors.coral;
  const bgColor = backgroundColor || tokens.colors.cream;

  const dotCount = 5;
  const dots = Array.from({ length: dotCount }, (_, i) => i);

  return (
    <div
      className={`flex flex-col items-center justify-center transition-all duration-500 ease-out ${
        mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{
        minHeight: fullScreen ? '100vh' : '100%',
        backgroundColor: fullScreen ? bgColor : 'transparent',
      }}
    >
      <div className="relative flex items-center justify-center">
        {/* Main dot (leftmost) */}
        <div
          className="main-dot absolute"
          style={{
            width: config.dotSize,
            height: config.dotSize,
            borderRadius: '50%',
            backgroundColor: dotColor,
            left: 0,
            transform: 'translateX(0)',
          }}
        />

        {/* Other dots with staggered animation */}
        {dots.slice(1).map((_, index) => (
          <div
            key={index}
            className="other-dot"
            style={{
              width: config.dotSize,
              height: config.dotSize,
              borderRadius: '50%',
              backgroundColor: dotColor,
              marginLeft: config.gap - config.dotSize,
              transform: 'translateX(0)',
            }}
          />
        ))}
      </div>

      {/* Loading message */}
      {message && (
        <p
          className="mt-6 text-sm font-medium animate-pulse"
          style={{
            color: tokens.colors.warmGray,
            fontFamily: tokens.typography.fontFamily.sans,
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
};

/**
 * Inline animated dots for use within content
 * Smaller and more subtle than the full loading screen
 */
export const InlineAnimatedDots: React.FC<{
  size?: 'sm' | 'md';
  color?: string;
  count?: number;
}> = ({ size = 'sm', color, count = 3 }) => {
  const dotSize = size === 'sm' ? 6 : 8;
  const dotColor = color || tokens.colors.coral;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-full animate-bounce"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: dotColor,
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  );
};

/**
 * NILIN branded page loader
 * Uses the full NILIN design system colors
 */
export const NilinPageLoader: React.FC<{
  message?: string;
  showLogo?: boolean;
}> = ({ message, showLogo = false }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-all duration-700 ease-out ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        backgroundColor: tokens.colors.cream,
      }}
    >
      {/* Animated dots container */}
      <div className="relative flex items-center" style={{ height: 24 }}>
        {/* Main dot */}
        <div
          className="absolute"
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: tokens.colors.coral,
            left: 0,
            animation: 'mainDotBounce 1.8s ease-in-out infinite',
          }}
        />

        {/* Secondary dots */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="absolute"
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: tokens.colors.coral,
              left: (i + 1) * 26,
              animation: `dotBounce 1.8s ease-in-out infinite`,
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>

      {/* Optional logo */}
      {showLogo && (
        <div
          className="mt-8 animate-pulse"
          style={{
            fontFamily: tokens.typography.fontFamily.serif,
            fontSize: tokens.typography.fontSize.xl,
            color: tokens.colors.charcoal,
            letterSpacing: tokens.typography.letterSpacing.wide,
          }}
        >
          NILIN
        </div>
      )}

      {/* Message */}
      {message && (
        <p
          className="mt-6 text-sm"
          style={{
            color: tokens.colors.warmGray,
            fontFamily: tokens.typography.fontFamily.sans,
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default AnimatedDotsLoading;
