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
  className,
}: NoContractsProps) {
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
        className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6"
      >
        <FileText className="h-10 w-10 text-primary" />
      </motion.div>
      
      <motion.h3
        variants={itemVariants}
        className="text-xl font-semibold mb-2"
      >
        No contracts yet
      </motion.h3>
      
      <motion.p
        variants={itemVariants}
        className="text-muted-foreground max-w-md mb-6"
      >
        Get started by uploading your first contract. Our AI will automatically extract
        key information and help you manage your agreements effectively.
      </motion.p>
      
      <motion.div
        variants={itemVariants}
        className="flex flex-wrap justify-center gap-3"
      >
        <Button onClick={onUpload} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Contract
        </Button>
        <Button variant="outline" asChild>
          <Link href="/contracts/new" className="gap-2">
            <Plus className="h-4 w-4" />
            Create Manually
          </Link>
        </Button>
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
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <motion.div
        variants={itemVariants}
        className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"
      >
        {searchTerm ? (
          <Search className="h-8 w-8 text-muted-foreground" />
        ) : (
          <Filter className="h-8 w-8 text-muted-foreground" />
        )}
      </motion.div>
      
      <motion.h3
        variants={itemVariants}
        className="text-lg font-semibold mb-2"
      >
        No contracts found
      </motion.h3>
      
      <motion.p
        variants={itemVariants}
        className="text-muted-foreground max-w-md mb-4"
      >
        {searchTerm ? (
          <>
            No contracts match "<span className="font-medium">{searchTerm}</span>".
            Try adjusting your search terms or filters.
          </>
        ) : hasFilters ? (
          <>
            No contracts match the current filters.
            Try removing some filters to see more results.
          </>
        ) : (
          <>
            No contracts match your criteria.
          </>
        )}
      </motion.p>
      
      <motion.div
        variants={itemVariants}
        className="flex flex-wrap justify-center gap-2"
      >
        {searchTerm && onClearSearch && (
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        )}
        {hasFilters && onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear all filters
          </Button>
        )}
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
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <motion.div
        variants={itemVariants}
        className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4"
      >
        <AlertCircle className="h-8 w-8 text-destructive" />
      </motion.div>
      
      <motion.h3
        variants={itemVariants}
        className="text-lg font-semibold mb-2"
      >
        Something went wrong
      </motion.h3>
      
      <motion.p
        variants={itemVariants}
        className="text-muted-foreground max-w-md mb-4"
      >
        {error || 'We couldn\'t load your contracts. Please try again.'}
      </motion.p>
      
      {onRetry && (
        <motion.div variants={itemVariants}>
          <Button onClick={onRetry} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </motion.div>
      )}
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
        'flex flex-col items-center justify-center py-16 px-4',
        className
      )}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-muted" />
        <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="mt-4 text-muted-foreground">{message}</p>
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
        <div
          key={i}
          className="flex items-center gap-4 p-4 border rounded-lg animate-pulse"
        >
          <div className="h-5 w-5 rounded bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
          <div className="h-6 w-16 bg-muted rounded-full" />
          <div className="h-4 w-20 bg-muted rounded" />
        </div>
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
