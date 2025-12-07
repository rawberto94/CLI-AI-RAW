'use client';

/**
 * AIMetadataExtractor Component
 * 
 * Comprehensive UI for AI-powered metadata extraction.
 * Features:
 * - Progress indicators during extraction
 * - Confidence visualization with color coding
 * - Field-level editing and validation
 * - Bulk approve/reject actions
 * - Re-extraction for low-confidence fields
 */

import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Edit3,
  Save,
  X,
  Search,
  Filter,
  Zap,
  Eye,
  EyeOff,
  ArrowUpDown,
  Download,
  Upload
} from 'lucide-react';
import { useMetadataExtraction } from '@/hooks/useMetadataExtraction';
import type { ExtractionResult } from '@/lib/ai/metadata-extractor';

interface AIMetadataExtractorProps {
  contractId: string;
  tenantId?: string;
  documentText?: string;
  onComplete?: (fields: Record<string, any>) => void;
  onCancel?: () => void;
  mode?: 'full' | 'compact' | 'inline';
  className?: string;
}

export function AIMetadataExtractor({
  contractId,
  tenantId = 'demo',
  documentText,
  onComplete,
  onCancel,
  mode = 'full',
  className = '',
}: AIMetadataExtractorProps) {
  const {
    isExtracting,
    isApplying,
    extraction,
    error,
    progress,
    extractMetadata,
    reExtractLowConfidence,
    applyMetadata,
    updateFieldValue,
    getFieldsByCategory,
    clearExtraction,
    averageConfidence,
    highConfidenceCount,
    lowConfidenceCount,
    needsReviewCount,
  } = useMetadataExtraction({
    contractId,
    tenantId,
    onExtractionComplete: (result) => {
      console.log('Extraction complete:', result.summary);
    },
  });

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['core', 'parties']));
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'low' | 'review'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'confidence' | 'name'>('default');

  // Group results by category
  const categorizedResults = useMemo(() => {
    if (!extraction) return new Map<string, ExtractionResult[]>();

    let results = [...extraction.results];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(r =>
        r.fieldLabel.toLowerCase().includes(query) ||
        r.fieldName.toLowerCase().includes(query) ||
        String(r.value).toLowerCase().includes(query)
      );
    }

    // Apply confidence filter
    if (confidenceFilter !== 'all') {
      results = results.filter(r => {
        switch (confidenceFilter) {
          case 'high': return r.confidence >= 0.8;
          case 'low': return r.confidence < 0.6;
          case 'review': return r.requiresHumanReview;
          default: return true;
        }
      });
    }

    // Apply sorting
    if (sortBy === 'confidence') {
      results.sort((a, b) => b.confidence - a.confidence);
    } else if (sortBy === 'name') {
      results.sort((a, b) => a.fieldLabel.localeCompare(b.fieldLabel));
    }

    // Group by category
    const grouped = new Map<string, ExtractionResult[]>();
    for (const result of results) {
      const category = result.category || 'other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(result);
    }

    return grouped;
  }, [extraction, searchQuery, confidenceFilter, sortBy]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const startEditing = (field: ExtractionResult) => {
    setEditingField(field.fieldId);
    setEditValue(field.value);
  };

  const saveEdit = () => {
    if (editingField && editValue !== null) {
      updateFieldValue(editingField, editValue);
    }
    setEditingField(null);
    setEditValue(null);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue(null);
  };

  const handleExtract = async () => {
    await extractMetadata(documentText);
  };

  const handleReExtract = async () => {
    await reExtractLowConfidence(0.7);
  };

  const handleApply = async () => {
    const success = await applyMetadata(undefined, {
      markAsValidated: true,
    });
    
    if (success && extraction) {
      onComplete?.(extraction.rawExtractions);
    }
  };

  const handleApplyHighConfidenceOnly = async () => {
    const success = await applyMetadata(undefined, {
      applyHighConfidenceOnly: true,
      confidenceThreshold: 0.8,
      markAsValidated: true,
    });
    
    if (success && extraction) {
      const highConfidenceFields = extraction.results
        .filter(r => r.confidence >= 0.8)
        .reduce((acc, r) => ({ ...acc, [r.fieldName]: r.value }), {});
      onComplete?.(highConfidenceFields);
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-blue-600 bg-blue-50';
    if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceBadge = (confidence: number) => {
    const percent = Math.round(confidence * 100);
    const color = getConfidenceColor(confidence);
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {percent}%
      </span>
    );
  };

  const getStatusIcon = (result: ExtractionResult) => {
    if (result.validationStatus === 'invalid') {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (result.requiresHumanReview) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    if (result.confidence >= 0.8) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Eye className="h-4 w-4 text-gray-400" />;
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      core: 'Core Information',
      parties: 'Parties',
      financial: 'Financial',
      dates: 'Key Dates',
      legal: 'Legal & Compliance',
      custom: 'Custom Fields',
      other: 'Other',
    };
    return labels[category] || category;
  };

  // Render extraction not started
  if (!extraction && !isExtracting) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center">
          <Sparkles className="mx-auto h-12 w-12 text-indigo-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            AI Metadata Extraction
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Use AI to automatically extract metadata from your contract using your custom schema.
          </p>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleExtract}
              disabled={isExtracting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Start Extraction
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render extraction in progress
  if (isExtracting) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center">
          <div className="relative mx-auto h-12 w-12">
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-indigo-600 animate-pulse" />
            </div>
            <svg className="animate-spin h-12 w-12 text-indigo-600" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {progress.message}
          </h3>
          
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {progress.percent}% complete
          </p>
        </div>
      </div>
    );
  }

  // Render extraction results
  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-medium text-gray-900">Extracted Metadata</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleReExtract}
              disabled={isExtracting || lowConfidenceCount === 0}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
              title="Re-extract low confidence fields"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Re-extract
            </button>
            <button
              onClick={clearExtraction}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-600">{highConfidenceCount} high confidence</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-gray-600">{lowConfidenceCount} low confidence</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-gray-600">{needsReviewCount} need review</span>
          </div>
          <div className="ml-auto text-gray-500">
            Avg: {Math.round(averageConfidence * 100)}%
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 w-full text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-md py-1 px-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All fields</option>
            <option value="high">High confidence (≥80%)</option>
            <option value="low">Low confidence (&lt;60%)</option>
            <option value="review">Needs review</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-md py-1 px-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="default">Default order</option>
            <option value="confidence">By confidence</option>
            <option value="name">By name</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="max-h-[500px] overflow-y-auto">
        {Array.from(categorizedResults.entries()).map(([category, fields]) => (
          <div key={category} className="border-b border-gray-100 last:border-0">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedCategories.has(category) ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
                <span className="font-medium text-gray-700">
                  {getCategoryLabel(category)}
                </span>
                <span className="text-xs text-gray-400">
                  ({fields.length} fields)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {fields.filter(f => f.confidence >= 0.8).length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    {fields.filter(f => f.confidence >= 0.8).length} ready
                  </span>
                )}
                {fields.filter(f => f.requiresHumanReview).length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                    {fields.filter(f => f.requiresHumanReview).length} review
                  </span>
                )}
              </div>
            </button>

            {/* Fields */}
            {expandedCategories.has(category) && (
              <div className="divide-y divide-gray-100">
                {fields.map((field) => (
                  <div
                    key={field.fieldId}
                    className="px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(field)}
                          <span className="font-medium text-gray-900">
                            {field.fieldLabel}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({field.fieldType})
                          </span>
                        </div>

                        {editingField === field.fieldId ? (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={editValue || ''}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                              autoFocus
                            />
                            <button
                              onClick={saveEdit}
                              className="p-1 text-green-600 hover:text-green-700"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-sm text-gray-700 truncate">
                              {field.value !== null && field.value !== undefined
                                ? String(field.value)
                                : <span className="text-gray-400 italic">Not found</span>
                              }
                            </span>
                            <button
                              onClick={() => startEditing(field)}
                              className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        {/* Confidence explanation */}
                        {field.confidenceExplanation && (
                          <p className="mt-1 text-xs text-gray-500">
                            {field.confidenceExplanation}
                          </p>
                        )}

                        {/* Validation messages */}
                        {field.validationMessages.length > 0 && (
                          <div className="mt-1">
                            {field.validationMessages.map((msg, i) => (
                              <p key={i} className="text-xs text-red-500">
                                ⚠ {msg}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Suggestions */}
                        {field.suggestions.length > 0 && (
                          <div className="mt-1">
                            {field.suggestions.map((suggestion, i) => (
                              <p key={i} className="text-xs text-blue-500">
                                💡 {suggestion}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Source */}
                        {field.source.text && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                              View source
                            </summary>
                            <p className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                              "{field.source.text.slice(0, 200)}..."
                            </p>
                          </details>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {getConfidenceBadge(field.confidence)}
                        <button
                          onClick={() => startEditing(field)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {extraction?.summary.extractedFields} of {extraction?.summary.totalFields} fields extracted
          {extraction?.warnings && extraction.warnings.length > 0 && (
            <span className="ml-2 text-yellow-600">
              • {extraction.warnings.length} warning(s)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          )}
          
          <button
            onClick={handleApplyHighConfidenceOnly}
            disabled={isApplying || highConfidenceCount === 0}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            <Zap className="mr-1 h-4 w-4" />
            Apply High Confidence ({highConfidenceCount})
          </button>

          <button
            onClick={handleApply}
            disabled={isApplying}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Apply All
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIMetadataExtractor;
