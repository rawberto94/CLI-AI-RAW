/**
 * Animation utilities for contract components
 * Using Framer Motion for smooth, purposeful animations
 */

import { Variants } from 'framer-motion'

// Respect user's motion preferences
export const shouldReduceMotion = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Base animation variants
export const fadeIn: Variants = {
  initial: { 
    opacity: 0, 
    y: shouldReduceMotion() ? 0 : 20 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.3,
      ease: 'easeOut'
    }
  },
  exit: { 
    opacity: 0, 
    y: shouldReduceMotion() ? 0 : -20,
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.2
    }
  }
}

export const fadeInUp: Variants = {
  initial: { 
    opacity: 0, 
    y: shouldReduceMotion() ? 0 : 40 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.4,
      ease: 'easeOut'
    }
  }
}

export const scaleIn: Variants = {
  initial: { 
    opacity: 0, 
    scale: shouldReduceMotion() ? 1 : 0.95 
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.2,
      ease: 'easeOut'
    }
  }
}

// Card hover animation
export const cardHover: Variants = {
  rest: { 
    scale: 1, 
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.2
    }
  },
  hover: { 
    scale: shouldReduceMotion() ? 1 : 1.02, 
    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.2
    }
  }
}

// Progress animation
export const progressAnimation: Variants = {
  initial: { width: 0 },
  animate: (progress: number) => ({
    width: `${progress}%`,
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.5,
      ease: 'easeOut'
    }
  })
}

// Stagger children animation
export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: shouldReduceMotion() ? 0 : 0.1
    }
  }
}

// Slide in from right (for modals/sidebars)
export const slideInRight: Variants = {
  initial: { 
    x: shouldReduceMotion() ? 0 : '100%', 
    opacity: shouldReduceMotion() ? 1 : 0 
  },
  animate: { 
    x: 0, 
    opacity: 1,
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.3,
      ease: 'easeOut'
    }
  },
  exit: { 
    x: shouldReduceMotion() ? 0 : '100%', 
    opacity: shouldReduceMotion() ? 1 : 0,
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.2
    }
  }
}

// Bounce animation for success states
export const bounceIn: Variants = {
  initial: { 
    scale: shouldReduceMotion() ? 1 : 0, 
    opacity: 0 
  },
  animate: { 
    scale: 1, 
    opacity: 1,
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.6,
      ease: shouldReduceMotion() ? 'easeOut' : 'easeInOut',
      type: shouldReduceMotion() ? 'tween' : 'spring',
      bounce: shouldReduceMotion() ? 0 : 0.4
    }
  }
}

// Pulse animation for loading states
export const pulse: Variants = {
  animate: {
    opacity: shouldReduceMotion() ? 1 : [1, 0.5, 1],
    transition: {
      duration: shouldReduceMotion() ? 0 : 2,
      repeat: shouldReduceMotion() ? 0 : Infinity,
      ease: 'easeInOut'
    }
  }
}

// Shake animation for errors
export const shake: Variants = {
  animate: {
    x: shouldReduceMotion() ? 0 : [-10, 10, -10, 10, 0],
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.5
    }
  }
}

// Expand/collapse animation
export const expandCollapse: Variants = {
  collapsed: { 
    height: 0, 
    opacity: 0,
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.2
    }
  },
  expanded: { 
    height: 'auto', 
    opacity: 1,
    transition: {
      duration: shouldReduceMotion() ? 0 : 0.3,
      ease: 'easeOut'
    }
  }
}

// Counter animation for metrics
export const counterAnimation = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: shouldReduceMotion() ? 0 : 0.3 }
}

// Utility function to create custom spring animations
export const createSpringAnimation = (stiffness = 100, damping = 10) => ({
  type: shouldReduceMotion() ? 'tween' : 'spring',
  stiffness: shouldReduceMotion() ? 0 : stiffness,
  damping: shouldReduceMotion() ? 0 : damping,
  duration: shouldReduceMotion() ? 0.1 : undefined
})

// Utility function to create stagger animations
export const createStaggerAnimation = (staggerDelay = 0.1) => ({
  animate: {
    transition: {
      staggerChildren: shouldReduceMotion() ? 0 : staggerDelay
    }
  }
})
