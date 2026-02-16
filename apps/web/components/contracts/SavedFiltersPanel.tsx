/**
 * SavedFiltersPanel Component
 * 
 * A panel for managing saved filter presets with CRUD operations,
 * pinning, and quick apply functionality.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  Plus,
  Edit2,
  Trash2,
  Pin,
  PinOff,
  Star,
  StarOff,
  Copy,
  Download,
  Upload,
  MoreVertical,
  Search,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSavedFilters, type SavedFilter } from '@/hooks/use-saved-filters';
import type { ContractFilters } from '@/hooks/use-contract-filters';

// ============================================================================
// Types
// ============================================================================

interface SavedFiltersPanelProps {
  currentFilters: Partial<ContractFilters>;
  onApplyFilter: (filters: Partial<ContractFilters>) => void;
  className?: string;
  variant?: 'panel' | 'dropdown' | 'compact';
}

interface FilterFormData {
  name: string;
  description: string;
  icon: string;
  color: string;
}

// ============================================================================
// Constants
// ============================================================================

const ICON_OPTIONS = ['📁', '⭐', '🔥', '⚡', '🎯', '📊', '🔍', '⏰', '💰', '🏷️', '📋', '✅'];
const COLOR_OPTIONS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', 
  '#22c55e', '#8B5CF6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
];

// ============================================================================
// Sub-components
// ============================================================================

interface FilterCardProps {
  filter: SavedFilter;
  isActive?: boolean;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
  onSetDefault: () => void;
}

function FilterCard({
  filter,
  isActive,
  onApply,
  onEdit,
  onDelete,
  onDuplicate,
  onTogglePin,
  onSetDefault,
}: FilterCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'group relative flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer',
        isActive
          ? 'bg-primary/10 border-primary'
          : 'bg-card hover:bg-accent border-border hover:border-primary/50',
        filter.isPinned && 'ring-1 ring-primary/20'
      )}
      onClick={onApply}
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg"
        style={{ backgroundColor: `${filter.color || '#6366f1'}20` }}
      >
        {filter.icon || '📁'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{filter.name}</span>
          {filter.isPinned && (
            <Pin className="h-3 w-3 text-primary" />
          )}
          {filter.isDefault && (
            <Badge variant="secondary" className="text-xs">Default</Badge>
          )}
        </div>
        {filter.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {filter.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            Used {filter.usageCount} times
          </span>
          {filter.lastUsedAt && (
            <span className="text-xs text-muted-foreground">
              • Last used {new Date(filter.lastUsedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin(); }}>
              {filter.isPinned ? (
                <>
                  <PinOff className="h-4 w-4 mr-2" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 mr-2" />
                  Pin to top
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSetDefault(); }}>
              {filter.isDefault ? (
                <>
                  <StarOff className="h-4 w-4 mr-2" />
                  Remove as default
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  Set as default
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SavedFiltersPanel({
  currentFilters,
  onApplyFilter,
  className,
  variant = 'panel',
}: SavedFiltersPanelProps) {
  const {
    state: { savedFilters, isLoading, error },
    actions,
    pinnedFilters,
    recentFilters,
    defaultFilter,
    filterCount,
    hasReachedLimit,
  } = useSavedFilters();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<SavedFilter | null>(null);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    pinned: true,
    recent: true,
    all: true,
  });
  const [formData, setFormData] = useState<FilterFormData>({
    name: '',
    description: '',
    icon: '📁',
    color: '#6366f1',
  });
  const [importData, setImportData] = useState('');

  // Filter the saved filters based on search
  const filteredFilters = savedFilters.filter((filter) =>
    filter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    filter.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const handleCreateFilter = useCallback(() => {
    if (!formData.name.trim()) return;

    actions.createFilter({
      name: formData.name.trim(),
      description: formData.description.trim(),
      icon: formData.icon,
      color: formData.color,
      filters: currentFilters,
    });

    setShowCreateDialog(false);
    setFormData({ name: '', description: '', icon: '📁', color: '#6366f1' });
  }, [formData, currentFilters, actions]);

  const handleUpdateFilter = useCallback(() => {
    if (!selectedFilter || !formData.name.trim()) return;

    actions.updateFilter(selectedFilter.id, {
      name: formData.name.trim(),
      description: formData.description.trim(),
      icon: formData.icon,
      color: formData.color,
    });

    setShowEditDialog(false);
    setSelectedFilter(null);
    setFormData({ name: '', description: '', icon: '📁', color: '#6366f1' });
  }, [selectedFilter, formData, actions]);

  const handleDeleteFilter = useCallback(() => {
    if (!selectedFilter) return;

    actions.deleteFilter(selectedFilter.id);
    setShowDeleteConfirm(false);
    setSelectedFilter(null);
  }, [selectedFilter, actions]);

  const handleApplyFilter = useCallback((filter: SavedFilter) => {
    actions.recordUsage(filter.id);
    setActiveFilterId(filter.id);
    onApplyFilter(filter.filters);
  }, [actions, onApplyFilter]);

  const handleEditClick = useCallback((filter: SavedFilter) => {
    setSelectedFilter(filter);
    setFormData({
      name: filter.name,
      description: filter.description || '',
      icon: filter.icon || '📁',
      color: filter.color || '#6366f1',
    });
    setShowEditDialog(true);
  }, []);

  const handleDeleteClick = useCallback((filter: SavedFilter) => {
    setSelectedFilter(filter);
    setShowDeleteConfirm(true);
  }, []);

  const handleImport = useCallback(() => {
    const success = actions.importFilters(importData);
    if (success) {
      setShowImportDialog(false);
      setImportData('');
    }
  }, [importData, actions]);

  const handleExport = useCallback(() => {
    const data = actions.exportFilters();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saved-filters.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [actions]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Render section
  const renderFilterSection = (
    title: string,
    icon: React.ReactNode,
    filters: SavedFilter[],
    sectionKey: keyof typeof expandedSections
  ) => {
    if (filters.length === 0) return null;

    return (
      <div className="space-y-2">
        <button
          className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => toggleSection(sectionKey)}
        >
          <div className="flex items-center gap-2">
            {icon}
            <span>{title}</span>
            <Badge variant="secondary" className="text-xs">{filters.length}</Badge>
          </div>
          {expandedSections[sectionKey] ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        <AnimatePresence>
          {expandedSections[sectionKey] && (
            <motion.div key="SavedFiltersPanel-ap-1"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2 overflow-hidden"
            >
              {filters.map((filter) => (
                <FilterCard
                  key={filter.id}
                  filter={filter}
                  isActive={activeFilterId === filter.id}
                  onApply={() => handleApplyFilter(filter)}
                  onEdit={() => handleEditClick(filter)}
                  onDelete={() => handleDeleteClick(filter)}
                  onDuplicate={() => actions.duplicateFilter(filter.id)}
                  onTogglePin={() => 
                    filter.isPinned 
                      ? actions.unpinFilter(filter.id) 
                      : actions.pinFilter(filter.id)
                  }
                  onSetDefault={() => 
                    filter.isDefault 
                      ? actions.clearDefault() 
                      : actions.setAsDefault(filter.id)
                  }
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                disabled={hasReachedLimit}
              >
                <Bookmark className="h-4 w-4 mr-1" />
                Save
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save current filters</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {pinnedFilters.length > 0 && (
          <div className="flex items-center gap-1">
            {pinnedFilters.slice(0, 3).map((filter) => (
              <TooltipProvider key={filter.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeFilterId === filter.id ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleApplyFilter(filter)}
                    >
                      {filter.icon || '📁'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{filter.name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Saved Filters</h3>
          <Badge variant="secondary">{filterCount}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowImportDialog(true)}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import filters</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleExport}
                  disabled={filterCount === 0}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export filters</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search saved filters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Create Button */}
      <Button
        className="w-full"
        onClick={() => setShowCreateDialog(true)}
        disabled={hasReachedLimit}
      >
        <Plus className="h-4 w-4 mr-2" />
        Save Current Filters
      </Button>

      {hasReachedLimit && (
        <p className="text-xs text-muted-foreground text-center">
          Maximum saved filters reached. Delete some to add more.
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading saved filters...
        </div>
      ) : filterCount === 0 ? (
        <div className="py-8 text-center">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No saved filters yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first saved filter to quickly apply it later
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Filters */}
          {renderFilterSection(
            'Pinned',
            <Pin className="h-4 w-4" />,
            pinnedFilters,
            'pinned'
          )}

          {/* Recent Filters */}
          {renderFilterSection(
            'Recent',
            <Clock className="h-4 w-4" />,
            recentFilters.filter(f => !f.isPinned),
            'recent'
          )}

          {/* All Filters */}
          {renderFilterSection(
            'All Filters',
            <FolderOpen className="h-4 w-4" />,
            searchQuery ? filteredFilters : savedFilters.filter(f => !f.isPinned),
            'all'
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current Filters</DialogTitle>
            <DialogDescription>
              Create a saved filter preset from your current filter settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., High Value Active Contracts"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe what this filter shows..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    className={cn(
                      'w-10 h-10 rounded-lg border-2 text-lg transition-colors',
                      formData.icon === icon
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => setFormData(prev => ({ ...prev, icon }))}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-transform',
                      formData.color === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFilter} disabled={!formData.name.trim()}>
              <Check className="h-4 w-4 mr-2" />
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Filter</DialogTitle>
            <DialogDescription>
              Update the filter name, description, or appearance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    className={cn(
                      'w-10 h-10 rounded-lg border-2 text-lg transition-colors',
                      formData.icon === icon
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => setFormData(prev => ({ ...prev, icon }))}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-transform',
                      formData.color === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFilter} disabled={!formData.name.trim()}>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Filter</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{selectedFilter?.name}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFilter}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Filters</DialogTitle>
            <DialogDescription>
              Paste the exported JSON data to import saved filters.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder='[{"name": "My Filter", "filters": {...}}]'
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importData.trim()}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SavedFiltersPanel;
