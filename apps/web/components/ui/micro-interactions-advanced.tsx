/**
 * Advanced Micro-Interactions
 * 
 * Subtle, delightful animations that make the UI feel premium and professional
 */

'use client';

import React, { useState, useEffect, useCallback, memo, forwardRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence, MotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

// =============================================================================
// MAGNETIC BUTTON
// Subtle magnetic effect on hover
// =============================================================================

interface MagneticButtonProps {
  strength?: number;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const MagneticButton = memo(forwardRef<HTMLButtonElement, MagneticButtonProps>(
  ({ strength = 0.3, className, children, onClick, disabled, type = 'button' }, ref) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springConfig = { stiffness: 300, damping: 30 };
    const xSpring = useSpring(x, springConfig);
    const ySpring = useSpring(y, springConfig);

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distanceX = (e.clientX - centerX) * strength;
      const distanceY = (e.clientY - centerY) * strength;
      
      x.set(distanceX);
      y.set(distanceY);
    };

    const handleMouseLeave = () => {
      x.set(0);
      y.set(0);
    };

    return (
      <motion.button
        ref={ref}
        className={className}
        style={{ x: xSpring, y: ySpring }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        disabled={disabled}
        type={type}
      >
        {children}
      </motion.button>
    );
  }
));
MagneticButton.displayName = 'MagneticButton';

// =============================================================================
// TILT CARD
// 3D tilt effect on hover
// =============================================================================

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  tiltAmount?: number;
  glare?: boolean;
}

export const TiltCard = memo<TiltCardProps>(({
  children,
  className,
  tiltAmount = 10,
  glare = true,
}) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-0.5, 0.5], [tiltAmount, -tiltAmount]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-tiltAmount, tiltAmount]);
  
  // Move useTransform to top level to avoid conditional hook call
  const glareOpacity = useTransform(
    [x, y],
    ([latestX, latestY]) => {
      const distance = Math.sqrt((latestX as number) ** 2 + (latestY as number) ** 2);
      return distance * 0.5;
    }
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = (e.clientX - rect.left) / rect.width - 0.5;
    const yPercent = (e.clientY - rect.top) / rect.height - 0.5;
    
    x.set(xPercent);
    y.set(yPercent);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      className={cn('relative', className)}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {children}
      {glare && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-inherit bg-gradient-to-br from-white/20 to-transparent"
          style={{
            opacity: glareOpacity,
          }}
        />
      )}
    </motion.div>
  );
});
TiltCard.displayName = 'TiltCard';

// =============================================================================
// RIPPLE EFFECT
// Material-like ripple on click
// =============================================================================

interface RippleProps {
  x: number;
  y: number;
  size: number;
}

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  rippleColor?: string;
}

export const RippleButton = memo(forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({ rippleColor = 'rgba(255, 255, 255, 0.4)', className, children, onClick, ...props }, ref) => {
    const [ripples, setRipples] = useState<RippleProps[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      setRipples((prev) => [...prev, { x, y, size }]);
      setTimeout(() => setRipples((prev) => prev.slice(1)), 600);

      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        className={cn('relative overflow-hidden', className)}
        onClick={handleClick}
        {...props}
      >
        {children}
        {ripples.map((ripple, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
              backgroundColor: rippleColor,
            }}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        ))}
      </button>
    );
  }
));
RippleButton.displayName = 'RippleButton';

// =============================================================================
// SUCCESS CHECKMARK
// Animated success indicator
// =============================================================================

interface SuccessCheckmarkProps {
  size?: number;
  color?: string;
  className?: string;
}

export const SuccessCheckmark = memo<SuccessCheckmarkProps>(({
  size = 48,
  color = '#22c55e',
  className,
}) => {
  return (
    <motion.div
      className={cn('flex items-center justify-center', className)}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 52 52"
        fill="none"
      >
        <motion.circle
          cx="26"
          cy="26"
          r="25"
          stroke={color}
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
        <motion.path
          d="M14.5 27L22.5 35L37.5 18"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.3, ease: 'easeInOut' }}
        />
      </svg>
    </motion.div>
  );
});
SuccessCheckmark.displayName = 'SuccessCheckmark';

// =============================================================================
// LOADING DOTS
// Bouncing dots animation
// =============================================================================

interface LoadingDotsProps {
  size?: number;
  color?: string;
  className?: string;
}

export const LoadingDots = memo<LoadingDotsProps>(({
  size = 8,
  color = 'currentColor',
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
          }}
          animate={{
            y: ['0%', '-50%', '0%'],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
});
LoadingDots.displayName = 'LoadingDots';

// =============================================================================
// PULSE RING
// Expanding pulse ring effect
// =============================================================================

interface PulseRingProps {
  size?: number;
  color?: string;
  duration?: number;
  className?: string;
}

export const PulseRing = memo<PulseRingProps>(({
  size = 40,
  color = '#3b82f6',
  duration = 2,
  className,
}) => {
  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${color}` }}
        animate={{
          scale: [1, 2],
          opacity: [0.8, 0],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${color}` }}
        animate={{
          scale: [1, 2],
          opacity: [0.8, 0],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'easeOut',
          delay: duration / 2,
        }}
      />
    </div>
  );
});
PulseRing.displayName = 'PulseRing';

// =============================================================================
// COUNT UP
// Animated number counter
// =============================================================================

interface CountUpProps {
  end: number;
  start?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const CountUp = memo<CountUpProps>(({
  end,
  start = 0,
  duration = 1.5,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}) => {
  const [count, setCount] = useState(start);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = count;
    const endValue = end;

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;
      
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration]);

  return (
    <span className={className}>
      {prefix}
      {count.toFixed(decimals)}
      {suffix}
    </span>
  );
});
CountUp.displayName = 'CountUp';

// =============================================================================
// SKELETON PULSE
// Enhanced skeleton loading
// =============================================================================

interface SkeletonPulseProps {
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export const SkeletonPulse = memo<SkeletonPulseProps>(({
  width = '100%',
  height = 20,
  rounded = 'md',
  className,
}) => {
  const roundedClasses = {
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  };

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden bg-gray-200 dark:bg-gray-800',
        roundedClasses[rounded],
        className
      )}
      style={{ width, height }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 dark:via-gray-700/50 to-transparent"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </motion.div>
  );
});
SkeletonPulse.displayName = 'SkeletonPulse';

// =============================================================================
// FLOATING LABEL INPUT
// Input with floating label animation
// =============================================================================

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FloatingLabelInput = memo(forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  ({ label, error, className, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(!!props.value);

    const isFloating = isFocused || hasValue;

    return (
      <div className={cn('relative', className)}>
        <input
          ref={ref}
          className={cn(
            'w-full px-4 pt-6 pb-2 text-sm bg-white dark:bg-gray-900 border rounded-lg transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
            error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            setIsFocused(false);
            setHasValue(!!e.target.value);
          }}
          onChange={(e) => {
            setHasValue(!!e.target.value);
            props.onChange?.(e);
          }}
          {...props}
        />
        <motion.label
          className={cn(
            'absolute left-4 pointer-events-none origin-left',
            error ? 'text-red-500' : isFloating ? 'text-blue-600' : 'text-gray-500'
          )}
          initial={false}
          animate={{
            y: isFloating ? 8 : 18,
            scale: isFloating ? 0.75 : 1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {label}
        </motion.label>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-xs text-red-500"
          >
            {error}
          </motion.p>
        )}
      </div>
    );
  }
));
FloatingLabelInput.displayName = 'FloatingLabelInput';

// =============================================================================
// STAGGER CHILDREN
// Wrapper for staggered animations
// =============================================================================

interface StaggerChildrenProps {
  children: React.ReactNode;
  delay?: number;
  stagger?: number;
  className?: string;
}

export const StaggerChildren = memo<StaggerChildrenProps>(({
  children,
  delay = 0,
  stagger = 0.08,
  className,
}) => {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            delayChildren: delay,
            staggerChildren: stagger,
          },
        },
      }}
    >
      {React.Children.map(children, (child) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.3 }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
});
StaggerChildren.displayName = 'StaggerChildren';

// =============================================================================
// NOTIFICATION BADGE
// Animated notification count
// =============================================================================

interface NotificationBadgeProps {
  count: number;
  max?: number;
  className?: string;
}

export const NotificationBadge = memo<NotificationBadgeProps>(({
  count,
  max = 99,
  className,
}) => {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count;

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className={cn(
        'absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full',
        className
      )}
    >
      <motion.span
        key={count}
        initial={{ scale: 1.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {displayCount}
      </motion.span>
    </motion.span>
  );
});
NotificationBadge.displayName = 'NotificationBadge';

// =============================================================================
// CONFETTI BURST
// Celebration animation
// =============================================================================

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
}

interface ConfettiBurstProps {
  active: boolean;
  count?: number;
  colors?: string[];
}

export const ConfettiBurst = memo<ConfettiBurstProps>(({
  active,
  count = 20,
  colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6'],
}) => {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);

  useEffect(() => {
    if (active) {
      const newParticles = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 200 - 100,
        y: -(Math.random() * 200 + 50),
        rotation: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      setParticles(newParticles);
      
      setTimeout(() => setParticles([]), 1500);
    }
  }, [active, count, colors]);

  return (
    <AnimatePresence>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="fixed pointer-events-none w-2 h-2"
          style={{ backgroundColor: particle.color }}
          initial={{
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            rotate: 0,
            opacity: 1,
          }}
          animate={{
            x: window.innerWidth / 2 + particle.x,
            y: window.innerHeight / 2 + particle.y,
            rotate: particle.rotation,
            opacity: 0,
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 1.2,
            ease: [0.1, 0.8, 0.2, 1],
          }}
        />
      ))}
    </AnimatePresence>
  );
});
ConfettiBurst.displayName = 'ConfettiBurst';

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  MagneticButton,
  TiltCard,
  RippleButton,
  SuccessCheckmark,
  LoadingDots,
  PulseRing,
  CountUp,
  SkeletonPulse,
  FloatingLabelInput,
  StaggerChildren,
  NotificationBadge,
  ConfettiBurst,
};
