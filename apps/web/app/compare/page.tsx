"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Search,
  X,
  FileText,
  DollarSign,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  Building2,
  Scale,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Loader2,
  ExternalLink,
  Plus,
  Filter,
  Sparkles,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// Types
interface Contract {
  id: string;
  contractTitle: string;
  supplierName: string;
  status: string;
  totalValue: number;
  annualValue: number;
  effectiveDate: string | null;
  expirationDate: string | null;
  categoryL1: string | null;
  categoryL2: string | null;
  paymentTerms: string | null;
  paymentFrequency: string | null;
  autoRenewalEnabled: boolean;
  noticePeriodDays: number | null;
  currency: string | null;
  contractType: string | null;
}

interface GroupComparisonResult {
  group1: {
    name: string;
    contracts: Contract[];
    totalValue: number;
    avgValue: number;
    count: number;
  };
  group2: {
    name: string;
    contracts: Contract[];
    totalValue: number;
    avgValue: number;
    count: number;
  };
  differences: Array<{
    field: string;
    label: string;
    value1: string | number;
    value2: string | number;
    analysis: string;
    advantage?: "group1" | "group2" | "neutral";
  }>;
  keyInsights: string[];
  recommendation: string;
}

// Utility functions
const formatCurrency = (value: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const calculateDaysUntil = (dateStr: string | null) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const getYear = (dateStr: string | null): string => {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).getFullYear().toString();
};

// Multi-Select Contract Group Component
function ContractGroupSelector({
  label,
  colorClass,
  contracts,
  selectedContracts,
  onSelectionChange,
  supplierFilter,
  onSupplierFilterChange,
  yearFilter,
  onYearFilterChange,
  availableSuppliers,
  availableYears,
  isLoading,
}: {
  label: string;
  colorClass: string;
  contracts: Contract[];
  selectedContracts: Contract[];
  onSelectionChange: (contracts: Contract[]) => void;
  supplierFilter: string;
  onSupplierFilterChange: (value: string) => void;
  yearFilter: string;
  onYearFilterChange: (value: string) => void;
  availableSuppliers: string[];
  availableYears: string[];
  isLoading: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter contracts based on supplier, year, and search
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const matchesSupplier = !supplierFilter || supplierFilter === "all" || c.supplierName === supplierFilter;
      const matchesYear = !yearFilter || yearFilter === "all" || getYear(c.effectiveDate) === yearFilter;
      const matchesSearch = !searchQuery || 
        c.contractTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.supplierName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSupplier && matchesYear && matchesSearch;
    });
  }, [contracts, supplierFilter, yearFilter, searchQuery]);

  const toggleContract = (contract: Contract) => {
    const isSelected = selectedContracts.some((c) => c.id === contract.id);
    if (isSelected) {
      onSelectionChange(selectedContracts.filter((c) => c.id !== contract.id));
    } else {
      onSelectionChange([...selectedContracts, contract]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredContracts);
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const totalValue = selectedContracts.reduce((sum, c) => sum + (c.totalValue || 0), 0);

  return (
    <Card className={`flex-1 border-2 ${colorClass}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {label}
          </span>
          {selectedContracts.length > 0 && (
            <Badge variant="secondary">
              {selectedContracts.length} selected • {formatCurrency(totalValue)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={supplierFilter} onValueChange={onSupplierFilterChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {availableSuppliers.map((supplier) => (
                <SelectItem key={supplier} value={supplier}>
                  {supplier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={onYearFilterChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contracts..."
            className="pl-10 h-9"
          />
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll} className="flex-1">
            <Plus className="w-3 h-3 mr-1" />
            Select All ({filteredContracts.length})
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} className="flex-1">
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>

        {/* Contract list */}
        <ScrollArea className="h-[280px] border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">
              No contracts match filters
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredContracts.map((contract) => {
                const isSelected = selectedContracts.some((c) => c.id === contract.id);
                return (
                  <button
                    key={contract.id}
                    onClick={() => toggleContract(contract)}
                    className={`w-full text-left p-2 rounded-lg border transition-all ${
                      isSelected
                        ? "bg-blue-50 border-blue-300"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox checked={isSelected} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {contract.contractTitle}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {contract.supplierName} • {formatCurrency(contract.totalValue)} • {getYear(contract.effectiveDate)}
                        </p>
                      </div>
                      <Badge variant={contract.status === "ACTIVE" ? "default" : "secondary"} className="text-xs flex-shrink-0">
                        {contract.status}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Comparison Field Row (updated for group comparison)
function ComparisonRow({
  label,
  value1,
  value2,
  icon: Icon,
  highlight,
  advantage,
}: {
  label: string;
  value1: React.ReactNode;
  value2: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  advantage?: "group1" | "group2" | "neutral";
}) {
  return (
    <TableRow className={highlight ? "bg-yellow-50" : ""}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
          {label}
        </div>
      </TableCell>
      <TableCell className={advantage === "group1" ? "bg-green-50" : ""}>
        <div className="flex items-center gap-2">
          {value1}
          {advantage === "group1" && <TrendingUp className="w-4 h-4 text-green-500" />}
        </div>
      </TableCell>
      <TableCell className={advantage === "group2" ? "bg-green-50" : ""}>
        <div className="flex items-center gap-2">
          {value2}
          {advantage === "group2" && <TrendingUp className="w-4 h-4 text-green-500" />}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ContractComparisonPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State - Multi-contract selection
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(true);
  
  // Group 1 state
  const [group1Contracts, setGroup1Contracts] = useState<Contract[]>([]);
  const [group1Supplier, setGroup1Supplier] = useState<string>("all");
  const [group1Year, setGroup1Year] = useState<string>("all");
  
  // Group 2 state
  const [group2Contracts, setGroup2Contracts] = useState<Contract[]>([]);
  const [group2Supplier, setGroup2Supplier] = useState<string>("all");
  const [group2Year, setGroup2Year] = useState<string>("all");
  
  const [comparison, setComparison] = useState<GroupComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    financial: true,
    contracts: true,
    risk: true,
  });

  // Derive available suppliers and years
  const availableSuppliers = useMemo(() => {
    const suppliers = new Set(contracts.map((c) => c.supplierName).filter(Boolean));
    return Array.from(suppliers).sort();
  }, [contracts]);

  const availableYears = useMemo(() => {
    const years = new Set(contracts.map((c) => getYear(c.effectiveDate)).filter((y) => y !== "Unknown"));
    return Array.from(years).sort().reverse();
  }, [contracts]);

  // Load contracts list
  useEffect(() => {
    async function loadContracts() {
      try {
        const response = await fetch("/api/contracts?limit=500");
        if (response.ok) {
          const data = await response.json();
          // Handle nested data structure from API
          const contractsList = data.data?.contracts || data.contracts || [];
          setContracts(contractsList);
        }
      } catch (error) {
        console.error("Failed to load contracts:", error);
      } finally {
        setIsLoadingContracts(false);
      }
    }
    loadContracts();
  }, []);

  // AI-powered comparison analysis
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Build group comparison with AI analysis
  const performComparison = useCallback(async () => {
    if (group1Contracts.length === 0 || group2Contracts.length === 0) return;
    
    setIsComparing(true);
    
    // Calculate group statistics
    const calcGroupStats = (contracts: Contract[], name: string) => ({
      name,
      contracts,
      count: contracts.length,
      totalValue: contracts.reduce((sum, c) => sum + (c.totalValue || 0), 0),
      avgValue: contracts.length > 0 
        ? contracts.reduce((sum, c) => sum + (c.totalValue || 0), 0) / contracts.length 
        : 0,
      activeCount: contracts.filter((c) => c.status === "ACTIVE").length,
      avgDuration: contracts.length > 0 ? calcAvgDuration(contracts) : 0,
      autoRenewalCount: contracts.filter((c) => c.autoRenewalEnabled).length,
    });

    const calcAvgDuration = (contracts: Contract[]) => {
      const durations = contracts
        .filter((c) => c.effectiveDate && c.expirationDate)
        .map((c) => {
          const start = new Date(c.effectiveDate!);
          const end = new Date(c.expirationDate!);
          return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
        });
      return durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    };

    // Get group names based on filters
    const getGroupName = (supplier: string, year: string, contracts: Contract[]) => {
      if (supplier && supplier !== "all" && year && year !== "all") {
        return `${supplier} (${year})`;
      } else if (supplier && supplier !== "all") {
        return supplier;
      } else if (year && year !== "all") {
        return `Contracts (${year})`;
      } else {
        const suppliers = new Set(contracts.map((c) => c.supplierName));
        if (suppliers.size === 1) return Array.from(suppliers)[0];
        return `Group (${contracts.length} contracts)`;
      }
    };

    const group1Name = getGroupName(group1Supplier, group1Year, group1Contracts);
    const group2Name = getGroupName(group2Supplier, group2Year, group2Contracts);

    const stats1 = calcGroupStats(group1Contracts, group1Name);
    const stats2 = calcGroupStats(group2Contracts, group2Name);

    const differences: GroupComparisonResult["differences"] = [];
    const keyInsights: string[] = [];

    // Total value comparison
    const valueDiff = stats1.totalValue - stats2.totalValue;
    const valuePct = stats2.totalValue > 0 ? Math.round((valueDiff / stats2.totalValue) * 100) : 0;
    differences.push({
      field: "totalValue",
      label: "Total Contract Value",
      value1: formatCurrency(stats1.totalValue),
      value2: formatCurrency(stats2.totalValue),
      analysis: valueDiff !== 0 ? `${Math.abs(valuePct)}% ${valueDiff > 0 ? "higher" : "lower"}` : "Equal",
      advantage: valueDiff < 0 ? "group1" : valueDiff > 0 ? "group2" : "neutral",
    });

    // Average value comparison
    const avgDiff = stats1.avgValue - stats2.avgValue;
    const avgPct = stats2.avgValue > 0 ? Math.round((avgDiff / stats2.avgValue) * 100) : 0;
    differences.push({
      field: "avgValue",
      label: "Average Contract Value",
      value1: formatCurrency(stats1.avgValue),
      value2: formatCurrency(stats2.avgValue),
      analysis: avgDiff !== 0 ? `${Math.abs(avgPct)}% ${avgDiff > 0 ? "higher" : "lower"}` : "Equal",
      advantage: avgDiff < 0 ? "group1" : avgDiff > 0 ? "group2" : "neutral",
    });

    // Contract count
    differences.push({
      field: "count",
      label: "Number of Contracts",
      value1: stats1.count,
      value2: stats2.count,
      analysis: `${Math.abs(stats1.count - stats2.count)} difference`,
    });

    // Active contracts
    differences.push({
      field: "activeCount",
      label: "Active Contracts",
      value1: `${stats1.activeCount} of ${stats1.count}`,
      value2: `${stats2.activeCount} of ${stats2.count}`,
      analysis: "Contract status breakdown",
    });

    // Key insights
    if (Math.abs(valueDiff) > 500000) {
      keyInsights.push(`💰 Significant value difference of ${formatCurrency(Math.abs(valueDiff))} between groups`);
    }

    if (Math.abs(avgPct) > 30) {
      keyInsights.push(`📊 Average contract value differs by ${Math.abs(avgPct)}%`);
    }

    // Check for expiring contracts
    const expiring1 = group1Contracts.filter((c) => {
      const days = calculateDaysUntil(c.expirationDate);
      return days !== null && days <= 90;
    });
    const expiring2 = group2Contracts.filter((c) => {
      const days = calculateDaysUntil(c.expirationDate);
      return days !== null && days <= 90;
    });

    if (expiring1.length > 0) {
      keyInsights.push(`⚠️ ${stats1.name}: ${expiring1.length} contract(s) expiring within 90 days`);
    }
    if (expiring2.length > 0) {
      keyInsights.push(`⚠️ ${stats2.name}: ${expiring2.length} contract(s) expiring within 90 days`);
    }

    setComparison({
      group1: stats1,
      group2: stats2,
      differences,
      keyInsights,
      recommendation: keyInsights.length > 0
        ? "Review highlighted insights for potential optimization opportunities"
        : "Both contract groups have similar characteristics",
    });

    // Trigger AI analysis
    setIsAiAnalyzing(true);
    try {
      const aiResponse = await fetch("/api/ai/compare-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group1: {
            name: stats1.name,
            contracts: group1Contracts.map(c => ({
              title: c.contractTitle,
              supplier: c.supplierName,
              value: c.totalValue,
              effectiveDate: c.effectiveDate,
              expirationDate: c.expirationDate,
              category: c.categoryL1,
              paymentTerms: c.paymentTerms,
            })),
            totalValue: stats1.totalValue,
            avgValue: stats1.avgValue,
          },
          group2: {
            name: stats2.name,
            contracts: group2Contracts.map(c => ({
              title: c.contractTitle,
              supplier: c.supplierName,
              value: c.totalValue,
              effectiveDate: c.effectiveDate,
              expirationDate: c.expirationDate,
              category: c.categoryL1,
              paymentTerms: c.paymentTerms,
            })),
            totalValue: stats2.totalValue,
            avgValue: stats2.avgValue,
          },
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        setAiAnalysis(aiData.analysis || aiData.data?.analysis);
      } else {
        // Generate fallback analysis
        setAiAnalysis(generateFallbackAnalysis(stats1, stats2, keyInsights));
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
      setAiAnalysis(generateFallbackAnalysis(stats1, stats2, keyInsights));
    } finally {
      setIsAiAnalyzing(false);
    }

    setIsComparing(false);
  }, [group1Contracts, group2Contracts, group1Supplier, group1Year, group2Supplier, group2Year]);

  // Fallback analysis when AI is not available
  const generateFallbackAnalysis = (stats1: any, stats2: any, insights: string[]) => {
    const valueDiff = stats1.totalValue - stats2.totalValue;
    const percentDiff = stats2.totalValue > 0 ? Math.round((Math.abs(valueDiff) / stats2.totalValue) * 100) : 0;
    
    let analysis = `## Contract Group Comparison Analysis\n\n`;
    analysis += `### Overview\n`;
    analysis += `**${stats1.name}** includes ${stats1.count} contract(s) with a total value of ${formatCurrency(stats1.totalValue)}.\n`;
    analysis += `**${stats2.name}** includes ${stats2.count} contract(s) with a total value of ${formatCurrency(stats2.totalValue)}.\n\n`;
    
    if (Math.abs(percentDiff) > 20) {
      analysis += `### Key Finding\n`;
      analysis += `There is a **${percentDiff}% difference** in total contract value between the two groups. `;
      analysis += valueDiff > 0 
        ? `${stats1.name} has higher total spend.\n\n`
        : `${stats2.name} has higher total spend.\n\n`;
    }
    
    if (insights.length > 0) {
      analysis += `### Action Items\n`;
      insights.forEach(insight => {
        analysis += `- ${insight.replace(/^[⚠️💰📊🔔]+\s*/, '')}\n`;
      });
      analysis += `\n`;
    }
    
    analysis += `### Recommendations\n`;
    analysis += `1. Review contracts expiring within the next 90 days for renewal opportunities\n`;
    analysis += `2. Compare payment terms and conditions between suppliers\n`;
    analysis += `3. Consider consolidating similar contracts for better negotiating leverage\n`;
    
    return analysis;
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const swapGroups = () => {
    const tempContracts = group1Contracts;
    const tempSupplier = group1Supplier;
    const tempYear = group1Year;
    setGroup1Contracts(group2Contracts);
    setGroup1Supplier(group2Supplier);
    setGroup1Year(group2Year);
    setGroup2Contracts(tempContracts);
    setGroup2Supplier(tempSupplier);
    setGroup2Year(tempYear);
  };

  const canCompare = group1Contracts.length > 0 && group2Contracts.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Contract Group Comparison</h1>
                <p className="text-sm text-gray-500">Compare multiple contracts side-by-side (e.g., Deloitte 2024 vs EY 2024)</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {canCompare && (
                <Button onClick={performComparison} disabled={isComparing}>
                  {isComparing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Scale className="w-4 h-4 mr-2" />
                      Compare Groups
                    </>
                  )}
                </Button>
              )}
              {comparison && (
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Contract Group Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Select Contract Groups to Compare
            </CardTitle>
            <CardDescription>
              Use filters to select groups of contracts (e.g., all Deloitte contracts from 2024 vs all EY contracts from 2024)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-stretch">
              <ContractGroupSelector
                label="Group A"
                colorClass="border-blue-300"
                contracts={contracts}
                selectedContracts={group1Contracts}
                onSelectionChange={setGroup1Contracts}
                supplierFilter={group1Supplier}
                onSupplierFilterChange={setGroup1Supplier}
                yearFilter={group1Year}
                onYearFilterChange={setGroup1Year}
                availableSuppliers={availableSuppliers}
                availableYears={availableYears}
                isLoading={isLoadingContracts}
              />

              <div className="flex flex-col items-center justify-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={swapGroups}
                        disabled={group1Contracts.length === 0 && group2Contracts.length === 0}
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Swap groups</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-xs text-gray-400">VS</span>
              </div>

              <ContractGroupSelector
                label="Group B"
                colorClass="border-purple-300"
                contracts={contracts}
                selectedContracts={group2Contracts}
                onSelectionChange={setGroup2Contracts}
                supplierFilter={group2Supplier}
                onSupplierFilterChange={setGroup2Supplier}
                yearFilter={group2Year}
                onYearFilterChange={setGroup2Year}
                availableSuppliers={availableSuppliers}
                availableYears={availableYears}
                isLoading={isLoadingContracts}
              />
            </div>

            {/* Compare Button - Prominent placement */}
            <div className="flex justify-center pt-6 border-t mt-6">
              <Button 
                size="lg"
                onClick={performComparison} 
                disabled={!canCompare || isComparing || isAiAnalyzing}
                className="px-8 py-3 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isComparing || isAiAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isAiAnalyzing ? "AI Analyzing..." : "Comparing..."}
                  </>
                ) : (
                  <>
                    <Scale className="w-5 h-5 mr-2" />
                    Compare Groups with AI Analysis
                  </>
                )}
              </Button>
            </div>
            {!canCompare && (
              <p className="text-center text-sm text-gray-500 mt-2">
                Select at least one contract in each group to compare
              </p>
            )}
          </CardContent>
        </Card>

        {/* Loading State */}
        {isComparing && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-500">Analyzing contract groups...</p>
            </div>
          </div>
        )}

        {/* Comparison Results */}
        {comparison && !isComparing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Key Insights */}
            {comparison.keyInsights.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-amber-900 mb-2">Key Insights</h3>
                      <ul className="space-y-1">
                        {comparison.keyInsights.map((insight, i) => (
                          <li key={i} className="text-sm text-amber-800">{insight}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Analysis Section */}
            {(aiAnalysis || isAiAnalyzing) && (
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    AI-Powered Analysis
                    {isAiAnalyzing && (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-600 ml-2" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    Intelligent comparison insights powered by AI
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isAiAnalyzing ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Generating AI analysis...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      {aiAnalysis?.split('\n').map((line, i) => {
                        if (line.startsWith('## ')) {
                          return <h2 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2">{line.replace('## ', '')}</h2>;
                        } else if (line.startsWith('### ')) {
                          return <h3 key={i} className="text-base font-semibold text-gray-800 mt-3 mb-1">{line.replace('### ', '')}</h3>;
                        } else if (line.startsWith('- ')) {
                          return <li key={i} className="text-gray-700 ml-4">{line.replace('- ', '')}</li>;
                        } else if (line.match(/^\d+\. /)) {
                          return <li key={i} className="text-gray-700 ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
                        } else if (line.trim()) {
                          return <p key={i} className="text-gray-700 mb-2">{line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>;
                        }
                        return null;
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Group Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-blue-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {comparison.group1.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Contracts:</span>
                    <span className="font-medium">{comparison.group1.count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Value:</span>
                    <span className="font-medium">{formatCurrency(comparison.group1.totalValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Avg Value:</span>
                    <span className="font-medium">{formatCurrency(comparison.group1.avgValue)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-purple-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {comparison.group2.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Contracts:</span>
                    <span className="font-medium">{comparison.group2.count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Value:</span>
                    <span className="font-medium">{formatCurrency(comparison.group2.totalValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Avg Value:</span>
                    <span className="font-medium">{formatCurrency(comparison.group2.avgValue)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Differences Summary */}
            {comparison.differences.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Scale className="w-5 h-5 text-orange-500" />
                    Comparison Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/4">Metric</TableHead>
                        <TableHead className="w-[30%]">{comparison.group1.name}</TableHead>
                        <TableHead className="w-[30%]">{comparison.group2.name}</TableHead>
                        <TableHead className="w-[15%]">Analysis</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparison.differences.map((diff, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{diff.label}</TableCell>
                          <TableCell className={diff.advantage === "group1" ? "bg-green-50" : ""}>
                            <div className="flex items-center gap-2">
                              {diff.value1}
                              {diff.advantage === "group1" && <TrendingUp className="w-4 h-4 text-green-500" />}
                            </div>
                          </TableCell>
                          <TableCell className={diff.advantage === "group2" ? "bg-green-50" : ""}>
                            <div className="flex items-center gap-2">
                              {diff.value2}
                              {diff.advantage === "group2" && <TrendingUp className="w-4 h-4 text-green-500" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {diff.analysis}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Contract Lists */}
            <Collapsible open={expandedSections.contracts} onOpenChange={() => toggleSection("contracts")}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        Included Contracts
                      </CardTitle>
                      {expandedSections.contracts ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-blue-800 mb-2">{comparison.group1.name}</h4>
                        <div className="space-y-1 max-h-48 overflow-auto">
                          {comparison.group1.contracts.map((c) => (
                            <Link 
                              key={c.id} 
                              href={`/contracts/${c.id}`}
                              className="block text-sm p-2 rounded hover:bg-blue-50 transition-colors"
                            >
                              <span className="text-blue-600 hover:underline">{c.contractTitle}</span>
                              <span className="text-gray-400 ml-2">• {formatCurrency(c.totalValue)}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-purple-800 mb-2">{comparison.group2.name}</h4>
                        <div className="space-y-1 max-h-48 overflow-auto">
                          {comparison.group2.contracts.map((c) => (
                            <Link 
                              key={c.id} 
                              href={`/contracts/${c.id}`}
                              className="block text-sm p-2 rounded hover:bg-purple-50 transition-colors"
                            >
                              <span className="text-purple-600 hover:underline">{c.contractTitle}</span>
                              <span className="text-gray-400 ml-2">• {formatCurrency(c.totalValue)}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Recommendation */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900 mb-1">Recommendation</h3>
                    <p className="text-sm text-blue-800">{comparison.recommendation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Empty State */}
        {!comparison && !isComparing && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Brain className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">AI-Powered Contract Comparison</h3>
            <p className="text-gray-600 max-w-lg mx-auto mb-6">
              Select contracts in Group A and Group B above, then click 
              <span className="font-semibold text-purple-600"> &quot;Compare Groups with AI Analysis&quot; </span>
              to get intelligent insights comparing values, terms, and identifying optimization opportunities.
            </p>
            <div className="flex justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                <span>Group A (Blue)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                <span>Group B (Purple)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
