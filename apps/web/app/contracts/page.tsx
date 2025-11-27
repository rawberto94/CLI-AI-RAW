/**
 * Simplified Contracts List Page
 * Clean, focused UI with essential features only
 */

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageBreadcrumb } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NoContracts, NoResults } from "@/components/ui/empty-states";
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

  const filteredContracts = useMemo(() => {
    if (!Array.isArray(contracts)) return [];
    
    return contracts.filter((contract) => {
      const matchesSearch =
        searchQuery === "" ||
        contract.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.parties?.client?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.parties?.supplier?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || contract.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [contracts, searchQuery, statusFilter]);

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
              onClick={fetchContracts}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Link href="/upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Link>
            </Button>
          </div>
        </div>

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
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search contracts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 input-base"
                  data-testid="contract-search"
                />
              </div>
              <div className="flex gap-2" data-testid="status-filters">
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
                </div>
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
                  whileHover={{ scale: 1.01, y: -2 }}
                  className="transform-gpu"
                >
                  <Card
                    className="border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer bg-white/80 backdrop-blur-sm group"
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
                        className="ml-4 bg-blue-600 hover:bg-blue-700 shadow-md group-hover:shadow-lg transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                        <ArrowUpRight className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
