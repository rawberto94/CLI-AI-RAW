'use client';

import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  Download,
  FileText,
  Loader2,
  X,
  Grid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

interface PageThumbnail {
  pageNumber: number;
  imageUrl?: string;
}

interface PDFThumbnailStripProps {
  contractId: string;
  totalPages?: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onToggleView: () => void;
  isExpanded?: boolean;
  className?: string;
}

export const PDFThumbnailStrip = memo(function PDFThumbnailStrip({
  contractId,
  totalPages = 1,
  currentPage,
  onPageChange,
  onToggleView,
  isExpanded = true,
  className = '',
}: PDFThumbnailStripProps) {
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  // Generate placeholder thumbnails
  useEffect(() => {
    const placeholders: PageThumbnail[] = Array.from({ length: totalPages }, (_, i) => ({
      pageNumber: i + 1,
    }));
    setThumbnails(placeholders);
    setLoading(false);
  }, [totalPages]);

  // Scroll current page into view
  useEffect(() => {
    if (stripRef.current && showThumbnails) {
      const thumbnailElement = stripRef.current.querySelector(`[data-page="${currentPage}"]`);
      if (thumbnailElement) {
        thumbnailElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentPage, showThumbnails]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  return (
    <TooltipProvider>
      <div className={cn("relative", className)}>
        {/* Thumbnail Strip Toggle */}
        <AnimatePresence>
          {showThumbnails && (
            <motion.div key="thumbnails"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2"
            >
              <div
                ref={stripRef}
                className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600"
              >
                {thumbnails.map((thumbnail) => {
                  const isActive = thumbnail.pageNumber === currentPage;

                  return (
                    <motion.button
                      key={thumbnail.pageNumber}
                      data-page={thumbnail.pageNumber}
                      onClick={() => onPageChange(thumbnail.pageNumber)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "relative flex-shrink-0 w-16 h-20 rounded-lg border-2 overflow-hidden transition-all",
                        isActive
                          ? "border-violet-500 ring-2 ring-violet-500/30"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                      )}
                    >
                      {/* Thumbnail Placeholder */}
                      <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                      </div>

                      {/* Page Number */}
                      <div className={cn(
                        "absolute bottom-0 inset-x-0 py-0.5 text-[10px] font-medium text-center",
                        isActive
                          ? "bg-violet-500 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                      )}>
                        {thumbnail.pageNumber}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowThumbnails(false)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full flex items-center justify-center shadow-lg"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Control Bar */}
        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 shadow-lg">
          {/* Left Controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous page</TooltipContent>
            </Tooltip>

            {/* Page Indicator */}
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {currentPage}
              </span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-sm text-slate-500">{totalPages}</span>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next page</TooltipContent>
            </Tooltip>
          </div>

          {/* Center Controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowThumbnails(!showThumbnails)}
                  className={cn(
                    "h-8 w-8 p-0 rounded-lg",
                    showThumbnails && "bg-violet-100 dark:bg-violet-900/50 text-violet-600"
                  )}
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Page thumbnails</TooltipContent>
            </Tooltip>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onToggleView}
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  {isExpanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isExpanded ? 'Collapse' : 'Expand'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="absolute -bottom-1 left-2 right-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
            animate={{ width: `${(currentPage / totalPages) * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
});

export default PDFThumbnailStrip;
