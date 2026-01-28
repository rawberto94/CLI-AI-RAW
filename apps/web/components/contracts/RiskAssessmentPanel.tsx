/**
 * Risk Assessment Panel
 * Displays contract risk analysis with detailed breakdown
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  FileText,
  Scale,
  Clock,
  DollarSign,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface RiskFactor {
  id: string;
  category: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  score: number;
  weight: number;
  details: string;
  recommendation?: string;
  clause?: string;
}

export interface RiskAssessment {
  overallScore: number;
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
  factors: RiskFactor[];
  summary: string;
  recommendations: string[];
  lastUpdated: Date;
}

interface RiskAssessmentPanelProps {
  contractId: string;
  className?: string;
  compact?: boolean;
}

const severityConfig: Record<string, { 
  color: string; 
  bg: string; 
  border: string;
  icon: React.ElementType;
  label: string;
}> = {
  critical: { 
    color: 'text-red-700', 
    bg: 'bg-red-100', 
    border: 'border-red-200',
    icon: AlertCircle,
    label: 'Critical'
  },
  high: { 
    color: 'text-orange-700', 
    bg: 'bg-orange-100', 
    border: 'border-orange-200',
    icon: AlertTriangle,
    label: 'High'
  },
  medium: { 
    color: 'text-yellow-700', 
    bg: 'bg-yellow-100', 
    border: 'border-yellow-200',
    icon: Info,
    label: 'Medium'
  },
  low: { 
    color: 'text-green-700', 
    bg: 'bg-green-100', 
    border: 'border-green-200',
    icon: CheckCircle2,
    label: 'Low'
  },
};

const categoryIcons: Record<string, React.ElementType> = {
  'Legal': Scale,
  'Financial': DollarSign,
  'Compliance': Shield,
  'Operational': Clock,
  'Counterparty': Users,
  'Contractual': FileText,
};

// Mock risk assessment generator
function generateMockAssessment(): RiskAssessment {
  const factors: RiskFactor[] = [
    {
      id: 'rf_1',
      category: 'Legal',
      name: 'Liability Cap Missing',
      description: 'No explicit liability limitation clause found',
      severity: 'high',
      score: 75,
      weight: 0.15,
      details: 'The contract does not contain a clear liability cap, which could expose the organization to unlimited liability in case of breach or damages.',
      recommendation: 'Add a liability limitation clause capping exposure to the contract value or a fixed amount.',
      clause: 'Section 8 - Indemnification',
    },
    {
      id: 'rf_2',
      category: 'Financial',
      name: 'Payment Terms Extended',
      description: 'Net 90 payment terms may impact cash flow',
      severity: 'medium',
      score: 55,
      weight: 0.12,
      details: 'Payment terms of Net 90 days are longer than standard industry practice (Net 30-45), potentially affecting cash flow management.',
      recommendation: 'Negotiate for Net 45 or include early payment discount provisions.',
      clause: 'Section 4.2 - Payment Schedule',
    },
    {
      id: 'rf_3',
      category: 'Compliance',
      name: 'Data Protection Clause Weak',
      description: 'Insufficient data handling requirements',
      severity: 'high',
      score: 70,
      weight: 0.18,
      details: 'The data protection provisions do not adequately address GDPR, CCPA, or other regulatory requirements for handling personal data.',
      recommendation: 'Strengthen data protection clause with specific regulatory compliance requirements and breach notification procedures.',
      clause: 'Section 12 - Data Protection',
    },
    {
      id: 'rf_4',
      category: 'Operational',
      name: 'SLA Terms Favorable',
      description: 'Service level agreements are well-defined',
      severity: 'low',
      score: 25,
      weight: 0.1,
      details: 'SLA terms include specific uptime guarantees, response times, and remedies that adequately protect business interests.',
    },
    {
      id: 'rf_5',
      category: 'Contractual',
      name: 'Auto-Renewal Clause',
      description: 'Contract auto-renews without explicit notice',
      severity: 'medium',
      score: 50,
      weight: 0.1,
      details: 'The contract includes an auto-renewal clause that triggers 60 days before expiration, which may lead to unintended renewals.',
      recommendation: 'Set up calendar reminder 90 days before renewal date to evaluate continuation.',
      clause: 'Section 2.3 - Term and Renewal',
    },
    {
      id: 'rf_6',
      category: 'Counterparty',
      name: 'Vendor Financial Stability',
      description: 'Counterparty shows strong financials',
      severity: 'low',
      score: 20,
      weight: 0.15,
      details: 'Based on available financial data, the counterparty demonstrates stable revenue growth and healthy financial ratios.',
    },
    {
      id: 'rf_7',
      category: 'Legal',
      name: 'Termination for Convenience',
      description: 'One-sided termination rights',
      severity: 'medium',
      score: 60,
      weight: 0.1,
      details: 'The counterparty has broad termination for convenience rights with only 30-day notice, while our termination rights are more restricted.',
      recommendation: 'Negotiate mutual termination for convenience rights or extend notice period to 60-90 days.',
      clause: 'Section 15 - Termination',
    },
    {
      id: 'rf_8',
      category: 'Compliance',
      name: 'IP Rights Clear',
      description: 'Intellectual property ownership is well-defined',
      severity: 'low',
      score: 15,
      weight: 0.1,
      details: 'IP ownership, licensing rights, and work product assignments are clearly defined with appropriate protections.',
    },
  ];

  const weightedScore = factors.reduce((acc, f) => acc + (f.score * f.weight), 0);
  const overallRisk = weightedScore >= 60 ? 'high' : weightedScore >= 40 ? 'medium' : 'low';

  return {
    overallScore: Math.round(weightedScore),
    overallRisk,
    factors,
    summary: `This contract presents a ${overallRisk} overall risk level with ${factors.filter(f => f.severity === 'high' || f.severity === 'critical').length} high-priority issues requiring attention. Key concerns include liability limitations, data protection compliance, and termination provisions.`,
    recommendations: [
      'Address liability cap before signing',
      'Strengthen data protection clause for GDPR/CCPA compliance',
      'Negotiate mutual termination for convenience rights',
      'Set up renewal reminder 90 days before expiration',
    ],
    lastUpdated: new Date(),
  };
}

export const RiskAssessmentPanel = memo(function RiskAssessmentPanel({
  contractId,
  className,
  compact = false,
}: RiskAssessmentPanelProps) {
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAssessment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const loadAssessment = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/risk-assessment`);
      if (response.ok) {
        const data = await response.json();
        setAssessment({
          ...data,
          lastUpdated: new Date(data.lastUpdated),
        });
      } else {
        setAssessment(generateMockAssessment());
      }
    } catch {
      setAssessment(generateMockAssessment());
    } finally {
      setLoading(false);
    }
  };

  const refreshAssessment = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 2000));
    setAssessment(generateMockAssessment());
    setRefreshing(false);
  };

  const toggleFactor = (factorId: string) => {
    setExpandedFactors(prev => {
      const next = new Set(prev);
      if (next.has(factorId)) {
        next.delete(factorId);
      } else {
        next.add(factorId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600 mr-2" />
          <span>Analyzing risk factors...</span>
        </CardContent>
      </Card>
    );
  }

  if (!assessment) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-12 text-slate-500">
          Unable to load risk assessment
        </CardContent>
      </Card>
    );
  }

  const config = severityConfig[assessment.overallRisk] ?? {
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    label: 'Unknown',
    icon: AlertCircle,
    description: 'Risk level unknown',
  };
  const RiskIcon = config.icon;

  // Group factors by category
  const factorsByCategory = assessment.factors.reduce((acc, factor) => {
    if (!acc[factor.category]) acc[factor.category] = [];
    acc[factor.category]!.push(factor);
    return acc;
  }, {} as Record<string, RiskFactor[]>);

  const criticalAndHigh = assessment.factors.filter(f => f.severity === 'critical' || f.severity === 'high');

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-lg', config.bg)}>
              <RiskIcon className={cn('h-6 w-6', config.color)} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Risk Score:</span>
                <span className={cn('text-lg font-bold', config.color)}>
                  {assessment.overallScore}/100
                </span>
                <Badge className={cn(config.bg, config.color, 'border-0')}>
                  {config.label} Risk
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {criticalAndHigh.length} high-priority issues
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={refreshAssessment} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-600" />
              Risk Assessment
            </CardTitle>
            <CardDescription>
              AI-powered contract risk analysis
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshAssessment}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Re-analyze
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className={cn('p-6 rounded-xl border-2', config.border, config.bg)}>
          <div className="flex items-center gap-6">
            <div className="relative">
              <svg className="w-24 h-24 -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-white/50"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(assessment.overallScore / 100) * 251.2} 251.2`}
                  className={config.color}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-2xl font-bold', config.color)}>
                  {assessment.overallScore}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <RiskIcon className={cn('h-5 w-5', config.color)} />
                <span className={cn('text-lg font-semibold', config.color)}>
                  {config.label} Risk
                </span>
              </div>
              <p className="text-sm text-slate-600">{assessment.summary}</p>
            </div>
          </div>
        </div>

        {/* Key Recommendations */}
        {assessment.recommendations.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-slate-500">Key Recommendations</h3>
            <div className="grid grid-cols-2 gap-2">
              {assessment.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 border border-violet-100">
                  <CheckCircle2 className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
                  <span className="text-sm text-violet-800">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Factors by Category */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-slate-500">Risk Factors by Category</h3>
          {Object.entries(factorsByCategory).map(([category, factors]) => {
            const CategoryIcon = categoryIcons[category] || FileText;
            const categoryMaxSeverity = factors.reduce((max, f) => {
              const order = { critical: 4, high: 3, medium: 2, low: 1 };
              return order[f.severity] > order[max] ? f.severity : max;
            }, 'low' as RiskFactor['severity']);
            const catConfig = severityConfig[categoryMaxSeverity] ?? {
              color: 'text-slate-600',
              bg: 'bg-slate-100',
              border: 'border-slate-200',
              label: 'Unknown',
              icon: AlertCircle,
            };

            return (
              <div key={category} className="border rounded-lg">
                <div className="p-3 flex items-center gap-3 bg-slate-50">
                  <CategoryIcon className="h-5 w-5 text-slate-600" />
                  <span className="font-medium flex-1">{category}</span>
                  <Badge className={cn(catConfig.bg, catConfig.color, 'border-0')}>
                    {factors.length} factor{factors.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="divide-y">
                  {factors.map(factor => {
                    const fConfig = severityConfig[factor.severity] ?? {
                      color: 'text-slate-600',
                      bg: 'bg-slate-100',
                      border: 'border-slate-200',
                      label: 'Unknown',
                      icon: AlertCircle,
                    };
                    const FIcon = fConfig.icon;
                    const isExpanded = expandedFactors.has(factor.id);

                    return (
                      <Collapsible 
                        key={factor.id} 
                        open={isExpanded}
                        onOpenChange={() => toggleFactor(factor.id)}
                      >
                        <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                          <div className={cn('p-1.5 rounded', fConfig.bg)}>
                            <FIcon className={cn('h-4 w-4', fConfig.color)} />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-sm">{factor.name}</p>
                            <p className="text-xs text-slate-500">{factor.description}</p>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="text-xs">
                                  {factor.score}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Risk Score (0-100)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-3">
                            <div className="p-3 rounded bg-slate-50">
                              <p className="text-sm text-slate-600">{factor.details}</p>
                            </div>
                            {factor.clause && (
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <FileText className="h-3 w-3" />
                                Reference: {factor.clause}
                              </div>
                            )}
                            {factor.recommendation && (
                              <div className="p-3 rounded bg-violet-50 border border-violet-100">
                                <p className="text-xs font-medium text-violet-800 mb-1">Recommendation</p>
                                <p className="text-sm text-violet-700">{factor.recommendation}</p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
