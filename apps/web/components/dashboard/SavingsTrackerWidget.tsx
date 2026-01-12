'use client';

/**
 * Savings Tracker Widget
 * 
 * Dashboard widget to track negotiated savings over time.
 * Shows savings by category, trends, and opportunities.
 */

import React, { useState, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  ChevronDown,
  PiggyBank,
  BarChart3,
  ArrowUpRight,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

// ============ Types ============

export interface SavingsCategory {
  id: string;
  name: string;
  amount: number;
  target: number;
  previousAmount: number;
  color: string;
}

export interface SavingsOpportunity {
  id: string;
  title: string;
  potentialSavings: number;
  confidence: 'high' | 'medium' | 'low';
  category: string;
  contractId?: string;
  contractName?: string;
  status: 'identified' | 'in-progress' | 'realized' | 'dismissed';
}

export interface SavingsData {
  totalSavings: number;
  savingsTarget: number;
  previousPeriodSavings: number;
  categories: SavingsCategory[];
  opportunities: SavingsOpportunity[];
  monthlyTrend: { month: string; amount: number }[];
}

interface SavingsTrackerWidgetProps {
  data: SavingsData;
  onViewDetails?: () => void;
  onOpportunityClick?: (opportunity: SavingsOpportunity) => void;
  period?: 'month' | 'quarter' | 'year';
  onPeriodChange?: (period: 'month' | 'quarter' | 'year') => void;
  className?: string;
}

// ============ Helpers ============

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
};

const getConfidenceColor = (confidence: SavingsOpportunity['confidence']) => {
  switch (confidence) {
    case 'high': return 'text-green-500 bg-green-500/10';
    case 'medium': return 'text-yellow-500 bg-yellow-500/10';
    case 'low': return 'text-orange-500 bg-orange-500/10';
  }
};

const getStatusIcon = (status: SavingsOpportunity['status']) => {
  switch (status) {
    case 'realized': return CheckCircle;
    case 'in-progress': return Clock;
    case 'dismissed': return AlertCircle;
    default: return Sparkles;
  }
};

// ============ Sub-components ============

const SavingsOverview = memo(function SavingsOverview({
  total,
  target,
  previous,
  period,
}: {
  total: number;
  target: number;
  previous: number;
  period: string;
}) {
  const progress = Math.min((total / target) * 100, 100);
  const change = previous > 0 ? ((total - previous) / previous) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
          <p className="text-xs text-muted-foreground">
            of {formatCurrency(target)} target
          </p>
        </div>
        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>{Math.abs(change).toFixed(1)}%</span>
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress to target</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </div>
  );
});

const CategoryBreakdown = memo(function CategoryBreakdown({
  categories,
}: {
  categories: SavingsCategory[];
}) {
  const maxAmount = Math.max(...categories.map(c => c.amount));

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">By Category</h4>
      <div className="space-y-2">
        {categories.slice(0, 4).map((category) => (
          <div key={category.id} className="flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: category.color }}
            />
            <span className="text-xs flex-1 truncate">{category.name}</span>
            <span className="text-xs font-medium">{formatCurrency(category.amount)}</span>
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full"
                style={{ 
                  width: `${(category.amount / maxAmount) * 100}%`,
                  backgroundColor: category.color
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

const OpportunityItem = memo(function OpportunityItem({
  opportunity,
  onClick,
}: {
  opportunity: SavingsOpportunity;
  onClick?: () => void;
}) {
  const StatusIcon = getStatusIcon(opportunity.status);
  
  return (
    <button
      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
      onClick={onClick}
    >
      <div className={`p-1.5 rounded ${getConfidenceColor(opportunity.confidence)}`}>
        <StatusIcon className="h-3 w-3" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{opportunity.title}</p>
        {opportunity.contractName && (
          <p className="text-[10px] text-muted-foreground truncate">
            {opportunity.contractName}
          </p>
        )}
      </div>
      <span className="text-xs font-medium text-green-500">
        +{formatCurrency(opportunity.potentialSavings)}
      </span>
    </button>
  );
});

const MiniTrendChart = memo(function MiniTrendChart({
  data,
}: {
  data: { month: string; amount: number }[];
}) {
  const maxAmount = Math.max(...data.map(d => d.amount));
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - (d.amount / maxAmount) * 100,
  }));
  
  const pathD = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, '');

  return (
    <div className="h-12 w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L 100 100 L 0 100 Z`}
          fill="url(#savingsGradient)"
        />
        <path
          d={pathD}
          fill="none"
          stroke="rgb(34, 197, 94)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
});

// ============ Main Component ============

export function SavingsTrackerWidget({
  data,
  onViewDetails,
  onOpportunityClick,
  period = 'quarter',
  onPeriodChange,
  className = '',
}: SavingsTrackerWidgetProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'opportunities'>('overview');

  const periodLabels = {
    month: 'This Month',
    quarter: 'This Quarter',
    year: 'This Year',
  };

  const pendingOpportunities = data.opportunities.filter(
    o => o.status === 'identified' || o.status === 'in-progress'
  );
  const totalPotential = pendingOpportunities.reduce(
    (sum, o) => sum + o.potentialSavings, 0
  );

  return (
    <TooltipProvider>
      <Card className={`overflow-hidden ${className}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-green-500" />
              Savings Tracker
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    {periodLabels[period]}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onPeriodChange?.('month')}>
                    This Month
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPeriodChange?.('quarter')}>
                    This Quarter
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPeriodChange?.('year')}>
                    This Year
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {onViewDetails && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onViewDetails}>
                      <BarChart3 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View detailed analytics</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          
          {/* Tab buttons */}
          <div className="flex gap-1 mt-2">
            <Button
              variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </Button>
            <Button
              variant={activeTab === 'opportunities' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setActiveTab('opportunities')}
            >
              Opportunities
              {pendingOpportunities.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {pendingOpportunities.length}
                </Badge>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {activeTab === 'overview' ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <SavingsOverview
                total={data.totalSavings}
                target={data.savingsTarget}
                previous={data.previousPeriodSavings}
                period={periodLabels[period]}
              />
              
              <MiniTrendChart data={data.monthlyTrend} />
              
              <CategoryBreakdown categories={data.categories} />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Potential savings identified
                </p>
                <Badge variant="outline" className="text-green-500 border-green-500/30">
                  {formatCurrency(totalPotential)}
                </Badge>
              </div>
              
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {pendingOpportunities.length > 0 ? (
                  pendingOpportunities.slice(0, 5).map((opp) => (
                    <OpportunityItem
                      key={opp.id}
                      opportunity={opp}
                      onClick={() => onOpportunityClick?.(opp)}
                    />
                  ))
                ) : (
                  <div className="text-center py-4">
                    <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      No pending opportunities
                    </p>
                  </div>
                )}
              </div>
              
              {pendingOpportunities.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={onViewDetails}
                >
                  View all {pendingOpportunities.length} opportunities
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// ============ Demo Data Generator ============

export function generateDemoSavingsData(): SavingsData {
  return {
    totalSavings: 847500,
    savingsTarget: 1000000,
    previousPeriodSavings: 720000,
    categories: [
      { id: '1', name: 'Rate Negotiations', amount: 320000, target: 400000, previousAmount: 280000, color: '#22c55e' },
      { id: '2', name: 'Volume Discounts', amount: 185000, target: 200000, previousAmount: 150000, color: '#3b82f6' },
      { id: '3', name: 'Term Extensions', amount: 142500, target: 150000, previousAmount: 120000, color: '#8b5cf6' },
      { id: '4', name: 'Consolidated Vendors', amount: 200000, target: 250000, previousAmount: 170000, color: '#f59e0b' },
    ],
    opportunities: [
      { id: '1', title: 'Renegotiate AWS commitment', potentialSavings: 45000, confidence: 'high', category: 'Rate', contractName: 'AWS Enterprise', status: 'identified' },
      { id: '2', title: 'Bundle Microsoft licenses', potentialSavings: 32000, confidence: 'high', category: 'Volume', contractName: 'Microsoft EA', status: 'in-progress' },
      { id: '3', title: 'Early renewal discount', potentialSavings: 18500, confidence: 'medium', category: 'Term', contractName: 'Salesforce', status: 'identified' },
      { id: '4', title: 'Consolidate SaaS tools', potentialSavings: 25000, confidence: 'medium', category: 'Vendor', status: 'identified' },
      { id: '5', title: 'Oracle optimization', potentialSavings: 55000, confidence: 'low', category: 'Rate', contractName: 'Oracle DB', status: 'identified' },
    ],
    monthlyTrend: [
      { month: 'Jan', amount: 85000 },
      { month: 'Feb', amount: 92000 },
      { month: 'Mar', amount: 78000 },
      { month: 'Apr', amount: 115000 },
      { month: 'May', amount: 125000 },
      { month: 'Jun', amount: 142500 },
    ],
  };
}

export default memo(SavingsTrackerWidget);
