/**
 * Simplified Contracts List Page
 * Clean, focused UI with essential features only
 */

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDataMode } from "@/contexts/DataModeContext";

interface Contract {
  id: string;
  title: string;
  status: string;
  parties?: {
    client?: string;
    supplier?: string;
  };
  value?: number;
  effectiveDate?: string;
  expirationDate?: string;
  riskScore?: number;
  uploadedAt?: string;
  error?: string;
  processing?: {
    progress: number;
    currentStage: string;
  };
}

export default function ContractsPage() {
  const router = useRouter();
  const { dataMode } = useDataMode();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/contracts/list", {
        headers: {
          "X-Data-Mode": dataMode,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch contracts");

      const result = await response.json();
      setContracts(result.data || []);
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setLoading(false);
    }
  }, [dataMode]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const filteredContracts = useMemo(() => contracts.filter((contract) => {
    const matchesSearch =
      searchQuery === "" ||
      contract.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.parties?.client?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.parties?.supplier?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || contract.status === statusFilter;

    return matchesSearch && matchesStatus;
  }), [contracts, searchQuery, statusFilter]);

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
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contracts</h1>
            <p className="text-gray-600 mt-1">
              Manage and view all your contracts
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={fetchContracts}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload Contract
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6" data-testid="contracts-stats">
          <Card data-testid="stat-total">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Contracts</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {contracts.length}
                  </p>
                </div>
                <FileText className="h-10 w-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-active">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {contracts.filter((c) => c.status === "completed").length}
                  </p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-processing">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Processing</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {contracts.filter((c) => c.status === "processing").length}
                  </p>
                </div>
                <Loader2 className="h-10 w-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-value">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(
                      contracts.reduce((sum, c) => sum + (c.value || 0), 0)
                    )}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contracts by title, client, or supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="contract-search"
                />
              </div>
              <div className="flex gap-2" data-testid="status-filters">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                  data-testid="filter-all"
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === "completed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("completed")}
                  data-testid="filter-active"
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === "processing" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("processing")}
                  data-testid="filter-processing"
                >
                  Processing
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contracts List */}
        {filteredContracts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No contracts found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Upload your first contract to get started"}
                </p>
                <Button asChild>
                  <Link href="/upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Contract
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="contracts-list">
            {filteredContracts.map((contract) => (
              <Card
                key={contract.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/contracts/${contract.id}`)}
                data-testid="contract-card"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
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

                    {/* Action Button */}
                    <Link href={`/contracts/${contract.id}`}>
                      <Button
                        size="sm"
                        className="ml-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
