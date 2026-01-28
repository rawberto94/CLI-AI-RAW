/**
 * Pagination Component
 * Provides pagination controls for large data sets
 * Requirements: 4.3
 */

'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showPageInfo?: boolean;
  maxVisiblePages?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  showPageInfo = true,
  maxVisiblePages = 7,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getVisiblePages = (): number[] => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const halfVisible = Math.floor(maxVisiblePages / 2);
    let startPage = Math.max(1, currentPage - halfVisible);
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();
  const firstVisiblePage = visiblePages[0];
  const lastVisiblePage = visiblePages[visiblePages.length - 1];
  const showFirstPage = (firstVisiblePage ?? 1) > 1;
  const showLastPage = (lastVisiblePage ?? totalPages) < totalPages;

  return (
    <div className="flex items-center justify-between px-2 py-4">
      {/* Page info */}
      {showPageInfo && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Showing <span className="font-medium text-slate-700 dark:text-slate-300">{startItem}</span> to <span className="font-medium text-slate-700 dark:text-slate-300">{endItem}</span> of <span className="font-medium text-slate-700 dark:text-slate-300">{totalItems}</span> results
        </div>
      )}

      {/* Pagination controls */}
      <div className="flex items-center space-x-2">
        {/* First page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* First page number */}
        {showFirstPage && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
            >
              1
            </Button>
            {(firstVisiblePage ?? 0) > 2 && (
              <span className="px-2 text-muted-foreground">...</span>
            )}
          </>
        )}

        {/* Page numbers */}
        {visiblePages.map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </Button>
        ))}

        {/* Last page number */}
        {showLastPage && (
          <>
            {(lastVisiblePage ?? totalPages) < totalPages - 1 && (
              <span className="px-2 text-muted-foreground">...</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}

        {/* Next page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Page size selector */}
      {showPageSizeSelector && onPageSizeChange && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-400 transition-all"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/**
 * Simple pagination component
 */
export function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-center space-x-2 py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </Button>
      <span className="text-sm text-slate-600 dark:text-slate-400">
        Page <span className="font-semibold text-violet-600 dark:text-violet-400">{currentPage}</span> of <span className="font-semibold text-slate-700 dark:text-slate-300">{totalPages}</span>
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
    </div>
  );
}
