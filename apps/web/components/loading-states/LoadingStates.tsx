'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, AlertCircle, RefreshCw, CloudOff, Rocket, Sparkles, Zap } from 'lucide-react';

// ============================================================================
// Spinner Variants
// ============================================================================

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
}

export function Spinner({ size = 'md', color = 'text-violet-600', className = '' }: SpinnerProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${color} ${className}`} />
  );
}

export function DotsSpinner({ size = 'md', color = 'bg-violet-600', className = '' }: SpinnerProps) {
  const sizeClasses = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4',
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className={`rounded-full ${sizeClasses[size]} ${color}`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

export function PulseSpinner({ size = 'md', color = 'bg-violet-600', className = '' }: SpinnerProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <motion.div
        className={`absolute inset-0 rounded-full ${color}`}
        animate={{
          scale: [1, 2],
          opacity: [0.5, 0],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
        }}
      />
      <div className={`absolute inset-0 rounded-full ${color}`} />
    </div>
  );
}

export function BarSpinner({ size = 'md', color = 'bg-violet-600', className = '' }: SpinnerProps) {
  const heights = {
    xs: 'h-3',
    sm: 'h-4',
    md: 'h-6',
    lg: 'h-8',
    xl: 'h-12',
  };

  return (
    <div className={`flex items-center gap-1 ${heights[size]} ${className}`}>
      {[0, 1, 2, 3, 4].map(i => (
        <motion.div
          key={i}
          className={`w-1 rounded-full ${color}`}
          animate={{
            height: ['40%', '100%', '40%'],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Loading Overlay
// ============================================================================

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  blur?: boolean;
  spinnerType?: 'spinner' | 'dots' | 'pulse' | 'bars';
  className?: string;
}

export function LoadingOverlay({
  isLoading,
  message,
  blur = true,
  spinnerType = 'spinner',
  className = '',
}: LoadingOverlayProps) {
  const spinners = {
    spinner: <Spinner size="lg" />,
    dots: <DotsSpinner size="lg" />,
    pulse: <PulseSpinner size="lg" />,
    bars: <BarSpinner size="lg" />,
  };

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`
            absolute inset-0 z-50 flex flex-col items-center justify-center
            bg-white/80 dark:bg-gray-900/80
            ${blur ? 'backdrop-blur-sm' : ''}
            ${className}
          `}
        >
          {spinners[spinnerType]}
          {message && (
            <p className="mt-4 text-gray-600 dark:text-gray-400 text-sm">
              {message}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Loading Button
// ============================================================================

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingButton({
  children,
  loading = false,
  loadingText,
  icon,
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  ...props
}: LoadingButtonProps) {
  const variantClasses = {
    primary: 'bg-violet-600 hover:bg-violet-700 text-white disabled:bg-violet-400',
    secondary: 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100',
    danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-400',
    ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:text-gray-400',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      disabled={loading || disabled}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size="sm" color="currentColor" />
          {loadingText || children}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

// ============================================================================
// Loading States
// ============================================================================

type LoadingStateType = 'loading' | 'success' | 'error' | 'empty';

interface LoadingStateProps {
  state: LoadingStateType;
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function LoadingState({
  state,
  loadingMessage = 'Loading...',
  successMessage = 'Success!',
  errorMessage = 'Something went wrong',
  emptyMessage = 'No data found',
  onRetry,
  children,
  className = '',
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <AnimatePresence mode="wait">
        {state === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center"
          >
            <Spinner size="xl" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              {loadingMessage}
            </p>
          </motion.div>
        )}

        {state === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="mt-4 text-gray-900 dark:text-white font-semibold">
              {successMessage}
            </p>
            {children}
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <p className="mt-4 text-gray-900 dark:text-white font-semibold">
              {errorMessage}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            )}
          </motion.div>
        )}

        {state === 'empty' && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <CloudOff className="w-8 h-8 text-gray-400" />
            </div>
            <p className="mt-4 text-gray-500">
              {emptyMessage}
            </p>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Progress Loading
// ============================================================================

interface ProgressLoadingProps {
  progress: number;
  message?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressLoading({
  progress,
  message,
  showPercentage = true,
  className = '',
}: ProgressLoadingProps) {
  return (
    <div className={`w-full ${className}`}>
      {(message || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {message && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {message}
            </span>
          )}
          {showPercentage && (
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {Math.round(progress)}%
            </span>
          )}
        </div>
      )}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-violet-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Indeterminate Progress
// ============================================================================

interface IndeterminateProgressProps {
  className?: string;
}

export function IndeterminateProgress({ className = '' }: IndeterminateProgressProps) {
  return (
    <div className={`h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className}`}>
      <motion.div
        className="h-full w-1/3 bg-violet-600 rounded-full"
        animate={{
          x: ['-100%', '400%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}

// ============================================================================
// Loading Skeleton Presets
// ============================================================================

export function ContentLoading({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
}

export function CardLoading({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
        </div>
      </div>
      <ContentLoading lines={3} />
    </div>
  );
}

export function TableLoading({ rows = 5, cols = 4, className = '' }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}>
      <div className="bg-gray-50 dark:bg-gray-800 p-4 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4 flex gap-4">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div key={colIndex} className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Fancy Loading Animations
// ============================================================================

export function RocketLoading({ message = 'Launching...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <motion.div
        animate={{
          y: [0, -10, 0],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
      >
        <Rocket className="w-12 h-12 text-violet-600" />
      </motion.div>
      <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );
}

export function SparkleLoading({ message = 'Working magic...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
      >
        <Sparkles className="w-12 h-12 text-yellow-500" />
      </motion.div>
      <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );
}

export function ZapLoading({ message = 'Processing...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <motion.div
        animate={{
          opacity: [1, 0.5, 1],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
        }}
      >
        <Zap className="w-12 h-12 text-yellow-500 fill-yellow-500" />
      </motion.div>
      <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );
}
