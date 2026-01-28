'use client';

/**
 * Dropdown Menu Component
 * Customizable dropdown menus with keyboard support
 */

import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface DropdownContextType {
  isOpen: boolean;
  close: () => void;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

interface DropdownMenuProps {
  children: React.ReactNode;
  trigger: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  side?: 'top' | 'bottom';
  width?: number | 'auto' | 'trigger';
  className?: string;
}

interface DropdownItemProps {
  children: React.ReactNode;
  icon?: LucideIcon;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  className?: string;
}

interface DropdownCheckboxItemProps {
  children: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

interface DropdownSubmenuProps {
  children: React.ReactNode;
  trigger: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

// ============================================================================
// Context
// ============================================================================

const DropdownContext = createContext<DropdownContextType | null>(null);

function useDropdown() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown components must be used within DropdownMenu');
  }
  return context;
}

// ============================================================================
// Main Dropdown Menu
// ============================================================================

export function DropdownMenu({
  children,
  trigger,
  align = 'left',
  side = 'bottom',
  width = 'auto',
  className,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const alignClasses = {
    left: 'left-0',
    right: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  };

  const sideClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
  };

  const triggerWidth = triggerRef.current?.offsetWidth;

  return (
    <DropdownContext.Provider
      value={{ isOpen, close: () => setIsOpen(false), activeIndex, setActiveIndex }}
    >
      <div className={cn('relative inline-block', className)}>
        <div
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          className="cursor-pointer"
        >
          {trigger}
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? -8 : 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? -8 : 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={cn(
                'absolute z-50 bg-white rounded-xl border border-slate-200 shadow-lg py-1 overflow-hidden',
                alignClasses[align],
                sideClasses[side]
              )}
              style={{
                width: width === 'trigger' ? triggerWidth : width === 'auto' ? 'auto' : width,
                minWidth: 180,
              }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DropdownContext.Provider>
  );
}

// ============================================================================
// Dropdown Item
// ============================================================================

export function DropdownItem({
  children,
  icon: Icon,
  shortcut,
  onClick,
  disabled = false,
  destructive = false,
  className,
}: DropdownItemProps) {
  const { close } = useDropdown();

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    close();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : destructive
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-700 hover:bg-slate-50',
        className
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            'w-4 h-4',
            destructive ? 'text-red-500' : 'text-slate-400'
          )}
        />
      )}
      <span className="flex-1">{children}</span>
      {shortcut && (
        <kbd className="text-xs text-slate-400 font-mono">{shortcut}</kbd>
      )}
    </button>
  );
}

// ============================================================================
// Dropdown Checkbox Item
// ============================================================================

export function DropdownCheckboxItem({
  children,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: DropdownCheckboxItemProps) {
  return (
    <button
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50',
        className
      )}
    >
      <div
        className={cn(
          'w-4 h-4 rounded border flex items-center justify-center transition-colors',
          checked
            ? 'bg-purple-600 border-purple-600'
            : 'border-slate-300'
        )}
      >
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
      <span className="flex-1">{children}</span>
    </button>
  );
}

// ============================================================================
// Dropdown Separator
// ============================================================================

export function DropdownSeparator() {
  return <div className="h-px bg-slate-100 my-1" />;
}

// ============================================================================
// Dropdown Label
// ============================================================================

interface DropdownLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function DropdownLabel({ children, className }: DropdownLabelProps) {
  return (
    <div
      className={cn(
        'px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Dropdown Submenu
// ============================================================================

export function DropdownSubmenu({
  children,
  trigger,
  icon: Icon,
  className,
}: DropdownSubmenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 transition-colors',
          className
        )}
      >
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <span className="flex-1">{trigger}</span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full top-0 ml-1 bg-white rounded-xl border border-slate-200 shadow-lg py-1 min-w-[160px]"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Context Menu (Right-click menu)
// ============================================================================

interface ContextMenuProps {
  children: React.ReactNode;
  menu: React.ReactNode;
}

export function ContextMenu({ children, menu }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setIsOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <DropdownContext.Provider
      value={{
        isOpen,
        close: () => setIsOpen(false),
        activeIndex: -1,
        setActiveIndex: () => {},
      }}
    >
      <div onContextMenu={handleContextMenu}>{children}</div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 bg-white rounded-xl border border-slate-200 shadow-lg py-1 min-w-[180px]"
            style={{ left: position.x, top: position.y }}
          >
            {menu}
          </motion.div>
        )}
      </AnimatePresence>
    </DropdownContext.Provider>
  );
}
