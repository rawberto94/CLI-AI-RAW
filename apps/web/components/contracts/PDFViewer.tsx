'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2,
  Minimize2,
  FileText,
  Loader2,
  AlertCircle,
  RefreshCw,
  PanelLeftClose,
  PanelRightClose,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface PDFViewerProps {
  /** URL to the PDF file */
  url: string;
  /** Contract ID for fetching */
  contractId?: string;
  /** Filename for display */
  filename?: string;
  /** Initial page number */
  initialPage?: number;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Height of the viewer */
  height?: string;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Callback to toggle viewer visibility */
  onToggle?: () => void;
  /** Whether the viewer is expanded */
  isExpanded?: boolean;
}

// ============================================================================
// PDF Viewer Component
// ============================================================================

export function PDFViewer({
  url,
  contractId,
  filename = 'Document',
  initialPage = 1,
  onPageChange,
  compact = false,
  height = '100%',
  showToolbar = true,
  onToggle,
  isExpanded = true,
}: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build the PDF URL
  const pdfUrl = contractId
    ? `/api/contracts/${contractId}/file`
    : url;

  // Handle PDF load
  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  // Handle PDF error
  const handleError = useCallback(() => {
    setLoading(false);
    setError('Failed to load PDF. The file may be unavailable or in an unsupported format.');
  }, []);

  // Navigate pages
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
    onPageChange?.(validPage);
  }, [totalPages, onPageChange]);

  // Zoom controls
  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.max(25, Math.min(300, prev + delta)));
  }, []);

  // Rotation
  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Download handler
  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    link.click();
  }, [pdfUrl, filename]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          goToPage(currentPage - 1);
          break;
        case 'ArrowRight':
          goToPage(currentPage + 1);
          break;
        case '+':
        case '=':
          handleZoom(10);
          break;
        case '-':
          handleZoom(-10);
          break;
        case 'r':
          handleRotate();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, goToPage, handleZoom, handleRotate]);

  // Retry loading
  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    // Force iframe reload
    if (iframeRef.current) {
      iframeRef.current.src = pdfUrl + '?t=' + Date.now();
    }
  }, [pdfUrl]);

  if (!isExpanded) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 border rounded-lg p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="flex items-center gap-2"
        >
          <PanelRightClose className="h-4 w-4" />
          <span>Show PDF</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col bg-slate-100 rounded-lg overflow-hidden border border-slate-200',
        isFullscreen && 'fixed inset-0 z-50 rounded-none'
      )}
      style={{ height }}
    >
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
          {/* Left: File info & toggle */}
          <div className="flex items-center gap-2">
            {onToggle && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={onToggle}
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Hide PDF</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]">
              {filename}
            </span>
          </div>

          {/* Center: Navigation */}
          {!compact && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-600 min-w-[80px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Right: Controls */}
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleZoom(-10)}
                    disabled={zoom <= 25}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className="text-xs text-slate-500 min-w-[40px] text-center">
              {zoom}%
            </span>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleZoom(10)}
                    disabled={zoom >= 300}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {!compact && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleRotate}
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Rotate</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleDownload}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={toggleFullscreen}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="h-4 w-4" />
                        ) : (
                          <Maximize2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </div>
      )}

      {/* PDF Content */}
      <div className="flex-1 relative overflow-auto bg-slate-200">
        {/* Loading state */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-3" />
            <p className="text-sm text-slate-600">Loading document...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10">
            <div className="text-center p-6">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-sm text-slate-600 mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={retry} size="sm" variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button onClick={handleDownload} size="sm" variant="default">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* PDF embed using object tag with fallback */}
        <object
          data={pdfUrl}
          type="application/pdf"
          className="w-full h-full"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'top left',
            minHeight: '100%',
          }}
          onLoad={handleLoad}
          onError={handleError}
        >
          {/* Fallback for browsers that can't display PDF inline */}
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <FileText className="h-16 w-16 text-slate-400 mb-4" />
            <p className="text-slate-600 mb-4">
              Your browser cannot display this PDF inline.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleDownload} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
              >
                Open in New Tab
              </Button>
            </div>
          </div>
        </object>
      </div>

      {/* Bottom zoom slider for compact mode */}
      {compact && (
        <div className="px-4 py-2 bg-white border-t border-slate-200">
          <Slider
            value={[zoom]}
            onValueChange={([value]) => setZoom(value ?? zoom)}
            min={25}
            max={200}
            step={5}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Split View Container
// ============================================================================

interface SplitViewProps {
  /** PDF URL or contract ID */
  pdfUrl?: string;
  contractId?: string;
  filename?: string;
  /** Content to show on the right side */
  children: React.ReactNode;
  /** Initial split ratio (0-100, where 50 means 50/50) */
  initialSplit?: number;
  /** Minimum panel width in pixels */
  minPanelWidth?: number;
  /** Whether the split view is enabled by default */
  defaultEnabled?: boolean;
}

export function SplitViewContainer({
  pdfUrl,
  contractId,
  filename,
  children,
  initialSplit = 50,
  minPanelWidth = 300,
  defaultEnabled = false,
}: SplitViewProps) {
  const [showPdf, setShowPdf] = useState(defaultEnabled);
  const [splitRatio, setSplitRatio] = useState(initialSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle drag resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = (x / rect.width) * 100;
      
      // Clamp between min panel widths
      const minPercent = (minPanelWidth / rect.width) * 100;
      const maxPercent = 100 - minPercent;
      
      setSplitRatio(Math.max(minPercent, Math.min(maxPercent, percentage)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minPanelWidth]);

  // Check if we have a PDF to show
  const hasPdf = !!(pdfUrl || contractId);

  if (!hasPdf) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full',
        isDragging && 'select-none cursor-col-resize'
      )}
    >
      {/* PDF Panel */}
      {showPdf && (
        <>
          <div
            className="h-full overflow-hidden"
            style={{ width: `${splitRatio}%` }}
          >
            <PDFViewer
              url={pdfUrl || ''}
              contractId={contractId}
              filename={filename}
              height="100%"
              onToggle={() => setShowPdf(false)}
              isExpanded={showPdf}
            />
          </div>

          {/* Resize handle */}
          <div
            className={cn(
              'w-1.5 bg-slate-200 hover:bg-violet-400 cursor-col-resize transition-colors flex-shrink-0',
              isDragging && 'bg-violet-500'
            )}
            onMouseDown={handleMouseDown}
          >
            <div className="h-full w-full flex items-center justify-center">
              <div className="w-0.5 h-8 bg-slate-400 rounded-full" />
            </div>
          </div>
        </>
      )}

      {/* Content Panel */}
      <div
        className="h-full overflow-auto flex-1"
        style={{ width: showPdf ? `${100 - splitRatio}%` : '100%' }}
      >
        {!showPdf && hasPdf && (
          <div className="mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPdf(true)}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Show Original PDF
            </Button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export default PDFViewer;
