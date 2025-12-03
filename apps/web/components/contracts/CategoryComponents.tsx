"use client";

/**
 * Contract Category Components
 * 
 * Components for displaying and managing contract categories:
 * - CategoryBadge: Display category with color and icon
 * - CategorySelector: Dropdown to select/change category
 * - CategorySuggestions: Show AI-suggested categories
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  Sparkles,
  ChevronDown,
  Check,
  Loader2,
  FolderTree,
  Search,
  RefreshCw,
  X,
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TaxonomyCategory {
  id: string;
  name: string;
  description?: string | null;
  path: string;
  color: string;
  icon: string;
  level: number;
  parentId?: string | null;
  children?: TaxonomyCategory[];
}

interface CategorySuggestion {
  category: string;
  categoryId: string;
  categoryPath: string;
  confidence: number;
  method: "ai" | "keyword";
}

// ============================================================================
// ICON MAP
// ============================================================================

const ICON_EMOJI: Record<string, string> = {
  folder: "📁",
  file: "📄",
  briefcase: "💼",
  building: "🏢",
  user: "👤",
  globe: "🌍",
  shield: "🛡️",
  lock: "🔒",
  key: "🔑",
  document: "📋",
  money: "💰",
  chart: "📊",
  calendar: "📅",
  lightning: "⚡",
  star: "⭐",
};

// ============================================================================
// CATEGORY BADGE
// ============================================================================

interface CategoryBadgeProps {
  category: string;
  categoryPath?: string;
  color?: string;
  icon?: string;
  size?: "sm" | "md" | "lg";
  showPath?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CategoryBadge({
  category,
  categoryPath,
  color = "#3B82F6",
  icon = "folder",
  size = "md",
  showPath = false,
  onClick,
  className = "",
}: CategoryBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  return (
    <motion.span
      whileHover={onClick ? { scale: 1.02 } : undefined}
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        transition-all duration-200
        ${sizeClasses[size]}
        ${onClick ? "cursor-pointer hover:shadow-lg" : ""}
        ${className}
      `}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        borderColor: `${color}40`,
        borderWidth: 1,
      }}
    >
      <span className="text-base">{ICON_EMOJI[icon] || "📁"}</span>
      <span>{category}</span>
      {showPath && categoryPath && categoryPath !== `/${category}` && (
        <span className="opacity-60 text-xs">({categoryPath})</span>
      )}
    </motion.span>
  );
}

// ============================================================================
// CATEGORY SELECTOR
// ============================================================================

interface CategorySelectorProps {
  value: string | null;
  onChange: (category: TaxonomyCategory | null) => void;
  tenantId?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function CategorySelector({
  value,
  onChange,
  tenantId = "demo",
  disabled = false,
  placeholder = "Select category...",
  className = "",
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TaxonomyCategory | null>(null);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/taxonomy?flat=true", {
          headers: { "x-tenant-id": tenantId },
        });

        if (response.ok) {
          const data = await response.json();
          setCategories(data.data || []);

          // Find selected category by name
          if (value) {
            const found = data.data?.find(
              (c: TaxonomyCategory) => c.name === value
            );
            setSelectedCategory(found || null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && categories.length === 0) {
      fetchCategories();
    }
  }, [isOpen, tenantId, value, categories.length]);

  // Filter categories
  const filteredCategories = searchQuery
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.path.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories;

  // Group by level for display
  const groupedCategories = filteredCategories.reduce((acc, cat) => {
    const level = cat.level || 0;
    if (!acc[level]) acc[level] = [];
    acc[level].push(cat);
    return acc;
  }, {} as Record<number, TaxonomyCategory[]>);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-white/5 border border-white/10 rounded-xl
          transition-all duration-200
          ${disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-white/10 hover:border-white/20"
          }
          ${isOpen ? "ring-2 ring-blue-500/50" : ""}
        `}
      >
        {selectedCategory ? (
          <CategoryBadge
            category={selectedCategory.name}
            color={selectedCategory.color}
            icon={selectedCategory.icon}
            size="sm"
          />
        ) : (
          <span className="text-white/50">{placeholder}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-white/50 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 z-50
                       bg-slate-900 border border-white/10 rounded-xl shadow-xl
                       overflow-hidden"
            >
              {/* Search */}
              <div className="p-2 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg
                             text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="max-h-64 overflow-y-auto p-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="text-center py-8 text-white/50">
                    <FolderTree className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No categories found</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Clear option */}
                    {selectedCategory && (
                      <button
                        onClick={() => {
                          setSelectedCategory(null);
                          onChange(null);
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left
                                 hover:bg-white/10 rounded-lg text-sm text-white/60"
                      >
                        <X className="w-4 h-4" />
                        Clear selection
                      </button>
                    )}

                    {/* Categories by level */}
                    {Object.entries(groupedCategories)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([level, cats]) => (
                        <div key={level}>
                          {Number(level) > 0 && (
                            <div className="px-3 py-1 text-xs text-white/40 font-medium">
                              Level {Number(level) + 1}
                            </div>
                          )}
                          {cats.map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() => {
                                setSelectedCategory(cat);
                                onChange(cat);
                                setIsOpen(false);
                              }}
                              className={`
                                w-full flex items-center justify-between gap-2 px-3 py-2
                                hover:bg-white/10 rounded-lg transition-colors
                                ${selectedCategory?.id === cat.id ? "bg-blue-500/20" : ""}
                              `}
                              style={{ paddingLeft: `${12 + Number(level) * 16}px` }}
                            >
                              <div className="flex items-center gap-2">
                                <span>{ICON_EMOJI[cat.icon] || "📁"}</span>
                                <div className="text-left">
                                  <div className="font-medium">{cat.name}</div>
                                  {cat.description && (
                                    <div className="text-xs text-white/50 truncate max-w-[200px]">
                                      {cat.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {selectedCategory?.id === cat.id && (
                                <Check className="w-4 h-4 text-blue-400" />
                              )}
                            </button>
                          ))}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// CATEGORY SUGGESTIONS
// ============================================================================

interface CategorySuggestionsProps {
  contractId: string;
  tenantId?: string;
  onSelect: (category: string, categoryId: string) => void;
  onCategorize?: () => void;
  className?: string;
}

export function CategorySuggestions({
  contractId,
  tenantId = "demo",
  onSelect,
  onCategorize,
  className = "",
}: CategorySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch suggestions
  const fetchSuggestions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/contracts/categorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ contractId }),
      });

      if (!response.ok) {
        throw new Error("Failed to get suggestions");
      }

      const data = await response.json();

      if (data.success && data.data) {
        // If contract was categorized, show result
        if (data.data.category) {
          setSuggestions([
            {
              category: data.data.category,
              categoryId: data.data.categoryId || "",
              categoryPath: data.data.categoryPath || "",
              confidence: data.data.confidence,
              method: data.data.method,
            },
            ...data.data.alternativeCategories.map((alt: any) => ({
              category: alt.category,
              categoryId: alt.categoryId,
              categoryPath: "",
              confidence: alt.confidence,
              method: "ai" as const,
            })),
          ]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suggestions");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-categorize
  const handleCategorize = async () => {
    try {
      setIsCategorizing(true);

      const response = await fetch("/api/contracts/categorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          contractId,
          forceRecategorize: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Categorization failed");
      }

      const data = await response.json();

      if (data.success && data.data?.category) {
        onSelect(data.data.category, data.data.categoryId || "");
        onCategorize?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Categorization failed");
    } finally {
      setIsCategorizing(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [contractId]);

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="w-4 h-4 text-purple-400" />
          AI Category Suggestions
        </div>
        <button
          onClick={fetchSuggestions}
          disabled={isLoading}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 text-white/50 ${isLoading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-white/50 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analyzing contract...
        </div>
      ) : error ? (
        <div className="text-sm text-red-400">{error}</div>
      ) : suggestions.length === 0 ? (
        <div className="text-sm text-white/50">
          <p>No suggestions available yet.</p>
          <button
            onClick={handleCategorize}
            disabled={isCategorizing}
            className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 
                     text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
          >
            {isCategorizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Auto-Categorize
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={suggestion.categoryId || index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelect(suggestion.category, suggestion.categoryId)}
              className="w-full flex items-center justify-between gap-3 p-3
                       bg-white/5 hover:bg-white/10 border border-white/10
                       rounded-xl transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`
                    p-2 rounded-lg
                    ${index === 0 ? "bg-purple-500/20" : "bg-white/10"}
                  `}
                >
                  <Tag
                    className={`w-4 h-4 ${
                      index === 0 ? "text-purple-400" : "text-white/60"
                    }`}
                  />
                </div>
                <div>
                  <div className="font-medium">{suggestion.category}</div>
                  {suggestion.categoryPath && (
                    <div className="text-xs text-white/50">{suggestion.categoryPath}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Confidence */}
                <div
                  className={`
                    px-2 py-0.5 rounded text-xs font-medium
                    ${suggestion.confidence >= 80
                      ? "bg-green-500/20 text-green-400"
                      : suggestion.confidence >= 60
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-white/10 text-white/60"
                    }
                  `}
                >
                  {suggestion.confidence}%
                </div>

                {/* Method */}
                <span
                  className={`
                    px-2 py-0.5 rounded text-xs
                    ${suggestion.method === "ai"
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-blue-500/20 text-blue-400"
                    }
                  `}
                >
                  {suggestion.method === "ai" ? "AI" : "Keywords"}
                </span>

                {/* Select indicator */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Check className="w-4 h-4 text-blue-400" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CATEGORY OVERVIEW CARD
// ============================================================================

interface CategoryOverviewProps {
  category: string | null;
  categoryPath?: string | null;
  color?: string;
  icon?: string;
  onEdit?: () => void;
  onRecategorize?: () => void;
  className?: string;
}

export function CategoryOverview({
  category,
  categoryPath,
  color = "#3B82F6",
  icon = "folder",
  onEdit,
  onRecategorize,
  className = "",
}: CategoryOverviewProps) {
  if (!category) {
    return (
      <div
        className={`
          p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl
          ${className}
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Tag className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <p className="text-sm text-white/50">Category</p>
              <p className="font-medium text-white/60">Not categorized</p>
            </div>
          </div>

          {onRecategorize && (
            <button
              onClick={onRecategorize}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 
                       text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm"
            >
              <Sparkles className="w-4 h-4" />
              Categorize
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        p-4 backdrop-blur-sm border rounded-xl
        ${className}
      `}
      style={{
        backgroundColor: `${color}10`,
        borderColor: `${color}30`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <span className="text-xl">{ICON_EMOJI[icon] || "📁"}</span>
          </div>
          <div>
            <p className="text-sm" style={{ color: `${color}80` }}>
              Category
            </p>
            <p className="font-semibold" style={{ color }}>
              {category}
            </p>
            {categoryPath && categoryPath !== `/${category}` && (
              <p className="text-xs mt-0.5" style={{ color: `${color}60` }}>
                {categoryPath}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Change category"
            >
              <Tag className="w-4 h-4" style={{ color: `${color}80` }} />
            </button>
          )}
          {onRecategorize && (
            <button
              onClick={onRecategorize}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Re-categorize with AI"
            >
              <RefreshCw className="w-4 h-4" style={{ color: `${color}80` }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CategoryBadge;
