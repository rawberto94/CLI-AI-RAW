/**
 * Enhanced Contracts List Page
 * Integrated filters, bulk selection, cross-module actions
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageBreadcrumb } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { NoContracts, NoResults } from "@/components/ui/empty-states";
import { AdvancedSearchModal, type AdvancedSearchFilters } from "@/components/contracts/AdvancedSearchModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  FileText,
  Search,
  Eye,
  Upload,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  DollarSign,
  Shield,
  RefreshCw,
  Filter,
  TrendingUp,
  ArrowUpRight,
  MoreHorizontal,
  Download,
  Trash2,
  Share2,
  Brain,
  GitCompare,
  Bell,
  ClipboardCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDataMode } from "@/contexts/DataModeContext";
import { useContracts, useCrossModuleInvalidation, type Contract } from "@/hooks/use-queries";
import { toast } from "sonner";
import { ShareDialog } from "@/components/collaboration/ShareDialog";
import { SubmitForApprovalModal } from "@/components/collaboration/SubmitForApprovalModal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Filter configuration
const CONTRACT_TYPES = [
  "Service Agreement",
  "NDA",
  "Employment",
  "Lease",
  "Vendor Agreement",
  "Consulting",
  "License",
  "Partnership",
];

const RISK_LEVELS = [
  { value: "low", label: "Low Risk", range: [0, 30] },
  { value: "medium", label: "Medium Risk", range: [30, 70] },
  { value: "high", label: "High Risk", range: [70, 100] },
];

const APPROVAL_STATUSES = [
  { value: "pending", label: "Pending Approval", icon: Clock, color: "text-amber-600" },
  { value: "approved", label: "Approved", icon: CheckCircle, color: "text-green-600" },
  { value: "rejected", label: "Rejected", icon: AlertTriangle, color: "text-red-600" },
  { value: "none", label: "No Approval", icon: FileText, color: "text-slate-500" },
];

export default function ContractsPage() {
  const router = useRouter();
  const { dataMode } = useDataMode();
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [riskFilters, setRiskFilters] = useState<string[]>([]);
  const [approvalFilters, setApprovalFilters] = useState<string[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({});
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  
  // Bulk selection state
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareContractId, setShareContractId] = useState<string | null>(null);
  const [shareContractTitle, setShareContractTitle] = useState<string>("");
  
  // Approval modal state
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalContractId, setApprovalContractId] = useState<string | null>(null);
  const [approvalContractTitle, setApprovalContractTitle] = useState<string>("");
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<{ id: string; title: string } | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Use React Query for data fetching with caching
  const { 
    data: contractsData, 
    isLoading: loading, 
    refetch,
    error 
  } = useContracts({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  
  const crossModule = useCrossModuleInvalidation();

  const contracts: Contract[] = contractsData?.contracts || [];
  
  // Toggle selection for a single contract
  const toggleSelect = useCallback((contractId: string) => {
    setSelectedContracts(prev => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      return next;
    });
  }, []);

  // Select/deselect all visible contracts
  const toggleSelectAll = useCallback(() => {
    const visibleIds = filteredContracts.map(c => c.id);
    setSelectedContracts(prev => {
      const allSelected = visibleIds.every(id => prev.has(id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(visibleIds);
      }
    });
  }, []);

  // Bulk operations
  const performBulkAction = async (action: 'export' | 'analyze' | 'delete' | 'share') => {
    if (selectedContracts.size === 0) return;
    
    setIsProcessingBulk(true);
    try {
      const response = await fetch('/api/contracts/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-data-mode': dataMode,
          'x-tenant-id': 'demo',
        },
        body: JSON.stringify({
          operation: action,
          contractIds: Array.from(selectedContracts),
        }),
      });

      if (!response.ok) throw new Error('Operation failed');
      
      const result = await response.json();
      toast.success(`Successfully ${action}ed ${selectedContracts.size} contracts`);
      
      if (action === 'delete') {
        refetch();
      }
      
      setSelectedContracts(new Set());
    } catch (error) {
      console.error('Bulk operation error:', error);
      toast.error(`Failed to ${action} contracts`);
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilters([]);
    setRiskFilters([]);
    setApprovalFilters([]);
    setAdvancedFilters({});
  }, []);

  // Contract action handlers
  const handleDownload = useCallback(async (contractId: string, format: 'json' | 'csv' | 'pdf' = 'pdf') => {
    try {
      toast.info('Preparing download...');
      const response = await fetch(`/api/contracts/${contractId}/export?format=${format}`, {
        headers: { 'x-tenant-id': 'demo' },
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract-${contractId}.${format === 'pdf' ? 'html' : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download contract');
    }
  }, []);

  const handleShare = useCallback((contractId: string, contractTitle: string) => {
    setShareContractId(contractId);
    setShareContractTitle(contractTitle);
    setShareDialogOpen(true);
  }, []);

  const handleRequestApproval = useCallback((contractId: string, contractTitle: string) => {
    setApprovalContractId(contractId);
    setApprovalContractTitle(contractTitle);
    setApprovalModalOpen(true);
  }, []);
  
  const handleApprovalSuccess = useCallback(() => {
    toast.success('Contract submitted for approval', {
      description: `${approvalContractTitle} has been sent for review`,
    });
    setApprovalModalOpen(false);
    setApprovalContractId(null);
    setApprovalContractTitle("");
    refetch();
  }, [approvalContractTitle, refetch]);

  // Open delete confirmation dialog
  const handleDeleteClick = useCallback((contractId: string, contractTitle: string) => {
    setContractToDelete({ id: contractId, title: contractTitle });
    setDeleteDialogOpen(true);
  }, []);

  // Confirm single delete
  const handleConfirmDelete = useCallback(async () => {
    if (!contractToDelete) return;
    
    try {
      toast.info('Deleting contract...');
      const response = await fetch(`/api/contracts/${contractToDelete.id}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': 'demo' },
      });

      if (!response.ok) throw new Error('Delete failed');
      
      // Invalidate related caches
      crossModule.onContractChange(contractToDelete.id);
      
      toast.success('Contract deleted successfully');
      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete contract');
    } finally {
      setContractToDelete(null);
    }
  }, [contractToDelete, crossModule, refetch]);

  // Bulk delete handler
  const handleBulkDeleteClick = useCallback(() => {
    if (selectedContracts.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedContracts.size]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (selectedContracts.size === 0) return;
    
    setIsProcessingBulk(true);
    try {
      const deletePromises = Array.from(selectedContracts).map(id =>
        fetch(`/api/contracts/${id}`, {
          method: 'DELETE',
          headers: { 'x-tenant-id': 'demo' },
        })
      );
      
      await Promise.all(deletePromises);
      
      // Invalidate all related caches
      crossModule.onContractChange();
      
      toast.success(`Deleted ${selectedContracts.size} contracts`);
      setSelectedContracts(new Set());
      refetch();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete some contracts');
    } finally {
      setIsProcessingBulk(false);
    }
  }, [selectedContracts, crossModule, refetch]);

  // Check if any filters are active
  const hasActiveFilters = searchQuery || statusFilter !== "all" || typeFilters.length > 0 || riskFilters.length > 0 || approvalFilters.length > 0 || Object.keys(advancedFilters).length > 0;

  const filteredContracts = useMemo(() => {
    if (!Array.isArray(contracts)) return [];
    
    return contracts.filter((contract) => {
      // Text search
      const matchesSearch =
        searchQuery === "" ||
        contract.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.parties?.client?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.parties?.supplier?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" || contract.status === statusFilter;

      // Risk level filter
      const matchesRisk = riskFilters.length === 0 || riskFilters.some(risk => {
        const level = RISK_LEVELS.find(l => l.value === risk);
        if (!level?.range || contract.riskScore === undefined || contract.riskScore === null) return false;
        return contract.riskScore >= (level.range[0] ?? 0) && contract.riskScore < (level.range[1] ?? 100);
      });

      // Approval status filter  
      const matchesApproval = approvalFilters.length === 0 || approvalFilters.some(approval => {
        const contractApprovalStatus = (contract as any).approvalStatus || 'none';
        return contractApprovalStatus === approval;
      });

      // Advanced filters
      const matchesAdvanced = 
        (!advancedFilters.clientName || contract.parties?.client?.toLowerCase().includes(advancedFilters.clientName.toLowerCase())) &&
        (!advancedFilters.supplierName || contract.parties?.supplier?.toLowerCase().includes(advancedFilters.supplierName.toLowerCase())) &&
        (!advancedFilters.minValue || (contract.value && contract.value >= advancedFilters.minValue)) &&
        (!advancedFilters.maxValue || (contract.value && contract.value <= advancedFilters.maxValue));

      return matchesSearch && matchesStatus && matchesRisk && matchesApproval && matchesAdvanced;
    });
  }, [contracts, searchQuery, statusFilter, typeFilters, riskFilters, approvalFilters, advancedFilters]);

  // After filteredContracts is computed, we need to fix toggleSelectAll
  const allVisibleSelected = useMemo(() => {
    if (filteredContracts.length === 0) return false;
    return filteredContracts.every(c => selectedContracts.has(c.id));
  }, [filteredContracts, selectedContracts]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: "Active", color: "bg-green-100 text-green-800" },
      processing: { label: "Processing", color: "bg-blue-100 text-blue-800" },
      failed: { label: "Failed", color: "bg-red-100 text-red-800" },
      pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      color: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge className={`${config.color} border-0`}>{config.label}</Badge>
    );
  };

  const getRiskBadge = (riskScore?: number) => {
    if (!riskScore) return null;

    if (riskScore < 30) {
      return <Badge className="bg-green-100 text-green-800 border-0">Low Risk</Badge>;
    } else if (riskScore < 70) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-0">Medium Risk</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 border-0">High Risk</Badge>;
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="page-container">
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-10 w-10 text-blue-600" />
            </motion.div>
            <p className="text-slate-500 text-sm">Loading contracts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="page-wrapper">
      <div className="page-container space-y-6">
        <PageBreadcrumb />
        
        {/* Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Contracts</h1>
            <p className="page-description">Manage and view all your contracts</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAdvancedSearch(true)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Advanced
            </Button>
            <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Link href="/upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Link>
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedContracts.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="bg-blue-50 border-blue-200 border-2">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={() => {
                          const visibleIds = filteredContracts.map(c => c.id);
                          setSelectedContracts(prev => {
                            if (allVisibleSelected) {
                              return new Set();
                            } else {
                              return new Set(visibleIds);
                            }
                          });
                        }}
                      />
                      <span className="font-medium text-blue-900">
                        {selectedContracts.size} contract{selectedContracts.size !== 1 ? 's' : ''} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-700 hover:text-blue-900"
                        onClick={() => setSelectedContracts(new Set())}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white"
                            onClick={() => performBulkAction('export')}
                            disabled={isProcessingBulk}
                          >
                            {isProcessingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            <span className="hidden sm:inline ml-2">Export</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export selected contracts</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white"
                            onClick={() => performBulkAction('analyze')}
                            disabled={isProcessingBulk}
                          >
                            <Brain className="h-4 w-4" />
                            <span className="hidden sm:inline ml-2">AI Analyze</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Run AI analysis on selected</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white"
                            onClick={() => performBulkAction('share')}
                            disabled={isProcessingBulk}
                          >
                            <Share2 className="h-4 w-4" />
                            <span className="hidden sm:inline ml-2">Share</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Share selected contracts</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDeleteClick}
                            disabled={isProcessingBulk}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden sm:inline ml-2">Delete</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete selected contracts</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-base">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="metric-label">Total</p>
                  <p className="metric-value text-slate-900">
                    {Array.isArray(contracts) ? contracts.length : 0}
                  </p>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-base">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="metric-label">Active</p>
                  <p className="metric-value text-emerald-600">
                    {Array.isArray(contracts) ? contracts.filter((c) => c.status === "completed").length : 0}
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-processing" className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Processing</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {Array.isArray(contracts) ? contracts.filter((c) => c.status === "processing").length : 0}
                  </p>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-base">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="metric-label">Total Value</p>
                  <p className="metric-value text-slate-900">
                    {formatCurrency(
                      Array.isArray(contracts) ? contracts.reduce((sum, c) => sum + (c.value || 0), 0) : 0
                    )}
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="card-base">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              {/* Search Row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search contracts by name, client, or supplier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 input-base"
                    data-testid="contract-search"
                  />
                </div>
              </div>
              
              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filters */}
                <div className="flex gap-1" data-testid="status-filters">
                  <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                    data-testid="filter-all"
                    className={statusFilter === "all" ? "bg-blue-600 hover:bg-blue-700" : ""}
                  >
                    All
                  </Button>
                  <Button
                    variant={statusFilter === "completed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("completed")}
                    data-testid="filter-active"
                    className={statusFilter === "completed" ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    Active
                  </Button>
                  <Button
                    variant={statusFilter === "processing" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("processing")}
                    data-testid="filter-processing"
                    className={statusFilter === "processing" ? "bg-blue-600 hover:bg-blue-700" : ""}
                  >
                    Processing
                  </Button>
                  <Button
                    variant={statusFilter === "failed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("failed")}
                    data-testid="filter-failed"
                    className={statusFilter === "failed" ? "bg-red-600 hover:bg-red-700" : ""}
                  >
                    Failed
                  </Button>
                </div>

                <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

                {/* Risk Level Filters */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Shield className="h-4 w-4" />
                      Risk
                      {riskFilters.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          {riskFilters.length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {RISK_LEVELS.map((level) => (
                      <DropdownMenuItem
                        key={level.value}
                        onClick={() => {
                          setRiskFilters(prev => 
                            prev.includes(level.value) 
                              ? prev.filter(r => r !== level.value)
                              : [...prev, level.value]
                          );
                        }}
                      >
                        <Checkbox
                          checked={riskFilters.includes(level.value)}
                          className="mr-2"
                        />
                        {level.label}
                      </DropdownMenuItem>
                    ))}
                    {riskFilters.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setRiskFilters([])}>
                          Clear risk filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Approval Status Filters */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      Approval
                      {approvalFilters.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          {approvalFilters.length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {APPROVAL_STATUSES.map((status) => {
                      const StatusIcon = status.icon;
                      return (
                        <DropdownMenuItem
                          key={status.value}
                          onClick={() => {
                            setApprovalFilters(prev => 
                              prev.includes(status.value) 
                                ? prev.filter(a => a !== status.value)
                                : [...prev, status.value]
                            );
                          }}
                        >
                          <Checkbox
                            checked={approvalFilters.includes(status.value)}
                            className="mr-2"
                          />
                          <StatusIcon className={`h-4 w-4 mr-2 ${status.color}`} />
                          {status.label}
                        </DropdownMenuItem>
                      );
                    })}
                    {approvalFilters.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setApprovalFilters([])}>
                          Clear approval filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-slate-500 hover:text-slate-900"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear filters
                  </Button>
                )}
              </div>

              {/* Active Filter Chips */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2">
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      Search: {searchQuery}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {riskFilters.map(risk => (
                    <Badge key={risk} variant="secondary" className="gap-1 pr-1">
                      {RISK_LEVELS.find(l => l.value === risk)?.label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => setRiskFilters(prev => prev.filter(r => r !== risk))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {approvalFilters.map(approval => (
                    <Badge key={approval} variant="secondary" className="gap-1 pr-1">
                      {APPROVAL_STATUSES.find(s => s.value === approval)?.label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => setApprovalFilters(prev => prev.filter(a => a !== approval))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {advancedFilters.clientName && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      Client: {advancedFilters.clientName}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => setAdvancedFilters(prev => ({ ...prev, clientName: undefined }))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {advancedFilters.supplierName && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      Supplier: {advancedFilters.supplierName}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => setAdvancedFilters(prev => ({ ...prev, supplierName: undefined }))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contracts List */}
        <AnimatePresence mode="wait">
          {filteredContracts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-base">
                <CardContent className="p-6">
                  {(searchQuery || statusFilter !== "all") ? (
                    <NoResults onClearFilters={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }} />
                  ) : (
                    <NoContracts />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              className="space-y-3" 
              data-testid="contracts-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {filteredContracts.map((contract, index) => (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.005 }}
                  className="transform-gpu"
                >
                  <Card
                    className={`border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer bg-white/80 backdrop-blur-sm group ${
                      selectedContracts.has(contract.id) ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''
                    }`}
                    data-testid="contract-card"
                  >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <div className="flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedContracts.has(contract.id)}
                        onCheckedChange={() => toggleSelect(contract.id)}
                        aria-label={`Select ${contract.title}`}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0" onClick={() => router.push(`/contracts/${contract.id}`)}>
                      {/* Title and Status */}
                      <div className="flex items-center gap-3 mb-3">
                        <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {contract.title}
                        </h3>
                        {getStatusBadge(contract.status)}
                        {getRiskBadge(contract.riskScore)}
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {contract.parties?.client && (
                          <div>
                            <p className="text-gray-500">Client</p>
                            <p className="font-medium text-gray-900">
                              {contract.parties.client}
                            </p>
                          </div>
                        )}
                        {contract.parties?.supplier && (
                          <div>
                            <p className="text-gray-500">Supplier</p>
                            <p className="font-medium text-gray-900">
                              {contract.parties.supplier}
                            </p>
                          </div>
                        )}
                        {contract.value && (
                          <div>
                            <p className="text-gray-500">Value</p>
                            <p className="font-medium text-gray-900">
                              {formatCurrency(contract.value)}
                            </p>
                          </div>
                        )}
                        {contract.expirationDate && (
                          <div>
                            <p className="text-gray-500">Expiration</p>
                            <p className="font-medium text-gray-900">
                              {formatDate(contract.expirationDate)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Processing Progress */}
                      {contract.status === "processing" && contract.processing && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900">
                              {contract.processing.currentStage}
                            </span>
                            <span className="text-sm font-bold text-blue-600">
                              {contract.processing.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{
                                width: `${contract.processing.progress}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {contract.status === "failed" && contract.error && (
                        <div className="mt-4 p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-red-900">
                                Processing Failed
                              </p>
                              <p className="text-sm text-red-700">
                                {contract.error}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => router.push(`/contracts/${contract.id}?tab=ai`)}
                          >
                            <Brain className="h-4 w-4 text-purple-600" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>AI Analysis</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              // Quick share action
                              navigator.clipboard.writeText(`${window.location.origin}/contracts/${contract.id}`);
                              toast.success('Link copied to clipboard');
                            }}
                          >
                            <Share2 className="h-4 w-4 text-blue-600" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Share</TooltipContent>
                      </Tooltip>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/contracts/${contract.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/contracts/${contract.id}?tab=ai`)}>
                            <Brain className="h-4 w-4 mr-2" />
                            AI Analysis
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/contracts/${contract.id}/versions`)}>
                            <GitCompare className="h-4 w-4 mr-2" />
                            Version History
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDownload(contract.id)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare(contract.id, contract.title || 'Contract')}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRequestApproval(contract.id, contract.title || 'Contract')}>
                            <ClipboardCheck className="h-4 w-4 mr-2" />
                            Request Approval
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteClick(contract.id, contract.title || 'Contract')}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 shadow-md"
                        onClick={() => router.push(`/contracts/${contract.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Advanced Search Modal */}
      <AdvancedSearchModal
        open={showAdvancedSearch}
        onOpenChange={setShowAdvancedSearch}
        onSearch={(filters) => {
          setAdvancedFilters(filters);
          if (filters.query) {
            setSearchQuery(filters.query);
          }
        }}
        initialFilters={advancedFilters}
      />
      
      {/* Share Dialog */}
      {shareContractId && (
        <ShareDialog
          isOpen={shareDialogOpen}
          onClose={() => {
            setShareDialogOpen(false);
            setShareContractId(null);
          }}
          documentId={shareContractId}
          documentType="contract"
          documentTitle={shareContractTitle}
        />
      )}
      
      {/* Submit for Approval Modal */}
      {approvalContractId && (
        <SubmitForApprovalModal
          isOpen={approvalModalOpen}
          onClose={() => {
            setApprovalModalOpen(false);
            setApprovalContractId(null);
            setApprovalContractTitle("");
          }}
          contractId={approvalContractId}
          contractTitle={approvalContractTitle}
          onSuccess={handleApprovalSuccess}
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Contract"
        description={`Are you sure you want to delete "${contractToDelete?.title}"? This action cannot be undone.`}
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
      
      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete Multiple Contracts"
        description={`Are you sure you want to delete ${selectedContracts.size} contracts? This action cannot be undone.`}
        variant="destructive"
        confirmLabel="Delete All"
        onConfirm={handleConfirmBulkDelete}
        isLoading={isProcessingBulk}
      />
    </div>
    </TooltipProvider>
  );
}
