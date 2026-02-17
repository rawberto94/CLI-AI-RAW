'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown, 
  AlertTriangle, 
  Clock,
  DollarSign,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Brain,
  Shield,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Types
export type SuggestionType = 'approve' | 'reject' | 'review' | 'escalate';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type FactorType = 'positive' | 'negative' | 'neutral' | 'warning';

export interface SuggestionFactor {
  id: string;
  label: string;
  description: string;
  type: FactorType;
  weight: number; // -100 to 100
  category: 'financial' | 'compliance' | 'relationship' | 'risk' | 'timeline';
  source?: string;
}

export interface ApprovalSuggestion {
  id: string;
  approvalId: string;
  suggestion: SuggestionType;
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  factors: SuggestionFactor[];
  similarContracts?: {
    total: number;
    approved: number;
    rejected: number;
  };
  estimatedImpact?: {
    revenue?: number;
    risk?: 'low' | 'medium' | 'high';
    relationship?: 'positive' | 'neutral' | 'negative';
  };
  recommendedActions?: string[];
  generatedAt: Date;
}

// Helper to get confidence level from score
function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

// Generate mock suggestion based on approval data
export function generateMockSuggestion(approvalId: string): ApprovalSuggestion {
  const random = Math.random();
  const suggestion: SuggestionType = 
    random > 0.7 ? 'approve' : 
    random > 0.4 ? 'review' : 
    random > 0.15 ? 'reject' : 'escalate';
  
  const confidence = Math.floor(Math.random() * 40) + 60;
  
  const factors: SuggestionFactor[] = [
    {
      id: '1',
      label: 'Contract Value Within Budget',
      description: 'The contract value of $45,000 is within the approved budget range for this project.',
      type: 'positive',
      weight: 85,
      category: 'financial',
      source: 'Budget Analysis'
    },
    {
      id: '2',
      label: 'Vendor History',
      description: 'This vendor has completed 12 contracts successfully with 95% satisfaction rate.',
      type: 'positive',
      weight: 75,
      category: 'relationship',
      source: 'Vendor Database'
    },
    {
      id: '3',
      label: 'Non-standard Terms',
      description: 'Section 4.2 contains liability terms that deviate from standard template.',
      type: 'warning',
      weight: -40,
      category: 'compliance',
      source: 'Legal Review AI'
    },
    {
      id: '4',
      label: 'Timeline Concerns',
      description: 'Delivery timeline is 20% shorter than similar past contracts.',
      type: 'neutral',
      weight: -15,
      category: 'timeline',
      source: 'Historical Analysis'
    },
    {
      id: '5',
      label: 'Market Rate Alignment',
      description: 'Pricing is 5% below market average for comparable services.',
      type: 'positive',
      weight: 60,
      category: 'financial',
      source: 'Market Intelligence'
    }
  ];

  return {
    id: `suggestion-${approvalId}`,
    approvalId,
    suggestion,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    factors,
    similarContracts: {
      total: 47,
      approved: 38,
      rejected: 9
    },
    estimatedImpact: {
      revenue: 45000,
      risk: 'medium',
      relationship: 'positive'
    },
    recommendedActions: [
      'Review liability clause in Section 4.2 with legal team',
      'Confirm delivery timeline feasibility with operations',
      'Request payment terms adjustment to Net 45'
    ],
    generatedAt: new Date()
  };
}

// Suggestion Badge Component
interface SuggestionBadgeProps {
  suggestion: SuggestionType;
  confidence: number;
  size?: 'sm' | 'md' | 'lg';
  showConfidence?: boolean;
  className?: string;
}

export function SuggestionBadge({ 
  suggestion, 
  confidence,
  size = 'md', 
  showConfidence = true,
  className 
}: SuggestionBadgeProps) {
  const config = {
    approve: { 
      icon: ThumbsUp, 
      label: 'Approve', 
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    reject: { 
      icon: ThumbsDown, 
      label: 'Reject', 
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      borderColor: 'border-red-200 dark:border-red-800'
    },
    review: { 
      icon: HelpCircle, 
      label: 'Needs Review', 
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      borderColor: 'border-yellow-200 dark:border-yellow-800'
    },
    escalate: { 
      icon: AlertTriangle, 
      label: 'Escalate', 
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      borderColor: 'border-orange-200 dark:border-orange-800'
    }
  };

  const { icon: Icon, label, color, borderColor } = config[suggestion];
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2'
  };
  const iconSizes = { sm: 12, md: 14, lg: 16 };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'inline-flex items-center font-medium border',
        color,
        borderColor,
        sizeClasses[size],
        className
      )}
    >
      <Icon size={iconSizes[size]} />
      <span>{label}</span>
      {showConfidence && (
        <span className="opacity-75">({confidence}%)</span>
      )}
    </Badge>
  );
}

// Confidence Meter Component
interface ConfidenceMeterProps {
  confidence: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceMeter({ 
  confidence, 
  size = 'md',
  showLabel = true,
  className 
}: ConfidenceMeterProps) {
  const level = getConfidenceLevel(confidence);
  
  const colors = {
    high: 'bg-green-500',
    medium: 'bg-yellow-500',
    low: 'bg-red-500'
  };

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">AI Confidence</span>
          <span className={cn(
            'font-medium',
            level === 'high' && 'text-green-600 dark:text-green-400',
            level === 'medium' && 'text-yellow-600 dark:text-yellow-400',
            level === 'low' && 'text-red-600 dark:text-red-400'
          )}>
            {confidence}% ({level})
          </span>
        </div>
      )}
      <div className={cn(
        'w-full bg-muted rounded-full overflow-hidden',
        heightClasses[size]
      )}>
        <motion.div
          className={cn('h-full rounded-full', colors[level])}
          initial={{ width: 0 }}
          animate={{ width: `${confidence}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// Factor Item Component
interface FactorItemProps {
  factor: SuggestionFactor;
  showWeight?: boolean;
  compact?: boolean;
}

function FactorItem({ factor, showWeight = true, compact = false }: FactorItemProps) {
  const typeConfig = {
    positive: { 
      icon: TrendingUp, 
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20'
    },
    negative: { 
      icon: TrendingDown, 
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20'
    },
    neutral: { 
      icon: Minus, 
      color: 'text-gray-600 dark:text-gray-400',
      bg: 'bg-gray-50 dark:bg-gray-900/20'
    },
    warning: { 
      icon: AlertTriangle, 
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20'
    }
  };

  const categoryIcons = {
    financial: DollarSign,
    compliance: Shield,
    relationship: Users,
    risk: AlertTriangle,
    timeline: Clock
  };

  const { icon: TypeIcon, color, bg } = typeConfig[factor.type];
  const CategoryIcon = categoryIcons[factor.category];

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              'flex items-center gap-2 p-2 rounded-md',
              bg
            )}>
              <TypeIcon size={14} className={color} />
              <span className="text-sm truncate flex-1">{factor.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p>{factor.description}</p>
            {factor.source && (
              <p className="text-xs text-muted-foreground mt-1">
                Source: {factor.source}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn('p-3 rounded-lg', bg)}>
      <div className="flex items-start gap-3">
        <div className={cn('p-1.5 rounded-md bg-background/50', color)}>
          <TypeIcon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">{factor.label}</span>
            {showWeight && (
              <span className={cn(
                'text-xs font-mono',
                factor.weight > 0 ? 'text-green-600 dark:text-green-400' : 
                factor.weight < 0 ? 'text-red-600 dark:text-red-400' : 
                'text-gray-600 dark:text-gray-400'
              )}>
                {factor.weight > 0 ? '+' : ''}{factor.weight}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {factor.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              <CategoryIcon size={10} className="mr-1" />
              {factor.category}
            </Badge>
            {factor.source && (
              <span className="text-xs text-muted-foreground">
                via {factor.source}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Smart Suggestion Compact Widget
interface SmartSuggestionWidgetProps {
  suggestion: ApprovalSuggestion;
  onApply?: (suggestion: SuggestionType) => void;
  onRefresh?: () => void;
  className?: string;
}

export function SmartSuggestionWidget({ 
  suggestion, 
  onApply,
  onRefresh,
  className 
}: SmartSuggestionWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const topFactors = suggestion.factors.slice(0, 3);

  return (
    <Card className={cn('border-2 border-violet-200 dark:border-violet-800', className)} role="region" aria-label="AI Suggestion">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-900/50" aria-hidden="true">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <CardTitle className="text-sm">AI Suggestion</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={onRefresh}
                aria-label="Refresh AI suggestion"
              >
                <RefreshCw size={14} aria-hidden="true" />
              </Button>
            )}
            <SuggestionBadge 
              suggestion={suggestion.suggestion}
              confidence={suggestion.confidence}
              size="sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConfidenceMeter confidence={suggestion.confidence} size="sm" />
        
        {/* Quick factors */}
        <div className="space-y-1">
          {topFactors.map(factor => (
            <FactorItem key={factor.id} factor={factor} compact />
          ))}
        </div>

        {/* Expand/collapse for more */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="text-xs">
                {isExpanded ? 'Show less' : `${suggestion.factors.length - 3} more factors`}
              </span>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 pt-2">
            {suggestion.factors.slice(3).map(factor => (
              <FactorItem key={factor.id} factor={factor} compact />
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Actions */}
        {onApply && (
          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => onApply(suggestion.suggestion)}
            >
              <Zap size={14} className="mr-1" />
              Apply Suggestion
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Full Smart Suggestion Panel
interface SmartSuggestionPanelProps {
  suggestion: ApprovalSuggestion;
  onApprove?: () => void;
  onReject?: () => void;
  onEscalate?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function SmartSuggestionPanel({
  suggestion,
  onApprove,
  onReject,
  onEscalate,
  onRefresh,
  isLoading = false,
  className
}: SmartSuggestionPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('all');

  // Group factors by category
  const groupedFactors = useMemo(() => {
    return suggestion.factors.reduce((acc, factor) => {
      if (!acc[factor.category]) {
        acc[factor.category] = [];
      }
      acc[factor.category]!.push(factor);
      return acc;
    }, {} as Record<string, SuggestionFactor[]>);
  }, [suggestion.factors]);

  const categoryLabels: Record<string, string> = {
    financial: 'Financial Analysis',
    compliance: 'Compliance Check',
    relationship: 'Vendor Relationship',
    risk: 'Risk Assessment',
    timeline: 'Timeline Analysis'
  };

  const categoryIcons: Record<string, typeof DollarSign> = {
    financial: DollarSign,
    compliance: Shield,
    relationship: Users,
    risk: AlertTriangle,
    timeline: Clock
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/50">
              <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Decision Assistant</CardTitle>
              <CardDescription>
                Analyzed {suggestion.similarContracts?.total || 0} similar contracts
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw size={14} className={cn('mr-1', isLoading && 'animate-spin')} />
                Refresh
              </Button>
            )}
            <SuggestionBadge 
              suggestion={suggestion.suggestion}
              confidence={suggestion.confidence}
              size="lg"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Confidence Section */}
        <div className="p-4 border-b">
          <ConfidenceMeter confidence={suggestion.confidence} />
          
          {/* Similar contracts stats */}
          {suggestion.similarContracts && (
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">
                  {suggestion.similarContracts.total}
                </div>
                <div className="text-xs text-muted-foreground">Similar</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {suggestion.similarContracts.approved}
                </div>
                <div className="text-xs text-muted-foreground">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {suggestion.similarContracts.rejected}
                </div>
                <div className="text-xs text-muted-foreground">Rejected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                  {Math.round((suggestion.similarContracts.approved / suggestion.similarContracts.total) * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">Approval Rate</div>
              </div>
            </div>
          )}
        </div>

        {/* Factors by Category */}
        <div className="divide-y">
          {Object.entries(groupedFactors).map(([category, factors]) => {
            const Icon = categoryIcons[category] || FileText;
            const isExpanded = expandedCategory === 'all' || expandedCategory === category;
            
            return (
              <Collapsible 
                key={category} 
                open={isExpanded}
                onOpenChange={(open) => setExpandedCategory(open ? category : null)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-muted-foreground" />
                    <span className="font-medium">{categoryLabels[category] || category}</span>
                    <Badge variant="secondary" className="text-xs">
                      {factors.length}
                    </Badge>
                  </div>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 space-y-2">
                  {factors.map(factor => (
                    <FactorItem key={factor.id} factor={factor} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Recommended Actions */}
        {suggestion.recommendedActions && suggestion.recommendedActions.length > 0 && (
          <div className="p-4 border-t bg-violet-50/50 dark:bg-violet-900/10">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-violet-600 dark:text-violet-400" />
              <span className="font-medium text-sm">Recommended Actions</span>
            </div>
            <ul className="space-y-2">
              {suggestion.recommendedActions.map((action, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 size={14} className="text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Estimated Impact */}
        {suggestion.estimatedImpact && (
          <div className="p-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-muted-foreground" />
              <span className="font-medium text-sm">Estimated Impact</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {suggestion.estimatedImpact.revenue && (
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <DollarSign size={18} className="mx-auto text-green-600 dark:text-green-400" />
                  <div className="text-lg font-bold">
                    ${(suggestion.estimatedImpact.revenue / 1000).toFixed(0)}K
                  </div>
                  <div className="text-xs text-muted-foreground">Revenue</div>
                </div>
              )}
              {suggestion.estimatedImpact.risk && (
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Shield size={18} className={cn('mx-auto',
                    suggestion.estimatedImpact.risk === 'low' && 'text-green-600 dark:text-green-400',
                    suggestion.estimatedImpact.risk === 'medium' && 'text-yellow-600 dark:text-yellow-400',
                    suggestion.estimatedImpact.risk === 'high' && 'text-red-600 dark:text-red-400'
                  )} />
                  <div className="text-lg font-bold capitalize">
                    {suggestion.estimatedImpact.risk}
                  </div>
                  <div className="text-xs text-muted-foreground">Risk Level</div>
                </div>
              )}
              {suggestion.estimatedImpact.relationship && (
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Users size={18} className={cn('mx-auto',
                    suggestion.estimatedImpact.relationship === 'positive' && 'text-green-600 dark:text-green-400',
                    suggestion.estimatedImpact.relationship === 'neutral' && 'text-gray-600 dark:text-gray-400',
                    suggestion.estimatedImpact.relationship === 'negative' && 'text-red-600 dark:text-red-400'
                  )} />
                  <div className="text-lg font-bold capitalize">
                    {suggestion.estimatedImpact.relationship}
                  </div>
                  <div className="text-xs text-muted-foreground">Relationship</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 border-t bg-muted/30 flex gap-2">
          {onApprove && (
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={onApprove}
            >
              <CheckCircle2 size={16} className="mr-2" />
              Approve
            </Button>
          )}
          {onReject && (
            <Button 
              variant="destructive"
              className="flex-1"
              onClick={onReject}
            >
              <XCircle size={16} className="mr-2" />
              Reject
            </Button>
          )}
          {onEscalate && (
            <Button 
              variant="outline"
              className="flex-1"
              onClick={onEscalate}
            >
              <AlertTriangle size={16} className="mr-2" />
              Escalate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for fetching suggestions from the real AI API
export function useSmartSuggestion(approvalId: string | null) {
  const [suggestion, setSuggestion] = useState<ApprovalSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestion = useCallback(async () => {
    if (!approvalId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/approvals/${approvalId}/suggestion`);
      if (!res.ok) {
        throw new Error('Failed to fetch AI suggestion');
      }
      const json = await res.json();
      const data = json.data;
      setSuggestion({
        ...data,
        generatedAt: data.generatedAt ? new Date(data.generatedAt) : new Date(),
      } as ApprovalSuggestion);
    } catch {
      setError('Failed to fetch AI suggestion');
    } finally {
      setIsLoading(false);
    }
  }, [approvalId]);

  const refresh = useCallback(() => {
    fetchSuggestion();
  }, [fetchSuggestion]);

  return {
    suggestion,
    isLoading,
    error,
    refresh,
    fetchSuggestion
  };
}

export default SmartSuggestionPanel;
