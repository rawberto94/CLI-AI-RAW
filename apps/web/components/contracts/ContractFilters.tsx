"use client";

import { X, Filter, ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CONTRACT_STATUS_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  RISK_LEVEL_OPTIONS,
  type FilterOption,
} from "@/lib/contracts/filters";
import { fadeIn } from "@/lib/contracts/animations";
import { cn } from "@/lib/utils";

// Framer Motion typing workarounds for React 19
const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;

export interface ContractFiltersProps {
  selectedStatuses?: string[];
  selectedTypes?: string[];
  selectedRiskLevels?: string[];
  onStatusChange?: (statuses: string[]) => void;
  onTypeChange?: (types: string[]) => void;
  onRiskLevelChange?: (levels: string[]) => void;
  onClearAll?: () => void;
  className?: string;
}

export function ContractFilters({
  selectedStatuses = [],
  selectedTypes = [],
  selectedRiskLevels = [],
  onStatusChange,
  onTypeChange,
  onRiskLevelChange,
  onClearAll,
  className,
}: ContractFiltersProps) {
  // component state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const totalActiveFilters =
    selectedStatuses.length + selectedTypes.length + selectedRiskLevels.length;

  const handleStatusToggle = (value: string) => {
    const newStatuses = selectedStatuses.includes(value)
      ? selectedStatuses.filter((s) => s !== value)
      : [...selectedStatuses, value];
    onStatusChange?.(newStatuses);
  };

  const handleTypeToggle = (value: string) => {
    const newTypes = selectedTypes.includes(value)
      ? selectedTypes.filter((t) => t !== value)
      : [...selectedTypes, value];
    onTypeChange?.(newTypes);
  };

  const handleRiskLevelToggle = (value: string) => {
    const newLevels = selectedRiskLevels.includes(value)
      ? selectedRiskLevels.filter((l) => l !== value)
      : [...selectedRiskLevels, value];
    onRiskLevelChange?.(newLevels);
  };

  const handleClearAll = () => {
    onClearAll?.();
    setOpenDropdown(null);
  };

  const toggleDropdown = (dropdown: string) => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* Filter Button with Count */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Filters</span>
        {totalActiveFilters > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full">
            {totalActiveFilters}
          </span>
        )}
      </div>

      {/* Status Filter */}
      <FilterDropdown
        label="Status"
        options={CONTRACT_STATUS_OPTIONS}
        selectedValues={selectedStatuses}
        onToggle={handleStatusToggle}
        isOpen={openDropdown === "status"}
        onToggleOpen={() => toggleDropdown("status")}
      />

      {/* Type Filter */}
      <FilterDropdown
        label="Type"
        options={CONTRACT_TYPE_OPTIONS}
        selectedValues={selectedTypes}
        onToggle={handleTypeToggle}
        isOpen={openDropdown === "type"}
        onToggleOpen={() => toggleDropdown("type")}
      />

      {/* Risk Level Filter */}
      <FilterDropdown
        label="Risk Level"
        options={RISK_LEVEL_OPTIONS}
        selectedValues={selectedRiskLevels}
        onToggle={handleRiskLevelToggle}
        isOpen={openDropdown === "risk"}
        onToggleOpen={() => toggleDropdown("risk")}
      />

      {/* Clear All Button */}
      {totalActiveFilters > 0 && (
        <MotionButton
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={handleClearAll}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
            "text-sm font-medium text-gray-600",
            "hover:bg-gray-100 transition-colors"
          )}
        >
          <X className="w-4 h-4" />
          Clear all
        </MotionButton>
      )}

      {/* Active Filter Chips */}
      {totalActiveFilters > 0 && (
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {selectedStatuses.map((status) => (
            <FilterChip
              key={`status-${status}`}
              label={
                CONTRACT_STATUS_OPTIONS.find((o) => o.value === status)
                  ?.label || status
              }
              color={
                CONTRACT_STATUS_OPTIONS.find((o) => o.value === status)?.color
              }
              onRemove={() => handleStatusToggle(status)}
            />
          ))}
          {selectedTypes.map((type) => (
            <FilterChip
              key={`type-${type}`}
              label={
                CONTRACT_TYPE_OPTIONS.find((o) => o.value === type)?.label ||
                type
              }
              onRemove={() => handleTypeToggle(type)}
            />
          ))}
          {selectedRiskLevels.map((level) => (
            <FilterChip
              key={`risk-${level}`}
              label={
                RISK_LEVEL_OPTIONS.find((o) => o.value === level)?.label ||
                level
              }
              color={RISK_LEVEL_OPTIONS.find((o) => o.value === level)?.color}
              onRemove={() => handleRiskLevelToggle(level)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Filter Dropdown Component
interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

function FilterDropdown({
  label,
  options,
  selectedValues,
  onToggle,
  isOpen,
  onToggleOpen,
}: FilterDropdownProps) {
  const selectedCount = selectedValues.length;

  return (
    <div className="relative">
      <button
        onClick={onToggleOpen}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors",
          isOpen || selectedCount > 0
            ? "border-blue-500 bg-blue-50 text-blue-700"
            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        )}
      >
        <span className="text-sm font-medium">{label}</span>
        {selectedCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-600 text-white rounded">
            {selectedCount}
          </span>
        )}
        <ChevronDown
          className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <MotionDiv
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              "absolute top-full left-0 mt-2 z-50",
              "min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg",
              "max-h-80 overflow-y-auto"
            )}
          >
            <div className="p-2">
              {options.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer",
                    "hover:bg-gray-50 transition-colors"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option.value)}
                    onChange={() => onToggle(option.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="flex-1 text-sm text-gray-700">
                    {option.label}
                  </span>
                  {option.count !== undefined && (
                    <span className="text-xs text-gray-500">
                      {option.count}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

// Filter Chip Component
interface FilterChipProps {
  label: string;
  color?: string;
  onRemove: () => void;
}

function FilterChip({ label, color, onRemove }: FilterChipProps) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    green: "bg-green-100 text-green-700 hover:bg-green-200",
    yellow: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
    red: "bg-red-100 text-red-700 hover:bg-red-200",
    gray: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  };

  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
        color && colorClasses[color as keyof typeof colorClasses]
          ? colorClasses[color as keyof typeof colorClasses]
          : colorClasses.gray
      )}
    >
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </MotionDiv>
  );
}
