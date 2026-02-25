/**
 * Contracts List Page
 * Clean, focused UI with hero dashboard, smart filters, and preview panel.
 * Server-side pagination/filtering with client-side supplementary filters.
 */

"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorBoundary } from "@/components/error-boundary/ErrorBoundary";
import { AdvancedFilterPanel } from "@/components/contracts/AdvancedFilterPanel";
import { ActiveFilterChips } from "@/components/contracts/ActiveFilterChips";
import { SavedSearchPresets } from "@/components/contracts/SavedSearchPresets";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Filter,
  Download,
  Trash2,
  Share2,
  X,
  LayoutGrid,
  LayoutList,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  FileDown,
  FileSpreadsheet,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeftRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useDataMode } from "@/contexts/DataModeContext";
import { useContracts, useContractStats, useCrossModuleInvalidation, useTaxonomyCategories, type Contract } from "@/hooks/use-queries";
import { useContractsPageFilters } from "@/hooks/use-contracts-page-filters";
import { useContractsPageActions } from "@/hooks/use-contracts-page-actions";
import { toast } from "sonner";

// Lazy load heavy components for better performance
import { LazyContractPreviewPanel } from "@/components/lazy";

// UI Components
import { ContractsHeroDashboard, type ContractStats } from "@/components/contracts/ContractsHeroDashboard";
import { EnhancedContractCard, type EnhancedContract } from "@/components/contracts/EnhancedContractCard";
import { type ExtendedContract } from "@/components/contracts/ContractPreviewPanel";
import { MobileFiltersSheet } from "@/components/contracts/MobileContractViews";
import { NoContracts, NoResults } from "@/components/contracts/EmptyStates";
import { ShareDialog } from "@/components/collaboration/ShareDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContractsPageHeader } from "@/components/contracts/ContractsPageHeader";
import { StateOfTheArtSearch } from "@/components/contracts/StateOfTheArtSearch";
import { ScrollToTopButton } from "@/components/fab";
import { cn } from "@/lib/utils";

// Extracted sub-components
import { AnimatedCounter } from "@/components/contracts/AnimatedCounter";
import { ContractRowSkeleton } from "@/components/contracts/ContractRowSkeleton";
import { ProcessingContractTracker } from "@/components/contracts/ProcessingContractTracker";
import { CompactContractRow } from "@/components/contracts/CompactContractRow";

// Extracted constants and utilities
import {
  type SortField,
  type SortDirection,
  PAGE_SIZE_OPTIONS,
  DATE_PRESETS,
  formatCurrency,
  formatDate,
} from "@/lib/contracts/filter-constants";
import { applyContractFilters } from "@/lib/contracts/apply-filters";



export default function ContractsPage() {
  const router = useRouter();
  const { dataMode } = useDataMode();

  // Preserve list scroll position when navigating to contract details and back
  useEffect(() => {
    try {
      const shouldRestore = sessionStorage.getItem('contracts:list:restore');
      if (shouldRestore !== '1') return;
      const y = sessionStorage.getItem('contracts:list:scrollY');
      const yNum = y ? Number.parseInt(y, 10) : NaN;
      if (!Number.isFinite(yNum)) return;
      sessionStorage.removeItem('contracts:list:restore');
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, yNum)));
    } catch {
      // ignore storage/scroll errors
    }
  }, []);

  const pushToContract = useCallback((id: string) => {
    try {
      sessionStorage.setItem('contracts:list:scrollY', String(window.scrollY));
      sessionStorage.setItem('contracts:list:restore', '1');
    } catch {
      // ignore
    }
    router.push(`/contracts/${id}`, { scroll: true });
  }, [router]);
  
  // ── Extracted hooks ──────────────────────────────────────────────────
  const {
    searchQuery, setSearchQuery,
    filterState, setFilterState,
    valueRangeFilter, setValueRangeFilter,
    dateRangeFilter, setDateRangeFilter,
    expirationFilters, setExpirationFilters,
    signatureFilters, documentTypeFilters,
    currentPage, setCurrentPage, pageSize, setPageSize,
    sortField, setSortField, sortDirection, setSortDirection,
    statusFilter, typeFilters, riskFilters, supplierFilters, categoryFilter,
    setStatusFilter, setTypeFilters, setRiskFilters, setSupplierFilters, setCategoryFilter,
    serverParams,
    hasActiveFilters, activeFilterCount,
    clearFilters, handleClearFilter, handleLoadPreset,
  } = useContractsPageFilters();

  // UI toggle state (not part of filter logic)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // View mode: 'compact' for table-like rows, 'cards' for detailed cards
  const [viewMode, setViewMode] = useState<'compact' | 'cards'>('compact');

  // Enhanced UI state
  const [previewContract, setPreviewContract] = useState<ExtendedContract | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Track whether any contracts are processing (for auto-polling)
  const [hasProcessingContracts, setHasProcessingContracts] = useState(false);
  const processingStartTimeRef = useRef<number | null>(null);

  // Adaptive polling interval: fast initially, slowing down over time
  // Hard cap at 5 minutes — after that we stop aggressive polling
  const MAX_PROCESSING_POLL_MS = 5 * 60 * 1000;

  const getPollingInterval = useCallback(() => {
    if (!processingStartTimeRef.current) return 5000;
    const elapsed = Date.now() - processingStartTimeRef.current;
    if (elapsed > MAX_PROCESSING_POLL_MS) return 30000; // Degrade to 30s after 5 min
    if (elapsed < 30000) return 3000;    // First 30s: poll every 3s
    if (elapsed < 120000) return 5000;   // 30s-2min: poll every 5s
    if (elapsed < 300000) return 10000;  // 2-5min: poll every 10s
    return 15000;                         // 5min+: poll every 15s
  }, []);

  // Use React Query for data fetching with caching
  // Enable polling when contracts are processing so progress updates in real time
  const { 
    data: contractsData, 
    isLoading: loading, 
    isFetching: isRefetching,
    refetch,
  } = useContracts(serverParams, {
    pollingEnabled: hasProcessingContracts,
    pollingInterval: getPollingInterval(),
  });
  
  // Fetch real-time stats from the database (always accurate)
  const { data: dbStats, refetch: refetchStats } = useContractStats();
  
  const crossModule = useCrossModuleInvalidation();
  const queryClient = useQueryClient();
  
  // Fetch categories for filters (cached by React Query)
  const { data: categories = [] } = useTaxonomyCategories();

  const {
    selectedContracts, setSelectedContracts, toggleSelect,
    isProcessingBulk,
    performBulkAction,
    handleDownload, handleShare,
    handleRequestApproval,
    handleDeleteClick, handleConfirmDelete,
    handleBulkDeleteClick, handleConfirmBulkDelete,
    handleConfirmBulkAction,
    shareDialogOpen, setShareDialogOpen, shareContractId, setShareContractId, shareContractTitle,
    deleteDialogOpen, setDeleteDialogOpen, contractToDelete,
    bulkDeleteDialogOpen, setBulkDeleteDialogOpen,
    bulkExportDialogOpen, setBulkExportDialogOpen,
    bulkShareDialogOpen, setBulkShareDialogOpen,
  } = useContractsPageActions({ dataMode, refetch, refetchStats, crossModule, queryClient });

  const contracts: Contract[] = contractsData?.contracts || [];

  // Stable row callbacks — prevent memo() busting on CompactContractRow
  const handleRowSelect = useCallback((id: string) => toggleSelect(id), [toggleSelect]);
  const handleRowView = useCallback((id: string) => pushToContract(id), [pushToContract]);
  const handleRowShare = useCallback((id: string, title: string) => handleShare(id, title), [handleShare]);
  const handleRowDelete = useCallback((id: string, title: string) => handleDeleteClick(id, title), [handleDeleteClick]);
  const handleRowDownload = useCallback((id: string) => handleDownload(id), [handleDownload]);
  const handleRowApproval = useCallback((id: string, title: string) => handleRequestApproval(id, title), [handleRequestApproval]);
  
  // Update polling state when contract data changes
  useEffect(() => {
    const anyProcessing = contractsData?.contracts?.some((c: Contract) => c.status === 'processing') ?? false;
    if (anyProcessing && !hasProcessingContracts) {
      // Started processing — record time for adaptive interval
      processingStartTimeRef.current = Date.now();
    } else if (!anyProcessing && hasProcessingContracts) {
      // Processing finished — reset timer
      processingStartTimeRef.current = null;
    }
    setHasProcessingContracts(anyProcessing);
  }, [contractsData, hasProcessingContracts]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Escape - clear selection
      if (e.key === 'Escape') {
        setSelectedContracts(new Set());
        setSearchQuery('');
      }
      
      // Slash - focus search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const searchInput = document.querySelector('[data-testid="contract-search"]') as HTMLInputElement;
        searchInput?.focus();
      }
      
      // V - toggle view mode
      if (e.key === 'v' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setViewMode(prev => prev === 'compact' ? 'cards' : 'compact');
      }
      
      // N - new contract (go to upload)
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        router.push('/contracts/new');
      }
      
      // U - quick upload
      if (e.key === 'u' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // Trigger header quick upload via custom event
        window.dispatchEvent(new CustomEvent('openQuickUpload'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, setSelectedContracts, setSearchQuery, setViewMode]);

  // Derive dynamic filter options from actual contract data
  const availableSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    contracts.forEach(c => {
      if (c.parties?.supplier) suppliers.add(c.parties.supplier);
      if (c.supplierName) suppliers.add(c.supplierName);
    });
    return Array.from(suppliers).filter(Boolean).sort();
  }, [contracts]);

  const availableClients = useMemo(() => {
    const clients = new Set<string>();
    contracts.forEach(c => {
      if (c.parties?.client) clients.add(c.parties.client);
      if (c.clientName) clients.add(c.clientName);
    });
    return Array.from(clients).filter(Boolean).sort();
  }, [contracts]);

  const availableContractTypes = useMemo(() => {
    const types = new Set<string>();
    contracts.forEach(c => {
      if (c.type) types.add(c.type);
    });
    return Array.from(types).filter(Boolean).sort();
  }, [contracts]);

  const availableCurrencies = useMemo(() => {
    const currencies = new Set<string>();
    contracts.forEach(c => {
      if (c.currency) currencies.add(c.currency);
    });
    return Array.from(currencies).filter(Boolean).sort();
  }, [contracts]);

  const availableJurisdictions = useMemo(() => {
    const jurisdictions = new Set<string>();
    contracts.forEach(c => {
      if (c.jurisdiction) jurisdictions.add(c.jurisdiction);
    });
    return Array.from(jurisdictions).filter(Boolean).sort();
  }, [contracts]);

  const availablePaymentTerms = useMemo(() => {
    const terms = new Set<string>();
    contracts.forEach(c => {
      if (c.paymentTerms) terms.add(c.paymentTerms);
    });
    return Array.from(terms).filter(Boolean).sort();
  }, [contracts]);

  // Apply only client-side supplementary filters (signature, documentType, etc.)
  // Server already handles search, status, type, category, date, value filters.
  const filteredContracts = useMemo(
    () =>
      applyContractFilters(contracts, {
        searchQuery: '', // Server already filtered by search
        filterState: {}, // Server already filtered by status/type/category
        dateRangePreset: undefined, // Server already filtered
        expirationFilters,
        signatureFilters,
        documentTypeFilters,
        valueRangePreset: undefined, // Server already filtered
      }),
    [contracts, expirationFilters, signatureFilters, documentTypeFilters],
  );

  // Server already sorts — skip redundant client-side sort.
  // Pagination uses server-side total.
  const totalPages = Math.ceil((contractsData?.total ?? 0) / pageSize);
  const paginatedContracts = filteredContracts;

  // Sparkline trend data — computed once, shared by both heroStats branches
  const trendData = useMemo(() => {
    const now = Date.now();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayContracts = contracts.filter(c => {
        if (!c.createdAt) return false;
        const created = new Date(c.createdAt);
        return created >= dayStart && created < dayEnd;
      });
      
      return {
        date: dayNames[date.getDay()],
        contracts: dayContracts.length,
        value: dayContracts.reduce((sum, c) => sum + (c.value || 0), 0)
      };
    });
  }, [contracts]);

  // Hero Dashboard Stats - Use real database stats when available, fallback to client-side calculation
  const heroStats: ContractStats = useMemo(() => {
    const now = Date.now();
    
    // If we have real database stats, use them (always accurate)
    if (dbStats) {
      return {
        totalContracts: dbStats.overview.total,
        activeContracts: dbStats.overview.processed,
        totalValue: dbStats.financial.totalValue,
        monthlyChange: 0, // Could be computed on backend
        expiringSoon: dbStats.timeline.expiringNext30Days,
        expiringThisWeek: dbStats.timeline.expiringThisMonth, // Approximation
        highRiskContracts: 0, // Not tracked yet
        riskTrend: 'stable',
        processingCount: dbStats.overview.byStatus?.processing || 0,
        pendingReview: dbStats.overview.pending,
        recentlyAdded: dbStats.timeline.recentlyUploaded,
        trendData,
      };
    }
    
    // Fallback: Calculate from client-side contracts (may be paginated/incomplete)
    const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const expiringSoon = contracts.filter(c => {
      if (!c.expirationDate) return false;
      const daysUntil = Math.ceil((new Date(c.expirationDate).getTime() - now) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 30;
    }).length;
    const highRisk = contracts.filter(c => (c.riskScore || 0) >= 70).length;
    const processing = contracts.filter(c => c.status === 'processing').length;
    
    // Calculate real month-over-month change
    const thisMonth = contracts.filter(c => {
      if (!c.createdAt) return false;
      const created = new Date(c.createdAt);
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      return created >= monthAgo;
    }).length;
    const previousMonth = contracts.filter(c => {
      if (!c.createdAt) return false;
      const created = new Date(c.createdAt);
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const twoMonthsAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
      return created >= twoMonthsAgo && created < monthAgo;
    }).length;
    const monthlyChange = previousMonth > 0 
      ? Math.round(((thisMonth - previousMonth) / previousMonth) * 100 * 10) / 10 
      : thisMonth > 0 ? 100 : 0;
    
    return {
      totalContracts: contractsData?.total ?? contracts.length,
      activeContracts: contracts.filter(c => c.status === 'completed').length,
      totalValue,
      monthlyChange,
      expiringSoon,
      expiringThisWeek: contracts.filter(c => {
        if (!c.expirationDate) return false;
        const daysUntil = Math.ceil((new Date(c.expirationDate).getTime() - now) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 7;
      }).length,
      highRiskContracts: highRisk,
      riskTrend: highRisk > 3 ? 'up' : 'down',
      processingCount: processing,
      pendingReview: contracts.filter(c => c.status === 'pending').length,
      recentlyAdded: contracts.filter(c => {
        if (!c.createdAt) return false;
        return new Date(c.createdAt).getTime() > now - 7 * 24 * 60 * 60 * 1000;
      }).length,
      trendData,
    };
     
  }, [contracts, contractsData?.total, dbStats, trendData]);

  // Convert Contract to EnhancedContract for enhanced cards
  const enhancedContracts = useMemo(() => {
    return paginatedContracts.map(contract => ({
      id: contract.id,
      title: contract.title || 'Untitled Contract',
      type: contract.type || 'Contract',
      filename: contract.filename,
      status: (contract.status || 'draft') as EnhancedContract['status'],
      value: contract.value,
      expirationDate: contract.expirationDate,
      effectiveDate: contract.effectiveDate,
      createdAt: contract.createdAt,
      riskScore: contract.riskScore,
      health: {
        score: Math.max(20, 100 - (contract.riskScore || 0)),
        issues: contract.riskScore && contract.riskScore >= 70 ? ['High risk score detected'] : [],
        lastChecked: new Date(),
      },
      parties: contract.parties ? [
        ...(contract.parties.client ? [{ name: contract.parties.client, role: 'client' as const }] : []),
        ...(contract.parties.supplier ? [{ name: contract.parties.supplier, role: 'vendor' as const }] : []),
      ] : [],
      isFavorite: false,
      isPinned: false,
      completeness: contract.status === 'completed' ? 100 : contract.status === 'processing' ? (contract.processing?.progress || 50) : 0,
      keyTerms: [],
      tags: [],
      // Include hierarchy info
      parentContractId: contract.parentContractId ?? undefined,
      parentContract: contract.parentContract ? { ...contract.parentContract, contractType: contract.parentContract.contractType ?? undefined } : undefined,
      childContracts: contract.childContracts?.map(c => ({ ...c, contractType: c.contractType ?? undefined })),
      hasHierarchy: contract.hasHierarchy,
    } satisfies EnhancedContract));
  }, [paginatedContracts]);

  // Convert to ExtendedContract for preview panel
  const convertToExtendedContract = useCallback((contract: Contract): ExtendedContract => ({
    id: contract.id,
    title: contract.title || 'Untitled Contract',
    type: contract.type || 'Contract',
    filename: contract.filename,
    status: (contract.status || 'draft') as ExtendedContract['status'],
    value: contract.value,
    expirationDate: contract.expirationDate,
    effectiveDate: contract.effectiveDate,
    createdAt: contract.createdAt,
    riskScore: contract.riskScore,
    parties: contract.parties ? [
      ...(contract.parties.client ? [{ 
        id: 'client-1',
        name: contract.parties.client, 
        role: 'client' as const, 
        email: '',
        phone: '',
      }] : []),
      ...(contract.parties.supplier ? [{ 
        id: 'vendor-1',
        name: contract.parties.supplier, 
        role: 'vendor' as const, 
        email: '',
        phone: '',
      }] : []),
    ] : [],
    clauses: [],
    attachments: [],
    activities: [],
    summary: 'Contract summary will be available after processing.',
  }), []);

  // Handle preview
  const handlePreview = useCallback((contract: Contract) => {
    setPreviewContract(convertToExtendedContract(contract));
    setPreviewOpen(true);
  }, [convertToExtendedContract]);

  // Navigate between contracts in preview
  const handlePreviewNavigate = useCallback((direction: 'prev' | 'next') => {
    if (!previewContract) return;
    const currentIndex = paginatedContracts.findIndex(c => c.id === previewContract.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    const nextContract = paginatedContracts[newIndex];
    if (newIndex >= 0 && newIndex < paginatedContracts.length && nextContract) {
      setPreviewContract(convertToExtendedContract(nextContract));
    }
  }, [previewContract, paginatedContracts, convertToExtendedContract]);

  // Export filtered results
  const handleExportFiltered = useCallback(async (format: 'csv' | 'json') => {
    try {
      toast.info(`Exporting ${filteredContracts.length} contracts...`);
      
      if (format === 'json') {
        const data = JSON.stringify(filteredContracts, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contracts-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV export
        const headers = ['Title', 'Status', 'Client', 'Supplier', 'Value', 'Created', 'Expiration', 'Risk Score'];
        const rows = filteredContracts.map(c => [
          c.title || '',
          c.status || '',
          c.parties?.client || '',
          c.parties?.supplier || '',
          c.value?.toString() || '',
          c.createdAt || '',
          c.expirationDate || '',
          c.riskScore?.toString() || ''
        ]);
        const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contracts-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      toast.success(`Exported ${filteredContracts.length} contracts`);
    } catch (error) {
      toast.error('Export failed');
    }
  }, [filteredContracts]);

  const allVisibleSelected = useMemo(() => {
    if (paginatedContracts.length === 0) return false;
    return paginatedContracts.every(c => selectedContracts.has(c.id));
  }, [paginatedContracts, selectedContracts]);

  // Precompute advanced filter badge count
  const advancedFilterCount = useMemo(() =>
    (filterState.statuses?.length ?? 0) + (filterState.documentRoles?.length ?? 0) +
    (filterState.categories?.length ?? 0) + (filterState.hasDeadline != null ? 1 : 0) +
    (filterState.isExpiring != null ? 1 : 0) +
    (filterState.riskLevels?.length ?? 0) + (filterState.suppliers?.length ?? 0) +
    (filterState.clients?.length ?? 0) + (filterState.contractTypes?.length ?? 0) +
    (filterState.currencies?.length ?? 0) + (filterState.jurisdictions?.length ?? 0) +
    (filterState.paymentTerms?.length ?? 0),
  [filterState]);

  if (loading) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-slate-50">
          <ContractsPageHeader
            onRefresh={() => refetch()}
            isRefreshing={true}
          />
          <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-6 space-y-5">
            {/* Skeleton Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <div className="animate-pulse space-y-3">
                      <div className="h-3 w-20 bg-slate-200 rounded" />
                      <div className="h-8 w-24 bg-slate-200 rounded" />
                      <div className="h-3 w-16 bg-slate-100 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Skeleton Search Bar */}
            <Card className="bg-white border-slate-200">
              <CardContent className="p-5">
                <div className="animate-pulse flex gap-4">
                  <div className="h-10 flex-1 bg-slate-200 rounded" />
                  <div className="h-10 w-24 bg-slate-200 rounded" />
                </div>
              </CardContent>
            </Card>
            
            {/* Skeleton List Header */}
            <div className="flex items-center justify-between">
              <div className="animate-pulse flex items-center gap-3">
                <div className="h-5 w-24 bg-slate-200 rounded" />
                <div className="h-6 w-16 bg-slate-100 rounded-full" />
              </div>
              <div className="animate-pulse flex gap-2">
                <div className="h-8 w-20 bg-slate-200 rounded" />
                <div className="h-8 w-20 bg-slate-200 rounded" />
              </div>
            </div>
            
            {/* Skeleton Contract Rows */}
            <Card className="bg-white border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {[...Array(8)].map((_, i) => (
                  <ContractRowSkeleton key={i} index={i} />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-slate-50">
      <ContractsPageHeader
        onRefresh={() => refetch()}
        isRefreshing={isRefetching && !loading}
        onQuickUploadComplete={(contractIds) => {
          refetch();
          toast.success(`${contractIds.length} contract${contractIds.length > 1 ? 's' : ''} uploaded`);
        }}
      />
      
      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-6 space-y-5">

        {/* Hero Dashboard */}
        <ContractsHeroDashboard
          stats={heroStats}
          onUploadClick={() => router.push('/upload')}
          onGenerateClick={() => router.push('/generate')}
          onCompareClick={() => {
            if (selectedContracts.size === 2) {
              const ids = Array.from(selectedContracts);
              router.push(`/compare?contract1=${ids[0]}&contract2=${ids[1]}`);
            } else {
              toast.info('Select exactly 2 contracts to compare');
            }
          }}
        />

        {/* State of the Art Search & Filters */}
        <div data-tour="smart-search">
          <StateOfTheArtSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            riskFilters={riskFilters}
            onRiskFiltersChange={setRiskFilters}
            typeFilters={typeFilters}
            onTypeFiltersChange={setTypeFilters}
            expirationFilters={expirationFilters}
            onExpirationFiltersChange={setExpirationFilters}
            supplierFilters={supplierFilters}
            onSupplierFiltersChange={setSupplierFilters}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={(cat) => setCategoryFilter(cat)}
            valueRangeFilter={valueRangeFilter}
            onValueRangeFilterChange={(val) => setValueRangeFilter(val)}
            dateRangeFilter={dateRangeFilter}
            onDateRangeFilterChange={setDateRangeFilter}
            suppliers={Array.from(new Set(contracts?.map(c => c.parties?.supplier).filter(Boolean) || [])).sort() as string[]}
            categories={categories.map(cat => ({ id: cat.id, name: cat.name, color: cat.color }))}
            onClearFilters={clearFilters}
            activeFilterCount={activeFilterCount}
            totalResults={contractsData?.total ?? 0}
            isLoading={isRefetching}
          />
        </div>

        {/* Processing Contracts Live Tracker */}
        <ProcessingContractTracker 
          contracts={contracts} 
          onContractComplete={() => {
            refetch();
          }}
          onRetry={() => refetch()}
          onDismiss={() => refetch()}
        />

        {/* Advanced Filter Panel - Inline & Collapsible */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              key="advanced-filter-panel"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <AdvancedFilterPanel
                filters={filterState}
                onChange={setFilterState}
                onClose={() => setShowAdvancedFilters(false)}
                availableCategories={categories.map(cat => cat.name)}
                availableSuppliers={availableSuppliers}
                availableClients={availableClients}
                availableContractTypes={availableContractTypes}
                availableCurrencies={availableCurrencies}
                availableJurisdictions={availableJurisdictions}
                availablePaymentTerms={availablePaymentTerms}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Advanced Filter Controls */}
        <div className="flex items-center justify-end gap-2">
          {/* Active Filter Chips - only shows when filters are active */}
          <ActiveFilterChips
            filters={filterState}
            searchQuery={searchQuery}
            onClearFilter={handleClearFilter}
            onClearSearch={() => setSearchQuery('')}
            onClearAll={() => {
              clearFilters();
            }}
          />
          
          {/* Saved Search Presets */}
          <SavedSearchPresets
            currentFilters={filterState}
            currentQuery={searchQuery}
            onLoadPreset={handleLoadPreset}
          />
          
          {/* Advanced Filter Button */}
          <Button
              variant={showAdvancedFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={cn(
                "transition-all duration-200 h-8 text-xs font-medium",
                showAdvancedFilters 
                  ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-800" 
                  : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              {showAdvancedFilters ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Filter className="h-3.5 w-3.5 mr-1.5" />}
              <span className="hidden sm:inline">Advanced Filters</span>
              <span className="sm:hidden">Filters</span>
              {advancedFilterCount > 0 && (
                <Badge className={cn(
                  "ml-1.5",
                  showAdvancedFilters ? "bg-white text-slate-800" : "bg-slate-800 text-white"
                )} variant="secondary">
                  {advancedFilterCount}
                </Badge>
              )}
            </Button>
        </div>

        {/* View Mode Toggle, Sort & Results Count */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                <AnimatedCounter value={contractsData?.total ?? 0} />
              </span>
              <span className="text-sm text-slate-500 font-medium">contracts</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-700 border-0 font-semibold">
                  filtered
                </Badge>
              )}
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors bg-white focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 outline-none"
                >
                  <div className="p-1 rounded-md bg-slate-100">
                    <ArrowUp className={cn("h-3 w-3 text-slate-600 transition-transform", sortDirection === 'desc' && "rotate-180")} />
                  </div>
                  <span className="text-slate-700 font-medium">
                    {{
                      createdAt: 'Date',
                      title: 'Name',
                      value: 'Value',
                      expirationDate: 'Expires',
                      status: 'Status',
                    }[sortField as string] || 'Sort'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-white shadow-lg border-slate-200 p-1">
                {[
                  { field: 'createdAt' as SortField, label: 'Date Created' },
                  { field: 'title' as SortField, label: 'Name' },
                  { field: 'value' as SortField, label: 'Value' },
                  { field: 'expirationDate' as SortField, label: 'Expiration' },
                  { field: 'status' as SortField, label: 'Status' },
                ].map((option) => (
                  <DropdownMenuItem
                    key={option.field}
                    onClick={() => {
                      if (sortField === option.field) {
                        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField(option.field);
                        setSortDirection('desc');
                      }
                    }}
                    className={cn(
                      "text-sm rounded-lg cursor-pointer transition-colors",
                      sortField === option.field && "bg-gradient-to-r from-slate-100 to-slate-50 font-medium"
                    )}
                  >
                    {sortField === option.field && (
                      sortDirection === 'asc' 
                        ? <ArrowUp className="h-3.5 w-3.5 mr-2 text-slate-700" /> 
                        : <ArrowDown className="h-3.5 w-3.5 mr-2 text-slate-700" />
                    )}
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode */}
            <div data-tour="view-modes" className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              {[
                { mode: 'compact' as const, icon: LayoutList, label: 'List' },
                { mode: 'cards' as const, icon: LayoutGrid, label: 'Cards' },
              ].map((view, idx) => (
                <Tooltip key={view.mode}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode(view.mode)}
                      className={cn(
                        "h-9 w-11 flex items-center justify-center transition-colors relative focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 outline-none",
                        idx > 0 && "border-l border-slate-200",
                        viewMode === view.mode 
                          ? "bg-slate-800 text-white" 
                          : "bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      )}
                    >
                      <view.icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-0">{view.label} view</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-700 font-medium bg-white focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 outline-none"
                >
                  <div className="p-1 rounded-md bg-slate-100">
                    <Download className="h-3 w-3 text-slate-600" />
                  </div>
                  <span className="hidden sm:inline">Export</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-white shadow-lg border-slate-200 p-1">
                <DropdownMenuItem onClick={() => handleExportFiltered('csv')} className="text-sm rounded-lg cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" /> Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportFiltered('json')} className="text-sm rounded-lg cursor-pointer">
                  <FileDown className="h-4 w-4 mr-2 text-slate-600" /> Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Contracts List */}
        <div data-tour="contracts">
        <AnimatePresence mode="wait">
          {filteredContracts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="bg-white border-slate-200">
                <CardContent className="p-0">
                  {(searchQuery || statusFilter !== "all" || hasActiveFilters) ? (
                    <NoResults
                      searchTerm={searchQuery || undefined}
                      hasFilters={statusFilter !== 'all' || Boolean(hasActiveFilters)}
                      onClearSearch={searchQuery ? () => setSearchQuery('') : undefined}
                      onClearFilters={clearFilters}
                    />
                  ) : (
                    <NoContracts
                      onUpload={() => router.push('/upload')}
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : viewMode === 'compact' ? (
            /* ============ COMPACT LIST VIEW ============ */
            <motion.div 
              key="compact-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="overflow-hidden bg-white border-slate-200 shadow-sm rounded-xl" role="table" aria-label="Contracts list">
                {/* Table Header */}
                <div role="row" className="flex items-center gap-4 px-5 py-4 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky top-16 lg:top-0 z-10">
                  <div role="columnheader" className="w-10 flex-shrink-0 flex items-center justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Checkbox
                            checked={allVisibleSelected && paginatedContracts.length > 0}
                            onCheckedChange={() => {
                              const visibleIds = paginatedContracts.map(c => c.id);
                              setSelectedContracts(prev => {
                                if (allVisibleSelected) return new Set();
                                return new Set(visibleIds);
                              });
                            }}
                            aria-label="Select all on this page"
                            className="border-slate-300 h-4 w-4 data-[state=checked]:bg-slate-800 data-[state=checked]:border-slate-800 transition-colors"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Select all on this page</TooltipContent>
                    </Tooltip>
                  </div>
                  <div role="columnheader" className="flex-1 min-w-[200px]">Contract</div>
                  <div role="columnheader" className="hidden lg:block w-[120px]">Category</div>
                  <div role="columnheader" className="hidden lg:block w-[90px]">Type</div>
                  <div role="columnheader" className="hidden md:block w-[140px]">Party</div>
                  <div role="columnheader" className="hidden lg:block w-[100px] text-right">Value</div>
                  <div role="columnheader" className="hidden md:block w-[100px]">Expires</div>
                  <div role="columnheader" className="hidden lg:block w-[80px]">Signed</div>
                  <div role="columnheader" className="w-[100px]">Status</div>
                  <div role="columnheader" className="w-10 flex-shrink-0"></div>
                </div>
                
                {/* Table Body */}
                <div role="rowgroup" data-testid="contracts-list">
                  {paginatedContracts.map((contract, index) => (
                    <ErrorBoundary
                      key={`eb-${contract.id}`}
                      fallback={
                        <div role="row" className="px-4 py-3 text-sm text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-800">
                          Failed to render contract row
                        </div>
                      }
                    >
                      <CompactContractRow
                        key={contract.id}
                        contract={contract}
                        index={index}
                        isSelected={selectedContracts.has(contract.id)}
                        searchQuery={searchQuery}
                        onSelect={() => handleRowSelect(contract.id)}
                        onView={() => handleRowView(contract.id)}
                        onShare={() => handleRowShare(contract.id, contract.title || 'Contract')}
                        onDelete={() => handleRowDelete(contract.id, contract.title || 'Contract')}
                        onDownload={() => handleRowDownload(contract.id)}
                        onApproval={() => handleRowApproval(contract.id, contract.title || 'Contract')}
                        formatCurrency={formatCurrency}
                        formatDate={formatDate}
                      />
                    </ErrorBoundary>
                  ))}
                </div>
              </Card>
            </motion.div>
          ) : (
            /* ============ ENHANCED CARD VIEW ============ */
            <motion.div 
              key="card-list"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" 
              data-testid="contracts-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
            {enhancedContracts.map((contract, index) => {
                const originalContract = paginatedContracts[index];
                if (!originalContract) return null;
                return (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="transform-gpu"
                >
                  <EnhancedContractCard
                    contract={contract}
                    isSelected={selectedContracts.has(contract.id)}
                    onSelect={() => toggleSelect(contract.id)}
                    onClick={() => pushToContract(contract.id)}
                    onQuickAction={(action) => {
                      switch (action) {
                        case 'preview':
                          handlePreview(originalContract);
                          break;
                        case 'share':
                          handleShare(contract.id, contract.title || 'Contract');
                          break;
                        case 'favorite':
                          // Favorites not yet persisted — no-op
                          break;
                      }
                    }}
                    onDoubleClick={() => pushToContract(contract.id)}
                    showHealthIndicator
                    showPartyAvatars
                    enableHoverPreview
                  />
                </motion.div>
              );
              })}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        
        {/* Pagination Controls */}
        {filteredContracts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                  {/* Page Size Selector */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500 font-medium">Show</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      aria-label="Contracts per page"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 cursor-pointer hover:border-slate-300 transition-colors font-medium"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>{size} per page</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Page Info */}
                  <div className="text-sm text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-800 tabular-nums">{((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, contractsData?.total ?? 0)}</span>
                    <span className="text-slate-400 mx-1.5"> of </span>
                    <span className="font-semibold text-slate-800 tabular-nums">{contractsData?.total ?? 0}</span>
                    <span className="text-slate-500 ml-1"> contracts</span>
                  </div>
                  
                  {/* Page Navigation */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 outline-none"
                      aria-label="First page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 outline-none"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1.5 px-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn(
                              "min-w-[34px] h-8 text-sm font-medium rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1",
                              currentPage === pageNum
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700'
                            )}
                            aria-label={`Page ${pageNum}`}
                            aria-current={currentPage === pageNum ? 'page' : undefined}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 outline-none"
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 outline-none"
                      aria-label="Last page"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
      
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
      
      {/* Bulk Export Confirmation Dialog */}
      <ConfirmDialog
        open={bulkExportDialogOpen}
        onOpenChange={setBulkExportDialogOpen}
        title="Export Multiple Contracts"
        description={`You are about to export ${selectedContracts.size} contracts. This will generate a downloadable file containing the selected contracts.`}
        variant="default"
        confirmLabel="Export"
        onConfirm={handleConfirmBulkAction}
        isLoading={isProcessingBulk}
      />
      
      {/* Bulk Share Confirmation Dialog */}
      <ConfirmDialog
        open={bulkShareDialogOpen}
        onOpenChange={setBulkShareDialogOpen}
        title="Share Multiple Contracts"
        description={`You are about to share ${selectedContracts.size} contracts. This will generate shareable links for all selected contracts.`}
        variant="default"
        confirmLabel="Generate Links"
        onConfirm={handleConfirmBulkAction}
        isLoading={isProcessingBulk}
      />

      {/* Contract Preview Panel */}
      <LazyContractPreviewPanel
        contract={previewContract}
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewContract(null);
        }}
        onNavigate={handlePreviewNavigate}
        onEdit={(id) => pushToContract(id)}
        onShare={(id) => {
          const contract = contracts.find(c => c.id === id);
          if (contract) handleShare(id, contract.title || 'Contract');
        }}
        onDownload={handleDownload}
        onDelete={(id) => {
          const contract = contracts.find(c => c.id === id);
          if (contract) handleDeleteClick(id, contract.title || 'Contract');
        }}
      />

      {/* Mobile Filters Sheet */}
      <MobileFiltersSheet
        isOpen={showMobileFilters}
        onOpenChange={setShowMobileFilters}
        filters={{
          search: searchQuery,
          status: statusFilter !== 'all' ? [statusFilter] : [],
          riskLevel: riskFilters,
          contractType: typeFilters,
        }}
        onFiltersChange={(filters) => {
          if (filters.search !== undefined) setSearchQuery(filters.search);
          if (filters.status) {
            setStatusFilter(filters.status.length > 0 ? filters.status[0] : 'all');
          }
          if (filters.riskLevel) setRiskFilters(filters.riskLevel);
          if (filters.contractType) setTypeFilters(filters.contractType);
        }}
        onApply={() => setShowMobileFilters(false)}
        onReset={clearFilters}
      />

      {/* Scroll to Top Button */}
      <ScrollToTopButton threshold={600} />

      {/* Bulk Actions Bar — fixed bottom so it's always visible */}
      <AnimatePresence>
        {selectedContracts.size > 0 && (
          <motion.div
            key="bulk-actions-bar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-auto max-w-[95vw]"
          >
            <Card className="bg-slate-900 border-slate-700/50 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-sm">
              <CardContent className="py-3 px-5">
                <div className="flex items-center gap-5 flex-wrap">
                  {/* Count + Clear */}
                  <div className="flex items-center gap-3">
                    <Badge className="bg-white/15 text-white font-semibold px-3 py-1.5 text-sm rounded-lg border border-white/10">
                      {selectedContracts.size}
                    </Badge>
                    <span className="text-sm text-slate-300">
                      selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 h-8 rounded-lg transition-colors"
                      onClick={() => setSelectedContracts(new Set())}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="w-px h-6 bg-slate-700" />

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-slate-700 hover:bg-slate-600 text-slate-200 border-0 h-8 px-3 rounded-lg transition-colors"
                          onClick={() => performBulkAction('export')}
                          disabled={isProcessingBulk}
                        >
                          {isProcessingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          <span className="ml-1.5 text-xs font-medium">Export</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Export selected</TooltipContent>
                    </Tooltip>

                    {selectedContracts.size === 2 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 border-0 h-8 px-3 rounded-lg transition-colors"
                            onClick={() => {
                              const ids = Array.from(selectedContracts);
                              router.push(`/compare?contract1=${ids[0]}&contract2=${ids[1]}`);
                            }}
                            disabled={isProcessingBulk}
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span className="ml-1.5 text-xs font-medium">Compare</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Compare side-by-side</TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-slate-700 hover:bg-slate-600 text-slate-200 border-0 h-8 px-3 rounded-lg transition-colors"
                          onClick={() => performBulkAction('share')}
                          disabled={isProcessingBulk}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          <span className="ml-1.5 text-xs font-medium">Share</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Share selected</TooltipContent>
                    </Tooltip>

                    <div className="w-px h-5 bg-slate-700 mx-0.5" />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-500 text-white border-0 h-8 px-3 rounded-lg transition-colors"
                          onClick={handleBulkDeleteClick}
                          disabled={isProcessingBulk}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="ml-1.5 text-xs font-medium">Delete</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Delete selected</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </TooltipProvider>
  );
}
