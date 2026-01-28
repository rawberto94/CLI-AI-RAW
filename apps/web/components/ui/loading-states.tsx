/**
 * Comprehensive Loading States Component
 * Provides various loading indicators for different use cases
 */

'use client';

import React from 'react';
import { Loader2, Brain, Activity, FileText, Database, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton } from './skeleton-loader';
import { ProgressBar } from './progress-bar';

// ============================================================================
// Loading Spinner Variants
// ============================================================================

export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ai' | 'processing' | 'data' | 'fast';
  label?: string;
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  variant = 'default',
  label,
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const getIcon = () => {
    switch (variant) {
      case 'ai':
        return <Brain className={`${sizeClasses[size]} text-violet-600 animate-pulse`} />;
      case 'processing':
        return <Activity className={`${sizeClasses[size]} text-green-600 animate-pulse`} />;
      case 'data':
        return <Database className={`${sizeClasses[size]} text-purple-600 animate-pulse`} />;
      case 'fast':
        return <Zap className={`${sizeClasses[size]} text-yellow-600 animate-pulse`} />;
      default:
        return <Loader2 className={`${sizeClasses[size]} text-violet-600 animate-spin`} />;
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {getIcon()}
      {label && <span className="text-sm text-gray-600">{label}</span>}
    </div>
  );
}

// ============================================================================
// Inline Loading (for buttons, small areas)
// ============================================================================

export interface InlineLoadingProps {
  text?: string;
  size?: 'xs' | 'sm' | 'md';
}

export function InlineLoading({ text = 'Loading...', size = 'sm' }: InlineLoadingProps) {
  return (
    <div className="flex items-center gap-2 text-gray-600">
      <LoadingSpinner size={size} />
      <span className="text-sm">{text}</span>
    </div>
  );
}

// ============================================================================
// Page Loading (full page loading state)
// ============================================================================

export interface PageLoadingProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'ai' | 'processing' | 'data';
  showProgress?: boolean;
  progress?: number;
}

export function PageLoading({ 
  title = 'Loading...', 
  description = 'Please wait while we load the content',
  variant = 'default',
  showProgress = false,
  progress = 0
}: PageLoadingProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md text-center"
      >
        <div className="mb-6 flex justify-center">
          <LoadingSpinner size="xl" variant={variant} />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
        
        {showProgress && (
          <ProgressBar 
            progress={progress} 
            size="md" 
            color="blue"
            showPercentage
          />
        )}
      </motion.div>
    </div>
  );
}

// ============================================================================
// Skeleton Screens (for data loading)
// ============================================================================

export function ContractListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton width="40%" height="1.5rem" />
            <Skeleton width="80px" height="1.5rem" />
          </div>
          <Skeleton width="60%" height="1rem" />
          <div className="flex gap-2">
            <Skeleton width="100px" height="1rem" />
            <Skeleton width="120px" height="1rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RateCardTableSkeleton() {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 p-4 bg-gray-50 rounded-t-lg">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="100%" height="1.5rem" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b">
          {Array.from({ length: 5 }).map((_, colIndex) => (
            <Skeleton key={colIndex} width="100%" height="1.25rem" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton width="300px" height="2rem" />
        <Skeleton width="500px" height="1rem" />
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <Skeleton width="60%" height="1rem" />
            <Skeleton width="80%" height="2rem" />
            <Skeleton width="40%" height="0.875rem" />
          </div>
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            <Skeleton width="200px" height="1.5rem" />
            <Skeleton width="100%" height="300px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton width="150px" height="1rem" />
          <Skeleton width="100%" height="2.5rem" />
        </div>
      ))}
      <div className="flex gap-3 justify-end">
        <Skeleton width="100px" height="2.5rem" />
        <Skeleton width="100px" height="2.5rem" />
      </div>
    </div>
  );
}

// ============================================================================
// Progress Indicators (for long operations)
// ============================================================================

export interface OperationProgressProps {
  operation: string;
  progress: number;
  currentStep?: string;
  totalSteps?: number;
  currentStepNumber?: number;
  estimatedTime?: number;
}

export function OperationProgress({
  operation,
  progress,
  currentStep,
  totalSteps,
  currentStepNumber,
  estimatedTime
}: OperationProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border rounded-lg p-6 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-4">
        <LoadingSpinner size="md" variant="processing" />
        <div>
          <h4 className="font-semibold text-gray-900">{operation}</h4>
          {currentStep && (
            <p className="text-sm text-gray-600">{currentStep}</p>
          )}
        </div>
      </div>
      
      <ProgressBar
        progress={progress}
        size="lg"
        color="blue"
        showPercentage
        estimatedTime={estimatedTime}
      />
      
      {totalSteps && currentStepNumber && (
        <p className="text-xs text-gray-500 mt-2">
          Step {currentStepNumber} of {totalSteps}
        </p>
      )}
    </motion.div>
  );
}

// ============================================================================
// Button Loading State
// ============================================================================

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function LoadingButton({ 
  loading = false, 
  loadingText,
  children,
  disabled,
  className = '',
  ...props 
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`
        relative inline-flex items-center justify-center gap-2
        px-4 py-2 rounded-lg font-medium
        transition-all duration-200
        ${loading || disabled 
          ? 'opacity-60 cursor-not-allowed' 
          : 'hover:opacity-90'
        }
        ${className}
      `}
    >
      {loading && (
        <LoadingSpinner size="sm" />
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}

// ============================================================================
// Overlay Loading (for modal/dialog operations)
// ============================================================================

export interface OverlayLoadingProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
}

export function OverlayLoading({ 
  message = 'Processing...', 
  progress,
  showProgress = false 
}: OverlayLoadingProps) {
  return (
    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center max-w-sm">
        <LoadingSpinner size="lg" variant="processing" className="mb-4 justify-center" />
        <p className="text-gray-900 font-medium mb-2">{message}</p>
        {showProgress && progress !== undefined && (
          <ProgressBar progress={progress} size="md" color="blue" showPercentage />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Card Loading State
// ============================================================================

export function CardLoading({ 
  title = 'Loading...', 
  height = '200px' 
}: { 
  title?: string; 
  height?: string;
}) {
  return (
    <div 
      className="border rounded-lg p-6 flex flex-col items-center justify-center"
      style={{ minHeight: height }}
    >
      <LoadingSpinner size="lg" className="mb-3" />
      <p className="text-sm text-gray-600">{title}</p>
    </div>
  );
}
