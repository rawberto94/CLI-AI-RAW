/**
 * Animation Variants Library
 * Reusable Framer Motion animation variants
 */

import { Variants } from 'framer-motion';
import { animationConfig } from './config';

// Fade animations
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: animationConfig.duration.normal }
  },
  exit: { 
    opacity: 0,
    transition: { duration: animationConfig.duration.fast }
  },
};

// Slide animations
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: animationConfig.duration.normal, ease: animationConfig.easing.easeOut }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: { duration: animationConfig.duration.fast }
  },
};

export const slideDownVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: animationConfig.duration.normal, ease: animationConfig.easing.easeOut }
  },
  exit: { 
    opacity: 0, 
    y: 20,
    transition: { duration: animationConfig.duration.fast }
  },
};

export const slideLeftVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: animationConfig.duration.normal, ease: animationConfig.easing.easeOut }
  },
  exit: { 
    opacity: 0, 
    x: -20,
    transition: { duration: animationConfig.duration.fast }
  },
};

export const slideRightVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: animationConfig.duration.normal, ease: animationConfig.easing.easeOut }
  },
  exit: { 
    opacity: 0, 
    x: 20,
    transition: { duration: animationConfig.duration.fast }
  },
};

// Scale animations
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: animationConfig.duration.normal, ease: animationConfig.easing.easeOut }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: animationConfig.duration.fast }
  },
};

export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: animationConfig.spring.bouncy
  },
  exit: { 
    opacity: 0, 
    scale: 0.8,
    transition: { duration: animationConfig.duration.fast }
  },
};

// Button interaction variants
export const buttonVariants: Variants = {
  idle: { scale: 1 },
  hover: { 
    scale: 1.02,
    transition: { duration: animationConfig.duration.fast }
  },
  tap: { scale: 0.98 },
};

// Card interaction variants
export const cardVariants: Variants = {
  idle: { 
    y: 0, 
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
  },
  hover: { 
    y: -4, 
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    transition: { duration: animationConfig.duration.fast }
  },
};

// List stagger variants
export const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: animationConfig.stagger.normal,
      delayChildren: 0.1,
    },
  },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: animationConfig.duration.fast }
  },
};

// Drop zone variants
export const dropZoneVariants: Variants = {
  idle: { 
    borderColor: 'rgb(229, 231, 235)', // gray-200
    backgroundColor: 'rgb(255, 255, 255)',
    scale: 1,
  },
  dragOver: { 
    borderColor: 'rgb(59, 130, 246)', // blue-500
    backgroundColor: 'rgb(239, 246, 255)', // blue-50
    scale: 1.02,
    transition: { duration: animationConfig.duration.fast }
  },
};

// Success checkmark animation
export const checkmarkVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { 
    pathLength: 1, 
    opacity: 1,
    transition: { 
      pathLength: { duration: 0.5, ease: animationConfig.easing.easeOut },
      opacity: { duration: 0.2 }
    }
  },
};

// Progress bar variants
export const progressVariants: Variants = {
  initial: { scaleX: 0, originX: 0 },
  animate: (progress: number) => ({
    scaleX: progress / 100,
    transition: { duration: animationConfig.duration.normal, ease: animationConfig.easing.easeOut }
  }),
};

// Toast notification variants
export const toastVariants: Variants = {
  hidden: { 
    opacity: 0, 
    x: 100,
    scale: 0.95,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    scale: 1,
    transition: { 
      duration: animationConfig.duration.normal,
      ease: animationConfig.easing.easeOut
    }
  },
  exit: { 
    opacity: 0, 
    x: 100,
    scale: 0.95,
    transition: { duration: animationConfig.duration.fast }
  },
};

// Modal/Dialog variants
export const modalOverlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: animationConfig.duration.fast }
  },
  exit: { 
    opacity: 0,
    transition: { duration: animationConfig.duration.fast }
  },
};

export const modalContentVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: { 
      duration: animationConfig.duration.normal,
      ease: animationConfig.easing.easeOut
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: 20,
    transition: { duration: animationConfig.duration.fast }
  },
};

// Shake animation (for errors)
export const shakeVariants: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.4 }
  },
};

// Pulse animation (for hints/highlights)
export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: { 
      duration: 1.5, 
      repeat: Infinity,
      ease: animationConfig.easing.easeInOut
    }
  },
};

// Skeleton loading variants
export const skeletonVariants: Variants = {
  pulse: {
    opacity: [0.5, 1, 0.5],
    transition: { 
      duration: 1.5, 
      repeat: Infinity,
      ease: animationConfig.easing.easeInOut
    }
  },
};
