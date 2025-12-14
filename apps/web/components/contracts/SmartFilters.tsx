"use client";

import React, { useState, useCallback, memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  X,
  Calendar,
  DollarSign,
  Clock,
  Tag,
  Building2,
  ChevronDown,
  ChevronRight,
  Save,
  Trash2,
  Star,
  Sparkles,
  SlidersHorizontal,
  RefreshCw,
  Check,
  Plus,
  BookmarkIcon,
  History,
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, subDays, subMonths, startOfYear, endOfYear, isWithinInterval } from "date-fns";

// Local DateRange type matching our Calendar component
interface DateRange {
  from?: Date;
  to?: Date;
}

// ============================================================================
// Types
// ============================================================================

export type ContractStatus = "draft" | "pending" | "active" | "expired" | "terminated" | "renewal" | "processing" | "completed" | "failed";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface FilterPreset {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  filters: ContractFilters;
  isDefault?: boolean;
  createdAt?: string;
}

export interface ContractFilters {
  search?: string;
  status?: ContractStatus[];
  riskLevel?: RiskLevel[];
  contractType?: string[]; // Added for compatibility
  dateRange?: {
    start?: Date;
    end?: Date;
    from?: Date; // Alias for compatibility
    to?: Date;   // Alias for compatibility
  };
  expiringWithin?: number; // days
  valueRange?: {
    min?: number;
    max?: number;
  };
  tags?: string[];
  parties?: string[];
  types?: string[];
  hasAttachments?: boolean;
  isAnalyzed?: boolean;
  isPinned?: boolean;
  isFavorite?: boolean;
}

export interface SmartFiltersProps {
  filters?: ContractFilters;
  initialFilters?: ContractFilters;
  onFiltersChange: (filters: ContractFilters) => void;
  presets?: FilterPreset[];
  savedPresets?: FilterPreset[];
  onSavePreset?: (name: string, filters: ContractFilters) => void;
  onDeletePreset?: (id: string) => void;
  availableTags?: string[];
  availableParties?: string[];
  availableTypes?: string[];
  searchSuggestions?: string[];
  recentSearches?: string[];
  onSearchSubmit?: (query: string) => void;
  resultCount?: number;
  totalResults?: number;
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Quick Filter Presets (default)
// ============================================================================

const DEFAULT_QUICK_FILTERS: Array<{
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  filters: ContractFilters;
}> = [
  {
    id: "expiring-soon",
    label: "Expiring Soon",
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100",
    filters: { expiringWithin: 30, status: ["active"] },
  },
  {
    id: "high-risk",
    label: "High Risk",
    icon: <TrendingDown className="w-4 h-4" />,
    color: "text-red-600 bg-red-50 border-red-200 hover:bg-red-100",
    filters: { riskLevel: ["high", "critical"] },
  },
  {
    id: "pending-review",
    label: "Pending Review",
    icon: <Clock className="w-4 h-4" />,
    color: "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100",
    filters: { status: ["pending"] },
  },
  {
    id: "active",
    label: "Active",
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    filters: { status: ["active"] },
  },
  {
    id: "drafts",
    label: "Drafts",
    icon: <FileText className="w-4 h-4" />,
    color: "text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100",
    filters: { status: ["draft"] },
  },
  {
    id: "favorites",
    label: "Favorites",
    icon: <Star className="w-4 h-4" />,
    color: "text-yellow-600 bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
    filters: { isFavorite: true },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(value);
}

function getActiveFilterCount(filters: ContractFilters): number {
  let count = 0;
  if (filters.search) count++;
  if (filters.status?.length) count++;
  if (filters.riskLevel?.length) count++;
  if (filters.dateRange?.start || filters.dateRange?.end) count++;
  if (filters.expiringWithin) count++;
  if (filters.valueRange?.min || filters.valueRange?.max) count++;
  if (filters.tags?.length) count++;
  if (filters.parties?.length) count++;
  if (filters.types?.length) count++;
  if (filters.hasAttachments !== undefined) count++;
  if (filters.isAnalyzed !== undefined) count++;
  if (filters.isPinned !== undefined) count++;
  if (filters.isFavorite !== undefined) count++;
  return count;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SearchWithSuggestionsProps {
  value?: string;
  onChange: (value: string) => void;
  onSubmit?: (query: string) => void;
  suggestions?: string[];
  recentSearches?: string[];
  placeholder?: string;
}

const SearchWithSuggestions = memo(function SearchWithSuggestions({
  value = "",
  onChange,
  onSubmit,
  suggestions = [],
  recentSearches = [],
  placeholder = "Search contracts...",
}: SearchWithSuggestionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const handleSelect = (selected: string) => {
    setInputValue(selected);
    onChange(selected);
    onSubmit?.(selected);
    setIsOpen(false);
  };

  const filteredSuggestions = useMemo(() => {
    if (!inputValue) return suggestions.slice(0, 5);
    return suggestions
      .filter((s) => s.toLowerCase().includes(inputValue.toLowerCase()))
      .slice(0, 5);
  }, [inputValue, suggestions]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              onChange(e.target.value);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSubmit?.(inputValue);
                setIsOpen(false);
              }
            }}
            className="pl-10 pr-10"
          />
          {inputValue && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => {
                setInputValue("");
                onChange("");
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandList>
            {/* AI-powered suggestions */}
            {filteredSuggestions.length > 0 && (
              <CommandGroup heading="Suggestions">
                {filteredSuggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion}
                    onSelect={() => handleSelect(suggestion)}
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    {suggestion}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && !inputValue && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recent Searches">
                  {recentSearches.slice(0, 5).map((search) => (
                    <CommandItem
                      key={search}
                      onSelect={() => handleSelect(search)}
                      className="flex items-center gap-2"
                    >
                      <History className="w-4 h-4 text-muted-foreground" />
                      {search}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandEmpty>No suggestions found.</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

const FilterChip = memo(function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
    >
      <Badge
        variant="secondary"
        className="gap-1 pl-2 pr-1 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
      >
        {label}
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-blue-200 rounded-full"
          onClick={onRemove}
        >
          <X className="w-3 h-3" />
        </Button>
      </Badge>
    </motion.div>
  );
});

interface DateRangePickerProps {
  value?: { start?: Date; end?: Date };
  onChange: (range: { start?: Date; end?: Date }) => void;
}

const DateRangePicker = memo(function DateRangePicker({
  value,
  onChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const presets = [
    { label: "Today", range: { start: new Date(), end: new Date() } },
    { label: "Last 7 days", range: { start: subDays(new Date(), 7), end: new Date() } },
    { label: "Last 30 days", range: { start: subDays(new Date(), 30), end: new Date() } },
    { label: "Last 3 months", range: { start: subMonths(new Date(), 3), end: new Date() } },
    { label: "This year", range: { start: startOfYear(new Date()), end: new Date() } },
  ];

  const handleRangeSelect = (range: Date | Date[] | { from?: Date; to?: Date } | undefined) => {
    if (range && typeof range === 'object' && 'from' in range) {
      onChange({ start: range.from, end: range.to });
    } else {
      onChange({ start: undefined, end: undefined });
    }
  };

  const displayValue = useMemo(() => {
    if (value?.start && value?.end) {
      return `${format(value.start, "MMM d")} - ${format(value.end, "MMM d, yyyy")}`;
    }
    if (value?.start) {
      return `From ${format(value.start, "MMM d, yyyy")}`;
    }
    if (value?.end) {
      return `Until ${format(value.end, "MMM d, yyyy")}`;
    }
    return "Select dates";
  }, [value]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !value?.start && !value?.end && "text-muted-foreground"
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="border-r p-2 space-y-1">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => {
                  onChange(preset.range);
                  setIsOpen(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <CalendarComponent
            mode="range"
            selected={{ from: value?.start, to: value?.end }}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
});

interface ValueRangeSliderProps {
  value?: { min?: number; max?: number };
  onChange: (range: { min?: number; max?: number }) => void;
  maxValue?: number;
}

const ValueRangeSlider = memo(function ValueRangeSlider({
  value,
  onChange,
  maxValue = 10000000,
}: ValueRangeSliderProps) {
  const [range, setRange] = useState<[number, number]>([
    value?.min ?? 0,
    value?.max ?? maxValue,
  ]);

  const handleChange = (newRange: number[]) => {
    setRange([newRange[0] ?? 0, newRange[1] ?? maxValue]);
  };

  const handleCommit = (newRange: number[]) => {
    const min = newRange[0] ?? 0;
    const max = newRange[1] ?? maxValue;
    onChange({
      min: min === 0 ? undefined : min,
      max: max === maxValue ? undefined : max,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Min: {formatCurrency(range[0])}</span>
        <span className="text-muted-foreground">Max: {formatCurrency(range[1])}</span>
      </div>
      <Slider
        value={range}
        min={0}
        max={maxValue}
        step={10000}
        onValueChange={handleChange}
        onValueCommit={handleCommit}
        className="w-full"
      />
    </div>
  );
});

interface SavePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}

const SavePresetDialog = memo(function SavePresetDialog({
  open,
  onOpenChange,
  onSave,
}: SavePresetDialogProps) {
  const [name, setName] = useState("");

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      setName("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Save Filter Preset</DialogTitle>
          <DialogDescription>
            Give your filter combination a name to quickly apply it later.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="preset-name" className="mb-2 block">
            Preset Name
          </Label>
          <Input
            id="preset-name"
            placeholder="e.g., High Value Active Contracts"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <Save className="w-4 h-4 mr-2" />
            Save Preset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const SmartFilters = memo(function SmartFilters({
  filters,
  onFiltersChange,
  presets = [],
  onSavePreset,
  onDeletePreset,
  availableTags = [],
  availableParties = [],
  availableTypes = [],
  searchSuggestions = [],
  recentSearches = [],
  onSearchSubmit,
  resultCount,
  isLoading = false,
  className,
}: SmartFiltersProps) {
  // Ensure filters is never undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const effectiveFilters = filters ?? {};
  
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeFilterCount = useMemo(() => getActiveFilterCount(effectiveFilters), [effectiveFilters]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateFilter = useCallback(
    <K extends keyof ContractFilters>(key: K, value: ContractFilters[K]) => {
      onFiltersChange({ ...effectiveFilters, [key]: value });
    },
    [effectiveFilters, onFiltersChange]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const removeFilter = useCallback(
    (key: keyof ContractFilters) => {
      const newFilters = { ...effectiveFilters };
      delete newFilters[key];
      onFiltersChange(newFilters);
    },
    [effectiveFilters, onFiltersChange]
  );

  const clearAllFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const applyPreset = useCallback(
    (preset: FilterPreset) => {
      onFiltersChange(preset.filters);
    },
    [onFiltersChange]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSavePreset = useCallback(
    (name: string) => {
      onSavePreset?.(name, effectiveFilters);
    },
    [effectiveFilters, onSavePreset]
  );

  // Generate active filter chips
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filterChips = useMemo(() => {
    const chips: Array<{ key: keyof ContractFilters; label: string }> = [];

    if (effectiveFilters.status?.length) {
      chips.push({ key: "status", label: `Status: ${effectiveFilters.status.join(", ")}` });
    }
    if (effectiveFilters.riskLevel?.length) {
      chips.push({ key: "riskLevel", label: `Risk: ${effectiveFilters.riskLevel.join(", ")}` });
    }
    if (effectiveFilters.expiringWithin) {
      chips.push({ key: "expiringWithin", label: `Expiring in ${effectiveFilters.expiringWithin} days` });
    }
    if (effectiveFilters.dateRange?.start || effectiveFilters.dateRange?.end) {
      chips.push({ key: "dateRange", label: "Date range set" });
    }
    if (effectiveFilters.valueRange?.min || effectiveFilters.valueRange?.max) {
      chips.push({ key: "valueRange", label: "Value range set" });
    }
    if (effectiveFilters.tags?.length) {
      chips.push({ key: "tags", label: `Tags: ${effectiveFilters.tags.length}` });
    }
    if (effectiveFilters.isFavorite) {
      chips.push({ key: "isFavorite", label: "Favorites only" });
    }
    if (effectiveFilters.isPinned) {
      chips.push({ key: "isPinned", label: "Pinned only" });
    }

    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Search Bar Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search Input */}
        <SearchWithSuggestions
          value={effectiveFilters.search}
          onChange={(value) => updateFilter("search", value || undefined)}
          onSubmit={onSearchSubmit}
          suggestions={searchSuggestions}
          recentSearches={recentSearches}
        />

        {/* Quick Filter Toggle Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isAdvancedOpen ? "default" : "outline"}
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center rounded-full">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle advanced filters</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Saved Presets Dropdown */}
        {presets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <BookmarkIcon className="w-4 h-4" />
                Presets
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {presets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className="flex items-center justify-between"
                  onClick={() => applyPreset(preset)}
                >
                  <span>{preset.name}</span>
                  {onDeletePreset && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePreset(preset.id);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSavePresetOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Save Current Filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Result Count */}
        {resultCount !== undefined && (
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <span className="font-semibold">{resultCount}</span>
            )}
            <span>contracts found</span>
          </div>
        )}
      </div>

      {/* Quick Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {DEFAULT_QUICK_FILTERS.map((qf) => {
          const isActive =
            JSON.stringify(effectiveFilters.status) === JSON.stringify(qf.filters.status) ||
            (qf.filters.isFavorite && effectiveFilters.isFavorite) ||
            (qf.filters.expiringWithin && effectiveFilters.expiringWithin === qf.filters.expiringWithin) ||
            (qf.filters.riskLevel && JSON.stringify(effectiveFilters.riskLevel) === JSON.stringify(qf.filters.riskLevel));

          return (
            <Button
              key={qf.id}
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 border transition-all",
                isActive ? qf.color : "hover:bg-gray-50"
              )}
              onClick={() =>
                isActive ? clearAllFilters() : onFiltersChange({ ...effectiveFilters, ...qf.filters })
              }
            >
              {qf.icon}
              {qf.label}
            </Button>
          );
        })}
      </div>

      {/* Active Filter Chips */}
      <AnimatePresence>
        {filterChips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 flex-wrap"
          >
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {filterChips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onRemove={() => removeFilter(chip.key)}
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={clearAllFilters}
            >
              Clear all
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {isAdvancedOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 rounded-xl border p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status Filter */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="space-y-2">
                    {(["draft", "pending", "active", "expired", "renewal"] as ContractStatus[]).map(
                      (status) => (
                        <div key={status} className="flex items-center gap-2">
                          <Checkbox
                            id={`status-${status}`}
                            checked={effectiveFilters.status?.includes(status) ?? false}
                            onCheckedChange={(checked) => {
                              const current = effectiveFilters.status ?? [];
                              updateFilter(
                                "status",
                                checked
                                  ? [...current, status]
                                  : current.filter((s) => s !== status)
                              );
                            }}
                          />
                          <Label
                            htmlFor={`status-${status}`}
                            className="text-sm font-normal capitalize cursor-pointer"
                          >
                            {status}
                          </Label>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Risk Level Filter */}
                <div className="space-y-2">
                  <Label>Risk Level</Label>
                  <div className="space-y-2">
                    {(["low", "medium", "high", "critical"] as RiskLevel[]).map((risk) => (
                      <div key={risk} className="flex items-center gap-2">
                        <Checkbox
                          id={`risk-${risk}`}
                          checked={effectiveFilters.riskLevel?.includes(risk) ?? false}
                          onCheckedChange={(checked) => {
                            const current = effectiveFilters.riskLevel ?? [];
                            updateFilter(
                              "riskLevel",
                              checked
                                ? [...current, risk]
                                : current.filter((r) => r !== risk)
                            );
                          }}
                        />
                        <Label
                          htmlFor={`risk-${risk}`}
                          className="text-sm font-normal capitalize cursor-pointer"
                        >
                          {risk}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <DateRangePicker
                    value={effectiveFilters.dateRange}
                    onChange={(range) => updateFilter("dateRange", range)}
                  />
                </div>

                {/* Expiring Within */}
                <div className="space-y-2">
                  <Label>Expiring Within</Label>
                  <Select
                    value={effectiveFilters.expiringWithin?.toString() ?? ""}
                    onValueChange={(v) =>
                      updateFilter("expiringWithin", v ? parseInt(v) : undefined)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any time</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Value Range */}
              <div className="space-y-2">
                <Label>Contract Value Range</Label>
                <ValueRangeSlider
                  value={effectiveFilters.valueRange}
                  onChange={(range) => updateFilter("valueRange", range)}
                />
              </div>

              {/* Tags */}
              {availableTags.length > 0 && (
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={effectiveFilters.tags?.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const current = effectiveFilters.tags ?? [];
                          updateFilter(
                            "tags",
                            current.includes(tag)
                              ? current.filter((t) => t !== tag)
                              : [...current, tag]
                          );
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Filters */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="favorites-only"
                    checked={effectiveFilters.isFavorite ?? false}
                    onCheckedChange={(checked) =>
                      updateFilter("isFavorite", checked ? true : undefined)
                    }
                  />
                  <Label htmlFor="favorites-only" className="text-sm cursor-pointer">
                    Favorites only
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pinned-only"
                    checked={effectiveFilters.isPinned ?? false}
                    onCheckedChange={(checked) =>
                      updateFilter("isPinned", checked ? true : undefined)
                    }
                  />
                  <Label htmlFor="pinned-only" className="text-sm cursor-pointer">
                    Pinned only
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-attachments"
                    checked={effectiveFilters.hasAttachments ?? false}
                    onCheckedChange={(checked) =>
                      updateFilter("hasAttachments", checked ? true : undefined)
                    }
                  />
                  <Label htmlFor="has-attachments" className="text-sm cursor-pointer">
                    Has attachments
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is-analyzed"
                    checked={effectiveFilters.isAnalyzed ?? false}
                    onCheckedChange={(checked) =>
                      updateFilter("isAnalyzed", checked ? true : undefined)
                    }
                  />
                  <Label htmlFor="is-analyzed" className="text-sm cursor-pointer">
                    AI analyzed
                  </Label>
                </div>
              </div>

              {/* Actions */}
              <Separator />
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Filters
                </Button>
                {onSavePreset && (
                  <Button variant="outline" size="sm" onClick={() => setSavePresetOpen(true)}>
                    <Save className="w-4 h-4 mr-2" />
                    Save as Preset
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Preset Dialog */}
      <SavePresetDialog
        open={savePresetOpen}
        onOpenChange={setSavePresetOpen}
        onSave={handleSavePreset}
      />
    </div>
  );
});

export default SmartFilters;
