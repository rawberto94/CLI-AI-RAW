"use client";

/**
 * Category Analytics Dashboard
 * 
 * Displays categorization metrics and insights:
 * - Categorization rate
 * - Category distribution chart
 * - Top categories by value
 * - Uncategorized contracts list
 * - Bulk categorization action
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTenantId } from '@/lib/tenant';
import {
  PieChart,
  BarChart3,
  TrendingUp,
  Tag,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  FileText,
  DollarSign,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from 'sonner';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CategoryData {
  name: string;
  count: number;
  value: number;
  color: string;
  icon: string;
  percentage: number;
}

interface AnalyticsData {
  summary: {
    totalContracts: number;
    categorizedCount: number;
    uncategorizedCount: number;
    categorizationRate: number;
    totalValue: number;
    categorizedValue: number;
    uncategorizedValue: number;
  };
  distribution: CategoryData[];
  topByValue: CategoryData[];
  levelDistribution: {
    l1Only: number;
    l2: number;
    none: number;
  };
  trend: Array<{ date: string; categorized: number; uncategorized: number }>;
  period: string;
}

// ============================================================================
// ICON MAP
// ============================================================================

const ICON_EMOJI: Record<string, string> = {
  folder: "📁",
  file: "📄",
  briefcase: "💼",
  building: "🏢",
  user: "👤",
  globe: "🌍",
  shield: "🛡️",
  lock: "🔒",
  key: "🔑",
  document: "📋",
  money: "💰",
  chart: "📊",
  calendar: "📅",
  lightning: "⚡",
  star: "⭐",
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; label: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/60">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-sm text-white/50 mt-1">{subtitle}</p>}
        </div>
        <div
          className="p-3 rounded-xl"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 text-sm">
          <TrendingUp
            className={`w-4 h-4 ${
              trend.value >= 0 ? "text-green-400" : "text-red-400"
            }`}
          />
          <span className={trend.value >= 0 ? "text-green-400" : "text-red-400"}>
            {trend.value >= 0 ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-white/50">{trend.label}</span>
        </div>
      )}
    </motion.div>
  );
}

function ProgressRing({
  percentage,
  size = 120,
  strokeWidth = 10,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <span className="text-3xl font-bold">{percentage}%</span>
          <p className="text-xs text-white/50">Categorized</p>
        </div>
      </div>
    </div>
  );
}

function CategoryBar({ category, maxCount }: { category: CategoryData; maxCount: number }) {
  const widthPercentage = (category.count / maxCount) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="group"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{ICON_EMOJI[category.icon] || "📁"}</span>
          <span className="font-medium">{category.name}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/60">{category.count} contracts</span>
          <span className="font-medium" style={{ color: category.color }}>
            {category.percentage}%
          </span>
        </div>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${widthPercentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: category.color }}
        />
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CategoryAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkCategorizing, setIsBulkCategorizing] = useState(false);
  const [period, setPeriod] = useState("30d");
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/taxonomy/analytics?period=${period}`, {
        headers: { "x-tenant-id": getTenantId() },
      });

      if (!response.ok) throw new Error("Failed to fetch analytics");

      const data = await response.json();
      setAnalytics(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Bulk categorize uncategorized contracts
  const handleBulkCategorize = async () => {
    try {
      setIsBulkCategorizing(true);

      // Get uncategorized contract IDs
      const contractsResponse = await fetch(
        "/api/contracts?category=null&limit=100",
        { headers: { "x-tenant-id": getTenantId() } }
      );

      if (!contractsResponse.ok) throw new Error("Failed to fetch contracts");

      const contractsData = await contractsResponse.json();
      const contractIds = contractsData.data?.map((c: any) => c.id) || [];

      if (contractIds.length === 0) {
        toast.info("No uncategorized contracts found.");
        return;
      }

      // Bulk categorize
      const categorizeResponse = await fetch("/api/contracts/categorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": getTenantId(),
        },
        body: JSON.stringify({
          contractIds,
          forceRecategorize: false,
          batchSize: 5,
        }),
      });

      const result = await categorizeResponse.json();

      if (result.success) {
        toast.success(
          `Categorized ${result.data.categorized}/${result.data.total} contracts`
        );
        fetchAnalytics();
      } else {
        throw new Error(result.error || "Categorization failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk categorization failed");
    } finally {
      setIsBulkCategorizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-lg font-medium">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-violet-500 rounded-lg hover:bg-violet-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const maxCategoryCount = Math.max(
    ...(Array.isArray(analytics.distribution) ? analytics.distribution.map((c) => c.count) : []),
    1
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Category Analytics</h1>
                <p className="text-white/50 text-sm">
                  Insights into your contract categorization
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <div className="flex bg-white/5 rounded-lg p-1">
                {["7d", "30d", "90d", "all"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      period === p
                        ? "bg-violet-500 text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {p === "all" ? "All Time" : p}
                  </button>
                ))}
              </div>

              <button
                onClick={fetchAnalytics}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Contracts"
            value={analytics.summary.totalContracts}
            subtitle={`${analytics.summary.categorizedCount} categorized`}
            icon={FileText}
            color="#3B82F6"
          />
          <StatCard
            title="Categorization Rate"
            value={`${analytics.summary.categorizationRate}%`}
            subtitle={`${analytics.summary.uncategorizedCount} uncategorized`}
            icon={Tag}
            color="#10B981"
          />
          <StatCard
            title="Categorized Value"
            value={formatCurrency(analytics.summary.categorizedValue)}
            subtitle="Total contract value"
            icon={DollarSign}
            color="#F59E0B"
          />
          <StatCard
            title="Categories Used"
            value={analytics.distribution.length}
            subtitle="Active categories"
            icon={PieChart}
            color="#8B5CF6"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Categorization Progress */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Categorization Progress
            </h3>

            <div className="flex flex-col items-center">
              <ProgressRing percentage={analytics.summary.categorizationRate} />

              <div className="mt-6 w-full space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Categorized</span>
                  <span className="font-medium text-green-400">
                    {analytics.summary.categorizedCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Uncategorized</span>
                  <span className="font-medium text-amber-400">
                    {analytics.summary.uncategorizedCount}
                  </span>
                </div>
              </div>

              {analytics.summary.uncategorizedCount > 0 && (
                <button
                  onClick={handleBulkCategorize}
                  disabled={isBulkCategorizing}
                  className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3
                           bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl
                           font-medium hover:opacity-90 transition-opacity
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkCategorizing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  Auto-Categorize All
                </button>
              )}
            </div>
          </div>

          {/* Category Distribution */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-violet-400" />
                Category Distribution
              </h3>
              <Link
                href="/settings/taxonomy"
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                Manage Categories
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {(!Array.isArray(analytics.distribution) || analytics.distribution.length === 0) ? (
              <div className="text-center py-12 text-white/50">
                <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No categorized contracts yet</p>
                <Link
                  href="/settings/taxonomy"
                  className="inline-block mt-4 px-4 py-2 bg-violet-500/20 text-violet-400 
                           rounded-lg hover:bg-violet-500/30 transition-colors"
                >
                  Set Up Categories
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.distribution.slice(0, 8).map((category, index) => (
                  <CategoryBar
                    key={category.name}
                    category={category}
                    maxCount={maxCategoryCount}
                  />
                ))}
                {analytics.distribution.length > 8 && (
                  <p className="text-center text-white/50 text-sm">
                    +{analytics.distribution.length - 8} more categories
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top Categories by Value */}
        {Array.isArray(analytics.topByValue) && analytics.topByValue.length > 0 && (
          <div className="mt-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              Top Categories by Value
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {analytics.topByValue.map((category, index) => (
                <motion.div
                  key={category.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-xl border transition-colors"
                  style={{
                    backgroundColor: `${category.color}10`,
                    borderColor: `${category.color}30`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{ICON_EMOJI[category.icon] || "📁"}</span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${category.color}20`,
                        color: category.color,
                      }}
                    >
                      #{index + 1}
                    </span>
                  </div>
                  <p className="font-semibold truncate">{category.name}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: category.color }}>
                    {formatCurrency(category.value)}
                  </p>
                  <p className="text-sm text-white/50">{category.count} contracts</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/settings/taxonomy"
            className="group p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10
                     hover:bg-white/10 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-lg">
                <Tag className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="font-medium">Manage Taxonomy</p>
                <p className="text-sm text-white/50">Add or edit categories</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
          </Link>

          <Link
            href="/contracts?category=null"
            className="group p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10
                     hover:bg-white/10 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-medium">Uncategorized Contracts</p>
                <p className="text-sm text-white/50">
                  {analytics.summary.uncategorizedCount} need attention
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
          </Link>

          <Link
            href="/contracts"
            className="group p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10
                     hover:bg-white/10 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-medium">All Contracts</p>
                <p className="text-sm text-white/50">View and manage contracts</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
