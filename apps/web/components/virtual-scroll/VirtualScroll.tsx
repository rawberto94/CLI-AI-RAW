'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronUp } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  loadingIndicator?: React.ReactNode;
  scrollToTop?: boolean;
}

interface InfiniteScrollProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading?: boolean;
  threshold?: number;
  className?: string;
  emptyState?: React.ReactNode;
  endMessage?: React.ReactNode;
}

// ============================================================================
// Virtual Scroll Component
// ============================================================================

export function VirtualScroll<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 3,
  className = '',
  onEndReached,
  endReachedThreshold = 100,
  isLoading = false,
  emptyState,
  loadingIndicator,
  scrollToTop = true,
}: VirtualScrollProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Calculate visible range
  const totalHeight = items.length * itemHeight;
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2;
    const endIndex = Math.min(items.length, startIndex + visibleCount);

    return items.slice(startIndex, endIndex).map((item, i) => ({
      item,
      index: startIndex + i,
      offset: (startIndex + i) * itemHeight,
    }));
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
    setShowScrollTop(target.scrollTop > 300);

    // Check for end reached
    if (onEndReached) {
      const distanceFromBottom = totalHeight - (target.scrollTop + target.clientHeight);
      if (distanceFromBottom < endReachedThreshold) {
        onEndReached();
      }
    }
  }, [onEndReached, endReachedThreshold, totalHeight]);

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    setContainerHeight(container.clientHeight);

    return () => resizeObserver.disconnect();
  }, []);

  const scrollToTopHandler = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (items.length === 0 && !isLoading) {
    return <>{emptyState}</>;
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-auto relative ${className}`}
    >
      {/* Spacer for total height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Rendered items */}
        {visibleItems.map(({ item, index, offset }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: offset,
              left: 0,
              right: 0,
              height: itemHeight,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          {loadingIndicator || (
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-lg">
              <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
              <span className="text-sm text-gray-600 dark:text-gray-300">Loading...</span>
            </div>
          )}
        </div>
      )}

      {/* Scroll to top button */}
      <AnimatePresence>
        {scrollToTop && showScrollTop && (
          <motion.button key="scroll-to-top"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTopHandler}
            className="fixed bottom-6 right-6 p-3 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg z-10"
          >
            <ChevronUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Infinite Scroll Component
// ============================================================================

export function InfiniteScroll<T>({
  items,
  renderItem,
  loadMore,
  hasMore,
  isLoading = false,
  threshold = 100,
  className = '',
  emptyState,
  endMessage,
}: InfiniteScrollProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const handleScroll = useCallback(async () => {
    const container = containerRef.current;
    if (!container || loadingRef.current || !hasMore || isLoading) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    if (distanceFromBottom < threshold) {
      loadingRef.current = true;
      try {
        await loadMore();
      } finally {
        loadingRef.current = false;
      }
    }
  }, [hasMore, isLoading, threshold, loadMore]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (items.length === 0 && !isLoading) {
    return <>{emptyState}</>;
  }

  return (
    <div ref={containerRef} className={`overflow-auto ${className}`}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index}>{renderItem(item, index)}</div>
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      )}

      {/* End message */}
      {!hasMore && !isLoading && items.length > 0 && endMessage && (
        <div className="py-4 text-center text-sm text-gray-500">
          {endMessage}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Lazy Load Image
// ============================================================================

interface LazyImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  width?: number;
  height?: number;
  onLoad?: () => void;
  onError?: () => void;
}

export function LazyImage({
  src,
  alt,
  placeholder,
  className = '',
  width,
  height,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = imgRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {/* Placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      )}

      {/* Placeholder image */}
      {placeholder && !isLoaded && (
        <img
          src={placeholder}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm"
        />
      )}

      {/* Actual image */}
      {isInView && !hasError && (
        <motion.img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          className="w-full h-full object-cover"
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <span className="text-sm text-gray-500">Failed to load</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Lazy Load Component
// ============================================================================

interface LazyLoadProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  className?: string;
}

export function LazyLoad({
  children,
  placeholder,
  threshold = 0.1,
  rootMargin = '50px',
  className = '',
}: LazyLoadProps) {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {isInView ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      ) : (
        placeholder || <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-20 rounded" />
      )}
    </div>
  );
}

// ============================================================================
// Pull to Refresh
// ============================================================================

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  className?: string;
  refreshingContent?: React.ReactNode;
  pullingContent?: React.ReactNode;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  className = '',
  refreshingContent,
  pullingContent,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    startY.current = e.touches[0]?.clientY || 0;
    isPulling.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;

    const currentY = e.touches[0]?.clientY || 0;
    const distance = Math.max(0, (currentY - startY.current) * 0.5);
    setPullDistance(Math.min(distance, threshold * 1.5));
  };

  const handleTouchEnd = async () => {
    if (!isPulling.current) return;

    isPulling.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`overflow-auto ${className}`}
    >
      {/* Pull indicator */}
      <motion.div
        animate={{ 
          height: isRefreshing ? threshold : pullDistance,
          opacity: pullDistance > 20 || isRefreshing ? 1 : 0,
        }}
        className="flex items-center justify-center overflow-hidden"
      >
        {isRefreshing ? (
          refreshingContent || (
            <div className="flex items-center gap-2 text-violet-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Refreshing...</span>
            </div>
          )
        ) : (
          pullingContent || (
            <motion.div
              animate={{ rotate: pullDistance >= threshold ? 180 : 0 }}
              className="text-gray-400"
            >
              <ChevronUp className="w-5 h-5" />
            </motion.div>
          )
        )}
      </motion.div>

      {children}
    </div>
  );
}

// ============================================================================
// Paginated List
// ============================================================================

interface PaginatedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemsPerPage?: number;
  className?: string;
  showPageNumbers?: boolean;
}

export function PaginatedList<T>({
  items,
  renderItem,
  itemsPerPage = 10,
  className = '',
  showPageNumbers = true,
}: PaginatedListProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = items.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        <AnimatePresence mode="wait">
          {currentItems.map((item, index) => (
            <motion.div
              key={startIndex + index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: index * 0.05 }}
            >
              {renderItem(item, startIndex + index)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Previous
          </button>

          {showPageNumbers && (
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`w-8 h-8 text-sm rounded-lg ${
                      pageNum === currentPage
                        ? 'bg-violet-600 text-white'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
