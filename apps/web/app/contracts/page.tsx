/**
 * Simplified Contracts List Page
 * Clean, focused UI with essential features only
 */

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-12 w-12 text-blue-600" />
            </motion.div>
            <p className="text-gray-600 animate-pulse">Loading contracts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div 
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Contracts
            </h1>
            <p className="text-gray-600 mt-1">
              Manage and view all your contracts
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={fetchContracts}
              className="hover:bg-blue-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg">
              <Link href="/upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload Contract
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-4 gap-6" 
          data-testid="contracts-stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card data-testid="stat-total" className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Contracts</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {Array.isArray(contracts) ? contracts.length : 0}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-active" className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-3xl font-bold text-green-600">
                    {Array.isArray(contracts) ? contracts.filter((c) => c.status === "completed").length : 0}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
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
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-value" className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(
                      Array.isArray(contracts) ? contracts.reduce((sum, c) => sum + (c.value || 0), 0) : 0
                    )}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search contracts by title, client, or supplier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-gray-200 focus:border-blue-400 focus:ring-blue-400"
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
        </motion.div>

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
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="pt-6">
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
              className="space-y-4" 
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
