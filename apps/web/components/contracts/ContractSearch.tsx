"use client";

import { Search, X, Loader2, Clock, TrendingUp } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useContractSearch } from "@/lib/contracts/search";
import { fadeIn } from "@/lib/contracts/animations";
import { cn } from "@/lib/utils";
import { useOnClickOutsideMultiple } from "@/hooks/useEventListener";

export interface ContractSearchProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  showSuggestions?: boolean;
  showRecentSearches?: boolean;
  className?: string;
}

export function ContractSearch({
  onSearch,
  placeholder = "Search contracts...",
  showSuggestions = true,
  showRecentSearches = true,
  className,
}: ContractSearchProps) {
  // Framer Motion typing workaround for React 19
  const MotionButton = motion.button as any;
  const MotionDiv = motion.div as any;
  const {
    query,
    isLoading,
    suggestions,
    recentSearches,
    setQuery,
    getSuggestions,
    clearSearch,
  } = useContractSearch();

  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  // Handle click outside to close dropdown
  const handleClickOutside = useCallback(() => {
    setShowDropdown(false);
  }, []);
  
  useOnClickOutsideMultiple([dropdownRef, inputRef], handleClickOutside);

  // Get suggestions when query changes
  useEffect(() => {
    if (query.length > 2 && showSuggestions) {
      getSuggestions(query);
    }
  }, [query, showSuggestions, getSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowDropdown(true);
    onSearch?.(value);
  };

  const handleClear = () => {
    clearSearch();
    setShowDropdown(false);
    inputRef.current?.focus();
    onSearch?.("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowDropdown(false);
    onSearch?.(suggestion);
  };

  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
    setShowDropdown(false);
    onSearch?.(search);
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (query.length === 0 && recentSearches.length > 0 && showRecentSearches) {
      setShowDropdown(true);
    } else if (query.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Delay to allow click on dropdown items
    blurTimeoutRef.current = setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        setShowDropdown(false);
      }
    }, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  const hasDropdownContent =
    (showSuggestions && suggestions.length > 0) ||
    (showRecentSearches && recentSearches.length > 0 && query.length === 0);

  return (
    <div className={cn("relative w-full", className)}>
      {/* Search Input */}
      <div
        className={cn(
          "relative flex items-center",
          "bg-white border rounded-lg transition-all duration-200",
          isFocused
            ? "border-violet-500 ring-2 ring-violet-100"
            : "border-gray-300 hover:border-gray-400"
        )}
      >
        {/* Search Icon */}
        <div className="absolute left-3 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full pl-10 pr-20 py-2.5 text-sm",
            "bg-transparent outline-none",
            "placeholder:text-gray-400"
          )}
          role="combobox"
          aria-label="Search contracts"
          aria-autocomplete="list"
          aria-controls="search-dropdown"
          aria-expanded={showDropdown}
        />

        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute right-12 flex items-center">
            <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
          </div>
        )}

        {/* Clear Button */}
        {query.length > 0 && (
          <MotionButton
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleClear}
            className={cn(
              "absolute right-3 p-1.5 rounded-md",
              "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
              "transition-colors duration-150"
            )}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </MotionButton>
        )}
      </div>

      {/* Dropdown with Suggestions and Recent Searches */}
      <AnimatePresence>
        {showDropdown && hasDropdownContent && (
          <MotionDiv key="dropdown"
            ref={dropdownRef}
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            id="search-dropdown"
            className={cn(
              "absolute top-full left-0 right-0 mt-2 z-50",
              "bg-white border border-gray-200 rounded-lg shadow-lg",
              "max-h-80 overflow-y-auto"
            )}
            role="listbox"
          >
            {/* Recent Searches */}
            {showRecentSearches &&
              recentSearches.length > 0 &&
              query.length === 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    <Clock className="w-3.5 h-3.5" />
                    Recent Searches
                  </div>
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecentSearchClick(search)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md",
                        "text-sm text-left text-gray-700",
                        "hover:bg-gray-50 transition-colors"
                      )}
                      role="option"
                      aria-selected={false}
                    >
                      <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{search}</span>
                    </button>
                  ))}
                </div>
              )}

            {/* Suggestions */}
            {showSuggestions && suggestions.length > 0 && query.length > 0 && (
              <div className="p-2">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Suggestions
                </div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md",
                      "text-sm text-left text-gray-700",
                      "hover:bg-violet-50 transition-colors"
                    )}
                    role="option"
                    aria-selected={false}
                  >
                    <Search className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <span className="truncate">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {query.length > 0 && suggestions.length === 0 && !isLoading && (
              <div className="p-4 text-center text-sm text-gray-500">
                No suggestions found
              </div>
            )}
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcut Hint */}
      {!isFocused && query.length === 0 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded">
            <span>/</span>
          </kbd>
        </div>
      )}
    </div>
  );
}
