import React, { useEffect, useState } from 'react';
import { tokens } from '../../theme/tokens';
import { useLoading } from '../../context/LoadingContext';

/**
 * Global Loading Overlay Component
 * Displays animated dots loading screen across all pages
 * Uses NILIN luxury color theme with elegant animations
 */
export const GlobalLoadingOverlay: React.FC = () => {
  const { isLoading, loadingMessage } = useLoading();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small delay to trigger entrance animation
    const mountTimer = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(mountTimer);
  }, []);

  useEffect(() => {
    if (isLoading) {
      setFading(false);
      const showTimer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(showTimer);
    } else {
      setFading(true);
      const fadeTimer = setTimeout(() => {
        setVisible(false);
        setFading(false);
      }, 200);
      return () => clearTimeout(fadeTimer);
    }
  }, [isLoading]);

  if (!visible && !fading && !isLoading) return null;

  const dotColor = tokens.colors.coral;
  const bgColor = tokens.colors.cream;

  return (
    <div
      className={`fixed inset-0 z-[90] flex flex-col items-center justify-center transition-all ease-out ${
        fading ? 'opacity-0 scale-[1.02]' : mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
      }`}
      style={{
        backgroundColor: bgColor,
        pointerEvents: isLoading && !fading ? 'auto' : 'none',
        willChange: 'opacity, transform',
        transitionDuration: '200ms',
      }}
    >
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${tokens.colors.charcoal} 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content container */}
      <div className="relative flex flex-col items-center">
        {/* Animated dots container - matches original GSAP animation */}
        <div
          className="relative flex items-center"
          style={{
            height: 24,
            width: 144,
          }}
        >
          {/* Main dot - moves right with elastic return */}
          <div
            className="absolute"
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: dotColor,
              left: 0,
              top: 5,
              boxShadow: `0 0 24px ${dotColor}50, 0 4px 12px rgba(232, 180, 168, 0.3)`,
              animation: 'mainDotBounce 2s ease-in-out infinite',
            }}
          />

          {/* Secondary dots - staggered bounce with squash/stretch */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute"
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: dotColor,
                left: (i + 1) * 24,
                top: 5,
                boxShadow: `0 0 16px ${dotColor}30`,
                animation: `dotBounce 2s ease-in-out infinite`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* NILIN Brand with elegant typography */}
        <div
          className="mt-10 tracking-[0.3em] select-none"
          style={{
            fontFamily: tokens.typography.fontFamily.serif,
            fontSize: tokens.typography.fontSize.lg,
            color: tokens.colors.charcoal,
            fontWeight: tokens.typography.fontWeight.light,
            opacity: mounted && !fading ? 1 : 0,
            transform: mounted && !fading ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all 0.5s ease-out 0.2s',
          }}
        >
          NILIN
        </div>

        {/* Loading message */}
        {loadingMessage && (
          <p
            className="mt-6 text-sm tracking-wide"
            style={{
              color: tokens.colors.warmGray,
              fontFamily: tokens.typography.fontFamily.sans,
              opacity: mounted && !fading ? 1 : 0,
              transition: 'opacity 0.4s ease-out 0.4s',
            }}
          >
            {loadingMessage}
          </p>
        )}
      </div>

      {/* Subtle gradient overlay at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: `linear-gradient(to top, ${bgColor} 0%, transparent 100%)`,
          opacity: 0.5,
        }}
      />
    </div>
  );
};

/**
 * Minimal inline loading indicator for buttons
 */
export const InlineLoading: React.FC<{ size?: 'sm' | 'md' | 'lg'; color?: string }> = ({
  size = 'md',
  color
}) => {
  const dotSize = size === 'sm' ? 4 : size === 'md' ? 6 : 8;
  const dotColor = color || tokens.colors.coral;

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: dotColor,
            animation: 'dotBounce 0.8s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
};

/**
 * Loading bar for top of page transitions
 */
export const LoadingBar: React.FC<{ active: boolean }> = ({ active }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2px] z-[10000] overflow-hidden"
      style={{
        background: `linear-gradient(90deg, ${tokens.colors.coral}, ${tokens.colors.rose})`,
      }}
    >
      <div
        className="h-full"
        style={{
          width: '40%',
          background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)`,
          animation: 'loadingBar 1.2s ease-in-out infinite',
        }}
      />
    </div>
  );
};

export default GlobalLoadingOverlay;
