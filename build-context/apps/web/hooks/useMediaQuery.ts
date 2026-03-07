"use client";

/**
 * useMediaQuery Hook
 * 
 * Responsive design utilities with SSR support.
 */

import { useState, useEffect, useCallback, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export interface BreakpointConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  "2xl": number;
}

// Default Tailwind breakpoints
export const defaultBreakpoints: BreakpointConfig = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

// ============================================================================
// useMediaQuery Hook
// ============================================================================

export interface UseMediaQueryOptions {
  /** Default value for SSR */
  defaultValue?: boolean;
  /** Initialize immediately vs on mount */
  initializeWithValue?: boolean;
}

/**
 * Track a media query match state.
 * 
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 * ```
 */
export function useMediaQuery(
  query: string,
  options: UseMediaQueryOptions = {}
): boolean {
  const { defaultValue = false, initializeWithValue = true } = options;

  const getMatches = useCallback((): boolean => {
    if (typeof window === "undefined") {
      return defaultValue;
    }
    return window.matchMedia(query).matches;
  }, [query, defaultValue]);

  const [matches, setMatches] = useState<boolean>(() => {
    if (initializeWithValue) {
      return getMatches();
    }
    return defaultValue;
  });

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Use modern API if available
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener("change", handleChange);
    } else {
      // Fallback for older browsers
      mediaQueryList.addListener(handleChange);
    }

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener("change", handleChange);
      } else {
        mediaQueryList.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

// ============================================================================
// useBreakpoint Hook
// ============================================================================

export interface UseBreakpointOptions {
  /** Custom breakpoints */
  breakpoints?: Partial<BreakpointConfig>;
  /** Default breakpoint for SSR */
  defaultBreakpoint?: Breakpoint;
}

export interface UseBreakpointReturn {
  /** Current breakpoint name */
  breakpoint: Breakpoint;
  /** Whether at xs breakpoint */
  isXs: boolean;
  /** Whether at sm breakpoint or larger */
  isSm: boolean;
  /** Whether at md breakpoint or larger */
  isMd: boolean;
  /** Whether at lg breakpoint or larger */
  isLg: boolean;
  /** Whether at xl breakpoint or larger */
  isXl: boolean;
  /** Whether at 2xl breakpoint or larger */
  is2xl: boolean;
  /** Whether is mobile (below md) */
  isMobile: boolean;
  /** Whether is tablet (md to lg) */
  isTablet: boolean;
  /** Whether is desktop (lg and above) */
  isDesktop: boolean;
  /** Check if at or above a breakpoint */
  isAbove: (bp: Breakpoint) => boolean;
  /** Check if below a breakpoint */
  isBelow: (bp: Breakpoint) => boolean;
  /** Check if between two breakpoints */
  isBetween: (min: Breakpoint, max: Breakpoint) => boolean;
}

/**
 * Get current breakpoint and responsive utilities.
 * 
 * @example
 * ```tsx
 * const { isMobile, isDesktop, breakpoint } = useBreakpoint();
 * ```
 */
export function useBreakpoint(
  options: UseBreakpointOptions = {}
): UseBreakpointReturn {
  const { breakpoints: customBreakpoints, defaultBreakpoint = "md" } = options;
  
  const breakpoints = useMemo(
    () => ({ ...defaultBreakpoints, ...customBreakpoints }),
    [customBreakpoints]
  );

  const [width, setWidth] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    return window.innerWidth;
  });

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getCurrentBreakpoint = useCallback((): Breakpoint => {
    if (width === null) return defaultBreakpoint;
    
    if (width >= breakpoints["2xl"]) return "2xl";
    if (width >= breakpoints.xl) return "xl";
    if (width >= breakpoints.lg) return "lg";
    if (width >= breakpoints.md) return "md";
    if (width >= breakpoints.sm) return "sm";
    return "xs";
  }, [width, breakpoints, defaultBreakpoint]);

  const breakpoint = getCurrentBreakpoint();
  
  const isXs = width !== null && width < breakpoints.sm;
  const isSm = width !== null && width >= breakpoints.sm;
  const isMd = width !== null && width >= breakpoints.md;
  const isLg = width !== null && width >= breakpoints.lg;
  const isXl = width !== null && width >= breakpoints.xl;
  const is2xl = width !== null && width >= breakpoints["2xl"];

  const isMobile = width !== null && width < breakpoints.md;
  const isTablet = width !== null && width >= breakpoints.md && width < breakpoints.lg;
  const isDesktop = width !== null && width >= breakpoints.lg;

  const isAbove = useCallback(
    (bp: Breakpoint): boolean => {
      if (width === null) return false;
      return width >= breakpoints[bp];
    },
    [width, breakpoints]
  );

  const isBelow = useCallback(
    (bp: Breakpoint): boolean => {
      if (width === null) return false;
      return width < breakpoints[bp];
    },
    [width, breakpoints]
  );

  const isBetween = useCallback(
    (min: Breakpoint, max: Breakpoint): boolean => {
      if (width === null) return false;
      return width >= breakpoints[min] && width < breakpoints[max];
    },
    [width, breakpoints]
  );

  return {
    breakpoint,
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    is2xl,
    isMobile,
    isTablet,
    isDesktop,
    isAbove,
    isBelow,
    isBetween,
  };
}

// ============================================================================
// usePreferredColorScheme Hook
// ============================================================================

export type ColorScheme = "light" | "dark" | "no-preference";

/**
 * Get user's preferred color scheme.
 * 
 * @example
 * ```tsx
 * const colorScheme = usePreferredColorScheme();
 * // Returns 'light', 'dark', or 'no-preference'
 * ```
 */
export function usePreferredColorScheme(): ColorScheme {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const prefersLight = useMediaQuery("(prefers-color-scheme: light)");

  if (prefersDark) return "dark";
  if (prefersLight) return "light";
  return "no-preference";
}

// ============================================================================
// usePreferredMotion Hook
// ============================================================================

export type MotionPreference = "reduce" | "no-preference";

/**
 * Get user's motion preference.
 * 
 * @example
 * ```tsx
 * const motionPreference = usePreferredMotion();
 * const shouldAnimate = motionPreference !== 'reduce';
 * ```
 */
export function usePreferredMotion(): MotionPreference {
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  return prefersReduced ? "reduce" : "no-preference";
}

// ============================================================================
// useOrientation Hook
// ============================================================================

export type Orientation = "portrait" | "landscape";

export interface UseOrientationReturn {
  orientation: Orientation;
  isPortrait: boolean;
  isLandscape: boolean;
  angle: number;
}

/**
 * Get device orientation.
 */
export function useOrientation(): UseOrientationReturn {
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    const handleOrientationChange = () => {
      setAngle(window.screen?.orientation?.angle ?? 0);
    };

    handleOrientationChange();
    window.addEventListener("orientationchange", handleOrientationChange);
    return () => window.removeEventListener("orientationchange", handleOrientationChange);
  }, []);

  return {
    orientation: isPortrait ? "portrait" : "landscape",
    isPortrait,
    isLandscape: !isPortrait,
    angle,
  };
}

// ============================================================================
// usePrefersContrast Hook
// ============================================================================

export type ContrastPreference = "more" | "less" | "no-preference";

/**
 * Get user's contrast preference.
 */
export function usePrefersContrast(): ContrastPreference {
  const prefersMore = useMediaQuery("(prefers-contrast: more)");
  const prefersLess = useMediaQuery("(prefers-contrast: less)");

  if (prefersMore) return "more";
  if (prefersLess) return "less";
  return "no-preference";
}

// ============================================================================
// Responsive Value Helper
// ============================================================================

export type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>;

/**
 * Get value based on current breakpoint.
 * 
 * @example
 * ```tsx
 * const { getResponsiveValue, breakpoint } = useResponsiveValue();
 * 
 * const columns = getResponsiveValue({
 *   xs: 1,
 *   sm: 2,
 *   md: 3,
 *   lg: 4,
 * });
 * ```
 */
export function useResponsiveValue() {
  const { breakpoint } = useBreakpoint();

  const getResponsiveValue = useCallback(
    <T>(value: ResponsiveValue<T>, defaultValue?: T): T | undefined => {
      // If not a responsive object, return as-is
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return value as T;
      }

      const responsiveValue = value as Partial<Record<Breakpoint, T>>;
      const breakpointOrder: Breakpoint[] = ["2xl", "xl", "lg", "md", "sm", "xs"];
      const currentIndex = breakpointOrder.indexOf(breakpoint);

      // Find the first defined value at or below current breakpoint
      for (let i = currentIndex; i < breakpointOrder.length; i++) {
        const bp = breakpointOrder[i];
        if (bp !== undefined && responsiveValue[bp] !== undefined) {
          return responsiveValue[bp] as T;
        }
      }

      return defaultValue;
    },
    [breakpoint]
  );

  return {
    breakpoint,
    getResponsiveValue,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useMediaQuery;
