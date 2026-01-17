'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface PDFCanvasViewerProps {
  contractId: string;
  filename?: string;
  height?: string;
  onToggle?: () => void;
  isExpanded?: boolean;
}

// ============================================================================
// PDF Canvas Viewer Component
// ============================================================================

export function PDFCanvasViewer({
  contractId,
  filename = 'Document',
  height = '100%',
  onToggle,
  isExpanded = true,
}: PDFCanvasViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pdfUrl = `/api/contracts/${contractId}/file`;

  // Load PDF.js and the document
  useEffect(() => {
    let mounted = true;
    
    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);
        
        // Dynamically import PDF.js (legacy build avoids top-level-await warnings in some Next builds)
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
        
        // Use local worker file from public folder
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
        
        // Load the PDF
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          // Use type assertion for options that may not be in all pdfjs-dist versions
        } as Parameters<typeof pdfjsLib.getDocument>[0]);
        const pdf = await loadingTask.promise;
        
        if (mounted) {
          setPdfDoc(pdf);
          setTotalPages(pdf.numPages);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setError('Failed to load PDF. Please try again.');
          setLoading(false);
        }
      }
    }
    
    if (contractId) {
      loadPdf();
    }
    
    return () => {
      mounted = false;
    };
  }, [contractId, pdfUrl]);

  // Render the current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    
    let mounted = true;
    
    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas || !mounted) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;

        // Calculate scale based on container width
        const containerWidth = containerRef.current?.clientWidth || 800;
        const viewport = page.getViewport({ scale: 1, rotation });
        const scale = (containerWidth - 40) / viewport.width * zoom;
        const scaledViewport = page.getViewport({ scale, rotation });

        // Set canvas dimensions
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        // Render the page
        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport,
        };

        await page.render(renderContext).promise;
      } catch {
        // Error rendering page - fail silently
      }
    }
    
    renderPage();
    
    return () => {
      mounted = false;
    };
  }, [pdfDoc, currentPage, zoom, rotation]);

  // Navigation handlers
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleDownload = useCallback(() => {
    window.open(pdfUrl, '_blank');
  }, [pdfUrl]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    // Re-trigger load by updating a dependency
    const loadPdf = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl + '?t=' + Date.now(),
        } as Parameters<typeof pdfjsLib.getDocument>[0]);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setLoading(false);
      } catch {
        setError('Failed to load PDF. Please try again.');
        setLoading(false);
      }
    };
    loadPdf();
  }, [pdfUrl]);

  if (!isExpanded) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col bg-slate-100 overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50'
      )}
      style={{ height }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200 flex-shrink-0">
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-600 min-w-[80px] text-center">
            Page {currentPage} of {totalPages || '?'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleZoom(-0.2)}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="text-xs text-slate-500 min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleZoom(0.2)}
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In</TooltipContent>
            </Tooltip>
          </TooltipProvider>

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
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 overflow-auto bg-slate-200 flex items-start justify-center p-4">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm text-slate-600">Loading document...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <div className="flex gap-2">
              <Button onClick={retry} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button onClick={handleDownload} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        )}

        {/* PDF Canvas */}
        {!loading && !error && (
          <canvas
            ref={canvasRef}
            className="shadow-lg bg-white"
            style={{ maxWidth: '100%' }}
          />
        )}
      </div>
    </div>
  );
}

export default PDFCanvasViewer;
