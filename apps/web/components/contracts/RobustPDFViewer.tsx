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
  PanelLeftOpen,
  ExternalLink,
  GripVertical,
  Minus,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

// ============================================================================
// Types
// ============================================================================

interface RobustPDFViewerProps {
  contractId: string;
  filename?: string;
  height?: string;
  onToggle?: () => void;
  isExpanded?: boolean;
}

type ViewerMode = 'loading' | 'canvas' | 'embed' | 'fallback' | 'error';

interface ThumbnailData {
  pageNum: number;
  dataUrl: string | null;
  loading: boolean;
}

// ============================================================================
// Robust PDF Viewer Component
// Bulletproof implementation with multiple fallback strategies
// ============================================================================

export function RobustPDFViewer({
  contractId,
  filename = 'Document',
  height = '100%',
  onToggle,
  isExpanded = true,
}: RobustPDFViewerProps) {
  const [mode, setMode] = useState<ViewerMode>('loading');
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Sidebar state
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const [thumbnails, setThumbnails] = useState<ThumbnailData[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const objectRef = useRef<HTMLObjectElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const pdfUrl = `/api/contracts/${contractId}/file`;

  // Minimum and maximum sidebar widths
  const MIN_SIDEBAR_WIDTH = 120;
  const MAX_SIDEBAR_WIDTH = 300;

  // Step 1: Fetch the PDF data first to ensure we have it
  useEffect(() => {
    let mounted = true;
    
    async function fetchPdfData() {
      try {
        setMode('loading');
        setError(null);
        
        const response = await fetch(pdfUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        
        if (!contentType?.includes('pdf') && !contentType?.includes('octet-stream')) {
          // Non-PDF content received - consume body and throw
          await response.text();
          throw new Error('Server returned non-PDF content');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        if (mounted) {
          setPdfData(arrayBuffer);
          // Try canvas rendering first
          tryCanvasRendering(arrayBuffer);
        }
      } catch {
        if (mounted) {
          // Try embed/object fallback
          setMode('embed');
        }
      }
    }
    
    async function tryCanvasRendering(data: ArrayBuffer) {
      try {
        
        // Dynamically import PDF.js (legacy build avoids top-level await warnings)
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
        
        // Set up the worker - use local worker file from public folder
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
        
        // Load the PDF from array buffer
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(data),
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
        });
        
        const pdf = await loadingTask.promise;
        
        if (mounted) {
          setPdfDoc(pdf);
          setTotalPages(pdf.numPages);
          // Initialize thumbnails array
          setThumbnails(
            Array.from({ length: pdf.numPages }, (_, i) => ({
              pageNum: i + 1,
              dataUrl: null,
              loading: false,
            }))
          );
          setMode('canvas');
        }
      } catch {
        if (mounted) {
          // Fall back to embed/object
          setMode('embed');
        }
      }
    }
    
    if (contractId) {
      fetchPdfData();
    }
    
    return () => {
      mounted = false;
    };
  }, [contractId, pdfUrl, retryCount]);

  // Step 2: Render the current page when pdfDoc is available
  useEffect(() => {
    if (mode !== 'canvas' || !pdfDoc || !canvasRef.current) return;
    
    let mounted = true;
    
    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas || !mounted) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        // Calculate scale based on zoom and container width
        const baseScale = 1.5;
        const scale = baseScale * zoom;
        
        const viewport = page.getViewport({ scale, rotation });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
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
  }, [mode, pdfDoc, currentPage, zoom, rotation]);

  // Step 3: Generate thumbnails lazily
  useEffect(() => {
    if (mode !== 'canvas' || !pdfDoc || !showSidebar) return;
    
    let mounted = true;
    
    async function generateThumbnails() {
      const THUMBNAIL_SCALE = 0.3;
      
      for (let i = 0; i < totalPages; i++) {
        if (!mounted) break;
        
        try {
          const page = await pdfDoc.getPage(i + 1);
          const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });
          
          // Create an offscreen canvas
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          const context = canvas.getContext('2d');
          if (!context) continue;
          
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          if (mounted) {
            setThumbnails(prev => 
              prev.map((t, idx) => 
                idx === i ? { ...t, dataUrl, loading: false } : t
              )
            );
          }
        } catch {
          // Error generating thumbnail - fail silently
        }
      }
    }
    
    generateThumbnails();
    
    return () => {
      mounted = false;
    };
  }, [mode, pdfDoc, totalPages, showSidebar]);

  // Handle embed/object load errors
  const handleEmbedError = () => {
    setMode('fallback');
  };

  // Navigation handlers
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.max(0.25, Math.min(4, prev + delta)));
  }, []);

  const handleZoomSlider = useCallback((value: number[]) => {
    setZoom(value[0] ?? 1);
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [pdfUrl, filename]);

  const handleOpenNewTab = useCallback(() => {
    window.open(pdfUrl, '_blank');
  }, [pdfUrl]);

  const toggleFullscreen = useCallback(() => {
    // Use CSS-based fullscreen for better compatibility (especially in VS Code browser)
    setIsFullscreen(prev => !prev);
  }, []);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const retry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setPdfDoc(null);
    setPdfData(null);
    setError(null);
    setThumbnails([]);
  }, []);

  // Sidebar resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth)));
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (!isExpanded) {
    return null;
  }

  // Create blob URL for embed fallback
  const blobUrl = pdfData ? URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' })) : pdfUrl;

  // Fullscreen overlay - renders as a portal-like fixed overlay
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col">
        {/* Fullscreen Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0">
          {/* Left: File info & navigation */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-400" />
              <span className="text-base font-medium text-slate-200">
                {filename}
              </span>
              <span className="text-sm text-slate-400 ml-2">
                (Full Screen View)
              </span>
            </div>
            
            {mode === 'canvas' && (
              <>
                <div className="h-6 w-px bg-slate-600" />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-300 hover:text-white hover:bg-slate-700"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-slate-300 min-w-[100px] text-center">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-300 hover:text-white hover:bg-slate-700"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Center: Zoom controls */}
          {mode === 'canvas' && (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-700"
                onClick={() => handleZoom(-0.25)}
                disabled={zoom <= 0.25}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              
              <div className="w-32 flex items-center">
                <Slider
                  value={[zoom]}
                  min={0.25}
                  max={4}
                  step={0.05}
                  onValueChange={handleZoomSlider}
                  className="w-full"
                />
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-700"
                onClick={() => handleZoom(0.25)}
                disabled={zoom >= 4}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              
              <span className="text-sm text-slate-400 min-w-[50px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-700"
                onClick={handleRotate}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={handleOpenNewTab}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Tab
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-slate-600 hover:bg-slate-500 text-white"
              onClick={toggleFullscreen}
            >
              <Minimize2 className="h-4 w-4 mr-2" />
              Exit Full Screen
            </Button>
          </div>
        </div>

        {/* Fullscreen Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Thumbnail Sidebar (optional in fullscreen) */}
          {mode === 'canvas' && showSidebar && (
            <>
              <div
                className="flex-shrink-0 bg-slate-800 overflow-y-auto overflow-x-hidden"
                style={{ width: sidebarWidth }}
              >
                <div className="p-2 space-y-2">
                  {thumbnails.map((thumb) => (
                    <button
                      key={thumb.pageNum}
                      onClick={() => goToPage(thumb.pageNum)}
                      className={cn(
                        'w-full p-1 rounded transition-all',
                        'hover:bg-slate-600',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500',
                        currentPage === thumb.pageNum && 'ring-2 ring-blue-500 bg-slate-700'
                      )}
                    >
                      <div className="relative bg-white rounded shadow-sm overflow-hidden">
                        {thumb.dataUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={thumb.dataUrl}
                            alt={`Page ${thumb.pageNum}`}
                            className="w-full h-auto"
                            draggable={false}
                          />
                        ) : (
                          <div 
                            className="w-full bg-slate-200 animate-pulse flex items-center justify-center"
                            style={{ aspectRatio: '8.5/11' }}
                          >
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-center">
                        <span className="text-xs text-slate-400">{thumb.pageNum}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-1 bg-slate-700" />
            </>
          )}

          {/* Main PDF View */}
          <div className="flex-1 overflow-auto bg-slate-700 flex items-center justify-center p-8">
            {mode === 'canvas' && (
              <canvas
                ref={canvasRef}
                className="shadow-2xl bg-white max-w-full"
              />
            )}
            {mode === 'embed' && (
              <object
                data={blobUrl}
                type="application/pdf"
                className="w-full h-full"
              />
            )}
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-800/90 px-3 py-1.5 rounded-full">
          <span className="text-xs text-slate-400">Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">Esc</kbd> to exit full screen</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-slate-100 overflow-hidden"
      style={{ height }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        {/* Left: Sidebar toggle & File info */}
        <div className="flex items-center gap-2">
          {mode === 'canvas' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
                    onClick={() => setShowSidebar(!showSidebar)}
                  >
                    {showSidebar ? (
                      <PanelLeftClose className="h-4 w-4" />
                    ) : (
                      <PanelLeftOpen className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showSidebar ? 'Hide Thumbnails' : 'Show Thumbnails'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-700/50">
            <FileText className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-200 truncate max-w-[150px]">
              {filename}
            </span>
          </div>
          
          {/* Page navigation */}
          {mode === 'canvas' && (
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-300 min-w-[80px] text-center">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Center: Zoom controls */}
        {mode === 'canvas' && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={() => handleZoom(-0.25)}
              disabled={zoom <= 0.25}
            >
              <Minus className="h-3 w-3" />
            </Button>
            
            <div className="w-24 flex items-center">
              <Slider
                value={[zoom]}
                min={0.25}
                max={4}
                step={0.05}
                onValueChange={handleZoomSlider}
                className="w-full"
              />
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={() => handleZoom(0.25)}
              disabled={zoom >= 4}
            >
              <Plus className="h-3 w-3" />
            </Button>
            
            <span className="text-xs text-slate-400 min-w-[45px] text-center">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        )}

        {/* Right: Tools */}
        <div className="flex items-center gap-1">
          {mode === 'canvas' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
                    onClick={handleRotate}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rotate</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
                  onClick={handleOpenNewTab}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in New Tab</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
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
                  className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700"
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

          {onToggle && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-700 ml-2"
                    onClick={onToggle}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Close PDF Viewer</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thumbnail Sidebar */}
        {mode === 'canvas' && showSidebar && (
          <>
            <div
              ref={sidebarRef}
              className="flex-shrink-0 bg-slate-800 overflow-y-auto overflow-x-hidden"
              style={{ width: sidebarWidth }}
            >
              <div className="p-2 space-y-2">
                {thumbnails.map((thumb) => (
                  <button
                    key={thumb.pageNum}
                    onClick={() => goToPage(thumb.pageNum)}
                    className={cn(
                      'w-full p-1 rounded transition-all',
                      'hover:bg-slate-600',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      currentPage === thumb.pageNum && 'ring-2 ring-blue-500 bg-slate-700'
                    )}
                  >
                    <div className="relative bg-white rounded shadow-sm overflow-hidden">
                      {thumb.dataUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={thumb.dataUrl}
                          alt={`Page ${thumb.pageNum}`}
                          className="w-full h-auto"
                          draggable={false}
                        />
                      ) : (
                        <div 
                          className="w-full bg-slate-200 animate-pulse flex items-center justify-center"
                          style={{ aspectRatio: '8.5/11' }}
                        >
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-center">
                      <span className="text-xs text-slate-400">{thumb.pageNum}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Resize Handle */}
            <div
              className={cn(
                'w-1 cursor-col-resize bg-slate-700 hover:bg-blue-500 transition-colors flex-shrink-0',
                'flex items-center justify-center',
                isResizing && 'bg-blue-500'
              )}
              onMouseDown={handleMouseDown}
            >
              <GripVertical className="h-4 w-4 text-slate-500" />
            </div>
          </>
        )}

        {/* PDF Content Area */}
        <div className="flex-1 overflow-auto bg-slate-600">
          {/* Loading state */}
          {mode === 'loading' && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-3" />
              <p className="text-sm text-slate-300">Loading document...</p>
            </div>
          )}

          {/* Canvas mode - PDF.js rendering */}
          {mode === 'canvas' && (
            <div className="flex items-start justify-center p-4 min-h-full">
              <canvas
                ref={canvasRef}
                className="shadow-xl bg-white"
                style={{ maxWidth: '100%' }}
              />
            </div>
          )}

          {/* Embed mode - Native browser PDF viewer */}
          {mode === 'embed' && (
            <object
              ref={objectRef}
              data={blobUrl}
              type="application/pdf"
              className="w-full h-full"
              onError={handleEmbedError}
            >
              <div className="flex flex-col items-center justify-center h-full p-8">
                <FileText className="h-16 w-16 text-slate-400 mb-4" />
                <p className="text-slate-300 mb-2">Unable to display PDF inline</p>
                <p className="text-sm text-slate-400 mb-4">Your browser may not support inline PDF viewing</p>
                <div className="flex gap-2">
                  <Button onClick={handleDownload} size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenNewTab}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              </div>
            </object>
          )}

          {/* Fallback mode */}
          {mode === 'fallback' && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <FileText className="h-16 w-16 text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-200 mb-2">
                PDF Preview Unavailable
              </h3>
              <p className="text-sm text-slate-400 mb-6 max-w-md">
                The PDF cannot be displayed inline in this browser. 
                You can download the file or open it in a new tab.
              </p>
              <div className="flex gap-3">
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={handleOpenNewTab}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button variant="ghost" onClick={retry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Error state */}
          {mode === 'error' && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-200 mb-2">
                Failed to Load PDF
              </h3>
              <p className="text-sm text-slate-400 mb-2 max-w-md">
                {error || 'The document could not be loaded. It may have been moved or deleted.'}
              </p>
              <div className="flex gap-2 mt-4">
                <Button onClick={retry} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Try Download
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RobustPDFViewer;
