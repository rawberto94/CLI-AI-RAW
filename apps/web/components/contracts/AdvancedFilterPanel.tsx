'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  X,
  SlidersHorizontal,
  Calendar as CalendarIcon,
  DollarSign,
  Filter,
  RotateCcw,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface FilterState {
  statuses: string[];
  documentRoles: string[];
  dateRange: {
    from?: Date;
    to?: Date;
  };
  valueRange: {
    min: number;
    max: number;
  };
  categories: string[];
  hasDeadline: boolean | null;
  isExpiring: boolean | null;
}

interface AdvancedFilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onClose?: () => void;
  availableCategories?: string[];
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', color: 'bg-blue-100 text-blue-700', icon: FileText },
  { value: 'PENDING', label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  { value: 'PROCESSING', label: 'Processing', color: 'bg-purple-100 text-purple-700', icon: Clock },
  { value: 'ACTIVE', label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  { value: 'FAILED', label: 'Failed', color: 'bg-red-100 text-red-700', icon: X },
  { value: 'EXPIRED', label: 'Expired', color: 'bg-orange-100 text-orange-700', icon: Clock },
];

const DOCUMENT_ROLE_OPTIONS = [
  { value: 'NEW_CONTRACT', label: 'New Contract', color: 'bg-blue-100 text-blue-700' },
  { value: 'EXISTING', label: 'Existing', color: 'bg-slate-100 text-slate-700' },
  { value: 'AMENDMENT', label: 'Amendment', color: 'bg-purple-100 text-purple-700' },
  { value: 'RENEWAL', label: 'Renewal', color: 'bg-amber-100 text-amber-700' },
];

export function AdvancedFilterPanel({
  filters,
  onChange,
  onClose,
  availableCategories = [],
}: AdvancedFilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const updated = { ...localFilters, [key]: value };
    setLocalFilters(updated);
    onChange(updated);
  };

  const toggleStatus = (status: string) => {
    const current = localFilters.statuses;
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    updateFilter('statuses', updated);
  };

  const toggleDocumentRole = (role: string) => {
    const current = localFilters.documentRoles;
    const updated = current.includes(role)
      ? current.filter(r => r !== role)
      : [...current, role];
    updateFilter('documentRoles', updated);
  };

  const toggleCategory = (category: string) => {
    const current = localFilters.categories;
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category];
    updateFilter('categories', updated);
  };

  const resetFilters = () => {
    const reset: FilterState = {
      statuses: [],
      documentRoles: [],
      dateRange: {},
      valueRange: { min: 0, max: 1000000 },
      categories: [],
      hasDeadline: null,
      isExpiring: null,
    };
    setLocalFilters(reset);
    onChange(reset);
  };

  const activeFiltersCount =
    localFilters.statuses.length +
    localFilters.documentRoles.length +
    localFilters.categories.length +
    (localFilters.dateRange.from || localFilters.dateRange.to ? 1 : 0) +
    (localFilters.valueRange.min > 0 || localFilters.valueRange.max < 1000000 ? 1 : 0) +
    (localFilters.hasDeadline !== null ? 1 : 0) +
    (localFilters.isExpiring !== null ? 1 : 0);

  return (
    <Card className="border-2 shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
              <SlidersHorizontal className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Advanced Filters</CardTitle>
              <CardDescription>
                {activeFiltersCount > 0 ? (
                  <span className="text-indigo-600 font-medium">
                    {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active
                  </span>
                ) : (
                  'Refine your search results'
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-slate-600 hover:text-red-600"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Status Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-indigo-600" />
            Contract Status
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map(option => {
              const Icon = option.icon;
              const isSelected = localFilters.statuses.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleStatus(option.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium',
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                  {isSelected && (
                    <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-indigo-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Document Role Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-600" />
            Document Role
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {DOCUMENT_ROLE_OPTIONS.map(option => {
              const isSelected = localFilters.documentRoles.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleDocumentRole(option.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium',
                    isSelected
                      ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  )}
                >
                  {option.label}
                  {isSelected && (
                    <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-purple-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-blue-600" />
            Date Range
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !localFilters.dateRange.from && 'text-slate-400'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {localFilters.dateRange.from ? (
                      format(localFilters.dateRange.from, 'PP')
                    ) : (
                      'Pick date'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={localFilters.dateRange.from}
                    onSelect={(date) =>
                      updateFilter('dateRange', {
                        ...localFilters.dateRange,
                        from: date instanceof Date ? date : undefined,
                      })
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !localFilters.dateRange.to && 'text-slate-400'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {localFilters.dateRange.to ? (
                      format(localFilters.dateRange.to, 'PP')
                    ) : (
                      'Pick date'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={localFilters.dateRange.to}
                    onSelect={(date) =>
                      updateFilter('dateRange', {
                        ...localFilters.dateRange,
                        to: date instanceof Date ? date : undefined,
                      })
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Value Range Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            Contract Value Range
          </Label>
          <div className="space-y-4">
            <Slider
              min={0}
              max={1000000}
              step={10000}
              value={[localFilters.valueRange.min, localFilters.valueRange.max]}
              onValueChange={([min, max]) =>
                updateFilter('valueRange', { min, max })
              }
              className="py-4"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                ${localFilters.valueRange.min.toLocaleString()}
              </span>
              <span className="text-slate-400">to</span>
              <span className="font-medium text-slate-700">
                ${localFilters.valueRange.max === 1000000 ? '1M+' : localFilters.valueRange.max.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Categories Filter */}
        {availableCategories.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Categories
            </Label>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map(category => {
                const isSelected = localFilters.categories.includes(category);
                return (
                  <Badge
                    key={category}
                    variant={isSelected ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer transition-all',
                      isSelected
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'hover:border-amber-300'
                    )}
                    onClick={() => toggleCategory(category)}
                  >
                    {category}
                    {isSelected && <X className="ml-1 h-3 w-3" />}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Toggles */}
        <div className="space-y-3 pt-3 border-t">
          <Label className="text-sm font-semibold">Quick Filters</Label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer transition-colors">
              <Checkbox
                checked={localFilters.hasDeadline === true}
                onCheckedChange={(checked) =>
                  updateFilter('hasDeadline', checked ? true : null)
                }
              />
              <span className="text-sm font-medium">Has expiration date</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer transition-colors">
              <Checkbox
                checked={localFilters.isExpiring === true}
                onCheckedChange={(checked) =>
                  updateFilter('isExpiring', checked ? true : null)
                }
              />
              <span className="text-sm font-medium">Expiring within 30 days</span>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
