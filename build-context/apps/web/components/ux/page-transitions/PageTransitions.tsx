'use client';

/**
 * Page Transitions
 * Smooth animated transitions between pages with progress indicators
 */

import React, { createContext, useContext, useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type TransitionType = 'fade' | 'slide' | 'scale' | 'slideUp' | 'slideDown' | 'none';

interface PageTransitionContextType {
  isTransitioning: boolean;
  progress: number;
  startTransition: () => void;
  endTransition: () => void;
  setTransitionType: (type: TransitionType) => void;
}

// ============================================================================
// Context
// ============================================================================

const PageTransitionContext = createContext<PageTransitionContextType | null>(null);

export function usePageTransition() {
  const context = useContext(PageTransitionContext);
  if (!context) {
    return {
      isTransitioning: false,
      progress: 0,
      startTransition: () => {},
      endTransition: () => {},
      setTransitionType: () => {},
    };
  }
  return context;
}

// ============================================================================
// Progress Bar
// ============================================================================

interface ProgressBarProps {
  isActive: boolean;
  progress: number;
  color?: string;
  height?: number;
}

const ProgressBar = memo(({ isActive, progress, color = 'bg-violet-600', height = 3 }: ProgressBarProps) => (
  <AnimatePresence>
    {isActive && (
      <motion.div key="active"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[9999]"
        style={{ height }}
      >
        <motion.div
          className={cn("h-full", color)}
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.2 }}
        />
        {/* Glow effect */}
        <motion.div
          className={cn("absolute top-0 right-0 h-full w-24 blur-sm", color)}
          style={{ opacity: 0.5 }}
          animate={{
            x: [0, 10, 0],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
          }}
        />
      </motion.div>
    )}
  </AnimatePresence>
));

ProgressBar.displayName = 'ProgressBar';

// ============================================================================
// Transition Variants
// ============================================================================

const transitionVariants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

// ============================================================================
// Page Transition Provider
// ============================================================================

interface PageTransitionProviderProps {
  children: React.ReactNode;
  defaultTransition?: TransitionType;
  showProgress?: boolean;
  progressColor?: string;
}

export function PageTransitionProvider({
  children,
  defaultTransition = 'fade',
  showProgress = true,
  progressColor = 'bg-violet-600',
}: PageTransitionProviderProps) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transitionType, setTransitionType] = useState<TransitionType>(defaultTransition);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [key, setKey] = useState(pathname);

  // Auto-transition on route change
  useEffect(() => {
    if (pathname !== key) {
      setIsTransitioning(true);
      setProgress(30);

      // Simulate progress
      const timer1 = setTimeout(() => setProgress(60), 100);
      const timer2 = setTimeout(() => setProgress(80), 200);
      const timer3 = setTimeout(() => {
        setProgress(100);
        setKey(pathname);
        setDisplayChildren(children);
      }, 300);
      const timer4 = setTimeout(() => {
        setIsTransitioning(false);
        setProgress(0);
      }, 500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
      };
    }
  }, [pathname, key, children]);

  const startTransition = useCallback(() => {
    setIsTransitioning(true);
    setProgress(30);
  }, []);

  const endTransition = useCallback(() => {
    setProgress(100);
    setTimeout(() => {
      setIsTransitioning(false);
      setProgress(0);
    }, 200);
  }, []);

  return (
    <PageTransitionContext.Provider
      value={{
        isTransitioning,
        progress,
        startTransition,
        endTransition,
        setTransitionType,
      }}
    >
      {showProgress && (
        <ProgressBar
          isActive={isTransitioning}
          progress={progress}
          color={progressColor}
        />
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          variants={transitionVariants[transitionType]}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2 }}
        >
          {displayChildren}
        </motion.div>
      </AnimatePresence>
    </PageTransitionContext.Provider>
  );
}

// ============================================================================
// Page Wrapper Component
// ============================================================================

interface PageWrapperProps {
  children: React.ReactNode;
  transition?: TransitionType;
  className?: string;
  delay?: number;
}

export const PageWrapper = memo(({
  children,
  transition = 'slideUp',
  className,
  delay = 0,
}: PageWrapperProps) => (
  <motion.div
    variants={transitionVariants[transition]}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.3, delay }}
    className={className}
  >
    {children}
  </motion.div>
));

PageWrapper.displayName = 'PageWrapper';

// ============================================================================
// Staggered Children Animation
// ============================================================================

interface StaggerContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

export const StaggerContainer = memo(({
  children,
  staggerDelay = 0.05,
  className,
}: StaggerContainerProps) => (
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
));

StaggerContainer.displayName = 'StaggerContainer';

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export const StaggerItem = memo(({ children, className }: StaggerItemProps) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    }}
    transition={{ duration: 0.3 }}
    className={className}
  >
    {children}
  </motion.div>
));

StaggerItem.displayName = 'StaggerItem';

// ============================================================================
// Section Reveal Animation
// ============================================================================

interface RevealSectionProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  className?: string;
  once?: boolean;
}

export const RevealSection = memo(({
  children,
  direction = 'up',
  delay = 0,
  className,
  once = true,
}: RevealSectionProps) => {
  const directionVariants = {
    up: { y: 40 },
    down: { y: -40 },
    left: { x: 40 },
    right: { x: -40 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionVariants[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, margin: '-50px' }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

RevealSection.displayName = 'RevealSection';

// ============================================================================
// Skeleton Loading Placeholder
// ============================================================================

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton = memo(({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) => {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'skeleton-wave',
    none: '',
  };

  return (
    <div
      className={cn(
        'bg-slate-200 dark:bg-slate-700',
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={{
        width: width || (variant === 'text' ? '100%' : undefined),
        height: height || (variant === 'text' ? '1em' : undefined),
      }}
    />
  );
});

Skeleton.displayName = 'Skeleton';

// ============================================================================
// Page Loading Skeleton
// ============================================================================

interface PageSkeletonProps {
  variant?: 'dashboard' | 'list' | 'detail' | 'form';
  className?: string;
}

export const PageSkeleton = memo(({ variant = 'dashboard', className }: PageSkeletonProps) => {
  if (variant === 'dashboard') {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton width={200} height={28} variant="rounded" />
            <Skeleton width={300} height={16} variant="rounded" />
          </div>
          <Skeleton width={120} height={40} variant="rounded" />
        </div>
        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} height={100} variant="rounded" />
          ))}
        </div>
        {/* Content area */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <Skeleton height={400} variant="rounded" />
          </div>
          <div className="space-y-4">
            <Skeleton height={190} variant="rounded" />
            <Skeleton height={190} variant="rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton width={200} height={28} variant="rounded" />
          <div className="flex gap-2">
            <Skeleton width={100} height={36} variant="rounded" />
            <Skeleton width={100} height={36} variant="rounded" />
          </div>
        </div>
        {/* Filters */}
        <div className="flex gap-3">
          <Skeleton width={200} height={40} variant="rounded" />
          <Skeleton width={150} height={40} variant="rounded" />
          <Skeleton width={150} height={40} variant="rounded" />
        </div>
        {/* List items */}
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} height={72} variant="rounded" />
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Breadcrumb */}
        <Skeleton width={300} height={20} variant="rounded" />
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton width={400} height={32} variant="rounded" />
            <div className="flex gap-2">
              <Skeleton width={80} height={24} variant="rounded" />
              <Skeleton width={100} height={24} variant="rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton width={36} height={36} variant="rounded" />
            <Skeleton width={36} height={36} variant="rounded" />
            <Skeleton width={100} height={36} variant="rounded" />
          </div>
        </div>
        {/* Content */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <Skeleton height={200} variant="rounded" />
            <Skeleton height={300} variant="rounded" />
          </div>
          <div className="space-y-4">
            <Skeleton height={150} variant="rounded" />
            <Skeleton height={200} variant="rounded" />
            <Skeleton height={100} variant="rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className={cn('max-w-2xl space-y-6', className)}>
        <Skeleton width={300} height={32} variant="rounded" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton width={120} height={16} variant="rounded" />
              <Skeleton height={40} variant="rounded" />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Skeleton width={100} height={40} variant="rounded" />
          <Skeleton width={80} height={40} variant="rounded" />
        </div>
      </div>
    );
  }

  return null;
});

PageSkeleton.displayName = 'PageSkeleton';

export default PageTransitionProvider;
