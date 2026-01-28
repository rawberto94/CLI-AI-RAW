/**
 * Advanced Search Filters
 * Comprehensive filter panel for contract search
 */

'use client';

import { memo, useState, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  Calendar,
  DollarSign,
  Building2,
  Tag,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DatePickerWithRange, DateRange } from '@/components/ui/date-range-picker';

export interface SearchFilters {
  query: string;
  status: string[];
  contractType: string[];
  supplier: string[];
  dateRange?: DateRange;
  valueRange: [number, number];
  riskLevel: string[];
  tags: string[];
  hasArtifacts?: boolean;
  processingComplete?: boolean;
}

interface AdvancedSearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  className?: string;
  suppliers?: string[];
  contractTypes?: string[];
  availableTags?: string[];
}

const statusOptions = [
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'processing', label: 'Processing', color: 'bg-violet-100 text-violet-700' },
  { value: 'pending', label: 'Pending', color: 'bg-slate-100 text-slate-700' },
  { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-700' },
  { value: 'archived', label: 'Archived', color: 'bg-amber-100 text-amber-700' },
];

const riskOptions = [
  { value: 'low', label: 'Low Risk', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'Medium Risk', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High Risk', color: 'bg-red-100 text-red-700' },
];

const defaultContractTypes = [
  'MSA', 'NDA', 'SOW', 'Amendment', 'Renewal', 'Purchase Order', 'License', 'Lease', 'Service Agreement', 'Other'
];

export const AdvancedSearchFilters = memo(function AdvancedSearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  className,
  suppliers = [],
  contractTypes = defaultContractTypes,
  availableTags = [],
}: AdvancedSearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const updateFilter = useCallback(<K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  const toggleArrayFilter = useCallback((key: keyof SearchFilters, value: string) => {
    const currentValues = (filters[key] as string[]) || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    updateFilter(key, newValues as SearchFilters[typeof key]);
  }, [filters, updateFilter]);

  const clearFilters = useCallback(() => {
    onFiltersChange({
      query: '',
      status: [],
      contractType: [],
      supplier: [],
      dateRange: undefined,
      valueRange: [0, 10000000],
      riskLevel: [],
      tags: [],
      hasArtifacts: undefined,
      processingComplete: undefined,
    });
  }, [onFiltersChange]);

  const activeFilterCount = [
    filters.status.length > 0,
    filters.contractType.length > 0,
    filters.supplier.length > 0,
    filters.dateRange?.from || filters.dateRange?.to,
    filters.valueRange[0] > 0 || filters.valueRange[1] < 10000000,
    filters.riskLevel.length > 0,
    filters.tags.length > 0,
    filters.hasArtifacts !== undefined,
    filters.processingComplete !== undefined,
  ].filter(Boolean).length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search contracts by name, content, or clause..."
            value={filters.query}
            onChange={(e) => updateFilter('query', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            className="pl-10 h-11"
          />
        </div>
        
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'gap-2 h-11',
            activeFilterCount > 0 && 'border-violet-300 bg-violet-50'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 bg-violet-600 text-white">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        <Button onClick={onSearch} className="h-11 px-6">
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {/* Quick Filter Pills */}
      {(filters.status.length > 0 || filters.contractType.length > 0 || filters.riskLevel.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.status.map(status => {
            const option = statusOptions.find(o => o.value === status);
            return (
              <Badge
                key={status}
                variant="secondary"
                className={cn('gap-1 pr-1', option?.color)}
              >
                {option?.label || status}
                <button
                  onClick={() => toggleArrayFilter('status', status)}
                  className="ml-1 hover:bg-black/10 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {filters.contractType.map(type => (
            <Badge key={type} variant="secondary" className="gap-1 pr-1">
              {type}
              <button
                onClick={() => toggleArrayFilter('contractType', type)}
                className="ml-1 hover:bg-black/10 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.riskLevel.map(risk => {
            const option = riskOptions.find(o => o.value === risk);
            return (
              <Badge
                key={risk}
                variant="secondary"
                className={cn('gap-1 pr-1', option?.color)}
              >
                {option?.label || risk}
                <button
                  onClick={() => toggleArrayFilter('riskLevel', risk)}
                  className="ml-1 hover:bg-black/10 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 text-xs gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Expanded Filters */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="grid grid-cols-4 gap-6 p-6 bg-slate-50 rounded-xl border">
            {/* Status Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Status
              </Label>
              <div className="space-y-2">
                {statusOptions.map(option => (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`status-${option.value}`}
                      checked={filters.status.includes(option.value)}
                      onCheckedChange={() => toggleArrayFilter('status', option.value)}
                    />
                    <label
                      htmlFor={`status-${option.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Contract Type Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-400" />
                Contract Type
              </Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {contractTypes.map(type => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={filters.contractType.includes(type)}
                      onCheckedChange={() => toggleArrayFilter('contractType', type)}
                    />
                    <label
                      htmlFor={`type-${type}`}
                      className="text-sm cursor-pointer"
                    >
                      {type}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Level Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" />
                Risk Level
              </Label>
              <div className="space-y-2">
                {riskOptions.map(option => (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`risk-${option.value}`}
                      checked={filters.riskLevel.includes(option.value)}
                      onCheckedChange={() => toggleArrayFilter('riskLevel', option.value)}
                    />
                    <label
                      htmlFor={`risk-${option.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Value Range Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-slate-400" />
                Contract Value
              </Label>
              <div className="space-y-4">
                <Slider
                  value={filters.valueRange}
                  onValueChange={(value) => updateFilter('valueRange', value as [number, number])}
                  min={0}
                  max={10000000}
                  step={100000}
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>${(filters.valueRange[0] / 1000000).toFixed(1)}M</span>
                  <span>${(filters.valueRange[1] / 1000000).toFixed(1)}M</span>
                </div>
              </div>

              {/* Additional Options */}
              <div className="pt-4 space-y-2 border-t mt-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-artifacts"
                    checked={filters.hasArtifacts === true}
                    onCheckedChange={(checked) => 
                      updateFilter('hasArtifacts', checked ? true : undefined)
                    }
                  />
                  <label htmlFor="has-artifacts" className="text-sm cursor-pointer">
                    Has AI artifacts
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="processing-complete"
                    checked={filters.processingComplete === true}
                    onCheckedChange={(checked) => 
                      updateFilter('processingComplete', checked ? true : undefined)
                    }
                  />
                  <label htmlFor="processing-complete" className="text-sm cursor-pointer">
                    Processing complete
                  </label>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});
