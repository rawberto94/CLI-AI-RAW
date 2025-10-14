"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Upload,
  Filter,
  Search,
  Grid,
  List,
  Calendar,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  AdvancedFilterPanel,
  type FilterOptions,
} from "@/components/contracts/AdvancedFilterPanel";
import { AIContractChat } from "@/components/contracts/AIContractChat";
import { useRouter } from "next/navigation";

interface Contract {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  clientName: string;
  supplierName: string;
  contractTitle: string;
  description?: string;
  category: string;
  totalValue?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  status: string;
  uploadedAt: Date;
  viewCount: number;
  riskScore?: number;
  complianceScore?: number;
}

export default function EnhancedContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({});

  // Mock facets for filter panel (replace with actual API data)
  const facets = {
    clients: [
      { name: "ACME Corporation", count: 12 },
      { name: "TechVendor Inc", count: 8 },
      { name: "Global Logistics", count: 6 },
      { name: "Premium Consulting", count: 4 },
    ],
    suppliers: [
      { name: "ABC Supplies", count: 10 },
      { name: "XYZ Services", count: 7 },
      { name: "Cloud Solutions Ltd", count: 5 },
      { name: "Data Systems Inc", count: 3 },
    ],
    categories: [
      { name: "Service Agreement", count: 15 },
      { name: "Supply Contract", count: 10 },
      { name: "Licensing", count: 8 },
      { name: "Consulting", count: 7 },
    ],
    statuses: [
      { name: "Active", count: 20 },
      { name: "Pending Review", count: 8 },
      { name: "Expired", count: 5 },
      { name: "Under Negotiation", count: 3 },
    ],
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/contracts");
      const data = await response.json();

      if (data.success) {
        setContracts(data.contracts || []);
      } else {
        console.error("Failed to fetch contracts:", data.error);
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleContractSelect = (contractId: string) => {
    router.push(`/contracts/${contractId}`);
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    // Apply filters to contracts
    console.log("Filters changed:", newFilters);
  };

  const applyFilters = (contracts: Contract[]): Contract[] => {
    let filtered = [...contracts];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.contractTitle.toLowerCase().includes(query) ||
          c.clientName.toLowerCase().includes(query) ||
          c.supplierName.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query)
      );
    }

    // Apply client filter
    if (filters.clients && filters.clients.length > 0) {
      filtered = filtered.filter((c) =>
        filters.clients!.includes(c.clientName)
      );
    }

    // Apply supplier filter
    if (filters.suppliers && filters.suppliers.length > 0) {
      filtered = filtered.filter((c) =>
        filters.suppliers!.includes(c.supplierName)
      );
    }

    // Apply value range filter
    if (filters.valueRange) {
      filtered = filtered.filter(
        (c) =>
          c.totalValue !== undefined &&
          c.totalValue >= filters.valueRange!.min &&
          c.totalValue <= filters.valueRange!.max
      );
    }

    // Apply currency filter
    if (filters.currencies && filters.currencies.length > 0) {
      filtered = filtered.filter(
        (c) => c.currency && filters.currencies!.includes(c.currency)
      );
    }

    // Apply category filter
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter((c) =>
        filters.categories!.includes(c.category)
      );
    }

    // Apply status filter
    if (filters.statuses && filters.statuses.length > 0) {
      filtered = filtered.filter((c) => filters.statuses!.includes(c.status));
    }

    return filtered;
  };

  const filteredContracts = applyFilters(contracts);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading contracts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Contract Intelligence
          </h1>
          <p className="mt-2 text-gray-600">
            Manage and analyze your contract portfolio with AI-powered insights
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Contracts
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {contracts.length}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Value
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    $
                    {contracts
                      .reduce((sum, c) => sum + (c.totalValue || 0), 0)
                      .toLocaleString()}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Active Contracts
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {contracts.filter((c) => c.status === "Active").length}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">High Risk</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {contracts.filter((c) => (c.riskScore || 0) > 70).length}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search contracts by title, client, supplier, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
            {Object.keys(filters).length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {Object.keys(filters).length}
              </Badge>
            )}
          </Button>

          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          <Link href="/contracts/upload">
            <Button className="gap-2">
              <Upload className="w-4 h-4" />
              Upload Contract
            </Button>
          </Link>
        </div>

        <div className="flex gap-6">
          {/* Filter Panel */}
          {showFilters && (
            <div className="w-80 flex-shrink-0">
              <AdvancedFilterPanel
                filters={filters}
                onFilterChange={handleFilterChange}
                facets={facets}
                onClose={() => setShowFilters(false)}
              />
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1">
            {filteredContracts.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No contracts found
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {contracts.length === 0
                      ? "Get started by uploading your first contract"
                      : "Try adjusting your filters or search query"}
                  </p>
                  <Link href="/contracts/upload">
                    <Button>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Contract
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContracts.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    onClick={() => handleContractSelect(contract.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContracts.map((contract) => (
                  <ContractListItem
                    key={contract.id}
                    contract={contract}
                    onClick={() => handleContractSelect(contract.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Chat Assistant */}
      <AIContractChat onContractSelect={handleContractSelect} />
    </div>
  );
}

function ContractCard({
  contract,
  onClick,
}: {
  contract: Contract;
  onClick: () => void;
}) {
  return (
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <FileText className="w-8 h-8 text-blue-600" />
          <Badge
            variant={contract.status === "Active" ? "default" : "secondary"}
          >
            {contract.status}
          </Badge>
        </div>
        <CardTitle className="text-lg line-clamp-2 mt-3">
          {contract.contractTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              {contract.clientName} ↔ {contract.supplierName}
            </span>
          </div>

          {contract.totalValue && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-900">
                {contract.currency} {contract.totalValue.toLocaleString()}
              </span>
            </div>
          )}

          {contract.endDate && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                Expires: {new Date(contract.endDate).toLocaleDateString()}
              </span>
            </div>
          )}

          {contract.riskScore !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Risk:</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    contract.riskScore > 70
                      ? "bg-red-500"
                      : contract.riskScore > 40
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${contract.riskScore}%` }}
                />
              </div>
              <span className="text-sm font-medium">{contract.riskScore}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ContractListItem({
  contract,
  onClick,
}: {
  contract: Contract;
  onClick: () => void;
}) {
  return (
    <Card
      className="hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {contract.contractTitle}
            </h3>
            <p className="text-sm text-gray-600">
              {contract.clientName} ↔ {contract.supplierName}
            </p>
          </div>

          {contract.totalValue && (
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                {contract.currency} {contract.totalValue.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">{contract.category}</p>
            </div>
          )}

          <Badge
            variant={contract.status === "Active" ? "default" : "secondary"}
          >
            {contract.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
