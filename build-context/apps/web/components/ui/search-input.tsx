"use client";

/**
 * Search Input Utilities
 * 
 * Reusable search input components and hooks with debouncing,
 * clear button, keyboard shortcuts, and consistent styling.
 */

import React, { useState, useCallback, useRef, useEffect, forwardRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";

// ============================================================================
// useDebouncedSearch Hook
// ============================================================================

export interface UseDebouncedSearchOptions {
  /** Debounce delay in ms */
  delay?: number;
  /** Minimum length before triggering search */
  minLength?: number;
  /** Callback when debounced value changes */
  onSearch?: (value: string) => void;
  /** Initial value */
  initialValue?: string;
}

export interface UseDebouncedSearchReturn {
  /** Current input value */
  value: string;
  /** Debounced value */
  debouncedValue: string;
  /** Set the input value */
  setValue: (value: string) => void;
  /** Clear the search */
  clear: () => void;
  /** Whether currently debouncing */
  isDebouncing: boolean;
  /** Whether the value meets minimum length */
  isValid: boolean;
}

export function useDebouncedSearch(
  options: UseDebouncedSearchOptions = {}
): UseDebouncedSearchReturn {
  const { delay = 300, minLength = 0, onSearch, initialValue = "" } = options;
  
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebounce(value, delay);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const previousDebounced = useRef(debouncedValue);

  const isValid = value.length >= minLength;

  // Track debouncing state
  useEffect(() => {
    if (value !== debouncedValue) {
      setIsDebouncing(true);
    } else {
      setIsDebouncing(false);
    }
  }, [value, debouncedValue]);

  // Call onSearch when debounced value changes
  useEffect(() => {
    if (debouncedValue !== previousDebounced.current) {
      previousDebounced.current = debouncedValue;
      if (debouncedValue.length >= minLength) {
        onSearch?.(debouncedValue);
      } else if (debouncedValue.length === 0) {
        onSearch?.("");
      }
    }
  }, [debouncedValue, minLength, onSearch]);

  const clear = useCallback(() => {
    setValue("");
  }, []);

  return {
    value,
    debouncedValue,
    setValue,
    clear,
    isDebouncing,
    isValid,
  };
}

// ============================================================================
// SearchInput Component
// ============================================================================

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Clear handler */
  onClear?: () => void;
  /** Show loading indicator */
  isLoading?: boolean;
  /** Keyboard shortcut to focus (e.g., "/" or "k") */
  focusKey?: string;
  /** Whether Cmd/Ctrl is required for focus key */
  focusKeyWithMeta?: boolean;
  /** Show clear button */
  showClear?: boolean;
  /** Container className */
  containerClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      isLoading = false,
      focusKey,
      focusKeyWithMeta = false,
      showClear = true,
      placeholder = "Search...",
      className,
      containerClassName,
      ...props
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const combinedRef = (node: HTMLInputElement) => {
      inputRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    // Handle keyboard shortcut
    useEffect(() => {
      if (!focusKey) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        const isMetaPressed = e.metaKey || e.ctrlKey;
        const matchesMeta = focusKeyWithMeta ? isMetaPressed : !isMetaPressed;
        
        if (e.key === focusKey && matchesMeta) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [focusKey, focusKeyWithMeta]);

    const handleClear = useCallback(() => {
      onChange("");
      onClear?.();
      inputRef.current?.focus();
    }, [onChange, onClear]);

    return (
      <div className={cn("relative", containerClassName)}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={combinedRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("pl-9 pr-9", className)}
          {...props}
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        ) : showClear && value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Clear search</span>
          </Button>
        ) : focusKey ? (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            {focusKeyWithMeta && (
              <span className="text-xs">⌘</span>
            )}
            {focusKey.toUpperCase()}
          </kbd>
        ) : null}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

// ============================================================================
// DebouncedSearchInput Component (combines hook + input)
// ============================================================================

export interface DebouncedSearchInputProps extends Omit<SearchInputProps, "value" | "onChange" | "onClear"> {
  /** Debounce delay in ms */
  debounceDelay?: number;
  /** Minimum length before triggering search */
  minLength?: number;
  /** Callback when debounced value changes */
  onSearch?: (value: string) => void;
  /** Initial value */
  initialValue?: string;
  /** Callback for immediate value changes */
  onValueChange?: (value: string) => void;
}

export const DebouncedSearchInput = forwardRef<HTMLInputElement, DebouncedSearchInputProps>(
  (
    {
      debounceDelay = 300,
      minLength = 0,
      onSearch,
      initialValue = "",
      onValueChange,
      ...props
    },
    ref
  ) => {
    const { value, setValue, clear, isDebouncing } = useDebouncedSearch({
      delay: debounceDelay,
      minLength,
      onSearch,
      initialValue,
    });

    const handleChange = useCallback((newValue: string) => {
      setValue(newValue);
      onValueChange?.(newValue);
    }, [setValue, onValueChange]);

    return (
      <SearchInput
        ref={ref}
        value={value}
        onChange={handleChange}
        onClear={clear}
        isLoading={isDebouncing}
        {...props}
      />
    );
  }
);

DebouncedSearchInput.displayName = "DebouncedSearchInput";

// ============================================================================
// FilterSearchInput Component (with filter dropdown)
// ============================================================================

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSearchInputProps extends Omit<SearchInputProps, "value" | "onChange"> {
  /** Search value */
  searchValue: string;
  /** Search change handler */
  onSearchChange: (value: string) => void;
  /** Current filter value */
  filterValue: string;
  /** Filter change handler */
  onFilterChange: (value: string) => void;
  /** Filter options */
  filterOptions: FilterOption[];
  /** Filter label */
  filterLabel?: string;
}

export function FilterSearchInput({
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
  filterOptions,
  filterLabel = "Filter",
  containerClassName,
  ...props
}: FilterSearchInputProps) {
  return (
    <div className={cn("flex gap-2", containerClassName)}>
      <div className="relative flex-1">
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          {...props}
        />
      </div>
      <select
        value={filterValue}
        onChange={(e) => onFilterChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label={filterLabel}
      >
        {filterOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default SearchInput;
