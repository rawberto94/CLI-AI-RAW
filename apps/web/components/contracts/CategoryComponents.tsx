"use client";

/**
 * Contract Category Components
 * 
 * Components for displaying and managing contract categories:
 * - CategoryBadge: Display category with color and icon
 * - CategorySelector: Dropdown to select/change category
 * - CategorySuggestions: Show AI-suggested categories
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Tag,
  Sparkles,
  ChevronRight,
  Check,
  Loader2,
  FolderTree,
  Search,
  RefreshCw,
  X,
} from "lucide-react";
import { useTaxonomyCategories } from "@/hooks/use-queries";

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
  /** Use inline mode for modal/dialog contexts - shows list directly without dropdown */
  inline?: boolean;
}

export function CategorySelector({
  value,
  onChange,
  tenantId: _tenantId = "demo",
  disabled = false,
  placeholder: _placeholder = "Select category...",
  className = "",
  inline: _inline = true,
}: CategorySelectorProps) {
  // Use React Query for automatic cache invalidation
  const { data: categories = [], isLoading, refetch: _refetch } = useTaxonomyCategories();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TaxonomyCategory | null>(null);

  // Find selected category when value or categories change
  useEffect(() => {
    if (value && categories.length > 0) {
      const found = categories.find(
        (c) => c.id === value || c.name === value
      );
      setSelectedCategory(found || null);
    } else if (!value) {
      setSelectedCategory(null);
    }
  }, [value, categories]);

  // Filter categories - memoized for performance
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.path.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

  // Group by parent for hierarchical display
  const groupedByParent = filteredCategories.reduce((acc, cat) => {
    const parentId = cat.parentId || 'root';
    if (!acc[parentId]) acc[parentId] = [];
    acc[parentId].push(cat);
    return acc;
  }, {} as Record<string, TaxonomyCategory[]>);

  // Get root categories
  const rootCategories = groupedByParent['root'] || [];

  const handleSelect = (cat: TaxonomyCategory) => {
    setSelectedCategory(cat);
    onChange(cat);
  };

  const handleClear = () => {
    setSelectedCategory(null);
    onChange(null);
  };

  // Inline mode - display list directly (for use in modals)
  return (
    <div className={`${className}`}>
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories..."
          disabled={disabled}
          className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 
                   border border-slate-200 dark:border-slate-700 rounded-xl
                   text-sm placeholder:text-slate-400
                   focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                   transition-all duration-200"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Selected Category Preview */}
      {selectedCategory && (
        <div className="mb-4 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: selectedCategory.color + '20' }}
              >
                {ICON_EMOJI[selectedCategory.icon] || "📁"}
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {selectedCategory.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedCategory.path}
                </div>
              </div>
            </div>
            <button
              onClick={handleClear}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="max-h-[320px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500 mb-3" />
            <p className="text-sm text-slate-500">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <FolderTree className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-medium text-slate-600">No categories defined</p>
            <p className="text-sm text-center px-4 mt-1">
              Set up your taxonomy in{" "}
              <a href="/settings/taxonomy" className="text-violet-500 hover:underline">
                Settings → Taxonomy
              </a>
            </p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <FolderTree className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-medium">No categories found</p>
            <p className="text-sm">Try a different search term</p>
          </div>
        ) : (
          <>
            {/* Show hierarchical or flat based on search */}
            {searchQuery ? (
              // Flat list when searching
              filteredCategories.map((cat) => (
                <CategoryItem 
                  key={cat.id} 
                  category={cat} 
                  isSelected={selectedCategory?.id === cat.id}
                  onSelect={handleSelect}
                  showPath
                />
              ))
            ) : (
              // Hierarchical when not searching
              rootCategories.map((cat) => (
                <CategoryItemWithChildren
                  key={cat.id}
                  category={cat}
                  allCategories={filteredCategories}
                  selectedId={selectedCategory?.id}
                  onSelect={handleSelect}
                  level={0}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Helper component for category items
function CategoryItem({ 
  category, 
  isSelected, 
  onSelect, 
  showPath = false,
  level = 0 
}: { 
  category: TaxonomyCategory; 
  isSelected: boolean; 
  onSelect: (cat: TaxonomyCategory) => void;
  showPath?: boolean;
  level?: number;
}) {
  return (
    <button
      onClick={() => onSelect(category)}
      className={`
        w-full flex items-center gap-3 p-3 rounded-xl text-left
        transition-all duration-200 group
        ${isSelected 
          ? "bg-violet-100 dark:bg-violet-900/30 border-2 border-violet-500" 
          : "bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
        }
      `}
      style={{ marginLeft: level * 16 }}
    >
      <div 
        className={`
          w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0
          transition-transform group-hover:scale-110
        `}
        style={{ 
          backgroundColor: category.color ? category.color + '20' : '#e2e8f0',
          color: category.color || '#64748b'
        }}
      >
        {ICON_EMOJI[category.icon] || "📁"}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${isSelected ? "text-violet-700 dark:text-violet-300" : "text-slate-900 dark:text-white"}`}>
          {category.name}
        </div>
        {(showPath || category.description) && (
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {showPath ? category.path : category.description}
          </div>
        )}
      </div>
      {isSelected && (
        <div className="shrink-0">
          <Check className="w-5 h-5 text-violet-500" />
        </div>
      )}
    </button>
  );
}

// Helper component for hierarchical display
function CategoryItemWithChildren({
  category,
  allCategories,
  selectedId,
  onSelect,
  level
}: {
  category: TaxonomyCategory;
  allCategories: TaxonomyCategory[];
  selectedId?: string;
  onSelect: (cat: TaxonomyCategory) => void;
  level: number;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 1); // Auto-expand first level
  const children = allCategories.filter(c => c.parentId === category.id);
  const hasChildren = children.length > 0;

  return (
    <div>
      <div className="flex items-center gap-1" style={{ marginLeft: level * 12 }}>
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
          >
            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        )}
        {!hasChildren && <div className="w-6" />}
        <div className="flex-1">
          <CategoryItem
            category={category}
            isSelected={selectedId === category.id}
            onSelect={onSelect}
          />
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {children.map(child => (
            <CategoryItemWithChildren
              key={child.id}
              category={child}
              allCategories={allCategories}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
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
          <Sparkles className="w-4 h-4 text-violet-400" />
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
            className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 
                     text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors"
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
                    ${index === 0 ? "bg-violet-500/20" : "bg-white/10"}
                  `}
                >
                  <Tag
                    className={`w-4 h-4 ${
                      index === 0 ? "text-violet-400" : "text-white/60"
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
                      ? "bg-violet-500/20 text-violet-400"
                      : "bg-violet-500/20 text-violet-400"
                    }
                  `}
                >
                  {suggestion.method === "ai" ? "AI" : "Keywords"}
                </span>

                {/* Select indicator */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Check className="w-4 h-4 text-violet-400" />
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
              className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 
                       text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors text-sm"
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
