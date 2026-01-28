/**
 * Search and Filters Bar Component
 * 
 * Comprehensive search and filter controls for contracts.
 */

'use client';

import React, { memo, useCallback } from 'react';
import {
  Search,
  X,
  Filter,
  ChevronDown,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Tag,
  DollarSign,
  Calendar,
  Shield,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface SearchFiltersBarProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  
  // Status filter
  statusFilter: string;
  onStatusChange: (status: string) => void;
  statusOptions?: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  
  // Category filter
  categoryFilter: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  categories?: { id: string; name: string; color?: string | null }[];
  
  // Risk filter
  riskFilters?: string[];
  onRiskChange?: (risks: string[]) => void;
  
  // Value range filter
  valueRangeFilter?: string | null;
  onValueRangeChange?: (range: string | null) => void;
  
  // Type filter
  typeFilters?: string[];
  onTypeChange?: (types: string[]) => void;
  contractTypes?: string[];
  
  // Expiration filter
  expirationFilter?: string | null;
  onExpirationChange?: (expiration: string | null) => void;
  
  // Clear all
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  
  // Counts
  activeFilterCount?: number;
  totalContracts?: number;
  filteredCount?: number;
  
  className?: string;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Active', icon: CheckCircle },
  { value: 'processing', label: 'Processing', icon: Loader2 },
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'failed', label: 'Failed', icon: AlertTriangle },
];

const RISK_LEVELS = [
  { value: 'low', label: 'Low Risk', color: 'text-green-600' },
  { value: 'medium', label: 'Medium Risk', color: 'text-yellow-600' },
  { value: 'high', label: 'High Risk', color: 'text-red-600' },
];

const VALUE_RANGES = [
  { value: 'under10k', label: 'Under $10K' },
  { value: '10k-50k', label: '$10K - $50K' },
  { value: '50k-100k', label: '$50K - $100K' },
  { value: '100k-500k', label: '$100K - $500K' },
  { value: 'over500k', label: 'Over $500K' },
];

const EXPIRATION_OPTIONS = [
  { value: 'expired', label: 'Expired', color: 'text-red-600' },
  { value: 'expiring-7', label: 'Expiring in 7 days', color: 'text-orange-600' },
  { value: 'expiring-30', label: 'Expiring in 30 days', color: 'text-yellow-600' },
  { value: 'expiring-90', label: 'Expiring in 90 days', color: 'text-violet-600' },
];

// ============================================================================
// Component
// ============================================================================

export const SearchFiltersBar = memo(function SearchFiltersBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  statusOptions = DEFAULT_STATUS_OPTIONS,
  categoryFilter,
  onCategoryChange,
  categories = [],
  riskFilters = [],
  onRiskChange,
  valueRangeFilter,
  onValueRangeChange,
  typeFilters = [],
  onTypeChange,
  contractTypes = [],
  expirationFilter,
  onExpirationChange,
  onClearFilters,
  hasActiveFilters,
  activeFilterCount = 0,
  totalContracts,
  filteredCount,
  className,
}: SearchFiltersBarProps) {
  // Toggle risk filter
  const toggleRisk = useCallback((risk: string) => {
    if (!onRiskChange) return;
    if (riskFilters.includes(risk)) {
      onRiskChange(riskFilters.filter(r => r !== risk));
    } else {
      onRiskChange([...riskFilters, risk]);
    }
  }, [riskFilters, onRiskChange]);

  // Toggle type filter
  const toggleType = useCallback((type: string) => {
    if (!onTypeChange) return;
    if (typeFilters.includes(type)) {
      onTypeChange(typeFilters.filter(t => t !== type));
    } else {
      onTypeChange([...typeFilters, type]);
    }
  }, [typeFilters, onTypeChange]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Row: Search and Status */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={searchQuery}
            data-testid="contract-search"
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {statusOptions.map(status => {
            const Icon = status.icon;
            const isActive = statusFilter === status.value;
            return (
              <Button
                key={status.value}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 px-3 rounded-md transition-all',
                  isActive && 'bg-background shadow-sm font-medium'
                )}
                onClick={() => onStatusChange(status.value)}
              >
                {Icon && (
                  <Icon className={cn(
                    'h-3.5 w-3.5 mr-1.5',
                    isActive && status.value === 'processing' && 'animate-spin'
                  )} />
                )}
                {status.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Secondary Row: Additional Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category Filter */}
        {categories.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Tag className="h-4 w-4" />
                Category
                {categoryFilter && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    1
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 max-h-64 overflow-y-auto">
              <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onCategoryChange(null)}
                className={cn(!categoryFilter && 'bg-accent')}
              >
                All Categories
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {categories.map(cat => (
                <DropdownMenuItem
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={cn(categoryFilter === cat.id && 'bg-accent')}
                >
                  {cat.color && (
                    <div
                      className="h-2.5 w-2.5 rounded-full mr-2"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                  {cat.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Risk Filter */}
        {onRiskChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Shield className="h-4 w-4" />
                Risk
                {riskFilters.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {riskFilters.length}
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
                  checked={riskFilters.includes(risk.value)}
                  onCheckedChange={() => toggleRisk(risk.value)}
                >
                  <span className={risk.color}>{risk.label}</span>
                </DropdownMenuCheckboxItem>
              ))}
              {riskFilters.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onRiskChange([])}>
                    Clear risk filter
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Value Range Filter */}
        {onValueRangeChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <DollarSign className="h-4 w-4" />
                Value
                {valueRangeFilter && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    1
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel>Filter by Value</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {VALUE_RANGES.map(range => (
                <DropdownMenuItem
                  key={range.value}
                  onClick={() => onValueRangeChange(range.value)}
                  className={cn(valueRangeFilter === range.value && 'bg-accent')}
                >
                  {range.label}
                </DropdownMenuItem>
              ))}
              {valueRangeFilter && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onValueRangeChange(null)}>
                    Clear value filter
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Expiration Filter */}
        {onExpirationChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Calendar className="h-4 w-4" />
                Expiration
                {expirationFilter && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    1
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Filter by Expiration</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {EXPIRATION_OPTIONS.map(option => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onExpirationChange(option.value)}
                  className={cn(expirationFilter === option.value && 'bg-accent')}
                >
                  <span className={option.color}>{option.label}</span>
                </DropdownMenuItem>
              ))}
              {expirationFilter && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onExpirationChange(null)}>
                    Clear expiration filter
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Contract Type Filter */}
        {onTypeChange && contractTypes.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Filter className="h-4 w-4" />
                Type
                {typeFilters.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {typeFilters.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 max-h-64 overflow-y-auto">
              <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {contractTypes.map(type => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={typeFilters.includes(type)}
                  onCheckedChange={() => toggleType(type)}
                >
                  {type}
                </DropdownMenuCheckboxItem>
              ))}
              {typeFilters.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onTypeChange([])}>
                    Clear type filter
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Divider */}
        {hasActiveFilters && (
          <div className="h-6 w-px bg-border mx-1" />
        )}

        {/* Clear All Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={onClearFilters}
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
            {activeFilterCount > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}

        {/* Results Count */}
        {totalContracts !== undefined && filteredCount !== undefined && (
          <div className="ml-auto text-sm text-muted-foreground">
            {filteredCount === totalContracts ? (
              <span>{totalContracts} contracts</span>
            ) : (
              <span>
                Showing <strong>{filteredCount}</strong> of {totalContracts}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default SearchFiltersBar;
