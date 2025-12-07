/**
 * FilterPresetsDropdown Component
 * 
 * A dropdown menu for quickly applying filter presets and saved filters.
 * Combines built-in presets with user's saved filters.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  Filter,
  Clock,
  AlertTriangle,
  DollarSign,
  Shield,
  CheckCircle,
  TrendingUp,
  Calendar,
  Bookmark,
  ChevronRight,
  Search,
  Sparkles,
  Star,
  Pin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  QUICK_PRESETS,
  getPresetsByCategory,
  getGroupedPresets,
  type QuickPreset,
  type FilterState,
  type PresetCategory,
} from '@/hooks/use-contract-filters';
import { useSavedFilters } from '@/hooks/use-saved-filters';

// ============================================================================
// Types
// ============================================================================

interface FilterPresetsDropdownProps {
  onApplyPreset: (filters: Partial<FilterState>) => void;
  currentFilters?: Partial<FilterState>;
  className?: string;
  variant?: 'button' | 'compact' | 'icon';
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  priority: <AlertTriangle className="h-4 w-4" />,
  time: <Clock className="h-4 w-4" />,
  status: <CheckCircle className="h-4 w-4" />,
  value: <DollarSign className="h-4 w-4" />,
  'risk-compliance': <Shield className="h-4 w-4" />,
  workflow: <TrendingUp className="h-4 w-4" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  priority: 'Priority',
  time: 'Time-based',
  status: 'Status',
  value: 'Value',
  'risk-compliance': 'Risk & Compliance',
  workflow: 'Workflow',
};

// ============================================================================
// Main Component
// ============================================================================

export function FilterPresetsDropdown({
  onApplyPreset,
  currentFilters,
  className,
  variant = 'button',
}: FilterPresetsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    state: { savedFilters },
    actions,
    pinnedFilters,
    recentFilters,
  } = useSavedFilters();

  // Get recommended presets (top presets from each category)
  const recommendedPresets = useMemo(() => QUICK_PRESETS.slice(0, 6), []);

  // Get presets grouped by category
  const presetsByCategory = useMemo(() => getGroupedPresets(), []);

  // Filter presets based on search
  const filteredPresets = useMemo(() => {
    if (!searchQuery) return QUICK_PRESETS;
    const query = searchQuery.toLowerCase();
    return QUICK_PRESETS.filter(
      (preset) =>
        preset.label.toLowerCase().includes(query) ||
        preset.description?.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Filter saved filters based on search
  const filteredSavedFilters = useMemo(() => {
    if (!searchQuery) return savedFilters;
    const query = searchQuery.toLowerCase();
    return savedFilters.filter(
      (filter) =>
        filter.name.toLowerCase().includes(query) ||
        filter.description?.toLowerCase().includes(query)
    );
  }, [searchQuery, savedFilters]);

  const handleApplyPreset = (preset: QuickPreset) => {
    // Convert preset.filters to FilterState format
    onApplyPreset(preset.filters as unknown as Partial<FilterState>);
    setOpen(false);
    setSearchQuery('');
  };

  const handleApplySavedFilter = (filter: typeof savedFilters[0]) => {
    actions.recordUsage(filter.id);
    onApplyPreset(filter.filters);
    setOpen(false);
    setSearchQuery('');
  };

  // Render trigger button based on variant
  const renderTrigger = () => {
    switch (variant) {
      case 'icon':
        return (
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Filter className="h-4 w-4" />
          </Button>
        );
      case 'compact':
        return (
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-1" />
            Presets
          </Button>
        );
      default:
        return (
          <Button variant="outline" className={className}>
            <Filter className="h-4 w-4 mr-2" />
            Filter Presets
            <Badge variant="secondary" className="ml-2">
              {QUICK_PRESETS.length + savedFilters.length}
            </Badge>
          </Button>
        );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{renderTrigger()}</PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search presets..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>No presets found.</CommandEmpty>

            {/* Recommended Presets */}
            {!searchQuery && recommendedPresets.length > 0 && (
              <CommandGroup heading="Recommended">
                {recommendedPresets.slice(0, 3).map((preset) => (
                  <CommandItem
                    key={preset.id}
                    onSelect={() => handleApplyPreset(preset)}
                    className="flex items-center gap-3 py-2"
                  >
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-sm"
                      style={{ backgroundColor: `${preset.color}20`, color: preset.color }}
                    >
                      {preset.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{preset.label}</span>
                        <Sparkles className="h-3 w-3 text-amber-500" />
                      </div>
                      {preset.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {preset.description}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            {/* Pinned Saved Filters */}
            {!searchQuery && pinnedFilters.length > 0 && (
              <>
                <CommandGroup heading="Pinned Filters">
                  {pinnedFilters.map((filter) => (
                    <CommandItem
                      key={filter.id}
                      onSelect={() => handleApplySavedFilter(filter)}
                      className="flex items-center gap-3 py-2"
                    >
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-sm"
                        style={{ backgroundColor: `${filter.color || '#6366f1'}20` }}
                      >
                        {filter.icon || '📁'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{filter.name}</span>
                          <Pin className="h-3 w-3 text-primary" />
                        </div>
                        {filter.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {filter.description}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Recent Saved Filters */}
            {!searchQuery && recentFilters.length > 0 && (
              <>
                <CommandGroup heading="Recently Used">
                  {recentFilters.slice(0, 3).map((filter) => (
                    <CommandItem
                      key={filter.id}
                      onSelect={() => handleApplySavedFilter(filter)}
                      className="flex items-center gap-3 py-2"
                    >
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-sm"
                        style={{ backgroundColor: `${filter.color || '#6366f1'}20` }}
                      >
                        {filter.icon || '📁'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{filter.name}</span>
                          <Clock className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Used {filter.usageCount} times
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Preset Categories */}
            {Object.entries(presetsByCategory).map(([category, presets]) => {
              const displayPresets = searchQuery
                ? presets.filter((p) =>
                    p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                : presets;

              if (displayPresets.length === 0) return null;

              return (
                <CommandGroup
                  key={category}
                  heading={
                    <div className="flex items-center gap-2">
                      {CATEGORY_ICONS[category]}
                      <span>{CATEGORY_LABELS[category] || category}</span>
                    </div>
                  }
                >
                  {displayPresets.map((preset) => (
                    <CommandItem
                      key={preset.id}
                      onSelect={() => handleApplyPreset(preset)}
                      className="flex items-center gap-3 py-2"
                    >
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-sm"
                        style={{ backgroundColor: `${preset.color}20`, color: preset.color }}
                      >
                        {preset.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{preset.label}</span>
                        {preset.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {preset.description}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}

            {/* Saved Filters */}
            {filteredSavedFilters.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup
                  heading={
                    <div className="flex items-center gap-2">
                      <Bookmark className="h-4 w-4" />
                      <span>Saved Filters</span>
                    </div>
                  }
                >
                  {filteredSavedFilters
                    .filter((f) => !f.isPinned)
                    .slice(0, 5)
                    .map((filter) => (
                      <CommandItem
                        key={filter.id}
                        onSelect={() => handleApplySavedFilter(filter)}
                        className="flex items-center gap-3 py-2"
                      >
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-sm"
                          style={{ backgroundColor: `${filter.color || '#6366f1'}20` }}
                        >
                          {filter.icon || '📁'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{filter.name}</span>
                            {filter.isDefault && (
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                          {filter.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {filter.description}
                            </p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default FilterPresetsDropdown;
