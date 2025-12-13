/**
 * Mobile-Optimized Components
 * Touch-friendly UI components for mobile devices
 */

'use client';

import React, { 
  useState, 
  useRef, 
  useEffect, 
  useCallback,
  memo,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type MouseEvent as ReactMouseEvent
} from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, GripVertical, Check } from 'lucide-react';
import { useViewport, useTouch } from '@/lib/responsive';

// ============================================================================
// Pull to Refresh
// ============================================================================

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export function PullToRefresh({ 
  children, 
  onRefresh, 
  threshold = 80,
  disabled = false 
}: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    if (disabled || refreshing) return;
    
    const scrollTop = containerRef.current?.scrollTop || 0;
    if (scrollTop <= 0 && e.touches[0]) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!pulling || disabled || refreshing || !e.touches[0]) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, (currentY - startY.current) * 0.5);
    setPullDistance(Math.min(distance, threshold * 1.5));
  }, [pulling, disabled, refreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || disabled) return;
    
    setPulling(false);
    
    if (pullDistance >= threshold) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    
    setPullDistance(0);
  }, [pulling, pullDistance, threshold, onRefresh, disabled]);

  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div 
      ref={containerRef}
      className="relative overflow-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        className="absolute left-0 right-0 flex justify-center items-center pointer-events-none"
        style={{ 
          top: -40,
          height: 40,
        }}
        animate={{ 
          y: refreshing ? 50 : pullDistance,
          opacity: pullDistance > 10 || refreshing ? 1 : 0,
        }}
      >
        <motion.div
          className="w-8 h-8 border-2 border-blue-500 rounded-full"
          style={{
            borderTopColor: 'transparent',
          }}
          animate={{ 
            rotate: refreshing ? 360 : progress * 360,
          }}
          transition={{
            rotate: refreshing ? { repeat: Infinity, duration: 1, ease: 'linear' } : { duration: 0 }
          }}
        />
      </motion.div>

      {/* Content */}
      <motion.div
        animate={{ y: refreshing ? 50 : pullDistance }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ============================================================================
// Swipeable Card
// ============================================================================

interface SwipeableCardProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  threshold?: number;
  className?: string;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  threshold = 100,
  className = '',
}: SwipeableCardProps) {
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);

  const leftOpacity = useTransform(x, [-threshold, 0], [1, 0]);
  const rightOpacity = useTransform(x, [0, threshold], [0, 1]);
  const scale = useTransform(x, [-threshold * 2, 0, threshold * 2], [0.9, 1, 0.9]);

  const handleDragEnd = useCallback((
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    setIsDragging(false);
    
    if (info.offset.x < -threshold && onSwipeLeft) {
      onSwipeLeft();
    } else if (info.offset.x > threshold && onSwipeRight) {
      onSwipeRight();
    }
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left action background */}
      {leftAction && (
        <motion.div
          className="absolute inset-y-0 left-0 flex items-center justify-start px-4 bg-red-500 text-white"
          style={{ opacity: leftOpacity }}
        >
          {leftAction}
        </motion.div>
      )}

      {/* Right action background */}
      {rightAction && (
        <motion.div
          className="absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-green-500 text-white"
          style={{ opacity: rightOpacity }}
        >
          {rightAction}
        </motion.div>
      )}

      {/* Main content */}
      <motion.div
        style={{ x, scale }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        className={`bg-white relative z-10 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ============================================================================
// Bottom Sheet
// ============================================================================

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  snapPoints?: number[];
  defaultSnap?: number;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [0.5, 0.9],
  defaultSnap = 0,
}: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { height: viewportHeight } = useViewport();

  const snapHeights = snapPoints.map(p => viewportHeight * p);
  const currentHeight = snapHeights[currentSnap] ?? snapHeights[0] ?? viewportHeight * 0.5;

  const handleDragEnd = useCallback((
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // Close if dragged down significantly or with high velocity
    if (offset > 100 || velocity > 500) {
      if (currentSnap === 0) {
        onClose();
      } else {
        setCurrentSnap(Math.max(0, currentSnap - 1));
      }
    }
    // Expand if dragged up
    else if (offset < -50 || velocity < -500) {
      setCurrentSnap(Math.min(snapPoints.length - 1, currentSnap + 1));
    }
  }, [currentSnap, snapPoints.length, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: viewportHeight - currentHeight }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: viewportHeight - (snapHeights[snapHeights.length - 1] ?? viewportHeight * 0.9), bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl z-50"
            style={{ height: snapHeights[snapHeights.length - 1] ?? viewportHeight * 0.9, touchAction: 'none' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Title */}
            {title && (
              <div className="px-4 pb-3 border-b">
                <h2 className="text-lg font-semibold text-center">{title}</h2>
              </div>
            )}

            {/* Content */}
            <div className="overflow-auto" style={{ height: currentHeight - 60 }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Mobile Carousel
// ============================================================================

interface CarouselProps {
  items: ReactNode[];
  showIndicators?: boolean;
  showArrows?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  className?: string;
}

export function MobileCarousel({
  items,
  showIndicators = true,
  showArrows = false,
  autoPlay = false,
  autoPlayInterval = 3000,
  className = '',
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useViewport();

  const goTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, items.length - 1)));
  }, [items.length]);

  const next = useCallback(() => {
    setCurrentIndex(i => (i + 1) % items.length);
  }, [items.length]);

  const prev = useCallback(() => {
    setCurrentIndex(i => (i - 1 + items.length) % items.length);
  }, [items.length]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(next, autoPlayInterval);
    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, next]);

  const handleDragEnd = useCallback((
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      next();
    } else if (info.offset.x > threshold) {
      prev();
    }
  }, [next, prev]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Items */}
      <motion.div
        ref={containerRef}
        className="flex"
        animate={{ x: `${-currentIndex * 100}%` }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag={isMobile ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
      >
        {items.map((item, index) => (
          <div key={index} className="w-full flex-shrink-0">
            {item}
          </div>
        ))}
      </motion.div>

      {/* Arrows (desktop) */}
      {showArrows && !isMobile && items.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-md hover:bg-white transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-md hover:bg-white transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Indicators */}
      {showIndicators && items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-white' : 'bg-white/50'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Drag-to-Reorder List
// ============================================================================

interface DraggableItem {
  id: string;
  content: ReactNode;
}

interface DraggableListProps {
  items: DraggableItem[];
  onReorder: (items: DraggableItem[]) => void;
  className?: string;
}

export function DraggableList({ items, onReorder, className = '' }: DraggableListProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const handleDragStart = useCallback((id: string) => {
    setDraggedItem(id);
  }, []);

  const handleDragOver = useCallback((id: string) => {
    if (id !== draggedItem) {
      setDragOverItem(id);
    }
  }, [draggedItem]);

  const handleDragEnd = useCallback(() => {
    if (draggedItem && dragOverItem && draggedItem !== dragOverItem) {
      const newItems = [...items];
      const draggedIndex = items.findIndex(i => i.id === draggedItem);
      const targetIndex = items.findIndex(i => i.id === dragOverItem);
      
      const [removed] = newItems.splice(draggedIndex, 1);
      if (removed) {
        newItems.splice(targetIndex, 0, removed);
        onReorder(newItems);
      }
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  }, [draggedItem, dragOverItem, items, onReorder]);

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item) => (
        <motion.div
          key={item.id}
          layout
          className={`
            flex items-center gap-3 p-3 bg-white border rounded-lg
            ${draggedItem === item.id ? 'opacity-50' : ''}
            ${dragOverItem === item.id ? 'border-blue-500' : ''}
          `}
          draggable
          onDragStart={() => handleDragStart(item.id)}
          onDragOver={() => handleDragOver(item.id)}
          onDragEnd={handleDragEnd}
        >
          <GripVertical className="w-5 h-5 text-gray-400 cursor-grab active:cursor-grabbing" />
          <div className="flex-1">{item.content}</div>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// Swipe Actions (iOS-style)
// ============================================================================

interface SwipeAction {
  label: string;
  icon?: ReactNode;
  color: string;
  onClick: () => void;
}

interface SwipeActionsProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
}

export function SwipeActions({
  children,
  leftActions = [],
  rightActions = [],
  className = '',
}: SwipeActionsProps) {
  const x = useMotionValue(0);
  const [isOpen, setIsOpen] = useState<'left' | 'right' | null>(null);

  const actionWidth = 80;
  const leftWidth = leftActions.length * actionWidth;
  const rightWidth = rightActions.length * actionWidth;

  const handleDragEnd = useCallback((
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (info.offset.x > leftWidth / 2 && leftActions.length > 0) {
      setIsOpen('left');
    } else if (info.offset.x < -rightWidth / 2 && rightActions.length > 0) {
      setIsOpen('right');
    } else {
      setIsOpen(null);
    }
  }, [leftWidth, rightWidth, leftActions.length, rightActions.length]);

  const close = useCallback(() => setIsOpen(null), []);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left actions */}
      {leftActions.length > 0 && (
        <div 
          className="absolute inset-y-0 left-0 flex"
          style={{ width: leftWidth }}
        >
          {leftActions.map((action, i) => (
            <button
              key={i}
              onClick={() => { action.onClick(); close(); }}
              className="flex flex-col items-center justify-center px-4 text-white text-sm"
              style={{ backgroundColor: action.color, width: actionWidth }}
            >
              {action.icon}
              <span className="mt-1">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right actions */}
      {rightActions.length > 0 && (
        <div 
          className="absolute inset-y-0 right-0 flex"
          style={{ width: rightWidth }}
        >
          {rightActions.map((action, i) => (
            <button
              key={i}
              onClick={() => { action.onClick(); close(); }}
              className="flex flex-col items-center justify-center px-4 text-white text-sm"
              style={{ backgroundColor: action.color, width: actionWidth }}
            >
              {action.icon}
              <span className="mt-1">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <motion.div
        style={{ x }}
        animate={{ 
          x: isOpen === 'left' ? leftWidth : 
             isOpen === 'right' ? -rightWidth : 0 
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="x"
        dragConstraints={{ 
          left: rightActions.length > 0 ? -rightWidth : 0, 
          right: leftActions.length > 0 ? leftWidth : 0 
        }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        onClick={isOpen ? close : undefined}
        className="bg-white relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
}

// ============================================================================
// Touch-Friendly Checkbox
// ============================================================================

interface TouchCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const TouchCheckbox = memo(function TouchCheckbox({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
}: TouchCheckboxProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <label className={`flex items-center gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          ${sizeClasses[size]}
          rounded-md border-2 transition-all
          flex items-center justify-center
          ${checked 
            ? 'bg-blue-500 border-blue-500 text-white' 
            : 'bg-white border-gray-300 hover:border-blue-400'
          }
          ${disabled ? 'cursor-not-allowed' : 'active:scale-95'}
        `}
      >
        <AnimatePresence>
          {checked && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Check className={iconSizes[size]} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
});

// ============================================================================
// Mobile-Optimized Input
// ============================================================================

interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const MobileInput = React.forwardRef<HTMLInputElement, MobileInputProps>(
  function MobileInput({ label, error, helperText, className = '', ...props }, ref) {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-3 text-base
            border rounded-xl
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${error ? 'border-red-500' : 'border-gray-300'}
            ${className}
          `}
          // Prevent iOS zoom on focus
          style={{ fontSize: '16px' }}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

// ============================================================================
// Haptic Feedback Button
// ============================================================================

interface HapticButtonProps {
  haptic?: 'light' | 'medium' | 'heavy';
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const HapticButton = React.forwardRef<HTMLButtonElement, HapticButtonProps>(
  function HapticButton({
    haptic = 'light',
    variant = 'primary',
    size = 'md',
    className = '',
    onClick,
    children,
    disabled,
    type = 'button',
  }, ref) {
    const handleClick = useCallback((e: ReactMouseEvent<HTMLButtonElement>) => {
      // Trigger haptic feedback if available
      if ('vibrate' in navigator) {
        const patterns = {
          light: [10],
          medium: [20],
          heavy: [30],
        };
        navigator.vibrate(patterns[haptic]);
      }
      
      onClick?.(e);
    }, [haptic, onClick]);

    const variantClasses = {
      primary: 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
      ghost: 'bg-transparent hover:bg-gray-100 active:bg-gray-200',
    };

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm min-h-[36px]',
      md: 'px-4 py-3 text-base min-h-[44px]',
      lg: 'px-6 py-4 text-lg min-h-[52px]',
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        onClick={handleClick}
        disabled={disabled}
        type={type}
        className={`
          rounded-xl font-medium
          transition-colors
          active:transition-none
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
      >
        {children}
      </motion.button>
    );
  }
);

// ============================================================================
// Exports
// ============================================================================

export type { 
  PullToRefreshProps,
  SwipeableCardProps,
  BottomSheetProps,
  CarouselProps,
  DraggableItem,
  DraggableListProps,
  SwipeAction,
  SwipeActionsProps,
  TouchCheckboxProps,
  MobileInputProps,
  HapticButtonProps,
};
