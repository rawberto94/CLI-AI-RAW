"use client";

/**
 * LoadMoreButton Component
 * 
 * Standardized load more/pagination buttons with loading states.
 */

import React from "react";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";

// ============================================================================
// Types
// ============================================================================

export interface LoadMoreButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Whether more items are loading */
  isLoading?: boolean;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Total count of items (optional, for display) */
  totalCount?: number;
  /** Current loaded count (optional, for display) */
  loadedCount?: number;
  /** Click handler */
  onLoadMore: () => void;
  /** Loading text */
  loadingText?: string;
  /** Default text */
  text?: string;
  /** No more items text */
  endText?: string;
  /** Show count info */
  showCount?: boolean;
}

// ============================================================================
// LoadMoreButton Component
// ============================================================================

export function LoadMoreButton({
  isLoading = false,
  hasMore = true,
  totalCount,
  loadedCount,
  onLoadMore,
  loadingText = "Loading...",
  text = "Load more",
  endText = "No more items",
  showCount = true,
  className,
  variant = "outline",
  ...props
}: LoadMoreButtonProps) {
  if (!hasMore) {
    return (
      <div className={cn("flex justify-center py-4", className)}>
        <p className="text-sm text-muted-foreground">{endText}</p>
      </div>
    );
  }

  const showCountInfo = showCount && totalCount !== undefined && loadedCount !== undefined;

  return (
    <div className={cn("flex flex-col items-center gap-2 py-4", className)}>
      <Button
        variant={variant}
        onClick={onLoadMore}
        disabled={isLoading}
        className="min-w-32"
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingText}
          </>
        ) : (
          <>
            <ChevronDown className="mr-2 h-4 w-4" />
            {text}
          </>
        )}
      </Button>
      
      {showCountInfo && (
        <p className="text-xs text-muted-foreground">
          Showing {loadedCount} of {totalCount}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// RefreshButton Component
// ============================================================================

export interface RefreshButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Whether refreshing */
  isRefreshing?: boolean;
  /** Click handler */
  onRefresh: () => void;
  /** Loading text */
  loadingText?: string;
  /** Default text */
  text?: string;
}

export function RefreshButton({
  isRefreshing = false,
  onRefresh,
  loadingText = "Refreshing...",
  text = "Refresh",
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: RefreshButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onRefresh}
      disabled={isRefreshing}
      className={className}
      {...props}
    >
      <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
      <span className="ml-2">{isRefreshing ? loadingText : text}</span>
    </Button>
  );
}

// ============================================================================
// PaginationInfo Component
// ============================================================================

export interface PaginationInfoProps {
  /** Current page */
  page: number;
  /** Page size */
  pageSize: number;
  /** Total items */
  total: number;
  /** Additional className */
  className?: string;
}

export function PaginationInfo({
  page,
  pageSize,
  total,
  className,
}: PaginationInfoProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      Showing <span className="font-medium">{start}</span> to{" "}
      <span className="font-medium">{end}</span> of{" "}
      <span className="font-medium">{total}</span> results
    </p>
  );
}

// ============================================================================
// InfiniteScrollTrigger Component
// ============================================================================

export interface InfiniteScrollTriggerProps {
  /** Whether loading */
  isLoading?: boolean;
  /** Whether has more */
  hasMore?: boolean;
  /** Load more callback */
  onLoadMore: () => void;
  /** Threshold in pixels before end */
  threshold?: number;
  /** Additional className */
  className?: string;
}

export function InfiniteScrollTrigger({
  isLoading = false,
  hasMore = true,
  onLoadMore,
  threshold = 200,
  className,
}: InfiniteScrollTriggerProps) {
  const triggerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    if (triggerRef.current) {
      observer.observe(triggerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore, threshold]);

  if (!hasMore) return null;

  return (
    <div ref={triggerRef} className={cn("flex justify-center py-4", className)}>
      {isLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default LoadMoreButton;
