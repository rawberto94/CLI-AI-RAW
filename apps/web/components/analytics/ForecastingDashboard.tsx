'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Target,
  Zap,
  BarChart3,
  PieChart,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Filter,
  Download,
  Settings,
  Lightbulb,
  Clock,
  Building2,
  FileText,
  ChevronRight,
  Play,
  Pause,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

interface ForecastData {
  month: string;
  renewalValue: number;
  newContractValue: number;
  terminationValue: number;
  netChange: number;
  cumulative: number;
}

interface CostScenario {
  id: string;
  name: string;
  description: string;
  assumptions: string[];
  projectedSavings: number;
  projectedCost: number;
  riskLevel: 'low' | 'medium' | 'high';
  probability: number;
}

interface Opportunity {
  id: string;
  type: 'consolidation' | 'renegotiation' | 'termination' | 'optimization';
  title: string;
  description: string;
  contracts: string[];
  potentialSavings: number;
  effort: 'low' | 'medium' | 'high';
  timeframe: string;
  confidence: number;
}

interface SupplierSpend {
  supplier: string;
  currentSpend: number;
  projectedSpend: number;
  changePercent: number;
  contractCount: number;
  riskLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Mock Data
// ============================================================================

const mockForecastData: ForecastData[] = [
  { month: 'Apr 2024', renewalValue: 780000, newContractValue: 0, terminationValue: 35000, netChange: 745000, cumulative: 2545000 },
  { month: 'May 2024', renewalValue: 0, newContractValue: 150000, terminationValue: 0, netChange: 150000, cumulative: 2695000 },
  { month: 'Jun 2024', renewalValue: 1200000, newContractValue: 0, terminationValue: 0, netChange: 1200000, cumulative: 3895000 },
  { month: 'Jul 2024', renewalValue: 0, newContractValue: 200000, terminationValue: 120000, netChange: 80000, cumulative: 3975000 },
  { month: 'Aug 2024', renewalValue: 450000, newContractValue: 0, terminationValue: 0, netChange: 450000, cumulative: 4425000 },
  { month: 'Sep 2024', renewalValue: 120000, newContractValue: 300000, terminationValue: 0, netChange: 420000, cumulative: 4845000 },
  { month: 'Oct 2024', renewalValue: 0, newContractValue: 0, terminationValue: 50000, netChange: -50000, cumulative: 4795000 },
  { month: 'Nov 2024', renewalValue: 250000, newContractValue: 100000, terminationValue: 0, netChange: 350000, cumulative: 5145000 },
  { month: 'Dec 2024', renewalValue: 0, newContractValue: 0, terminationValue: 0, netChange: 0, cumulative: 5145000 },
];

const mockScenarios: CostScenario[] = [
  {
    id: 's1',
    name: 'Baseline',
    description: 'Current trajectory with no changes',
    assumptions: ['All contracts renew at projected rates', 'No new negotiations', 'Standard escalators apply'],
    projectedSavings: 0,
    projectedCost: 5145000,
    riskLevel: 'medium',
    probability: 60,
  },
  {
    id: 's2',
    name: 'Aggressive Renegotiation',
    description: 'Proactive renegotiation of top 5 contracts',
    assumptions: ['15% average discount on renewals', 'GlobalSupply terminated', 'Consolidation with Acme'],
    projectedSavings: 425000,
    projectedCost: 4720000,
    riskLevel: 'high',
    probability: 35,
  },
  {
    id: 's3',
    name: 'Conservative Optimization',
    description: 'Targeted improvements on at-risk contracts',
    assumptions: ['5% discount on high-value renewals', 'Terminate underperforming contracts', 'Maintain relationships'],
    projectedSavings: 180000,
    projectedCost: 4965000,
    riskLevel: 'low',
    probability: 75,
  },
];

const mockOpportunities: Opportunity[] = [
  {
    id: 'o1',
    type: 'termination',
    title: 'Exit GlobalSupply Agreement',
    description: 'Terminate underperforming procurement agreement and source alternatives',
    contracts: ['Procurement Agreement - GlobalSupply'],
    potentialSavings: 171600,
    effort: 'high',
    timeframe: '60-90 days',
    confidence: 85,
  },
  {
    id: 'o2',
    type: 'consolidation',
    title: 'Consolidate Acme Contracts',
    description: 'Merge 3 Acme agreements into single master agreement for volume discount',
    contracts: ['Master Agreement', 'Cloud Services SLA', 'Maintenance Contract'],
    potentialSavings: 120000,
    effort: 'medium',
    timeframe: '30-60 days',
    confidence: 70,
  },
  {
    id: 'o3',
    type: 'renegotiation',
    title: 'Renegotiate Cloud SLA Terms',
    description: 'Address SLA performance issues and renegotiate penalties',
    contracts: ['Cloud Services SLA'],
    potentialSavings: 45000,
    effort: 'low',
    timeframe: '14-30 days',
    confidence: 90,
  },
  {
    id: 'o4',
    type: 'optimization',
    title: 'Right-size Cloud Resources',
    description: 'Optimize cloud resource allocation based on actual usage patterns',
    contracts: ['Cloud Services SLA'],
    potentialSavings: 67500,
    effort: 'low',
    timeframe: '7-14 days',
    confidence: 95,
  },
];

const mockSupplierSpend: SupplierSpend[] = [
  { supplier: 'Acme Corporation', currentSpend: 1770000, projectedSpend: 1848000, changePercent: 4.4, contractCount: 3, riskLevel: 'low' },
  { supplier: 'GlobalSupply Ltd', currentSpend: 780000, projectedSpend: 842400, changePercent: 8.0, contractCount: 1, riskLevel: 'high' },
  { supplier: 'TechFlow Inc', currentSpend: 0, projectedSpend: 0, changePercent: 0, contractCount: 1, riskLevel: 'low' },
];

// ============================================================================
// Chart Components
// ============================================================================

const ForecastChart: React.FC<{ data: ForecastData[] }> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => Math.max(d.renewalValue, d.cumulative / 10)));
  
  return (
    <div className="h-64 flex items-end gap-2 px-4">
      {data.map((d, idx) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col items-center gap-0.5" style={{ height: 200 }}>
            {/* Renewal Bar */}
            {d.renewalValue > 0 && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.renewalValue / maxValue) * 100}%` }}
                transition={{ delay: idx * 0.05, duration: 0.5 }}
                className="w-full bg-blue-500 rounded-t"
                title={`Renewals: $${d.renewalValue.toLocaleString()}`}
              />
            )}
            {/* New Contract Bar */}
            {d.newContractValue > 0 && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.newContractValue / maxValue) * 100}%` }}
                transition={{ delay: idx * 0.05 + 0.1, duration: 0.5 }}
                className="w-full bg-green-500"
                title={`New: $${d.newContractValue.toLocaleString()}`}
              />
            )}
            {/* Termination Bar */}
            {d.terminationValue > 0 && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.terminationValue / maxValue) * 100}%` }}
                transition={{ delay: idx * 0.05 + 0.2, duration: 0.5 }}
                className="w-full bg-red-400 rounded-b"
                title={`Terminations: $${d.terminationValue.toLocaleString()}`}
              />
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2 whitespace-nowrap">
            {d.month.split(' ')[0]}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Opportunity Card
// ============================================================================

interface OpportunityCardProps {
  opportunity: Opportunity;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity }) => {
  const typeConfig = {
    consolidation: { icon: Target, color: 'bg-purple-100 text-purple-700', label: 'Consolidation' },
    renegotiation: { icon: RefreshCw, color: 'bg-blue-100 text-blue-700', label: 'Renegotiation' },
    termination: { icon: AlertTriangle, color: 'bg-red-100 text-red-700', label: 'Termination' },
    optimization: { icon: Zap, color: 'bg-green-100 text-green-700', label: 'Optimization' },
  };

  const config = typeConfig[opportunity.type];
  const Icon = config.icon;

  const effortColors = {
    low: 'text-green-600',
    medium: 'text-amber-600',
    high: 'text-red-600',
  };

  return (
    <div className="p-4 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            <span className="text-xs text-slate-400">{opportunity.confidence}% confidence</span>
          </div>
          <h4 className="font-semibold text-slate-900">{opportunity.title}</h4>
          <p className="text-sm text-slate-500 mt-1">{opportunity.description}</p>
          
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1 text-green-600 font-medium">
              <DollarSign className="w-4 h-4" />
              ${opportunity.potentialSavings.toLocaleString()}
            </div>
            <div className={`flex items-center gap-1 ${effortColors[opportunity.effort]}`}>
              <Target className="w-4 h-4" />
              {opportunity.effort} effort
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              <Clock className="w-4 h-4" />
              {opportunity.timeframe}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            {opportunity.contracts.slice(0, 2).map((contract, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                {contract}
              </span>
            ))}
            {opportunity.contracts.length > 2 && (
              <span className="text-xs text-slate-400">+{opportunity.contracts.length - 2} more</span>
            )}
          </div>
        </div>
        <button className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Scenario Card
// ============================================================================

interface ScenarioCardProps {
  scenario: CostScenario;
  isSelected: boolean;
  onSelect: () => void;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, isSelected, onSelect }) => {
  const riskColors = {
    low: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-lg'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-slate-900">{scenario.name}</h4>
          <p className="text-sm text-slate-500">{scenario.description}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${riskColors[scenario.riskLevel]} capitalize`}>
          {scenario.riskLevel} risk
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="p-2 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-500">Projected Cost</div>
          <div className="text-lg font-bold text-slate-900">${(scenario.projectedCost / 1000000).toFixed(2)}M</div>
        </div>
        <div className="p-2 bg-green-50 rounded-lg">
          <div className="text-xs text-green-600">Potential Savings</div>
          <div className="text-lg font-bold text-green-600">${(scenario.projectedSavings / 1000).toFixed(0)}K</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <Target className="w-4 h-4" />
          {scenario.probability}% probability
        </div>
        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${scenario.probability}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ForecastingDashboard: React.FC = () => {
  const { useRealData } = useDataMode();
  const { toast } = useToast();
  
  const [selectedScenario, setSelectedScenario] = useState<string>('s1');
  const [timeRange, setTimeRange] = useState<'6m' | '12m' | '24m'>('12m');
  const [forecastData, setForecastData] = useState<ForecastData[]>(mockForecastData);
  const [scenarios, setScenarios] = useState<CostScenario[]>(mockScenarios);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(mockOpportunities);
  const [supplierSpend, setSupplierSpend] = useState<SupplierSpend[]>(mockSupplierSpend);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    if (!useRealData) {
      setForecastData(mockForecastData);
      setScenarios(mockScenarios);
      setOpportunities(mockOpportunities);
      setSupplierSpend(mockSupplierSpend);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/forecasting?timeRange=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const data = await response.json();
      if (data.success) {
        if (data.forecastData?.length) setForecastData(data.forecastData);
        if (data.scenarios?.length) setScenarios(data.scenarios);
        if (data.opportunities?.length) setOpportunities(data.opportunities);
        if (data.supplierSpend?.length) setSupplierSpend(data.supplierSpend);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Using sample data - connect database for real analytics');
    } finally {
      setLoading(false);
    }
  }, [useRealData, timeRange]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const stats = useMemo(() => {
    const totalOpportunitySavings = opportunities.reduce((sum, o) => sum + o.potentialSavings, 0);
    const highConfidenceOps = opportunities.filter(o => o.confidence >= 80);
    const projectedSpend = supplierSpend.reduce((sum, s) => sum + s.projectedSpend, 0);
    const currentSpend = supplierSpend.reduce((sum, s) => sum + s.currentSpend, 0);
    
    return {
      totalOpportunities: opportunities.length,
      totalSavings: totalOpportunitySavings,
      highConfidence: highConfidenceOps.length,
      projectedSpend,
      currentSpend,
      spendChange: currentSpend > 0 ? ((projectedSpend - currentSpend) / currentSpend) * 100 : 0,
    };
  }, [opportunities, supplierSpend]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-500" />
              Forecasting & Opportunities
            </h1>
            <p className="text-slate-500 mt-1">Predict costs, discover savings, and plan strategically</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as '6m' | '12m' | '24m')}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="6m">Next 6 Months</option>
              <option value="12m">Next 12 Months</option>
              <option value="24m">Next 24 Months</option>
            </select>
            <button className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center gap-2">
              <Play className="w-4 h-4" />
              Run Simulation
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">${(stats.projectedSpend / 1000000).toFixed(2)}M</div>
              <div className="text-sm text-slate-500">Projected Spend</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats.spendChange > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
              {stats.spendChange > 0 ? (
                <ArrowUpRight className="w-5 h-5 text-red-600" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-green-600" />
              )}
            </div>
            <div>
              <div className={`text-2xl font-bold ${stats.spendChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.spendChange > 0 ? '+' : ''}{stats.spendChange.toFixed(1)}%
              </div>
              <div className="text-sm text-slate-500">YoY Change</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">${(stats.totalSavings / 1000).toFixed(0)}K</div>
              <div className="text-sm text-slate-500">Potential Savings</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{stats.totalOpportunities}</div>
              <div className="text-sm text-slate-500">Opportunities</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">{stats.highConfidence}</div>
              <div className="text-sm text-slate-500">High Confidence</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Forecast Chart */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Cost Forecast</h3>
              <p className="text-sm text-slate-500">Projected contract spend over time</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-sm text-slate-500">Renewals</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-sm text-slate-500">New</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded" />
                <span className="text-sm text-slate-500">Terminations</span>
              </div>
            </div>
          </div>
          <ForecastChart data={mockForecastData} />
        </div>

        {/* Scenarios */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Scenarios</h3>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {mockScenarios.map(scenario => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                isSelected={selectedScenario === scenario.id}
                onSelect={() => setSelectedScenario(scenario.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Opportunities Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Discovered Opportunities</h3>
            <p className="text-sm text-slate-500">AI-identified savings and optimization opportunities</p>
          </div>
          <button className="text-sm text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
            View All
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {mockOpportunities.map(opportunity => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      </div>

      {/* Supplier Spend Analysis */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Supplier Spend Projection</h3>
            <p className="text-sm text-slate-500">Forecasted spend by supplier</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Supplier</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Current Spend</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Projected</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Change</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-500">Contracts</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-500">Risk</th>
              </tr>
            </thead>
            <tbody>
              {mockSupplierSpend.map(supplier => (
                <tr key={supplier.supplier} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{supplier.supplier}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-slate-700">
                    ${supplier.currentSpend.toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-4 font-medium text-slate-900">
                    ${supplier.projectedSpend.toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-4">
                    <span className={`flex items-center justify-end gap-1 ${
                      supplier.changePercent > 0 ? 'text-red-600' : supplier.changePercent < 0 ? 'text-green-600' : 'text-slate-500'
                    }`}>
                      {supplier.changePercent > 0 && <ArrowUpRight className="w-4 h-4" />}
                      {supplier.changePercent < 0 && <ArrowDownRight className="w-4 h-4" />}
                      {supplier.changePercent !== 0 ? `${Math.abs(supplier.changePercent).toFixed(1)}%` : '-'}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4 text-slate-700">{supplier.contractCount}</td>
                  <td className="text-center py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      supplier.riskLevel === 'low' ? 'bg-green-100 text-green-700' :
                      supplier.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {supplier.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ForecastingDashboard;
