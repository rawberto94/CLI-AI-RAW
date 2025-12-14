'use client';

/**
 * Metadata Schema Editor
 * 
 * Comprehensive UI for clients to define and manage their custom metadata fields.
 * Features:
 * - Create, edit, delete metadata fields
 * - Organize fields into categories
 * - Define field types and validation rules
 * - Configure AI extraction settings
 * - Import/export schema
 * - Preview field appearance
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Settings,
  Eye,
  EyeOff,
  Sparkles,
  Search,
  Filter,
  Download,
  Upload,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  DollarSign,
  Link,
  Mail,
  Phone,
  Percent,
  Clock,
  FileText,
  Copy,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

interface MetadataFieldDefinition {
  id: string;
  name: string;
  label: string;
  description?: string;
  type: string;
  category: string;
  required: boolean;
  readOnly: boolean;
  hidden: boolean;
  sortOrder: number;
  validations: ValidationRule[];
  options?: SelectOption[];
  min?: number;
  max?: number;
  step?: number;
  currency?: string;
  defaultValue?: any;
  placeholder?: string;
  helpText?: string;
  aiExtractionEnabled: boolean;
  aiExtractionHint?: string;
  aiConfidenceThreshold?: number;
  width?: 'full' | 'half' | 'third' | 'quarter';
  showInList?: boolean;
  showInCard?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MetadataCategory {
  id: string;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
}

interface MetadataSchema {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  isDefault: boolean;
  categories: MetadataCategory[];
  fields: MetadataFieldDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

interface MetadataSchemaEditorProps {
  tenantId?: string;
  className?: string;
  onSchemaChange?: (schema: MetadataSchema) => void;
}

// ============================================================================
// Field Type Configuration
// ============================================================================

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type, description: 'Single line text' },
  { value: 'textarea', label: 'Text Area', icon: FileText, description: 'Multi-line text' },
  { value: 'number', label: 'Number', icon: Hash, description: 'Numeric value' },
  { value: 'currency', label: 'Currency', icon: DollarSign, description: 'Money amount' },
  { value: 'date', label: 'Date', icon: Calendar, description: 'Date picker' },
  { value: 'datetime', label: 'Date & Time', icon: Clock, description: 'Date and time' },
  { value: 'boolean', label: 'Yes/No', icon: ToggleLeft, description: 'Toggle switch' },
  { value: 'select', label: 'Dropdown', icon: List, description: 'Single selection' },
  { value: 'multiselect', label: 'Multi-Select', icon: List, description: 'Multiple selections' },
  { value: 'email', label: 'Email', icon: Mail, description: 'Email address' },
  { value: 'url', label: 'URL', icon: Link, description: 'Web link' },
  { value: 'phone', label: 'Phone', icon: Phone, description: 'Phone number' },
  { value: 'percentage', label: 'Percentage', icon: Percent, description: 'Percentage value' },
];

const CATEGORY_COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'green', label: 'Green', class: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'red', label: 'Red', class: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'gray', label: 'Gray', class: 'bg-gray-100 text-gray-800 border-gray-300' },
];

// ============================================================================
// Main Component
// ============================================================================

export function MetadataSchemaEditor({
  tenantId = 'demo',
  className,
  onSchemaChange,
}: MetadataSchemaEditorProps) {
  // State
  const [schema, setSchema] = useState<MetadataSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['core', 'parties', 'financial']));
  const [editingField, setEditingField] = useState<MetadataFieldDefinition | null>(null);
  const [editingCategory, setEditingCategory] = useState<MetadataCategory | null>(null);
  const [isAddingField, setIsAddingField] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('custom');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Load schema
  useEffect(() => {
    loadSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const loadSchema = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/settings/metadata-schema?tenantId=${tenantId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load schema');
      }
      
      const data = await response.json();
      if (data.success) {
        setSchema(data.data);
        onSchemaChange?.(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // Field Operations
  // =========================================================================

  const handleAddField = useCallback(async (fieldData: Partial<MetadataFieldDefinition>) => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await fetch('/api/settings/metadata-schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          type: 'field',
          ...fieldData,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add field');
      }

      setSuccess('Field added successfully');
      await loadSchema();
      setIsAddingField(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add field');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleUpdateField = useCallback(async (fieldData: MetadataFieldDefinition) => {
    try {
      setSaving(true);
      setError(null);
      
      const { type: fieldType, id: fieldId, ...restFieldData } = fieldData;
      const response = await fetch('/api/settings/metadata-schema', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          ...restFieldData,
          type: 'field',
          id: fieldData.id,
          fieldType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update field');
      }

      setSuccess('Field updated successfully');
      await loadSchema();
      setEditingField(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update field');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleDeleteField = useCallback(async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return;

    try {
      setSaving(true);
      
      const response = await fetch(`/api/settings/metadata-schema?type=field&id=${fieldId}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': tenantId },
      });

      if (!response.ok) {
        throw new Error('Failed to delete field');
      }

      setSuccess('Field deleted');
      await loadSchema();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete field');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // =========================================================================
  // Category Operations
  // =========================================================================

  const handleAddCategory = useCallback(async (categoryData: Partial<MetadataCategory>) => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/settings/metadata-schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          type: 'category',
          ...categoryData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add category');
      }

      setSuccess('Category added');
      await loadSchema();
      setIsAddingCategory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // =========================================================================
  // Schema Operations
  // =========================================================================

  const handleResetToDefault = useCallback(async () => {
    if (!confirm('Reset to default schema? This will remove all custom fields.')) return;

    try {
      setSaving(true);
      
      const response = await fetch('/api/settings/metadata-schema', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({ action: 'reset' }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset schema');
      }

      setSuccess('Schema reset to default');
      await loadSchema();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleExport = useCallback(() => {
    if (!schema) return;
    
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metadata-schema-${tenantId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [schema, tenantId]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      
      const response = await fetch('/api/settings/metadata-schema', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          action: 'import',
          schemaJson: text,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to import schema');
      }

      setSuccess('Schema imported successfully');
      await loadSchema();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // =========================================================================
  // UI Helpers
  // =========================================================================

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getFieldsByCategory = (categoryName: string) => {
    if (!schema) return [];
    return schema.fields
      .filter(f => f.category === categoryName)
      .filter(f => !searchQuery || 
        f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const getFieldTypeIcon = (type: string) => {
    const fieldType = FIELD_TYPES.find(t => t.value === type);
    return fieldType?.icon || Type;
  };

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading schema...</span>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className={cn("text-center py-12", className)}>
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-600">Failed to load metadata schema</p>
        <button
          onClick={loadSchema}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={cn("bg-white dark:bg-gray-900 rounded-xl shadow-sm border", className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Metadata Schema Editor
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Define custom metadata fields for your contracts • Version {schema.version}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg border flex items-center gap-1.5",
                showPreview 
                  ? "bg-purple-50 text-purple-700 border-purple-300" 
                  : "hover:bg-gray-50"
              )}
            >
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <label className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer">
              <Upload className="h-4 w-4" />
              Import
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
              />
            </label>
            <button
              onClick={handleResetToDefault}
              className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-3 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="mt-3 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
            <Check className="h-4 w-4" />
            {success}
            <button onClick={() => setSuccess(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b bg-gray-50/50 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setIsAddingCategory(true)}
          className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50 flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
        <button
          onClick={() => setIsAddingField(true)}
          className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Field
        </button>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Categories & Fields */}
        <div className={cn("flex-1 p-6", showPreview && "w-1/2")}>
          <div className="space-y-4">
            {schema.categories.map((category) => {
              const fields = getFieldsByCategory(category.name);
              const isExpanded = expandedCategories.has(category.name);
              const foundColor = CATEGORY_COLORS.find(c => c.value === category.color);
              const colorConfig = foundColor ?? CATEGORY_COLORS[0] ?? { value: '#6B7280', label: 'Gray', class: 'bg-gray-100 text-gray-800' };

              return (
                <div key={category.id} className="border rounded-lg overflow-hidden">
                  {/* Category Header */}
                  <div
                    className={cn(
                      "px-4 py-3 flex items-center justify-between cursor-pointer",
                      colorConfig.class
                    )}
                    onClick={() => toggleCategory(category.name)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{category.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/50">
                        {fields.length} fields
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategory(category);
                        }}
                        className="p-1 hover:bg-white/30 rounded"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fields */}
                  {isExpanded && (
                    <div className="divide-y">
                      {fields.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500 text-sm">
                          No fields in this category
                        </div>
                      ) : (
                        fields.map((field) => (
                          <FieldRow
                            key={field.id}
                            field={field}
                            onEdit={() => setEditingField(field)}
                            onDelete={() => handleDeleteField(field.id)}
                            getIcon={getFieldTypeIcon}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && schema && (
          <div className="w-1/2 border-l p-6 bg-gray-50">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Field Preview
            </h3>
            <div className="bg-white rounded-lg border p-4 space-y-4">
              {schema.fields.slice(0, 8).map((field) => (
                <FieldPreview key={field.id} field={field} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Field Editor Modal */}
      {(editingField || isAddingField) && (
        <FieldEditorModal
          field={editingField}
          categories={schema.categories}
          onSave={(field) => {
            if (editingField) {
              handleUpdateField(field as MetadataFieldDefinition);
            } else {
              handleAddField(field);
            }
          }}
          onClose={() => {
            setEditingField(null);
            setIsAddingField(false);
          }}
          saving={saving}
        />
      )}

      {/* Category Editor Modal */}
      {(editingCategory || isAddingCategory) && (
        <CategoryEditorModal
          category={editingCategory}
          onSave={(cat) => {
            if (editingCategory) {
              // Update category logic
            } else {
              handleAddCategory(cat);
            }
          }}
          onClose={() => {
            setEditingCategory(null);
            setIsAddingCategory(false);
          }}
          saving={saving}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function FieldRow({
  field,
  onEdit,
  onDelete,
  getIcon,
}: {
  field: MetadataFieldDefinition;
  onEdit: () => void;
  onDelete: () => void;
  getIcon: (type: string) => React.ElementType;
}) {
  const Icon = getIcon(field.type);

  return (
    <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 group">
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100" />
        <div className="p-1.5 rounded bg-gray-100">
          <Icon className="h-4 w-4 text-gray-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{field.label}</span>
            {field.required && (
              <span className="text-xs text-red-500">*</span>
            )}
            {field.aiExtractionEnabled && (
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            )}
            {field.hidden && (
              <EyeOff className="h-3.5 w-3.5 text-gray-400" />
            )}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>{field.name}</span>
            <span>•</span>
            <span className="capitalize">{field.type}</span>
            {field.showInList && (
              <>
                <span>•</span>
                <span className="text-blue-500">List</span>
              </>
            )}
            {field.filterable && (
              <>
                <span>•</span>
                <span className="text-green-500">Filter</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
        <button
          onClick={onEdit}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 hover:bg-red-100 rounded text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function FieldPreview({ field }: { field: MetadataFieldDefinition }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {field.type === 'text' && (
        <input
          type="text"
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          disabled
        />
      )}
      {field.type === 'textarea' && (
        <textarea
          placeholder={field.placeholder}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          rows={2}
          disabled
        />
      )}
      {field.type === 'select' && (
        <select className="w-full px-3 py-2 border rounded-lg text-sm" disabled>
          <option>Select {field.label}...</option>
          {field.options?.map((opt) => (
            <option key={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      {field.type === 'date' && (
        <input type="date" className="w-full px-3 py-2 border rounded-lg text-sm" disabled />
      )}
      {field.type === 'boolean' && (
        <div className="flex items-center gap-2">
          <input type="checkbox" disabled />
          <span className="text-sm text-gray-600">{field.label}</span>
        </div>
      )}
      {field.type === 'number' && (
        <input
          type="number"
          placeholder="0"
          className="w-full px-3 py-2 border rounded-lg text-sm"
          disabled
        />
      )}
      {field.type === 'currency' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={field.currency || 'CHF'}
            className="w-20 px-3 py-2 border rounded-lg text-sm bg-gray-50"
            disabled
          />
          <input
            type="number"
            placeholder="0.00"
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
            disabled
          />
        </div>
      )}
      {field.helpText && (
        <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
      )}
    </div>
  );
}

function FieldEditorModal({
  field,
  categories,
  onSave,
  onClose,
  saving,
}: {
  field: MetadataFieldDefinition | null;
  categories: MetadataCategory[];
  onSave: (field: Partial<MetadataFieldDefinition>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState<Partial<MetadataFieldDefinition>>(
    field || {
      name: '',
      label: '',
      type: 'text',
      category: 'custom',
      required: false,
      aiExtractionEnabled: false,
      showInList: false,
      showInCard: false,
      searchable: false,
      filterable: false,
      options: [],
    }
  );
  const [newOption, setNewOption] = useState('');

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    setFormData({
      ...formData,
      options: [
        ...(formData.options || []),
        { value: newOption.toLowerCase().replace(/\s+/g, '_'), label: newOption },
      ],
    });
    setNewOption('');
  };

  const handleRemoveOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options?.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {field ? 'Edit Field' : 'Add New Field'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Name (Technical)
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="e.g., project_code"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Label
              </label>
              <input
                type="text"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Project Code"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Type
              </label>
              <select
                value={formData.type || 'text'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.category || 'custom'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Options for select/multiselect */}
          {(formData.type === 'select' || formData.type === 'multiselect') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Options
              </label>
              <div className="space-y-2">
                {formData.options?.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) => {
                        const newOptions = [...(formData.options || [])];
                        newOptions[index] = { ...option, label: e.target.value };
                        setFormData({ ...formData, options: newOptions });
                      }}
                      className="flex-1 px-3 py-1.5 border rounded text-sm"
                    />
                    <button
                      onClick={() => handleRemoveOption(index)}
                      className="p-1 hover:bg-red-100 rounded text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
                    placeholder="Add option..."
                    className="flex-1 px-3 py-1.5 border rounded text-sm"
                  />
                  <button
                    onClick={handleAddOption}
                    className="px-3 py-1.5 bg-gray-100 rounded text-sm hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Description & Help */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description / Help Text
            </label>
            <textarea
              value={formData.helpText || ''}
              onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
              placeholder="Help users understand this field..."
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.required || false}
                onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Required field</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.aiExtractionEnabled || false}
                onChange={(e) => setFormData({ ...formData, aiExtractionEnabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                AI Extraction
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.showInList || false}
                onChange={(e) => setFormData({ ...formData, showInList: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Show in list view</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.filterable || false}
                onChange={(e) => setFormData({ ...formData, filterable: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">
                <Filter className="h-3.5 w-3.5 inline mr-1" />
                Filterable
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.searchable || false}
                onChange={(e) => setFormData({ ...formData, searchable: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">
                <Search className="h-3.5 w-3.5 inline mr-1" />
                Searchable
              </span>
            </label>
          </div>

          {/* AI Extraction Hint */}
          {formData.aiExtractionEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Extraction Hint
              </label>
              <input
                type="text"
                value={formData.aiExtractionHint || ''}
                onChange={(e) => setFormData({ ...formData, aiExtractionHint: e.target.value })}
                placeholder="e.g., Look for the project code or reference number"
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Help the AI understand where to find this field in contracts
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={saving || !formData.name || !formData.label}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {field ? 'Update Field' : 'Add Field'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryEditorModal({
  category,
  onSave,
  onClose,
  saving,
}: {
  category: MetadataCategory | null;
  onSave: (category: Partial<MetadataCategory>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState<Partial<MetadataCategory>>(
    category || {
      name: '',
      label: '',
      color: 'blue',
      sortOrder: 999,
    }
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {category ? 'Edit Category' : 'Add New Category'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Name (Technical)
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              placeholder="e.g., project_info"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Label
            </label>
            <input
              type="text"
              value={formData.label || ''}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., Project Information"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border-2 text-sm",
                    color.class,
                    formData.color === color.value ? "ring-2 ring-offset-2 ring-blue-500" : ""
                  )}
                >
                  {color.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={saving || !formData.name || !formData.label}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {category ? 'Update' : 'Add Category'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MetadataSchemaEditor;
