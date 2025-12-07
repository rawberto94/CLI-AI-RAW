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
  Printer,
  ChevronRight,
  Eye,
  PieChart,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface FilterState {
  suppliers: string[];
  categories: string[];
  years: string[];
  statuses: string[];
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
  }>;
  byCategory: Record<string, { count: number; value: number; contracts: string[] }>;
  byStatus: Record<string, number>;
  byYear: Record<string, { count: number; value: number }>;
  riskAnalysis: {
    expiringIn30Days: number;
    expiringIn90Days: number;
    autoRenewalCount: number;
    highValueAtRisk: number;
  };
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
                <h2 className="text-lg font-semibold text-gray-900">Report Results</h2>
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
            
            {/* Risk Analysis - Full Width */}
            <Card className="border-0 shadow-md border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Risk Analysis &amp; Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-5 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
                    <div className="w-12 h-12 mx-auto mb-2 bg-red-500 rounded-full flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-white" />
                    </div>
                    <p className="text-3xl font-bold text-red-600">{report.riskAnalysis.expiringIn30Days}</p>
                    <p className="text-xs text-red-500 mt-1 font-medium">Expiring in 30 days</p>
                  </div>
                  <div className="text-center p-5 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                    <div className="w-12 h-12 mx-auto mb-2 bg-orange-500 rounded-full flex items-center justify-center">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <p className="text-3xl font-bold text-orange-600">{report.riskAnalysis.expiringIn90Days}</p>
                    <p className="text-xs text-orange-500 mt-1 font-medium">Expiring in 90 days</p>
                  </div>
                  <div className="text-center p-5 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                    <div className="w-12 h-12 mx-auto mb-2 bg-yellow-500 rounded-full flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 text-white" />
                    </div>
                    <p className="text-3xl font-bold text-yellow-600">{report.riskAnalysis.autoRenewalCount}</p>
                    <p className="text-xs text-yellow-600 mt-1 font-medium">Auto-renewal enabled</p>
                  </div>
                  <div className="text-center p-5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                    <div className="w-12 h-12 mx-auto mb-2 bg-purple-500 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <p className="text-3xl font-bold text-purple-600">{report.riskAnalysis.highValueAtRisk}</p>
                    <p className="text-xs text-purple-500 mt-1 font-medium">High-value at risk</p>
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
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-semibold text-gray-600">Contract</th>
                          <th className="text-left py-3 px-2 font-semibold text-gray-600">Supplier</th>
                          <th className="text-right py-3 px-2 font-semibold text-gray-600">Value</th>
                          <th className="text-center py-3 px-2 font-semibold text-gray-600">Status</th>
                          <th className="text-center py-3 px-2 font-semibold text-gray-600">Duration</th>
                          <th className="text-right py-3 px-2 font-semibold text-gray-600">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.contracts.slice(0, 20).map((contract) => (
                          <tr key={contract.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-2">
                              <span className="font-medium text-gray-900 truncate block max-w-[200px]">
                                {contract.title || 'Untitled Contract'}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-gray-600">{contract.supplierName || 'N/A'}</td>
                            <td className="py-3 px-2 text-right font-medium">{formatFullCurrency(contract.value || 0)}</td>
                            <td className="py-3 px-2 text-center">
                              <Badge className={cn("text-xs", STATUS_COLORS[contract.status])}>
                                {contract.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-center text-gray-600">{contract.durationMonths || 0} mo</td>
                            <td className="py-3 px-2 text-right">
                              <Link href={`/contracts/${contract.id}`}>
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
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
                      <p className="text-center py-3 text-sm text-gray-500">
                        Showing 20 of {report.contracts.length} contracts
                      </p>
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
