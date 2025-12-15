'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  FileText, 
  Building2, 
  Calendar, 
  FolderTree, 
  DollarSign,
  Sparkles,
  Download,
  RefreshCw,
  X,
  Filter,
  Loader2,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Printer,
  ChevronRight,
  ChevronDown,
  Eye,
  PieChart,
  Activity,
  Shield,
  Target,
  Zap,
  Users,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  Lightbulb,
  Award,
  Gauge,
  LineChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface FilterState {
  suppliers: string[];
  categories: string[];
  years: string[];
  statuses: string[];
}

interface SupplierAnalysis {
  name: string;
  totalValue: number;
  contractCount: number;
  avgValue: number;
  activeCount: number;
  expiringCount: number;
  riskScore: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface BenchmarkData {
  metric: string;
  yourValue: number;
  industryAvg: number;
  percentile: number;
  status: 'above' | 'below' | 'at' | 'excellent';
}

interface Recommendation {
  type: 'cost' | 'risk' | 'compliance' | 'efficiency' | 'strategic';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialImpact: string;
  affectedContracts: string[];
}

interface TrendData {
  period: string;
  value: number;
  count: number;
}

interface ReportResult {
  summary: {
    totalContracts: number;
    activeContracts: number;
    totalValue: number;
    averageValue: number;
    averageDurationMonths: number;
    shortestDurationMonths: number;
    longestDurationMonths: number;
    healthScore: number;
    complianceScore: number;
    riskScore: number;
  };
  contracts: Array<{
    id: string;
    title: string;
    supplierName: string;
    value: number;
    status: string;
    effectiveDate: string | null;
    expirationDate: string | null;
    durationMonths: number;
    category: string;
    daysUntilExpiry: number | null;
    autoRenewal: boolean;
    riskLevel: string;
  }>;
  byCategory: Record<string, { count: number; value: number; contracts: string[]; avgDuration: number }>;
  byStatus: Record<string, number>;
  byYear: Record<string, { count: number; value: number }>;
  bySupplier: SupplierAnalysis[];
  riskAnalysis: {
    expiringIn30Days: number;
    expiringIn90Days: number;
    autoRenewalCount: number;
    highValueAtRisk: number;
    overdueContracts: number;
    missingCriticalData: number;
    concentrationRisk: number;
  };
  trends: {
    valueByQuarter: TrendData[];
    contractsByQuarter: TrendData[];
    renewalRate: number;
    avgDurationTrend: TrendData[];
  };
  benchmarks: BenchmarkData[];
  recommendations: Recommendation[];
  aiSummary?: string;
}

// Status color mapping
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  DRAFT: 'bg-blue-100 text-blue-700 border-blue-200',
  EXPIRED: 'bg-red-100 text-red-700 border-red-200',
  ARCHIVED: 'bg-slate-100 text-slate-700 border-slate-200',
};

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  low: 'bg-green-100 text-green-700 border-green-300',
};

const PRIORITY_CONFIG: Record<string, { color: string; icon: typeof AlertCircle }> = {
  critical: { color: 'bg-red-500', icon: AlertCircle },
  high: { color: 'bg-orange-500', icon: AlertTriangle },
  medium: { color: 'bg-yellow-500', icon: Info },
  low: { color: 'bg-green-500', icon: CheckCircle },
};

const RECOMMENDATION_TYPE_ICONS: Record<string, typeof Target> = {
  cost: DollarSign,
  risk: Shield,
  compliance: CheckCircle,
  efficiency: Zap,
  strategic: Target,
};

// Score gauge component
function ScoreGauge({ 
  score, 
  label, 
  color = 'blue',
  size = 'md',
}: { 
  score: number; 
  label: string; 
  color?: 'blue' | 'green' | 'red' | 'yellow';
  size?: 'sm' | 'md' | 'lg';
}) {
  const colorMap = {
    blue: { bg: 'from-blue-500 to-indigo-600', text: 'text-blue-600', track: 'bg-blue-100' },
    green: { bg: 'from-green-500 to-emerald-600', text: 'text-green-600', track: 'bg-green-100' },
    red: { bg: 'from-red-500 to-rose-600', text: 'text-red-600', track: 'bg-red-100' },
    yellow: { bg: 'from-yellow-500 to-amber-600', text: 'text-yellow-600', track: 'bg-yellow-100' },
  };
  const sizes = { sm: 'w-16 h-16', md: 'w-24 h-24', lg: 'w-32 h-32' };
  const textSizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };
  
  return (
    <div className="flex flex-col items-center">
      <div className={cn('relative', sizes[size])}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className={colorMap[color].track}
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${score * 2.83} 283`}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className={`stop-color: ${color === 'blue' ? '#3b82f6' : color === 'green' ? '#22c55e' : color === 'red' ? '#ef4444' : '#eab308'}`} />
              <stop offset="100%" className={`stop-color: ${color === 'blue' ? '#6366f1' : color === 'green' ? '#10b981' : color === 'red' ? '#f43f5e' : '#f59e0b'}`} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', textSizes[size], colorMap[color].text)}>{score}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-600 mt-2">{label}</span>
    </div>
  );
}

export default function AIReportBuilderPage() {
  const [filters, setFilters] = useState<FilterState>({
    suppliers: [],
    categories: [],
    years: [],
    statuses: [],
  });
  
  const [availableFilters, setAvailableFilters] = useState<{
    suppliers: string[];
    categories: string[];
    years: string[];
    statuses: string[];
  }>({
    suppliers: [],
    categories: [],
    years: ['2025', '2024', '2023', '2022', '2021', '2020'],
    statuses: ['ACTIVE', 'PENDING', 'DRAFT', 'EXPIRED', 'ARCHIVED'],
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [showContractList, setShowContractList] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Fetch available filter options on mount
  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const response = await fetch('/api/reports/filter-options');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setAvailableFilters(prev => ({
              ...prev,
              suppliers: data.suppliers || [],
              categories: data.categories || [],
            }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    }
    fetchFilterOptions();
  }, []);
  
  // Toggle filter selection
  const toggleFilter = useCallback((type: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(v => v !== value)
        : [...prev[type], value]
    }));
  }, []);
  
  // Remove a specific filter
  const removeFilter = useCallback((type: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].filter(v => v !== value)
    }));
  }, []);
  
  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters({ suppliers: [], categories: [], years: [], statuses: [] });
    setReport(null);
    setError(null);
    setGeneratedAt(null);
  }, []);
  
  // Generate report
  const generateReport = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/reports/ai-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate report');
      }
      
      setReport({
        ...data.analysis,
        aiSummary: data.aiSummary,
      });
      setGeneratedAt(new Date().toISOString());
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }, [filters]);
  
  // Export to PDF
  const exportToPDF = useCallback(async () => {
    if (!report) return;
    
    setIsExporting(true);
    
    try {
      const response = await fetch('/api/reports/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportData: report,
          filters,
          generatedAt,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to export PDF');
      }
      
      const data = await response.json();
      
      if (data.success && data.html) {
        // Open in new window for printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          
          // Wait for content to load then print
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
            }, 250);
          };
        }
      }
      
    } catch (err) {
      console.error('PDF export error:', err);
      setError('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  }, [report, filters, generatedAt]);
  
  // Count active filters
  const activeFilterCount = Object.values(filters).flat().length;
  
  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatFullCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate category percentages for visual bar
  const getCategoryPercentage = (value: number) => {
    if (!report) return 0;
    const maxValue = Math.max(...Object.values(report.byCategory).map(c => c.value));
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                <BarChart3 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">AI Report Builder</h1>
                <p className="text-blue-100 mt-0.5">
                  Generate intelligent insights across your contract portfolio
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {activeFilterCount > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters ({activeFilterCount})
                </Button>
              )}
              <Button
                onClick={generateReport}
                disabled={isGenerating}
                className="bg-white text-indigo-600 hover:bg-blue-50 shadow-lg font-semibold"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Filter Section - Dropdown Filters */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
              <Filter className="h-4 w-4" />
              Filter Contracts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <MultiSelect
                label="Suppliers"
                options={availableFilters.suppliers.length > 0 ? availableFilters.suppliers : 
                  ['Deloitte', 'Accenture', 'McKinsey', 'AWS', 'Microsoft', 'Google Cloud', 'IBM', 'Oracle']}
                selected={filters.suppliers}
                onChange={(values) => setFilters(prev => ({ ...prev, suppliers: values }))}
                placeholder="All Suppliers"
              />
              <MultiSelect
                label="Categories"
                options={availableFilters.categories.length > 0 ? availableFilters.categories :
                  ['Professional Services', 'IT Services', 'Cloud Infrastructure', 'Software Licenses', 'Consulting', 'Facilities']}
                selected={filters.categories}
                onChange={(values) => setFilters(prev => ({ ...prev, categories: values }))}
                placeholder="All Categories"
              />
              <MultiSelect
                label="Years"
                options={availableFilters.years}
                selected={filters.years}
                onChange={(values) => setFilters(prev => ({ ...prev, years: values }))}
                placeholder="All Years"
                searchable={false}
              />
              <MultiSelect
                label="Status"
                options={availableFilters.statuses}
                selected={filters.statuses}
                onChange={(values) => setFilters(prev => ({ ...prev, statuses: values }))}
                placeholder="All Statuses"
                searchable={false}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Active Filters Summary */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-3 flex-wrap px-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm">
            <span className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
              <Filter className="h-4 w-4" />
              Filters:
            </span>
            {filters.suppliers.map(s => (
              <Badge key={s} className="bg-blue-100 text-blue-700 hover:bg-blue-200 gap-1.5 pl-2 pr-1 py-1">
                <Building2 className="h-3 w-3" />
                {s}
                <button onClick={() => removeFilter('suppliers', s)} className="ml-0.5 hover:text-red-600 rounded-full p-0.5 hover:bg-red-100">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {filters.categories.map(c => (
              <Badge key={c} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 gap-1.5 pl-2 pr-1 py-1">
                <FolderTree className="h-3 w-3" />
                {c}
                <button onClick={() => removeFilter('categories', c)} className="ml-0.5 hover:text-red-600 rounded-full p-0.5 hover:bg-red-100">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {filters.years.map(y => (
              <Badge key={y} className="bg-purple-100 text-purple-700 hover:bg-purple-200 gap-1.5 pl-2 pr-1 py-1">
                <Calendar className="h-3 w-3" />
                {y}
                <button onClick={() => removeFilter('years', y)} className="ml-0.5 hover:text-red-600 rounded-full p-0.5 hover:bg-red-100">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {filters.statuses.map(s => (
              <Badge key={s} className="bg-amber-100 text-amber-700 hover:bg-amber-200 gap-1.5 pl-2 pr-1 py-1">
                {s}
                <button onClick={() => removeFilter('statuses', s)} className="ml-0.5 hover:text-red-600 rounded-full p-0.5 hover:bg-red-100">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50 shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
                <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Empty State */}
        {!report && !isGenerating && (
          <Card className="border-2 border-dashed border-gray-200 bg-white/50">
            <CardContent className="py-20 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Build Your AI Report
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Select filters above to analyze specific contracts, or click &quot;Generate Report&quot; to analyze your entire portfolio.
              </p>
              <Button
                onClick={generateReport}
                disabled={isGenerating}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Full Portfolio Report
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Loading State */}
        {isGenerating && (
          <Card className="border-0 shadow-xl bg-white">
            <CardContent className="py-20 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
                <Loader2 className="h-10 w-10 text-white animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Generating AI Report...
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Analyzing contracts, calculating metrics, and generating insights. This may take a moment.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Report Results */}
        {report && !isGenerating && (
          <div className="space-y-6" ref={reportRef}>
            {/* Report Header with Actions */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Portfolio Analysis Report</h2>
                {generatedAt && (
                  <p className="text-sm text-gray-500">
                    Generated {new Date(generatedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportToPDF}
                  disabled={isExporting}
                  className="gap-2"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export PDF
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setReport(null)}>
                  <RefreshCw className="h-4 w-4" />
                  New Report
                </Button>
              </div>
            </div>
            
            {/* Health Scores Dashboard */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gauge className="h-5 w-5" />
                  Portfolio Health Dashboard
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Real-time health metrics based on contract data quality, compliance, and risk factors
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-8">
                  <div className="flex flex-col items-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                    <div className="relative w-28 h-28 mb-4">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e0e7ff" strokeWidth="8" />
                        <circle 
                          cx="50" cy="50" r="40" fill="none" stroke="url(#healthGradient)" strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${(report.summary.healthScore || 0) * 2.51} 251`}
                          className="transition-all duration-1000"
                        />
                        <defs>
                          <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#6366f1" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-blue-600">{report.summary.healthScore || 0}</span>
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Health Score</h4>
                    <p className="text-sm text-gray-500 text-center mt-1">Overall portfolio health based on renewal rates, value distribution, and risk factors</p>
                  </div>
                  
                  <div className="flex flex-col items-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100">
                    <div className="relative w-28 h-28 mb-4">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#d1fae5" strokeWidth="8" />
                        <circle 
                          cx="50" cy="50" r="40" fill="none" stroke="url(#complianceGradient)" strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${(report.summary.complianceScore || 0) * 2.51} 251`}
                          className="transition-all duration-1000"
                        />
                        <defs>
                          <linearGradient id="complianceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#22c55e" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-green-600">{report.summary.complianceScore || 0}</span>
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Compliance Score</h4>
                    <p className="text-sm text-gray-500 text-center mt-1">Data completeness and documentation quality across all contracts</p>
                  </div>
                  
                  <div className="flex flex-col items-center p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border border-red-100">
                    <div className="relative w-28 h-28 mb-4">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#fee2e2" strokeWidth="8" />
                        <circle 
                          cx="50" cy="50" r="40" fill="none" stroke="url(#riskGradient)" strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${(report.summary.riskScore || 0) * 2.51} 251`}
                          className="transition-all duration-1000"
                        />
                        <defs>
                          <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#ef4444" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-orange-600">{report.summary.riskScore || 0}</span>
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Risk Score</h4>
                    <p className="text-sm text-gray-500 text-center mt-1">Combined risk assessment including expirations, concentration, and compliance gaps</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold">{report.summary.totalContracts}</p>
                      <p className="text-blue-100 text-sm mt-1">Total Contracts</p>
                    </div>
                    <div className="p-2 bg-white/20 rounded-lg">
                      <FileText className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold">{formatCurrency(report.summary.totalValue)}</p>
                      <p className="text-emerald-100 text-sm mt-1">Total Value</p>
                    </div>
                    <div className="p-2 bg-white/20 rounded-lg">
                      <DollarSign className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md bg-gradient-to-br from-purple-500 to-purple-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold">{report.summary.averageDurationMonths}<span className="text-lg">mo</span></p>
                      <p className="text-purple-100 text-sm mt-1">Avg Duration</p>
                    </div>
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Clock className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-500 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold">{report.riskAnalysis.expiringIn90Days}</p>
                      <p className="text-amber-100 text-sm mt-1">Expiring Soon</p>
                    </div>
                    <div className="p-2 bg-white/20 rounded-lg">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* AI Summary */}
            {report.aiSummary && (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b">
                  <CardTitle className="flex items-center gap-2 text-gray-800">
                    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    AI Executive Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  <div 
                    className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: report.aiSummary
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
                        .replace(/\n/g, '<br />')
                        .replace(/\[([^\]]+)\]\(\/contracts\/([^)]+)\)/g, 
                          '<a href="/contracts/$2" class="text-blue-600 hover:text-blue-800 hover:underline font-medium">$1</a>')
                    }} 
                  />
                </CardContent>
              </Card>
            )}
            
            {/* AI Recommendations */}
            {report.recommendations && report.recommendations.length > 0 && (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border-b">
                  <CardTitle className="flex items-center gap-2 text-gray-800">
                    <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
                      <Lightbulb className="h-4 w-4 text-white" />
                    </div>
                    AI-Powered Recommendations
                  </CardTitle>
                  <CardDescription>Actionable insights to optimize your contract portfolio</CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  <div className="space-y-4">
                    {report.recommendations.slice(0, 8).map((rec, idx) => {
                      const TypeIcon = RECOMMENDATION_TYPE_ICONS[rec.type] || Lightbulb;
                      const priorityConfig = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.medium;
                      
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="group"
                        >
                          <div className="flex items-start gap-4 p-4 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all">
                            <div className={cn(
                              "p-2.5 rounded-xl shrink-0",
                              rec.type === 'cost' && "bg-emerald-100",
                              rec.type === 'risk' && "bg-red-100",
                              rec.type === 'compliance' && "bg-blue-100",
                              rec.type === 'efficiency' && "bg-purple-100",
                              rec.type === 'strategic' && "bg-amber-100"
                            )}>
                              <TypeIcon className={cn(
                                "h-5 w-5",
                                rec.type === 'cost' && "text-emerald-600",
                                rec.type === 'risk' && "text-red-600",
                                rec.type === 'compliance' && "text-blue-600",
                                rec.type === 'efficiency' && "text-purple-600",
                                rec.type === 'strategic' && "text-amber-600"
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                                <Badge className={cn(
                                  "text-[10px] uppercase tracking-wide font-bold px-2 py-0.5",
                                  rec.priority === 'critical' && "bg-red-500 text-white",
                                  rec.priority === 'high' && "bg-orange-500 text-white",
                                  rec.priority === 'medium' && "bg-yellow-500 text-white",
                                  rec.priority === 'low' && "bg-green-500 text-white"
                                )}>
                                  {rec.priority}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {rec.type}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                              <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                  <TrendingUp className="h-3 w-3" />
                                  Impact: {rec.potentialImpact}
                                </span>
                                {rec.affectedContracts && rec.affectedContracts.length > 0 && (
                                  <span className="text-gray-500">
                                    {rec.affectedContracts.length} contract{rec.affectedContracts.length > 1 ? 's' : ''} affected
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Supplier Analysis */}
            {report.bySupplier && report.bySupplier.length > 0 && (
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2 text-gray-800">
                    <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    Supplier Analysis
                  </CardTitle>
                  <CardDescription>Performance metrics and risk assessment by supplier</CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-3 font-semibold text-gray-600">Supplier</th>
                          <th className="text-right py-3 px-3 font-semibold text-gray-600">Total Value</th>
                          <th className="text-center py-3 px-3 font-semibold text-gray-600">Contracts</th>
                          <th className="text-right py-3 px-3 font-semibold text-gray-600">Avg Value</th>
                          <th className="text-center py-3 px-3 font-semibold text-gray-600">Active</th>
                          <th className="text-center py-3 px-3 font-semibold text-gray-600">Expiring</th>
                          <th className="text-center py-3 px-3 font-semibold text-gray-600">Risk</th>
                          <th className="text-center py-3 px-3 font-semibold text-gray-600">Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.bySupplier.slice(0, 10).map((supplier, idx) => (
                          <tr key={supplier.name} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                                  idx === 0 ? "bg-amber-100 text-amber-700" :
                                  idx === 1 ? "bg-gray-200 text-gray-700" :
                                  idx === 2 ? "bg-orange-100 text-orange-700" :
                                  "bg-blue-50 text-blue-600"
                                )}>
                                  {idx < 3 ? <Award className="h-4 w-4" /> : idx + 1}
                                </div>
                                <span className="font-medium text-gray-900">{supplier.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-semibold">{formatCurrency(supplier.totalValue)}</td>
                            <td className="py-3 px-3 text-center">
                              <Badge variant="outline">{supplier.contractCount}</Badge>
                            </td>
                            <td className="py-3 px-3 text-right text-gray-600">{formatCurrency(supplier.avgValue)}</td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-emerald-600 font-medium">{supplier.activeCount}</span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {supplier.expiringCount > 0 ? (
                                <span className="text-orange-600 font-medium">{supplier.expiringCount}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center">
                                <div className={cn(
                                  "w-16 h-2 rounded-full overflow-hidden bg-gray-100"
                                )}>
                                  <div 
                                    className={cn(
                                      "h-full rounded-full",
                                      supplier.riskScore <= 30 ? "bg-green-500" :
                                      supplier.riskScore <= 60 ? "bg-yellow-500" :
                                      "bg-red-500"
                                    )}
                                    style={{ width: `${supplier.riskScore}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {supplier.trend === 'increasing' && (
                                <span className="flex items-center justify-center text-emerald-600">
                                  <ArrowUpRight className="h-4 w-4" />
                                </span>
                              )}
                              {supplier.trend === 'decreasing' && (
                                <span className="flex items-center justify-center text-red-600">
                                  <ArrowDownRight className="h-4 w-4" />
                                </span>
                              )}
                              {supplier.trend === 'stable' && (
                                <span className="flex items-center justify-center text-gray-400">
                                  <Minus className="h-4 w-4" />
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Trends & Benchmarks Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Trends */}
              {report.trends && report.trends.valueByQuarter && report.trends.valueByQuarter.length > 0 && (
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <LineChart className="h-4 w-4 text-blue-500" />
                      Portfolio Trends
                    </CardTitle>
                    <CardDescription>Quarterly value and contract volume trends</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Value by Quarter</p>
                        <div className="flex items-end gap-2 h-32">
                          {report.trends.valueByQuarter.map((trend, idx) => {
                            const maxValue = Math.max(...report.trends.valueByQuarter.map(t => t.value));
                            const height = maxValue > 0 ? (trend.value / maxValue) * 100 : 0;
                            return (
                              <TooltipProvider key={trend.period}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex-1 flex flex-col items-center gap-1">
                                      <div 
                                        className="w-full bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t-md transition-all hover:from-blue-600 hover:to-indigo-600"
                                        style={{ height: `${height}%`, minHeight: '4px' }}
                                      />
                                      <span className="text-[10px] text-gray-500">{trend.period}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{formatCurrency(trend.value)}</p>
                                    <p className="text-xs text-gray-400">{trend.count} contracts</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      </div>
                      
                      {report.trends.renewalRate !== undefined && (
                        <div className="pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Renewal Rate</span>
                            <span className="text-lg font-bold text-emerald-600">{report.trends.renewalRate}%</span>
                          </div>
                          <Progress value={report.trends.renewalRate} className="mt-2 h-2" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Benchmarks */}
              {report.benchmarks && report.benchmarks.length > 0 && (
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple-500" />
                      Industry Benchmarks
                    </CardTitle>
                    <CardDescription>Your portfolio vs industry standards</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {report.benchmarks.map((benchmark, idx) => (
                        <div key={benchmark.metric} className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700 truncate">{benchmark.metric}</span>
                              <div className="flex items-center gap-2">
                                <Badge className={cn(
                                  "text-[10px]",
                                  benchmark.status === 'excellent' && "bg-emerald-100 text-emerald-700",
                                  benchmark.status === 'above' && "bg-green-100 text-green-700",
                                  benchmark.status === 'at' && "bg-yellow-100 text-yellow-700",
                                  benchmark.status === 'below' && "bg-red-100 text-red-700"
                                )}>
                                  {benchmark.status === 'excellent' ? 'Excellent' :
                                   benchmark.status === 'above' ? 'Above Avg' :
                                   benchmark.status === 'at' ? 'Average' : 'Below Avg'}
                                </Badge>
                              </div>
                            </div>
                            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "absolute h-full rounded-full transition-all",
                                  benchmark.percentile >= 75 ? "bg-emerald-500" :
                                  benchmark.percentile >= 50 ? "bg-green-500" :
                                  benchmark.percentile >= 25 ? "bg-yellow-500" :
                                  "bg-red-500"
                                )}
                                style={{ width: `${benchmark.percentile}%` }}
                              />
                              <div 
                                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-400"
                                style={{ left: '50%' }}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-gray-500">
                              <span>Your: {typeof benchmark.yourValue === 'number' ? 
                                (benchmark.metric.includes('Value') || benchmark.metric.includes('$') ? 
                                  formatCurrency(benchmark.yourValue) : benchmark.yourValue.toFixed(1)) : benchmark.yourValue}</span>
                              <span>Avg: {typeof benchmark.industryAvg === 'number' ? 
                                (benchmark.metric.includes('Value') || benchmark.metric.includes('$') ? 
                                  formatCurrency(benchmark.industryAvg) : benchmark.industryAvg.toFixed(1)) : benchmark.industryAvg}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By Category - Enhanced */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-emerald-500" />
                    Breakdown by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(report.byCategory).slice(0, 6).map(([category, data]) => (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]">{category}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-normal">{data.count}</Badge>
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(data.value)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                            style={{ width: `${getCategoryPercentage(data.value)}%` }}
                          />
                        </div>
                        {data.avgDuration && (
                          <p className="text-xs text-gray-500 mt-1">Avg duration: {data.avgDuration} months</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Duration Analysis */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-500" />
                    Duration Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-purple-50 rounded-xl">
                      <p className="text-2xl font-bold text-purple-700">{report.summary.shortestDurationMonths}</p>
                      <p className="text-xs text-purple-600 mt-1">Shortest (mo)</p>
                    </div>
                    <div className="text-center p-4 bg-purple-100 rounded-xl">
                      <p className="text-2xl font-bold text-purple-800">{report.summary.averageDurationMonths}</p>
                      <p className="text-xs text-purple-700 mt-1">Average (mo)</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-xl">
                      <p className="text-2xl font-bold text-purple-700">{report.summary.longestDurationMonths}</p>
                      <p className="text-xs text-purple-600 mt-1">Longest (mo)</p>
                    </div>
                  </div>
                  
                  {/* Status Distribution */}
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Status Distribution</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(report.byStatus).map(([status, count]) => (
                        <div 
                          key={status} 
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-sm font-medium border",
                            STATUS_COLORS[status] || "bg-gray-100 text-gray-700"
                          )}
                        >
                          {status}: {count}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            </div>
            
            {/* Risk Analysis - Full Width Enhanced */}
            <Card className="border-0 shadow-lg border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Comprehensive Risk Analysis
                </CardTitle>
                <CardDescription>Identify and monitor portfolio risks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-red-500 rounded-full flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-red-600">{report.riskAnalysis.expiringIn30Days}</p>
                    <p className="text-[10px] text-red-500 mt-1 font-medium">30-Day Expiry</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-orange-500 rounded-full flex items-center justify-center">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-orange-600">{report.riskAnalysis.expiringIn90Days}</p>
                    <p className="text-[10px] text-orange-500 mt-1 font-medium">90-Day Expiry</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-yellow-500 rounded-full flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-yellow-600">{report.riskAnalysis.autoRenewalCount}</p>
                    <p className="text-[10px] text-yellow-600 mt-1 font-medium">Auto-Renewal</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-purple-500 rounded-full flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{report.riskAnalysis.highValueAtRisk}</p>
                    <p className="text-[10px] text-purple-500 mt-1 font-medium">High-Value Risk</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl border border-rose-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-rose-500 rounded-full flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-rose-600">{report.riskAnalysis.overdueContracts || 0}</p>
                    <p className="text-[10px] text-rose-500 mt-1 font-medium">Overdue</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-blue-500 rounded-full flex items-center justify-center">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{report.riskAnalysis.missingCriticalData || 0}</p>
                    <p className="text-[10px] text-blue-500 mt-1 font-medium">Missing Data</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-indigo-500 rounded-full flex items-center justify-center">
                      <Layers className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-indigo-600">{report.riskAnalysis.concentrationRisk || 0}%</p>
                    <p className="text-[10px] text-indigo-500 mt-1 font-medium">Concentration</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Contract List Toggle */}
            <Card className="border-0 shadow-md">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setShowContractList(!showContractList)}
              >
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Contract Details ({report.contracts.length})
                  </div>
                  <ChevronDown className={cn(
                    "h-5 w-5 text-gray-400 transition-transform",
                    showContractList && "rotate-180"
                  )} />
                  <ChevronRight className={cn(
                    "h-5 w-5 text-gray-400 transition-transform",
                    showContractList && "rotate-90"
                  )} />
                </CardTitle>
              </CardHeader>
              {showContractList && (
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-2 font-semibold text-gray-600">Contract</th>
                          <th className="text-left py-3 px-2 font-semibold text-gray-600">Supplier</th>
                          <th className="text-right py-3 px-2 font-semibold text-gray-600">Value</th>
                          <th className="text-center py-3 px-2 font-semibold text-gray-600">Status</th>
                          <th className="text-center py-3 px-2 font-semibold text-gray-600">Risk</th>
                          <th className="text-center py-3 px-2 font-semibold text-gray-600">Duration</th>
                          <th className="text-center py-3 px-2 font-semibold text-gray-600">Expiry</th>
                          <th className="text-right py-3 px-2 font-semibold text-gray-600">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.contracts.slice(0, 20).map((contract) => (
                          <tr key={contract.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                {contract.autoRenewal && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>Auto-renewal enabled</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                <span className="font-medium text-gray-900 truncate block max-w-[200px]">
                                  {contract.title || 'Untitled Contract'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-gray-600">{contract.supplierName || 'N/A'}</td>
                            <td className="py-3 px-2 text-right font-semibold">{formatFullCurrency(contract.value || 0)}</td>
                            <td className="py-3 px-2 text-center">
                              <Badge className={cn("text-xs", STATUS_COLORS[contract.status])}>
                                {contract.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-center">
                              {contract.riskLevel && (
                                <Badge className={cn("text-xs", RISK_COLORS[contract.riskLevel.toLowerCase()] || "bg-gray-100")}>
                                  {contract.riskLevel}
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-2 text-center text-gray-600">{contract.durationMonths || 0} mo</td>
                            <td className="py-3 px-2 text-center">
                              {contract.daysUntilExpiry !== null && contract.daysUntilExpiry !== undefined ? (
                                <span className={cn(
                                  "text-xs font-medium",
                                  contract.daysUntilExpiry <= 30 ? "text-red-600" :
                                  contract.daysUntilExpiry <= 90 ? "text-orange-600" :
                                  "text-gray-600"
                                )}>
                                  {contract.daysUntilExpiry <= 0 ? 'Expired' : `${contract.daysUntilExpiry}d`}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <Link href={`/contracts/${contract.id}`}>
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:bg-blue-50 hover:text-blue-600">
                                  <Eye className="h-3 w-3" />
                                  View
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {report.contracts.length > 20 && (
                      <div className="text-center py-4 border-t">
                        <p className="text-sm text-gray-500 mb-2">
                          Showing 20 of {report.contracts.length} contracts
                        </p>
                        <Button variant="outline" size="sm" onClick={() => setShowContractList(false)}>
                          Collapse List
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>
      
      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
