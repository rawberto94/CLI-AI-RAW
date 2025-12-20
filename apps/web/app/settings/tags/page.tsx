"use client";

/**
 * Tag Management Page
 * 
 * Manage contract tags with:
 * - Create, edit, and delete tags
 * - View usage statistics
 * - Color and description customization
 * - Bulk operations
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Search,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Palette,
  FileText,
  Hash,
  Download,
  Upload,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { PageBreadcrumb } from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TagData {
  name: string;
  color?: string;
  description?: string;
  contractCount: number;
  createdAt?: string;
}

interface TagFormData {
  name: string;
  color: string;
  description: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

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

const DEFAULT_FORM_DATA: TagFormData = {
  name: "",
  color: "#3B82F6",
  description: "",
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TagManagementPage() {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "usage">("name");
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<TagData | null>(null);
  const [formData, setFormData] = useState<TagFormData>(DEFAULT_FORM_DATA);
  const [saving, setSaving] = useState(false);
  
  // Summary stats
  const [summary, setSummary] = useState({ totalTags: 0, totalUsage: 0 });

  // Get tenant ID from localStorage or cookie
  const getTenantId = useCallback(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tenantId") || "demo";
    }
    return "demo";
  }, []);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tags?sortBy=${sortBy}&search=${searchQuery}`, {
        headers: {
          "x-tenant-id": getTenantId(),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }

      const data = await response.json();
      setTags(data.data?.tags || []);
      setSummary(data.data?.summary || { totalTags: 0, totalUsage: 0 });
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast.error("Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, [getTenantId, sortBy, searchQuery]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Open form for creating new tag
  const handleCreateTag = () => {
    setEditingTag(null);
    setFormData(DEFAULT_FORM_DATA);
    setShowForm(true);
  };

  // Open form for editing existing tag
  const handleEditTag = (tag: TagData) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color || "#3B82F6",
      description: tag.description || "",
    });
    setShowForm(true);
  };

  // Save tag (create or update)
  const handleSaveTag = async () => {
    if (!formData.name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": getTenantId(),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save tag");
      }

      toast.success(editingTag ? "Tag updated successfully" : "Tag created successfully");
      setShowForm(false);
      setFormData(DEFAULT_FORM_DATA);
      setEditingTag(null);
      fetchTags();
    } catch (error) {
      console.error("Error saving tag:", error);
      toast.error("Failed to save tag");
    } finally {
      setSaving(false);
    }
  };

  // Delete tag
  const handleDeleteTag = async (tagName: string) => {
    if (!confirm(`Are you sure you want to delete the tag "${tagName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/tags?name=${encodeURIComponent(tagName)}`, {
        method: "DELETE",
        headers: {
          "x-tenant-id": getTenantId(),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete tag");
      }

      toast.success("Tag deleted successfully");
      fetchTags();
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast.error("Failed to delete tag");
    }
  };

  // Cancel form
  const handleCancelForm = () => {
    setShowForm(false);
    setFormData(DEFAULT_FORM_DATA);
    setEditingTag(null);
  };

  // Filter tags by search
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <PageBreadcrumb
            items={[
              { label: "Settings", href: "/settings" },
              { label: "Tags", href: "/settings/tags" },
            ]}
          />
          
          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Tag className="w-8 h-8 text-blue-600" />
                Tag Management
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Create and manage tags for organizing contracts
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTags}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={handleCreateTag}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" />
                Create Tag
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <Hash className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {summary.totalTags}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Tags</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {summary.totalUsage}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Usages</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {summary.totalTags > 0 ? (summary.totalUsage / summary.totalTags).toFixed(1) : "0"}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Avg Usage per Tag</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card className="mb-6 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "name" | "usage")}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                >
                  <option value="name">Name</option>
                  <option value="usage">Most Used</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tag List */}
        <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Tags ({filteredTags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No tags found
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  {searchQuery ? "Try a different search term" : "Create your first tag to get started"}
                </p>
                {!searchQuery && (
                  <Button onClick={handleCreateTag} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Tag
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredTags.map((tag, index) => (
                    <motion.div
                      key={tag.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="group relative p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color || "#3B82F6" }}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 dark:text-white truncate">
                              {tag.name}
                            </h4>
                            {tag.description && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 truncate mt-0.5">
                                {tag.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="flex-shrink-0">
                          {tag.contractCount} contracts
                        </Badge>
                      </div>

                      {/* Action buttons - visible on hover */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => handleEditTag(tag)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit tag"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.name)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete tag"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={handleCancelForm}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  {editingTag ? (
                    <>
                      <Pencil className="w-5 h-5 text-blue-600" />
                      Edit Tag
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 text-blue-600" />
                      Create New Tag
                    </>
                  )}
                </h2>

                <div className="space-y-4">
                  {/* Tag Name */}
                  <div>
                    <label htmlFor="tagName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Tag Name *
                    </label>
                    <input
                      id="tagName"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., High Priority"
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!!editingTag}
                    />
                  </div>

                  {/* Tag Color */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color })}
                          className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                            formData.color === color
                              ? "border-slate-900 dark:border-white scale-110"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional description for this tag"
                      rows={2}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Preview */}
                  <div className="pt-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Preview
                    </label>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: formData.color }}
                      />
                      <span className="text-slate-900 dark:text-white font-medium">
                        {formData.name || "Tag Name"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <Button variant="outline" onClick={handleCancelForm}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveTag}
                    disabled={saving || !formData.name.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingTag ? "Update Tag" : "Create Tag"}
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
