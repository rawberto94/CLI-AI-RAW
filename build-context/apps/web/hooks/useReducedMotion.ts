/**
 * Hook to respect user's reduced motion preference
 * Improves accessibility by disabling animations for users who prefer reduced motion
 */

import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is defined (client-side only)
    if (typeof window === 'undefined') {
      return;
    }

    // Check initial preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Add event listener
    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Get animation config based on reduced motion preference
 */
export function useAnimationConfig() {
  const prefersReducedMotion = useReducedMotion();

  return {
    shouldAnimate: !prefersReducedMotion,
    duration: prefersReducedMotion ? 0 : 0.3,
    transition: prefersReducedMotion 
      ? { duration: 0 } 
      : { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  };
}

/**
 * Get motion props based on reduced motion preference
 * Use with framer-motion components
 */
export function useMotionProps<T extends Record<string, any>>(
  animationProps: T,
  staticProps?: Partial<T>
): T | Partial<T> {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return staticProps || {} as Partial<T>;
  }
  
  return animationProps;
}
