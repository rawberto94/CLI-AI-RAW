'use client';

/**
 * Enhanced Interactive Button Components
 * Beautiful buttons with micro-interactions, haptic feedback, and states
 */

import React, { useState, useCallback, forwardRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Loader2, Check, X, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Ripple Effect Hook
// ============================================

function useRipple() {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const createRipple = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
    }, 600);
  }, []);

  return { ripples, createRipple };
}

// ============================================
// Ripple Container
// ============================================

function RippleContainer({ ripples }: { ripples: Array<{ x: number; y: number; id: number }> }) {
  return (
    <span className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: ripple.x,
              top: ripple.y,
              width: 20,
              height: 20,
              marginLeft: -10,
              marginTop: -10,
              borderRadius: '50%',
              backgroundColor: 'currentColor',
              opacity: 0.2,
            }}
          />
        ))}
      </AnimatePresence>
    </span>
  );
}

// ============================================
// Shimmer Effect
// ============================================

function ShimmerEffect() {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none"
      initial={false}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

// ============================================
// Pulse Effect
// ============================================

function PulseRing({ color = 'currentColor' }: { color?: string }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-[inherit] pointer-events-none"
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      style={{ boxShadow: `0 0 0 2px ${color}` }}
    />
  );
}

// ============================================
// Gradient Button
// ============================================

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'danger' | 'purple' | 'orange' | 'cyan';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  success?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  shimmer?: boolean;
  pulse?: boolean;
  glow?: boolean;
}

const gradientVariants = {
  primary: 'from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700',
  success: 'from-emerald-500 via-green-500 to-teal-500 hover:from-emerald-600 hover:via-green-600 hover:to-teal-600',
  danger: 'from-red-500 via-rose-500 to-pink-500 hover:from-red-600 hover:via-rose-600 hover:to-pink-600',
  purple: 'from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-700 hover:via-violet-700 hover:to-fuchsia-700',
  orange: 'from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600',
  cyan: 'from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-600 hover:via-teal-600 hover:to-emerald-600',
};

const glowVariants = {
  primary: 'shadow-blue-500/30 hover:shadow-blue-500/50',
  success: 'shadow-emerald-500/30 hover:shadow-emerald-500/50',
  danger: 'shadow-red-500/30 hover:shadow-red-500/50',
  purple: 'shadow-purple-500/30 hover:shadow-purple-500/50',
  orange: 'shadow-orange-500/30 hover:shadow-orange-500/50',
  cyan: 'shadow-cyan-500/30 hover:shadow-cyan-500/50',
};

const sizeClasses = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  xl: 'h-14 px-8 text-lg gap-3',
};

export const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    success = false,
    icon,
    iconPosition = 'left',
    shimmer = false,
    pulse = false,
    glow = true,
    className,
    children,
    disabled,
    onClick,
    ...props
  }, ref) => {
    const { ripples, createRipple } = useRipple();
    const isDisabled = disabled || loading;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        createRipple(e);
        onClick?.(e);
      }
    };

    return (
      <motion.button
        ref={ref}
        whileHover={!isDisabled ? { scale: 1.02, y: -1 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        disabled={isDisabled}
        onClick={handleClick}
        className={cn(
          'relative inline-flex items-center justify-center font-semibold text-white rounded-xl',
          'bg-gradient-to-r transition-all duration-300',
          gradientVariants[variant],
          sizeClasses[size],
          glow && `shadow-lg ${glowVariants[variant]}`,
          isDisabled && 'opacity-50 cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50',
          className
        )}
        {...props}
      >
        {shimmer && !loading && <ShimmerEffect />}
        {pulse && !loading && <PulseRing />}
        <RippleContainer ripples={ripples} />

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading...</span>
            </motion.span>
          ) : success ? (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Done!</span>
            </motion.span>
          ) : (
            <motion.span
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 relative z-10"
            >
              {icon && iconPosition === 'left' && icon}
              {children}
              {icon && iconPosition === 'right' && icon}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  }
);
GradientButton.displayName = 'GradientButton';

// ============================================
// Icon Button with Tooltip
// ============================================

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  badge?: number | string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

const iconButtonVariants = {
  default: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
  outline: 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800',
  danger: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20',
};

const iconButtonSizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({
    icon,
    label,
    variant = 'default',
    size = 'md',
    loading = false,
    badge,
    tooltipPosition = 'top',
    className,
    disabled,
    onClick,
    ...props
  }, ref) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const { ripples, createRipple } = useRipple();
    const isDisabled = disabled || loading;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        createRipple(e);
        onClick?.(e);
      }
    };

    const tooltipPositions = {
      top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
      bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
      left: 'right-full top-1/2 -translate-y-1/2 mr-2',
      right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    return (
      <div className="relative inline-flex">
        <motion.button
          ref={ref}
          whileHover={!isDisabled ? { scale: 1.05 } : {}}
          whileTap={!isDisabled ? { scale: 0.95 } : {}}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          disabled={isDisabled}
          onClick={handleClick}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          aria-label={label}
          className={cn(
            'relative inline-flex items-center justify-center rounded-xl transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400',
            iconButtonVariants[variant],
            iconButtonSizes[size],
            isDisabled && 'opacity-50 cursor-not-allowed',
            className
          )}
          {...props}
        >
          <RippleContainer ripples={ripples} />
          
          {loading ? (
            <Loader2 className={cn(iconSizes[size], 'animate-spin')} />
          ) : (
            <span className={iconSizes[size]}>{icon}</span>
          )}

          {/* Badge */}
          {badge !== undefined && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full"
            >
              {typeof badge === 'number' && badge > 99 ? '99+' : badge}
            </motion.span>
          )}
        </motion.button>

        {/* Tooltip */}
        <AnimatePresence>
          {showTooltip && !isDisabled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-slate-900 rounded-lg whitespace-nowrap pointer-events-none',
                'dark:bg-slate-700',
                tooltipPositions[tooltipPosition]
              )}
            >
              {label}
              <span
                className={cn(
                  'absolute w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45',
                  tooltipPosition === 'top' && 'top-full left-1/2 -translate-x-1/2 -mt-1',
                  tooltipPosition === 'bottom' && 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
                  tooltipPosition === 'left' && 'left-full top-1/2 -translate-y-1/2 -ml-1',
                  tooltipPosition === 'right' && 'right-full top-1/2 -translate-y-1/2 -mr-1'
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
IconButton.displayName = 'IconButton';

// ============================================
// Async Action Button
// ============================================

type AsyncButtonState = 'idle' | 'loading' | 'success' | 'error';

interface AsyncActionButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick: () => Promise<void>;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  successMessage?: string;
  errorMessage?: string;
  resetDelay?: number;
  icon?: React.ReactNode;
}

const asyncButtonVariants = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700',
  outline: 'border border-slate-200 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800',
  ghost: 'text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800',
};

const asyncButtonSizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const AsyncActionButton = forwardRef<HTMLButtonElement, AsyncActionButtonProps>(
  ({
    onClick,
    variant = 'primary',
    size = 'md',
    successMessage = 'Done!',
    errorMessage = 'Failed',
    resetDelay = 2000,
    icon,
    className,
    children,
    disabled,
    ...props
  }, ref) => {
    const [state, setState] = useState<AsyncButtonState>('idle');

    const handleClick = async () => {
      if (state !== 'idle') return;

      setState('loading');
      try {
        await onClick();
        setState('success');
      } catch {
        setState('error');
      }

      setTimeout(() => setState('idle'), resetDelay);
    };

    const stateStyles = {
      idle: asyncButtonVariants[variant],
      loading: asyncButtonVariants[variant],
      success: 'bg-emerald-500 text-white hover:bg-emerald-500',
      error: 'bg-red-500 text-white hover:bg-red-500',
    };

    const isDisabled = disabled || state === 'loading';

    return (
      <motion.button
        ref={ref}
        whileHover={!isDisabled ? { scale: 1.02 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        disabled={isDisabled}
        onClick={handleClick}
        className={cn(
          'relative inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400',
          stateStyles[state],
          asyncButtonSizes[size],
          isDisabled && state !== 'loading' && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        <AnimatePresence mode="wait">
          {state === 'loading' && (
            <motion.span
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
            </motion.span>
          )}
          {state === 'success' && (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {successMessage}
            </motion.span>
          )}
          {state === 'error' && (
            <motion.span
              key="error"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              {errorMessage}
            </motion.span>
          )}
          {state === 'idle' && (
            <motion.span
              key="idle"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2"
            >
              {icon}
              {children}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  }
);
AsyncActionButton.displayName = 'AsyncActionButton';

// ============================================
// Floating Action Button
// ============================================

interface FABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  extended?: boolean;
  pulse?: boolean;
}

const fabVariants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/30',
  secondary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/30 dark:bg-white dark:text-slate-900',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/30',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-red-500/30',
};

const fabSizes = {
  sm: 'w-12 h-12',
  md: 'w-14 h-14',
  lg: 'w-16 h-16',
};

const fabPositions = {
  'bottom-right': 'fixed bottom-6 right-6',
  'bottom-left': 'fixed bottom-6 left-6',
  'bottom-center': 'fixed bottom-6 left-1/2 -translate-x-1/2',
};

export const FAB = forwardRef<HTMLButtonElement, FABProps>(
  ({
    icon,
    label,
    variant = 'primary',
    size = 'md',
    position = 'bottom-right',
    extended = false,
    pulse = false,
    className,
    onClick,
    ...props
  }, ref) => {
    const { ripples, createRipple } = useRipple();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      createRipple(e);
      onClick?.(e);
    };

    return (
      <motion.button
        ref={ref}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onClick={handleClick}
        aria-label={label}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full shadow-lg transition-colors z-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white',
          fabVariants[variant],
          extended ? 'px-6 gap-2' : fabSizes[size],
          fabPositions[position],
          className
        )}
        {...props}
      >
        {pulse && (
          <motion.span
            className="absolute inset-0 rounded-full bg-current opacity-30"
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <RippleContainer ripples={ripples} />
        <span className={size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-6 h-6' : 'w-7 h-7'}>{icon}</span>
        {extended && <span className="font-medium">{label}</span>}
      </motion.button>
    );
  }
);
FAB.displayName = 'FAB';

// ============================================
// Split Button
// ============================================

interface SplitButtonProps {
  mainLabel: string;
  mainIcon?: React.ReactNode;
  onMainClick: () => void;
  options: Array<{ label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }>;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function SplitButton({
  mainLabel,
  mainIcon,
  onMainClick,
  options,
  variant = 'primary',
  size = 'md',
  loading = false,
}: SplitButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const variantStyles = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-white',
    outline: 'border border-slate-200 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-white',
  };

  const sizeStyles = {
    sm: 'h-9 text-sm',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  };

  return (
    <div className="relative inline-flex">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onMainClick}
        disabled={loading}
        className={cn(
          'inline-flex items-center gap-2 px-4 rounded-l-xl font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          variantStyles[variant],
          sizeStyles[size],
          loading && 'opacity-50 cursor-not-allowed'
        )}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mainIcon}
        {mainLabel}
      </motion.button>
      
      <div className={cn('w-px', variant === 'outline' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-white/20')} />
      
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center justify-center w-10 rounded-r-xl transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          variantStyles[variant],
          sizeStyles[size]
        )}
      >
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
            >
              {options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    option.onClick();
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors',
                    option.danger
                      ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  )}
                >
                  {option.icon && <span className="w-4 h-4">{option.icon}</span>}
                  {option.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default {
  GradientButton,
  IconButton,
  AsyncActionButton,
  FAB,
  SplitButton,
};
