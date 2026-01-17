'use client';

/**
 * Metadata Field Selector
 * 
 * A compact selector component for choosing and applying metadata fields.
 * Used when editing contracts to quickly select which fields to populate.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Check,
  ChevronDown,
  Sparkles,
  X,
  Settings,
  Filter,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface MetadataFieldDefinition {
  id: string;
  name: string;
  label: string;
  type: string;
  category: string;
  required: boolean;
  aiExtractionEnabled: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: any;
  placeholder?: string;
}

interface MetadataCategory {
  id: string;
  name: string;
  label: string;
  color?: string;
}

interface MetadataFieldSelectorProps {
  tenantId?: string;
  selectedFields?: string[];
  onFieldsChange?: (fieldNames: string[]) => void;
  onFieldValueChange?: (fieldName: string, value: any) => void;
  values?: Record<string, any>;
  mode?: 'selector' | 'editor' | 'compact';
  showAIFields?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function MetadataFieldSelector({
  tenantId = 'demo',
  selectedFields = [],
  onFieldsChange,
  onFieldValueChange,
  values = {},
  mode = 'selector',
  showAIFields = true,
  className,
}: MetadataFieldSelectorProps) {
  const [schema, setSchema] = useState<{
    categories: MetadataCategory[];
    fields: MetadataFieldDefinition[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Load schema
  useEffect(() => {
    async function loadSchema() {
      try {
        const response = await fetch(`/api/settings/metadata-schema?tenantId=${tenantId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSchema({
              categories: data.data.categories,
              fields: data.data.fields,
            });
          }
        }
      } catch {
        // Error handled silently
      } finally {
        setLoading(false);
      }
    }
    loadSchema();
  }, [tenantId]);

  // Filter fields
  const filteredFields = useMemo(() => {
    if (!schema) return [];
    return schema.fields.filter(field => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          field.label.toLowerCase().includes(query) ||
          field.name.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [schema, searchQuery]);

  // Group by category
  const groupedFields = useMemo(() => {
    const groups: Record<string, MetadataFieldDefinition[]> = {};
    filteredFields.forEach(field => {
      if (!groups[field.category]) {
        groups[field.category] = [];
      }
      const group = groups[field.category];
      if (group) {
        group.push(field);
      }
    });
    return groups;
  }, [filteredFields]);

  const toggleField = useCallback((fieldName: string) => {
    const newSelection = selectedFields.includes(fieldName)
      ? selectedFields.filter(f => f !== fieldName)
      : [...selectedFields, fieldName];
    onFieldsChange?.(newSelection);
  }, [selectedFields, onFieldsChange]);

  const selectAllInCategory = useCallback((categoryName: string) => {
    const categoryFields = groupedFields[categoryName]?.map(f => f.name) || [];
    const allSelected = categoryFields.every(f => selectedFields.includes(f));
    
    if (allSelected) {
      onFieldsChange?.(selectedFields.filter(f => !categoryFields.includes(f)));
    } else {
      onFieldsChange?.([...new Set([...selectedFields, ...categoryFields])]);
    }
  }, [groupedFields, selectedFields, onFieldsChange]);

  const getCategoryColor = (categoryName: string) => {
    const category = schema?.categories.find(c => c.name === categoryName);
    const colors: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      purple: 'bg-purple-100 text-purple-800',
      red: 'bg-red-100 text-red-800',
      orange: 'bg-orange-100 text-orange-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return colors[category?.color || 'gray'] || colors.gray;
  };

  // Compact mode - just show selected count and dropdown
  if (mode === 'compact') {
    return (
      <div className={cn("relative", className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
        >
          <Filter className="h-4 w-4 text-gray-500" />
          <span>
            {selectedFields.length > 0 
              ? `${selectedFields.length} fields selected`
              : 'Select fields'
            }
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-2 w-72 bg-white rounded-lg shadow-lg border">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border rounded"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : (
                Object.entries(groupedFields).map(([category, fields]) => (
                  <div key={category} className="mb-2">
                    <div className={cn("px-2 py-1 text-xs font-medium rounded", getCategoryColor(category))}>
                      {schema?.categories.find(c => c.name === category)?.label || category}
                    </div>
                    {fields.map(field => (
                      <label
                        key={field.id}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field.name)}
                          onChange={() => toggleField(field.name)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{field.label}</span>
                        {field.required && <span className="text-red-500 text-xs">*</span>}
                        {field.aiExtractionEnabled && showAIFields && (
                          <Sparkles className="h-3 w-3 text-purple-500 ml-auto" />
                        )}
                      </label>
                    ))}
                  </div>
                ))
              )}
            </div>
            <div className="p-2 border-t flex justify-between text-xs">
              <button
                onClick={() => onFieldsChange?.([])}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Editor mode - show fields with inputs
  if (mode === 'editor') {
    const fieldsToShow = schema?.fields.filter(f => 
      selectedFields.length === 0 || selectedFields.includes(f.name)
    ) || [];

    return (
      <div className={cn("space-y-4", className)}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          Object.entries(groupedFields)
            .filter(([_, fields]) => fields.some(f => selectedFields.length === 0 || selectedFields.includes(f.name)))
            .map(([category, fields]) => (
              <div key={category} className="space-y-3">
                <h3 className={cn("text-sm font-medium px-2 py-1 rounded inline-block", getCategoryColor(category))}>
                  {schema?.categories.find(c => c.name === category)?.label || category}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {fields
                    .filter(f => selectedFields.length === 0 || selectedFields.includes(f.name))
                    .map(field => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                          {field.aiExtractionEnabled && (
                            <Sparkles className="h-3 w-3 text-purple-500 inline ml-1" />
                          )}
                        </label>
                        {renderFieldInput(field, values[field.name], (value) => {
                          onFieldValueChange?.(field.name, value);
                        })}
                      </div>
                    ))}
                </div>
              </div>
            ))
        )}
      </div>
    );
  }

  // Selector mode (default) - show categories with checkboxes
  return (
    <div className={cn("bg-white rounded-lg border", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">Metadata Fields</h3>
          <a
            href="/settings/metadata"
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Settings className="h-3 w-3" />
            Manage Schema
          </a>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg"
          />
        </div>
      </div>

      {/* Field List */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          Object.entries(groupedFields).map(([category, fields]) => {
            const categoryLabel = schema?.categories.find(c => c.name === category)?.label || category;
            const allSelected = fields.every(f => selectedFields.includes(f.name));
            const someSelected = fields.some(f => selectedFields.includes(f.name));
            const isExpanded = expandedCategory === category;

            return (
              <div key={category} className="border-b last:border-b-0">
                {/* Category Header */}
                <div
                  className={cn(
                    "flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50",
                    getCategoryColor(category)
                  )}
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", !isExpanded && "-rotate-90")} />
                    <span className="font-medium">{categoryLabel}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-white/50 rounded">
                      {fields.length}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInCategory(category);
                    }}
                    className={cn(
                      "text-xs px-2 py-1 rounded",
                      allSelected ? "bg-blue-100 text-blue-700" : "hover:bg-white/50"
                    )}
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Fields */}
                {isExpanded && (
                  <div className="px-4 py-2 bg-white space-y-1">
                    {fields.map(field => (
                      <label
                        key={field.id}
                        className="flex items-center gap-3 py-2 px-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field.name)}
                          onChange={() => toggleField(field.name)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{field.label}</span>
                            {field.required && (
                              <span className="text-xs text-red-500">Required</span>
                            )}
                            {field.aiExtractionEnabled && showAIFields && (
                              <span className="flex items-center gap-0.5 text-xs text-purple-600">
                                <Sparkles className="h-3 w-3" />
                                AI
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 capitalize">{field.type}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {selectedFields.length} of {schema?.fields.length || 0} fields selected
        </span>
        {selectedFields.length > 0 && (
          <button
            onClick={() => onFieldsChange?.([])}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helper: Render Field Input
// ============================================================================

function renderFieldInput(
  field: MetadataFieldDefinition,
  value: any,
  onChange: (value: any) => void
) {
  const baseClass = "w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
      return (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={baseClass}
        />
      );

    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={2}
          className={baseClass}
        />
      );

    case 'number':
    case 'percentage':
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          placeholder={field.placeholder}
          className={baseClass}
        />
      );

    case 'currency':
      return (
        <div className="flex gap-2">
          <span className="px-3 py-2 bg-gray-100 border rounded-lg text-sm">CHF</span>
          <input
            type="number"
            step="0.01"
            value={value || ''}
            onChange={(e) => onChange(e.target.valueAsNumber)}
            placeholder="0.00"
            className={cn(baseClass, "flex-1")}
          />
        </div>
      );

    case 'date':
      return (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      );

    case 'datetime':
      return (
        <input
          type="datetime-local"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-600">Yes</span>
        </label>
      );

    case 'select':
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        >
          <option value="">Select...</option>
          {field.options?.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case 'multiselect':
      return (
        <div className="flex flex-wrap gap-1 p-2 border rounded-lg min-h-[42px]">
          {field.options?.map(opt => {
            const isSelected = Array.isArray(value) && value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = Array.isArray(value) ? value : [];
                  const next = isSelected
                    ? current.filter(v => v !== opt.value)
                    : [...current, opt.value];
                  onChange(next);
                }}
                className={cn(
                  "px-2 py-1 text-xs rounded-full border",
                  isSelected 
                    ? "bg-blue-100 text-blue-700 border-blue-300" 
                    : "hover:bg-gray-100"
                )}
              >
                {isSelected && <Check className="h-3 w-3 inline mr-1" />}
                {opt.label}
              </button>
            );
          })}
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      );
  }
}

export default MetadataFieldSelector;
