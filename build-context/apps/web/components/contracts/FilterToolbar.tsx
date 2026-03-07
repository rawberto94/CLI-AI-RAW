/**
 * Filter Toolbar Component
 * 
 * Comprehensive filter UI for the contracts page.
 * Includes search, quick filters, advanced filters, and active filter badges.
 */

'use client';

import React, { memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Calendar,
  DollarSign,
  AlertTriangle,
  Tag,
  Building2,
  Clock,
  CheckCircle2,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export interface Category {
  id: string;
  name: string;
  color?: string;
  contractCount?: number;
}

export interface FilterState {
  search: string;
  status: string[];
  category: string[];
  dateRange: { from?: Date; to?: Date };
  valueRange: { min?: number; max?: number };
  riskLevel: string[];
  expiringWithin: number | null;
  hasArtifacts: boolean | null;
}

export interface QuickPreset {
  id: string;
  label: string;
  icon: React.ReactNode;
  filters: Partial<FilterState>;
}

export interface FilterToolbarProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearFilters: () => void;
  onApplyPreset: (preset: QuickPreset) => void;
  categories: Category[];
  statuses: string[];
  presets?: QuickPreset[];
  activeFilterCount: number;
  totalContracts: number;
  filteredCount: number;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'text-green-600' },
  { value: 'pending', label: 'Pending', color: 'text-yellow-600' },
  { value: 'expired', label: 'Expired', color: 'text-red-600' },
  { value: 'draft', label: 'Draft', color: 'text-gray-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-gray-400' },
];

const RISK_LEVELS = [
  { value: 'high', label: 'High Risk', color: 'text-red-600' },
  { value: 'medium', label: 'Medium Risk', color: 'text-yellow-600' },
  { value: 'low', label: 'Low Risk', color: 'text-green-600' },
];

const VALUE_RANGES = [
  { id: 'under-10k', label: 'Under $10K', min: 0, max: 10000 },
  { id: '10k-50k', label: '$10K - $50K', min: 10000, max: 50000 },
  { id: '50k-100k', label: '$50K - $100K', min: 50000, max: 100000 },
  { id: '100k-500k', label: '$100K - $500K', min: 100000, max: 500000 },
  { id: 'over-500k', label: 'Over $500K', min: 500000, max: undefined },
];

const EXPIRATION_OPTIONS = [
  { value: 7, label: 'Within 7 days' },
  { value: 30, label: 'Within 30 days' },
  { value: 60, label: 'Within 60 days' },
  { value: 90, label: 'Within 90 days' },
];

const DEFAULT_PRESETS: QuickPreset[] = [
  {
    id: 'expiring-soon',
    label: 'Expiring Soon',
    icon: <Clock className="h-4 w-4" />,
    filters: { expiringWithin: 30 },
  },
  {
    id: 'high-value',
    label: 'High Value',
    icon: <DollarSign className="h-4 w-4" />,
    filters: { valueRange: { min: 100000 } },
  },
  {
    id: 'high-risk',
    label: 'High Risk',
    icon: <AlertTriangle className="h-4 w-4" />,
    filters: { riskLevel: ['high'] },
  },
  {
    id: 'active',
    label: 'Active Only',
    icon: <CheckCircle2 className="h-4 w-4" />,
    filters: { status: ['active'] },
  },
];

// ============================================================================
// Sub-components
// ============================================================================

interface FilterBadgeProps {
  label: string;
  value: string;
  onRemove: () => void;
}

const FilterBadge = memo(function FilterBadge({ label, value, onRemove }: FilterBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.15 }}
    >
      <Badge
        variant="secondary"
        className="flex items-center gap-1.5 px-2 py-1 text-xs"
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium">{value}</span>
        <button
          onClick={onRemove}
          className="ml-1 rounded-full p-0.5 hover:bg-muted transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    </motion.div>
  );
});

interface QuickPresetButtonProps {
  preset: QuickPreset;
  isActive: boolean;
  onClick: () => void;
}

const QuickPresetButton = memo(function QuickPresetButton({
  preset,
  isActive,
  onClick,
}: QuickPresetButtonProps) {
  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      className={cn(
        'h-8 gap-1.5 text-xs transition-all',
        isActive && 'ring-2 ring-offset-1'
      )}
      onClick={onClick}
    >
      {preset.icon}
      {preset.label}
    </Button>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const FilterToolbar = memo(function FilterToolbar({
  filters,
  onFilterChange,
  onClearFilters,
  onApplyPreset,
  categories,
  statuses,
  presets = DEFAULT_PRESETS,
  activeFilterCount,
  totalContracts,
  filteredCount,
  className,
}: FilterToolbarProps) {
  const hasActiveFilters = activeFilterCount > 0;
  const showResultCount = hasActiveFilters || filters.search;

  // Handle search input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange('search', e.target.value);
  }, [onFilterChange]);

  // Handle status toggle
  const handleStatusToggle = useCallback((status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onFilterChange('status', newStatuses);
  }, [filters.status, onFilterChange]);

  // Handle category toggle
  const handleCategoryToggle = useCallback((categoryId: string) => {
    const newCategories = filters.category.includes(categoryId)
      ? filters.category.filter(c => c !== categoryId)
      : [...filters.category, categoryId];
    onFilterChange('category', newCategories);
  }, [filters.category, onFilterChange]);

  // Handle risk level toggle
  const handleRiskToggle = useCallback((risk: string) => {
    const newRisks = filters.riskLevel.includes(risk)
      ? filters.riskLevel.filter(r => r !== risk)
      : [...filters.riskLevel, risk];
    onFilterChange('riskLevel', newRisks);
  }, [filters.riskLevel, onFilterChange]);

  // Handle value range selection
  const handleValueRangeSelect = useCallback((min?: number, max?: number) => {
    onFilterChange('valueRange', { min, max });
  }, [onFilterChange]);

  // Handle expiration selection
  const handleExpirationSelect = useCallback((days: number | null) => {
    onFilterChange('expiringWithin', days);
  }, [onFilterChange]);

  // Handle date range
  const handleDateFromChange = useCallback((date: Date | Date[] | { from?: Date; to?: Date } | undefined) => {
    const selectedDate = Array.isArray(date) ? date[0] : (date instanceof Date ? date : undefined);
    onFilterChange('dateRange', { ...filters.dateRange, from: selectedDate });
  }, [filters.dateRange, onFilterChange]);

  const handleDateToChange = useCallback((date: Date | Date[] | { from?: Date; to?: Date } | undefined) => {
    const selectedDate = Array.isArray(date) ? date[0] : (date instanceof Date ? date : undefined);
    onFilterChange('dateRange', { ...filters.dateRange, to: selectedDate });
  }, [filters.dateRange, onFilterChange]);

  // Get active filter badges
  const getActiveFilterBadges = useCallback(() => {
    const badges: { label: string; value: string; onRemove: () => void }[] = [];

    // Status badges
    filters.status.forEach(status => {
      const statusOption = STATUS_OPTIONS.find(s => s.value === status);
      if (statusOption) {
        badges.push({
          label: 'Status',
          value: statusOption.label,
          onRemove: () => handleStatusToggle(status),
        });
      }
    });

    // Category badges
    filters.category.forEach(catId => {
      const category = categories.find(c => c.id === catId);
      if (category) {
        badges.push({
          label: 'Category',
          value: category.name,
          onRemove: () => handleCategoryToggle(catId),
        });
      }
    });

    // Risk level badges
    filters.riskLevel.forEach(risk => {
      const riskOption = RISK_LEVELS.find(r => r.value === risk);
      if (riskOption) {
        badges.push({
          label: 'Risk',
          value: riskOption.label,
          onRemove: () => handleRiskToggle(risk),
        });
      }
    });

    // Value range badge
    if (filters.valueRange.min !== undefined || filters.valueRange.max !== undefined) {
      const min = filters.valueRange.min;
      const max = filters.valueRange.max;
      let value = '';
      if (min !== undefined && max !== undefined) {
        value = `$${(min / 1000).toFixed(0)}K - $${(max / 1000).toFixed(0)}K`;
      } else if (min !== undefined) {
        value = `Over $${(min / 1000).toFixed(0)}K`;
      } else if (max !== undefined) {
        value = `Under $${(max / 1000).toFixed(0)}K`;
      }
      badges.push({
        label: 'Value',
        value,
        onRemove: () => onFilterChange('valueRange', { min: undefined, max: undefined }),
      });
    }

    // Expiration badge
    if (filters.expiringWithin !== null) {
      badges.push({
        label: 'Expiring',
        value: `Within ${filters.expiringWithin} days`,
        onRemove: () => onFilterChange('expiringWithin', null),
      });
    }

    // Date range badge
    if (filters.dateRange.from || filters.dateRange.to) {
      const from = filters.dateRange.from ? format(filters.dateRange.from, 'MMM d') : '';
      const to = filters.dateRange.to ? format(filters.dateRange.to, 'MMM d') : '';
      badges.push({
        label: 'Date',
        value: from && to ? `${from} - ${to}` : from || to,
        onRemove: () => onFilterChange('dateRange', { from: undefined, to: undefined }),
      });
    }

    // Has artifacts badge
    if (filters.hasArtifacts !== null) {
      badges.push({
        label: 'Artifacts',
        value: filters.hasArtifacts ? 'Has artifacts' : 'No artifacts',
        onRemove: () => onFilterChange('hasArtifacts', null),
      });
    }

    return badges;
  }, [filters, categories, handleStatusToggle, handleCategoryToggle, handleRiskToggle, onFilterChange]);

  const activeBadges = getActiveFilterBadges();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={filters.search}
            onChange={handleSearchChange}
            className="pl-9 h-10"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap gap-2">
          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Status
                {filters.status.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {filters.status.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map(status => (
                <DropdownMenuCheckboxItem
                  key={status.value}
                  checked={filters.status.includes(status.value)}
                  onCheckedChange={() => handleStatusToggle(status.value)}
                >
                  <span className={status.color}>{status.label}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2">
                <Tag className="h-4 w-4" />
                Category
                {filters.category.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {filters.category.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
              <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No categories available
                </div>
              ) : (
                categories.map(category => (
                  <DropdownMenuCheckboxItem
                    key={category.id}
                    checked={filters.category.includes(category.id)}
                    onCheckedChange={() => handleCategoryToggle(category.id)}
                  >
                    <div className="flex items-center gap-2">
                      {category.color && (
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <span>{category.name}</span>
                      {category.contractCount !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {category.contractCount}
                        </span>
                      )}
                    </div>
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Value Range Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2">
                <DollarSign className="h-4 w-4" />
                Value
                {(filters.valueRange.min !== undefined || filters.valueRange.max !== undefined) && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    1
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Filter by Value</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {VALUE_RANGES.map(range => (
                <DropdownMenuItem
                  key={range.id}
                  onClick={() => handleValueRangeSelect(range.min, range.max)}
                  className={cn(
                    filters.valueRange.min === range.min &&
                    filters.valueRange.max === range.max &&
                    'bg-accent'
                  )}
                >
                  {range.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleValueRangeSelect(undefined, undefined)}
                className="text-muted-foreground"
              >
                Clear value filter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Risk Level Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risk
                {filters.riskLevel.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {filters.riskLevel.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel>Filter by Risk</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {RISK_LEVELS.map(risk => (
                <DropdownMenuCheckboxItem
                  key={risk.value}
                  checked={filters.riskLevel.includes(risk.value)}
                  onCheckedChange={() => handleRiskToggle(risk.value)}
                >
                  <span className={risk.color}>{risk.label}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Expiration Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2">
                <Clock className="h-4 w-4" />
                Expiring
                {filters.expiringWithin !== null && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    1
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel>Expiring Within</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {EXPIRATION_OPTIONS.map(option => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleExpirationSelect(option.value)}
                  className={cn(
                    filters.expiringWithin === option.value && 'bg-accent'
                  )}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleExpirationSelect(null)}
                className="text-muted-foreground"
              >
                Clear expiration filter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date Range Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
                {(filters.dateRange.from || filters.dateRange.to) && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    1
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex">
                <div className="p-3 border-r">
                  <p className="text-sm font-medium mb-2">From</p>
                  <CalendarComponent
                    mode="single"
                    selected={filters.dateRange.from}
                    onSelect={handleDateFromChange}
                    initialFocus
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium mb-2">To</p>
                  <CalendarComponent
                    mode="single"
                    selected={filters.dateRange.to}
                    onSelect={handleDateToChange}
                    disabled={(date) => filters.dateRange.from ? date < filters.dateRange.from : false}
                  />
                </div>
              </div>
              {(filters.dateRange.from || filters.dateRange.to) && (
                <div className="p-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => onFilterChange('dateRange', { from: undefined, to: undefined })}
                  >
                    Clear date range
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Advanced Filters Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2">
                <Filter className="h-4 w-4" />
                More
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Additional Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filters.hasArtifacts === true}
                onCheckedChange={(checked) => 
                  onFilterChange('hasArtifacts', checked ? true : null)
                }
              >
                Has AI artifacts
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.hasArtifacts === false}
                onCheckedChange={(checked) => 
                  onFilterChange('hasArtifacts', checked ? false : null)
                }
              >
                No AI artifacts
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">
          <Sparkles className="h-4 w-4 inline-block mr-1" />
          Quick filters:
        </span>
        {presets.map(preset => (
          <QuickPresetButton
            key={preset.id}
            preset={preset}
            isActive={false} // Could track active preset
            onClick={() => onApplyPreset(preset)}
          />
        ))}
      </div>

      {/* Active Filters & Results */}
      {(activeBadges.length > 0 || showResultCount) && (
        <div className="flex flex-wrap items-center gap-2">
          <AnimatePresence mode="popLayout">
            {activeBadges.map((badge, index) => (
              <FilterBadge
                key={`${badge.label}-${badge.value}-${index}`}
                {...badge}
              />
            ))}
          </AnimatePresence>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={onClearFilters}
            >
              <RotateCcw className="h-3 w-3" />
              Clear all
            </Button>
          )}

          {showResultCount && (
            <div className="ml-auto text-sm text-muted-foreground">
              {filteredCount === totalContracts ? (
                <span>{totalContracts} contracts</span>
              ) : (
                <span>
                  Showing <strong>{filteredCount}</strong> of {totalContracts} contracts
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default FilterToolbar;
