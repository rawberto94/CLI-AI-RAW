'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  AlertCircle,
  Info,
  FileWarning,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ============================================================================
// TYPES
// ============================================================================

export interface LowConfidenceRegion {
  start: number;
  end: number;
  text: string;
  avgConfidence: number;
  fieldType?: 'date' | 'amount' | 'name' | 'address' | 'general';
}

export interface OCRQualityMetrics {
  overallConfidence: number;
  textLength: number;
  tablesDetected: number;
  lowConfidenceRegions: LowConfidenceRegion[];
  corrections: {
    spelling: number;
    dates: number;
    amounts: number;
    total: number;
  };
  processingTime: number;
  ocrProvider: string;
  needsReview: boolean;
}

export interface OCRConfidenceIndicatorProps {
  metrics: OCRQualityMetrics;
  onReviewRequest?: () => void;
  onRegionClick?: (region: LowConfidenceRegion) => void;
  className?: string;
  compact?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getConfidenceLevel(confidence: number): {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
} {
  if (confidence >= 0.9) {
    return {
      label: 'High Confidence',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      icon: <CheckCircle className="h-4 w-4" />,
    };
  }
  if (confidence >= 0.7) {
    return {
      label: 'Good Confidence',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      icon: <Info className="h-4 w-4" />,
    };
  }
  if (confidence >= 0.5) {
    return {
      label: 'Review Recommended',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      icon: <AlertTriangle className="h-4 w-4" />,
    };
  }
  return {
    label: 'Manual Review Needed',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: <AlertCircle className="h-4 w-4" />,
  };
}

function formatFieldType(type?: string): string {
  const typeMap: Record<string, string> = {
    date: 'Date',
    amount: 'Amount',
    name: 'Name',
    address: 'Address',
    general: 'Text',
  };
  return type ? typeMap[type] || 'Unknown' : 'Text';
}

// ============================================================================
// COMPACT BADGE COMPONENT
// ============================================================================

export function OCRConfidenceBadge({ 
  confidence, 
  needsReview,
  className 
}: { 
  confidence: number; 
  needsReview?: boolean;
  className?: string;
}) {
  const level = getConfidenceLevel(confidence);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1 font-medium',
              level.color,
              level.bgColor,
              className
            )}
          >
            {level.icon}
            <span>{Math.round(confidence * 100)}%</span>
            {needsReview && (
              <Eye className="h-3 w-3 ml-1" />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{level.label}</p>
          <p className="text-xs text-muted-foreground">
            OCR extraction confidence score
          </p>
          {needsReview && (
            <p className="text-xs text-yellow-600 mt-1">
              Manual review recommended
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// LOW CONFIDENCE REGION HIGHLIGHT
// ============================================================================

export function LowConfidenceHighlight({
  text,
  regions,
  onRegionClick,
}: {
  text: string;
  regions: LowConfidenceRegion[];
  onRegionClick?: (region: LowConfidenceRegion) => void;
}) {
  if (!regions.length) {
    return <span>{text}</span>;
  }

  // Sort regions by start position
  const sortedRegions = [...regions].sort((a, b) => a.start - b.start);
  const elements: React.ReactNode[] = [];
  let lastEnd = 0;

  sortedRegions.forEach((region, idx) => {
    // Add text before this region
    if (region.start > lastEnd) {
      elements.push(
        <span key={`text-${idx}`}>{text.slice(lastEnd, region.start)}</span>
      );
    }

    // Add highlighted region
    const level = getConfidenceLevel(region.avgConfidence);
    elements.push(
      <TooltipProvider key={`region-${idx}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <mark
              className={cn(
                'cursor-pointer rounded px-0.5 transition-colors',
                level.bgColor,
                'hover:ring-2 hover:ring-offset-1',
                region.avgConfidence < 0.5 ? 'hover:ring-red-400' : 'hover:ring-yellow-400'
              )}
              onClick={() => onRegionClick?.(region)}
            >
              {text.slice(region.start, region.end)}
            </mark>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium flex items-center gap-1">
                {level.icon}
                {Math.round(region.avgConfidence * 100)}% confidence
              </p>
              <p className="text-xs text-muted-foreground">
                Type: {formatFieldType(region.fieldType)}
              </p>
              <p className="text-xs text-yellow-600">
                Click to review this section
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    lastEnd = region.end;
  });

  // Add remaining text
  if (lastEnd < text.length) {
    elements.push(<span key="text-end">{text.slice(lastEnd)}</span>);
  }

  return <>{elements}</>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function OCRConfidenceIndicator({
  metrics,
  onReviewRequest,
  onRegionClick,
  className,
  compact = false,
}: OCRConfidenceIndicatorProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const level = getConfidenceLevel(metrics.overallConfidence);
  const hasIssues = metrics.lowConfidenceRegions.length > 0 || metrics.needsReview;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <OCRConfidenceBadge 
          confidence={metrics.overallConfidence} 
          needsReview={metrics.needsReview}
        />
        {hasIssues && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 text-yellow-600 bg-yellow-50">
                  <FileWarning className="h-3 w-3" />
                  {metrics.lowConfidenceRegions.length} issues
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{metrics.lowConfidenceRegions.length} sections need review</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', level.bgColor)}>
                <Sparkles className={cn('h-5 w-5', level.color)} />
              </div>
              <div>
                <CardTitle className="text-base">OCR Quality</CardTitle>
                <CardDescription className="text-sm">
                  Extraction confidence analysis
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <OCRConfidenceBadge 
                confidence={metrics.overallConfidence} 
                needsReview={metrics.needsReview}
              />
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Confidence Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overall Confidence</span>
                <span className={cn('font-medium', level.color)}>
                  {Math.round(metrics.overallConfidence * 100)}%
                </span>
              </div>
              <Progress 
                value={metrics.overallConfidence * 100} 
                className="h-2"
              />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium">{metrics.ocrProvider}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-muted-foreground">Tables Found</span>
                <span className="font-medium">{metrics.tablesDetected}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-muted-foreground">Auto-Corrections</span>
                <span className="font-medium">{metrics.corrections.total}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-muted-foreground">Processing</span>
                <span className="font-medium">{metrics.processingTime}ms</span>
              </div>
            </div>

            {/* Corrections Breakdown */}
            {metrics.corrections.total > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Auto-Corrections Applied</p>
                <div className="flex flex-wrap gap-2">
                  {metrics.corrections.spelling > 0 && (
                    <Badge variant="secondary">
                      Spelling: {metrics.corrections.spelling}
                    </Badge>
                  )}
                  {metrics.corrections.dates > 0 && (
                    <Badge variant="secondary">
                      Dates: {metrics.corrections.dates}
                    </Badge>
                  )}
                  {metrics.corrections.amounts > 0 && (
                    <Badge variant="secondary">
                      Amounts: {metrics.corrections.amounts}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Low Confidence Regions */}
            {metrics.lowConfidenceRegions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-yellow-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Sections Needing Review ({metrics.lowConfidenceRegions.length})
                  </p>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {metrics.lowConfidenceRegions.slice(0, 5).map((region, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'p-2 rounded-lg border cursor-pointer transition-colors',
                        'hover:border-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
                        getConfidenceLevel(region.avgConfidence).bgColor
                      )}
                      onClick={() => onRegionClick?.(region)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          {formatFieldType(region.fieldType)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(region.avgConfidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-sm font-mono truncate">
                        &ldquo;{region.text}&rdquo;
                      </p>
                    </div>
                  ))}
                  {metrics.lowConfidenceRegions.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{metrics.lowConfidenceRegions.length - 5} more sections
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Review Button */}
            {metrics.needsReview && onReviewRequest && (
              <Button 
                onClick={onReviewRequest}
                className="w-full"
                variant={metrics.overallConfidence < 0.5 ? 'destructive' : 'default'}
              >
                <Eye className="h-4 w-4 mr-2" />
                Request Manual Review
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ============================================================================
// INLINE TEXT WITH CONFIDENCE
// ============================================================================

export function TextWithConfidence({
  text,
  confidence,
  fieldName,
  onEdit,
}: {
  text: string;
  confidence: number;
  fieldName: string;
  onEdit?: () => void;
}) {
  const level = getConfidenceLevel(confidence);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1 rounded cursor-help',
              confidence < 0.7 && level.bgColor,
              confidence < 0.5 && 'border border-dashed border-red-300'
            )}
            onClick={onEdit}
          >
            {text}
            {confidence < 0.7 && (
              <span className={cn('text-xs', level.color)}>
                {level.icon}
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{fieldName}</p>
            <p className={cn('text-sm flex items-center gap-1', level.color)}>
              {level.icon}
              {Math.round(confidence * 100)}% confidence
            </p>
            {confidence < 0.7 && (
              <p className="text-xs text-muted-foreground">
                Click to verify or edit
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default OCRConfidenceIndicator;
