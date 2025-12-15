'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  Calendar,
  DollarSign,
  Building2,
  User,
  Scale,
  Info,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface MetadataField {
  field: string;
  hasValue: boolean;
  type: string;
  value?: unknown;
  confidence?: number;
}

interface MetadataStatusData {
  hasMetadata: boolean;
  fields: number;
  populatedFields: number;
  fieldDetails: MetadataField[];
  extractedAt?: string;
  confidence?: number;
  model?: string;
}

interface MetadataExtractionStatusProps {
  contractId: string;
  tenantId?: string;
  className?: string;
  onExtracted?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

// ============================================================================
// FIELD ICON MAPPING
// ============================================================================

const FIELD_ICONS: Record<string, typeof FileText> = {
  contract_type: FileText,
  effective_date: Calendar,
  expiration_date: Calendar,
  total_value: DollarSign,
  currency: DollarSign,
  party_a_name: Building2,
  party_b_name: Building2,
  governing_law: Scale,
  jurisdiction: Scale,
  payment_terms: DollarSign,
  auto_renewal: RefreshCw,
  notice_period: Clock,
  contact_email: User,
  contact_name: User,
};

function getFieldIcon(fieldName: string) {
  const key = fieldName.toLowerCase().replace(/\s/g, '_');
  return FIELD_ICONS[key] || Info;
}

function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MetadataExtractionStatus({
  contractId,
  tenantId = 'demo',
  className,
  onExtracted,
  showActions = true,
  compact = false,
}: MetadataExtractionStatusProps) {
  const [status, setStatus] = useState<MetadataStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Fetch current status
  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/contracts/${contractId}/extract-metadata`, {
        headers: {
          'x-tenant-id': tenantId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metadata status');
      }

      const payload = await response.json();
      const extraction = payload?.data;

      if (!payload?.success) {
        setStatus({
          hasMetadata: false,
          fields: 0,
          populatedFields: 0,
          fieldDetails: [],
        });
        return;
      }

      if (!extraction) {
        setStatus({
          hasMetadata: false,
          fields: 0,
          populatedFields: 0,
          fieldDetails: [],
        });
        return;
      }

      const fieldDetailsObj: Record<string, any> = extraction.fieldDetails || {};
      const fieldDetailsArr: MetadataField[] = Object.entries(fieldDetailsObj).map(([field, details]) => {
        const value = details?.value;
        const hasValue = value !== null && value !== undefined && String(value).trim?.() !== '';
        return {
          field,
          hasValue,
          type: typeof value,
          value,
          confidence: typeof details?.confidence === 'number' ? details.confidence : undefined,
        };
      });

      const populatedFields = fieldDetailsArr.filter(f => f.hasValue).length;

      setStatus({
        hasMetadata: fieldDetailsArr.length > 0,
        fields: fieldDetailsArr.length,
        populatedFields,
        fieldDetails: fieldDetailsArr,
        extractedAt: extraction.lastExtraction?.extractedAt,
        confidence: extraction.lastExtraction?.summary?.averageConfidence,
        model: extraction.lastExtraction?.model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, tenantId]);

  // Trigger extraction
  const handleExtract = async (forceReExtract = false) => {
    try {
      setIsExtracting(true);
      setError(null);

      const response = await fetch(`/api/contracts/${contractId}/extract-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          useContractText: true,
          options: {
            enableMultiPass: true,
            maxPasses: 2,
            confidenceThreshold: 0.7,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Extraction failed');
      }

      // Refresh status
      await fetchStatus();
      onExtracted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };

  // Compact view
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {isLoading ? (
          <Badge variant="secondary" className="animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
            Loading...
          </Badge>
        ) : status?.hasMetadata ? (
          <Badge variant="default" className="bg-emerald-500">
            <Sparkles className="h-3 w-3 mr-1" />
            {status.populatedFields} fields
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <AlertCircle className="h-3 w-3 mr-1" />
            No metadata
          </Badge>
        )}
        {showActions && !status?.hasMetadata && !isExtracting && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleExtract()}
            className="h-6 px-2 text-xs"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Extract
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            AI Metadata Extraction
          </CardTitle>
          {status?.hasMetadata && (
            <Badge
              variant="outline"
              className="text-xs"
            >
              {Math.round((status.confidence || 0) * 100)}% confidence
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading metadata status...
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 text-rose-700 text-sm">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Extraction in progress */}
        {isExtracting && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
              <span>Extracting metadata with AI...</span>
            </div>
            <Progress value={50} className="h-1" />
          </div>
        )}

        {/* No metadata yet */}
        {!isLoading && !isExtracting && !status?.hasMetadata && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              No metadata has been extracted for this contract yet.
            </div>
            {showActions && (
              <Button
                onClick={() => handleExtract()}
                size="sm"
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Extract Metadata with AI
              </Button>
            )}
          </div>
        )}

        {/* Has metadata */}
        {!isLoading && !isExtracting && status?.hasMetadata && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-muted-foreground">
                  {status.populatedFields} of {status.fields} fields populated
                </span>
              </div>
              <Progress
                value={(status.populatedFields / Math.max(status.fields, 1)) * 100}
                className="h-1.5 w-24"
              />
            </div>

            {/* Extracted info */}
            {status.extractedAt && (
              <div className="text-xs text-muted-foreground">
                Extracted {new Date(status.extractedAt).toLocaleDateString()} using {status.model || 'AI'}
              </div>
            )}

            {/* Fields list (expandable) */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="w-full justify-between text-xs h-7"
              >
                <span>View field details</span>
                {expanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-1.5 pt-2">
                      {status.fieldDetails.map((field) => {
                        const Icon = getFieldIcon(field.field);
                        return (
                          <div
                            key={field.field}
                            className={cn(
                              'flex items-center gap-1.5 p-1.5 rounded text-xs',
                              field.hasValue
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-50 text-slate-400'
                            )}
                          >
                            <Icon className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">
                              {formatFieldName(field.field)}
                            </span>
                            {field.hasValue && (
                              <CheckCircle2 className="h-3 w-3 ml-auto flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExtract(true)}
                  className="flex-1 text-xs h-7"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Re-extract
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
