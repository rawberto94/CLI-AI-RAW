'use client';

/**
 * Tooltips & Popovers
 * Beautiful, accessible tooltips and popovers with animations
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: Placement;
  delay?: number;
  disabled?: boolean;
  className?: string;
}

interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  placement?: Placement;
  className?: string;
  contentClassName?: string;
  closeOnClick?: boolean;
}

// ============================================================================
// Placement Styles
// ============================================================================

const PLACEMENTS: Record<Placement, { 
  position: string; 
  arrow: string;
  initial: { x?: number; y?: number };
}> = {
  top: {
    position: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    arrow: 'top-full left-1/2 -translate-x-1/2 border-t-slate-900 border-x-transparent border-b-transparent',
    initial: { y: 5 },
  },
  bottom: {
    position: 'top-full left-1/2 -translate-x-1/2 mt-2',
    arrow: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-900 border-x-transparent border-t-transparent',
    initial: { y: -5 },
  },
  left: {
    position: 'right-full top-1/2 -translate-y-1/2 mr-2',
    arrow: 'left-full top-1/2 -translate-y-1/2 border-l-slate-900 border-y-transparent border-r-transparent',
    initial: { x: 5 },
  },
  right: {
    position: 'left-full top-1/2 -translate-y-1/2 ml-2',
    arrow: 'right-full top-1/2 -translate-y-1/2 border-r-slate-900 border-y-transparent border-l-transparent',
    initial: { x: -5 },
  },
};

// ============================================================================
// Tooltip Component
// ============================================================================

export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 200,
  disabled = false,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const placementStyles = PLACEMENTS[placement];

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  }, [delay, disabled]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div key="visible"
            initial={{ opacity: 0, ...placementStyles.initial }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, ...placementStyles.initial }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 pointer-events-none',
              placementStyles.position
            )}
          >
            <div className={cn(
              'px-3 py-1.5 text-sm text-white bg-slate-900 rounded-lg shadow-lg',
              'whitespace-nowrap',
              className
            )}>
              {content}
            </div>
            {/* Arrow */}
            <div className={cn(
              'absolute border-4',
              placementStyles.arrow
            )} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Rich Tooltip (with more content)
// ============================================================================

interface RichTooltipProps extends Omit<TooltipProps, 'content'> {
  title?: string;
  description: string;
  shortcut?: string[];
}

export function RichTooltip({
  title,
  description,
  shortcut,
  children,
  ...props
}: RichTooltipProps) {
  return (
    <Tooltip
      {...props}
      content={
        <div className="max-w-xs">
          {title && <p className="font-semibold mb-0.5">{title}</p>}
          <p className="text-slate-300 text-xs">{description}</p>
          {shortcut && (
            <div className="flex items-center gap-1 mt-2">
              {shortcut.map((key, i) => (
                <kbd key={i} className="px-1.5 py-0.5 text-[10px] bg-slate-800 rounded">
                  {key}
                </kbd>
              ))}
            </div>
          )}
        </div>
      }
    >
      {children}
    </Tooltip>
  );
}

// ============================================================================
// Popover Component
// ============================================================================

export function Popover({
  trigger,
  content,
  placement = 'bottom',
  className,
  contentClassName,
  closeOnClick = true,
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const placementStyles = PLACEMENTS[placement];

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div key="open"
            initial={{ opacity: 0, scale: 0.95, ...placementStyles.initial }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, ...placementStyles.initial }}
            transition={{ duration: 0.15 }}
            onClick={closeOnClick ? () => setIsOpen(false) : undefined}
            className={cn(
              'absolute z-50',
              placementStyles.position,
              contentClassName
            )}
          >
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Info Popover (pre-styled)
// ============================================================================

interface InfoPopoverProps {
  title: string;
  description: string;
  children: React.ReactNode;
  placement?: Placement;
}

export function InfoPopover({ title, description, children, placement = 'bottom' }: InfoPopoverProps) {
  return (
    <Popover
      trigger={children}
      placement={placement}
      closeOnClick={false}
      content={
        <div className="p-4 max-w-xs">
          <h4 className="font-semibold text-slate-900 mb-1">{title}</h4>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
      }
    />
  );
}

// ============================================================================
// Action Popover (dropdown menu style)
// ============================================================================

interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionPopoverProps {
  trigger: React.ReactNode;
  actions: ActionItem[];
  placement?: Placement;
}

export function ActionPopover({ trigger, actions, placement = 'bottom' }: ActionPopoverProps) {
  return (
    <Popover
      trigger={trigger}
      placement={placement}
      content={
        <div className="py-1 min-w-[160px]">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-2 text-sm text-left',
                'transition-colors',
                action.disabled && 'opacity-50 cursor-not-allowed',
                action.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      }
    />
  );
}

// ============================================================================
// Hover Card (preview card on hover)
// ============================================================================

interface HoverCardProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  delay?: number;
  placement?: Placement;
}

export function HoverCard({ trigger, content, delay = 500, placement = 'bottom' }: HoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const placementStyles = PLACEMENTS[placement];

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(true), delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {trigger}
      <AnimatePresence>
        {isOpen && (
          <motion.div key="open"
            initial={{ opacity: 0, scale: 0.95, ...placementStyles.initial }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'absolute z-50',
              placementStyles.position
            )}
          >
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden min-w-[280px]">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
