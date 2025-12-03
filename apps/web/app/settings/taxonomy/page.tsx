"use client";

/**
 * Taxonomy Management Page
 * 
 * Manage client-specific contract categories with:
 * - Hierarchical tree view
 * - CRUD operations
 * - Keyword management for auto-classification
 * - AI classification prompts
 * - Color and icon customization
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  FolderTree,
  Tag,
  Sparkles,
  Save,
  X,
  GripVertical,
  Search,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Settings2,
  Palette,
  Type,
  Lightbulb,
  BarChart3,
  Download,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TaxonomyCategory {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  level: number;
  path: string;
  keywords: string[];
  aiClassificationPrompt?: string | null;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  contractCount?: number;
  children?: TaxonomyCategory[];
}

interface CategoryFormData {
  name: string;
  description: string;
  parentId: string | null;
  keywords: string[];
  aiClassificationPrompt: string;
  color: string;
  icon: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ICON_OPTIONS = [
  { value: "folder", label: "Folder", icon: "📁" },
  { value: "file", label: "File", icon: "📄" },
  { value: "briefcase", label: "Briefcase", icon: "💼" },
  { value: "building", label: "Building", icon: "🏢" },
  { value: "user", label: "User", icon: "👤" },
  { value: "globe", label: "Globe", icon: "🌍" },
  { value: "shield", label: "Shield", icon: "🛡️" },
  { value: "lock", label: "Lock", icon: "🔒" },
  { value: "key", label: "Key", icon: "🔑" },
  { value: "document", label: "Document", icon: "📋" },
  { value: "money", label: "Money", icon: "💰" },
  { value: "chart", label: "Chart", icon: "📊" },
  { value: "calendar", label: "Calendar", icon: "📅" },
  { value: "lightning", label: "Lightning", icon: "⚡" },
  { value: "star", label: "Star", icon: "⭐" },
];

const COLOR_OPTIONS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#14B8A6", // Teal
  "#A855F7", // Violet
];

const DEFAULT_FORM_DATA: CategoryFormData = {
  name: "",
  description: "",
  parentId: null,
  keywords: [],
  aiClassificationPrompt: "",
  color: "#3B82F6",
  icon: "folder",
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function CategoryIcon({ icon, color }: { icon: string; color: string }) {
  const iconData = ICON_OPTIONS.find((i) => i.value === icon);
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded text-sm"
      style={{ backgroundColor: `${color}20` }}
    >
      {iconData?.icon || "📁"}
    </span>
  );
}

function KeywordInput({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addKeyword = () => {
    if (input.trim() && !keywords.includes(input.trim())) {
      onChange([...keywords, input.trim()]);
      setInput("");
    }
  };

  const removeKeyword = (keyword: string) => {
    onChange(keywords.filter((k) => k !== keyword));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
          placeholder="Add keyword..."
          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900
                     focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
        />
        <button
          type="button"
          onClick={addKeyword}
          className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200
                     transition-colors text-sm font-medium"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <span
            key={keyword}
            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs"
          >
            <Tag className="w-3 h-3" />
            {keyword}
            <button
              type="button"
              onClick={() => removeKeyword(keyword)}
              className="ml-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-slate-400 text-xs">No keywords yet</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CATEGORY TREE NODE
// ============================================================================

function CategoryTreeNode({
  category,
  level = 0,
  onEdit,
  onDelete,
  onAddChild,
  selectedId,
  onSelect,
}: {
  category: TaxonomyCategory;
  level?: number;
  onEdit: (category: TaxonomyCategory) => void;
  onDelete: (category: TaxonomyCategory) => void;
  onAddChild: (parentId: string) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = category.children && category.children.length > 0;
  const isSelected = selectedId === category.id;

  return (
    <div className="select-none">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={`
          group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
          transition-all duration-200
          ${isSelected
            ? "bg-blue-50 border border-blue-300"
            : "hover:bg-slate-100 border border-transparent"
          }
        `}
        style={{ marginLeft: level * 20 }}
        onClick={() => onSelect(isSelected ? null : category.id)}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={`
            w-5 h-5 flex items-center justify-center rounded
            ${hasChildren ? "hover:bg-slate-200" : "invisible"}
          `}
        >
          {hasChildren &&
            (isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            ))}
        </button>

        {/* Icon */}
        <CategoryIcon icon={category.icon} color={category.color} />

        {/* Name & Count */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{category.name}</span>
            {category.contractCount !== undefined && category.contractCount > 0 && (
              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-600">
                {category.contractCount}
              </span>
            )}
          </div>
          {category.description && (
            <p className="text-xs text-slate-500 truncate">{category.description}</p>
          )}
        </div>

        {/* Keywords indicator */}
        {category.keywords.length > 0 && (
          <div className="flex items-center gap-1 text-slate-400">
            <Tag className="w-3 h-3" />
            <span className="text-xs">{category.keywords.length}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(category.id);
            }}
            className="p-1 hover:bg-slate-200 rounded"
            title="Add sub-category"
          >
            <Plus className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(category);
            }}
            className="p-1 hover:bg-slate-200 rounded"
            title="Edit"
          >
            <Pencil className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(category);
            }}
            className="p-1 hover:bg-red-100 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {category.children!.map((child) => (
              <CategoryTreeNode
                key={child.id}
                category={child}
                level={level + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// CATEGORY FORM MODAL
// ============================================================================

function CategoryFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  parentCategory,
  isEditing,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  initialData?: CategoryFormData;
  parentCategory?: TaxonomyCategory | null;
  isEditing: boolean;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CategoryFormData>(
    initialData || { ...DEFAULT_FORM_DATA, parentId: parentCategory?.id || null }
  );

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({ ...DEFAULT_FORM_DATA, parentId: parentCategory?.id || null });
    }
  }, [initialData, parentCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white 
                   rounded-xl shadow-xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                {isEditing ? (
                  <Pencil className="w-5 h-5 text-blue-600" />
                ) : (
                  <Plus className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg text-slate-900">
                  {isEditing ? "Edit Category" : "New Category"}
                </h3>
                {parentCategory && (
                  <p className="text-sm text-slate-500">
                    Under: {parentCategory.name}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Professional Services"
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-slate-900"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this category..."
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none text-slate-900"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" />
                Keywords for Auto-Classification
              </div>
            </label>
            <KeywordInput
              keywords={formData.keywords}
              onChange={(keywords) => setFormData({ ...formData, keywords })}
            />
            <p className="text-xs text-slate-500 mt-1">
              Contracts containing these keywords will be auto-categorized here
            </p>
          </div>

          {/* AI Prompt */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                AI Classification Hint
              </div>
            </label>
            <textarea
              value={formData.aiClassificationPrompt}
              onChange={(e) =>
                setFormData({ ...formData, aiClassificationPrompt: e.target.value })
              }
              placeholder="e.g., This category includes contracts for consulting, staffing, and professional services..."
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-none text-slate-900"
            />
            <p className="text-xs text-slate-500 mt-1">
              Helps AI better understand what contracts belong in this category
            </p>
          </div>

          {/* Color & Icon */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Color
                </div>
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`
                      w-7 h-7 rounded-full transition-all
                      ${formData.color === color
                        ? "ring-2 ring-slate-900 ring-offset-2 ring-offset-white"
                        : "hover:scale-110"
                      }
                    `}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Icon
                </div>
              </label>
              <div className="flex flex-wrap gap-1">
                {ICON_OPTIONS.slice(0, 10).map((iconOption) => (
                  <button
                    key={iconOption.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: iconOption.value })}
                    className={`
                      w-8 h-8 rounded-lg transition-all text-lg
                      ${formData.icon === iconOption.value
                        ? "bg-blue-100 ring-1 ring-blue-400"
                        : "hover:bg-slate-100"
                      }
                    `}
                    title={iconOption.label}
                  >
                    {iconOption.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.name}
              className="flex items-center gap-2 px-5 py-2 bg-blue-500 hover:bg-blue-600
                       text-white font-medium rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditing ? "Update" : "Create"} Category
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================================================
// DELETE CONFIRMATION MODAL
// ============================================================================

function DeleteConfirmModal({
  isOpen,
  category,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  category: TaxonomyCategory | null;
  onClose: () => void;
  onConfirm: (deleteChildren: boolean) => Promise<void>;
  isLoading: boolean;
}) {
  const hasChildren = category?.children && category.children.length > 0;

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white 
                   rounded-xl shadow-xl border border-slate-200 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-xl">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-slate-900">Delete Category</h3>
            <p className="text-slate-600 mt-1">
              Are you sure you want to delete "{category.name}"?
            </p>
            {hasChildren && (
              <p className="text-amber-600 text-sm mt-2">
                ⚠️ This category has {category.children!.length} sub-categories
              </p>
            )}
            {category.contractCount !== undefined && category.contractCount > 0 && (
              <p className="text-slate-500 text-sm mt-1">
                {category.contractCount} contracts will be un-categorized
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          {hasChildren && (
            <button
              onClick={() => onConfirm(true)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700
                       hover:bg-amber-200 rounded-lg transition-colors
                       disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete All
            </button>
          )}
          <button
            onClick={() => onConfirm(false)}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700
                     text-white font-medium rounded-lg transition-colors
                     disabled:opacity-50"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TaxonomyPage() {
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TaxonomyCategory | null>(null);
  const [parentCategory, setParentCategory] = useState<TaxonomyCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Preset data
  const [presets, setPresets] = useState<Array<{
    id: string;
    name: string;
    description: string;
    categoryCount: number;
  }>>([]);

  // Fetch presets
  const fetchPresets = useCallback(async () => {
    try {
      const response = await fetch("/api/taxonomy/presets");
      if (response.ok) {
        const data = await response.json();
        setPresets(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch presets:", err);
    }
  }, []);

  // Apply preset
  const applyPreset = async (presetId: string, clearExisting: boolean = false) => {
    try {
      setIsApplyingPreset(true);
      const response = await fetch("/api/taxonomy/presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "demo",
        },
        body: JSON.stringify({ presetId, clearExisting }),
      });

      if (!response.ok) throw new Error("Failed to apply preset");

      const data = await response.json();
      showNotification("success", data.message || "Preset applied successfully");
      setShowPresetsModal(false);
      await fetchCategories();
    } catch (err) {
      showNotification("error", err instanceof Error ? err.message : "Failed to apply preset");
    } finally {
      setIsApplyingPreset(false);
    }
  };

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/taxonomy?withContractCounts=true", {
        headers: { "x-tenant-id": "demo" },
      });

      if (!response.ok) throw new Error("Failed to fetch categories");

      const data = await response.json();
      setCategories(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchPresets();
  }, [fetchCategories, fetchPresets]);

  // Show notification
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Find category by ID in tree
  const findCategory = (
    id: string,
    cats: TaxonomyCategory[] = categories
  ): TaxonomyCategory | null => {
    for (const cat of cats) {
      if (cat.id === id) return cat;
      if (cat.children) {
        const found = findCategory(id, cat.children);
        if (found) return found;
      }
    }
    return null;
  };

  // Handle create/edit
  const handleSubmit = async (data: CategoryFormData) => {
    try {
      setIsSubmitting(true);

      const url = editingCategory
        ? `/api/taxonomy/${editingCategory.id}`
        : "/api/taxonomy";

      const method = editingCategory ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "demo",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Failed to save");
      }

      showNotification(
        "success",
        editingCategory ? "Category updated successfully" : "Category created successfully"
      );

      setShowFormModal(false);
      setEditingCategory(null);
      setParentCategory(null);
      await fetchCategories();
    } catch (err) {
      showNotification("error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (deleteChildren: boolean) => {
    if (!editingCategory) return;

    try {
      setIsSubmitting(true);

      const url = `/api/taxonomy/${editingCategory.id}?deleteChildren=${deleteChildren}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: { "x-tenant-id": "demo" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Failed to delete");
      }

      showNotification("success", "Category deleted successfully");

      setShowDeleteModal(false);
      setEditingCategory(null);
      setSelectedId(null);
      await fetchCategories();
    } catch (err) {
      showNotification("error", err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit modal
  const openEditModal = (category: TaxonomyCategory) => {
    setEditingCategory(category);
    setParentCategory(category.parentId ? findCategory(category.parentId) : null);
    setShowFormModal(true);
  };

  // Open add child modal
  const openAddChildModal = (parentId: string) => {
    const parent = findCategory(parentId);
    setEditingCategory(null);
    setParentCategory(parent);
    setShowFormModal(true);
  };

  // Open delete modal
  const openDeleteModal = (category: TaxonomyCategory) => {
    setEditingCategory(category);
    setShowDeleteModal(true);
  };

  // Filter categories by search
  const filterCategories = (
    cats: TaxonomyCategory[],
    query: string
  ): TaxonomyCategory[] => {
    if (!query) return cats;

    return cats
      .map((cat) => ({
        ...cat,
        children: cat.children ? filterCategories(cat.children, query) : [],
      }))
      .filter(
        (cat) =>
          cat.name.toLowerCase().includes(query.toLowerCase()) ||
          cat.description?.toLowerCase().includes(query.toLowerCase()) ||
          cat.keywords.some((k) => k.toLowerCase().includes(query.toLowerCase())) ||
          (cat.children && cat.children.length > 0)
      );
  };

  const filteredCategories = filterCategories(categories, searchQuery);

  // Stats
  const totalCategories = categories.reduce((acc, cat) => {
    const countChildren = (c: TaxonomyCategory): number =>
      1 + (c.children?.reduce((a, child) => a + countChildren(child), 0) || 0);
    return acc + countChildren(cat);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/settings"
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <FolderTree className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Taxonomy Management</h1>
                <p className="text-slate-500 text-sm">
                  Define categories for automatic contract classification
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/settings/taxonomy/analytics"
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200
                         rounded-lg transition-colors text-sm text-slate-700"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </Link>
              
              <button
                onClick={() => setShowPresetsModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200
                         rounded-lg transition-colors text-sm text-slate-700"
              >
                <Download className="w-4 h-4" />
                Import Preset
              </button>
              
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setParentCategory(null);
                  setShowFormModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                         text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Tree View */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Toolbar */}
              <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg
                             text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={fetchCategories}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Tree */}
              <div className="p-4 min-h-[400px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
                    <p>{error}</p>
                    <button
                      onClick={fetchCategories}
                      className="mt-4 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-700"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <FolderTree className="w-12 h-12 mb-4 text-slate-300" />
                    <p className="font-medium text-slate-700">No categories yet</p>
                    <p className="text-sm mt-1 text-center max-w-sm">
                      Start with a preset template or create your own categories
                    </p>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => setShowPresetsModal(true)}
                        className="px-4 py-2 bg-blue-600 
                                 text-white rounded-lg hover:bg-blue-700 transition-colors
                                 flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Use a Template
                      </button>
                      <button
                        onClick={() => {
                          setEditingCategory(null);
                          setParentCategory(null);
                          setShowFormModal(true);
                        }}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg
                                 hover:bg-slate-200 transition-colors"
                      >
                        <Plus className="w-4 h-4 inline mr-2" />
                        Create Custom
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredCategories.map((category) => (
                      <CategoryTreeNode
                        key={category.id}
                        category={category}
                        onEdit={openEditModal}
                        onDelete={openDeleteModal}
                        onAddChild={openAddChildModal}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Stats & Help */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-slate-900">
                <Settings2 className="w-5 h-5 text-blue-600" />
                Taxonomy Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total Categories</span>
                  <span className="font-semibold text-slate-900">{totalCategories}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Root Categories</span>
                  <span className="font-semibold text-slate-900">{categories.length}</span>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="bg-amber-50 
                          rounded-xl border border-amber-200 p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-slate-900">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                How Auto-Categorization Works
              </h3>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex gap-2">
                  <span className="text-amber-600 font-medium">1.</span>
                  <p>Add <strong className="text-slate-900">keywords</strong> that commonly appear in contracts of each category</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-600 font-medium">2.</span>
                  <p>Set an <strong className="text-slate-900">AI hint</strong> to help the AI understand what belongs in each category</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-600 font-medium">3.</span>
                  <p>When contracts are uploaded, they're automatically categorized using AI + keywords</p>
                </div>
              </div>
            </div>

            {/* Selected Category Details */}
            {selectedId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm"
              >
                {(() => {
                  const selected = findCategory(selectedId);
                  if (!selected) return null;

                  return (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <CategoryIcon icon={selected.icon} color={selected.color} />
                        <div>
                          <h3 className="font-semibold text-slate-900">{selected.name}</h3>
                          <p className="text-xs text-slate-500">{selected.path}</p>
                        </div>
                      </div>

                      {selected.description && (
                        <p className="text-sm text-slate-600 mb-4">{selected.description}</p>
                      )}

                      {selected.keywords.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-slate-500 mb-2">Keywords:</p>
                          <div className="flex flex-wrap gap-1">
                            {selected.keywords.map((k) => (
                              <span
                                key={k}
                                className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-700"
                              >
                                {k}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selected.aiClassificationPrompt && (
                        <div className="mb-4">
                          <p className="text-xs text-slate-500 mb-2">AI Hint:</p>
                          <p className="text-sm text-slate-600 italic">
                            "{selected.aiClassificationPrompt}"
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(selected)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2
                                   bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition-colors text-slate-700"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteModal(selected)}
                          className="px-3 py-2 bg-red-50 hover:bg-red-100 
                                   text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CategoryFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingCategory(null);
          setParentCategory(null);
        }}
        onSubmit={handleSubmit}
        initialData={
          editingCategory
            ? {
                name: editingCategory.name,
                description: editingCategory.description || "",
                parentId: editingCategory.parentId || null,
                keywords: editingCategory.keywords,
                aiClassificationPrompt: editingCategory.aiClassificationPrompt || "",
                color: editingCategory.color,
                icon: editingCategory.icon,
              }
            : undefined
        }
        parentCategory={parentCategory}
        isEditing={!!editingCategory}
        isLoading={isSubmitting}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        category={editingCategory}
        onClose={() => {
          setShowDeleteModal(false);
          setEditingCategory(null);
        }}
        onConfirm={handleDelete}
        isLoading={isSubmitting}
      />

      {/* Presets Modal */}
      <AnimatePresence>
        {showPresetsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white 
                       rounded-xl shadow-xl border border-slate-200 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-slate-900">Choose a Template</h3>
                      <p className="text-sm text-slate-500">
                        Start with pre-configured categories for your industry
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPresetsModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-2 gap-4">
                {presets.map((preset) => (
                  <motion.button
                    key={preset.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => applyPreset(preset.id, true)}
                    disabled={isApplyingPreset}
                    className="p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200
                             hover:border-slate-300 rounded-xl text-left transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-lg text-slate-900">{preset.name}</h4>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {preset.categoryCount} categories
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{preset.description}</p>
                    <div className="flex items-center gap-2 text-sm text-blue-600 
                                  opacity-0 group-hover:opacity-100 transition-opacity">
                      {isApplyingPreset ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Apply Template
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-500 text-center">
                  Templates will replace any existing categories. You can customize them after applying.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`
              fixed bottom-6 right-6 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl
              ${notification.type === "success"
                ? "bg-green-500"
                : "bg-red-500"
              }
            `}
          >
            {notification.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
