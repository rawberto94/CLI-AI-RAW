'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Tag,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
  Building2,
  Shield,
  Gauge,
  Sparkles,
  Loader2,
  Zap,
  Globe,
  Scale,
  Clock,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCategorization } from '@/hooks/useCategorization';
import type { ContractTypeCategory, RiskLevel, IndustrySector } from '@/lib/ai/contract-categorizer';

// ============================================================================
// TYPES
// ============================================================================

interface AICategorizationCardProps {
  contractId: string;
  tenantId?: string;
  className?: string;
  onCategorized?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

// ============================================================================
// HELPER DATA
// ============================================================================

const CONTRACT_TYPE_LABELS: Record<ContractTypeCategory, { label: string; color: string }> = {
  MSA: { label: 'Master Service Agreement', color: 'bg-violet-100 text-violet-700' },
  SOW: { label: 'Statement of Work', color: 'bg-purple-100 text-purple-700' },
  NDA: { label: 'Non-Disclosure Agreement', color: 'bg-purple-100 text-purple-700' },
  SLA: { label: 'Service Level Agreement', color: 'bg-purple-100 text-purple-700' },
  DPA: { label: 'Data Processing Agreement', color: 'bg-pink-100 text-pink-700' },
  LICENSE: { label: 'License Agreement', color: 'bg-violet-100 text-violet-700' },
  EMPLOYMENT: { label: 'Employment Contract', color: 'bg-amber-100 text-amber-700' },
  CONSULTING: { label: 'Consulting Agreement', color: 'bg-violet-100 text-violet-700' },
  VENDOR: { label: 'Vendor Agreement', color: 'bg-violet-100 text-violet-700' },
  PURCHASE: { label: 'Purchase Agreement', color: 'bg-orange-100 text-orange-700' },
  LEASE: { label: 'Lease Agreement', color: 'bg-lime-100 text-lime-700' },
  PARTNERSHIP: { label: 'Partnership Agreement', color: 'bg-rose-100 text-rose-700' },
  AMENDMENT: { label: 'Amendment', color: 'bg-slate-100 text-slate-700' },
  RENEWAL: { label: 'Renewal Agreement', color: 'bg-green-100 text-green-700' },
  SUBCONTRACT: { label: 'Subcontract', color: 'bg-fuchsia-100 text-fuchsia-700' },
  SUBSCRIPTION: { label: 'Subscription Agreement', color: 'bg-sky-100 text-sky-700' },
  OTHER: { label: 'Other', color: 'bg-gray-100 text-gray-700' },
};

const RISK_LEVEL_CONFIG: Record<RiskLevel, { label: string; color: string; icon: typeof Shield }> = {
  LOW: { label: 'Low Risk', color: 'text-violet-600 bg-violet-50', icon: Shield },
  MEDIUM: { label: 'Medium Risk', color: 'text-amber-600 bg-amber-50', icon: AlertTriangle },
  HIGH: { label: 'High Risk', color: 'text-orange-600 bg-orange-50', icon: AlertTriangle },
  CRITICAL: { label: 'Critical Risk', color: 'text-rose-600 bg-rose-50', icon: XCircle },
};

const INDUSTRY_LABELS: Record<IndustrySector, string> = {
  TECHNOLOGY: 'Technology',
  HEALTHCARE: 'Healthcare',
  FINANCE: 'Finance',
  MANUFACTURING: 'Manufacturing',
  RETAIL: 'Retail',
  ENERGY: 'Energy',
  GOVERNMENT: 'Government',
  EDUCATION: 'Education',
  REAL_ESTATE: 'Real Estate',
  LEGAL: 'Legal',
  MEDIA: 'Media',
  TRANSPORTATION: 'Transportation',
  HOSPITALITY: 'Hospitality',
  AGRICULTURE: 'Agriculture',
  CONSTRUCTION: 'Construction',
  OTHER: 'Other',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AICategorizationCard({
  contractId,
  tenantId = 'demo',
  className,
  onCategorized,
  showActions = true,
  compact = false,
}: AICategorizationCardProps) {
  const {
    isLoading,
    isQuickLoading,
    result,
    quickResult,
    error,
    isCategorized,
    categorize,
    quickCategorize,
    getStatus,
  } = useCategorization({
    tenantId,
    onSuccess: () => onCategorized?.(),
  });

  const [expanded, setExpanded] = useState(false);

  // Load status on mount
  useEffect(() => {
    getStatus(contractId);
  }, [contractId, getStatus]);

  // Get display data
  const displayType = result?.contractType?.value || quickResult?.contractType;
  const displayRisk = result?.riskLevel?.value || quickResult?.riskLevel;
  const displayConfidence = result?.overallConfidence || quickResult?.confidence;

  // Compact view
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {isLoading || isQuickLoading ? (
          <Badge variant="secondary" className="animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Categorizing...
          </Badge>
        ) : displayType ? (
          <>
            <Badge className={cn('text-xs', CONTRACT_TYPE_LABELS[displayType as ContractTypeCategory]?.color)}>
              {CONTRACT_TYPE_LABELS[displayType as ContractTypeCategory]?.label || displayType}
            </Badge>
            {displayRisk && (
              <Badge
                variant="outline"
                className={cn('text-xs', RISK_LEVEL_CONFIG[displayRisk as RiskLevel]?.color)}
              >
                {displayRisk}
              </Badge>
            )}
          </>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            <Tag className="h-3 w-3 mr-1" />
            Uncategorized
          </Badge>
        )}
        {showActions && !displayType && !isLoading && !isQuickLoading && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => quickCategorize(contractId)}
            className="h-6 px-2 text-xs"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Categorize
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
            <Tag className="h-4 w-4 text-violet-500" />
            AI Contract Categorization
          </CardTitle>
          {displayConfidence && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs">
                    {displayConfidence}% confidence
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Overall categorization confidence score
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {!displayType && (
          <CardDescription>
            Let AI analyze and categorize this contract
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 text-rose-700 text-sm">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading State */}
        {(isLoading || isQuickLoading) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              <span>Analyzing contract with AI...</span>
            </div>
            <Progress value={isQuickLoading ? 70 : 50} className="h-1" />
          </div>
        )}

        {/* Not Categorized */}
        {!isLoading && !isQuickLoading && !displayType && !error && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              This contract hasn&apos;t been categorized yet.
            </div>
            {showActions && (
              <div className="flex gap-2">
                <Button
                  onClick={() => quickCategorize(contractId)}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Scan
                </Button>
                <Button
                  onClick={() => categorize(contractId)}
                  size="sm"
                  className="flex-1"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Full Analysis
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Categorized Results */}
        {!isLoading && !isQuickLoading && displayType && (
          <div className="space-y-4">
            {/* Primary Classification */}
            <div className="grid grid-cols-2 gap-3">
              {/* Contract Type */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Contract Type
                </p>
                <Badge
                  className={cn(
                    'text-sm font-medium',
                    CONTRACT_TYPE_LABELS[displayType as ContractTypeCategory]?.color
                  )}
                >
                  {CONTRACT_TYPE_LABELS[displayType as ContractTypeCategory]?.label || displayType}
                </Badge>
              </div>

              {/* Risk Level */}
              {displayRisk && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Risk Level
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-sm font-medium',
                      RISK_LEVEL_CONFIG[displayRisk as RiskLevel]?.color
                    )}
                  >
                    {RISK_LEVEL_CONFIG[displayRisk as RiskLevel]?.label}
                  </Badge>
                </div>
              )}
            </div>

            {/* Full Result Details */}
            {result && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {/* Industry */}
                  {result.industry && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Industry
                      </p>
                      <span className="text-sm font-medium">
                        {INDUSTRY_LABELS[result.industry.value as IndustrySector] || result.industry.value}
                      </span>
                    </div>
                  )}

                  {/* Complexity */}
                  {result.complexity && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Gauge className="h-3 w-3" /> Complexity
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{result.complexity.value}/10</span>
                        <Progress value={result.complexity.value * 10} className="h-1.5 w-16" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Expandable Details */}
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
                    className="w-full justify-between text-xs h-7"
                  >
                    <span>View detailed analysis</span>
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
                        className="overflow-hidden space-y-3"
                      >
                        {/* Subject Tags */}
                        {result.subjectTags && result.subjectTags.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Subject Tags</p>
                            <div className="flex flex-wrap gap-1">
                              {result.subjectTags.map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Regulatory Domains */}
                        {result.regulatoryDomains && result.regulatoryDomains.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Scale className="h-3 w-3" /> Regulatory Compliance
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {result.regulatoryDomains.map((domain, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs bg-violet-50 text-violet-700"
                                >
                                  {domain}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Scope */}
                        {result.scope && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {result.scope.geographic && result.scope.geographic.length > 0 && (
                              <div>
                                <p className="text-muted-foreground flex items-center gap-1">
                                  <Globe className="h-3 w-3" /> Geographic
                                </p>
                                <p className="font-medium">{result.scope.geographic.join(', ')}</p>
                              </div>
                            )}
                            {result.scope.duration && (
                              <div>
                                <p className="text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Duration
                                </p>
                                <p className="font-medium">{result.scope.duration}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Contract Flags */}
                        {result.flags && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Key Provisions</p>
                            <div className="grid grid-cols-2 gap-1">
                              {Object.entries(result.flags)
                                .filter(([, value]) => value)
                                .map(([key]) => (
                                  <div
                                    key={key}
                                    className="flex items-center gap-1 text-xs text-violet-600"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    {key.replace(/^has/, '').replace(/([A-Z])/g, ' $1').trim()}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Reasoning */}
                        {result.riskLevel?.reasoning && (
                          <div className="p-2 rounded bg-slate-50 text-xs">
                            <p className="text-muted-foreground mb-1">Risk Assessment Reasoning:</p>
                            <p>{result.riskLevel.reasoning}</p>
                          </div>
                        )}

                        {/* Processing Info */}
                        {result.metadata && (
                          <div className="text-xs text-muted-foreground pt-2 border-t">
                            Analyzed by {result.metadata.model} in {result.metadata.processingTimeMs}ms
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            {/* Actions */}
            {showActions && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => categorize(contractId, { forceRecategorize: true })}
                  className="flex-1 text-xs h-7"
                  disabled={isLoading}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Re-analyze
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// INLINE BADGE COMPONENT
// ============================================================================

interface CategorizationBadgeProps {
  contractType?: string;
  riskLevel?: string;
  confidence?: number;
  className?: string;
  showRisk?: boolean;
}

export function CategorizationBadge({
  contractType,
  riskLevel,
  confidence,
  className,
  showRisk = true,
}: CategorizationBadgeProps) {
  if (!contractType) {
    return (
      <Badge variant="outline" className={cn('text-xs text-muted-foreground', className)}>
        Uncategorized
      </Badge>
    );
  }

  const typeConfig = CONTRACT_TYPE_LABELS[contractType as ContractTypeCategory];
  const riskConfig = riskLevel ? RISK_LEVEL_CONFIG[riskLevel as RiskLevel] : null;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Badge className={cn('text-xs', typeConfig?.color || 'bg-gray-100 text-gray-700')}>
        {typeConfig?.label || contractType}
      </Badge>
      {showRisk && riskConfig && (
        <Badge variant="outline" className={cn('text-xs', riskConfig.color)}>
          {riskLevel}
        </Badge>
      )}
      {confidence && confidence < 70 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            </TooltipTrigger>
            <TooltipContent>Low confidence ({confidence}%) - review recommended</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
