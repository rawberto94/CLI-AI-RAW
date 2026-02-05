/**
 * Responsive Performance Utilities
 * Optimizations for responsive rendering and adaptive loading
 */

'use client';

import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo,
  useRef,
  memo,
  lazy,
  Suspense,
  type ComponentType,
  type ReactNode,
  type ElementType
} from 'react';
import { useViewport, useNetworkInfo, useAdaptiveLoading } from '@/lib/responsive';

// ============================================================================
// Adaptive Component Loader
// ============================================================================

interface AdaptiveComponentConfig<P> {
  mobile: ComponentType<P>;
  desktop: ComponentType<P>;
  tablet?: ComponentType<P>;
  ssr?: ComponentType<P>;
}

/**
 * Load different component versions based on device
 * 
 * @example
 * const AdaptiveTable = createAdaptiveComponent({
 *   mobile: MobileTableView,
 *   tablet: TabletTableView,
 *   desktop: DesktopTableView,
 * });
 */
export function createAdaptiveComponent<P extends object>(
  config: AdaptiveComponentConfig<P>
): ComponentType<P> {
  return function AdaptiveComponent(props: P) {
    const { isMobile, isTablet, isDesktop } = useViewport();
    
    if (isMobile) {
      const Component = config.mobile;
      return <Component {...props} />;
    }
    
    if (isTablet && config.tablet) {
      const Component = config.tablet;
      return <Component {...props} />;
    }
    
    const Component = config.desktop;
    return <Component {...props} />;
  };
}

// ============================================================================
// Network-Aware Component
// ============================================================================

interface NetworkAwareProps {
  children: ReactNode;
  lowQualityFallback?: ReactNode;
  offlineFallback?: ReactNode;
}

/**
 * Component that adapts to network conditions
 */
export function NetworkAwareContent({
  children,
  lowQualityFallback,
  offlineFallback,
}: NetworkAwareProps) {
  const network = useNetworkInfo();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline && offlineFallback) {
    return <>{offlineFallback}</>;
  }

  if (
    (network.effectiveType === 'slow-2g' || network.effectiveType === '2g' || network.saveData) &&
    lowQualityFallback
  ) {
    return <>{lowQualityFallback}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// Progressive Image
// ============================================================================

interface ProgressiveImageProps {
  src: string;
  placeholder?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

/**
 * Image component with progressive loading and blur-up effect
 */
export const ProgressiveImage = memo(function ProgressiveImage({
  src,
  placeholder,
  alt,
  className = '',
  width,
  height,
  priority = false,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { shouldLoadHQ, imageQuality } = useAdaptiveLoading();

  useEffect(() => {
    if (priority && imgRef.current) {
      imgRef.current.loading = 'eager';
    }
  }, [priority]);

  // Generate optimized src based on network
  const optimizedSrc = useMemo(() => {
    if (!shouldLoadHQ && imageQuality < 1) {
      // Could add image optimization logic here
      return src;
    }
    return src;
  }, [src, shouldLoadHQ, imageQuality]);

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {/* Placeholder */}
      {placeholder && !loaded && (
        
        <img
          src={placeholder}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-lg scale-105"
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      {}
      <img
        ref={imgRef}
        src={optimizedSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`
          w-full h-full object-cover
          transition-opacity duration-300
          ${loaded ? 'opacity-100' : 'opacity-0'}
        `}
        width={width}
        height={height}
      />

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <span className="text-gray-400">Failed to load image</span>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Responsive Skeleton
// ============================================================================

interface ResponsiveSkeletonProps {
  mobile?: ReactNode;
  desktop?: ReactNode;
  className?: string;
}

/**
 * Skeleton that adapts to device
 */
export function ResponsiveSkeleton({ mobile, desktop, className = '' }: ResponsiveSkeletonProps) {
  const { isMobile } = useViewport();
  
  const defaultSkeleton = (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  );

  return (
    <div className={className}>
      {isMobile ? (mobile || defaultSkeleton) : (desktop || defaultSkeleton)}
    </div>
  );
}

// ============================================================================
// Deferred Content (for non-critical UI)
// ============================================================================

interface DeferredContentProps {
  children: ReactNode;
  fallback?: ReactNode;
  delay?: number;
}

/**
 * Defer rendering of non-critical content
 * 
 * @example
 * <DeferredContent delay={100}>
 *   <ExpensiveChart />
 * </DeferredContent>
 */
export function DeferredContent({ 
  children, 
  fallback = null,
  delay = 0 
}: DeferredContentProps) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(() => {
        setTimeout(() => setShouldRender(true), delay);
      });
      return () => (window as any).cancelIdleCallback(id);
    } else {
      const timer = setTimeout(() => setShouldRender(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  return shouldRender ? <>{children}</> : <>{fallback}</>;
}

// ============================================================================
// Render Budget (limit renders per frame)
// ============================================================================

interface RenderBudgetProps {
  items: ReactNode[];
  itemsPerFrame?: number;
  renderDelay?: number;
  className?: string;
}

/**
 * Progressively render items to avoid blocking the main thread
 */
export function RenderBudget({
  items,
  itemsPerFrame = 5,
  renderDelay = 16, // ~60fps
  className = '',
}: RenderBudgetProps) {
  const [renderedCount, setRenderedCount] = useState(itemsPerFrame);

  useEffect(() => {
    if (renderedCount >= items.length) return;

    const timer = setTimeout(() => {
      setRenderedCount(prev => Math.min(prev + itemsPerFrame, items.length));
    }, renderDelay);

    return () => clearTimeout(timer);
  }, [renderedCount, items.length, itemsPerFrame, renderDelay]);

  return (
    <div className={className}>
      {items.slice(0, renderedCount)}
      {renderedCount < items.length && (
        <div className="flex justify-center p-4">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Responsive Font Size
// ============================================================================

interface ResponsiveFontProps {
  children: ReactNode;
  size: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
  };
  as?: ElementType;
  className?: string;
}

/**
 * Component with responsive font sizing
 */
export function ResponsiveFont({
  children,
  size,
  as: Component = 'span',
  className = '',
}: ResponsiveFontProps) {
  const { breakpoint } = useViewport();
  
  const fontSize = useMemo(() => {
    const breakpointOrder = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
    const currentIndex = breakpointOrder.indexOf(breakpoint as typeof breakpointOrder[number]);
    
    for (let i = currentIndex; i >= 0; i--) {
      const bp = breakpointOrder[i];
      if (bp && size[bp]) return size[bp];
    }
    
    return size.md || '1rem';
  }, [breakpoint, size]);

  return (
    <Component className={className} style={{ fontSize }}>
      {children}
    </Component>
  );
}

// ============================================================================
// Device-Specific Rendering
// ============================================================================

interface DeviceOnlyProps {
  children: ReactNode;
  devices: ('mobile' | 'tablet' | 'desktop')[];
}

/**
 * Render content only on specific devices
 */
export function DeviceOnly({ children, devices }: DeviceOnlyProps) {
  const { isMobile, isTablet, isDesktop } = useViewport();
  
  const shouldRender = (
    (devices.includes('mobile') && isMobile) ||
    (devices.includes('tablet') && isTablet) ||
    (devices.includes('desktop') && isDesktop)
  );

  return shouldRender ? <>{children}</> : null;
}

// ============================================================================
// Touch-Only / Mouse-Only Content
// ============================================================================

export function TouchOnly({ children }: { children: ReactNode }) {
  const { isTouchDevice } = useViewport();
  return isTouchDevice ? <>{children}</> : null;
}

export function MouseOnly({ children }: { children: ReactNode }) {
  const { isTouchDevice } = useViewport();
  return !isTouchDevice ? <>{children}</> : null;
}

// ============================================================================
// Aspect Ratio Container
// ============================================================================

interface AspectRatioProps {
  ratio: number | string;
  children: ReactNode;
  className?: string;
}

/**
 * Container that maintains aspect ratio
 */
export function AspectRatio({ ratio, children, className = '' }: AspectRatioProps) {
  const paddingTop = useMemo(() => {
    if (typeof ratio === 'number') {
      return `${(1 / ratio) * 100}%`;
    }
    // Handle string ratios like "16:9"
    const [w, h] = ratio.split(':').map(Number);
    const width = w ?? 16;
    const height = h ?? 9;
    return `${(height / width) * 100}%`;
  }, [ratio]);

  return (
    <div className={`relative ${className}`} style={{ paddingTop }}>
      <div className="absolute inset-0">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Safe Area Padding
// ============================================================================

interface SafeAreaProps {
  children: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  className?: string;
}

/**
 * Container with safe area insets for notched devices
 */
export function SafeArea({ children, edges = ['top', 'bottom'], className = '' }: SafeAreaProps) {
  const paddingStyles = useMemo(() => {
    const styles: React.CSSProperties = {};
    
    if (edges.includes('top')) {
      styles.paddingTop = 'env(safe-area-inset-top, 0px)';
    }
    if (edges.includes('bottom')) {
      styles.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
    }
    if (edges.includes('left')) {
      styles.paddingLeft = 'env(safe-area-inset-left, 0px)';
    }
    if (edges.includes('right')) {
      styles.paddingRight = 'env(safe-area-inset-right, 0px)';
    }
    
    return styles;
  }, [edges]);

  return (
    <div className={className} style={paddingStyles}>
      {children}
    </div>
  );
}

// ============================================================================
// Orientation Lock Warning
// ============================================================================

interface OrientationWarningProps {
  preferred: 'portrait' | 'landscape';
  message?: string;
}

/**
 * Show warning when device is in wrong orientation
 */
export function OrientationWarning({ 
  preferred, 
  message = `Please rotate your device to ${preferred} mode for the best experience.`
}: OrientationWarningProps) {
  const { isPortrait, isLandscape, isMobile } = useViewport();
  
  const showWarning = isMobile && (
    (preferred === 'portrait' && isLandscape) ||
    (preferred === 'landscape' && isPortrait)
  );

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8">
      <div className="text-center text-white">
        <div className="text-6xl mb-4">📱</div>
        <p className="text-lg">{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export type {
  AdaptiveComponentConfig,
  NetworkAwareProps,
  ProgressiveImageProps,
  ResponsiveSkeletonProps,
  DeferredContentProps,
  RenderBudgetProps,
  ResponsiveFontProps,
  DeviceOnlyProps,
  AspectRatioProps,
  SafeAreaProps,
  OrientationWarningProps,
};
