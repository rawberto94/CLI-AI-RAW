/**
 * Responsive Layout Components
 * Provides responsive layout utilities and components
 */

'use client';

import React from 'react';
import { useResponsive, useIsMobile, useIsTablet } from '@/hooks/useResponsive';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

// ============================================================================
// Responsive Container
// ============================================================================

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function ResponsiveContainer({ 
  children, 
  className = '',
  maxWidth = 'xl'
}: ResponsiveContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };

  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${maxWidthClasses[maxWidth]} ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// Responsive Grid
// ============================================================================

export interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
  className?: string;
}

export function ResponsiveGrid({ 
  children, 
  cols = { xs: 1, sm: 2, md: 3, lg: 4 },
  gap = 4,
  className = ''
}: ResponsiveGridProps) {
  const gridCols = `
    grid-cols-${cols.xs || 1}
    ${cols.sm ? `sm:grid-cols-${cols.sm}` : ''}
    ${cols.md ? `md:grid-cols-${cols.md}` : ''}
    ${cols.lg ? `lg:grid-cols-${cols.lg}` : ''}
    ${cols.xl ? `xl:grid-cols-${cols.xl}` : ''}
  `;

  return (
    <div className={`grid ${gridCols} gap-${gap} ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// Responsive Stack (Horizontal on desktop, vertical on mobile)
// ============================================================================

export interface ResponsiveStackProps {
  children: React.ReactNode;
  direction?: 'horizontal' | 'vertical';
  breakpoint?: 'sm' | 'md' | 'lg';
  gap?: number;
  className?: string;
}

export function ResponsiveStack({ 
  children, 
  direction = 'horizontal',
  breakpoint = 'md',
  gap = 4,
  className = ''
}: ResponsiveStackProps) {
  const flexDirection = direction === 'horizontal' 
    ? `flex-col ${breakpoint}:flex-row` 
    : `flex-row ${breakpoint}:flex-col`;

  return (
    <div className={`flex ${flexDirection} gap-${gap} ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// Mobile Drawer
// ============================================================================

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  position?: 'left' | 'right' | 'bottom';
}

export function MobileDrawer({ 
  isOpen, 
  onClose, 
  children, 
  title,
  position = 'left'
}: MobileDrawerProps) {
  const slideVariants = {
    left: {
      hidden: { x: '-100%' },
      visible: { x: 0 },
    },
    right: {
      hidden: { x: '100%' },
      visible: { x: 0 },
    },
    bottom: {
      hidden: { y: '100%' },
      visible: { y: 0 },
    },
  };

  const positionClasses = {
    left: 'left-0 top-0 h-full w-80 max-w-[85vw]',
    right: 'right-0 top-0 h-full w-80 max-w-[85vw]',
    bottom: 'bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl',
  };

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={slideVariants[position]}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed ${positionClasses[position]} bg-white shadow-2xl z-50 overflow-y-auto`}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Responsive Navigation
// ============================================================================

export interface ResponsiveNavProps {
  desktopNav: React.ReactNode;
  mobileNav: React.ReactNode;
  logo?: React.ReactNode;
}

export function ResponsiveNav({ desktopNav, mobileNav, logo }: ResponsiveNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const isMobile = useIsMobile();

  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          {logo && <div className="flex-shrink-0">{logo}</div>}

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4 flex-1 justify-end">
            {desktopNav}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        position="right"
        title="Menu"
      >
        {mobileNav}
      </MobileDrawer>
    </nav>
  );
}

// ============================================================================
// Responsive Show/Hide
// ============================================================================

export interface ResponsiveShowProps {
  children: React.ReactNode;
  on?: 'mobile' | 'tablet' | 'desktop';
}

export function ResponsiveShow({ children, on = 'mobile' }: ResponsiveShowProps) {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const shouldShow = 
    (on === 'mobile' && isMobile) ||
    (on === 'tablet' && isTablet) ||
    (on === 'desktop' && isDesktop);

  if (!shouldShow) return null;

  return <>{children}</>;
}

export function ResponsiveHide({ children, on = 'mobile' }: ResponsiveShowProps) {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const shouldHide = 
    (on === 'mobile' && isMobile) ||
    (on === 'tablet' && isTablet) ||
    (on === 'desktop' && isDesktop);

  if (shouldHide) return null;

  return <>{children}</>;
}

// ============================================================================
// Responsive Table
// ============================================================================

export interface ResponsiveTableProps {
  headers: string[];
  rows: React.ReactNode[][];
  mobileCardRenderer?: (row: React.ReactNode[], index: number) => React.ReactNode;
}

export function ResponsiveTable({ headers, rows, mobileCardRenderer }: ResponsiveTableProps) {
  const isMobile = useIsMobile();

  if (isMobile && mobileCardRenderer) {
    return (
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="border rounded-lg p-4">
            {mobileCardRenderer(row, index)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
