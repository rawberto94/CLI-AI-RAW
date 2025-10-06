/**
 * Animation Utility Functions
 */

import { Transition } from 'framer-motion';
import { animationConfig } from './config';

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get transition with reduced motion support
 */
export function getTransition(
  transition: Transition,
  reducedMotion?: boolean
): Transition {
  const shouldReduce = reducedMotion ?? prefersReducedMotion();
  
  if (shouldReduce) {
    return {
      duration: 0.01,
      ease: 'linear',
    };
  }
  
  return transition;
}

/**
 * Create stagger animation config
 */
export function createStagger(
  staggerChildren: number = animationConfig.stagger.normal,
  delayChildren: number = 0
): Transition {
  return {
    staggerChildren,
    delayChildren,
  };
}

/**
 * Create spring animation config
 */
export function createSpring(
  stiffness: number = 300,
  damping: number = 30
): Transition {
  return {
    type: 'spring',
    stiffness,
    damping,
  };
}

/**
 * Delay execution (useful for sequential animations)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get animation duration in milliseconds
 */
export function getDurationMs(duration: keyof typeof animationConfig.duration): number {
  return animationConfig.duration[duration] * 1000;
}

/**
 * Check if device is mobile
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Check if device is touch-enabled
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Get optimal animation config based on device
 */
export function getOptimalAnimationConfig() {
  const mobile = isMobile();
  const touch = isTouchDevice();
  const reducedMotion = prefersReducedMotion();

  return {
    mobile,
    touch,
    reducedMotion,
    shouldAnimate: !reducedMotion,
    duration: reducedMotion ? 'instant' : mobile ? 'fast' : 'normal',
  };
}
