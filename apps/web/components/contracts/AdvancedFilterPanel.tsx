"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  DollarSign,
  Calendar,
  Tag,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOptions {
  clients?: string[];
  suppliers?: string[];
  valueRange?: { min: number; max: number };
  currencies?: string[];
  categories?: string[];
  tags?: string[];
  contractTypes?: string[];
  startDateRange?: { from: Date | null; to: Date | null };
  endDateRange?: { from: Date | null; to: Date | null };
  riskScoreRange?: { min: number; max: number };
  complianceScoreRange?: { min: number; max: number };
  statuses?: string[];
  searchText?: string;
}

export interface AdvancedFilterPanelProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  facets?: {
    clients?: { name: string; count: number }[];
    suppliers?: { name: string; count: number }[];
    categories?: { name: string; count: number }[];
    statuses?: { name: string; count: number }[];
  };
  onClose?: () => void;
  className?: string;
}

export function AdvancedFilterPanel({
  filters,
  onFilterChange,
  facets,
  onClose,
  className,
}: AdvancedFilterPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["parties", "financial", "status"])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const clearAllFilters = () => {
    onFilterChange({});
  };

  const activeFilterCount = Object.values(filters).filter((v) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null
  ).length;

  return (
    <div className={cn("bg-white rounded-lg border shadow-sm", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-lg">Filters</h3>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-blue-600 hover:text-blue-700"
            >
              Clear All
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Parties Section */}
        <FilterSection
          id="parties"
          title="Parties"
          icon={Users}
          expanded={expandedSections.has("parties")}
          onToggle={() => toggleSection("parties")}
        >
          <div className="space-y-4">
            <MultiSelectFilter
              label="Clients"
              selected={filters.clients || []}
              options={facets?.clients || []}
              onChange={(clients) => onFilterChange({ ...filters, clients })}
            />

            <MultiSelectFilter
              label="Suppliers"
              selected={filters.suppliers || []}
              options={facets?.suppliers || []}
              onChange={(suppliers) =>
                onFilterChange({ ...filters, suppliers })
              }
            />
          </div>
        </FilterSection>

        {/* Financial Section */}
        <FilterSection
          id="financial"
          title="Financial"
          icon={DollarSign}
          expanded={expandedSections.has("financial")}
          onToggle={() => toggleSection("financial")}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Value Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.valueRange?.min || ""}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      valueRange: {
                        min: parseFloat(e.target.value) || 0,
                        max: filters.valueRange?.max || 10000000,
                      },
                    })
                  }
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.valueRange?.max || ""}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      valueRange: {
                        min: filters.valueRange?.min || 0,
                        max: parseFloat(e.target.value) || 10000000,
                      },
                    })
                  }
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Currency
              </label>
              <div className="flex flex-wrap gap-2">
                {["USD", "EUR", "GBP", "CHF"].map((currency) => (
                  <button
                    key={currency}
                    onClick={() => {
                      const selected = filters.currencies || [];
                      const newCurrencies = selected.includes(currency)
                        ? selected.filter((c) => c !== currency)
                        : [...selected, currency];
                      onFilterChange({ ...filters, currencies: newCurrencies });
                    }}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md border transition-colors",
                      filters.currencies?.includes(currency)
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FilterSection>

        {/* Risk & Compliance Section */}
        <FilterSection
          id="risk"
          title="Risk & Compliance"
          icon={AlertTriangle}
          expanded={expandedSections.has("risk")}
          onToggle={() => toggleSection("risk")}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Risk Level
              </label>
              <div className="space-y-2">
                {["High", "Medium", "Low"].map((level) => (
                  <label
                    key={level}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.tags?.includes(level.toLowerCase())}
                      onChange={(e) => {
                        const selected = filters.tags || [];
                        const newTags = e.target.checked
                          ? [...selected, level.toLowerCase()]
                          : selected.filter((t) => t !== level.toLowerCase());
                        onFilterChange({ ...filters, tags: newTags });
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{level}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Compliance Score
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.complianceScoreRange?.min || 0}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      complianceScoreRange: {
                        min: parseInt(e.target.value),
                        max: filters.complianceScoreRange?.max || 100,
                      },
                    })
                  }
                  className="w-full"
                />
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{filters.complianceScoreRange?.min || 0}%</span>
                  <span>{filters.complianceScoreRange?.max || 100}%</span>
                </div>
              </div>
            </div>
          </div>
        </FilterSection>

        {/* Status Section */}
        <FilterSection
          id="status"
          title="Status & Type"
          icon={Tag}
          expanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          <div className="space-y-4">
            <MultiSelectFilter
              label="Status"
              selected={filters.statuses || []}
              options={facets?.statuses || []}
              onChange={(statuses) => onFilterChange({ ...filters, statuses })}
            />

            <MultiSelectFilter
              label="Categories"
              selected={filters.categories || []}
              options={facets?.categories || []}
              onChange={(categories) =>
                onFilterChange({ ...filters, categories })
              }
            />
          </div>
        </FilterSection>

        {/* Dates Section */}
        <FilterSection
          id="dates"
          title="Date Ranges"
          icon={Calendar}
          expanded={expandedSections.has("dates")}
          onToggle={() => toggleSection("dates")}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Contract Start Date
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={
                    filters.startDateRange?.from?.toISOString().split("T")[0] ||
                    ""
                  }
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      startDateRange: {
                        from: e.target.value ? new Date(e.target.value) : null,
                        to: filters.startDateRange?.to || null,
                      },
                    })
                  }
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={
                    filters.startDateRange?.to?.toISOString().split("T")[0] ||
                    ""
                  }
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      startDateRange: {
                        from: filters.startDateRange?.from || null,
                        to: e.target.value ? new Date(e.target.value) : null,
                      },
                    })
                  }
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                />
              </div>
            </div>
          </div>
        </FilterSection>
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50 flex items-center gap-2">
        <Button
          onClick={() => {
            // Apply filters (already applied via onChange)
            onClose?.();
          }}
          className="flex-1"
        >
          Apply Filters
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            // Save filter preset
            console.log("Save preset:", filters);
          }}
        >
          Save Preset
        </Button>
      </div>
    </div>
  );
}

function FilterSection({
  id,
  title,
  icon: Icon,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600" />
        )}
      </button>
      {expanded && <div className="p-3 border-t">{children}</div>}
    </div>
  );
}

function MultiSelectFilter({
  label,
  selected,
  options,
  onChange,
}: {
  label: string;
  selected: string[];
  options: { name: string; count: number }[];
  onChange: (selected: string[]) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-2 block">
        {label}
      </label>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {options.map((option) => (
          <label
            key={option.name}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(option.name)}
                onChange={(e) => {
                  const newSelected = e.target.checked
                    ? [...selected, option.name]
                    : selected.filter((s) => s !== option.name);
                  onChange(newSelected);
                }}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                {option.name}
              </span>
            </div>
            <span className="text-xs text-gray-500">{option.count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
