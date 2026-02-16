'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit3,
  Save,
  RotateCcw,
  Brain,
  User,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Clock,
  Shield,
  FileCheck,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  History,
  Loader2,
  Eye,
  EyeOff,
  Lightbulb,
  Target,
  RefreshCw,
  CheckCheck,
  Lock,
  Unlock,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ TYPES ============

interface MetadataField {
  id: string;
  name: string;
  label: string;
  value: any;
  aiExtractedValue: any;
  confidence: number;
  source: 'ai' | 'human' | 'hybrid';
  status: 'pending' | 'validated' | 'rejected' | 'modified';
  category: string;
  required: boolean;
  validationRules?: ValidationRule[];
  suggestions?: string[];
  history?: FieldHistory[];
}

interface ValidationRule {
  type: 'required' | 'format' | 'range' | 'custom';
  rule: string;
  message: string;
}

interface FieldHistory {
  timestamp: Date;
  previousValue: any;
  newValue: any;
  changedBy: 'ai' | 'human';
  reason?: string;
}

interface ValidationSummary {
  total: number;
  validated: number;
  pending: number;
  rejected: number;
  modified: number;
  overallConfidence: number;
}

interface SmartMetadataValidatorProps {
  contractId: string;
  tenantId?: string;
  initialMetadata?: Record<string, any>;
  onSave?: (metadata: Record<string, any>) => void;
  onValidationComplete?: (summary: ValidationSummary) => void;
  className?: string;
}

// ============ MOCK DATA FOR CATEGORIES ============

const FIELD_CATEGORIES = [
  { id: 'core', label: 'Core Information', icon: FileCheck },
  { id: 'parties', label: 'Parties & Contacts', icon: User },
  { id: 'financial', label: 'Financial Terms', icon: Target },
  { id: 'dates', label: 'Key Dates', icon: Clock },
  { id: 'legal', label: 'Legal Terms', icon: Shield },
  { id: 'custom', label: 'Custom Fields', icon: Sparkles }
];

// ============ COMPONENT ============

export function SmartMetadataValidator({
  contractId,
  tenantId = 'demo',
  initialMetadata,
  onSave,
  onValidationComplete,
  className
}: SmartMetadataValidatorProps) {
  const [fields, setFields] = useState<MetadataField[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['core', 'parties']));
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [showConfidenceDetails, setShowConfidenceDetails] = useState(false);
  const [validationMode, setValidationMode] = useState<'quick' | 'detailed'>('quick');

  // Load metadata and AI extraction results
  useEffect(() => {
    loadMetadata();
    
  }, [contractId]);

  const loadMetadata = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/metadata?includeAI=true`, {
        headers: { 'x-tenant-id': tenantId }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setFields(transformToFields(data.data));
        } else {
          // Use mock data for demo
          setFields(generateMockFields());
        }
      } else {
        setFields(generateMockFields());
      }
    } catch {
      setFields(generateMockFields());
    } finally {
      setLoading(false);
    }
  };

  // Transform API data to field format
  const transformToFields = (data: any): MetadataField[] => {
    const fields: MetadataField[] = [];
    
    // Core fields
    if (data.contractName) {
      fields.push({
        id: 'contractName',
        name: 'contractName',
        label: 'Contract Name',
        value: data.contractName,
        aiExtractedValue: data.ai?.contractName || data.contractName,
        confidence: data.confidence?.contractName || 0.9,
        source: 'ai',
        status: 'pending',
        category: 'core',
        required: true
      });
    }
    
    // Add more field transformations...
    return fields.length > 0 ? fields : generateMockFields();
  };

  // Generate mock fields for demonstration
  const generateMockFields = (): MetadataField[] => [
    {
      id: 'contractName',
      name: 'contractName',
      label: 'Contract Name',
      value: 'Master Services Agreement - Acme Corp',
      aiExtractedValue: 'Master Services Agreement - Acme Corp',
      confidence: 0.98,
      source: 'ai',
      status: 'validated',
      category: 'core',
      required: true
    },
    {
      id: 'contractType',
      name: 'contractType',
      label: 'Contract Type',
      value: 'MSA',
      aiExtractedValue: 'MSA',
      confidence: 0.95,
      source: 'ai',
      status: 'validated',
      category: 'core',
      required: true,
      suggestions: ['MSA', 'SOW', 'NDA', 'SLA', 'License Agreement']
    },
    {
      id: 'clientName',
      name: 'clientName',
      label: 'Client Name',
      value: 'TechCorp Industries',
      aiExtractedValue: 'TechCorp Industries Inc.',
      confidence: 0.88,
      source: 'ai',
      status: 'pending',
      category: 'parties',
      required: true,
      suggestions: ['TechCorp Industries', 'TechCorp Industries Inc.', 'TechCorp']
    },
    {
      id: 'vendorName',
      name: 'vendorName',
      label: 'Vendor/Supplier',
      value: 'Acme Corporation',
      aiExtractedValue: 'Acme Corporation',
      confidence: 0.92,
      source: 'ai',
      status: 'validated',
      category: 'parties',
      required: true
    },
    {
      id: 'clientContact',
      name: 'clientContact',
      label: 'Client Contact',
      value: 'John Smith, VP of Procurement',
      aiExtractedValue: 'John Smith',
      confidence: 0.75,
      source: 'ai',
      status: 'pending',
      category: 'parties',
      required: false
    },
    {
      id: 'contractValue',
      name: 'contractValue',
      label: 'Total Contract Value',
      value: 1250000,
      aiExtractedValue: 1250000,
      confidence: 0.94,
      source: 'ai',
      status: 'validated',
      category: 'financial',
      required: true
    },
    {
      id: 'currency',
      name: 'currency',
      label: 'Currency',
      value: 'USD',
      aiExtractedValue: 'USD',
      confidence: 0.99,
      source: 'ai',
      status: 'validated',
      category: 'financial',
      required: true,
      suggestions: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
    },
    {
      id: 'paymentTerms',
      name: 'paymentTerms',
      label: 'Payment Terms',
      value: 'Net 45',
      aiExtractedValue: 'Net 45 days',
      confidence: 0.82,
      source: 'ai',
      status: 'pending',
      category: 'financial',
      required: false,
      suggestions: ['Net 30', 'Net 45', 'Net 60', 'Due on Receipt']
    },
    {
      id: 'effectiveDate',
      name: 'effectiveDate',
      label: 'Effective Date',
      value: '2024-01-15',
      aiExtractedValue: '2024-01-15',
      confidence: 0.96,
      source: 'ai',
      status: 'validated',
      category: 'dates',
      required: true
    },
    {
      id: 'expirationDate',
      name: 'expirationDate',
      label: 'Expiration Date',
      value: '2026-01-14',
      aiExtractedValue: '2026-01-14',
      confidence: 0.91,
      source: 'ai',
      status: 'validated',
      category: 'dates',
      required: true
    },
    {
      id: 'renewalTerms',
      name: 'renewalTerms',
      label: 'Auto-Renewal',
      value: 'Yes, 12-month renewal with 60-day notice',
      aiExtractedValue: 'Auto-renews annually unless 60-day notice provided',
      confidence: 0.72,
      source: 'ai',
      status: 'pending',
      category: 'dates',
      required: false
    },
    {
      id: 'governingLaw',
      name: 'governingLaw',
      label: 'Governing Law',
      value: 'State of Delaware',
      aiExtractedValue: 'Delaware',
      confidence: 0.85,
      source: 'ai',
      status: 'pending',
      category: 'legal',
      required: false
    },
    {
      id: 'liabilityCap',
      name: 'liabilityCap',
      label: 'Liability Cap',
      value: '2x Annual Contract Value',
      aiExtractedValue: 'Limited to 2x fees paid in preceding 12 months',
      confidence: 0.68,
      source: 'ai',
      status: 'pending',
      category: 'legal',
      required: false
    }
  ];

  // Calculate validation summary
  const summary: ValidationSummary = {
    total: fields.length,
    validated: fields.filter(f => f.status === 'validated').length,
    pending: fields.filter(f => f.status === 'pending').length,
    rejected: fields.filter(f => f.status === 'rejected').length,
    modified: fields.filter(f => f.status === 'modified').length,
    overallConfidence: fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length * 100
  };

  // Toggle category expansion
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

  // Validate field (accept AI extraction)
  const validateField = (fieldId: string) => {
    setFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, status: 'validated', source: 'hybrid' } : f
    ));
    
    // Persist validation to backend
    persistFieldValidation(fieldId, 'validate');
  };

  // Reject field (mark for review)
  const rejectField = (fieldId: string) => {
    setFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, status: 'rejected' } : f
    ));
    
    // Persist rejection to backend
    persistFieldValidation(fieldId, 'reject');
  };

  // Persist field validation to backend
  const persistFieldValidation = async (fieldId: string, action: 'validate' | 'reject' | 'modify', newValue?: any) => {
    try {
      const field = fields.find(f => f.id === fieldId);
      if (!field) return;

      await fetch(`/api/contracts/${contractId}/metadata/validate`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId 
        },
        body: JSON.stringify({ 
          fieldKey: field.name,
          action,
          newValue: action === 'modify' ? newValue : field.value,
          reason: action === 'reject' ? 'Manual review required' : undefined
        })
      });
    } catch {
      // Failed to persist field validation
    }
  };

  // Start editing field
  const startEditing = (field: MetadataField) => {
    setEditingField(field.id);
    setEditValue(field.value);
  };

  // Save field edit
  const saveFieldEdit = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    setFields(prev => prev.map(f => 
      f.id === fieldId ? { 
        ...f, 
        value: editValue, 
        status: 'modified',
        source: 'human',
        history: [
          ...(f.history || []),
          {
            timestamp: new Date(),
            previousValue: f.value,
            newValue: editValue,
            changedBy: 'human'
          }
        ]
      } : f
    ));
    
    // Persist modification to backend
    persistFieldValidation(fieldId, 'modify', editValue);
    
    setEditingField(null);
    setEditValue(null);
  };

  // Accept all pending with high confidence
  const acceptHighConfidence = () => {
    const highConfidenceFields = fields.filter(f => f.status === 'pending' && f.confidence >= 0.85);
    
    setFields(prev => prev.map(f => 
      f.status === 'pending' && f.confidence >= 0.85 
        ? { ...f, status: 'validated', source: 'hybrid' } 
        : f
    ));
    
    // Persist all high-confidence validations
    highConfidenceFields.forEach(field => {
      persistFieldValidation(field.id, 'validate');
    });
  };

  // Save all metadata
  const saveMetadata = async () => {
    setSaving(true);
    try {
      // Collect all field values with their validation status
      const metadata = fields.reduce((acc, field) => {
        acc[field.name] = field.value;
        return acc;
      }, {} as Record<string, any>);

      // Also track field statuses for audit
      const fieldStatuses = fields.reduce((acc, field) => {
        acc[field.name] = {
          status: field.status,
          confidence: field.confidence,
          source: field.source,
          aiExtractedValue: field.aiExtractedValue
        };
        return acc;
      }, {} as Record<string, any>);

      // Save to main metadata endpoint
      const response = await fetch(`/api/contracts/${contractId}/metadata`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId 
        },
        body: JSON.stringify({ 
          metadata, 
          validationSummary: summary,
          fieldStatuses 
        })
      });

      // Also save to validation endpoint for audit trail
      await fetch(`/api/contracts/${contractId}/metadata/validate`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId 
        },
        body: JSON.stringify({ 
          allFields: metadata,
          fieldStatuses,
          summary 
        })
      });

      // Dispatch event to notify chatbot and other components about the update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('artifact-updated', { 
          detail: { contractId, type: 'metadata-validation', timestamp: Date.now() } 
        }));
        window.dispatchEvent(new CustomEvent('contract:refresh', { 
          detail: { contractId } 
        }));
      }

      if (onSave) {
        onSave(metadata);
      }
      if (onValidationComplete) {
        onValidationComplete(summary);
      }
    } catch {
      // Failed to save metadata
    } finally {
      setSaving(false);
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-violet-600 bg-violet-50';
    if (confidence >= 0.75) return 'text-violet-600 bg-violet-50';
    if (confidence >= 0.6) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'validated': return 'text-violet-600 bg-violet-50 border-violet-200';
      case 'pending': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'rejected': return 'text-rose-600 bg-rose-50 border-rose-200';
      case 'modified': return 'text-violet-600 bg-violet-50 border-violet-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  // Filter fields
  const filteredFields = showOnlyPending 
    ? fields.filter(f => f.status === 'pending')
    : fields;

  // Group fields by category
  const fieldsByCategory = FIELD_CATEGORIES.map(cat => ({
    ...cat,
    fields: filteredFields.filter(f => f.category === cat.id)
  })).filter(cat => cat.fields.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-violet-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-600">Loading metadata for validation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Metadata Validation</h2>
            <p className="text-sm text-slate-500">Review and validate AI-extracted data</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOnlyPending(!showOnlyPending)}
            className={showOnlyPending ? 'bg-amber-50 border-amber-200' : ''}
          >
            {showOnlyPending ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {showOnlyPending ? 'Showing Pending' : 'Show All'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={acceptHighConfidence}
            disabled={summary.pending === 0}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Accept High Confidence
          </Button>
          <Button
            onClick={saveMetadata}
            disabled={saving || summary.pending > 0}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
            <p className="text-xs text-slate-500">Total Fields</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">{summary.validated}</p>
            <p className="text-xs text-violet-600">Validated</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{summary.pending}</p>
            <p className="text-xs text-amber-600">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">{summary.modified}</p>
            <p className="text-xs text-violet-600">Modified</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">{Math.round(summary.overallConfidence)}%</p>
            <p className="text-xs text-violet-600">AI Confidence</p>
          </CardContent>
        </Card>
      </div>

      {/* Validation Progress */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Validation Progress</span>
            <span className="text-sm text-slate-500">
              {summary.validated + summary.modified} / {summary.total} complete
            </span>
          </div>
          <Progress 
            value={((summary.validated + summary.modified) / summary.total) * 100} 
            className="h-2"
          />
        </CardContent>
      </Card>

      {/* Field Categories */}
      <div className="space-y-4">
        {fieldsByCategory.map(category => {
          const CategoryIcon = category.icon;
          const isExpanded = expandedCategories.has(category.id);
          const pendingCount = category.fields.filter(f => f.status === 'pending').length;

          return (
            <Card key={category.id} className="overflow-hidden">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <CategoryIcon className="h-4 w-4 text-slate-600" />
                  </div>
                  <span className="font-medium text-slate-900">{category.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {category.fields.length} fields
                  </Badge>
                  {pendingCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                      {pendingCount} pending
                    </Badge>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div key="expanded"
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {category.fields.map(field => (
                        <div 
                          key={field.id}
                          className={cn(
                            "p-4 hover:bg-slate-50/50 transition-colors",
                            field.status === 'pending' && "bg-amber-50/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Label className="font-medium text-slate-900">
                                  {field.label}
                                  {field.required && <span className="text-rose-500 ml-1">*</span>}
                                </Label>
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-[10px]", getStatusColor(field.status))}
                                >
                                  {field.status}
                                </Badge>
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-[10px]", getConfidenceColor(field.confidence))}
                                >
                                  {Math.round(field.confidence * 100)}% AI
                                </Badge>
                              </div>

                              {editingField === field.id ? (
                                <div className="flex items-center gap-2 mt-2">
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="flex-1"
                                    autoFocus
                                  />
                                  <Button size="sm" onClick={() => saveFieldEdit(field.id)}>
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      setEditingField(null);
                                      setEditValue(null);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="mt-1">
                                  <p className="text-sm text-slate-700">{String(field.value)}</p>
                                  {field.value !== field.aiExtractedValue && (
                                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                      <Brain className="h-3 w-3" />
                                      AI extracted: {String(field.aiExtractedValue)}
                                    </p>
                                  )}
                                </div>
                              )}

                              {field.suggestions && field.suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {field.suggestions.slice(0, 4).map((suggestion, i) => (
                                    <button
                                      key={i}
                                      onClick={() => {
                                        setFields(prev => prev.map(f => 
                                          f.id === field.id ? { ...f, value: suggestion, status: 'modified' } : f
                                        ));
                                      }}
                                      className="px-2 py-0.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                    >
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {field.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => validateField(field.id)}
                                    className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                  >
                                    <ThumbsUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => rejectField(field.id)}
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  >
                                    <ThumbsDown className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditing(field)}
                                className="text-slate-600 hover:text-slate-700"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      {/* Validation Tips */}
      <Card className="border-violet-200 bg-violet-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-violet-900 mb-1">Validation Tips</p>
              <ul className="text-sm text-violet-700 space-y-1">
                <li>• Fields with 85%+ confidence are usually accurate</li>
                <li>• Click suggestions to quickly apply common values</li>
                <li>• Required fields must be validated before saving</li>
                <li>• Modified fields are tracked for audit purposes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SmartMetadataValidator;
