import { useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface UseTilt3DOptions {
  /** Maximum tilt in degrees (default: 20) */
  maxTilt?: number;
  /** Scale on hover, 1 = no scale (default: 1.07) */
  scale?: number;
  /** Glow color stops (CSS) for the radial highlight. */
  glowInner?: string;
  glowOuter?: string;
  /** Whether the tilt effect is enabled. */
  enabled?: boolean;
}

export interface Tilt3DBindings {
  /** Attach to the outer card element (must be a positioned, ref-able element). */
  cardRef: React.RefObject<HTMLDivElement>;
  /** Attach to the inner glow overlay element. */
  glowRef: React.RefObject<HTMLDivElement>;
  /** Spread on the card's outer wrapper to get mouse enter/leave handlers. */
  handlers: {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => void;
  };
  /** Live inline style for the card wrapper. Apply to the same element as cardRef. */
  cardStyle: React.CSSProperties;
  /** Live inline style for the glow overlay. */
  glowStyle: React.CSSProperties;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * useTilt3D
 *
 * Mouse-tracked 3D tilt + radial glow effect, ported from the original
 * vanilla JS demo. Callers attach two refs (card, glow) and spread the
 * returned `handlers` + apply `cardStyle` / `glowStyle` inline.
 *
 * Behavior matches the demo:
 *   - on mouseenter, capture the card's bounding rect
 *   - on mousemove, compute tilt from cursor position relative to card center
 *   - rotation uses centerX/100, -centerY/100 with a log-scaled angle
 *   - glow radial gradient follows the cursor at 2x offset
 *   - on mouseleave, reset transform and remove the listener
 *
 * Touch / reduced-motion: the tilt is disabled on touch devices and when
 * the user has prefers-reduced-motion enabled, so the card remains clickable
 * and accessible.
 */
export function useTilt3D(options: UseTilt3DOptions = {}): Tilt3DBindings {
  const {
    maxTilt = 20,
    scale = 1.07,
    glowInner = '#ffffff55',
    glowOuter = '#0000000f',
    enabled = true,
  } = options;

  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<DOMRect | null>(null);
  // Keep latest options accessible inside the mousemove listener without
  // re-binding it on every render.
  const optsRef = useRef({ maxTilt, scale, glowInner, glowOuter, enabled });
  optsRef.current = { maxTilt, scale, glowInner, glowOuter, enabled };

  // Live inline styles. Keeping them in state (rather than mutating refs)
  // lets the styles participate in React's render cycle cleanly.
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({
    transform: 'rotate3d(0)',
    willChange: 'transform, box-shadow',
    transition: 'transform 300ms ease-out, box-shadow 300ms ease-out',
  });
  const [glowStyle, setGlowStyle] = useState<React.CSSProperties>({
    backgroundImage: `radial-gradient(circle at 50% -20%, ${glowInner}, ${glowOuter})`,
    transition: 'background-image 300ms ease-out',
  });

  // Touch / reduced-motion detection — done once, no need to re-check.
  const capabilityRef = useRef<{ tiltSupported: boolean }>({ tiltSupported: true });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isTouch =
      'ontouchstart' in window ||
      (navigator.maxTouchPoints ?? 0) > 0;
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    capabilityRef.current.tiltSupported = !(isTouch || reducedMotion);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const card = cardRef.current;
    const glow = glowRef.current;
    const bounds = boundsRef.current;
    if (!card || !glow || !bounds) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const leftX = mouseX - bounds.x;
    const topY = mouseY - bounds.y;
    const center = {
      x: leftX - bounds.width / 2,
      y: topY - bounds.height / 2,
    };
    const distance = Math.sqrt(center.x ** 2 + center.y ** 2);

    const { maxTilt: mt, scale: s, glowInner: gi, glowOuter: go } = optsRef.current;

    // Clamp the rotation so cards near the edges of the grid don't flip wildly.
    const rawAngle = Math.log(distance) * 2;
    const clampedAngle = Math.max(-mt, Math.min(mt, rawAngle));
    const ry = Math.max(-1, Math.min(1, center.y / 100));
    const rx = Math.max(-1, Math.min(1, -center.x / 100));

    setCardStyle((prev) => ({
      ...prev,
      transform: `
        scale3d(${s}, ${s}, ${s})
        rotate3d(${ry}, ${rx}, 0, ${clampedAngle}deg)
      `,
      boxShadow: '0 5px 20px 5px #00000044',
    }));

    setGlowStyle((prev) => ({
      ...prev,
      backgroundImage: `
        radial-gradient(
          circle at
          ${center.x * 2 + bounds.width / 2}px
          ${center.y * 2 + bounds.height / 2}px,
          ${gi},
          ${go}
        )
      `,
    }));
  }, []);

  const onMouseEnter = useCallback((_e: React.MouseEvent<HTMLDivElement>) => {
    if (!capabilityRef.current.tiltSupported || !optsRef.current.enabled) return;
    const card = cardRef.current;
    if (!card) return;
    boundsRef.current = card.getBoundingClientRect();
    // Tighten the transition while the cursor is on the card so the tilt
    // feels responsive, matching the demo's 150ms hover transition.
    setCardStyle((prev) => ({
      ...prev,
      transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
    }));
    document.addEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  const onMouseLeave = useCallback((_e: React.MouseEvent<HTMLDivElement>) => {
    document.removeEventListener('mousemove', handleMouseMove);
    boundsRef.current = null;
    // Restore the slower leave transition (300ms) so the card settles.
    setCardStyle({
      transform: 'rotate3d(0)',
      willChange: 'transform, box-shadow',
      transition: 'transform 300ms ease-out, box-shadow 300ms ease-out',
      boxShadow: '',
    });
    setGlowStyle((prev) => ({
      ...prev,
      backgroundImage: `radial-gradient(circle at 50% -20%, ${optsRef.current.glowInner}, ${optsRef.current.glowOuter})`,
    }));
  }, [handleMouseMove]);

  // Defensive cleanup in case the component unmounts while hovered.
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  return {
    cardRef,
    glowRef,
    handlers: { onMouseEnter, onMouseLeave },
    cardStyle,
    glowStyle,
  };
}

export default useTilt3D;
