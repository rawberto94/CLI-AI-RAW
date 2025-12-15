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
  Globe,
  Languages,
  CreditCard,
  Repeat,
  Users,
  Shield,
  Wallet,
  CalendarClock,
  Bell,
  Briefcase,
  Hash,
  Banknote,
  FileSignature,
  LayoutGrid,
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
  
  // Enhanced Metadata Filters
  jurisdiction?: string[];
  language?: string[];
  paymentType?: string[];
  billingFrequency?: string[];
  periodicity?: string[];
  currency?: string[];
  signatureStatus?: 'signed' | 'unsigned' | 'pending' | 'all';
  reminderEnabled?: boolean;
  category?: string[];
  confidenceScore?: { min?: number; max?: number };
  needsVerification?: boolean;
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
  availableJurisdictions?: string[];
  availableLanguages?: string[];
  availableCurrencies?: string[];
  availableCategories?: Array<{ id: string; name: string; color?: string }>;
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
  // Enhanced metadata filters
  if (filters.jurisdiction?.length) count++;
  if (filters.language?.length) count++;
  if (filters.paymentType?.length) count++;
  if (filters.billingFrequency?.length) count++;
  if (filters.periodicity?.length) count++;
  if (filters.currency?.length) count++;
  if (filters.signatureStatus && filters.signatureStatus !== 'all') count++;
  if (filters.reminderEnabled !== undefined) count++;
  if (filters.category?.length) count++;
  if (filters.needsVerification !== undefined) count++;
  return count;
}

// ============================================================================
// Metadata Options
// ============================================================================

const PAYMENT_TYPES = [
  { value: 'fixed_price', label: 'Fixed Price', icon: Banknote },
  { value: 'time_and_material', label: 'Time & Material', icon: Clock },
  { value: 'milestone', label: 'Milestone-Based', icon: CheckCircle2 },
  { value: 'subscription', label: 'Subscription', icon: Repeat },
  { value: 'retainer', label: 'Retainer', icon: Briefcase },
  { value: 'none', label: 'No Payment', icon: X },
  { value: 'other', label: 'Other', icon: LayoutGrid },
];

const BILLING_FREQUENCIES = [
  { value: 'one_off', label: 'One-Off', color: 'bg-blue-100 text-blue-700' },
  { value: 'recurring', label: 'Recurring', color: 'bg-green-100 text-green-700' },
  { value: 'mixed', label: 'Mixed', color: 'bg-purple-100 text-purple-700' },
  { value: 'none', label: 'None', color: 'bg-slate-100 text-slate-700' },
];

const PERIODICITIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'on_delivery', label: 'On Delivery' },
  { value: 'on_milestone', label: 'On Milestone' },
];

const COMMON_JURISDICTIONS = [
  { value: 'US', label: 'United States', flag: '🇺🇸' },
  { value: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { value: 'DE', label: 'Germany', flag: '🇩🇪' },
  { value: 'FR', label: 'France', flag: '🇫🇷' },
  { value: 'CH', label: 'Switzerland', flag: '🇨🇭' },
  { value: 'NL', label: 'Netherlands', flag: '🇳🇱' },
  { value: 'SG', label: 'Singapore', flag: '🇸🇬' },
  { value: 'AU', label: 'Australia', flag: '🇦🇺' },
  { value: 'CA', label: 'Canada', flag: '🇨🇦' },
  { value: 'JP', label: 'Japan', flag: '🇯🇵' },
];

const COMMON_LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'de', label: 'German', flag: '🇩🇪' },
  { value: 'fr', label: 'French', flag: '🇫🇷' },
  { value: 'es', label: 'Spanish', flag: '🇪🇸' },
  { value: 'it', label: 'Italian', flag: '🇮🇹' },
  { value: 'nl', label: 'Dutch', flag: '🇳🇱' },
  { value: 'pt', label: 'Portuguese', flag: '🇵🇹' },
  { value: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { value: 'ja', label: 'Japanese', flag: '🇯🇵' },
];

const COMMON_CURRENCIES = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'CHF', label: 'Swiss Franc', symbol: 'Fr' },
  { value: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { value: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
];

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
  availableJurisdictions = COMMON_JURISDICTIONS.map(j => j.value),
  availableLanguages = COMMON_LANGUAGES.map(l => l.value),
  availableCurrencies = COMMON_CURRENCIES.map(c => c.value),
  availableCategories = [],
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
  const [activeFilterSection, setActiveFilterSection] = useState<string | null>(null);

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
    // Enhanced metadata filter chips
    if (effectiveFilters.jurisdiction?.length) {
      const labels = effectiveFilters.jurisdiction.map(j => 
        COMMON_JURISDICTIONS.find(jur => jur.value === j)?.label || j
      );
      chips.push({ key: "jurisdiction", label: `Jurisdiction: ${labels.slice(0, 2).join(", ")}${labels.length > 2 ? ` +${labels.length - 2}` : ''}` });
    }
    if (effectiveFilters.language?.length) {
      const labels = effectiveFilters.language.map(l => 
        COMMON_LANGUAGES.find(lang => lang.value === l)?.label || l
      );
      chips.push({ key: "language", label: `Language: ${labels.slice(0, 2).join(", ")}${labels.length > 2 ? ` +${labels.length - 2}` : ''}` });
    }
    if (effectiveFilters.paymentType?.length) {
      chips.push({ key: "paymentType", label: `Payment: ${effectiveFilters.paymentType.length} types` });
    }
    if (effectiveFilters.billingFrequency?.length) {
      chips.push({ key: "billingFrequency", label: `Billing: ${effectiveFilters.billingFrequency.join(", ")}` });
    }
    if (effectiveFilters.currency?.length) {
      chips.push({ key: "currency", label: `Currency: ${effectiveFilters.currency.join(", ")}` });
    }
    if (effectiveFilters.signatureStatus && effectiveFilters.signatureStatus !== 'all') {
      chips.push({ key: "signatureStatus", label: `Signature: ${effectiveFilters.signatureStatus}` });
    }
    if (effectiveFilters.category?.length) {
      chips.push({ key: "category", label: `Category: ${effectiveFilters.category.length}` });
    }
    if (effectiveFilters.needsVerification) {
      chips.push({ key: "needsVerification", label: "Needs verification" });
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
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Filter Section Tabs */}
              <div className="flex border-b border-slate-200 bg-white/80 backdrop-blur-sm overflow-x-auto">
                {[
                  { id: 'status', label: 'Status & Risk', icon: Shield },
                  { id: 'dates', label: 'Dates & Deadlines', icon: CalendarClock },
                  { id: 'financial', label: 'Financial', icon: Wallet },
                  { id: 'metadata', label: 'Metadata', icon: Globe },
                  { id: 'categories', label: 'Categories & Tags', icon: Tag },
                ].map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveFilterSection(activeFilterSection === section.id ? null : section.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                      activeFilterSection === section.id
                        ? "border-blue-500 text-blue-700 bg-blue-50/50"
                        : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <section.icon className="w-4 h-4" />
                    {section.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                <AnimatePresence mode="wait">
                  {/* Status & Risk Section */}
                  {activeFilterSection === 'status' && (
                    <motion.div
                      key="status"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                      {/* Status Filter */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Contract Status
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["draft", "pending", "active", "processing", "completed", "expired", "renewal", "failed"] as ContractStatus[]).map(
                            (status) => {
                              const isChecked = effectiveFilters.status?.includes(status) ?? false;
                              const statusColors: Record<string, string> = {
                                draft: 'bg-slate-100 text-slate-700 border-slate-200',
                                pending: 'bg-amber-100 text-amber-700 border-amber-200',
                                active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                processing: 'bg-blue-100 text-blue-700 border-blue-200',
                                completed: 'bg-green-100 text-green-700 border-green-200',
                                expired: 'bg-red-100 text-red-700 border-red-200',
                                renewal: 'bg-purple-100 text-purple-700 border-purple-200',
                                failed: 'bg-rose-100 text-rose-700 border-rose-200',
                              };
                              return (
                                <button
                                  key={status}
                                  onClick={() => {
                                    const current = effectiveFilters.status ?? [];
                                    updateFilter(
                                      "status",
                                      isChecked
                                        ? current.filter((s) => s !== status)
                                        : [...current, status]
                                    );
                                  }}
                                  className={cn(
                                    "flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                                    isChecked
                                      ? statusColors[status]
                                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                  )}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5" />}
                                  <span className="capitalize">{status}</span>
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>

                      {/* Risk Level Filter */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Risk Level
                        </Label>
                        <div className="space-y-2">
                          {(["low", "medium", "high", "critical"] as RiskLevel[]).map((risk) => {
                            const isChecked = effectiveFilters.riskLevel?.includes(risk) ?? false;
                            const riskConfig: Record<RiskLevel, { color: string; bg: string }> = {
                              low: { color: 'text-emerald-600', bg: 'bg-emerald-500' },
                              medium: { color: 'text-amber-600', bg: 'bg-amber-500' },
                              high: { color: 'text-orange-600', bg: 'bg-orange-500' },
                              critical: { color: 'text-red-600', bg: 'bg-red-500' },
                            };
                            return (
                              <button
                                key={risk}
                                onClick={() => {
                                  const current = effectiveFilters.riskLevel ?? [];
                                  updateFilter(
                                    "riskLevel",
                                    isChecked
                                      ? current.filter((r) => r !== risk)
                                      : [...current, risk]
                                  );
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
                                  isChecked
                                    ? "bg-slate-50 border-slate-300"
                                    : "bg-white border-slate-200 hover:border-slate-300"
                                )}
                              >
                                <div className={cn("w-3 h-3 rounded-full", riskConfig[risk].bg)} />
                                <span className={cn("text-sm font-medium capitalize flex-1 text-left", isChecked ? riskConfig[risk].color : "text-slate-600")}>
                                  {risk}
                                </span>
                                {isChecked && <Check className="w-4 h-4 text-blue-600" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Signature Status */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <FileSignature className="w-4 h-4 text-indigo-600" />
                          Signature Status
                        </Label>
                        <Select
                          value={effectiveFilters.signatureStatus ?? "all"}
                          onValueChange={(v) =>
                            updateFilter("signatureStatus", v === "all" ? undefined : v as any)
                          }
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="All signatures" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="signed">✅ Fully Signed</SelectItem>
                            <SelectItem value="pending">⏳ Pending Signatures</SelectItem>
                            <SelectItem value="unsigned">❌ Unsigned</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Needs Verification */}
                        <div className="pt-2">
                          <button
                            onClick={() => updateFilter("needsVerification", effectiveFilters.needsVerification ? undefined : true)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
                              effectiveFilters.needsVerification
                                ? "bg-amber-50 border-amber-300 text-amber-700"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            )}
                          >
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-medium flex-1 text-left">Needs Verification</span>
                            {effectiveFilters.needsVerification && <Check className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Dates & Deadlines Section */}
                  {activeFilterSection === 'dates' && (
                    <motion.div
                      key="dates"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                      {/* Date Range */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          Contract Date Range
                        </Label>
                        <DateRangePicker
                          value={effectiveFilters.dateRange}
                          onChange={(range) => updateFilter("dateRange", range)}
                        />
                      </div>

                      {/* Expiring Within */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600" />
                          Expiring Within
                        </Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 7, label: '7d' },
                            { value: 14, label: '14d' },
                            { value: 30, label: '30d' },
                            { value: 60, label: '60d' },
                            { value: 90, label: '90d' },
                            { value: 180, label: '6mo' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={() => updateFilter(
                                "expiringWithin",
                                effectiveFilters.expiringWithin === option.value ? undefined : option.value
                              )}
                              className={cn(
                                "px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                                effectiveFilters.expiringWithin === option.value
                                  ? "bg-amber-100 border-amber-300 text-amber-700"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Reminder Settings */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Bell className="w-4 h-4 text-purple-600" />
                          Reminders
                        </Label>
                        <div className="space-y-2">
                          <button
                            onClick={() => updateFilter("reminderEnabled", effectiveFilters.reminderEnabled === true ? undefined : true)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
                              effectiveFilters.reminderEnabled === true
                                ? "bg-purple-50 border-purple-300 text-purple-700"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            )}
                          >
                            <Check className={cn("w-4 h-4", effectiveFilters.reminderEnabled === true ? "opacity-100" : "opacity-0")} />
                            <span className="text-sm font-medium">Reminders Enabled</span>
                          </button>
                          <button
                            onClick={() => updateFilter("reminderEnabled", effectiveFilters.reminderEnabled === false ? undefined : false)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
                              effectiveFilters.reminderEnabled === false
                                ? "bg-slate-100 border-slate-300 text-slate-700"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            )}
                          >
                            <X className={cn("w-4 h-4", effectiveFilters.reminderEnabled === false ? "opacity-100" : "opacity-0")} />
                            <span className="text-sm font-medium">Reminders Disabled</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Financial Section */}
                  {activeFilterSection === 'financial' && (
                    <motion.div
                      key="financial"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      {/* Value Range */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          Contract Value Range
                        </Label>
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <ValueRangeSlider
                            value={effectiveFilters.valueRange}
                            onChange={(range) => updateFilter("valueRange", range)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Payment Type */}
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-indigo-600" />
                            Payment Type
                          </Label>
                          <div className="space-y-2">
                            {PAYMENT_TYPES.map((type) => {
                              const isChecked = effectiveFilters.paymentType?.includes(type.value) ?? false;
                              const TypeIcon = type.icon;
                              return (
                                <button
                                  key={type.value}
                                  onClick={() => {
                                    const current = effectiveFilters.paymentType ?? [];
                                    updateFilter(
                                      "paymentType",
                                      isChecked
                                        ? current.filter((t) => t !== type.value)
                                        : [...current, type.value]
                                    );
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-sm",
                                    isChecked
                                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                  )}
                                >
                                  <TypeIcon className="w-4 h-4" />
                                  <span className="flex-1 text-left font-medium">{type.label}</span>
                                  {isChecked && <Check className="w-4 h-4" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Billing Frequency */}
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Repeat className="w-4 h-4 text-cyan-600" />
                            Billing Frequency
                          </Label>
                          <div className="space-y-2">
                            {BILLING_FREQUENCIES.map((freq) => {
                              const isChecked = effectiveFilters.billingFrequency?.includes(freq.value) ?? false;
                              return (
                                <button
                                  key={freq.value}
                                  onClick={() => {
                                    const current = effectiveFilters.billingFrequency ?? [];
                                    updateFilter(
                                      "billingFrequency",
                                      isChecked
                                        ? current.filter((f) => f !== freq.value)
                                        : [...current, freq.value]
                                    );
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-sm",
                                    isChecked
                                      ? freq.color + " border-current"
                                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                  )}
                                >
                                  <span className="font-medium">{freq.label}</span>
                                  {isChecked && <Check className="w-4 h-4" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Currency */}
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-emerald-600" />
                            Currency
                          </Label>
                          <div className="grid grid-cols-2 gap-2">
                            {COMMON_CURRENCIES.map((curr) => {
                              const isChecked = effectiveFilters.currency?.includes(curr.value) ?? false;
                              return (
                                <button
                                  key={curr.value}
                                  onClick={() => {
                                    const current = effectiveFilters.currency ?? [];
                                    updateFilter(
                                      "currency",
                                      isChecked
                                        ? current.filter((c) => c !== curr.value)
                                        : [...current, curr.value]
                                    );
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
                                    isChecked
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                  )}
                                >
                                  <span className="font-mono text-lg">{curr.symbol}</span>
                                  <span className="font-medium">{curr.value}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Periodicity */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <CalendarClock className="w-4 h-4 text-violet-600" />
                          Payment Periodicity
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {PERIODICITIES.map((period) => {
                            const isChecked = effectiveFilters.periodicity?.includes(period.value) ?? false;
                            return (
                              <button
                                key={period.value}
                                onClick={() => {
                                  const current = effectiveFilters.periodicity ?? [];
                                  updateFilter(
                                    "periodicity",
                                    isChecked
                                      ? current.filter((p) => p !== period.value)
                                      : [...current, period.value]
                                  );
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
                                  isChecked
                                    ? "bg-violet-100 border-violet-300 text-violet-700"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                )}
                              >
                                {period.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Metadata Section */}
                  {activeFilterSection === 'metadata' && (
                    <motion.div
                      key="metadata"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                      {/* Jurisdiction */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Globe className="w-4 h-4 text-blue-600" />
                          Jurisdiction
                        </Label>
                        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2">
                          {COMMON_JURISDICTIONS.map((jur) => {
                            const isChecked = effectiveFilters.jurisdiction?.includes(jur.value) ?? false;
                            return (
                              <button
                                key={jur.value}
                                onClick={() => {
                                  const current = effectiveFilters.jurisdiction ?? [];
                                  updateFilter(
                                    "jurisdiction",
                                    isChecked
                                      ? current.filter((j) => j !== jur.value)
                                      : [...current, jur.value]
                                  );
                                }}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
                                  isChecked
                                    ? "bg-blue-50 border-blue-300 text-blue-700"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                )}
                              >
                                <span className="text-lg">{jur.flag}</span>
                                <span className="font-medium flex-1 text-left">{jur.label}</span>
                                {isChecked && <Check className="w-4 h-4 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Language */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Languages className="w-4 h-4 text-purple-600" />
                          Contract Language
                        </Label>
                        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2">
                          {COMMON_LANGUAGES.map((lang) => {
                            const isChecked = effectiveFilters.language?.includes(lang.value) ?? false;
                            return (
                              <button
                                key={lang.value}
                                onClick={() => {
                                  const current = effectiveFilters.language ?? [];
                                  updateFilter(
                                    "language",
                                    isChecked
                                      ? current.filter((l) => l !== lang.value)
                                      : [...current, lang.value]
                                  );
                                }}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
                                  isChecked
                                    ? "bg-purple-50 border-purple-300 text-purple-700"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                )}
                              >
                                <span className="text-lg">{lang.flag}</span>
                                <span className="font-medium flex-1 text-left">{lang.label}</span>
                                {isChecked && <Check className="w-4 h-4 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Categories & Tags Section */}
                  {activeFilterSection === 'categories' && (
                    <motion.div
                      key="categories"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      {/* Categories */}
                      {availableCategories.length > 0 && (
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-indigo-600" />
                            Categories
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {availableCategories.map((cat) => {
                              const isChecked = effectiveFilters.category?.includes(cat.id) ?? false;
                              return (
                                <button
                                  key={cat.id}
                                  onClick={() => {
                                    const current = effectiveFilters.category ?? [];
                                    updateFilter(
                                      "category",
                                      isChecked
                                        ? current.filter((c) => c !== cat.id)
                                        : [...current, cat.id]
                                    );
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-full border text-sm font-medium transition-all flex items-center gap-2",
                                    isChecked
                                      ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                  )}
                                  style={cat.color && isChecked ? { backgroundColor: `${cat.color}20`, borderColor: cat.color, color: cat.color } : {}}
                                >
                                  {cat.name}
                                  {isChecked && <Check className="w-3.5 h-3.5" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {availableTags.length > 0 && (
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Hash className="w-4 h-4 text-cyan-600" />
                            Tags
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {availableTags.map((tag) => {
                              const isChecked = effectiveFilters.tags?.includes(tag) ?? false;
                              return (
                                <Badge
                                  key={tag}
                                  variant={isChecked ? "default" : "outline"}
                                  className={cn(
                                    "cursor-pointer transition-all",
                                    isChecked
                                      ? "bg-cyan-100 text-cyan-700 border-cyan-300 hover:bg-cyan-200"
                                      : "hover:bg-slate-100"
                                  )}
                                  onClick={() => {
                                    const current = effectiveFilters.tags ?? [];
                                    updateFilter(
                                      "tags",
                                      isChecked
                                        ? current.filter((t) => t !== tag)
                                        : [...current, tag]
                                    );
                                  }}
                                >
                                  #{tag}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Additional Filters */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">Quick Toggles</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <button
                            onClick={() => updateFilter("isFavorite", effectiveFilters.isFavorite ? undefined : true)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
                              effectiveFilters.isFavorite
                                ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            )}
                          >
                            <Star className={cn("w-4 h-4", effectiveFilters.isFavorite && "fill-current")} />
                            <span className="font-medium">Favorites</span>
                          </button>
                          <button
                            onClick={() => updateFilter("isPinned", effectiveFilters.isPinned ? undefined : true)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
                              effectiveFilters.isPinned
                                ? "bg-blue-50 border-blue-300 text-blue-700"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            )}
                          >
                            <BookmarkIcon className={cn("w-4 h-4", effectiveFilters.isPinned && "fill-current")} />
                            <span className="font-medium">Pinned</span>
                          </button>
                          <button
                            onClick={() => updateFilter("hasAttachments", effectiveFilters.hasAttachments ? undefined : true)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
                              effectiveFilters.hasAttachments
                                ? "bg-slate-100 border-slate-400 text-slate-700"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            <span className="font-medium">Attachments</span>
                          </button>
                          <button
                            onClick={() => updateFilter("isAnalyzed", effectiveFilters.isAnalyzed ? undefined : true)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
                              effectiveFilters.isAnalyzed
                                ? "bg-purple-50 border-purple-300 text-purple-700"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            )}
                          >
                            <Sparkles className="w-4 h-4" />
                            <span className="font-medium">AI Analyzed</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Default view when no section selected */}
                  {!activeFilterSection && (
                    <motion.div
                      key="default"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-8"
                    >
                      <SlidersHorizontal className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500 font-medium">Select a filter category above</p>
                      <p className="text-slate-400 text-sm mt-1">Click on any tab to explore filtering options</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-slate-600 hover:text-slate-900">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset All Filters
                  </Button>
                  <div className="flex gap-2">
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                        {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                      </Badge>
                    )}
                    {onSavePreset && (
                      <Button variant="outline" size="sm" onClick={() => setSavePresetOpen(true)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save as Preset
                      </Button>
                    )}
                  </div>
                </div>
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
