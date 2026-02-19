/**
 * Contract Empty States Component
 * 
 * Reusable empty state components for various scenarios on the contracts page.
 */

'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  Filter,
  Upload,
  Plus,
  AlertCircle,
  RefreshCw,
  Loader2,
  Tag,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface EmptyStateProps {
  className?: string;
}

export interface NoContractsProps extends EmptyStateProps {
  onUpload?: () => void;
  additionalActions?: React.ReactNode;
}

export interface NoResultsProps extends EmptyStateProps {
  searchTerm?: string;
  hasFilters?: boolean;
  onClearSearch?: () => void;
  onClearFilters?: () => void;
}

export interface ErrorStateProps extends EmptyStateProps {
  error?: string;
  onRetry?: () => void;
}

export interface LoadingStateProps extends EmptyStateProps {
  message?: string;
}

export interface UncategorizedBannerProps extends EmptyStateProps {
  count: number;
  onCategorize?: () => void;
  onDismiss?: () => void;
}

// ============================================================================
// Animation Variants
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// ============================================================================
// Components
// ============================================================================

/**
 * No Contracts Empty State
 * Shown when user has no contracts at all
 */
export const NoContracts = memo(function NoContracts({
  onUpload,
  additionalActions,
  className,
}: NoContractsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col items-center justify-center py-20 px-4 text-center',
        className
      )}
    >
      {/* Animated illustration */}
      <motion.div
        variants={itemVariants}
        className="relative mb-8"
      >
        {/* Animated rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-32 h-32 rounded-full border-2 border-slate-200"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-24 h-24 rounded-full border-2 border-slate-300"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
        </div>
        
        {/* Main icon */}
        <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/25">
          <FileText className="h-12 w-12 text-white" />
          <motion.div
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center shadow-lg"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="h-3 w-3 text-white" />
          </motion.div>
        </div>
      </motion.div>
      
      <motion.h3
        variants={itemVariants}
        className="text-2xl font-bold text-slate-900 mb-3"
      >
        Start Your Contract Journey
      </motion.h3>
      
      <motion.p
        variants={itemVariants}
        className="text-slate-600 max-w-lg mb-8 text-base leading-relaxed"
      >
        Upload your first contract and let our AI automatically extract key terms, 
        identify risks, and organize everything for you. It&apos;s like having a 
        legal assistant that never sleeps.
      </motion.p>
      
      <motion.div
        variants={itemVariants}
        className="flex flex-wrap justify-center gap-4"
      >
        <Link href="/contracts/upload">
          <Button 
            onClick={onUpload} 
            size="lg"
            className="h-12 px-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25 text-base font-semibold gap-3"
          >
            <Upload className="h-5 w-5" />
            Upload Contract
          </Button>
        </Link>
        <Link href="/contracts/generate">
          <Button 
            variant="outline" 
            size="lg"
            className="h-12 px-8 border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-base font-semibold gap-3"
          >
            <Sparkles className="h-5 w-5 text-violet-600" />
            Generate with AI
          </Button>
        </Link>
        {additionalActions}
      </motion.div>
      
      {/* Feature hints */}
      <motion.div
        variants={itemVariants}
        className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl"
      >
        {[
          { icon: '⚡', label: 'Instant OCR', desc: 'PDF to text in seconds' },
          { icon: '🔍', label: 'AI Analysis', desc: 'Extract key terms automatically' },
          { icon: '🛡️', label: 'Risk Detection', desc: 'Identify potential issues' },
        ].map((feature, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
            <span className="text-2xl">{feature.icon}</span>
            <div className="text-left">
              <p className="font-medium text-slate-900 text-sm">{feature.label}</p>
              <p className="text-xs text-slate-500">{feature.desc}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
});

/**
 * No Results Empty State
 * Shown when search/filters return no results
 */
export const NoResults = memo(function NoResults({
  searchTerm,
  hasFilters,
  onClearSearch,
  onClearFilters,
  className,
}: NoResultsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      <motion.div
        variants={itemVariants}
        className="relative mb-6"
      >
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 blur-xl" />
        </div>
        
        {/* Icon container */}
        <div className="relative w-[4.5rem] h-[4.5rem] rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-5 shadow-inner">
          {searchTerm ? (
            <Search className="h-8 w-8 text-slate-400" />
          ) : (
            <Filter className="h-8 w-8 text-slate-400" />
          )}
        </div>
      </motion.div>
      
      <motion.h3
        variants={itemVariants}
        className="text-xl font-bold text-slate-800 mb-2"
      >
        No matches found
      </motion.h3>
      
      <motion.p
        variants={itemVariants}
        className="text-slate-500 max-w-md mb-6 leading-relaxed"
      >
        {searchTerm ? (
          <>
            We couldn&apos;t find any contracts matching &ldquo;<span className="font-semibold text-slate-700">{searchTerm}</span>&rdquo;.
            Try different keywords or check your spelling.
          </>
        ) : hasFilters ? (
          <>
            Your current filter combination returned no results.
            Try broadening your criteria or clear filters to see all contracts.
          </>
        ) : (
          <>
            No contracts match your current criteria.
            Try adjusting your search or filters.
          </>
        )}
      </motion.p>
      
      <motion.div
        variants={itemVariants}
        className="flex flex-wrap justify-center gap-3"
      >
        {searchTerm && onClearSearch && (
          <Button 
            variant="outline" 
            onClick={onClearSearch}
            className="gap-2 border-2 hover:border-slate-300 hover:bg-slate-50"
          >
            <Search className="h-4 w-4" />
            Clear search
          </Button>
        )}
        {hasFilters && onClearFilters && (
          <Button 
            variant="outline" 
            onClick={onClearFilters}
            className="gap-2 border-2 hover:border-slate-300 hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            Clear all filters
          </Button>
        )}
      </motion.div>
      
      {/* Suggestions */}
      <motion.div
        variants={itemVariants}
        className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-100 max-w-md"
      >
        <p className="text-sm font-medium text-slate-700 mb-2">💡 Search tips:</p>
        <ul className="text-sm text-slate-500 space-y-1 text-left">
          <li>• Try searching for contract type (e.g., &quot;NDA&quot;, &quot;MSA&quot;)</li>
          <li>• Search by party name or company</li>
          <li>• Use broader terms if specific ones don&apos;t work</li>
        </ul>
      </motion.div>
    </motion.div>
  );
});

/**
 * Error State
 * Shown when there's an error loading contracts
 */
export const ErrorState = memo(function ErrorState({
  error,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      <motion.div
        variants={itemVariants}
        className="relative mb-6"
      >
        {/* Animated error glow */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-24 h-24 rounded-full bg-red-100 blur-xl" />
        </motion.div>
        
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-xl shadow-red-500/25">
          <AlertCircle className="h-10 w-10 text-white" />
        </div>
      </motion.div>
      
      <motion.h3
        variants={itemVariants}
        className="text-xl font-bold text-slate-800 mb-2"
      >
        Oops! Something went wrong
      </motion.h3>
      
      <motion.p
        variants={itemVariants}
        className="text-slate-500 max-w-md mb-6 leading-relaxed"
      >
        {error || 'We couldn\'t load your contracts. This might be a temporary issue. Please try again.'}
      </motion.p>
      
      {onRetry && (
        <motion.div variants={itemVariants}>
          <Button 
            onClick={onRetry} 
            className="gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </motion.div>
      )}
      
      {/* Help section */}
      <motion.div
        variants={itemVariants}
        className="mt-8 text-xs text-slate-400"
      >
        If this problem persists, please contact support.
      </motion.div>
    </motion.div>
  );
});

/**
 * Loading State
 * Shown while contracts are loading
 */
export const LoadingState = memo(function LoadingState({
  message = 'Loading contracts...',
  className,
}: LoadingStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'flex flex-col items-center justify-center py-20 px-4',
        className
      )}
    >
      {/* Premium loading animation */}
      <div className="relative mb-6">
        {/* Outer rotating ring */}
        <motion.div
          className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-blue-500 border-r-violet-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Inner pulsing dot */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30" />
        </motion.div>
        
        {/* Sparkle effect */}
        <motion.div
          className="absolute -top-1 -right-1 w-4 h-4"
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
        </motion.div>
      </div>
      
      <motion.p 
        className="text-slate-600 font-medium"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {message}
      </motion.p>
      
      <p className="mt-2 text-sm text-slate-400">
        This usually takes a few seconds
      </p>
    </motion.div>
  );
});

/**
 * Skeleton Loading
 * Placeholder while contracts are loading
 */
export const ContractsSkeleton = memo(function ContractsSkeleton({
  className,
  count = 5,
}: EmptyStateProps & { count?: number }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-4 p-4 border border-slate-100 rounded-xl bg-white"
        >
          <div className="h-5 w-5 rounded bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg w-1/3 animate-pulse" />
            <div className="h-3 bg-gradient-to-r from-slate-100 to-slate-50 rounded-lg w-1/4 animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-gradient-to-r from-slate-200 to-slate-100 rounded-full animate-pulse" />
          <div className="h-4 w-20 bg-gradient-to-r from-slate-100 to-slate-50 rounded-lg animate-pulse" />
        </motion.div>
      ))}
    </div>
  );
});

/**
 * Uncategorized Banner
 * Alert banner for contracts without categories
 */
export const UncategorizedBanner = memo(function UncategorizedBanner({
  count,
  onCategorize,
  onDismiss,
  className,
}: UncategorizedBannerProps) {
  if (count === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'relative flex items-center justify-between gap-4 p-4 rounded-lg',
        'bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10',
        'border border-amber-500/20',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-amber-500/20">
          <Tag className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="font-medium text-sm">
            {count} {count === 1 ? 'contract needs' : 'contracts need'} categorization
          </p>
          <p className="text-xs text-muted-foreground">
            Let AI automatically categorize your contracts for better organization
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onCategorize && (
          <Button size="sm" variant="default" onClick={onCategorize} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Auto-categorize
          </Button>
        )}
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </motion.div>
  );
});

/**
 * Category Empty State
 * Shown when no categories exist yet
 */
export const NoCategoriesState = memo(function NoCategoriesState({
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col items-center justify-center py-8 px-4 text-center',
        className
      )}
    >
      <motion.div
        variants={itemVariants}
        className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3"
      >
        <Tag className="h-6 w-6 text-muted-foreground" />
      </motion.div>
      
      <motion.h4
        variants={itemVariants}
        className="text-sm font-medium mb-1"
      >
        No categories defined
      </motion.h4>
      
      <motion.p
        variants={itemVariants}
        className="text-xs text-muted-foreground max-w-xs mb-3"
      >
        Create taxonomy categories to organize your contracts
      </motion.p>
      
      <motion.div variants={itemVariants}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings/taxonomy" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Set up categories
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  );
});

// ============================================================================
// Exports
// ============================================================================

export {
  NoContracts as ContractsEmptyState,
  NoResults as ContractsNoResults,
  ErrorState as ContractsErrorState,
  LoadingState as ContractsLoadingState,
};
