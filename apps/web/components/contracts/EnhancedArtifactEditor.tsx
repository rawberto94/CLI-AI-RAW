'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Edit3,
  Eye,
  RotateCcw,
  History,
  Plus,
  Trash2,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  DollarSign,
  Users,
  Clock,
  MapPin,
  Hash,
  Type,
  List,
  ToggleLeft,
  AlertTriangle,
} from 'lucide-react';

// =========================================================================
// TYPES
// =========================================================================

interface ArtifactEditorProps {
  artifact: {
    id: string;
    type: string;
    data: Record<string, any>;
    contractId: string;
    isEdited?: boolean;
    editCount?: number;
    lastEditedAt?: string;
    lastEditedBy?: string;
    confidence?: number;
    validationStatus?: 'valid' | 'warning' | 'error';
    validationIssues?: any[];
  };
  contractId: string;
  onSave?: (updatedArtifact: any) => void;
  onCancel?: () => void;
  onRegenerate?: () => void;
  showHistory?: () => void;
  readOnly?: boolean;
}

interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'date' | 'currency' | 'array' | 'object' | 'textarea' | 'email' | 'url' | 'phone';
  label: string;
  description?: string;
  required?: boolean;
  editable?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  pattern?: RegExp;
  group?: string;
}

// =========================================================================
// FIELD SCHEMAS BY ARTIFACT TYPE
// =========================================================================

const artifactFieldSchemas: Record<string, Record<string, FieldSchema>> = {
  overview: {
    title: { type: 'string', label: 'Contract Title', required: true, group: 'Basic Info' },
    contractType: { type: 'string', label: 'Contract Type', group: 'Basic Info' },
    summary: { type: 'textarea', label: 'Summary', group: 'Basic Info' },
    effectiveDate: { type: 'date', label: 'Effective Date', group: 'Dates' },
    expirationDate: { type: 'date', label: 'Expiration Date', group: 'Dates' },
    renewalDate: { type: 'date', label: 'Renewal Date', group: 'Dates' },
    terminationDate: { type: 'date', label: 'Termination Date', group: 'Dates' },
    autoRenewal: { type: 'boolean', label: 'Auto Renewal', group: 'Terms' },
    noticePeriodDays: { type: 'number', label: 'Notice Period (Days)', group: 'Terms', min: 0 },
    governingLaw: { type: 'string', label: 'Governing Law', group: 'Legal' },
    jurisdiction: { type: 'string', label: 'Jurisdiction', group: 'Legal' },
  },
  parties: {
    parties: { type: 'array', label: 'Contract Parties', group: 'Parties' },
  },
  financial: {
    totalValue: { type: 'currency', label: 'Total Contract Value', group: 'Value' },
    currency: { type: 'string', label: 'Currency', group: 'Value' },
    paymentTerms: { type: 'string', label: 'Payment Terms', group: 'Payment' },
    paymentFrequency: { type: 'string', label: 'Payment Frequency', group: 'Payment' },
    invoicingDetails: { type: 'textarea', label: 'Invoicing Details', group: 'Payment' },
    penalties: { type: 'textarea', label: 'Penalties & Late Fees', group: 'Penalties' },
  },
  obligations: {
    obligations: { type: 'array', label: 'Contractual Obligations', group: 'Obligations' },
    deliverables: { type: 'array', label: 'Deliverables', group: 'Deliverables' },
    milestones: { type: 'array', label: 'Milestones', group: 'Milestones' },
  },
  risks: {
    risks: { type: 'array', label: 'Identified Risks', group: 'Risks' },
    liabilityLimit: { type: 'currency', label: 'Liability Limit', group: 'Liability' },
    indemnificationClauses: { type: 'textarea', label: 'Indemnification Clauses', group: 'Liability' },
    insuranceRequirements: { type: 'textarea', label: 'Insurance Requirements', group: 'Insurance' },
  },
  clauses: {
    clauses: { type: 'array', label: 'Key Clauses', group: 'Clauses' },
    specialProvisions: { type: 'array', label: 'Special Provisions', group: 'Provisions' },
  },
  rates: {
    rates: { type: 'array', label: 'Rate Card Entries', group: 'Rates' },
    currency: { type: 'string', label: 'Default Currency', group: 'Settings' },
    effectiveFrom: { type: 'date', label: 'Rates Effective From', group: 'Settings' },
    effectiveTo: { type: 'date', label: 'Rates Effective To', group: 'Settings' },
  },
};

// =========================================================================
// FIELD RENDERERS
// =========================================================================

function getFieldIcon(type: string) {
  switch (type) {
    case 'string': return <Type className="h-4 w-4" />;
    case 'number': return <Hash className="h-4 w-4" />;
    case 'currency': return <DollarSign className="h-4 w-4" />;
    case 'date': return <CalendarIcon className="h-4 w-4" />;
    case 'boolean': return <ToggleLeft className="h-4 w-4" />;
    case 'array': return <List className="h-4 w-4" />;
    case 'textarea': return <FileText className="h-4 w-4" />;
    default: return <Type className="h-4 w-4" />;
  }
}

// =========================================================================
// MAIN COMPONENT
// =========================================================================

export function EnhancedArtifactEditor({
  artifact,
  contractId,
  onSave,
  onCancel,
  onRegenerate,
  showHistory,
  readOnly = false,
}: ArtifactEditorProps) {
  const [isEditing, setIsEditing] = useState(!readOnly);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, any>>(artifact.data || {});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Basic Info']));
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());

  // Get field schema for this artifact type
  const fieldSchema = useMemo(() => {
    return artifactFieldSchemas[artifact.type.toLowerCase()] || {};
  }, [artifact.type]);

  // Group fields by their group property
  const groupedFields = useMemo(() => {
    const groups: Record<string, string[]> = {};
    
    // First add schema-defined fields
    Object.entries(fieldSchema).forEach(([key, schema]) => {
      const group = schema.group || 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(key);
    });

    // Then add any fields from data that aren't in schema
    Object.keys(editedData).forEach((key) => {
      if (!fieldSchema[key]) {
        if (!groups['Other']) groups['Other'] = [];
        if (!groups['Other'].includes(key)) groups['Other'].push(key);
      }
    });

    return groups;
  }, [fieldSchema, editedData]);

  // Track changes
  const handleFieldChange = useCallback((fieldPath: string, value: any) => {
    setEditedData((prev) => {
      const newData = { ...prev };
      const keys = fieldPath.split('.');
      let current: any = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key) {
          if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
          }
          current = current[key];
        }
      }
      
      const lastKey = keys[keys.length - 1];
      if (lastKey) {
        current[lastKey] = value;
      }
      return newData;
    });

    setChangedFields((prev) => new Set([...prev, fieldPath]));
  }, []);

  // Handle array operations
  const handleArrayAdd = useCallback((fieldPath: string, defaultItem: any = {}) => {
    setEditedData((prev) => {
      const newData = { ...prev };
      const keys = fieldPath.split('.');
      let current: any = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key) current = current[key];
      }
      
      const lastKey = keys[keys.length - 1];
      if (lastKey) {
        if (!Array.isArray(current[lastKey])) {
          current[lastKey] = [];
        }
        current[lastKey] = [...current[lastKey], defaultItem];
      }
      return newData;
    });
    setChangedFields((prev) => new Set([...prev, fieldPath]));
  }, []);

  const handleArrayRemove = useCallback((fieldPath: string, index: number) => {
    setEditedData((prev) => {
      const newData = { ...prev };
      const keys = fieldPath.split('.');
      let current: any = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key) current = current[key];
      }
      
      const lastKey = keys[keys.length - 1];
      if (lastKey && Array.isArray(current[lastKey])) {
        current[lastKey] = current[lastKey].filter((_: any, i: number) => i !== index);
      }
      return newData;
    });
    setChangedFields((prev) => new Set([...prev, fieldPath]));
  }, []);

  const handleArrayItemUpdate = useCallback((fieldPath: string, index: number, key: string, value: any) => {
    setEditedData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev)); // Deep clone
      const keys = fieldPath.split('.');
      let current: any = newData;
      
      for (const k of keys) {
        if (k) current = current[k];
      }
      
      if (Array.isArray(current) && current[index]) {
        current[index][key] = value;
      }
      return newData;
    });
    setChangedFields((prev) => new Set([...prev, `${fieldPath}.${index}.${key}`]));
  }, []);

  // Save handler
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(
        `/api/contracts/${contractId}/artifacts/${artifact.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: editedData,
            userId: 'current-user', // TODO: Get from auth context
            reason: 'Manual edit via Enhanced Editor',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save artifact');
      }

      const result = await response.json();
      setSuccess(true);
      setChangedFields(new Set());
      
      if (onSave) {
        onSave(result.artifact);
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset handler
  const handleReset = () => {
    setEditedData(artifact.data || {});
    setChangedFields(new Set());
    setError(null);
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Render individual field based on type
  const renderField = (key: string, value: any, path: string = '') => {
    const fullPath = path ? `${path}.${key}` : key;
    const schema = fieldSchema[key];
    const fieldType = schema?.type || inferFieldType(value);
    const isChanged = changedFields.has(fullPath);
    const label = schema?.label || formatLabel(key);

    if (value === null || value === undefined) {
      return (
        <div key={fullPath} className="space-y-2">
          <Label className="text-sm text-gray-500">{label}</Label>
          <div className="text-sm text-gray-400 italic p-2 bg-gray-50 rounded">
            Not provided
            {isEditing && (
              <Button
                variant="link"
                size="sm"
                className="ml-2 h-auto p-0 text-blue-600"
                onClick={() => handleFieldChange(fullPath, getDefaultValue(fieldType))}
              >
                Add value
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Object type - render recursively
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div key={fullPath} className="space-y-3 pl-4 border-l-2 border-blue-200">
          <Label className="text-sm font-semibold text-gray-700">{label}</Label>
          {Object.entries(value).map(([k, v]) => renderField(k, v, fullPath))}
        </div>
      );
    }

    // Array type
    if (Array.isArray(value)) {
      return (
        <div key={fullPath} className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              {label}
              <Badge variant="secondary" className="text-xs">
                {value.length} items
              </Badge>
            </Label>
            {isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleArrayAdd(fullPath, getDefaultArrayItem(key))}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {value.map((item, index) => (
              <Card key={`${fullPath}-${index}`} className={cn(
                "p-3",
                isEditing ? "border-blue-200" : "border-gray-200"
              )}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                    {typeof item === 'object' ? (
                      Object.entries(item).map(([itemKey, itemValue]) => (
                        <div key={itemKey} className="flex items-center gap-2">
                          <Label className="text-xs text-gray-500 w-24 shrink-0">
                            {formatLabel(itemKey)}:
                          </Label>
                          {isEditing ? (
                            <Input
                              value={String(itemValue ?? '')}
                              onChange={(e) => handleArrayItemUpdate(fullPath, index, itemKey, e.target.value)}
                              className="h-8 text-sm"
                            />
                          ) : (
                            <span className="text-sm">{String(itemValue ?? '-')}</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-sm">{String(item)}</span>
                    )}
                  </div>
                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleArrayRemove(fullPath, index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    // Date type
    if (fieldType === 'date' || key.toLowerCase().includes('date')) {
      const dateValue = value ? new Date(value) : undefined;
      return (
        <div key={fullPath} className="space-y-2">
          <Label className={cn("text-sm", isChanged && "text-blue-600 font-medium")}>
            {label}
          </Label>
          {isEditing ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateValue && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateValue ? format(dateValue, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateValue}
                  onSelect={(date) => {
                    const selectedDate = Array.isArray(date) ? date[0] : (date instanceof Date ? date : undefined);
                    handleFieldChange(fullPath, selectedDate?.toISOString());
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="text-sm text-gray-900 p-2 bg-gray-50 rounded flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-gray-400" />
              {dateValue ? format(dateValue, 'PPP') : '-'}
            </div>
          )}
        </div>
      );
    }

    // Boolean type
    if (typeof value === 'boolean' || fieldType === 'boolean') {
      return (
        <div key={fullPath} className="flex items-center justify-between">
          <Label className={cn("text-sm", isChanged && "text-blue-600 font-medium")}>
            {label}
          </Label>
          {isEditing ? (
            <Switch
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(fullPath, checked)}
            />
          ) : (
            <Badge variant={value ? 'default' : 'secondary'}>
              {value ? 'Yes' : 'No'}
            </Badge>
          )}
        </div>
      );
    }

    // Number/Currency type
    if (typeof value === 'number' || fieldType === 'number' || fieldType === 'currency') {
      return (
        <div key={fullPath} className="space-y-2">
          <Label className={cn("text-sm", isChanged && "text-blue-600 font-medium")}>
            {label}
          </Label>
          {isEditing ? (
            <div className="relative">
              {fieldType === 'currency' && (
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              )}
              <Input
                type="number"
                value={value}
                onChange={(e) => handleFieldChange(fullPath, parseFloat(e.target.value) || 0)}
                className={cn(fieldType === 'currency' && "pl-9")}
              />
            </div>
          ) : (
            <div className="text-sm text-gray-900 p-2 bg-gray-50 rounded flex items-center gap-2">
              {fieldType === 'currency' && <DollarSign className="h-4 w-4 text-gray-400" />}
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
          )}
        </div>
      );
    }

    // Textarea for long text
    if (fieldType === 'textarea' || (typeof value === 'string' && value.length > 100)) {
      return (
        <div key={fullPath} className="space-y-2">
          <Label className={cn("text-sm", isChanged && "text-blue-600 font-medium")}>
            {label}
          </Label>
          {isEditing ? (
            <Textarea
              value={value}
              onChange={(e) => handleFieldChange(fullPath, e.target.value)}
              rows={4}
              className="resize-none"
            />
          ) : (
            <div className="text-sm text-gray-900 p-3 bg-gray-50 rounded whitespace-pre-wrap">
              {value || '-'}
            </div>
          )}
        </div>
      );
    }

    // Default string type
    return (
      <div key={fullPath} className="space-y-2">
        <Label className={cn("text-sm", isChanged && "text-blue-600 font-medium")}>
          {label}
        </Label>
        {isEditing ? (
          <Input
            value={value?.toString() || ''}
            onChange={(e) => handleFieldChange(fullPath, e.target.value)}
          />
        ) : (
          <div className="text-sm text-gray-900 p-2 bg-gray-50 rounded">
            {value?.toString() || '-'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            getArtifactColor(artifact.type)
          )}>
            {getArtifactIcon(artifact.type)}
          </div>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {formatLabel(artifact.type)} 
              {artifact.isEdited && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edited
                </Badge>
              )}
            </h3>
            {artifact.lastEditedAt && (
              <p className="text-sm text-gray-500">
                Last edited {new Date(artifact.lastEditedAt).toLocaleString()}
                {artifact.lastEditedBy && ` by ${artifact.lastEditedBy}`}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              variant={viewMode === 'form' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('form')}
              className="h-7"
            >
              <FileText className="h-3 w-3 mr-1" />
              Form
            </Button>
            <Button
              variant={viewMode === 'json' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('json')}
              className="h-7"
            >
              {'{ }'}
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {showHistory && (
            <Button variant="outline" size="sm" onClick={showHistory}>
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
          )}

          {onRegenerate && (
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <Sparkles className="h-4 w-4 mr-1" />
              Regenerate
            </Button>
          )}

          {!readOnly && (
            <>
              {changedFields.size > 0 && (
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}

              <Button
                onClick={handleSave}
                disabled={isSaving || changedFields.size === 0}
                size="sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save Changes
                    {changedFields.size > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {changedFields.size}
                      </Badge>
                    )}
                  </>
                )}
              </Button>

              {onCancel && (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confidence & Validation */}
      {(artifact.confidence !== undefined || artifact.validationStatus) && (
        <div className="flex items-center gap-4">
          {artifact.confidence !== undefined && (
            <Badge variant="outline" className="text-xs">
              {Math.round(artifact.confidence * 100)}% confidence
            </Badge>
          )}
          {artifact.validationStatus && artifact.validationStatus !== 'valid' && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                artifact.validationStatus === 'error' 
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              )}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              {artifact.validationStatus === 'error' ? 'Has errors' : 'Has warnings'}
            </Badge>
          )}
        </div>
      )}

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Artifact saved successfully!
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {viewMode === 'json' ? (
        <Card className="p-4">
          <Textarea
            value={JSON.stringify(editedData, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setEditedData(parsed);
                setChangedFields(new Set(['_json']));
              } catch {
                // Invalid JSON, ignore
              }
            }}
            readOnly={!isEditing}
            rows={20}
            className="font-mono text-sm"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedFields).map(([group, fields]) => (
            <Card key={group} className="overflow-hidden">
              <button
                className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => toggleSection(group)}
              >
                <h4 className="font-medium flex items-center gap-2">
                  {group}
                  <Badge variant="secondary" className="text-xs">
                    {fields.length} fields
                  </Badge>
                </h4>
                {expandedSections.has(group) ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>
              
              <AnimatePresence initial={false}>
                {expandedSections.has(group) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="p-4 space-y-4 border-t">
                      {fields.map((fieldKey) => 
                        renderField(fieldKey, editedData[fieldKey])
                      )}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}

function inferFieldType(value: any): string {
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    if (value.length > 100) return 'textarea';
  }
  return 'string';
}

function getDefaultValue(type: string): any {
  switch (type) {
    case 'boolean': return false;
    case 'number': return 0;
    case 'currency': return 0;
    case 'array': return [];
    case 'object': return {};
    case 'date': return new Date().toISOString();
    default: return '';
  }
}

function getDefaultArrayItem(key: string): any {
  if (key === 'parties') {
    return { name: '', role: '', contact: '' };
  }
  if (key === 'obligations' || key === 'deliverables') {
    return { description: '', dueDate: '', status: 'pending' };
  }
  if (key === 'risks') {
    return { description: '', severity: 'medium', mitigation: '' };
  }
  if (key === 'clauses') {
    return { title: '', content: '', category: '' };
  }
  if (key === 'rates') {
    return { role: '', seniorityLevel: '', hourlyRate: 0, currency: 'USD' };
  }
  if (key === 'milestones') {
    return { name: '', dueDate: '', status: 'pending', payment: 0 };
  }
  return { value: '' };
}

function getArtifactIcon(type: string) {
  const iconClass = "h-5 w-5 text-white";
  switch (type.toLowerCase()) {
    case 'overview': return <FileText className={iconClass} />;
    case 'parties': return <Users className={iconClass} />;
    case 'financial': return <DollarSign className={iconClass} />;
    case 'obligations': return <Clock className={iconClass} />;
    case 'risks': return <AlertTriangle className={iconClass} />;
    case 'clauses': return <FileText className={iconClass} />;
    case 'rates': return <DollarSign className={iconClass} />;
    default: return <FileText className={iconClass} />;
  }
}

function getArtifactColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'overview': return 'bg-gradient-to-br from-blue-500 to-blue-600';
    case 'parties': return 'bg-gradient-to-br from-green-500 to-green-600';
    case 'financial': return 'bg-gradient-to-br from-emerald-500 to-emerald-600';
    case 'obligations': return 'bg-gradient-to-br from-purple-500 to-purple-600';
    case 'risks': return 'bg-gradient-to-br from-red-500 to-red-600';
    case 'clauses': return 'bg-gradient-to-br from-indigo-500 to-indigo-600';
    case 'rates': return 'bg-gradient-to-br from-amber-500 to-amber-600';
    default: return 'bg-gradient-to-br from-gray-500 to-gray-600';
  }
}

export default EnhancedArtifactEditor;
