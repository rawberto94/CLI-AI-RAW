/**
 * useResponsive Hook
 * Provides responsive design utilities and breakpoint detection
 */

'use client';

import { useState, useEffect } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  breakpoint: Breakpoint;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLargeDesktop: false,
    breakpoint: 'lg',
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    orientation: 'landscape',
  });

  useEffect(() => {
    const updateState = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      let breakpoint: Breakpoint = 'xs';
      if (width >= breakpoints['2xl']) breakpoint = '2xl';
      else if (width >= breakpoints.xl) breakpoint = 'xl';
      else if (width >= breakpoints.lg) breakpoint = 'lg';
      else if (width >= breakpoints.md) breakpoint = 'md';
      else if (width >= breakpoints.sm) breakpoint = 'sm';

      setState({
        isMobile: width < breakpoints.md,
        isTablet: width >= breakpoints.md && width < breakpoints.lg,
        isDesktop: width >= breakpoints.lg,
        isLargeDesktop: width >= breakpoints.xl,
        breakpoint,
        width,
        height,
        orientation: width > height ? 'landscape' : 'portrait',
      });
    };

    updateState();
    window.addEventListener('resize', updateState);
    return () => window.removeEventListener('resize', updateState);
  }, []);

  return state;
}

// ============================================================================
// Breakpoint-specific Hooks
// ============================================================================

export function useIsMobile(): boolean {
  const { isMobile } = useResponsive();
  return isMobile;
}

export function useIsTablet(): boolean {
  const { isTablet } = useResponsive();
  return isTablet;
}

export function useIsDesktop(): boolean {
  const { isDesktop } = useResponsive();
  return isDesktop;
}

export function useBreakpoint(): Breakpoint {
  const { breakpoint } = useResponsive();
  return breakpoint;
}

// ============================================================================
// Media Query Hook
// ============================================================================

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

// ============================================================================
// Orientation Hook
// ============================================================================

export function useOrientation(): 'portrait' | 'landscape' {
  const { orientation } = useResponsive();
  return orientation;
}

// ============================================================================
// Touch Device Detection
// ============================================================================

export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error - msMaxTouchPoints is not in standard typings
      navigator.msMaxTouchPoints > 0
    );
  }, []);

  return isTouch;
}
