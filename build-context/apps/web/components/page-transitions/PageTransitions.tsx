'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// ============================================================================
// Types
// ============================================================================

type TransitionType = 
  | 'fade' 
  | 'slide-left' 
  | 'slide-right' 
  | 'slide-up' 
  | 'slide-down'
  | 'scale'
  | 'rotate'
  | 'flip'
  | 'none';

interface PageTransitionContextValue {
  transitionType: TransitionType;
  setTransitionType: (type: TransitionType) => void;
  isTransitioning: boolean;
}

// ============================================================================
// Context
// ============================================================================

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null);

export function usePageTransition() {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error('usePageTransition must be used within PageTransitionProvider');
  }
  return context;
}

// ============================================================================
// Transition Variants
// ============================================================================

const transitionVariants: Record<TransitionType, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  'slide-left': {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -100, opacity: 0 },
  },
  'slide-right': {
    initial: { x: -100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 100, opacity: 0 },
  },
  'slide-up': {
    initial: { y: 50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -50, opacity: 0 },
  },
  'slide-down': {
    initial: { y: -50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 50, opacity: 0 },
  },
  scale: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 1.1, opacity: 0 },
  },
  rotate: {
    initial: { rotate: -5, opacity: 0, scale: 0.95 },
    animate: { rotate: 0, opacity: 1, scale: 1 },
    exit: { rotate: 5, opacity: 0, scale: 0.95 },
  },
  flip: {
    initial: { rotateY: 90, opacity: 0 },
    animate: { rotateY: 0, opacity: 1 },
    exit: { rotateY: -90, opacity: 0 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

// ============================================================================
// Provider
// ============================================================================

interface PageTransitionProviderProps {
  children: React.ReactNode;
  defaultTransition?: TransitionType;
}

export function PageTransitionProvider({
  children,
  defaultTransition = 'fade',
}: PageTransitionProviderProps) {
  const [transitionType, setTransitionType] = useState<TransitionType>(defaultTransition);
  const [isTransitioning, setIsTransitioning] = useState(false);

  return (
    <PageTransitionContext.Provider
      value={{ transitionType, setTransitionType, isTransitioning }}
    >
      {children}
    </PageTransitionContext.Provider>
  );
}

// ============================================================================
// Page Wrapper
// ============================================================================

interface PageWrapperProps {
  children: React.ReactNode;
  pageKey: string;
  transition?: TransitionType;
  className?: string;
  duration?: number;
}

export function PageWrapper({
  children,
  pageKey,
  transition,
  className = '',
  duration = 0.3,
}: PageWrapperProps) {
  const context = useContext(PageTransitionContext);
  const effectiveTransition = transition || context?.transitionType || 'fade';
  const variants = transitionVariants[effectiveTransition];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{ duration, ease: 'easeInOut' }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Staggered Children
// ============================================================================

interface StaggeredContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

export function StaggeredContainer({
  children,
  staggerDelay = 0.1,
  className = '',
}: StaggeredContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggeredItemProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export function StaggeredItem({
  children,
  className = '',
  direction = 'up',
}: StaggeredItemProps) {
  const directionOffsets = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, ...directionOffsets[direction] },
        visible: { opacity: 1, x: 0, y: 0 },
      }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Reveal on Scroll
// ============================================================================

interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  threshold?: number;
  once?: boolean;
}

export function RevealOnScroll({
  children,
  className = '',
  direction = 'up',
  delay = 0,
  duration = 0.5,
  threshold = 0.1,
  once = true,
}: RevealOnScrollProps) {
  const directionOffsets = {
    up: { y: 40 },
    down: { y: -40 },
    left: { x: 40 },
    right: { x: -40 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionOffsets[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount: threshold }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Animated Counter
// ============================================================================

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 1,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: AnimatedCounterProps) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {prefix}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        key={value}
      >
        <CounterValue value={value} duration={duration} decimals={decimals} />
      </motion.span>
      {suffix}
    </motion.span>
  );
}

function CounterValue({ value, duration, decimals }: { value: number; duration: number; decimals: number }) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = startValue + diff * eased;
      
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{displayValue.toFixed(decimals)}</>;
}

// ============================================================================
// Animated Text
// ============================================================================

interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
  animation?: 'fade' | 'slide-up' | 'scale' | 'wave';
}

export function AnimatedText({
  text,
  className = '',
  delay = 0,
  staggerDelay = 0.03,
  animation = 'slide-up',
}: AnimatedTextProps) {
  const characters = text.split('');

  const variants: Record<string, Variants> = {
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
    'slide-up': {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    },
    scale: {
      hidden: { opacity: 0, scale: 0.5 },
      visible: { opacity: 1, scale: 1 },
    },
    wave: {
      hidden: { y: 0 },
      visible: (i: number) => ({
        y: [0, -10, 0],
        transition: {
          delay: delay + i * staggerDelay,
          duration: 0.5,
          repeat: Infinity,
          repeatDelay: 2,
        },
      }),
    },
  };

  return (
    <motion.span
      initial="hidden"
      animate="visible"
      className={`inline-flex ${className}`}
      transition={{ delayChildren: delay, staggerChildren: staggerDelay }}
    >
      {characters.map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          variants={variants[animation]}
          custom={i}
          className="inline-block"
          style={{ whiteSpace: char === ' ' ? 'pre' : 'normal' }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

// ============================================================================
// Loading Transition
// ============================================================================

interface LoadingTransitionProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  minLoadTime?: number;
  className?: string;
}

export function LoadingTransition({
  isLoading,
  children,
  loadingComponent,
  minLoadTime = 300,
  className = '',
}: LoadingTransitionProps) {
  const [showLoading, setShowLoading] = React.useState(isLoading);
  const loadStartRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (isLoading) {
      loadStartRef.current = Date.now();
      setShowLoading(true);
    } else {
      const elapsed = Date.now() - loadStartRef.current;
      const remaining = Math.max(0, minLoadTime - elapsed);
      setTimeout(() => setShowLoading(false), remaining);
    }
  }, [isLoading, minLoadTime]);

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {showLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {loadingComponent || <DefaultLoadingSpinner />}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DefaultLoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <motion.div
        className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ============================================================================
// Scroll Progress
// ============================================================================

interface ScrollProgressProps {
  color?: string;
  height?: number;
  className?: string;
}

export function ScrollProgress({
  color = 'rgb(59, 130, 246)',
  height = 3,
  className = '',
}: ScrollProgressProps) {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      setProgress(scrollHeight > 0 ? (scrolled / scrollHeight) * 100 : 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${className}`}
      style={{ height }}
    >
      <motion.div
        className="h-full"
        style={{ backgroundColor: color }}
        initial={{ width: '0%' }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.1 }}
      />
    </div>
  );
}

// ============================================================================
// Parallax Container
// ============================================================================

interface ParallaxProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}

export function Parallax({
  children,
  speed = 0.5,
  className = '',
}: ParallaxProps) {
  const [offset, setOffset] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const scrolled = window.scrollY;
      const elementTop = rect.top + scrolled;
      const relativeScroll = scrolled - elementTop + window.innerHeight;
      setOffset(relativeScroll * speed);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div style={{ y: offset }}>
        {children}
      </motion.div>
    </div>
  );
}

// ============================================================================
// Hover Card
// ============================================================================

interface HoverCardProps {
  children: React.ReactNode;
  className?: string;
  scale?: number;
  rotate?: number;
  shadow?: boolean;
}

export function HoverCard({
  children,
  className = '',
  scale = 1.02,
  rotate = 0,
  shadow = true,
}: HoverCardProps) {
  return (
    <motion.div
      whileHover={{
        scale,
        rotate,
        boxShadow: shadow ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : undefined,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Magnetic Button
// ============================================================================

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}

export function MagneticButton({
  children,
  className = '',
  strength = 0.3,
}: MagneticButtonProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = (e.clientX - centerX) * strength;
    const y = (e.clientY - centerY) * strength;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
