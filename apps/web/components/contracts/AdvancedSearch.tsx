'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Filter,
  Search,
  X,
  Calendar as CalendarIcon,
  DollarSign,
  Shield,
  FileText,
  Star,
  Save,
  FolderOpen,
  Trash2,
  Share2,
} from 'lucide-react';
import { format } from 'date-fns';

interface AdvancedFilters {
  searchQuery: string;
  status: string[];
  riskLevel: number[];
  dateRange: {
    start: Date | undefined;
    end: Date | undefined;
  };
  valueRange: {
    min: number;
    max: number;
  };
  tags: string[];
  customFields: Record<string, string>;
}

interface SavedSearch {
  id: string;
  name: string;
  filters: AdvancedFilters;
  createdAt: Date;
  shared: boolean;
}

interface AdvancedSearchProps {
  onApplyFilters: (filters: AdvancedFilters) => void;
  onClearFilters: () => void;
}

export function AdvancedSearch({ onApplyFilters, onClearFilters }: AdvancedSearchProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>({
    searchQuery: '',
    status: [],
    riskLevel: [0, 100],
    dateRange: { start: undefined, end: undefined },
    valueRange: { min: 0, max: 10000000 },
    tags: [],
    customFields: {},
  });
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');

  const statusOptions = ['draft', 'active', 'pending_approval', 'expired', 'terminated'];
  const availableTags = ['high-priority', 'vendor', 'customer', 'nda', 'msa', 'sow', 'renewal'];

  const handleApply = () => {
    onApplyFilters(filters);
    setOpen(false);
  };

  const handleClear = () => {
    setFilters({
      searchQuery: '',
      status: [],
      riskLevel: [0, 100],
      dateRange: { start: undefined, end: undefined },
      valueRange: { min: 0, max: 10000000 },
      tags: [],
      customFields: {},
    });
    onClearFilters();
  };

  const handleSaveSearch = () => {
    const newSearch: SavedSearch = {
      id: `search-${Date.now()}`,
      name: searchName,
      filters: { ...filters },
      createdAt: new Date(),
      shared: false,
    };
    setSavedSearches([...savedSearches, newSearch]);
    setSearchName('');
    setShowSaveDialog(false);
  };

  const handleLoadSearch = (search: SavedSearch) => {
    setFilters(search.filters);
    onApplyFilters(search.filters);
  };

  const handleDeleteSearch = (id: string) => {
    setSavedSearches(savedSearches.filter((s) => s.id !== id));
  };

  const toggleStatus = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status],
    }));
  };

  const toggleTag = (tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const activeFilterCount = 
    filters.status.length +
    filters.tags.length +
    (filters.dateRange.start ? 1 : 0) +
    (filters.riskLevel[0] > 0 || filters.riskLevel[1] < 100 ? 1 : 0) +
    (filters.valueRange.min > 0 || filters.valueRange.max < 10000000 ? 1 : 0);

  return (
    <div className="flex gap-2">
      {/* Quick Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Quick search..."
          className="pl-10"
          value={filters.searchQuery}
          onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onApplyFilters(filters);
            }
          }}
        />
      </div>

      {/* Advanced Filters Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Advanced Search & Filters</DialogTitle>
            <DialogDescription>
              Create complex filters to find exactly what you need
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Status Filter */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Contract Status</Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <Badge
                    key={status}
                    variant={filters.status.includes(status) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleStatus(status)}
                  >
                    {status.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Risk Level */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Risk Score Range</Label>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {filters.riskLevel[0]} - {filters.riskLevel[1]}
                  </span>
                </div>
              </div>
              <Slider
                value={filters.riskLevel}
                onValueChange={(value) => setFilters({ ...filters, riskLevel: value })}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <Separator />

            {/* Date Range */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Date Range</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {filters.dateRange.start ? format(filters.dateRange.start, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.start}
                        onSelect={(date) =>
                          setFilters({ ...filters, dateRange: { ...filters.dateRange, start: date } })
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {filters.dateRange.end ? format(filters.dateRange.end, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.end}
                        onSelect={(date) =>
                          setFilters({ ...filters, dateRange: { ...filters.dateRange, end: date } })
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <Separator />

            {/* Value Range */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Contract Value Range</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Minimum Value</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="number"
                      className="pl-10"
                      value={filters.valueRange.min}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          valueRange: { ...filters.valueRange, min: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Maximum Value</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="number"
                      className="pl-10"
                      value={filters.valueRange.max}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          valueRange: { ...filters.valueRange, max: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Tags */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Tags</Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={filters.tags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Saved Searches */}
            {savedSearches.length > 0 && (
              <>
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Saved Searches</Label>
                  <div className="space-y-2">
                    {savedSearches.map((search) => (
                      <div
                        key={search.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <div>
                            <p className="font-medium">{search.name}</p>
                            <p className="text-xs text-gray-500">
                              Created {format(search.createdAt, 'PPP')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLoadSearch(search)}
                          >
                            <FolderOpen className="h-3 w-3 mr-1" />
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSearch(search.id)}
                          >
                            <Trash2 className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Actions */}
            <div className="flex justify-between gap-3">
              <div className="flex gap-2">
                {showSaveDialog ? (
                  <div className="flex gap-2 flex-1">
                    <Input
                      placeholder="Search name..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleSaveSearch} disabled={!searchName}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
                    <Star className="h-4 w-4 mr-2" />
                    Save Search
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClear}>
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
                <Button onClick={handleApply}>
                  <Search className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          <X className="h-4 w-4 mr-1" />
          Clear ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}
