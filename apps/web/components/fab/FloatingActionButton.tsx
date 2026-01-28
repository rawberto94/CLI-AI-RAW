'use client';

/**
 * Floating Action Button (FAB) Component
 * 
 * A persistent action button that floats in the corner of the screen
 * with support for speed dial menu, animations, and accessibility.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface FABAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  tooltip?: string;
}

export interface FloatingActionButtonProps {
  /** Primary action when FAB is clicked (without speed dial) */
  onClick?: () => void;
  /** Icon for the main FAB */
  icon?: LucideIcon;
  /** Speed dial actions */
  actions?: FABAction[];
  /** Position of the FAB */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  /** Color variant */
  variant?: 'primary' | 'secondary' | 'gradient';
  /** Size of the FAB */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label */
  label?: string;
  /** Whether to show speed dial on hover (vs click) */
  hoverTrigger?: boolean;
  /** Custom class */
  className?: string;
  /** Whether to show labels on speed dial items */
  showLabels?: boolean;
  /** Offset from edge */
  offset?: { x?: number; y?: number };
  /** Whether to pulse to attract attention */
  pulse?: boolean;
  /** Badge count */
  badge?: number;
}

// ============================================================================
// Color Configurations
// ============================================================================

const variantStyles = {
  primary: 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30',
  secondary: 'bg-slate-700 hover:bg-slate-800 text-white shadow-lg shadow-slate-500/30',
  gradient: 'bg-gradient-to-r from-purple-500 via-purple-500 to-pink-500 hover:from-purple-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30',
};

const actionColors = {
  primary: 'bg-purple-500 hover:bg-purple-600 text-white',
  secondary: 'bg-slate-600 hover:bg-slate-700 text-white',
  success: 'bg-violet-500 hover:bg-violet-600 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
};

const sizeStyles = {
  sm: { button: 'w-12 h-12', icon: 'h-5 w-5', action: 'w-10 h-10', actionIcon: 'h-4 w-4' },
  md: { button: 'w-14 h-14', icon: 'h-6 w-6', action: 'w-11 h-11', actionIcon: 'h-5 w-5' },
  lg: { button: 'w-16 h-16', icon: 'h-7 w-7', action: 'w-12 h-12', actionIcon: 'h-5 w-5' },
};

const positionStyles = {
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
};

// ============================================================================
// Main Component
// ============================================================================

export function FloatingActionButton({
  onClick,
  icon: MainIcon = Plus,
  actions = [],
  position = 'bottom-right',
  variant = 'primary',
  size = 'md',
  label = 'Quick Actions',
  hoverTrigger = false,
  className,
  showLabels = true,
  offset,
  pulse = false,
  badge,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const hasActions = actions.length > 0;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleMainClick = useCallback(() => {
    if (hasActions) {
      setIsOpen(prev => !prev);
    } else if (onClick) {
      onClick();
    }
  }, [hasActions, onClick]);

  const handleActionClick = useCallback((action: FABAction) => {
    if (!action.disabled) {
      action.onClick();
      setIsOpen(false);
    }
  }, []);

  const offsetStyle = offset ? {
    ...(offset.x && (position.includes('right') ? { right: offset.x } : { left: offset.x })),
    ...(offset.y && { bottom: offset.y }),
  } : {};

  return (
    <div
      ref={fabRef}
      className={cn(
        'fixed z-50',
        positionStyles[position],
        className
      )}
      style={offsetStyle}
      onMouseEnter={hoverTrigger && hasActions ? () => setIsOpen(true) : undefined}
      onMouseLeave={hoverTrigger && hasActions ? () => setIsOpen(false) : undefined}
    >
      {/* Speed Dial Actions */}
      <AnimatePresence>
        {isOpen && hasActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex flex-col-reverse items-center gap-3"
          >
            {actions.map((action, index) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                  transition: { delay: index * 0.05 }
                }}
                exit={{ 
                  opacity: 0, 
                  y: 10, 
                  scale: 0.8,
                  transition: { delay: (actions.length - index - 1) * 0.03 }
                }}
                className="flex items-center gap-3"
              >
                {/* Label */}
                {showLabels && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: index * 0.05 + 0.1 } }}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white rounded-lg shadow-lg whitespace-nowrap"
                  >
                    {action.label}
                  </motion.span>
                )}
                
                {/* Action Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleActionClick(action)}
                  disabled={action.disabled}
                  className={cn(
                    'rounded-full shadow-lg flex items-center justify-center transition-colors',
                    sizeStyles[size].action,
                    actionColors[action.color || 'primary'],
                    action.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                  aria-label={action.tooltip || action.label}
                  title={action.tooltip || action.label}
                >
                  <action.icon className={sizeStyles[size].actionIcon} />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleMainClick}
        className={cn(
          'rounded-full flex items-center justify-center transition-all relative',
          sizeStyles[size].button,
          variantStyles[variant],
          pulse && 'animate-pulse'
        )}
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup={hasActions ? 'menu' : undefined}
      >
        {/* Pulse ring */}
        {pulse && (
          <span className="absolute inset-0 rounded-full animate-ping bg-current opacity-20" />
        )}

        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center px-1.5 text-xs font-bold text-white bg-red-500 rounded-full shadow">
            {badge > 99 ? '99+' : badge}
          </span>
        )}

        {/* Icon */}
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {isOpen && hasActions ? (
            <X className={sizeStyles[size].icon} />
          ) : (
            <MainIcon className={sizeStyles[size].icon} />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
}

// ============================================================================
// Scroll to Top FAB Variant
// ============================================================================

import { ArrowUp } from 'lucide-react';

export interface ScrollToTopButtonProps {
  /** Scroll threshold to show the button */
  threshold?: number;
  /** Smooth scroll behavior */
  smooth?: boolean;
  /** Additional class */
  className?: string;
}

export function ScrollToTopButton({
  threshold = 400,
  smooth = true,
  className,
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={scrollToTop}
          className={cn(
            'fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full',
            'bg-slate-800 hover:bg-slate-900 text-white',
            'shadow-lg shadow-slate-500/30',
            'flex items-center justify-center transition-colors',
            className
          )}
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Quick FAB - Simple single-action FAB
// ============================================================================

export interface QuickFABProps {
  icon: LucideIcon;
  onClick: () => void;
  label: string;
  variant?: 'primary' | 'secondary' | 'gradient';
  className?: string;
}

export function QuickFAB({
  icon: Icon,
  onClick,
  label,
  variant = 'primary',
  className,
}: QuickFABProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full',
        'flex items-center justify-center transition-all',
        variantStyles[variant],
        className
      )}
      aria-label={label}
    >
      <Icon className="h-6 w-6" />
    </motion.button>
  );
}

export default FloatingActionButton;
