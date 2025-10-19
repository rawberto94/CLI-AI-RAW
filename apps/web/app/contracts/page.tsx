"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Upload,
  Eye,
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  DollarSign,
  Shield,
  Users,
  RefreshCw,
  Save,
  Table,
  Grid,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContractListSkeleton } from "@/components/ui/skeletons";
import { NoContractsEmptyState, NoFilterResultsEmptyState } from "@/components/ui/empty-states";
import {
  getStatusDisplay,
  formatFileSize,
  formatCurrency,
  formatDateTime,
  getContractSummary,
  type Contract,
} from "@/lib/contracts/contracts-data-service";
import {
  ContractFiltersPanel,
  type FilterOptions,
} from "@/components/contracts/ContractFiltersPanel";
import {
  filterContracts,
  sortContracts,
  getDefaultFilters,
  extractPartiesFromContracts,
  type SortOption,
} from "@/lib/contracts/filter-utils";
import { BulkActionsToolbar } from "@/components/contracts/BulkActionsToolbar";
import { SavedFiltersPanel } from "@/components/contracts/SavedFiltersPanel";
import { getContractTags, getTagById, getTagColor } from "@/lib/contracts/tags";
import { getDefaultFilter } from "@/lib/contracts/saved-filters";
import { TableView } from "@/components/contracts/TableView";
import { ColumnCustomizer } from "@/components/contracts/ColumnCustomizer";
import {
  DEFAULT_COLUMNS,
  type TableColumn,
} from "@/lib/contracts/table-config";
import {
  loadViewPreferences,
  saveViewPreferences,
  type ViewMode,
} from "@/lib/contracts/view-preferences";
import { ComparisonSelector } from "@/components/contracts/ComparisonSelector";
import { ComparisonView } from "@/components/contracts/ComparisonView";

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>(getDefaultFilters());
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [showFilters, setShowFilters] = useState(false);

  // Step 1: Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSavedFilters, setShowSavedFilters] = useState(false);

  // Step 2: Table view state
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [columns, setColumns] = useState<TableColumn[]>(DEFAULT_COLUMNS);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [tableSortBy, setTableSortBy] = useState<string>("date");
  const [tableSortDirection, setTableSortDirection] = useState<"asc" | "desc">(
    "desc"
  );

  // Step 3: Comparison state
  const [showComparisonSelector, setShowComparisonSelector] = useState(false);
  const [showComparisonView, setShowComparisonView] = useState(false);
  const [comparisonContracts, setComparisonContracts] = useState<Contract[]>(
    []
  );

  // Extract unique clients and suppliers
  const { clients: availableClients, suppliers: availableSuppliers } =
    useMemo(() => {
      return extractPartiesFromContracts(contracts);
    }, [contracts]);

  // Filtered and sorted contracts
  const filteredContracts = useMemo(() => {
    const filtered = filterContracts(contracts, filters);
    return sortContracts(filtered, sortBy);
  }, [contracts, filters, sortBy]);

  // Step 1: Selection handlers
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredContracts.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isSelected = (id: string) => selectedIds.has(id);

  useEffect(() => {
    fetchContracts();
  }, []);

  // Step 1: Load default filter on mount
  useEffect(() => {
    const defaultFilter = getDefaultFilter();
    if (defaultFilter) {
      setFilters(defaultFilter.filters);
    }
  }, []);

  // Step 2: Load view preferences on mount
  useEffect(() => {
    const prefs = loadViewPreferences();
    setViewMode(prefs.viewMode);
    setColumns(prefs.columns);
  }, []);

  // Step 1: Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Select all
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }
      // Clear selection
      if (e.key === "Escape") {
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredContracts]);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/contracts/list");

      if (!response.ok) {
        throw new Error(
          `Failed to fetch contracts: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.success) {
        setContracts(data.data?.contracts || []);
      } else {
        throw new Error(data.error || "Failed to load contracts");
      }
    } catch (err) {
      console.error("Error fetching contracts:", err);
      setError(err instanceof Error ? err.message : "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setFilters(getDefaultFilters());
  };

  // Step 2: View mode handlers
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    saveViewPreferences({ viewMode: mode, columns });
  };

  const handleColumnsChange = (newColumns: TableColumn[]) => {
    setColumns(newColumns);
    saveViewPreferences({ viewMode, columns: newColumns });
  };

  const handleTableSort = (columnId: string) => {
    if (tableSortBy === columnId) {
      setTableSortDirection(tableSortDirection === "asc" ? "desc" : "asc");
    } else {
      setTableSortBy(columnId);
      setTableSortDirection("desc");
    }
  };

  // Step 3: Comparison handlers
  const handleCompareClick = () => {
    if (selectedIds.size < 2) {
      alert("Please select at least 2 contracts to compare");
      return;
    }
    if (selectedIds.size > 4) {
      alert("You can compare up to 4 contracts at once");
      return;
    }
    setShowComparisonSelector(true);
  };

  const handleCompare = (contractIds: string[]) => {
    const contractsToCompare = contracts.filter((c) =>
      contractIds.includes(c.id)
    );
    setComparisonContracts(contractsToCompare);
    setShowComparisonSelector(false);
    setShowComparisonView(true);
  };

  const handleCloseComparison = () => {
    setShowComparisonView(false);
    setComparisonContracts([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <ContractListSkeleton count={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Error Loading Contracts
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={fetchContracts} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Link href="/contracts/upload">
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Contract
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <FileText className="w-8 h-8 text-white" />
              </div>
              Contracts
            </h1>
            <p className="text-gray-600 mt-2 text-lg">
              Manage and analyze your contract portfolio
            </p>
          </div>
          <Link href="/contracts/upload">
            <Button
              size="lg"
              className="shadow-lg bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Contract
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-md border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Contracts</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {contracts.length}
                  </p>
                  {filteredContracts.length !== contracts.length && (
                    <p className="text-xs text-gray-500 mt-1">
                      {filteredContracts.length} filtered
                    </p>
                  )}
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-3xl font-bold text-green-600">
                    {contracts.filter((c) => c.status === "completed").length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Processing</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {contracts.filter((c) => c.status === "processing").length}
                  </p>
                </div>
                <Loader2 className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-3xl font-bold text-red-600">
                    {contracts.filter((c) => c.status === "failed").length}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 1: Saved Filters Panel */}
        {showSavedFilters && (
          <SavedFiltersPanel
            currentFilters={filters}
            onApply={(newFilters) => {
              setFilters(newFilters);
              setShowSavedFilters(false);
            }}
            onClose={() => setShowSavedFilters(false)}
          />
        )}

        {/* Filters */}
        {showFilters && (
          <ContractFiltersPanel
            filters={filters}
            onFiltersChange={setFilters}
            onReset={handleResetFilters}
            availableClients={availableClients}
            availableSuppliers={availableSuppliers}
          />
        )}

        {/* Contracts List */}
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-2xl">
                {filteredContracts.length === contracts.length
                  ? "All Contracts"
                  : `Filtered Contracts (${filteredContracts.length}/${contracts.length})`}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Step 2: View Mode Toggle */}
                <div className="flex items-center gap-1 border border-gray-300 rounded-md p-1">
                  <Button
                    variant={viewMode === "card" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("card")}
                    className="h-8"
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("table")}
                    className="h-8"
                  >
                    <Table className="w-4 h-4" />
                  </Button>
                </div>

                {/* Step 2: Column Customizer (only in table view) */}
                {viewMode === "table" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowColumnCustomizer(true)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Columns
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSavedFilters(!showSavedFilters)}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Saved Filters
                </Button>
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </Button>

                {/* Only show sort dropdown in card view */}
                {viewMode === "card" && (
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="value-desc">Highest Value</option>
                    <option value="value-asc">Lowest Value</option>
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                    <option value="risk-desc">Highest Risk</option>
                    <option value="risk-asc">Lowest Risk</option>
                  </select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {contracts.length === 0 ? (
              <NoContractsEmptyState
                onUpload={() => router.push('/contracts/upload')}
              />
            ) : filteredContracts.length === 0 ? (
              <NoFilterResultsEmptyState
                onClearFilters={handleResetFilters}
              />
            ) : viewMode === "table" ? (
              /* Step 2: Table View */
              <TableView
                contracts={filteredContracts}
                columns={columns}
                selectedIds={selectedIds}
                onToggleSelection={toggleSelection}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                onSort={handleTableSort}
                sortBy={tableSortBy}
                sortDirection={tableSortDirection}
              />
            ) : (
              /* Card View */
              <div className="space-y-4">
                {filteredContracts.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    isSelected={isSelected(contract.id)}
                    onToggleSelection={toggleSelection}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Step 1: Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        onClearSelection={clearSelection}
        onActionComplete={() => {
          fetchContracts();
          clearSelection();
        }}
        onCompare={handleCompareClick}
      />

      {/* Step 2: Column Customizer Modal */}
      {showColumnCustomizer && (
        <ColumnCustomizer
          columns={columns}
          onColumnsChange={handleColumnsChange}
          onClose={() => setShowColumnCustomizer(false)}
        />
      )}

      {/* Step 3: Comparison Selector Modal */}
      {showComparisonSelector && (
        <ComparisonSelector
          contracts={contracts}
          preselectedIds={Array.from(selectedIds)}
          onCompare={handleCompare}
          onClose={() => setShowComparisonSelector(false)}
        />
      )}

      {/* Step 3: Comparison View */}
      {showComparisonView && comparisonContracts.length > 0 && (
        <ComparisonView
          contracts={comparisonContracts}
          onClose={handleCloseComparison}
        />
      )}
    </div>
  );
}

// Contract Card Component with Step 1 features
interface ContractCardProps {
  contract: Contract;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

function ContractCard({
  contract,
  isSelected,
  onToggleSelection,
}: ContractCardProps) {
  const statusDisplay = getStatusDisplay(contract.status);
  const summary = getContractSummary(contract);
  const contractTags = getContractTags(contract.id);

  const getStatusIcon = () => {
    switch (contract.status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case "failed":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all bg-white">
      <div className="flex items-start gap-4">
        {/* Step 1: Checkbox */}
        {onToggleSelection && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(contract.id)}
            className="mt-1 w-5 h-5 text-blue-600 rounded cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Contract Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {getStatusIcon()}
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {contract.filename ||
                contract.originalName ||
                "Untitled Contract"}
            </h3>
            <Badge
              className={`
                ${
                  statusDisplay.color === "green"
                    ? "bg-green-100 text-green-800"
                    : ""
                }
                ${
                  statusDisplay.color === "blue"
                    ? "bg-blue-100 text-blue-800"
                    : ""
                }
                ${
                  statusDisplay.color === "red" ? "bg-red-100 text-red-800" : ""
                }
                ${
                  statusDisplay.color === "yellow"
                    ? "bg-yellow-100 text-yellow-800"
                    : ""
                }
                ${
                  statusDisplay.color === "gray"
                    ? "bg-gray-100 text-gray-800"
                    : ""
                }
              `}
            >
              {statusDisplay.label}
            </Badge>

            {/* Step 1: Tags Display */}
            {contractTags.map((tagId) => {
              const tag = getTagById(tagId);
              if (!tag) return null;
              return (
                <Badge
                  key={tagId}
                  className={getTagColor(tag.color) + " text-xs border"}
                >
                  {tag.name}
                </Badge>
              );
            })}
          </div>

          {/* Contract Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{formatDateTime(contract.uploadDate)}</span>
            </div>

            <div className="flex items-center gap-2 text-gray-600">
              <FileText className="w-4 h-4" />
              <span>{formatFileSize(contract.fileSize)}</span>
            </div>

            {summary.parties && summary.parties.length > 0 && (
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-4 h-4" />
                <span className="truncate">
                  {summary.parties.length} parties
                </span>
              </div>
            )}

            {summary.totalValue && (
              <div className="flex items-center gap-2 text-gray-600">
                <DollarSign className="w-4 h-4" />
                <span>
                  {formatCurrency(summary.totalValue, summary.currency)}
                </span>
              </div>
            )}
          </div>

          {/* Additional Info */}
          {contract.status === "completed" && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              {summary.riskScore !== undefined && (
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">
                    Risk:{" "}
                    <span
                      className={`font-medium ${
                        summary.riskScore >= 80
                          ? "text-red-600"
                          : summary.riskScore >= 50
                          ? "text-yellow-600"
                          : "text-green-600"
                      }`}
                    >
                      {summary.riskScore}
                    </span>
                  </span>
                </div>
              )}
              {summary.complianceScore !== undefined && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">
                    Compliance:{" "}
                    <span
                      className={`font-medium ${
                        summary.complianceScore >= 90
                          ? "text-green-600"
                          : summary.complianceScore >= 70
                          ? "text-blue-600"
                          : summary.complianceScore >= 50
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {summary.complianceScore}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Processing Progress */}
          {contract.status === "processing" && contract.processing && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>{contract.processing.currentStage}</span>
                <span>{contract.processing.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${contract.processing.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {contract.status === "failed" && contract.error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">
              {contract.error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link href={`/contracts/${contract.id}`}>
            <Button size="sm" variant="outline" className="w-full">
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
          </Link>
          {contract.status === "completed" && (
            <Button size="sm" variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
