'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X,
  Calendar,
  DollarSign,
  CheckCircle2,
  FileText,
  Tag,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { FilterState } from './AdvancedFilterPanel';

interface ActiveFilterChipsProps {
  filters: FilterState;
  searchQuery: string;
  onClearFilter: (filterType: keyof FilterState, value?: any) => void;
  onClearSearch: () => void;
  onClearAll: () => void;
}

export function ActiveFilterChips({
  filters,
  searchQuery,
  onClearFilter,
  onClearSearch,
  onClearAll,
}: ActiveFilterChipsProps) {
  const hasActiveFilters =
    filters.statuses.length > 0 ||
    filters.documentRoles.length > 0 ||
    filters.categories.length > 0 ||
    filters.dateRange.from ||
    filters.dateRange.to ||
    filters.valueRange.min > 0 ||
    filters.valueRange.max < 1000000 ||
    filters.hasDeadline !== null ||
    filters.isExpiring !== null ||
    searchQuery;

  if (!hasActiveFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
      <span className="text-xs font-semibold text-slate-700 mr-1">Active Filters:</span>

      {/* Search Query Chip */}
      {searchQuery && (
        <FilterChip
          icon={<CheckCircle2 className="h-3 w-3" />}
          label={`Search: "${searchQuery}"`}
          onRemove={onClearSearch}
          color="blue"
        />
      )}

      {/* Status Chips */}
      {filters.statuses.map(status => (
        <FilterChip
          key={status}
          icon={<CheckCircle2 className="h-3 w-3" />}
          label={formatStatus(status)}
          onRemove={() => onClearFilter('statuses', status)}
          color="indigo"
        />
      ))}

      {/* Document Role Chips */}
      {filters.documentRoles.map(role => (
        <FilterChip
          key={role}
          icon={<FileText className="h-3 w-3" />}
          label={formatDocumentRole(role)}
          onRemove={() => onClearFilter('documentRoles', role)}
          color="purple"
        />
      ))}

      {/* Date Range Chip */}
      {(filters.dateRange.from || filters.dateRange.to) && (
        <FilterChip
          icon={<Calendar className="h-3 w-3" />}
          label={formatDateRange(filters.dateRange.from, filters.dateRange.to)}
          onRemove={() => onClearFilter('dateRange')}
          color="blue"
        />
      )}

      {/* Value Range Chip */}
      {(filters.valueRange.min > 0 || filters.valueRange.max < 1000000) && (
        <FilterChip
          icon={<DollarSign className="h-3 w-3" />}
          label={formatValueRange(filters.valueRange.min, filters.valueRange.max)}
          onRemove={() => onClearFilter('valueRange')}
          color="green"
        />
      )}

      {/* Category Chips */}
      {filters.categories.map(category => (
        <FilterChip
          key={category}
          icon={<Tag className="h-3 w-3" />}
          label={category}
          onRemove={() => onClearFilter('categories', category)}
          color="amber"
        />
      ))}

      {/* Quick Toggle Chips */}
      {filters.hasDeadline === true && (
        <FilterChip
          icon={<Calendar className="h-3 w-3" />}
          label="Has Deadline"
          onRemove={() => onClearFilter('hasDeadline')}
          color="orange"
        />
      )}

      {filters.isExpiring === true && (
        <FilterChip
          icon={<Calendar className="h-3 w-3" />}
          label="Expiring Soon"
          onRemove={() => onClearFilter('isExpiring')}
          color="red"
        />
      )}

      {/* Clear All Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-7 px-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
      >
        <XCircle className="h-3 w-3 mr-1" />
        Clear All
      </Button>
    </div>
  );
}

interface FilterChipProps {
  icon: React.ReactNode;
  label: string;
  onRemove: () => void;
  color: 'blue' | 'indigo' | 'purple' | 'green' | 'amber' | 'orange' | 'red';
}

function FilterChip({ icon, label, onRemove, color }: FilterChipProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200',
    green: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200',
    red: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1.5 pl-2 pr-1 py-1 transition-colors cursor-default',
        colorClasses[color]
      )}
    >
      {icon}
      <span className="text-xs font-medium max-w-[200px] truncate">{label}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-1 rounded-full p-0.5 hover:bg-white/50 transition-colors"
        aria-label="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

// Helper functions for formatting
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    EXPIRED: 'Expired',
  };
  return statusMap[status] || status;
}

function formatDocumentRole(role: string): string {
  const roleMap: Record<string, string> = {
    NEW_CONTRACT: 'New Contract',
    EXISTING: 'Existing',
    AMENDMENT: 'Amendment',
    RENEWAL: 'Renewal',
  };
  return roleMap[role] || role;
}

function formatDateRange(from?: Date, to?: Date): string {
  if (from && to) {
    return `${format(from, 'MMM d')} - ${format(to, 'MMM d, yyyy')}`;
  }
  if (from) {
    return `From ${format(from, 'MMM d, yyyy')}`;
  }
  if (to) {
    return `Until ${format(to, 'MMM d, yyyy')}`;
  }
  return 'Date Range';
}

function formatValueRange(min: number, max: number): string {
  if (min > 0 && max < 1000000) {
    return `$${(min / 1000).toFixed(0)}K - $${(max / 1000).toFixed(0)}K`;
  }
  if (min > 0) {
    return `Min $${(min / 1000).toFixed(0)}K`;
  }
  if (max < 1000000) {
    return `Max $${(max / 1000).toFixed(0)}K`;
  }
  return 'Value Range';
}
