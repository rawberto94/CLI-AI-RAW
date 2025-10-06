/**
 * useAnimation Hook
 * Provides animation utilities and reduced motion detection
 */

'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';
import { getOptimalAnimationConfig } from '@/lib/animations/utils';

export function useAnimation() {
  const shouldReduceMotion = useFramerReducedMotion();
  const [config, setConfig] = useState(getOptimalAnimationConfig());

  useEffect(() => {
    setConfig(getOptimalAnimationConfig());

    // Update on resize
    const handleResize = () => {
      setConfig(getOptimalAnimationConfig());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    shouldReduceMotion,
    ...config,
  };
}

/**
 * useStaggerAnimation Hook
 * Provides utilities for stagger animations
 */
export function useStaggerAnimation(itemCount: number, baseDelay: number = 0.1) {
  const { shouldReduceMotion } = useAnimation();

  const getDelay = (index: number) => {
    if (shouldReduceMotion) return 0;
    return index * baseDelay;
  };

  return { getDelay };
}
