/**
 * Command Component
 * Keyboard-accessible command palette with search and navigation
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  shouldFilter?: boolean;
  loop?: boolean;
}

interface CommandContextValue {
  search: string;
  setSearch: (search: string) => void;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  items: string[];
  registerItem: (id: string) => void;
  unregisterItem: (id: string) => void;
}

const CommandContext = React.createContext<CommandContextValue | null>(null);

function useCommand() {
  const context = React.useContext(CommandContext);
  if (!context) {
    throw new Error('useCommand must be used within Command');
  }
  return context;
}

export function Command({ 
  children, 
  className,
  shouldFilter = true,
  loop = true,
  ...props 
}: CommandProps) {
  const [search, setSearch] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [items, setItems] = React.useState<string[]>([]);

  const registerItem = React.useCallback((id: string) => {
    setItems(prev => [...prev, id]);
  }, []);

  const unregisterItem = React.useCallback((id: string) => {
    setItems(prev => prev.filter(item => item !== id));
  }, []);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    const itemCount = items.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev + 1;
          return loop ? next % itemCount : Math.min(next, itemCount - 1);
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = prev - 1;
          return loop ? (next + itemCount) % itemCount : Math.max(next, 0);
        });
        break;
      case 'Home':
        e.preventDefault();
        setSelectedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setSelectedIndex(itemCount - 1);
        break;
    }
  }, [items.length, loop]);

  const contextValue = React.useMemo(() => ({
    search,
    setSearch,
    selectedIndex,
    setSelectedIndex,
    items,
    registerItem,
    unregisterItem,
  }), [search, selectedIndex, items, registerItem, unregisterItem]);

  return (
    <CommandContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg",
          className
        )}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  );
}

interface CommandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void;
}

export function CommandInput({ 
  className, 
  onValueChange,
  ...props 
}: CommandInputProps) {
  const { search, setSearch, setSelectedIndex } = useCommand();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    setSelectedIndex(0);
    onValueChange?.(value);
  };

  return (
    <div className="flex items-center border-b border-slate-200 dark:border-slate-700 px-3">
      <Search className="h-4 w-4 text-slate-400 shrink-0" />
      <input
        className={cn(
          "flex h-11 w-full bg-transparent py-3 px-2 text-sm placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={search}
        onChange={handleChange}
        {...props}
      />
      {search && (
        <button 
          onClick={() => { setSearch(''); setSelectedIndex(0); }}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
        >
          <X className="h-3.5 w-3.5 text-slate-400" />
        </button>
      )}
    </div>
  );
}

interface CommandListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CommandList({ children, className, ...props }: CommandListProps) {
  return (
    <div
      className={cn(
        "max-h-[300px] overflow-y-auto overflow-x-hidden",
        className
      )}
      role="listbox"
      {...props}
    >
      {children}
    </div>
  );
}

interface CommandEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CommandEmpty({ children, className, ...props }: CommandEmptyProps) {
  const { search, items } = useCommand();
  
  // Only show if search is active and no items match
  if (!search || items.length > 0) return null;

  return (
    <div
      className={cn(
        "py-6 text-center text-sm text-slate-500",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  heading?: string;
}

export function CommandGroup({ children, heading, className, ...props }: CommandGroupProps) {
  return (
    <div
      className={cn("overflow-hidden p-1", className)}
      role="group"
      aria-label={heading}
      {...props}
    >
      {heading && (
        <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {heading}
        </div>
      )}
      {children}
    </div>
  );
}

interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  value?: string;
  disabled?: boolean;
  onSelect?: () => void;
  keywords?: string[];
}

export function CommandItem({ 
  children, 
  className, 
  value,
  disabled,
  onSelect,
  keywords = [],
  ...props 
}: CommandItemProps) {
  const { search, selectedIndex, items, registerItem, unregisterItem } = useCommand();
  const id = React.useId();
  const itemRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    registerItem(id);
    return () => unregisterItem(id);
  }, [id, registerItem, unregisterItem]);

  const itemIndex = items.indexOf(id);
  const isSelected = itemIndex === selectedIndex;

  // Filter based on search
  const searchLower = search.toLowerCase();
  const valueLower = (value || '').toLowerCase();
  const childrenText = typeof children === 'string' ? children.toLowerCase() : '';
  const keywordsLower = keywords.map(k => k.toLowerCase());
  
  const isVisible = !search || 
    valueLower.includes(searchLower) || 
    childrenText.includes(searchLower) ||
    keywordsLower.some(k => k.includes(searchLower));

  // Scroll into view when selected
  React.useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  const handleClick = () => {
    if (!disabled && onSelect) {
      onSelect();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isSelected && !disabled && onSelect) {
      e.preventDefault();
      onSelect();
    }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={itemRef}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none transition-colors",
        isSelected && "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white",
        disabled && "pointer-events-none opacity-50",
        !isSelected && !disabled && "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50",
        className
      )}
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isSelected ? 0 : -1}
      {...props}
    >
      {children}
    </div>
  );
}

interface CommandSeparatorProps extends React.HTMLAttributes<HTMLHRElement> {}

export function CommandSeparator({ className, ...props }: CommandSeparatorProps) {
  return (
    <hr
      className={cn(
        "mx-1 my-1 h-px bg-slate-200 dark:bg-slate-700",
        className
      )}
      {...props}
    />
  );
}

interface CommandShortcutProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function CommandShortcut({ children, className, ...props }: CommandShortcutProps) {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-slate-400",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function CommandDialog({ open, onOpenChange, children }: CommandDialogProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg">
        <Command className="shadow-2xl">
          {children}
        </Command>
      </div>
    </div>
  );
}
