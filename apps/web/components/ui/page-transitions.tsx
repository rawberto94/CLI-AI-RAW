/**
 * Page Transitions
 * 
 * Smooth, professional page transitions for a next-level UX
 */

'use client';

import React, { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// =============================================================================
// TRANSITION VARIANTS
// =============================================================================

export const pageTransitionVariants: Record<string, Variants> = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
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
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  morphUp: {
    initial: { opacity: 0, y: 30, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.98 },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(10px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(10px)' },
  },
};

// =============================================================================
// PAGE TRANSITION WRAPPER
// =============================================================================

interface PageTransitionProps {
  children: React.ReactNode;
  variant?: keyof typeof pageTransitionVariants;
  duration?: number;
  delay?: number;
  className?: string;
  key?: string;
}

export const PageTransition = memo<PageTransitionProps>(({
  children,
  variant = 'slideUp',
  duration = 0.4,
  delay = 0,
  className,
}) => {
  const variants = pageTransitionVariants[variant];
  
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1], // Custom ease for smooth feel
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
});
PageTransition.displayName = 'PageTransition';

// =============================================================================
// STAGGER CONTAINER
// =============================================================================

interface StaggerContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
  once?: boolean;
}

export const StaggerContainer = memo<StaggerContainerProps>(({
  children,
  staggerDelay = 0.1,
  className,
  once = true,
}) => {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.1,
          },
        },
        exit: {
          transition: {
            staggerChildren: staggerDelay / 2,
            staggerDirection: -1,
          },
        },
      }}
      viewport={{ once }}
      className={className}
    >
      {children}
    </motion.div>
  );
});
StaggerContainer.displayName = 'StaggerContainer';

// =============================================================================
// STAGGER ITEM
// =============================================================================

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export const StaggerItem = memo<StaggerItemProps>(({ children, className }) => {
  return (
    <motion.div
      variants={{
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
      }}
      transition={{
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
});
StaggerItem.displayName = 'StaggerItem';

// =============================================================================
// SECTION REVEAL
// =============================================================================

interface SectionRevealProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  className?: string;
  once?: boolean;
}

export const SectionReveal = memo<SectionRevealProps>(({
  children,
  direction = 'up',
  delay = 0,
  className,
  once = true,
}) => {
  const getInitialPosition = () => {
    switch (direction) {
      case 'up': return { y: 40 };
      case 'down': return { y: -40 };
      case 'left': return { x: 40 };
      case 'right': return { x: -40 };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...getInitialPosition() }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      viewport={{ once, margin: '-50px' }}
      className={className}
    >
      {children}
    </motion.div>
  );
});
SectionReveal.displayName = 'SectionReveal';

// =============================================================================
// LOADING SCREEN
// =============================================================================

interface LoadingScreenProps {
  message?: string;
  progress?: number;
  className?: string;
}

export const LoadingScreen = memo<LoadingScreenProps>(({
  message = 'Loading...',
  progress,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center',
        'bg-background/80 backdrop-blur-sm',
        className
      )}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <motion.div
            className="h-12 w-12 rounded-full border-4 border-primary/20"
          />
          <motion.div
            className="absolute inset-0 h-12 w-12 rounded-full border-4 border-t-primary"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-muted-foreground"
        >
          {message}
        </motion.p>
        
        {progress !== undefined && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 200, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="h-1 w-[200px] overflow-hidden rounded-full bg-muted"
          >
            <motion.div
              className="h-full bg-primary"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
});
LoadingScreen.displayName = 'LoadingScreen';

// =============================================================================
// SKELETON LOADER
// =============================================================================

interface SkeletonLoaderProps {
  type: 'card' | 'table' | 'list' | 'text' | 'form' | 'chart';
  count?: number;
  className?: string;
}

export const SkeletonLoader = memo<SkeletonLoaderProps>(({
  type,
  count = 1,
  className,
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className="rounded-lg border bg-card p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-20 w-full animate-pulse rounded bg-muted" />
          </div>
        );
      case 'table':
        return (
          <div className="rounded-lg border overflow-hidden">
            <div className="h-10 animate-pulse bg-muted" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-t p-4">
                <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        );
      case 'list':
        return (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        );
      case 'text':
        return (
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
          </div>
        );
      case 'form':
        return (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        );
      case 'chart':
        return (
          <div className="rounded-lg border p-4">
            <div className="h-4 w-32 animate-pulse rounded bg-muted mb-4" />
            <div className="h-48 w-full animate-pulse rounded bg-muted" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          {renderSkeleton()}
        </motion.div>
      ))}
    </div>
  );
});
SkeletonLoader.displayName = 'SkeletonLoader';

// =============================================================================
// ANIMATE ON MOUNT
// =============================================================================

interface AnimateOnMountProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export const AnimateOnMount = memo<AnimateOnMountProps>(({
  children,
  delay = 0,
  duration = 0.4,
  className,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isMounted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ delay, duration, ease: [0.22, 1, 0.36, 1] }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
AnimateOnMount.displayName = 'AnimateOnMount';

// =============================================================================
// LAYOUT TRANSITION WRAPPER
// =============================================================================

interface LayoutTransitionProps {
  children: React.ReactNode;
  layoutId?: string;
  className?: string;
}

export const LayoutTransition = memo<LayoutTransitionProps>(({
  children,
  layoutId,
  className,
}) => {
  return (
    <LayoutGroup>
      <motion.div
        layoutId={layoutId}
        layout
        transition={{
          type: 'spring',
          stiffness: 350,
          damping: 30,
        }}
        className={className}
      >
        {children}
      </motion.div>
    </LayoutGroup>
  );
});
LayoutTransition.displayName = 'LayoutTransition';

// =============================================================================
// PRESENCE WRAPPER
// =============================================================================

interface PresenceWrapperProps {
  children: React.ReactNode;
  show: boolean;
  mode?: 'wait' | 'sync' | 'popLayout';
  className?: string;
}

export const PresenceWrapper = memo<PresenceWrapperProps>(({
  children,
  show,
  mode = 'wait',
  className,
}) => {
  return (
    <AnimatePresence mode={mode}>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
PresenceWrapper.displayName = 'PresenceWrapper';

// =============================================================================
// SCROLL PROGRESS INDICATOR
// =============================================================================

interface ScrollProgressProps {
  color?: string;
  height?: number;
  className?: string;
}

export const ScrollProgress = memo<ScrollProgressProps>(({
  color = 'var(--primary)',
  height = 2,
  className,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(scrollPercent);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.div
      className={cn('fixed top-0 left-0 right-0 z-50', className)}
      style={{
        height,
        background: `linear-gradient(90deg, ${color} ${progress}%, transparent ${progress}%)`,
      }}
    />
  );
});
ScrollProgress.displayName = 'ScrollProgress';

// =============================================================================
// BLUR REVEAL
// =============================================================================

interface BlurRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const BlurReveal = memo<BlurRevealProps>(({
  children,
  delay = 0,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(12px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
});
BlurReveal.displayName = 'BlurReveal';

// =============================================================================
// CONTENT PLACEHOLDER
// =============================================================================

interface ContentPlaceholderProps {
  isLoading: boolean;
  children: React.ReactNode;
  skeleton?: React.ReactNode;
  className?: string;
}

export const ContentPlaceholder = memo<ContentPlaceholderProps>(({
  isLoading,
  children,
  skeleton,
  className,
}) => {
  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {skeleton || (
              <div className="space-y-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
ContentPlaceholder.displayName = 'ContentPlaceholder';

// =============================================================================
// EXPORT ALL
// =============================================================================

export {
  PageTransition as default,
};
