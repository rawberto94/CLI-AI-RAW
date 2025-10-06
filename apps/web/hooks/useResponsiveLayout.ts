/**
 * Responsive Layout Hook
 * Detects device type and orientation for responsive UI
 */

import { useState, useEffect } from 'react'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'
export type Orientation = 'portrait' | 'landscape'

export interface ResponsiveLayout {
  deviceType: DeviceType
  orientation: Orientation
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isPortrait: boolean
  isLandscape: boolean
  width: number
  height: number
}

/**
 * Breakpoints (in pixels)
 */
const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024
}

/**
 * Get device type based on window width
 */
function getDeviceType(width: number): DeviceType {
  if (width < BREAKPOINTS.mobile) return 'mobile'
  if (width < BREAKPOINTS.tablet) return 'tablet'
  return 'desktop'
}

/**
 * Get orientation based on window dimensions
 */
function getOrientation(width: number, height: number): Orientation {
  return width > height ? 'landscape' : 'portrait'
}

/**
 * Hook to detect responsive layout information
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const [layout, setLayout] = useState<ResponsiveLayout>(() => {
    if (typeof window === 'undefined') {
      // SSR default
      return {
        deviceType: 'desktop',
        orientation: 'landscape',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isPortrait: false,
        isLandscape: true,
        width: 1920,
        height: 1080
      }
    }

    const width = window.innerWidth
    const height = window.innerHeight
    const deviceType = getDeviceType(width)
    const orientation = getOrientation(width, height)

    return {
      deviceType,
      orientation,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isDesktop: deviceType === 'desktop',
      isPortrait: orientation === 'portrait',
      isLandscape: orientation === 'landscape',
      width,
      height
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const deviceType = getDeviceType(width)
      const orientation = getOrientation(width, height)

      setLayout({
        deviceType,
        orientation,
        isMobile: deviceType === 'mobile',
        isTablet: deviceType === 'tablet',
        isDesktop: deviceType === 'desktop',
        isPortrait: orientation === 'portrait',
        isLandscape: orientation === 'landscape',
        width,
        height
      })
    }

    // Debounce resize events
    let timeoutId: NodeJS.Timeout
    const debouncedResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleResize, 150)
    }

    window.addEventListener('resize', debouncedResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  return layout
}

/**
 * Hook to check if device matches a specific type
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * Predefined media queries
 */
export const mediaQueries = {
  mobile: `(max-width: ${BREAKPOINTS.mobile - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.mobile}px) and (max-width: ${BREAKPOINTS.tablet - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.tablet}px)`,
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
  touchDevice: '(hover: none) and (pointer: coarse)'
}
