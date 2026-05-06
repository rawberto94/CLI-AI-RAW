'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { sanitizeHtml } from '@/lib/security/sanitize';

// Format AI content with markdown and sanitization
const formatAIContent = (content: string): string => {
  const sanitized = sanitizeHtml(content);
  return sanitized
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
    .replace(/\n/g, '<br />')
    .replace(/\[([^\]]+)\]\(\/contracts\/([^)]+)\)/g, (_match, text, id) => {
      // Only allow alphanumeric/hyphen/underscore contract IDs to prevent XSS via href injection
      const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
      const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<a href="/contracts/${safeId}" class="text-violet-600 hover:text-violet-800 hover:underline font-medium">${safeText}</a>`;
    });
};
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
  ChevronDown,
  Eye,
  PieChart,
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
  Save,
  FolderOpen,
  Trash2,
  Mail,
  Bell,
  History,
  GitCompare,
  FileSpreadsheet,
  Star,
  StarOff,
  Plus,
} from 'lucide-react';

// ============= SAVED PRESETS TYPES =============
interface SavedPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
  lastUsed: string | null;
  isFavorite: boolean;
}

// ============= REPORT HISTORY TYPES =============
interface ReportHistoryItem {
  id: string;
  filters: FilterState;
  generatedAt: string;
  summary: {
    totalContracts: number;
    totalValue: number;
  };
}

// ============= SCHEDULE TYPES =============
interface ScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:mm format
  emails: string[];
  includeExcel: boolean;
  includePdf: boolean;
}
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import { Progress } from '@/components/ui/progress';
// Tabs removed - not currently used in this view
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion } from 'framer-motion';

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
  ACTIVE: 'bg-violet-100 text-violet-700 border-violet-200',
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  DRAFT: 'bg-violet-100 text-violet-700 border-violet-200',
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
  
  // ============= NEW ENHANCED FEATURES STATE =============
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [comparisonReport, setComparisonReport] = useState<ReportResult | null>(null);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    enabled: false,
    frequency: 'weekly',
    dayOfWeek: 1, // Monday
    time: '09:00',
    emails: [],
    includeExcel: true,
    includePdf: true,
  });
  const [newEmail, setNewEmail] = useState('');
  
  // Load presets and history from localStorage on mount
  useEffect(() => {
    try {
      const storedPresets = localStorage.getItem('ai-report-presets');
      if (storedPresets) {
        const parsed = JSON.parse(storedPresets);
        if (Array.isArray(parsed)) setSavedPresets(parsed);
      }
    } catch {
      // Ignore corrupted presets
    }
    try {
      const storedHistory = localStorage.getItem('ai-report-history');
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory);
        if (Array.isArray(parsed)) setReportHistory(parsed);
      }
    } catch {
      // Ignore corrupted history
    }
    try {
      const storedSchedule = localStorage.getItem('ai-report-schedule');
      if (storedSchedule) {
        setScheduleConfig(JSON.parse(storedSchedule));
      }
    } catch {
      // Ignore corrupted schedule
    }
  }, []);
  
  // Save preset function
  const saveCurrentPreset = useCallback(() => {
    if (!newPresetName.trim()) return;
    
    const newPreset: SavedPreset = {
      id: crypto.randomUUID(),
      name: newPresetName.trim(),
      filters,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      isFavorite: false,
    };
    
    const updatedPresets = [...savedPresets, newPreset];
    setSavedPresets(updatedPresets);
    localStorage.setItem('ai-report-presets', JSON.stringify(updatedPresets));
    setNewPresetName('');
  }, [newPresetName, filters, savedPresets]);
  
  // Load preset function
  const loadPreset = useCallback((preset: SavedPreset) => {
    setFilters(preset.filters);
    
    // Update last used
    const updatedPresets = savedPresets.map(p => 
      p.id === preset.id ? { ...p, lastUsed: new Date().toISOString() } : p
    );
    setSavedPresets(updatedPresets);
    localStorage.setItem('ai-report-presets', JSON.stringify(updatedPresets));
    setShowPresetPanel(false);
  }, [savedPresets]);
  
  // Delete preset function
  const deletePreset = useCallback((presetId: string) => {
    const updatedPresets = savedPresets.filter(p => p.id !== presetId);
    setSavedPresets(updatedPresets);
    localStorage.setItem('ai-report-presets', JSON.stringify(updatedPresets));
  }, [savedPresets]);
  
  // Toggle favorite preset
  const toggleFavorite = useCallback((presetId: string) => {
    const updatedPresets = savedPresets.map(p =>
      p.id === presetId ? { ...p, isFavorite: !p.isFavorite } : p
    );
    setSavedPresets(updatedPresets);
    localStorage.setItem('ai-report-presets', JSON.stringify(updatedPresets));
  }, [savedPresets]);
  
  // Add to report history
  const addToHistory = useCallback((reportData: ReportResult) => {
    const historyItem: ReportHistoryItem = {
      id: crypto.randomUUID(),
      filters: { ...filters },
      generatedAt: new Date().toISOString(),
      summary: {
        totalContracts: reportData.summary.totalContracts,
        totalValue: reportData.summary.totalValue,
      },
    };
    
    const updatedHistory = [historyItem, ...reportHistory].slice(0, 20); // Keep last 20
    setReportHistory(updatedHistory);
    localStorage.setItem('ai-report-history', JSON.stringify(updatedHistory));
  }, [filters, reportHistory]);
  
  // Load from history
  const loadFromHistory = useCallback((item: ReportHistoryItem) => {
    setFilters(item.filters);
    setShowHistoryPanel(false);
  }, []);
  
  // Save schedule config
  const saveScheduleConfig = useCallback(() => {
    localStorage.setItem('ai-report-schedule', JSON.stringify(scheduleConfig));
    setShowScheduleModal(false);
    // In production, this would also call an API to register the schedule
  }, [scheduleConfig]);
  
  // Add email to schedule
  const addEmailToSchedule = useCallback(() => {
    if (!newEmail.trim() || !newEmail.includes('@')) return;
    if (scheduleConfig.emails.includes(newEmail.trim())) return;
    
    setScheduleConfig(prev => ({
      ...prev,
      emails: [...prev.emails, newEmail.trim()],
    }));
    setNewEmail('');
  }, [newEmail, scheduleConfig.emails]);
  
  // Remove email from schedule
  const removeEmailFromSchedule = useCallback((email: string) => {
    setScheduleConfig(prev => ({
      ...prev,
      emails: prev.emails.filter(e => e !== email),
    }));
  }, []);
  
  // Export to Excel function
  const exportToExcel = useCallback(async () => {
    if (!report) return;
    
    setIsExporting(true);
    
    try {
      // Generate CSV data for Excel compatibility
      const csvRows: string[] = [];
      
      // Header
      csvRows.push('AI Report Builder - Portfolio Analysis');
      csvRows.push(`Generated: ${generatedAt ? new Date(generatedAt).toLocaleString() : 'N/A'}`);
      csvRows.push('');
      
      // Summary section
      csvRows.push('EXECUTIVE SUMMARY');
      csvRows.push('Metric,Value');
      csvRows.push(`Total Contracts,${report.summary.totalContracts}`);
      csvRows.push(`Active Contracts,${report.summary.activeContracts}`);
      csvRows.push(`Total Value,"${report.summary.totalValue}"`);
      csvRows.push(`Average Value,"${report.summary.averageValue}"`);
      csvRows.push(`Health Score,${report.summary.healthScore}`);
      csvRows.push(`Compliance Score,${report.summary.complianceScore}`);
      csvRows.push(`Risk Score,${report.summary.riskScore}`);
      csvRows.push('');
      
      // Contract details
      csvRows.push('CONTRACT DETAILS');
      csvRows.push('Title,Supplier,Value,Status,Category,Days Until Expiry,Risk Level');
      report.contracts.forEach(contract => {
        csvRows.push(`"${contract.title}","${contract.supplierName}","${contract.value}","${contract.status}","${contract.category}","${contract.daysUntilExpiry ?? 'N/A'}","${contract.riskLevel}"`);
      });
      csvRows.push('');
      
      // By Category
      csvRows.push('BY CATEGORY');
      csvRows.push('Category,Count,Value');
      Object.entries(report.byCategory).forEach(([category, data]) => {
        csvRows.push(`"${category}",${data.count},"${data.value}"`);
      });
      csvRows.push('');
      
      // By Supplier
      if (report.bySupplier && report.bySupplier.length > 0) {
        csvRows.push('SUPPLIER ANALYSIS');
        csvRows.push('Supplier,Total Value,Contract Count,Avg Value,Active,Expiring,Risk Score');
        report.bySupplier.forEach(supplier => {
          csvRows.push(`"${supplier.name}","${supplier.totalValue}",${supplier.contractCount},"${supplier.avgValue}",${supplier.activeCount},${supplier.expiringCount},${supplier.riskScore}`);
        });
      }
      
      // Create and download CSV
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `portfolio-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      
    } catch {
      setError('Failed to export to Excel');
    } finally {
      setIsExporting(false);
    }
  }, [report, generatedAt]);
  
  // Set comparison report
  const setAsComparison = useCallback(() => {
    if (report) {
      setComparisonReport(report);
      setIsComparisonMode(true);
    }
  }, [report]);
  
  // Clear comparison
  const clearComparison = useCallback(() => {
    setComparisonReport(null);
    setIsComparisonMode(false);
  }, []);
  
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
      } catch {
        // Filter options fetch failed silently
      }
    }
    fetchFilterOptions();
  }, []);
  
  // Toggle filter selection - reserved for checkbox-style filters
  const _toggleFilter = useCallback((type: keyof FilterState, value: string) => {
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
      
      const reportData = {
        ...data.analysis,
        aiSummary: data.aiSummary,
      };
      
      setReport(reportData);
      setGeneratedAt(new Date().toISOString());
      
      // Add to history
      addToHistory(reportData);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }, [filters, addToHistory]);
  
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
      
    } catch {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-purple-600 text-white">
        <div className="max-w-[1600px] mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                <BarChart3 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">AI Report Builder</h1>
                <p className="text-violet-100 mt-0.5">
                  Generate intelligent insights across your contract portfolio
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Presets Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowPresetPanel(!showPresetPanel)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                Presets
                {savedPresets.length > 0 && (
                  <Badge className="ml-1 bg-white/20 text-white text-xs">{savedPresets.length}</Badge>
                )}
              </Button>
              
              {/* History Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <History className="h-4 w-4 mr-1" />
                History
              </Button>
              
              {/* Schedule Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowScheduleModal(true)}
                className={cn(
                  "bg-white/10 border-white/20 text-white hover:bg-white/20",
                  scheduleConfig.enabled && "bg-green-500/20 border-green-400/40"
                )}
              >
                <Bell className="h-4 w-4 mr-1" />
                Schedule
                {scheduleConfig.enabled && (
                  <CheckCircle className="h-3 w-3 ml-1" />
                )}
              </Button>
              
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
                className="bg-white text-violet-600 hover:bg-violet-50 shadow-lg font-semibold"
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
      
      {/* ============= PRESETS SLIDE-OUT PANEL ============= */}
      {showPresetPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPresetPanel(false)} />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="ml-auto w-full max-w-md bg-white shadow-2xl relative flex flex-col h-full"
          >
            <div className="p-6 border-b bg-gradient-to-r from-violet-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Saved Presets
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowPresetPanel(false)} className="text-white hover:bg-white/20">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-violet-100 text-sm mt-1">Save and reuse filter configurations</p>
            </div>
            
            {/* Save New Preset */}
            <div className="p-4 border-b bg-gray-50">
              <p className="text-sm font-medium text-gray-700 mb-2">Save Current Filters</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Preset name..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  onKeyDown={(e) => e.key === 'Enter' && saveCurrentPreset()}
                />
                <Button onClick={saveCurrentPreset} disabled={!newPresetName.trim()} size="sm">
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Presets List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {savedPresets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No saved presets yet</p>
                  <p className="text-sm">Save your first filter configuration above</p>
                </div>
              ) : (
                <>
                  {/* Favorites first */}
                  {savedPresets.filter(p => p.isFavorite).length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Favorites</p>
                      {savedPresets.filter(p => p.isFavorite).map(preset => (
                        <div key={preset.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                              <span className="font-medium text-gray-900">{preset.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => toggleFavorite(preset.id)} className="h-7 w-7 p-0">
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deletePreset(preset.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap mt-2">
                            {preset.filters.suppliers.map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                            {preset.filters.categories.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                            {preset.filters.years.map(y => <Badge key={y} variant="outline" className="text-xs">{y}</Badge>)}
                          </div>
                          <div className="mt-2 flex justify-between items-center">
                            <span className="text-xs text-gray-500">
                              {preset.lastUsed ? `Last used ${new Date(preset.lastUsed).toLocaleDateString()}` : 'Never used'}
                            </span>
                            <Button size="sm" variant="default" onClick={() => loadPreset(preset)} className="h-7 text-xs">
                              Load
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {/* Regular presets */}
                  {savedPresets.filter(p => !p.isFavorite).length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4">All Presets</p>
                      {savedPresets.filter(p => !p.isFavorite).map(preset => (
                        <div key={preset.id} className="p-3 bg-white border rounded-lg hover:border-violet-300 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{preset.name}</span>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => toggleFavorite(preset.id)} className="h-7 w-7 p-0 text-gray-400 hover:text-amber-500">
                                <StarOff className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deletePreset(preset.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap mt-2">
                            {preset.filters.suppliers.map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                            {preset.filters.categories.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                            {preset.filters.years.map(y => <Badge key={y} variant="outline" className="text-xs">{y}</Badge>)}
                            {Object.values(preset.filters).flat().length === 0 && <span className="text-xs text-gray-400">All contracts</span>}
                          </div>
                          <div className="mt-2 flex justify-between items-center">
                            <span className="text-xs text-gray-500">
                              Created {new Date(preset.createdAt).toLocaleDateString()}
                            </span>
                            <Button size="sm" variant="default" onClick={() => loadPreset(preset)} className="h-7 text-xs">
                              Load
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
      
      {/* ============= HISTORY SLIDE-OUT PANEL ============= */}
      {showHistoryPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowHistoryPanel(false)} />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="ml-auto w-full max-w-md bg-white shadow-2xl relative flex flex-col h-full"
          >
            <div className="p-6 border-b bg-gradient-to-r from-violet-500 to-pink-600 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Report History
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowHistoryPanel(false)} className="text-white hover:bg-white/20">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-violet-100 text-sm mt-1">View and restore previous reports</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {reportHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No report history yet</p>
                  <p className="text-sm">Generate your first report to start tracking history</p>
                </div>
              ) : (
                reportHistory.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-white border rounded-lg hover:border-violet-300 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">{new Date(item.generatedAt).toLocaleString()}</span>
                      {idx === 0 && <Badge className="bg-violet-100 text-violet-700 text-xs">Latest</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div className="p-2 bg-violet-50 rounded">
                        <p className="text-xs text-gray-500">Contracts</p>
                        <p className="font-bold text-violet-700">{item.summary.totalContracts}</p>
                      </div>
                      <div className="p-2 bg-green-50 rounded">
                        <p className="text-xs text-gray-500">Value</p>
                        <p className="font-bold text-green-700">{formatCurrency(item.summary.totalValue)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap mb-2">
                      {item.filters.suppliers.map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                      {item.filters.categories.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                      {Object.values(item.filters).flat().length === 0 && <span className="text-xs text-gray-400">All contracts</span>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => loadFromHistory(item)} className="w-full h-7 text-xs">
                      Restore Filters
                    </Button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
      
      {/* ============= SCHEDULE MODAL ============= */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowScheduleModal(false)} />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b bg-gradient-to-r from-violet-500 to-violet-600 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Schedule Reports
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowScheduleModal(false)} className="text-white hover:bg-white/20">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-green-100 text-sm mt-1">Automatically generate and email reports</p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900">Enable Scheduled Reports</p>
                  <p className="text-sm text-gray-500">Automatically generate reports on a schedule</p>
                </div>
                <button
                  onClick={() => setScheduleConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={cn(
                    "relative w-14 h-7 rounded-full transition-colors",
                    scheduleConfig.enabled ? "bg-green-500" : "bg-gray-300"
                  )}
                >
                  <div className={cn(
                    "absolute w-5 h-5 bg-white rounded-full top-1 transition-all shadow",
                    scheduleConfig.enabled ? "left-8" : "left-1"
                  )} />
                </button>
              </div>
              
              {scheduleConfig.enabled && (
                <>
                  {/* Frequency */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Frequency</p>
                    <div className="flex gap-2">
                      {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                        <button
                          key={freq}
                          onClick={() => setScheduleConfig(prev => ({ ...prev, frequency: freq }))}
                          className={cn(
                            "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
                            scheduleConfig.frequency === freq
                              ? "bg-violet-500 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          )}
                        >
                          {freq}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Day Selection (for weekly/monthly) */}
                  {scheduleConfig.frequency === 'weekly' && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Day of Week</p>
                      <div className="flex gap-1 flex-wrap">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                          <button
                            key={day}
                            onClick={() => setScheduleConfig(prev => ({ ...prev, dayOfWeek: idx }))}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                              scheduleConfig.dayOfWeek === idx
                                ? "bg-violet-500 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            )}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {scheduleConfig.frequency === 'monthly' && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Day of Month</p>
                      <select
                        value={scheduleConfig.dayOfMonth || 1}
                        onChange={(e) => setScheduleConfig(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {/* Time */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Time</p>
                    <input
                      type="time"
                      value={scheduleConfig.time}
                      onChange={(e) => setScheduleConfig(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  
                  {/* Email Recipients */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Email Recipients</p>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="email"
                        placeholder="Add email address..."
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEmailToSchedule()}
                        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <Button onClick={addEmailToSchedule} disabled={!newEmail.includes('@')} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {scheduleConfig.emails.map(email => (
                        <Badge key={email} className="bg-violet-100 text-violet-700 gap-1 pr-1">
                          <Mail className="h-3 w-3" />
                          {email}
                          <button onClick={() => removeEmailFromSchedule(email)} className="hover:text-red-600 ml-1">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {/* Export Options */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Include in Email</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleConfig.includePdf}
                          onChange={(e) => setScheduleConfig(prev => ({ ...prev, includePdf: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-700">PDF Report</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleConfig.includeExcel}
                          onChange={(e) => setScheduleConfig(prev => ({ ...prev, includeExcel: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-700">Excel Data</span>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
              <Button onClick={saveScheduleConfig} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Schedule
              </Button>
            </div>
          </motion.div>
        </div>
      )}
      
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
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
              <Badge key={s} className="bg-violet-100 text-violet-700 hover:bg-violet-200 gap-1.5 pl-2 pr-1 py-1">
                <Building2 className="h-3 w-3" />
                {s}
                <button onClick={() => removeFilter('suppliers', s)} className="ml-0.5 hover:text-red-600 rounded-full p-0.5 hover:bg-red-100">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {filters.categories.map(c => (
              <Badge key={c} className="bg-violet-100 text-violet-700 hover:bg-violet-200 gap-1.5 pl-2 pr-1 py-1">
                <FolderTree className="h-3 w-3" />
                {c}
                <button onClick={() => removeFilter('categories', c)} className="ml-0.5 hover:text-red-600 rounded-full p-0.5 hover:bg-red-100">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {filters.years.map(y => (
              <Badge key={y} className="bg-violet-100 text-violet-700 hover:bg-violet-200 gap-1.5 pl-2 pr-1 py-1">
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
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-violet-500" />
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
                className="bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg"
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
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center animate-pulse">
                <Loader2 className="h-10 w-10 text-white animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Generating AI Report...
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Analyzing contracts, calculating metrics, and generating insights. This may take a moment.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Report Results */}
        {report && !isGenerating && (
          <div className="space-y-6" ref={reportRef}>
            {/* Report Header with Actions */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Portfolio Analysis Report</h2>
                {generatedAt && (
                  <p className="text-sm text-gray-500">
                    Generated {new Date(generatedAt).toLocaleString()}
                  </p>
                )}
                {isComparisonMode && comparisonReport && (
                  <Badge className="mt-1 bg-violet-100 text-violet-700">
                    <GitCompare className="h-3 w-3 mr-1" />
                    Comparison Mode Active
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Comparison Button */}
                {!isComparisonMode ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={setAsComparison}
                    className="gap-2"
                    title="Set as baseline for comparison"
                  >
                    <GitCompare className="h-4 w-4" />
                    Compare
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearComparison}
                    className="gap-2 bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                  >
                    <X className="h-4 w-4" />
                    Clear Comparison
                  </Button>
                )}
                
                {/* Excel Export */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportToExcel}
                  disabled={isExporting}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export Excel
                </Button>
                
                {/* PDF Export */}
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
            
            {/* ============= COMPARISON SUMMARY (if in comparison mode) ============= */}
            {isComparisonMode && comparisonReport && (
              <Card className="border-2 border-violet-200 bg-violet-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-violet-800">
                    <GitCompare className="h-4 w-4" />
                    Comparison vs Previous Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-xs text-gray-500 mb-1">Contracts Change</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">
                          {report.summary.totalContracts - comparisonReport.summary.totalContracts >= 0 ? '+' : ''}
                          {report.summary.totalContracts - comparisonReport.summary.totalContracts}
                        </span>
                        {report.summary.totalContracts >= comparisonReport.summary.totalContracts ? (
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-xs text-gray-500 mb-1">Value Change</p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xl font-bold",
                          report.summary.totalValue >= comparisonReport.summary.totalValue ? "text-green-600" : "text-red-600"
                        )}>
                          {formatCurrency(Math.abs(report.summary.totalValue - comparisonReport.summary.totalValue))}
                        </span>
                        {report.summary.totalValue >= comparisonReport.summary.totalValue ? (
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-xs text-gray-500 mb-1">Health Score</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">
                          {report.summary.healthScore - comparisonReport.summary.healthScore >= 0 ? '+' : ''}
                          {report.summary.healthScore - comparisonReport.summary.healthScore}
                        </span>
                        {report.summary.healthScore >= comparisonReport.summary.healthScore ? (
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-xs text-gray-500 mb-1">Risk Score</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">
                          {report.summary.riskScore - comparisonReport.summary.riskScore >= 0 ? '+' : ''}
                          {report.summary.riskScore - comparisonReport.summary.riskScore}
                        </span>
                        {report.summary.riskScore <= comparisonReport.summary.riskScore ? (
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
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
                  <div className="flex flex-col items-center p-6 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100">
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
                        <span className="text-3xl font-bold text-violet-600">{report.summary.healthScore || 0}</span>
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Health Score</h4>
                    <p className="text-sm text-gray-500 text-center mt-1">Overall portfolio health based on renewal rates, value distribution, and risk factors</p>
                  </div>
                  
                  <div className="flex flex-col items-center p-6 bg-gradient-to-br from-violet-50 to-violet-50 rounded-2xl border border-green-100">
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
              <Card className="border-0 shadow-md bg-gradient-to-br from-violet-500 to-purple-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold">{report.summary.totalContracts}</p>
                      <p className="text-violet-100 text-sm mt-1">Total Contracts</p>
                    </div>
                    <div className="p-2 bg-white/20 rounded-lg">
                      <FileText className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md bg-gradient-to-br from-violet-500 to-violet-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold">{formatCurrency(report.summary.totalValue)}</p>
                      <p className="text-violet-100 text-sm mt-1">Total Value</p>
                    </div>
                    <div className="p-2 bg-white/20 rounded-lg">
                      <DollarSign className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-md bg-gradient-to-br from-violet-500 to-purple-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-bold">{report.summary.averageDurationMonths}<span className="text-lg">mo</span></p>
                      <p className="text-violet-100 text-sm mt-1">Avg Duration</p>
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
                <CardHeader className="bg-gradient-to-r from-violet-50 via-purple-50 to-purple-50 border-b">
                  <CardTitle className="flex items-center gap-2 text-gray-800">
                    <div className="p-1.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    AI Executive Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  <div 
                    className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: formatAIContent(report.aiSummary)
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
                      const _priorityConfig = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.medium;
                      
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
                              rec.type === 'cost' && "bg-violet-100",
                              rec.type === 'risk' && "bg-red-100",
                              rec.type === 'compliance' && "bg-violet-100",
                              rec.type === 'efficiency' && "bg-violet-100",
                              rec.type === 'strategic' && "bg-amber-100"
                            )}>
                              <TypeIcon className={cn(
                                "h-5 w-5",
                                rec.type === 'cost' && "text-violet-600",
                                rec.type === 'risk' && "text-red-600",
                                rec.type === 'compliance' && "text-violet-600",
                                rec.type === 'efficiency' && "text-violet-600",
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
                                <span className="flex items-center gap-1 text-violet-600 font-medium">
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
                    <div className="p-1.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
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
                                  "bg-violet-50 text-violet-600"
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
                              <span className="text-violet-600 font-medium">{supplier.activeCount}</span>
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
                                <span className="flex items-center justify-center text-violet-600">
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
                      <LineChart className="h-4 w-4 text-violet-500" />
                      Portfolio Trends
                    </CardTitle>
                    <CardDescription>Quarterly value and contract volume trends</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Value by Quarter</p>
                        <div className="flex items-end gap-2 h-32">
                          {report.trends.valueByQuarter.map((trend, _idx) => {
                            const maxValue = Math.max(...report.trends.valueByQuarter.map(t => t.value));
                            const height = maxValue > 0 ? (trend.value / maxValue) * 100 : 0;
                            return (
                              <TooltipProvider key={trend.period}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex-1 flex flex-col items-center gap-1">
                                      <div 
                                        className="w-full bg-gradient-to-t from-violet-500 to-purple-500 rounded-t-md transition-all hover:from-violet-600 hover:to-purple-600"
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
                            <span className="text-lg font-bold text-violet-600">{report.trends.renewalRate}%</span>
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
                      <Target className="h-4 w-4 text-violet-500" />
                      Industry Benchmarks
                    </CardTitle>
                    <CardDescription>Your portfolio vs industry standards</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {report.benchmarks.map((benchmark, _idx) => (
                        <div key={benchmark.metric} className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700 truncate">{benchmark.metric}</span>
                              <div className="flex items-center gap-2">
                                <Badge className={cn(
                                  "text-[10px]",
                                  benchmark.status === 'excellent' && "bg-violet-100 text-violet-700",
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
                                  benchmark.percentile >= 75 ? "bg-violet-500" :
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
                    <PieChart className="h-4 w-4 text-violet-500" />
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
                            className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full transition-all duration-500"
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
                    <Clock className="h-4 w-4 text-violet-500" />
                    Duration Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-violet-50 rounded-xl">
                      <p className="text-2xl font-bold text-violet-700">{report.summary.shortestDurationMonths}</p>
                      <p className="text-xs text-violet-600 mt-1">Shortest (mo)</p>
                    </div>
                    <div className="text-center p-4 bg-violet-100 rounded-xl">
                      <p className="text-2xl font-bold text-violet-800">{report.summary.averageDurationMonths}</p>
                      <p className="text-xs text-violet-700 mt-1">Average (mo)</p>
                    </div>
                    <div className="text-center p-4 bg-violet-50 rounded-xl">
                      <p className="text-2xl font-bold text-violet-700">{report.summary.longestDurationMonths}</p>
                      <p className="text-xs text-violet-600 mt-1">Longest (mo)</p>
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
                  <div className="text-center p-4 bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl border border-violet-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-violet-500 rounded-full flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-violet-600">{report.riskAnalysis.highValueAtRisk}</p>
                    <p className="text-[10px] text-violet-500 mt-1 font-medium">High-Value Risk</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl border border-rose-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-rose-500 rounded-full flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-rose-600">{report.riskAnalysis.overdueContracts || 0}</p>
                    <p className="text-[10px] text-rose-500 mt-1 font-medium">Overdue</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl border border-violet-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-violet-500 rounded-full flex items-center justify-center">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-violet-600">{report.riskAnalysis.missingCriticalData || 0}</p>
                    <p className="text-[10px] text-violet-500 mt-1 font-medium">Missing Data</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-violet-50 to-purple-100 rounded-xl border border-indigo-200">
                    <div className="w-10 h-10 mx-auto mb-2 bg-violet-500 rounded-full flex items-center justify-center">
                      <Layers className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-violet-600">{report.riskAnalysis.concentrationRisk || 0}%</p>
                    <p className="text-[10px] text-violet-500 mt-1 font-medium">Concentration</p>
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
                    <FileText className="h-4 w-4 text-violet-500" />
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
                                        <RefreshCw className="h-3.5 w-3.5 text-violet-500" />
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
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:bg-violet-50 hover:text-violet-600">
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
      <style>{`
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
