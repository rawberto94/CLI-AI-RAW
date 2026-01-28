'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Brain,
  Target,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Download,
  ChevronRight,
  Loader2,
  Sparkles,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Zap,
  Shield,
  Eye,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type PredictionType = 'renewal' | 'risk' | 'cost' | 'value' | 'churn' | 'compliance';
type TimeHorizon = 'short' | 'medium' | 'long'; // 30, 90, 365 days
type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high';

interface Prediction {
  id: string;
  type: PredictionType;
  contractId: string;
  contractName: string;
  value: number;
  confidence: number;
  horizon: TimeHorizon;
  factors: PredictionFactor[];
  trend: 'improving' | 'stable' | 'declining';
  generatedAt: Date;
  expiresAt: Date;
}

interface PredictionFactor {
  name: string;
  impact: number; // -1 to 1
  description: string;
  category: 'positive' | 'negative' | 'neutral';
}

interface ContractPrediction {
  contractId: string;
  contractName: string;
  supplier: string;
  value: number;
  renewalProbability: number;
  riskScore: number;
  churnRisk: number;
  valueOptimization: number;
  recommendations: string[];
}

interface PortfolioPrediction {
  totalContracts: number;
  totalValue: number;
  avgRenewalProbability: number;
  avgRiskScore: number;
  predictedSavings: number;
  atRiskValue: number;
  highValueOpportunities: number;
  trends: {
    period: string;
    renewals: number;
    churn: number;
    value: number;
  }[];
}

interface PredictiveAnalyticsDashboardProps {
  tenantId: string;
  className?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const PREDICTION_TYPE_CONFIG: Record<PredictionType, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
  description: string;
}> = {
  renewal: { 
    icon: RefreshCw, 
    color: 'text-green-600', 
    bgColor: 'bg-green-100', 
    label: 'Renewal',
    description: 'Probability of contract renewal'
  },
  risk: { 
    icon: AlertTriangle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100', 
    label: 'Risk',
    description: 'Overall contract risk assessment'
  },
  cost: { 
    icon: DollarSign, 
    color: 'text-violet-600', 
    bgColor: 'bg-violet-100', 
    label: 'Cost',
    description: 'Projected cost trajectory'
  },
  value: { 
    icon: TrendingUp, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-100', 
    label: 'Value',
    description: 'Value optimization potential'
  },
  churn: { 
    icon: TrendingDown, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-100', 
    label: 'Churn',
    description: 'Risk of contract termination'
  },
  compliance: { 
    icon: Shield, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-100', 
    label: 'Compliance',
    description: 'Regulatory compliance forecast'
  },
};

const HORIZON_CONFIG: Record<TimeHorizon, { label: string; days: number }> = {
  short: { label: '30 Days', days: 30 },
  medium: { label: '90 Days', days: 90 },
  long: { label: '12 Months', days: 365 },
};

// ============================================================================
// Demo Data Generators
// ============================================================================

function generateDemoContractPredictions(count: number): ContractPrediction[] {
  const suppliers = ['Acme Corp', 'TechFlow Inc', 'Global Services', 'DataPro', 'CloudFirst'];
  const predictions: ContractPrediction[] = [];

  for (let i = 0; i < count; i++) {
    const renewalProb = 0.4 + Math.random() * 0.55;
    const riskScore = Math.random() * 0.6;
    const churnRisk = 1 - renewalProb + Math.random() * 0.1;
    
    predictions.push({
      contractId: `contract-${i + 1}`,
      contractName: `Contract ${i + 1}`,
      supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
      value: Math.floor(50000 + Math.random() * 500000),
      renewalProbability: Math.min(renewalProb, 0.98),
      riskScore: Math.min(riskScore, 0.95),
      churnRisk: Math.min(churnRisk, 0.6),
      valueOptimization: 0.05 + Math.random() * 0.2,
      recommendations: [
        'Consider early renewal negotiations',
        'Review service levels for optimization',
        'Benchmark pricing against market rates',
      ].slice(0, Math.floor(Math.random() * 3) + 1),
    });
  }

  return predictions.sort((a, b) => b.value - a.value);
}

function generateDemoPortfolioPrediction(): PortfolioPrediction {
  return {
    totalContracts: 156,
    totalValue: 12500000,
    avgRenewalProbability: 0.78,
    avgRiskScore: 0.32,
    predictedSavings: 845000,
    atRiskValue: 1250000,
    highValueOpportunities: 12,
    trends: [
      { period: 'Q1', renewals: 24, churn: 3, value: 2800000 },
      { period: 'Q2', renewals: 31, churn: 5, value: 3200000 },
      { period: 'Q3', renewals: 28, churn: 4, value: 3100000 },
      { period: 'Q4', renewals: 35, churn: 6, value: 3400000 },
    ],
  };
}

function generateDemoPredictions(contracts: ContractPrediction[]): Prediction[] {
  const types: PredictionType[] = ['renewal', 'risk', 'cost', 'value'];
  const predictions: Prediction[] = [];

  contracts.forEach(contract => {
    types.forEach(type => {
      let value: number;
      switch (type) {
        case 'renewal':
          value = contract.renewalProbability;
          break;
        case 'risk':
          value = contract.riskScore;
          break;
        case 'cost':
          value = 0.02 + Math.random() * 0.08; // 2-10% cost change
          break;
        case 'value':
          value = contract.valueOptimization;
          break;
        default:
          value = Math.random();
      }

      predictions.push({
        id: `prediction-${contract.contractId}-${type}`,
        type,
        contractId: contract.contractId,
        contractName: contract.contractName,
        value,
        confidence: 0.7 + Math.random() * 0.25,
        horizon: ['short', 'medium', 'long'][Math.floor(Math.random() * 3)] as TimeHorizon,
        factors: [
          { name: 'Historical Performance', impact: 0.3 + Math.random() * 0.4, description: 'Based on past contract performance', category: 'positive' },
          { name: 'Market Conditions', impact: -0.1 + Math.random() * 0.3, description: 'Current market dynamics', category: Math.random() > 0.5 ? 'positive' : 'negative' },
          { name: 'Relationship Score', impact: 0.2 + Math.random() * 0.3, description: 'Vendor relationship quality', category: 'positive' },
        ],
        trend: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)] as Prediction['trend'],
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });
  });

  return predictions;
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  color = 'blue',
  trend,
  format = 'number',
}: { 
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  trend?: { value: number; positive: boolean };
  format?: 'number' | 'percent' | 'currency';
}) {
  const colorClasses = {
    blue: 'text-violet-600 bg-violet-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
    purple: 'text-purple-600 bg-purple-50',
  };

  const formatValue = () => {
    switch (format) {
      case 'percent':
        return `${(value * 100).toFixed(1)}%`;
      case 'currency':
        return `$${(value / 1000000).toFixed(2)}M`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{formatValue()}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            {trend && (
              <div className={cn('flex items-center gap-1 mt-1 text-xs', trend.positive ? 'text-green-600' : 'text-red-600')}>
                {trend.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <span>{trend.value}% vs last period</span>
              </div>
            )}
          </div>
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PredictionGauge({ 
  value, 
  label, 
  type,
  size = 100,
}: { 
  value: number; 
  label: string;
  type: 'positive' | 'negative';
  size?: number;
}) {
  const percentage = value * 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (type === 'positive') {
      if (percentage >= 70) return '#22c55e';
      if (percentage >= 50) return '#f59e0b';
      return '#ef4444';
    } else {
      if (percentage <= 30) return '#22c55e';
      if (percentage <= 50) return '#f59e0b';
      return '#ef4444';
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold" style={{ color: getColor() }}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground mt-2">{label}</span>
    </div>
  );
}

function ContractPredictionRow({ 
  prediction, 
  onView 
}: { 
  prediction: ContractPrediction;
  onView: () => void;
}) {
  return (
    <div 
      className="flex items-center gap-4 p-4 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer border"
      onClick={onView}
    >
      {/* Contract Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm">{prediction.contractName}</h4>
          <Badge variant="outline" className="text-xs">{prediction.supplier}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          ${prediction.value.toLocaleString()} annual value
        </p>
      </div>

      {/* Predictions */}
      <div className="flex items-center gap-6">
        {/* Renewal */}
        <div className="text-center">
          <div className={cn(
            'text-sm font-bold',
            prediction.renewalProbability >= 0.7 ? 'text-green-600' :
            prediction.renewalProbability >= 0.5 ? 'text-amber-600' : 'text-red-600'
          )}>
            {(prediction.renewalProbability * 100).toFixed(0)}%
          </div>
          <p className="text-xs text-muted-foreground">Renewal</p>
        </div>

        {/* Risk */}
        <div className="text-center">
          <div className={cn(
            'text-sm font-bold',
            prediction.riskScore <= 0.3 ? 'text-green-600' :
            prediction.riskScore <= 0.5 ? 'text-amber-600' : 'text-red-600'
          )}>
            {(prediction.riskScore * 100).toFixed(0)}%
          </div>
          <p className="text-xs text-muted-foreground">Risk</p>
        </div>

        {/* Value Opt */}
        <div className="text-center">
          <div className="text-sm font-bold text-purple-600">
            +{(prediction.valueOptimization * 100).toFixed(0)}%
          </div>
          <p className="text-xs text-muted-foreground">Savings</p>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </div>
  );
}

function PredictionFactorBar({ factor }: { factor: PredictionFactor }) {
  const isPositive = factor.impact > 0;
  const width = Math.abs(factor.impact) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-36 truncate">{factor.name}</span>
      <div className="flex-1 flex items-center gap-1">
        <div className="w-1/2 flex justify-end">
          {!isPositive && (
            <div 
              className="h-2 bg-red-400 rounded-r"
              style={{ width: `${width}%` }}
            />
          )}
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="w-1/2">
          {isPositive && (
            <div 
              className="h-2 bg-green-400 rounded-l"
              style={{ width: `${width}%` }}
            />
          )}
        </div>
      </div>
      <span className={cn(
        'text-xs font-medium w-12 text-right',
        isPositive ? 'text-green-600' : 'text-red-600'
      )}>
        {isPositive ? '+' : ''}{(factor.impact * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function InsightCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  color,
  action,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  color: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', color)}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-lg font-bold mt-0.5">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            {action && (
              <Button variant="link" size="sm" className="px-0 h-auto mt-2" onClick={action.onClick}>
                {action.label} <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PredictiveAnalyticsDashboard({ tenantId, className }: PredictiveAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [horizon, setHorizon] = useState<TimeHorizon>('medium');
  const [contractPredictions, setContractPredictions] = useState<ContractPrediction[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioPrediction | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractPrediction | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const contracts = generateDemoContractPredictions(20);
      setContractPredictions(contracts);
      setPortfolio(generateDemoPortfolioPrediction());
      setPredictions(generateDemoPredictions(contracts));
      setLoading(false);
    };
    loadData();
  }, [tenantId]);

  const atRiskContracts = contractPredictions.filter(c => c.riskScore > 0.5);
  const highRenewalContracts = contractPredictions.filter(c => c.renewalProbability > 0.8);
  const highValueOpportunities = contractPredictions.filter(c => c.valueOptimization > 0.15);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center min-h-[400px]', className)}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Generating predictions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Predictive Analytics
          </h1>
          <p className="text-muted-foreground text-sm">AI-powered contract predictions and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={horizon} onValueChange={(v) => setHorizon(v as TimeHorizon)}>
            <SelectTrigger className="w-[140px]">
              <Clock className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(HORIZON_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Portfolio Stats */}
      {portfolio && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
          <StatCard
            title="Total Contracts"
            value={portfolio.totalContracts}
            icon={Target}
            color="blue"
          />
          <StatCard
            title="Portfolio Value"
            value={portfolio.totalValue}
            format="currency"
            icon={DollarSign}
            color="green"
          />
          <StatCard
            title="Avg Renewal Prob"
            value={portfolio.avgRenewalProbability}
            format="percent"
            icon={RefreshCw}
            color="green"
            trend={{ value: 5, positive: true }}
          />
          <StatCard
            title="Avg Risk Score"
            value={portfolio.avgRiskScore}
            format="percent"
            icon={AlertTriangle}
            color="amber"
            trend={{ value: 8, positive: false }}
          />
          <StatCard
            title="Predicted Savings"
            value={portfolio.predictedSavings}
            format="currency"
            icon={TrendingUp}
            color="purple"
          />
          <StatCard
            title="At-Risk Value"
            value={portfolio.atRiskValue}
            format="currency"
            icon={Shield}
            color="red"
          />
        </div>
      )}

      {/* AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InsightCard
          title="High Renewal Probability"
          value={`${highRenewalContracts.length} contracts`}
          description="Contracts with >80% renewal likelihood"
          icon={CheckCircle2}
          color="bg-green-500"
          action={{ label: 'View Contracts', onClick: () => setActiveTab('renewals') }}
        />
        <InsightCard
          title="At-Risk Contracts"
          value={`${atRiskContracts.length} contracts`}
          description="Contracts with elevated risk scores"
          icon={AlertTriangle}
          color="bg-red-500"
          action={{ label: 'Review Risks', onClick: () => setActiveTab('risks') }}
        />
        <InsightCard
          title="Value Opportunities"
          value={`${highValueOpportunities.length} contracts`}
          description="Contracts with >15% optimization potential"
          icon={Lightbulb}
          color="bg-purple-500"
          action={{ label: 'Explore Savings', onClick: () => setActiveTab('opportunities') }}
        />
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Contracts</span>
          </TabsTrigger>
          <TabsTrigger value="renewals" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Renewals</span>
          </TabsTrigger>
          <TabsTrigger value="risks" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Risks</span>
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-2">
            <Lightbulb className="w-4 h-4" />
            <span className="hidden sm:inline">Opportunities</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Portfolio Gauges */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Portfolio Health</CardTitle>
                <CardDescription>Key prediction metrics</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-around py-4">
                <PredictionGauge 
                  value={portfolio?.avgRenewalProbability || 0} 
                  label="Renewal Rate" 
                  type="positive"
                />
                <PredictionGauge 
                  value={portfolio?.avgRiskScore || 0} 
                  label="Risk Score" 
                  type="negative"
                />
              </CardContent>
            </Card>

            {/* Top Predictions */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Contract Predictions</CardTitle>
                <CardDescription>Highest value contracts with predictions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {contractPredictions.slice(0, 5).map(contract => (
                    <ContractPredictionRow
                      key={contract.contractId}
                      prediction={contract}
                      onView={() => setSelectedContract(contract)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Prediction Factors Example */}
          {predictions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Prediction Factors
                </CardTitle>
                <CardDescription>Key factors influencing renewal predictions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {predictions[0]?.factors.map((factor, i) => (
                    <PredictionFactorBar key={i} factor={factor} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">All Contract Predictions</CardTitle>
              <CardDescription>Comprehensive predictions for all contracts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {contractPredictions.map(contract => (
                  <ContractPredictionRow
                    key={contract.contractId}
                    prediction={contract}
                    onView={() => setSelectedContract(contract)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Renewals Tab */}
        <TabsContent value="renewals" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-green-600 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                High Renewal Probability ({highRenewalContracts.length})
              </CardTitle>
              <CardDescription>Contracts likely to renew (&gt;80% probability)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {highRenewalContracts.map(contract => (
                  <ContractPredictionRow
                    key={contract.contractId}
                    prediction={contract}
                    onView={() => setSelectedContract(contract)}
                  />
                ))}
                {highRenewalContracts.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No high-probability renewals found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                At-Risk Contracts ({atRiskContracts.length})
              </CardTitle>
              <CardDescription>Contracts with elevated risk scores (&gt;50%)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {atRiskContracts.map(contract => (
                  <ContractPredictionRow
                    key={contract.contractId}
                    prediction={contract}
                    onView={() => setSelectedContract(contract)}
                  />
                ))}
                {atRiskContracts.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="font-medium">No High-Risk Contracts</p>
                    <p className="text-sm text-muted-foreground">All contracts are within acceptable risk levels</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-purple-600 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Value Optimization Opportunities ({highValueOpportunities.length})
              </CardTitle>
              <CardDescription>Contracts with &gt;15% savings potential</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {highValueOpportunities.map(contract => (
                  <ContractPredictionRow
                    key={contract.contractId}
                    prediction={contract}
                    onView={() => setSelectedContract(contract)}
                  />
                ))}
                {highValueOpportunities.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No significant optimization opportunities found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Contract Detail Modal would go here */}
    </div>
  );
}

export default PredictiveAnalyticsDashboard;
