'use client';

/**
 * Extraction Confidence Heatmap
 * 
 * Provides a visual representation of extraction confidence levels
 * across all extracted fields with drill-down capabilities.
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Filter,
  Info,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
  ChevronDown,
  ChevronRight,
  FileText,
  Shield,
  DollarSign,
  Calendar,
  Users,
  Building,
  Scale,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.65,
  low: 0.4,
};

// Field categories for grouping
const FIELD_CATEGORIES: Record<string, { label: string; icon: React.ElementType; fields: string[] }> = {
  parties: {
    label: 'Parties',
    icon: Users,
    fields: ['partyA', 'partyB', 'parties', 'signatories', 'counterparty', 'vendor', 'client', 'employee', 'employer'],
  },
  financial: {
    label: 'Financial',
    icon: DollarSign,
    fields: ['value', 'amount', 'fee', 'price', 'payment', 'salary', 'rate', 'cost', 'revenue', 'liability'],
  },
  dates: {
    label: 'Dates & Timing',
    icon: Calendar,
    fields: ['effectiveDate', 'expirationDate', 'terminationDate', 'startDate', 'endDate', 'renewalDate', 'term', 'duration', 'notice'],
  },
  legal: {
    label: 'Legal Terms',
    icon: Scale,
    fields: ['governingLaw', 'jurisdiction', 'dispute', 'arbitration', 'venue', 'compliance', 'indemnification'],
  },
  obligations: {
    label: 'Obligations',
    icon: Shield,
    fields: ['obligations', 'requirements', 'deliverables', 'sla', 'warranty', 'confidentiality', 'nonCompete'],
  },
  metadata: {
    label: 'Metadata',
    icon: FileText,
    fields: ['contractType', 'status', 'version', 'reference', 'category', 'title', 'description'],
  },
};

export interface FieldConfidence {
  field: string;
  value: unknown;
  confidence: number;
  source?: 'extracted' | 'inferred' | 'default' | 'corrected';
  explanation?: string;
  alternatives?: Array<{ value: unknown; confidence: number }>;
  extractionMethod?: string;
  corrections?: Array<{ from: unknown; to: unknown; reason: string }>;
}

export interface ExtractionConfidenceData {
  fields: FieldConfidence[];
  overallConfidence: number;
  templateMatch?: {
    detected: boolean;
    name?: string;
    confidence?: number;
  };
  clauseAnalysis?: {
    totalClauses: number;
    highRisk: number;
    missingStandard: number;
  };
  correctionsSummary?: {
    applied: number;
    pending: number;
    reviewRequired: number;
  };
}

interface ExtractionConfidenceHeatmapProps {
  data: ExtractionConfidenceData;
  onFieldClick?: (field: FieldConfidence) => void;
  onReviewField?: (field: FieldConfidence) => void;
  showCategories?: boolean;
  className?: string;
}

export function ExtractionConfidenceHeatmap({
  data,
  onFieldClick,
  onReviewField,
  showCategories = true,
  className = '',
}: ExtractionConfidenceHeatmapProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'heatmap' | 'list' | 'grid'>('heatmap');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['financial', 'dates']));
  const [selectedField, setSelectedField] = useState<FieldConfidence | null>(null);

  // Group fields by category
  const categorizedFields = useMemo(() => {
    const categorized: Record<string, FieldConfidence[]> = {};
    const uncategorized: FieldConfidence[] = [];

    for (const field of data.fields) {
      let found = false;
      for (const [category, config] of Object.entries(FIELD_CATEGORIES)) {
        if (config.fields.some(f => field.field.toLowerCase().includes(f.toLowerCase()))) {
          if (!categorized[category]) categorized[category] = [];
          categorized[category].push(field);
          found = true;
          break;
        }
      }
      if (!found) {
        uncategorized.push(field);
      }
    }

    if (uncategorized.length > 0) {
      categorized['other'] = uncategorized;
    }

    return categorized;
  }, [data.fields]);

  // Filter fields based on confidence level
  const filteredFields = useMemo(() => {
    if (filterLevel === 'all') return data.fields;

    return data.fields.filter(field => {
      switch (filterLevel) {
        case 'high':
          return field.confidence >= CONFIDENCE_THRESHOLDS.high;
        case 'medium':
          return field.confidence >= CONFIDENCE_THRESHOLDS.low && field.confidence < CONFIDENCE_THRESHOLDS.high;
        case 'low':
          return field.confidence < CONFIDENCE_THRESHOLDS.low;
        default:
          return true;
      }
    });
  }, [data.fields, filterLevel]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = data.fields.length;
    const highConf = data.fields.filter(f => f.confidence >= CONFIDENCE_THRESHOLDS.high).length;
    const medConf = data.fields.filter(f => f.confidence >= CONFIDENCE_THRESHOLDS.low && f.confidence < CONFIDENCE_THRESHOLDS.high).length;
    const lowConf = data.fields.filter(f => f.confidence < CONFIDENCE_THRESHOLDS.low).length;

    const correctedCount = data.fields.filter(f => f.source === 'corrected').length;
    const inferredCount = data.fields.filter(f => f.source === 'inferred').length;

    return { total, highConf, medConf, lowConf, correctedCount, inferredCount };
  }, [data.fields]);

  // Get confidence color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'bg-violet-500';
    if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'bg-yellow-500';
    if (confidence >= CONFIDENCE_THRESHOLDS.low) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Get confidence background for heatmap
  const getConfidenceBackground = (confidence: number): string => {
    if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'bg-violet-50 border-violet-200 hover:bg-violet-100';
    if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100';
    if (confidence >= CONFIDENCE_THRESHOLDS.low) return 'bg-orange-50 border-orange-200 hover:bg-orange-100';
    return 'bg-red-50 border-red-200 hover:bg-red-100';
  };

  // Get confidence icon
  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= CONFIDENCE_THRESHOLDS.high) return CheckCircle2;
    if (confidence >= CONFIDENCE_THRESHOLDS.medium) return AlertTriangle;
    return AlertCircle;
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Format field name for display
  const formatFieldName = (field: string): string => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ')
      .trim();
  };

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Render field cell
  const renderFieldCell = (field: FieldConfidence) => {
    const Icon = getConfidenceIcon(field.confidence);
    const confidencePercent = Math.round(field.confidence * 100);

    return (
      <TooltipProvider key={field.field}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'p-2 rounded-md border cursor-pointer transition-all duration-200',
                getConfidenceBackground(field.confidence),
                selectedField?.field === field.field && 'ring-2 ring-primary'
              )}
              onClick={() => {
                setSelectedField(field);
                onFieldClick?.(field);
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium truncate">{formatFieldName(field.field)}</span>
                <Icon className="h-3 w-3 flex-shrink-0" />
              </div>
              <div className="text-xs text-muted-foreground truncate">{formatValue(field.value)}</div>
              <div className="mt-1">
                <Progress value={confidencePercent} className="h-1" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{formatFieldName(field.field)}</p>
              <p className="text-sm">Value: {formatValue(field.value)}</p>
              <p className="text-sm">Confidence: {confidencePercent}%</p>
              {field.source && <p className="text-sm">Source: {field.source}</p>}
              {field.explanation && <p className="text-sm text-muted-foreground">{field.explanation}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Render heatmap view
  const renderHeatmapView = () => {
    if (!showCategories) {
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {filteredFields.map(renderFieldCell)}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(categorizedFields).map(([category, fields]) => {
          const config = FIELD_CATEGORIES[category] || { label: 'Other', icon: FileText };
          const CategoryIcon = config.icon;
          const isExpanded = expandedCategories.has(category);
          const avgConfidence = fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length;
          const lowConfCount = fields.filter(f => f.confidence < CONFIDENCE_THRESHOLDS.medium).length;

          return (
            <div key={category} className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CategoryIcon className="h-4 w-4" />
                  <span className="font-medium">{config.label}</span>
                  <Badge variant="secondary" className="ml-2">{fields.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {lowConfCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {lowConfCount} needs review
                    </Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <div className={cn('w-2 h-2 rounded-full', getConfidenceColor(avgConfidence))} />
                    <span className="text-sm text-muted-foreground">{Math.round(avgConfidence * 100)}%</span>
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {fields.map(renderFieldCell)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render list view
  const renderListView = () => (
    <div className="space-y-2">
      {filteredFields.map(field => {
        const Icon = getConfidenceIcon(field.confidence);
        const confidencePercent = Math.round(field.confidence * 100);

        return (
          <div
            key={field.field}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all',
              getConfidenceBackground(field.confidence),
              selectedField?.field === field.field && 'ring-2 ring-primary'
            )}
            onClick={() => {
              setSelectedField(field);
              onFieldClick?.(field);
            }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Icon className="h-5 w-5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{formatFieldName(field.field)}</p>
                <p className="text-sm text-muted-foreground truncate">{formatValue(field.value)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 ml-4">
              {field.source && (
                <Badge variant="outline" className="text-xs">
                  {field.source}
                </Badge>
              )}
              <div className="w-24">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{confidencePercent}%</span>
                </div>
                <Progress value={confidencePercent} className="h-1.5" />
              </div>
              {field.confidence < CONFIDENCE_THRESHOLDS.medium && onReviewField && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReviewField(field);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render field detail dialog
  const renderFieldDetailDialog = () => {
    if (!selectedField) return null;

    return (
      <Dialog open={!!selectedField} onOpenChange={() => setSelectedField(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{formatFieldName(selectedField.field)}</DialogTitle>
            <DialogDescription>
              Extraction details and confidence analysis
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Value */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Extracted Value</p>
              <p className="font-mono">{formatValue(selectedField.value)}</p>
            </div>

            {/* Confidence */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Confidence Score</span>
                <span className="text-sm">{Math.round(selectedField.confidence * 100)}%</span>
              </div>
              <Progress value={selectedField.confidence * 100} className="h-2" />
            </div>

            {/* Source */}
            {selectedField.source && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Source</span>
                <Badge variant={selectedField.source === 'corrected' ? 'default' : 'outline'}>
                  {selectedField.source}
                </Badge>
              </div>
            )}

            {/* Extraction method */}
            {selectedField.extractionMethod && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Extraction Method</span>
                <span className="text-sm">{selectedField.extractionMethod}</span>
              </div>
            )}

            {/* Explanation */}
            {selectedField.explanation && (
              <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-violet-600 mt-0.5" />
                  <p className="text-sm text-violet-800">{selectedField.explanation}</p>
                </div>
              </div>
            )}

            {/* Alternatives */}
            {selectedField.alternatives && selectedField.alternatives.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Alternative Values</p>
                <div className="space-y-2">
                  {selectedField.alternatives.map((alt, i) => (
                    <div key={i} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm font-mono">{formatValue(alt.value)}</span>
                      <span className="text-sm text-muted-foreground">{Math.round(alt.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Corrections */}
            {selectedField.corrections && selectedField.corrections.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Applied Corrections</p>
                <div className="space-y-2">
                  {selectedField.corrections.map((correction, i) => (
                    <div key={i} className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="line-through text-muted-foreground">{formatValue(correction.from)}</span>
                        <span>→</span>
                        <span className="font-medium">{formatValue(correction.to)}</span>
                      </div>
                      <p className="text-xs text-yellow-800 mt-1">{correction.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {onReviewField && selectedField.confidence < CONFIDENCE_THRESHOLDS.high && (
              <Button className="w-full" onClick={() => onReviewField(selectedField)}>
                <Eye className="h-4 w-4 mr-2" />
                Review & Correct
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Extraction Confidence
            </CardTitle>
            <CardDescription>
              Visual analysis of extraction confidence across {data.fields.length} fields
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded-full', getConfidenceColor(data.overallConfidence))} />
            <span className="text-lg font-bold">{Math.round(data.overallConfidence * 100)}%</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium text-violet-800">High Confidence</span>
            </div>
            <p className="text-2xl font-bold text-violet-700">{stats.highConf}</p>
          </div>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">Medium</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700">{stats.medConf}</p>
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">Needs Review</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{stats.lowConf}</p>
          </div>
          <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium text-violet-800">Auto-Corrected</span>
            </div>
            <p className="text-2xl font-bold text-violet-700">{stats.correctedCount}</p>
          </div>
        </div>

        {/* Template & Clause info */}
        {(data.templateMatch || data.clauseAnalysis) && (
          <div className="flex flex-wrap gap-2">
            {data.templateMatch?.detected && (
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" />
                Template: {data.templateMatch.name} ({Math.round((data.templateMatch.confidence || 0) * 100)}%)
              </Badge>
            )}
            {data.clauseAnalysis && (
              <>
                <Badge variant="outline" className="gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {data.clauseAnalysis.totalClauses} Clauses
                </Badge>
                {data.clauseAnalysis.highRisk > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <Shield className="h-3 w-3" />
                    {data.clauseAnalysis.highRisk} High Risk
                  </Badge>
                )}
              </>
            )}
          </div>
        )}

        {/* View controls */}
        <div className="flex items-center justify-between">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList>
              <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as typeof filterLevel)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">All Fields</option>
              <option value="high">High Confidence</option>
              <option value="medium">Medium Confidence</option>
              <option value="low">Needs Review</option>
            </select>
          </div>
        </div>

        {/* Main content */}
        <div className="min-h-[200px]">
          {viewMode === 'heatmap' && renderHeatmapView()}
          {viewMode === 'list' && renderListView()}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-2 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span>High (≥85%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Medium (65-84%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Low (40-64%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Review (&lt;40%)</span>
          </div>
        </div>
      </CardContent>

      {/* Field detail dialog */}
      {renderFieldDetailDialog()}
    </Card>
  );
}

export default ExtractionConfidenceHeatmap;
