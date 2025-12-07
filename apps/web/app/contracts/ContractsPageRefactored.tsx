/**
 * Contracts Page - Refactored Version
 * 
 * This is a streamlined version of the contracts page that uses
 * the modular hooks and components for better maintainability.
 * 
 * Can be gradually integrated into the main page.tsx
 */

'use client';

import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// UI Components
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Icons
import {
  FileText,
  Search,
  Plus,
  Upload,
  RefreshCw,
  Filter,
  X,
  LayoutGrid,
  LayoutList,
  GanttChartSquare,
  Kanban,
  Download,
  Trash2,
  Share2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Tag,
  Settings,
  Eye,
  Pencil,
  ClipboardCheck,
  Brain,
} from 'lucide-react';

// Contract Components
import { ContractTimeline } from '@/components/contracts/ContractTimeline';
import { ContractKanban } from '@/components/contracts/ContractKanban';
import { CategoryBadge } from '@/components/contracts/CategoryComponents';
import {
  NoContracts,
  NoResults,
  LoadingState,
  UncategorizedBanner,
} from '@/components/contracts/EmptyStates';
import { PaginationControls } from '@/components/contracts/PaginationControls';

// Hooks
import { useContracts, type Contract } from '@/hooks/use-queries';
import { useDataMode } from '@/contexts/DataModeContext';
import { usePagination } from '@/hooks/use-pagination';

// Collaboration Components
import { ShareDialog } from '@/components/collaboration/ShareDialog';
import { SubmitForApprovalModal } from '@/components/collaboration/SubmitForApprovalModal';

// Utils
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'compact' | 'cards' | 'timeline' | 'kanban';
type SortField = 'title' | 'createdAt' | 'value' | 'expirationDate' | 'status';
type SortDirection = 'asc' | 'desc';

interface TaxonomyCategory {
  id: string;
  name: string;
  color: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const VIEW_MODES = [
  { id: 'compact', label: 'List', icon: LayoutList },
  { id: 'cards', label: 'Cards', icon: LayoutGrid },
  { id: 'timeline', label: 'Timeline', icon: GanttChartSquare },
  { id: 'kanban', label: 'Kanban', icon: Kanban },
] as const;

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Active' },
  { value: 'processing', label: 'Processing' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'title', label: 'Name' },
  { value: 'value', label: 'Value' },
  { value: 'expirationDate', label: 'Expiration' },
];

// ============================================================================
// Utility Functions
// ============================================================================

const formatCurrency = (value?: number): string => {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date?: string | Date): string => {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'MMM d, yyyy');
  } catch {
    return '-';
  }
};

// ============================================================================
// Sub-components
// ============================================================================

interface ContractRowProps {
  contract: Contract;
  isSelected: boolean;
  onToggleSelect: () => void;
  onView: () => void;
  onShare: () => void;
  onDelete: () => void;
}

const ContractRow = memo(function ContractRow({
  contract,
  isSelected,
  onToggleSelect,
  onView,
  onShare,
  onDelete,
}: ContractRowProps) {
  const router = useRouter();
  
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      active: 'bg-green-100 text-green-800',
      processing: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'group flex items-center gap-4 p-4 border rounded-lg bg-card transition-colors',
        'hover:bg-muted/50 cursor-pointer',
        isSelected && 'bg-primary/5 border-primary/30'
      )}
      onClick={onView}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium truncate">{contract.title}</span>
          {(contract as any).hasArtifacts && (
            <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {(contract.parties?.supplier || contract.parties?.client) && (
            <span className="truncate">{contract.parties?.supplier || contract.parties?.client}</span>
          )}
          {contract.expirationDate && (
            <span>{formatDate(contract.expirationDate)}</span>
          )}
        </div>
      </div>

      {contract.category && (
        <CategoryBadge
          category={typeof contract.category === 'string' ? contract.category : contract.category.name}
          color={typeof contract.category === 'string' ? undefined : contract.category.color}
          size="sm"
        />
      )}

      <Badge className={getStatusColor(contract.status)}>
        {contract.status === 'completed' ? 'Active' : contract.status}
      </Badge>

      <div className="hidden md:block text-sm font-medium min-w-[80px] text-right">
        {formatCurrency(contract.value)}
      </div>

      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onView}>
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShare}>
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/contracts/${contract.id}`)}>
              <Eye className="h-4 w-4 mr-2" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/contracts/${contract.id}?tab=ai`)}>
              <Brain className="h-4 w-4 mr-2" /> AI Analysis
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export default function ContractsPageRefactored() {
  const router = useRouter();
  const { dataMode } = useDataMode();
  
  // Data fetching
  const { data: contractsData, isLoading, error, refetch } = useContracts();
  const contracts = Array.isArray(contractsData) 
    ? contractsData 
    : (contractsData?.contracts || []);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modal state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareContractId, setShareContractId] = useState<string | null>(null);
  const [shareContractTitle, setShareContractTitle] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteContractId, setDeleteContractId] = useState<string | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalContractId, setApprovalContractId] = useState<string | null>(null);
  const [approvalContractTitle, setApprovalContractTitle] = useState('');

  // Categories
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/taxonomy/categories', {
          headers: { 'x-tenant-id': 'demo' },
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Filter and sort contracts
  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.title?.toLowerCase().includes(query) ||
        c.parties?.vendor?.toLowerCase().includes(query) ||
        c.parties?.client?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    // Category filter
    if (categoryFilter) {
      result = result.filter(c => c.category?.id === categoryFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'title':
          aVal = a.title || '';
          bVal = b.title || '';
          break;
        case 'value':
          aVal = a.value || 0;
          bVal = b.value || 0;
          break;
        case 'expirationDate':
          aVal = a.expirationDate ? new Date(a.expirationDate).getTime() : 0;
          bVal = b.expirationDate ? new Date(b.expirationDate).getTime() : 0;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [contracts, searchQuery, statusFilter, categoryFilter, sortField, sortDirection]);

  // Pagination
  const {
    state: { currentPage, pageSize, totalPages, totalItems },
    actions: { setPage, setPageSize },
    paginatedItems,
  } = usePagination(filteredContracts, 25);

  // Uncategorized count
  const uncategorizedCount = useMemo(() => {
    return contracts.filter((c: Contract) => !c.category).length;
  }, [contracts]);

  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const visibleIds = paginatedItems.map(c => c.id);
    const allSelected = visibleIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  }, [paginatedItems, selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Action handlers
  const handleView = useCallback((contractId: string) => {
    router.push(`/contracts/${contractId}`);
  }, [router]);

  const handleShare = useCallback((contract: Contract) => {
    setShareContractId(contract.id);
    setShareContractTitle(contract.title);
    setShareDialogOpen(true);
  }, []);

  const handleDeleteRequest = useCallback((contractId: string) => {
    setDeleteContractId(contractId);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteContractId) return;
    
    try {
      const res = await fetch(`/api/contracts/${deleteContractId}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': 'demo', 'x-data-mode': dataMode },
      });
      
      if (!res.ok) throw new Error('Delete failed');
      
      toast.success('Contract deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete contract');
    } finally {
      setDeleteDialogOpen(false);
      setDeleteContractId(null);
    }
  }, [deleteContractId, dataMode, refetch]);

  const handleBulkCategorize = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    try {
      toast.info('Categorizing contracts...');
      const res = await fetch('/api/contracts/bulk-categorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo',
          'x-data-mode': dataMode,
        },
        body: JSON.stringify({ contractIds: Array.from(selectedIds) }),
      });
      
      if (!res.ok) throw new Error('Categorization failed');
      
      const data = await res.json();
      toast.success(`Categorized ${data.data?.results?.filter((r: any) => r.success).length || 0} contracts`);
      refetch();
      clearSelection();
    } catch (err) {
      toast.error('Failed to categorize contracts');
    }
  }, [selectedIds, dataMode, refetch, clearSelection]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryFilter(null);
  }, []);

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || categoryFilter;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'Escape') {
        clearSelection();
        setSearchQuery('');
      }
      
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
      }
      
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        refetch();
        toast.info('Refreshing...');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection, refetch]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingState message="Loading contracts..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Failed to load contracts</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (contracts.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <NoContracts onUpload={() => router.push('/upload')} />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Contracts</h1>
            <p className="text-muted-foreground">
              {filteredContracts.length} of {contracts.length} contracts
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Link>
            </Button>
          </div>
        </div>

        {/* Uncategorized Banner */}
        {uncategorizedCount > 0 && (
          <UncategorizedBanner
            count={uncategorizedCount}
            onCategorize={() => {
              // Select uncategorized contracts and trigger bulk categorize
              const uncategorizedIds = contracts
                .filter((c: Contract) => !c.category)
                .map((c: Contract) => c.id);
              setSelectedIds(new Set(uncategorizedIds));
            }}
          />
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contracts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-search-input
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {STATUS_FILTERS.map(status => (
              <Button
                key={status.value}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 px-3 rounded-md',
                  statusFilter === status.value && 'bg-background shadow-sm'
                )}
                onClick={() => setStatusFilter(status.value)}
              >
                {status.label}
              </Button>
            ))}
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Tag className="h-4 w-4" />
                  Category
                  {categoryFilter && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setCategoryFilter(null)}>
                  All Categories
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {categories.map(cat => (
                  <DropdownMenuItem
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={cn(categoryFilter === cat.id && 'bg-accent')}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full mr-2"
                      style={{ backgroundColor: cat.color || '#888' }}
                    />
                    {cat.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Sort: {SORT_OPTIONS.find(o => o.value === sortField)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORT_OPTIONS.map(option => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => {
                    if (sortField === option.value) {
                      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField(option.value as SortField);
                      setSortDirection('desc');
                    }
                  }}
                >
                  {option.label}
                  {sortField === option.value && (
                    <span className="ml-2 text-xs">
                      ({sortDirection === 'asc' ? '↑' : '↓'})
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Mode */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {VIEW_MODES.map(mode => {
              const Icon = mode.icon;
              return (
                <Tooltip key={mode.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8 rounded-md',
                        viewMode === mode.id && 'bg-background shadow-sm'
                      )}
                      onClick={() => setViewMode(mode.id as ViewMode)}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{mode.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}

          {/* Taxonomy Link */}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings/taxonomy">
              <Settings className="h-4 w-4 mr-2" />
              Manage Categories
            </Link>
          </Button>
        </div>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={paginatedItems.every(c => selectedIds.has(c.id))}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleBulkCategorize}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-categorize
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Contract List */}
        {paginatedItems.length === 0 ? (
          <NoResults
            searchTerm={searchQuery}
            hasFilters={!!hasActiveFilters}
            onClearSearch={() => setSearchQuery('')}
            onClearFilters={clearFilters}
          />
        ) : viewMode === 'compact' ? (
          <div className="space-y-2">
            {/* Select All Header */}
            <div className="flex items-center gap-4 px-4 py-2 border-b">
              <Checkbox
                checked={paginatedItems.every(c => selectedIds.has(c.id))}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                {paginatedItems.length} contracts
              </span>
            </div>

            <AnimatePresence mode="popLayout">
              {paginatedItems.map(contract => (
                <ContractRow
                  key={contract.id}
                  contract={contract}
                  isSelected={selectedIds.has(contract.id)}
                  onToggleSelect={() => toggleSelect(contract.id)}
                  onView={() => handleView(contract.id)}
                  onShare={() => handleShare(contract)}
                  onDelete={() => handleDeleteRequest(contract.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedItems.map(contract => (
              <Card
                key={contract.id}
                className={cn(
                  'cursor-pointer hover:shadow-md transition-all',
                  selectedIds.has(contract.id) && 'ring-2 ring-primary'
                )}
                onClick={() => handleView(contract.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.has(contract.id)}
                        onCheckedChange={() => toggleSelect(contract.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <h3 className="font-medium truncate">{contract.title}</h3>
                    </div>
                    {contract.hasArtifacts && (
                      <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                  
                  {contract.parties?.vendor && (
                    <p className="text-sm text-muted-foreground mb-2 truncate">
                      {contract.parties.vendor}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge className={cn(
                      contract.status === 'completed' ? 'bg-green-100 text-green-800' :
                      contract.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      contract.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    )}>
                      {contract.status === 'completed' ? 'Active' : contract.status}
                    </Badge>
                    {contract.category && (
                      <CategoryBadge
                        category={typeof contract.category === 'string' ? contract.category : contract.category.name}
                        color={typeof contract.category === 'string' ? undefined : contract.category.color}
                        size="sm"
                      />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t text-sm">
                    <span className="text-muted-foreground">
                      {formatDate(contract.expirationDate)}
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(contract.value)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : viewMode === 'timeline' ? (
          <ContractTimeline
            contracts={paginatedItems as any}
            onContractClick={(contractId) => handleView(contractId)}
          />
        ) : (
          <ContractKanban
            contracts={paginatedItems as any}
            onContractClick={(contractId) => router.push(`/contracts/${contractId}`)}
            onStatusChange={async (id, status) => {
              // Handle status change
              toast.info('Status update not implemented');
            }}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}

        {/* Dialogs */}
        <ShareDialog
          isOpen={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          documentType="contract"
          documentId={shareContractId || ''}
          documentTitle={shareContractTitle}
        />

        <SubmitForApprovalModal
          isOpen={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          contractId={approvalContractId || ''}
          contractTitle={approvalContractTitle}
          onSuccess={() => {
            refetch();
            setApprovalModalOpen(false);
          }}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Contract"
          description="Are you sure you want to delete this contract? This action cannot be undone."
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </TooltipProvider>
  );
}
