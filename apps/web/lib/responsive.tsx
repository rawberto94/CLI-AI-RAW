/**
 * Advanced Responsive Utilities
 * Enhanced responsiveness patterns with performance optimizations
 */

'use client';

import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useRef,
  createContext,
  useContext,
  memo,
  type ReactNode
} from 'react';

// ============================================================================
// Types
// ============================================================================

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface BreakpointConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  isTouchDevice: boolean;
  pixelRatio: number;
}

// Default Tailwind breakpoints
export const defaultBreakpoints: BreakpointConfig = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

// ============================================================================
// Responsive Context (for shared state)
// ============================================================================

const ResponsiveContext = createContext<ViewportInfo | null>(null);

export function ResponsiveProvider({ 
  children,
  breakpoints = defaultBreakpoints 
}: { 
  children: ReactNode;
  breakpoints?: BreakpointConfig;
}) {
  const [viewport, setViewport] = useState<ViewportInfo>(() => getViewportInfo(breakpoints));

  useEffect(() => {
    let rafId: number;
    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      // Cancel pending updates
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(resizeTimeout);

      // Debounce with requestAnimationFrame for smooth updates
      rafId = requestAnimationFrame(() => {
        setViewport(getViewportInfo(breakpoints));
      });
    };

    // Initial update
    handleResize();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(resizeTimeout);
    };
  }, [breakpoints]);

  return (
    <ResponsiveContext.Provider value={viewport}>
      {children}
    </ResponsiveContext.Provider>
  );
}

export function useViewport(): ViewportInfo {
  const context = useContext(ResponsiveContext);
  
  if (!context) {
    // Fallback for components outside provider
    const [viewport, setViewport] = useState<ViewportInfo>(() => 
      getViewportInfo(defaultBreakpoints)
    );

    useEffect(() => {
      const handleResize = () => setViewport(getViewportInfo(defaultBreakpoints));
      window.addEventListener('resize', handleResize, { passive: true });
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    return viewport;
  }

  return context;
}

function getViewportInfo(breakpoints: BreakpointConfig): ViewportInfo {
  if (typeof window === 'undefined') {
    return {
      width: 1024,
      height: 768,
      breakpoint: 'lg',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isLandscape: true,
      isPortrait: false,
      isTouchDevice: false,
      pixelRatio: 1,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  
  let breakpoint: Breakpoint = 'xs';
  if (width >= breakpoints['2xl']) breakpoint = '2xl';
  else if (width >= breakpoints.xl) breakpoint = 'xl';
  else if (width >= breakpoints.lg) breakpoint = 'lg';
  else if (width >= breakpoints.md) breakpoint = 'md';
  else if (width >= breakpoints.sm) breakpoint = 'sm';

  return {
    width,
    height,
    breakpoint,
    isMobile: width < breakpoints.md,
    isTablet: width >= breakpoints.md && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
    isLandscape: width > height,
    isPortrait: height >= width,
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    pixelRatio: window.devicePixelRatio || 1,
  };
}

// ============================================================================
// Responsive Value Hook
// ============================================================================

type ResponsiveValue<T> = {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
  default: T;
};

/**
 * Get value based on current breakpoint
 * 
 * @example
 * const columns = useResponsiveValue({
 *   default: 1,
 *   sm: 2,
 *   md: 3,
 *   lg: 4,
 * });
 */
export function useResponsiveValue<T>(values: ResponsiveValue<T>): T {
  const { breakpoint } = useViewport();
  
  return useMemo(() => {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = breakpointOrder.indexOf(breakpoint);
    
    // Find the largest matching breakpoint
    for (let i = currentIndex; i >= 0; i--) {
      const bp = breakpointOrder[i];
      if (values[bp] !== undefined) {
        return values[bp] as T;
      }
    }
    
    return values.default;
  }, [breakpoint, values]);
}

// ============================================================================
// Container Query Hook (CSS Container Queries polyfill)
// ============================================================================

interface ContainerSize {
  width: number;
  height: number;
  inlineSize: number;
  blockSize: number;
}

/**
 * Hook to track container size (like CSS Container Queries)
 * 
 * @example
 * const { ref, size, isSmall, isMedium, isLarge } = useContainerQuery({
 *   small: 300,
 *   medium: 500,
 * });
 */
export function useContainerQuery<T extends HTMLElement = HTMLDivElement>(
  breakpoints: { small?: number; medium?: number; large?: number } = {}
) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ContainerSize>({ 
    width: 0, 
    height: 0, 
    inlineSize: 0, 
    blockSize: 0 
  });

  const { small = 300, medium = 500, large = 800 } = breakpoints;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({
          width,
          height,
          inlineSize: entry.borderBoxSize?.[0]?.inlineSize ?? width,
          blockSize: entry.borderBoxSize?.[0]?.blockSize ?? height,
        });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return {
    ref,
    size,
    isSmall: size.width < small,
    isMedium: size.width >= small && size.width < medium,
    isLarge: size.width >= medium && size.width < large,
    isXLarge: size.width >= large,
  };
}

// ============================================================================
// Intersection Observer Hook (for lazy loading/visibility)
// ============================================================================

interface IntersectionOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  freezeOnceVisible?: boolean;
}

/**
 * Hook to detect element visibility
 * 
 * @example
 * const { ref, isVisible, entry } = useIntersection({
 *   threshold: 0.5,
 *   freezeOnceVisible: true,
 * });
 */
export function useIntersection<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionOptions = {}
) {
  const {
    root = null,
    rootMargin = '0px',
    threshold = 0,
    freezeOnceVisible = false,
  } = options;

  const ref = useRef<T>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const frozen = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || (frozen.current && freezeOnceVisible)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);
        if (entry.isIntersecting && freezeOnceVisible) {
          frozen.current = true;
        }
      },
      { root, rootMargin, threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [root, rootMargin, threshold, freezeOnceVisible]);

  return {
    ref,
    entry,
    isVisible: entry?.isIntersecting ?? false,
    intersectionRatio: entry?.intersectionRatio ?? 0,
  };
}

// ============================================================================
// Virtual Scroll Position Hook
// ============================================================================

interface ScrollPosition {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right' | 'idle';
  isAtTop: boolean;
  isAtBottom: boolean;
  isScrolling: boolean;
}

/**
 * Hook to track scroll position with direction
 */
export function useScrollPosition(): ScrollPosition {
  const [scroll, setScroll] = useState<ScrollPosition>({
    x: 0,
    y: 0,
    direction: 'idle',
    isAtTop: true,
    isAtBottom: false,
    isScrolling: false,
  });

  const lastY = useRef(0);
  const lastX = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      const x = window.scrollX;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;

      let direction: ScrollPosition['direction'] = 'idle';
      if (y > lastY.current) direction = 'down';
      else if (y < lastY.current) direction = 'up';
      else if (x > lastX.current) direction = 'right';
      else if (x < lastX.current) direction = 'left';

      lastY.current = y;
      lastX.current = x;

      setScroll({
        x,
        y,
        direction,
        isAtTop: y <= 0,
        isAtBottom: y >= maxY - 10,
        isScrolling: true,
      });

      // Reset scrolling state after scroll ends
      clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        setScroll(prev => ({ ...prev, isScrolling: false, direction: 'idle' }));
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout.current);
    };
  }, []);

  return scroll;
}

// ============================================================================
// Responsive Image Hook
// ============================================================================

interface ResponsiveImageOptions {
  src: string;
  srcSet?: { [width: number]: string };
  sizes?: string;
  loading?: 'lazy' | 'eager';
  placeholder?: string;
}

/**
 * Hook for optimized responsive images
 * 
 * @example
 * const { imgProps, isLoading, error } = useResponsiveImage({
 *   src: '/images/hero.jpg',
 *   srcSet: {
 *     320: '/images/hero-320.jpg',
 *     640: '/images/hero-640.jpg',
 *     1280: '/images/hero-1280.jpg',
 *   },
 * });
 */
export function useResponsiveImage(options: ResponsiveImageOptions) {
  const { src, srcSet, sizes = '100vw', loading = 'lazy', placeholder } = options;
  const { width, pixelRatio } = useViewport();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const srcSetString = useMemo(() => {
    if (!srcSet) return undefined;
    return Object.entries(srcSet)
      .map(([w, url]) => `${url} ${w}w`)
      .join(', ');
  }, [srcSet]);

  const optimalSrc = useMemo(() => {
    if (!srcSet) return src;
    
    const targetWidth = width * pixelRatio;
    const widths = Object.keys(srcSet).map(Number).sort((a, b) => a - b);
    
    // Find the smallest image that's larger than target
    const optimal = widths.find(w => w >= targetWidth) || widths[widths.length - 1];
    return srcSet[optimal] || src;
  }, [src, srcSet, width, pixelRatio]);

  const handleLoad = useCallback(() => setIsLoading(false), []);
  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false);
    setError(new Error('Failed to load image'));
  }, []);

  return {
    imgProps: {
      src: optimalSrc,
      srcSet: srcSetString,
      sizes,
      loading,
      onLoad: handleLoad,
      onError: handleError,
      style: isLoading && placeholder ? { 
        backgroundImage: `url(${placeholder})`,
        backgroundSize: 'cover',
      } : undefined,
    },
    isLoading,
    error,
  };
}

// ============================================================================
// Touch-Friendly Hook
// ============================================================================

interface TouchState {
  isTouching: boolean;
  touchCount: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  direction: 'left' | 'right' | 'up' | 'down' | null;
}

/**
 * Hook for touch gesture detection
 */
export function useTouch<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [touch, setTouch] = useState<TouchState>({
    isTouching: false,
    touchCount: 0,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    direction: null,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      setTouch({
        isTouching: true,
        touchCount: e.touches.length,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        deltaX: 0,
        deltaY: 0,
        direction: null,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      setTouch(prev => {
        const deltaX = touch.clientX - prev.startX;
        const deltaY = touch.clientY - prev.startY;
        
        let direction: TouchState['direction'] = null;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          direction = deltaX > 0 ? 'right' : 'left';
        } else if (Math.abs(deltaY) > Math.abs(deltaX)) {
          direction = deltaY > 0 ? 'down' : 'up';
        }

        return {
          ...prev,
          touchCount: e.touches.length,
          currentX: touch.clientX,
          currentY: touch.clientY,
          deltaX,
          deltaY,
          direction,
        };
      });
    };

    const handleTouchEnd = () => {
      setTouch(prev => ({
        ...prev,
        isTouching: false,
        touchCount: 0,
      }));
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  return { ref, ...touch };
}

// ============================================================================
// Responsive Render Component
// ============================================================================

interface ResponsiveRenderProps {
  mobile?: ReactNode;
  tablet?: ReactNode;
  desktop?: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component to render different content based on viewport
 * 
 * @example
 * <ResponsiveRender
 *   mobile={<MobileCard />}
 *   tablet={<TabletCard />}
 *   desktop={<DesktopCard />}
 * />
 */
export const ResponsiveRender = memo(function ResponsiveRender({
  mobile,
  tablet,
  desktop,
  fallback = null,
}: ResponsiveRenderProps) {
  const { isMobile, isTablet, isDesktop } = useViewport();

  if (isMobile && mobile) return <>{mobile}</>;
  if (isTablet && tablet) return <>{tablet}</>;
  if (isDesktop && desktop) return <>{desktop}</>;
  
  // Fallback cascade
  if (desktop) return <>{desktop}</>;
  if (tablet) return <>{tablet}</>;
  if (mobile) return <>{mobile}</>;
  
  return <>{fallback}</>;
});

// ============================================================================
// Adaptive Loading Component
// ============================================================================

interface AdaptiveLoadProps {
  children: ReactNode;
  placeholder?: ReactNode;
  delay?: number;
  threshold?: number;
}

/**
 * Component that delays rendering on mobile for better perceived performance
 */
export function AdaptiveLoad({ 
  children, 
  placeholder = null,
  delay = 0,
  threshold = 0.1,
}: AdaptiveLoadProps) {
  const { isMobile } = useViewport();
  const { ref, isVisible } = useIntersection<HTMLDivElement>({ 
    threshold,
    freezeOnceVisible: true,
  });
  const [shouldRender, setShouldRender] = useState(!isMobile);

  useEffect(() => {
    if (!isMobile) {
      setShouldRender(true);
      return;
    }

    if (isVisible) {
      const timer = setTimeout(() => setShouldRender(true), delay);
      return () => clearTimeout(timer);
    }
  }, [isMobile, isVisible, delay]);

  return (
    <div ref={ref}>
      {shouldRender ? children : placeholder}
    </div>
  );
}

// ============================================================================
// Network-Aware Loading
// ============================================================================

interface NetworkInfo {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

/**
 * Hook to detect network conditions
 */
export function useNetworkInfo(): NetworkInfo {
  const [info, setInfo] = useState<NetworkInfo>({
    effectiveType: 'unknown',
    downlink: 10,
    rtt: 50,
    saveData: false,
  });

  useEffect(() => {
    const connection = (navigator as any).connection || 
                       (navigator as any).mozConnection || 
                       (navigator as any).webkitConnection;

    if (!connection) return;

    const updateInfo = () => {
      setInfo({
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 10,
        rtt: connection.rtt || 50,
        saveData: connection.saveData || false,
      });
    };

    updateInfo();
    connection.addEventListener('change', updateInfo);
    return () => connection.removeEventListener('change', updateInfo);
  }, []);

  return info;
}

/**
 * Hook for network-aware resource loading
 */
export function useAdaptiveLoading() {
  const network = useNetworkInfo();
  const { isMobile, pixelRatio } = useViewport();

  return useMemo(() => ({
    // Should load high-quality images?
    shouldLoadHQ: !network.saveData && 
                  network.effectiveType !== 'slow-2g' && 
                  network.effectiveType !== '2g',
    
    // Image quality multiplier
    imageQuality: network.saveData ? 0.5 : 
                  network.effectiveType === '3g' ? 0.75 : 1,
    
    // Should preload resources?
    shouldPreload: !isMobile && 
                   !network.saveData && 
                   network.effectiveType === '4g',
    
    // Animation duration multiplier (faster on slow networks)
    animationScale: network.effectiveType === '4g' ? 1 : 0.5,
    
    // Optimal image size based on device
    optimalImageWidth: Math.min(
      isMobile ? 640 : 1280,
      Math.round(640 * pixelRatio)
    ),
    
    // Network speed category
    speedCategory: network.effectiveType === '4g' ? 'fast' :
                   network.effectiveType === '3g' ? 'medium' : 'slow',
  }), [network, isMobile, pixelRatio]);
}

// ============================================================================
// Exports
// ============================================================================

export type {
  BreakpointConfig,
  ViewportInfo,
  ResponsiveValue,
  ContainerSize,
  IntersectionOptions,
  ScrollPosition,
  ResponsiveImageOptions,
  TouchState,
  NetworkInfo,
};
