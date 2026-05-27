import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * NILIN Premium Animations Hook
 *
 * Provides 60fps-optimized animation utilities for premium UI experience.
 * Uses CSS transforms and will-change hints for GPU acceleration.
 */

// =============================================================================
// Types
// =============================================================================

interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
  velocity?: number;
}

interface AnimationState {
  value: number;
  velocity: number;
  finished: boolean;
}

interface TransitionConfig {
  duration: number;
  easing?: string;
  delay?: number;
}

interface ScaleConfig {
  scale?: number;
  duration?: number;
  easing?: string;
}

// =============================================================================
// Default Configurations
// =============================================================================

const DEFAULT_SPRING: SpringConfig = {
  stiffness: 170,
  damping: 26,
  mass: 1,
  velocity: 0,
};

const DEFAULT_TRANSITION: TransitionConfig = {
  duration: 200,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  delay: 0,
};

// NILIN brand colors for reference
const NILIN_TRANSITION_EASING = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)', // ease-out
  enter: 'cubic-bezier(0, 0, 0.2, 1)', // ease-in
  exit: 'cubic-bezier(0.4, 0, 1, 1)', // ease-in-out
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // spring
  smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)', // smooth
};

// =============================================================================
// Spring Physics Animation
// =============================================================================

/**
 * useSpringAnimation - Physics-based spring animation hook
 *
 * Creates smooth, natural-feeling animations using spring physics.
 * Optimized for 60fps using requestAnimationFrame.
 *
 * @param initialValue - Starting value for the animation
 * @param config - Spring configuration (stiffness, damping, mass)
 * @returns Object with animation value and control methods
 *
 * @example
 * const { value, setTarget, stop } = useSpringAnimation(0);
 * // Animate to 100 with spring physics
 * setTarget(100);
 */
export function useSpringAnimation(
  initialValue: number = 0,
  config: SpringConfig = DEFAULT_SPRING
) {
  const [value, setValue] = useState(initialValue);
  const targetRef = useRef(initialValue);
  const animationRef = useRef<{
    state: AnimationState;
    config: SpringConfig;
    startTime: number;
    rafId: number | null;
  } | null>(null);

  // Initialize animation state
  const initAnimation = useCallback(() => {
    animationRef.current = {
      state: {
        value: initialValue,
        velocity: config.velocity ?? 0,
        finished: false,
      },
      config,
      startTime: performance.now(),
      rafId: null,
    };
  }, [initialValue, config]);

  // Spring physics step calculation
  const springStep = useCallback(
    (state: AnimationState, target: number, config: SpringConfig): AnimationState => {
      const { stiffness, damping, mass } = config;

      // Spring force: F = -k * x - d * v
      const displacement = state.value - target;
      const springForce = -stiffness * displacement;
      const dampingForce = -damping * state.velocity;
      const acceleration = (springForce + dampingForce) / mass;

      // Verlet integration for stability
      const newVelocity = state.velocity + acceleration * (1 / 60);
      const newValue = state.value + newVelocity * (1 / 60);

      // Check for convergence
      const settled =
        Math.abs(newVelocity) < 0.01 && Math.abs(newValue - target) < 0.01;

      return {
        value: settled ? target : newValue,
        velocity: settled ? 0 : newVelocity,
        finished: settled,
      };
    },
    []
  );

  // Animation loop
  const animate = useCallback(() => {
    if (!animationRef.current) return;

    const { state, config, startTime } = animationRef.current;
    const target = targetRef.current;

    // Perform spring step
    const newState = springStep(state, target, config);

    // Update value
    setValue(newState.value);

    if (newState.finished) {
      animationRef.current.rafId = null;
      return;
    }

    // Continue animation
    animationRef.current.state = newState;
    animationRef.current.rafId = requestAnimationFrame(animate);
  }, [springStep]);

  // Set target value and start animation
  const setTarget = useCallback(
    (target: number) => {
      // Cancel any existing animation
      if (animationRef.current?.rafId) {
        cancelAnimationFrame(animationRef.current.rafId);
      }

      // Initialize or update animation state
      if (!animationRef.current) {
        initAnimation();
      }

      if (animationRef.current) {
        targetRef.current = target;

        // If already at target, skip animation
        if (Math.abs(animationRef.current.state.value - target) < 0.01) {
          setValue(target);
          return;
        }

        // Start animation loop
        animationRef.current.rafId = requestAnimationFrame(animate);
      }
    },
    [animate, initAnimation]
  );

  // Stop animation
  const stop = useCallback(() => {
    if (animationRef.current?.rafId) {
      cancelAnimationFrame(animationRef.current.rafId);
      animationRef.current.rafId = null;
    }
  }, []);

  // Reset to initial value
  const reset = useCallback(() => {
    stop();
    setValue(initialValue);
    targetRef.current = initialValue;
    if (animationRef.current) {
      animationRef.current.state = {
        value: initialValue,
        velocity: 0,
        finished: true,
      };
    }
  }, [initialValue, stop]);

  // Update spring configuration
  const updateConfig = useCallback((newConfig: Partial<SpringConfig>) => {
    if (animationRef.current) {
      animationRef.current.config = { ...animationRef.current.config, ...newConfig };
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current?.rafId) {
        cancelAnimationFrame(animationRef.current.rafId);
      }
    };
  }, []);

  return {
    value,
    setTarget,
    setValue,
    stop,
    reset,
    updateConfig,
    isAnimating: () => animationRef.current?.rafId !== null,
  };
}

// =============================================================================
// Fade Transition
// =============================================================================

/**
 * useFadeTransition - Smooth opacity fade transitions
 *
 * Provides fade in/out with configurable duration and easing.
 * Uses CSS transitions for GPU acceleration.
 *
 * @param initialVisible - Initial visibility state
 * @param config - Transition configuration
 * @returns Object with visibility state and control methods
 *
 * @example
 * const { visible, show, hide, toggle } = useFadeTransition(false);
 * // Fade in
 * show();
 */
export function useFadeTransition(
  initialVisible: boolean = false,
  config: TransitionConfig = DEFAULT_TRANSITION
) {
  const [visible, setVisible] = useState(initialVisible);
  const [rendered, setRendered] = useState(initialVisible);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timeout
  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Show (fade in)
  const show = useCallback(() => {
    clearPendingTimeout();
    setVisible(true);
    setRendered(true);
  }, [clearPendingTimeout]);

  // Hide (fade out then unmount)
  const hide = useCallback(() => {
    clearPendingTimeout();
    setVisible(false);

    // Unmount after transition completes
    timeoutRef.current = setTimeout(() => {
      setRendered(false);
    }, config.duration);
  }, [clearPendingTimeout, config.duration]);

  // Toggle visibility
  const toggle = useCallback(() => {
    if (visible) {
      hide();
    } else {
      show();
    }
  }, [visible, show, hide]);

  // Instant show without animation
  const showInstant = useCallback(() => {
    clearPendingTimeout();
    setVisible(true);
    setRendered(true);
  }, [clearPendingTimeout]);

  // Instant hide without animation
  const hideInstant = useCallback(() => {
    clearPendingTimeout();
    setVisible(false);
    setRendered(false);
  }, [clearPendingTimeout]);

  // Get CSS transition style
  const getTransitionStyle = useCallback(
    (customDuration?: number) => ({
      transition: `opacity ${customDuration ?? config.duration}ms ${config.easing}`,
      transitionDelay: `${config.delay ?? 0}ms`,
    }),
    [config]
  );

  // Get opacity based on visibility
  const opacity = visible ? 1 : 0;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout]);

  return {
    visible,
    rendered,
    opacity,
    show,
    hide,
    toggle,
    showInstant,
    hideInstant,
    getTransitionStyle,
    isVisible: visible,
    isRendered: rendered,
  };
}

// =============================================================================
// Scale Press Effect
// =============================================================================

/**
 * useScalePress - Button press feedback with scale animation
 *
 * Provides touch-responsive scale animation for buttons.
 * Optimized for mobile with proper touch handling.
 *
 * @param config - Scale configuration
 * @returns Object with scale state and event handlers
 *
 * @example
 * const { scale, handlers } = useScalePress({ scale: 0.95, duration: 100 });
 * return <button style={{ transform: `scale(${scale})` }} {...handlers}>Press me</button>;
 */
export function useScalePress(config: ScaleConfig = {}) {
  const { scale = 0.95, duration = 100, easing = NILIN_TRANSITION_EASING.bounce } = config;

  const [isPressed, setIsPressed] = useState(false);
  const [scaleValue, setScaleValue] = useState(1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  const clearTimeout = useCallback(() => {
    if (timeoutRef.current) {
      global.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Touch start / mouse down handlers
  const onPressStart = useCallback(() => {
    clearTimeout();
    setIsPressed(true);
    setScaleValue(scale);
  }, [scale, clearTimeout]);

  // Touch end / mouse up handlers
  const onPressEnd = useCallback(() => {
    setIsPressed(false);
    setScaleValue(1);
  }, []);

  // Touch cancel (e.g., finger slides away)
  const onPressCancel = useCallback(() => {
    setIsPressed(false);
    setScaleValue(1);
  }, []);

  // Event handlers for different input types
  const handlers = {
    onMouseDown: onPressStart,
    onMouseUp: onPressEnd,
    onMouseLeave: onPressEnd,
    onTouchStart: onPressStart,
    onTouchEnd: onPressEnd,
    onTouchCancel: onPressCancel,
  };

  // Get style object
  const getStyle = useCallback(
    (customStyle?: React.CSSProperties) => ({
      transform: `scale(${scaleValue})`,
      transition: `transform ${duration}ms ${easing}`,
      willChange: 'transform',
      touchAction: 'manipulation',
      ...customStyle,
    }),
    [scaleValue, duration, easing]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout();
    };
  }, [clearTimeout]);

  return {
    scale: scaleValue,
    isPressed,
    handlers,
    getStyle,
    onPressStart,
    onPressEnd,
    onPressCancel,
  };
}

// =============================================================================
// Slide Animation
// =============================================================================

/**
 * useSlideAnimation - Slide in/out animations
 *
 * Provides directional slide animations (up, down, left, right).
 * Useful for modals, sheets, and drawers.
 *
 * @param direction - Slide direction
 * @param initialVisible - Initial visibility
 * @returns Object with animation state and control methods
 *
 * @example
 * const { visible, translate, show, hide } = useSlideAnimation('up', false);
 */
export function useSlideAnimation(
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  initialVisible: boolean = false
) {
  const [visible, setVisible] = useState(initialVisible);
  const [rendered, setRendered] = useState(initialVisible);
  const [translate, setTranslate] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Distance to translate based on direction
  const getTranslateDistance = () => {
    switch (direction) {
      case 'up':
      case 'down':
        return '100%';
      case 'left':
      case 'right':
        return '100%';
      default:
        return '100%';
    }
  };

  // Get initial translate offset
  const getInitialOffset = () => {
    switch (direction) {
      case 'up':
        return 100;
      case 'down':
        return -100;
      case 'left':
        return 100;
      case 'right':
        return -100;
      default:
        return 100;
    }
  };

  // Clear timeout
  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Show (slide in)
  const show = useCallback(() => {
    clearPendingTimeout();
    setVisible(true);
    setRendered(true);

    // Animate in after a frame
    requestAnimationFrame(() => {
      setTranslate(0);
    });
  }, [clearPendingTimeout]);

  // Hide (slide out)
  const hide = useCallback(() => {
    clearPendingTimeout();
    setVisible(false);

    // Unmount after transition
    timeoutRef.current = setTimeout(() => {
      setRendered(false);
      setTranslate(getInitialOffset());
    }, 300);
  }, [clearPendingTimeout, getInitialOffset]);

  // Toggle
  const toggle = useCallback(() => {
    if (visible) {
      hide();
    } else {
      show();
    }
  }, [visible, show, hide]);

  // Get CSS transform
  const getTransform = useCallback(() => {
    if (!rendered) {
      return `translate${direction === 'up' || direction === 'down' ? 'Y' : 'X'}(${translate}%)`;
    }
    return translate !== 0
      ? `translate${direction === 'up' || direction === 'down' ? 'Y' : 'X'}(${translate}%)`
      : undefined;
  }, [direction, translate, rendered]);

  // Get style
  const getStyle = useCallback(
    (customStyle?: React.CSSProperties) => ({
      transform: getTransform() ?? undefined,
      transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      willChange: 'transform',
      ...customStyle,
    }),
    [getTransform]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout]);

  return {
    visible,
    rendered,
    translate,
    show,
    hide,
    toggle,
    getStyle,
    getTransform,
    isVisible: visible,
    isRendered: rendered,
  };
}

// =============================================================================
// Stagger Animation
// =============================================================================

/**
 * useStaggerAnimation - Staggered list item animations
 *
 * Animates multiple items with a delay between each.
 * Perfect for list items, grid items, etc.
 *
 * @param itemCount - Number of items to animate
 * @param staggerDelay - Delay between each item (ms)
 * @param baseDuration - Base animation duration (ms)
 * @returns Object with animation states for each item
 *
 * @example
 * const { getItemStyle, isAllVisible } = useStaggerAnimation(5, 50, 300);
 * items.map((item, i) => (
 *   <div key={item.id} style={getItemStyle(i)}>...</div>
 * ));
 */
export function useStaggerAnimation(
  itemCount: number,
  staggerDelay: number = 50,
  baseDuration: number = 300
) {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const [isAllVisible, setIsAllVisible] = useState(false);

  // Start staggered reveal
  const revealAll = useCallback(() => {
    setIsAllVisible(true);

    for (let i = 0; i < itemCount; i++) {
      setTimeout(() => {
        setVisibleItems((prev) => new Set([...prev, i]));
      }, i * staggerDelay);
    }
  }, [itemCount, staggerDelay]);

  // Hide all items
  const hideAll = useCallback(() => {
    setVisibleItems(new Set());
    setIsAllVisible(false);
  }, []);

  // Reset animation state
  const reset = useCallback(() => {
    setVisibleItems(new Set());
    setIsAllVisible(false);
  }, []);

  // Get opacity and transform for an item
  const getItemStyle = useCallback(
    (index: number, customStyle?: React.CSSProperties) => {
      const isVisible = visibleItems.has(index);

      return {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity ${baseDuration}ms ease-out, transform ${baseDuration}ms ease-out`,
        transitionDelay: isVisible ? '0ms' : '0ms',
        willChange: 'opacity, transform',
        ...customStyle,
      };
    },
    [visibleItems, baseDuration]
  );

  return {
    visibleItems,
    isAllVisible,
    revealAll,
    hideAll,
    reset,
    getItemStyle,
  };
}

// =============================================================================
// Exports
// =============================================================================

export default {
  useSpringAnimation,
  useFadeTransition,
  useScalePress,
  useSlideAnimation,
  useStaggerAnimation,
};
