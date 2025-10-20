'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Zap
} from 'lucide-react';

export interface CostSavingsOpportunity {
  id: string;
  category: 'rate_optimization' | 'payment_terms' | 'volume_discount' | 'supplier_consolidation' | 'contract_optimization';
  title: string;
  description: string;
  potentialSavings: {
    amount: number;
    currency: string;
    percentage: number;
    timeframe: 'monthly' | 'quarterly' | 'annual';
  };
  confidence: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  priority: number;
  actionItems: string[];
  implementationTimeline: string;
  risks: string[];
}

export interface CostSavingsAnalysis {
  totalPotentialSavings: {
    amount: number;
    currency: string;
    percentage: number;
  };
  opportunities: CostSavingsOpportunity[];
  quickWins: CostSavingsOpportunity[];
  strategicInitiatives: CostSavingsOpportunity[];
  summary: {
    opportunityCount: number;
    averageSavingsPerOpportunity: number;
    highConfidenceOpportunities: number;
  };
}

interface CostSavingsCardProps {
  analysis: CostSavingsAnalysis;
  contractId?: string;
  onImplement?: (opportunityId: string) => void;
}

const categoryLabels: Record<string, string> = {
  rate_optimization: 'Rate Optimization',
  payment_terms: 'Payment Terms',
  volume_discount: 'Volume Discount',
  supplier_consolidation: 'Supplier Consolidation',
  contract_optimization: 'Contract Optimization'
};

const categoryIcons: Record<string, React.ReactNode> = {
  rate_optimization: <TrendingUp className="h-4 w-4" />,
  payment_terms: <Clock className="h-4 w-4" />,
  volume_discount: <DollarSign className="h-4 w-4" />,
  supplier_consolidation: <CheckCircle2 className="h-4 w-4" />,
  contract_optimization: <Zap className="h-4 w-4" />
};

const confidenceColors: Record<string, string> = {
  low: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  medium: 'bg-blue-100 text-blue-800 border-blue-300',
  high: 'bg-green-100 text-green-800 border-green-300'
};

const effortColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800'
};

export function CostSavingsCard({ analysis, contractId, onImplement }: CostSavingsCardProps) {
  const [expandedOpportunity, setExpandedOpportunity] = React.useState<string | null>(null);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-green-600" />
                Cost Savings Opportunities
              </CardTitle>
              <CardDescription className="mt-2">
                {analysis.summary.opportunityCount} opportunities identified
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(analysis.totalPotentialSavings.amount, analysis.totalPotentialSavings.currency)}
              </div>
              <div className="text-sm text-gray-600">
                {analysis.totalPotentialSavings.percentage.toFixed(1)}% potential savings
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">{analysis.quickWins.length}</div>
              <div className="text-sm text-gray-600">Quick Wins</div>
              <div className="text-xs text-gray-500 mt-1">High confidence, low effort</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-purple-600">{analysis.strategicInitiatives.length}</div>
              <div className="text-sm text-gray-600">Strategic Initiatives</div>
              <div className="text-xs text-gray-500 mt-1">High value, higher effort</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-green-600">{analysis.summary.highConfidenceOpportunities}</div>
              <div className="text-sm text-gray-600">High Confidence</div>
              <div className="text-xs text-gray-500 mt-1">Ready to implement</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Wins */}
      {analysis.quickWins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Quick Wins
            </CardTitle>
            <CardDescription>
              High confidence, low effort opportunities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.quickWins.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                isExpanded={expandedOpportunity === opportunity.id}
                onToggle={() => setExpandedOpportunity(
                  expandedOpportunity === opportunity.id ? null : opportunity.id
                )}
                onImplement={onImplement}
                formatCurrency={formatCurrency}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Strategic Initiatives */}
      {analysis.strategicInitiatives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Strategic Initiatives
            </CardTitle>
            <CardDescription>
              High-value opportunities requiring more effort
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.strategicInitiatives.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                isExpanded={expandedOpportunity === opportunity.id}
                onToggle={() => setExpandedOpportunity(
                  expandedOpportunity === opportunity.id ? null : opportunity.id
                )}
                onImplement={onImplement}
                formatCurrency={formatCurrency}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* All Opportunities */}
      {analysis.opportunities.length > analysis.quickWins.length + analysis.strategicInitiatives.length && (
        <Card>
          <CardHeader>
            <CardTitle>All Opportunities</CardTitle>
            <CardDescription>
              Complete list of cost savings opportunities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.opportunities
              .filter(opp => 
                !analysis.quickWins.includes(opp) && 
                !analysis.strategicInitiatives.includes(opp)
              )
              .map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  isExpanded={expandedOpportunity === opportunity.id}
                  onToggle={() => setExpandedOpportunity(
                    expandedOpportunity === opportunity.id ? null : opportunity.id
                  )}
                  onImplement={onImplement}
                  formatCurrency={formatCurrency}
                />
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface OpportunityCardProps {
  opportunity: CostSavingsOpportunity;
  isExpanded: boolean;
  onToggle: () => void;
  onImplement?: (opportunityId: string) => void;
  formatCurrency: (amount: number, currency: string) => string;
}

function OpportunityCard({ 
  opportunity, 
  isExpanded, 
  onToggle, 
  onImplement,
  formatCurrency 
}: OpportunityCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {categoryIcons[opportunity.category]}
            <h4 className="font-semibold">{opportunity.title}</h4>
            <Badge variant="outline" className={confidenceColors[opportunity.confidence]}>
              {opportunity.confidence} confidence
            </Badge>
            <Badge variant="outline" className={effortColors[opportunity.effort]}>
              {opportunity.effort} effort
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mb-3">{opportunity.description}</p>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-green-600 font-semibold">
              <DollarSign className="h-4 w-4" />
              {formatCurrency(opportunity.potentialSavings.amount, opportunity.potentialSavings.currency)}
              <span className="text-gray-500">
                ({opportunity.potentialSavings.percentage}% {opportunity.potentialSavings.timeframe})
              </span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <Clock className="h-4 w-4" />
              {opportunity.implementationTimeline}
            </div>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="ml-4"
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
          <ArrowRight className={`h-4 w-4 ml-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {/* Action Items */}
          <div>
            <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              Action Items
            </h5>
            <ul className="space-y-1">
              {opportunity.actionItems.map((item, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Risks */}
          {opportunity.risks.length > 0 && (
            <div>
              <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Risks & Considerations
              </h5>
              <ul className="space-y-1">
                {opportunity.risks.map((risk, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Implementation Button */}
          {onImplement && (
            <div className="pt-2">
              <Button
                onClick={() => onImplement(opportunity.id)}
                className="w-full"
                variant="default"
              >
                Track Implementation
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
