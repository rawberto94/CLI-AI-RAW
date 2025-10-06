/**
 * Animation Configuration
 * Central configuration for all animations in the application
 */

export const animationConfig = {
  // Duration presets (in seconds)
  duration: {
    instant: 0.1,
    fast: 0.2,
    normal: 0.3,
    slow: 0.5,
    slower: 0.7,
  },

  // Easing functions
  easing: {
    easeOut: [0.33, 1, 0.68, 1],
    easeInOut: [0.65, 0, 0.35, 1],
    easeIn: [0.32, 0, 0.67, 0],
    bounce: [0.68, -0.55, 0.265, 1.55],
  },

  // Spring configurations
  spring: {
    gentle: { type: 'spring' as const, stiffness: 120, damping: 14 },
    default: { type: 'spring' as const, stiffness: 300, damping: 30 },
    snappy: { type: 'spring' as const, stiffness: 400, damping: 25 },
    bouncy: { type: 'spring' as const, stiffness: 500, damping: 20 },
  },

  // Stagger delays
  stagger: {
    fast: 0.05,
    normal: 0.1,
    slow: 0.15,
  },
} as const;

export type AnimationDuration = keyof typeof animationConfig.duration;
export type AnimationEasing = keyof typeof animationConfig.easing;
export type AnimationSpring = keyof typeof animationConfig.spring;
