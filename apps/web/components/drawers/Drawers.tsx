'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { X, GripVertical, ChevronDown, ChevronUp, Minus, Maximize2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type DrawerPosition = 'left' | 'right' | 'top' | 'bottom';
type SnapPoint = number | 'full' | 'half' | 'quarter' | 'closed';

interface DrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  snapTo: (point: SnapPoint) => void;
}

// ============================================================================
// Drawer Context
// ============================================================================

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

export function useDrawer() {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within DrawerProvider');
  }
  return context;
}

// ============================================================================
// Bottom Sheet
// ============================================================================

interface BottomSheetProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  snapPoints?: SnapPoint[];
  defaultSnap?: SnapPoint;
  header?: React.ReactNode;
  showHandle?: boolean;
  dismissible?: boolean;
  overlay?: boolean;
  className?: string;
}

export function BottomSheet({
  children,
  isOpen,
  onClose,
  snapPoints = ['quarter', 'half', 'full'],
  defaultSnap = 'half',
  header,
  showHandle = true,
  dismissible = true,
  overlay = true,
  className = '',
}: BottomSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>(defaultSnap);
  const y = useMotionValue(0);
  
  const getSnapValue = useCallback((point: SnapPoint): number => {
    if (typeof point === 'number') return point;
    const vh = window.innerHeight;
    switch (point) {
      case 'full': return 0;
      case 'half': return vh * 0.5;
      case 'quarter': return vh * 0.75;
      case 'closed': return vh;
      default: return vh * 0.5;
    }
  }, []);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // Fast swipe down closes
    if (velocity > 500 && dismissible) {
      onClose();
      return;
    }

    // Fast swipe up maximizes
    if (velocity < -500) {
      setCurrentSnap('full');
      return;
    }

    // Find nearest snap point
    const currentY = y.get();
    const snapValues = snapPoints.map(getSnapValue);
    let nearest = snapValues[0];
    let minDistance = Math.abs(currentY - snapValues[0]);

    for (const snap of snapValues) {
      const distance = Math.abs(currentY + offset - snap);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = snap;
      }
    }

    // Find corresponding snap point
    const snapIndex = snapValues.indexOf(nearest);
    if (snapIndex !== -1) {
      const point = snapPoints[snapIndex];
      if (point === 'closed' && dismissible) {
        onClose();
      } else {
        setCurrentSnap(point);
      }
    }
  }, [y, snapPoints, getSnapValue, onClose, dismissible]);

  const snapTo = useCallback((point: SnapPoint) => {
    setCurrentSnap(point);
  }, []);

  const contextValue: DrawerContextValue = {
    isOpen,
    open: () => {},
    close: onClose,
    toggle: () => {},
    snapTo,
  };

  return (
    <DrawerContext.Provider value={contextValue}>
      <AnimatePresence>
        {isOpen && (
          <div key="open" className="contents">
            {/* Overlay */}
            {overlay && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={dismissible ? onClose : undefined}
                className="fixed inset-0 bg-black/50 z-40"
              />
            )}

            {/* Sheet */}
            <motion.div
              ref={containerRef}
              initial={{ y: '100%' }}
              animate={{ y: getSnapValue(currentSnap) }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              style={{ y }}
              className={`
                fixed inset-x-0 bottom-0 z-50 
                bg-white dark:bg-gray-900 
                rounded-t-2xl shadow-2xl
                max-h-[95vh] overflow-hidden
                ${className}
              `}
            >
              {/* Handle */}
              {showHandle && (
                <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing">
                  <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                </div>
              )}

              {/* Header */}
              {header && (
                <div className="px-4 pb-3 border-b border-gray-200 dark:border-gray-800">
                  {header}
                </div>
              )}

              {/* Content */}
              <div className="overflow-y-auto overscroll-contain p-4">
                {children}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DrawerContext.Provider>
  );
}

// ============================================================================
// Side Drawer
// ============================================================================

interface SideDrawerProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  overlay?: boolean;
  dismissible?: boolean;
  className?: string;
}

export function SideDrawer({
  children,
  isOpen,
  onClose,
  position = 'right',
  size = 'md',
  header,
  footer,
  overlay = true,
  dismissible = true,
  className = '',
}: SideDrawerProps) {
  const sizeClasses = {
    sm: 'w-80',
    md: 'w-96',
    lg: 'w-[32rem]',
    xl: 'w-[40rem]',
    full: 'w-full',
  };

  const positionClasses = {
    left: 'left-0',
    right: 'right-0',
  };

  const slideFrom = position === 'left' ? '-100%' : '100%';

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="open" className="contents">
          {/* Overlay */}
          {overlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dismissible ? onClose : undefined}
              className="fixed inset-0 bg-black/50 z-40"
            />
          )}

          {/* Drawer */}
          <motion.div
            initial={{ x: slideFrom }}
            animate={{ x: 0 }}
            exit={{ x: slideFrom }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`
              fixed top-0 bottom-0 z-50
              bg-white dark:bg-gray-900
              shadow-2xl flex flex-col
              ${sizeClasses[size]}
              ${positionClasses[position]}
              ${className}
            `}
          >
            {/* Header */}
            {header && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex-1">{header}</div>
                {dismissible && (
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Resizable Panel
// ============================================================================

interface ResizablePanelProps {
  children: React.ReactNode;
  position?: 'left' | 'right' | 'top' | 'bottom';
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  onResize?: (size: number) => void;
  className?: string;
}

export function ResizablePanel({
  children,
  position = 'left',
  defaultSize = 300,
  minSize = 200,
  maxSize = 600,
  collapsible = true,
  collapsed = false,
  onCollapse,
  onResize,
  className = '',
}: ResizablePanelProps) {
  const [size, setSize] = useState(defaultSize);
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const isDragging = useRef(false);
  const startSize = useRef(0);
  const startPos = useRef(0);

  const isHorizontal = position === 'left' || position === 'right';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startSize.current = size;
    startPos.current = isHorizontal ? e.clientX : e.clientY;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;

    const currentPos = isHorizontal ? e.clientX : e.clientY;
    let delta = currentPos - startPos.current;
    
    if (position === 'right' || position === 'bottom') {
      delta = -delta;
    }

    const newSize = Math.min(maxSize, Math.max(minSize, startSize.current + delta));
    setSize(newSize);
    onResize?.(newSize);
  }, [isHorizontal, position, minSize, maxSize, onResize]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const toggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapse?.(newCollapsed);
  };

  const panelStyle = isHorizontal
    ? { width: isCollapsed ? 0 : size }
    : { height: isCollapsed ? 0 : size };

  const handleClasses = isHorizontal
    ? `w-1 h-full cursor-col-resize ${position === 'left' ? '-right-0.5' : '-left-0.5'}`
    : `h-1 w-full cursor-row-resize ${position === 'top' ? '-bottom-0.5' : '-top-0.5'}`;

  return (
    <motion.div
      animate={panelStyle}
      transition={{ duration: 0.2 }}
      className={`
        relative flex-shrink-0 overflow-hidden
        bg-white dark:bg-gray-900
        border-gray-200 dark:border-gray-800
        ${isHorizontal ? 'border-r' : 'border-b'}
        ${className}
      `}
    >
      {/* Content */}
      <div className="h-full overflow-hidden">
        {children}
      </div>

      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={`
            absolute z-10 bg-transparent hover:bg-violet-500/50
            transition-colors group
            ${handleClasses}
          `}
        >
          <div
            className={`
              absolute inset-0 flex items-center justify-center
              opacity-0 group-hover:opacity-100 transition-opacity
            `}
          >
            <GripVertical className="w-3 h-3 text-violet-500" />
          </div>
        </div>
      )}

      {/* Collapse Button */}
      {collapsible && (
        <button
          onClick={toggleCollapse}
          className={`
            absolute z-20 p-1 rounded-full
            bg-gray-100 dark:bg-gray-800
            hover:bg-gray-200 dark:hover:bg-gray-700
            border border-gray-200 dark:border-gray-700
            shadow-sm transition-colors
            ${position === 'left' ? 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2' : ''}
            ${position === 'right' ? 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2' : ''}
            ${position === 'top' ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' : ''}
            ${position === 'bottom' ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}
          `}
        >
          {isHorizontal ? (
            isCollapsed !== (position === 'left') ? (
              <ChevronDown className="w-4 h-4 rotate-90" />
            ) : (
              <ChevronUp className="w-4 h-4 rotate-90" />
            )
          ) : (
            isCollapsed !== (position === 'top') ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )
          )}
        </button>
      )}
    </motion.div>
  );
}

// ============================================================================
// Split View
// ============================================================================

interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export function SplitView({
  left,
  right,
  defaultRatio = 0.5,
  minRatio = 0.2,
  maxRatio = 0.8,
  direction = 'horizontal',
  className = '',
}: SplitViewProps) {
  const [ratio, setRatio] = useState(defaultRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const isHorizontal = direction === 'horizontal';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let newRatio: number;

    if (isHorizontal) {
      newRatio = (e.clientX - rect.left) / rect.width;
    } else {
      newRatio = (e.clientY - rect.top) / rect.height;
    }

    setRatio(Math.min(maxRatio, Math.max(minRatio, newRatio)));
  }, [isHorizontal, minRatio, maxRatio]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  return (
    <div
      ref={containerRef}
      className={`
        flex h-full
        ${isHorizontal ? 'flex-row' : 'flex-col'}
        ${className}
      `}
    >
      {/* Left/Top Panel */}
      <div
        style={isHorizontal ? { width: `${ratio * 100}%` } : { height: `${ratio * 100}%` }}
        className="overflow-hidden"
      >
        {left}
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleMouseDown}
        className={`
          flex-shrink-0 bg-gray-200 dark:bg-gray-700
          hover:bg-violet-500 transition-colors
          ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
        `}
      />

      {/* Right/Bottom Panel */}
      <div className="flex-1 overflow-hidden">
        {right}
      </div>
    </div>
  );
}

// ============================================================================
// Minimizable Window
// ============================================================================

interface MinimizableWindowProps {
  children: React.ReactNode;
  title: string;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  minimized?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  className?: string;
}

export function MinimizableWindow({
  children,
  title,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 400, height: 300 },
  minimized = false,
  onMinimize,
  onMaximize,
  onClose,
  className = '',
}: MinimizableWindowProps) {
  const [isMinimized, setIsMinimized] = useState(minimized);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(defaultPosition);
  const [size, setSize] = useState(defaultSize);

  const handleMinimize = () => {
    setIsMinimized(true);
    onMinimize?.();
  };

  const handleMaximize = () => {
    if (isMaximized) {
      setIsMaximized(false);
    } else {
      setIsMaximized(true);
    }
    onMaximize?.();
  };

  return (
    <motion.div
      drag={!isMaximized}
      dragMomentum={false}
      initial={false}
      animate={{
        x: isMaximized ? 0 : position.x,
        y: isMaximized ? 0 : position.y,
        width: isMaximized ? '100%' : size.width,
        height: isMinimized ? 'auto' : isMaximized ? '100%' : size.height,
      }}
      onDragEnd={(_, info) => {
        setPosition({
          x: position.x + info.offset.x,
          y: position.y + info.offset.y,
        });
      }}
      className={`
        fixed z-50 bg-white dark:bg-gray-900 rounded-lg shadow-2xl
        border border-gray-200 dark:border-gray-700 overflow-hidden
        ${className}
      `}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 cursor-move">
        <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
          {title}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleMaximize}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-gray-500 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div key="Drawers-ap-1"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-auto"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// Use Bottom Sheet Hook
// ============================================================================

export function useBottomSheet() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}

// ============================================================================
// Use Side Drawer Hook
// ============================================================================

export function useSideDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}
