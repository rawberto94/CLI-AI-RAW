'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Save,
  Star,
  StarOff,
  Trash2,
  Edit,
  MoreVertical,
  Search,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { FilterState } from './AdvancedFilterPanel';

export interface SavedSearch {
  id: string;
  name: string;
  filters: FilterState;
  query: string;
  createdAt: Date;
  isPinned: boolean;
}

interface SavedSearchPresetsProps {
  currentFilters: FilterState;
  currentQuery: string;
  onLoadPreset: (preset: SavedSearch) => void;
}

const STORAGE_KEY = 'contigo_saved_searches';

export function SavedSearchPresets({
  currentFilters,
  currentQuery,
  onLoadPreset,
}: SavedSearchPresetsProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load saved searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const searches = parsed.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
        }));
        setSavedSearches(searches);
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    }
  }, []);

  // Save to localStorage
  const persistSearches = (searches: SavedSearch[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
      setSavedSearches(searches);
    } catch (error) {
      console.error('Failed to save searches:', error);
      toast.error('Failed to save search');
    }
  };

  const saveSearch = () => {
    if (!searchName.trim()) {
      toast.error('Please enter a name for this search');
      return;
    }

    if (editingId) {
      // Update existing
      const updated = savedSearches.map(s =>
        s.id === editingId
          ? { ...s, name: searchName, filters: currentFilters, query: currentQuery }
          : s
      );
      persistSearches(updated);
      toast.success('Search updated');
    } else {
      // Create new
      const newSearch: SavedSearch = {
        id: Date.now().toString(),
        name: searchName,
        filters: currentFilters,
        query: currentQuery,
        createdAt: new Date(),
        isPinned: false,
      };
      persistSearches([newSearch, ...savedSearches]);
      toast.success('Search saved');
    }

    setShowSaveDialog(false);
    setSearchName('');
    setEditingId(null);
  };

  const deleteSearch = (id: string) => {
    const updated = savedSearches.filter(s => s.id !== id);
    persistSearches(updated);
    toast.success('Search deleted');
  };

  const togglePin = (id: string) => {
    const updated = savedSearches.map(s =>
      s.id === id ? { ...s, isPinned: !s.isPinned } : s
    );
    persistSearches(updated);
  };

  const openEditDialog = (search: SavedSearch) => {
    setSearchName(search.name);
    setEditingId(search.id);
    setShowSaveDialog(true);
  };

  const getFilterSummary = (search: SavedSearch): string => {
    const parts: string[] = [];
    
    if (search.query) parts.push(`"${search.query}"`);
    if (search.filters.statuses.length > 0) {
      parts.push(`${search.filters.statuses.length} status${search.filters.statuses.length > 1 ? 'es' : ''}`);
    }
    if (search.filters.documentRoles.length > 0) {
      parts.push(`${search.filters.documentRoles.length} role${search.filters.documentRoles.length > 1 ? 's' : ''}`);
    }
    if (search.filters.dateRange.from || search.filters.dateRange.to) {
      parts.push('date range');
    }
    if (search.filters.valueRange.min > 0 || search.filters.valueRange.max < 1000000) {
      parts.push('value range');
    }

    return parts.length > 0 ? parts.join(' · ') : 'No filters';
  };

  const pinnedSearches = savedSearches.filter(s => s.isPinned);
  const unpinnedSearches = savedSearches.filter(s => !s.isPinned);

  return (
    <div className="space-y-3">
      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setEditingId(null);
                setSearchName('');
              }}
            >
              <Save className="h-4 w-4" />
              Save Current Search
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Update Search' : 'Save Search'}
              </DialogTitle>
              <DialogDescription>
                Save your current filters and query for quick access later
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Name</label>
                <Input
                  placeholder="e.g., Active High-Value Contracts"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveSearch();
                  }}
                  autoFocus
                />
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <p className="text-xs font-medium text-slate-600 mb-2">
                  Current Filters:
                </p>
                <p className="text-sm text-slate-700">
                  {getFilterSummary({ 
                    id: '', 
                    name: '', 
                    filters: currentFilters, 
                    query: currentQuery,
                    createdAt: new Date(),
                    isPinned: false
                  })}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowSaveDialog(false);
                  setSearchName('');
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={saveSearch}>
                {editingId ? 'Update' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {savedSearches.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {savedSearches.length} saved search{savedSearches.length !== 1 ? 'es' : ''}
          </Badge>
        )}
      </div>

      {/* Saved Searches List */}
      {savedSearches.length > 0 && (
        <div className="space-y-2">
          {/* Pinned Searches */}
          {pinnedSearches.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                Pinned
              </p>
              {pinnedSearches.map(search => (
                <SearchPresetCard
                  key={search.id}
                  search={search}
                  onLoad={() => onLoadPreset(search)}
                  onEdit={() => openEditDialog(search)}
                  onDelete={() => deleteSearch(search.id)}
                  onTogglePin={() => togglePin(search.id)}
                  getFilterSummary={getFilterSummary}
                />
              ))}
            </div>
          )}

          {/* Unpinned Searches */}
          {unpinnedSearches.length > 0 && (
            <div className="space-y-2">
              {pinnedSearches.length > 0 && (
                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-3">
                  <Clock className="h-3 w-3" />
                  Recent
                </p>
              )}
              {unpinnedSearches.map(search => (
                <SearchPresetCard
                  key={search.id}
                  search={search}
                  onLoad={() => onLoadPreset(search)}
                  onEdit={() => openEditDialog(search)}
                  onDelete={() => deleteSearch(search.id)}
                  onTogglePin={() => togglePin(search.id)}
                  getFilterSummary={getFilterSummary}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {savedSearches.length === 0 && (
        <div className="text-center py-6 border-2 border-dashed rounded-lg">
          <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No saved searches yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Save your current filters to quickly access them later
          </p>
        </div>
      )}
    </div>
  );
}

interface SearchPresetCardProps {
  search: SavedSearch;
  onLoad: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  getFilterSummary: (search: SavedSearch) => string;
}

function SearchPresetCard({
  search,
  onLoad,
  onEdit,
  onDelete,
  onTogglePin,
  getFilterSummary,
}: SearchPresetCardProps) {
  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg hover:bg-slate-50 transition-colors group">
      <button
        onClick={onLoad}
        className="flex-1 text-left min-w-0"
      >
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-sm text-slate-900 truncate">
            {search.name}
          </h4>
          {search.isPinned && (
            <Star className="h-3 w-3 fill-amber-400 text-amber-400 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">
          {getFilterSummary(search)}
        </p>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onLoad}>
            <Search className="h-4 w-4 mr-2" />
            Load Search
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTogglePin}>
            {search.isPinned ? (
              <>
                <StarOff className="h-4 w-4 mr-2" />
                Unpin
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Pin
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
