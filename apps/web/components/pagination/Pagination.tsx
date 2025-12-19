'use client';

/**
 * Pagination Component
 * Flexible pagination with multiple styles
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  showFirstLast?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'simple' | 'minimal';
  className?: string;
}

interface PaginationInfoProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  className?: string;
}

// ============================================================================
// Utilities
// ============================================================================

function generatePaginationRange(
  currentPage: number,
  totalPages: number,
  siblingCount: number
): (number | 'ellipsis')[] {
  const totalNumbers = siblingCount * 2 + 5; // siblings + first + last + current + 2 ellipsis

  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from(
      { length: siblingCount * 2 + 3 },
      (_, i) => i + 1
    );
    return [...leftRange, 'ellipsis', totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightRange = Array.from(
      { length: siblingCount * 2 + 3 },
      (_, i) => totalPages - (siblingCount * 2 + 2) + i
    );
    return [1, 'ellipsis', ...rightRange];
  }

  const middleRange = Array.from(
    { length: siblingCount * 2 + 1 },
    (_, i) => leftSiblingIndex + i
  );
  return [1, 'ellipsis', ...middleRange, 'ellipsis', totalPages];
}

const sizeClasses = {
  sm: 'h-8 min-w-[2rem] text-sm',
  md: 'h-10 min-w-[2.5rem] text-sm',
  lg: 'h-12 min-w-[3rem] text-base',
};

// ============================================================================
// Pagination Component
// ============================================================================

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showFirstLast = true,
  size = 'md',
  variant = 'default',
  className,
}: PaginationProps) {
  const pages = generatePaginationRange(currentPage, totalPages, siblingCount);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  if (totalPages <= 1) return null;

  // Simple variant (just prev/next with page number)
  if (variant === 'simple') {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <button
          onClick={() => canGoPrevious && onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
          className={cn(
            'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            canGoPrevious
              ? 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-300 cursor-not-allowed'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <span className="text-sm text-slate-600">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => canGoNext && onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className={cn(
            'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            canGoNext
              ? 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-300 cursor-not-allowed'
          )}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Minimal variant (just arrows)
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <button
          onClick={() => canGoPrevious && onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
          className={cn(
            'p-2 rounded-lg transition-colors',
            sizeClasses[size],
            canGoPrevious
              ? 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-300 cursor-not-allowed'
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-slate-600 min-w-[4rem] text-center">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => canGoNext && onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className={cn(
            'p-2 rounded-lg transition-colors',
            sizeClasses[size],
            canGoNext
              ? 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-300 cursor-not-allowed'
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Default variant
  return (
    <nav className={cn('flex items-center gap-1', className)} aria-label="Pagination">
      {/* First page */}
      {showFirstLast && (
        <button
          onClick={() => onPageChange(1)}
          disabled={!canGoPrevious}
          className={cn(
            'flex items-center justify-center rounded-lg transition-colors',
            sizeClasses[size],
            canGoPrevious
              ? 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-300 cursor-not-allowed'
          )}
          aria-label="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
      )}

      {/* Previous */}
      <button
        onClick={() => canGoPrevious && onPageChange(currentPage - 1)}
        disabled={!canGoPrevious}
        className={cn(
          'flex items-center justify-center rounded-lg transition-colors',
          sizeClasses[size],
          canGoPrevious
            ? 'text-slate-700 hover:bg-slate-100'
            : 'text-slate-300 cursor-not-allowed'
        )}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page numbers */}
      {pages.map((page, index) => {
        if (page === 'ellipsis') {
          return (
            <span
              key={`ellipsis-${index}`}
              className={cn(
                'flex items-center justify-center text-slate-400',
                sizeClasses[size]
              )}
            >
              …
            </span>
          );
        }

        const isActive = page === currentPage;

        return (
          <motion.button
            key={page}
            onClick={() => onPageChange(page)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'flex items-center justify-center rounded-lg font-medium transition-colors',
              sizeClasses[size],
              isActive
                ? 'bg-indigo-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            )}
            aria-label={`Page ${page}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {page}
          </motion.button>
        );
      })}

      {/* Next */}
      <button
        onClick={() => canGoNext && onPageChange(currentPage + 1)}
        disabled={!canGoNext}
        className={cn(
          'flex items-center justify-center rounded-lg transition-colors',
          sizeClasses[size],
          canGoNext
            ? 'text-slate-700 hover:bg-slate-100'
            : 'text-slate-300 cursor-not-allowed'
        )}
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Last page */}
      {showFirstLast && (
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={!canGoNext}
          className={cn(
            'flex items-center justify-center rounded-lg transition-colors',
            sizeClasses[size],
            canGoNext
              ? 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-300 cursor-not-allowed'
          )}
          aria-label="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      )}
    </nav>
  );
}

// ============================================================================
// Pagination Info
// ============================================================================

export function PaginationInfo({
  currentPage,
  pageSize,
  totalItems,
  className,
}: PaginationInfoProps) {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <p className={cn('text-sm text-slate-500', className)}>
      Showing <span className="font-medium text-slate-700">{start}</span> to{' '}
      <span className="font-medium text-slate-700">{end}</span> of{' '}
      <span className="font-medium text-slate-700">{totalItems.toLocaleString()}</span> results
    </p>
  );
}

// ============================================================================
// Load More Button
// ============================================================================

interface LoadMoreProps {
  onClick: () => void;
  isLoading?: boolean;
  hasMore: boolean;
  loadedCount: number;
  totalCount: number;
  className?: string;
}

export function LoadMore({
  onClick,
  isLoading = false,
  hasMore,
  loadedCount,
  totalCount,
  className,
}: LoadMoreProps) {
  if (!hasMore) return null;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <button
        onClick={onClick}
        disabled={isLoading}
        className={cn(
          'px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isLoading ? 'Loading...' : 'Load More'}
      </button>
      <p className="text-xs text-slate-400">
        Showing {loadedCount} of {totalCount.toLocaleString()}
      </p>
    </div>
  );
}
