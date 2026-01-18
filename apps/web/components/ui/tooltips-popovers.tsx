'use client';

/**
 * Tooltip & Popover Components
 * Beautiful tooltips, popovers, and contextual menus
 */

import React, { useState, useRef, useEffect, createContext, useContext, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, Circle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Enhanced Tooltip
// ============================================

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
type TooltipAlign = 'start' | 'center' | 'end';

interface EnhancedTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: TooltipPosition;
  align?: TooltipAlign;
  delay?: number;
  disabled?: boolean;
  maxWidth?: number;
  arrow?: boolean;
  variant?: 'dark' | 'light';
}

const positionStyles: Record<TooltipPosition, string> = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
  left: 'right-full mr-2',
  right: 'left-full ml-2',
};

const alignStyles: Record<TooltipPosition, Record<TooltipAlign, string>> = {
  top: { start: 'left-0', center: 'left-1/2 -translate-x-1/2', end: 'right-0' },
  bottom: { start: 'left-0', center: 'left-1/2 -translate-x-1/2', end: 'right-0' },
  left: { start: 'top-0', center: 'top-1/2 -translate-y-1/2', end: 'bottom-0' },
  right: { start: 'top-0', center: 'top-1/2 -translate-y-1/2', end: 'bottom-0' },
};

const arrowStyles: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-t-slate-900 dark:border-t-slate-700 border-x-transparent border-b-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-slate-900 dark:border-b-slate-700 border-x-transparent border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-l-slate-900 dark:border-l-slate-700 border-y-transparent border-r-transparent',
  right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-r-slate-900 dark:border-r-slate-700 border-y-transparent border-l-transparent',
};

export function EnhancedTooltip({
  content,
  children,
  position = 'top',
  align = 'center',
  delay = 300,
  disabled = false,
  maxWidth = 250,
  arrow = true,
  variant = 'dark',
}: EnhancedTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  if (disabled) return children;

  const variantStyles = {
    dark: 'bg-slate-900 text-white dark:bg-slate-700',
    light: 'bg-white text-slate-900 border border-slate-200 shadow-lg dark:bg-slate-800 dark:text-white dark:border-slate-700',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 px-3 py-2 text-sm rounded-lg pointer-events-none',
              positionStyles[position],
              alignStyles[position][align],
              variantStyles[variant]
            )}
            style={{ maxWidth }}
          >
            {content}
            {arrow && (
              <div
                className={cn(
                  'absolute w-0 h-0 border-4',
                  arrowStyles[position]
                )}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Rich Tooltip (with title, description, etc.)
// ============================================

interface RichTooltipProps {
  title: string;
  description?: string;
  shortcut?: string;
  children: React.ReactElement;
  position?: TooltipPosition;
  align?: TooltipAlign;
}

export function RichTooltip({
  title,
  description,
  shortcut,
  children,
  position = 'top',
  align = 'center',
}: RichTooltipProps) {
  return (
    <EnhancedTooltip
      position={position}
      align={align}
      maxWidth={300}
      content={
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium">{title}</span>
            {shortcut && (
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/10 rounded">
                {shortcut}
              </kbd>
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-400">{description}</p>
          )}
        </div>
      }
    >
      {children}
    </EnhancedTooltip>
  );
}

// ============================================
// Popover
// ============================================

interface PopoverProps {
  trigger: React.ReactElement<any>;
  children: React.ReactNode;
  position?: TooltipPosition;
  align?: TooltipAlign;
  width?: number | 'auto' | 'trigger';
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
}

export function Popover({
  trigger,
  children,
  position = 'bottom',
  align = 'start',
  width = 'auto',
  closeOnClickOutside = true,
  closeOnEscape = true,
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        closeOnClickOutside &&
        triggerRef.current &&
        contentRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeOnClickOutside, closeOnEscape]);

  const triggerWidth = triggerRef.current?.offsetWidth;

  return (
    <div className="relative inline-flex" ref={triggerRef}>
      {React.cloneElement(trigger, {
        onClick: () => setIsOpen(!isOpen),
        'aria-expanded': isOpen,
      })}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, y: position === 'top' ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: position === 'top' ? 10 : -10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden',
              positionStyles[position],
              alignStyles[position][align]
            )}
            style={{
              width: width === 'trigger' ? triggerWidth : width === 'auto' ? undefined : width,
              minWidth: width === 'auto' ? 200 : undefined,
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Dropdown Menu
// ============================================

interface DropdownMenuProps {
  trigger: React.ReactElement<any>;
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    shortcut?: string;
    onClick?: () => void;
    href?: string;
    disabled?: boolean;
    danger?: boolean;
    separator?: boolean;
  }>;
  position?: TooltipPosition;
  align?: TooltipAlign;
  width?: number;
}

export function DropdownMenu({
  trigger,
  items,
  position = 'bottom',
  align = 'start',
  width = 200,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const activeItems = items.filter(item => !item.separator && !item.disabled);
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % activeItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + activeItems.length) % activeItems.length);
        break;
      case 'Enter':
        if (focusedIndex >= 0) {
          activeItems[focusedIndex].onClick?.();
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <Popover
      trigger={trigger}
      position={position}
      align={align}
      width={width}
    >
      <div
        className="py-1"
        role="menu"
        onKeyDown={handleKeyDown}
      >
        {items.map((item, index) => {
          if (item.separator) {
            return <div key={index} className="my-1 h-px bg-slate-200 dark:bg-slate-700" />;
          }

          const ItemWrapper = item.href ? 'a' : 'button';
          const itemProps = item.href
            ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
            : { onClick: () => { item.onClick?.(); setIsOpen(false); } };

          return (
            <ItemWrapper
              key={index}
              {...itemProps}
              disabled={item.disabled}
              role="menuitem"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
                item.disabled
                  ? 'text-slate-400 cursor-not-allowed'
                  : item.danger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                focusedIndex === index && 'bg-slate-100 dark:bg-slate-800'
              )}
            >
              {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <kbd className="ml-auto text-[10px] font-mono text-slate-400">{item.shortcut}</kbd>
              )}
              {item.href && <ExternalLink className="w-3 h-3 text-slate-400" />}
            </ItemWrapper>
          );
        })}
      </div>
    </Popover>
  );
}

// ============================================
// Context Menu
// ============================================

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  children?: ContextMenuItem[];
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
}

export function ContextMenu({ items, children }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setIsOpen(true);
  };

  useEffect(() => {
    const handleClick = () => setIsOpen(false);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const renderItems = (menuItems: ContextMenuItem[], level = 0) => (
    <div className="py-1">
      {menuItems.map((item, index) => {
        if (item.separator) {
          return <div key={index} className="my-1 h-px bg-slate-200 dark:bg-slate-700" />;
        }

        const hasChildren = item.children && item.children.length > 0;

        return (
          <div key={index} className="relative group">
            <button
              onClick={() => !hasChildren && item.onClick?.()}
              disabled={item.disabled}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
                item.disabled
                  ? 'text-slate-400 cursor-not-allowed'
                  : item.danger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && !hasChildren && (
                <kbd className="ml-auto text-[10px] font-mono text-slate-400">{item.shortcut}</kbd>
              )}
              {hasChildren && <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {hasChildren && (
              <div className="absolute left-full top-0 ml-1 hidden group-hover:block">
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 min-w-[180px]">
                  {renderItems(item.children!, level + 1)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 min-w-[180px]"
            style={{ top: position.y, left: position.x }}
          >
            {renderItems(items)}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================
// Command Menu / Command Palette
// ============================================

interface CommandItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
  keywords?: string[];
  group?: string;
}

interface CommandMenuProps {
  items: CommandItem[];
  isOpen: boolean;
  onClose: () => void;
  placeholder?: string;
}

export function CommandMenu({
  items,
  isOpen,
  onClose,
  placeholder = 'Type a command or search...',
}: CommandMenuProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = items.filter(item => {
    const searchLower = search.toLowerCase();
    return (
      item.label.toLowerCase().includes(searchLower) ||
      item.keywords?.some(k => k.toLowerCase().includes(searchLower))
    );
  });

  // Group items
  const groupedItems = filteredItems.reduce((acc, item) => {
    const group = item.group || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].onSelect();
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-700">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="flex-1 py-4 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto p-2">
              {Object.entries(groupedItems).map(([group, groupItems]) => (
                <div key={group}>
                  <div className="px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {group}
                  </div>
                  {groupItems.map((item, index) => {
                    const globalIndex = filteredItems.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.onSelect();
                          onClose();
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                          globalIndex === selectedIndex
                            ? 'bg-slate-100 dark:bg-slate-800'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        )}
                      >
                        {item.icon && (
                          <span className="w-5 h-5 flex items-center justify-center text-slate-500">
                            {item.icon}
                          </span>
                        )}
                        <span className="flex-1 text-slate-900 dark:text-white">{item.label}</span>
                        {item.shortcut && (
                          <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
                            {item.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {filteredItems.length === 0 && (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                  No results found for &quot;{search}&quot;
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Select Menu
// ============================================

interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

interface SelectMenuProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  width?: number | 'full';
}

export function SelectMenu({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  error,
  label,
  width = 'full',
}: SelectMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div style={{ width: width === 'full' ? '100%' : width }}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      
      <Popover
        trigger={
          <button
            disabled={disabled}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-xl border transition-all',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              disabled && 'opacity-50 cursor-not-allowed',
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500',
              'bg-white dark:bg-slate-900'
            )}
          >
            {selectedOption?.icon && (
              <span className="w-5 h-5 flex-shrink-0 text-slate-500">{selectedOption.icon}</span>
            )}
            <span className={cn('flex-1', !selectedOption && 'text-slate-400')}>
              {selectedOption?.label || placeholder}
            </span>
            <motion.svg
              animate={{ rotate: isOpen ? 180 : 0 }}
              className="w-5 h-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          </button>
        }
        position="bottom"
        align="start"
        width="trigger"
      >
        <div className="py-1 max-h-60 overflow-y-auto">
          {options.map(option => (
            <button
              key={option.value}
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                option.disabled
                  ? 'text-slate-400 cursor-not-allowed'
                  : option.value === value
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              {option.icon && <span className="w-5 h-5 flex-shrink-0">{option.icon}</span>}
              <div className="flex-1">
                <div>{option.label}</div>
                {option.description && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">{option.description}</div>
                )}
              </div>
              {option.value === value && <Check className="w-4 h-4 text-blue-500" />}
            </button>
          ))}
        </div>
      </Popover>

      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export default {
  EnhancedTooltip,
  RichTooltip,
  Popover,
  DropdownMenu,
  ContextMenu,
  CommandMenu,
  SelectMenu,
};
