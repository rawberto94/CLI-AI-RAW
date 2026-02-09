'use client';

/**
 * Opportunities Dashboard
 * Displays discovered cost-saving and optimization opportunities
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  Users,
  Zap,
  Target,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress as _Progress } from '@/components/ui/progress';
import { Tabs, TabsContent as _TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Opportunity {
  id: string;
  type: 'cost_savings' | 'consolidation' | 'renegotiation' | 'optimization' | 'risk_reduction';
  title: string;
  description: string;
  potentialValue: number;
  confidence: number;
  effort: 'low' | 'medium' | 'high';
  timeframe: string;
  relatedContracts: string[];
  actionPlan: Array<{
    step: number;
    action: string;
    owner: string;
    automated: boolean;
  }>;
  status: 'new' | 'reviewing' | 'in-progress' | 'completed' | 'dismissed';
}

interface OpportunitiesProps {
  opportunities: Opportunity[];
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

export function OpportunitiesDashboard({ opportunities, onAccept, onDismiss }: OpportunitiesProps) {
  const [filter, setFilter] = useState<string>('all');

  const filteredOpportunities = filter === 'all' 
    ? opportunities 
    : opportunities.filter(o => o.type === filter);

  const totalValue = opportunities.reduce((sum, o) => sum + o.potentialValue, 0);
  const highValueCount = opportunities.filter(o => o.potentialValue > 100000).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cost_savings': return <DollarSign className="h-3.5 w-3.5" />;
      case 'consolidation': return <Users className="h-3.5 w-3.5" />;
      case 'renegotiation': return <TrendingUp className="h-3.5 w-3.5" />;
      case 'optimization': return <Zap className="h-3.5 w-3.5" />;
      case 'risk_reduction': return <Target className="h-3.5 w-3.5" />;
      default: return <DollarSign className="h-3.5 w-3.5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'cost_savings': return 'text-green-600 bg-green-100';
      case 'consolidation': return 'text-violet-600 bg-violet-100';
      case 'renegotiation': return 'text-violet-600 bg-violet-100';
      case 'optimization': return 'text-orange-600 bg-orange-100';
      case 'risk_reduction': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case 'low': return 'secondary';
      case 'medium': return 'default';
      case 'high': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2.5">
              <Zap className="h-4 w-4 text-yellow-600" />
              AI-Discovered Opportunities
            </CardTitle>
            <CardDescription className="mt-1.5">
              Automated cost savings and optimization recommendations
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              ${totalValue.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Total Potential Value</div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Total Opportunities</div>
            <div className="text-xl font-bold text-gray-900">{opportunities.length}</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">High Value ($100K+)</div>
            <div className="text-xl font-bold text-green-600">{highValueCount}</div>
          </div>
          <div className="p-3 bg-violet-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Quick Wins (Low Effort)</div>
            <div className="text-xl font-bold text-violet-600">
              {opportunities.filter(o => o.effort === 'low').length}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0">
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="grid w-full grid-cols-6 h-8 mb-4">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="cost_savings" className="text-xs">Savings</TabsTrigger>
            <TabsTrigger value="consolidation" className="text-xs">Consolidate</TabsTrigger>
            <TabsTrigger value="renegotiation" className="text-xs">Renegotiate</TabsTrigger>
            <TabsTrigger value="optimization" className="text-xs">Optimize</TabsTrigger>
            <TabsTrigger value="risk_reduction" className="text-xs">Risk</TabsTrigger>
          </TabsList>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {filteredOpportunities.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No opportunities found</p>
                <p className="text-xs text-gray-400 mt-1">
                  AI agents continuously scan for optimization opportunities
                </p>
              </div>
            ) : (
              filteredOpportunities.map((opp, index) => (
                <motion.div
                  key={opp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 border rounded-lg hover:border-violet-300 transition-all hover:shadow-sm bg-white"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(opp.type)}`}>
                      {getTypeIcon(opp.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">
                            {opp.title}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {opp.description}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-bold text-green-600">
                            ${opp.potentialValue.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">potential value</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mb-3 text-xs text-gray-600 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-3 w-3" />
                          <span>{(opp.confidence * 100).toFixed(0)}% confidence</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>{opp.timeframe}</span>
                        </div>
                        <Badge variant={getEffortBadge(opp.effort)} className="px-2 py-0">
                          {opp.effort} effort
                        </Badge>
                        <Badge variant="outline" className="px-2 py-0">
                          {opp.relatedContracts.length} contracts
                        </Badge>
                      </div>

                      {/* Action Plan Preview */}
                      <div className="p-2.5 bg-gray-50 rounded-lg mb-3">
                        <div className="text-xs font-medium text-gray-900 mb-2">
                          Action Plan ({opp.actionPlan.length} steps)
                        </div>
                        <div className="space-y-1.5">
                          {opp.actionPlan.slice(0, 2).map((step) => (
                            <div key={step.step} className="flex items-start gap-2 text-xs text-gray-700">
                              <CheckCircle2 className="h-3 w-3 mt-0.5 text-gray-400 flex-shrink-0" />
                              <span>{step.action}</span>
                              {step.automated && (
                                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] ml-auto">
                                  Auto
                                </Badge>
                              )}
                            </div>
                          ))}
                          {opp.actionPlan.length > 2 && (
                            <div className="text-xs text-gray-500 pl-5">
                              +{opp.actionPlan.length - 2} more steps
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {onAccept && (
                          <Button
                            size="sm"
                            onClick={() => onAccept(opp.id)}
                            className="h-7 text-xs flex-1"
                          >
                            Accept & Execute
                            <ArrowRight className="h-3 w-3 ml-1.5" />
                          </Button>
                        )}
                        {onDismiss && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDismiss(opp.id)}
                            className="h-7 text-xs"
                          >
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
