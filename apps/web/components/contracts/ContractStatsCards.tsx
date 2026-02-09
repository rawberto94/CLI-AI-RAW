/**
 * Contract Stats Cards
 * 
 * Reusable statistics card components for the contracts dashboard
 */

"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileText, 
  CheckCircle, 
  Loader2, 
  DollarSign, 
  Tag, 
  AlertTriangle,
  TrendingUp,
  Brain,
  Sparkles,
  Clock,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  subtitleIcon?: LucideIcon;
  subtitleColor?: string;
  icon: LucideIcon;
  iconGradient: string;
  iconShadow: string;
  isActive?: boolean;
  ringColor?: string;
  onClick?: () => void;
  delay?: number;
}

export interface ContractStatsData {
  total: number;
  active: number;
  processing: number;
  failed: number;
  totalValue: number;
  categorized: number;
  uncategorized: number;
  highRisk: number;
  expiringSoon: number;
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

export const StatCard = memo(function StatCard({
  title,
  value,
  subtitle,
  subtitleIcon: SubtitleIcon,
  subtitleColor = "text-slate-400",
  icon: Icon,
  iconGradient,
  iconShadow,
  isActive = false,
  ringColor = "ring-violet-500 border-violet-300 shadow-violet-100",
  onClick,
  delay = 0.1,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card 
        className={cn(
          "group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white/80 backdrop-blur-sm border-white/50",
          isActive && `ring-2 ${ringColor}`,
          onClick && "cursor-pointer"
        )}
        onClick={onClick}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{title}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
              {subtitle && (
                <p className={cn("text-xs mt-1 flex items-center gap-1", subtitleColor)}>
                  {SubtitleIcon && <SubtitleIcon className="h-3 w-3" />}
                  {subtitle}
                </p>
              )}
            </div>
            <div className={cn(
              "p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform",
              iconGradient,
              iconShadow
            )}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

// ============================================================================
// PRESET STAT CARDS
// ============================================================================

interface TotalContractsCardProps {
  count: number;
  isActive?: boolean;
  onClick?: () => void;
}

export const TotalContractsCard = memo(function TotalContractsCard({
  count,
  isActive,
  onClick,
}: TotalContractsCardProps) {
  return (
    <StatCard
      title="Total Contracts"
      value={count}
      subtitle="All contracts in portfolio"
      icon={FileText}
      iconGradient="bg-gradient-to-br from-violet-500 to-purple-600"
      iconShadow="shadow-violet-500/30"
      isActive={isActive}
      ringColor="ring-violet-500 border-violet-300 shadow-violet-100"
      onClick={onClick}
      delay={0.1}
    />
  );
});

interface ActiveContractsCardProps {
  count: number;
  isActive?: boolean;
  onClick?: () => void;
}

export const ActiveContractsCard = memo(function ActiveContractsCard({
  count,
  isActive,
  onClick,
}: ActiveContractsCardProps) {
  return (
    <StatCard
      title="Active"
      value={count}
      subtitle="Ready for business"
      subtitleIcon={TrendingUp}
      subtitleColor="text-violet-500"
      icon={CheckCircle}
      iconGradient="bg-gradient-to-br from-violet-500 to-purple-600"
      iconShadow="shadow-violet-500/30"
      isActive={isActive}
      ringColor="ring-violet-500 border-violet-300 shadow-violet-100"
      onClick={onClick}
      delay={0.15}
    />
  );
});

interface ProcessingContractsCardProps {
  count: number;
  isActive?: boolean;
  onClick?: () => void;
}

export const ProcessingContractsCard = memo(function ProcessingContractsCard({
  count,
  isActive,
  onClick,
}: ProcessingContractsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card 
        data-testid="stat-processing" 
        className={cn(
          "group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white/80 backdrop-blur-sm border-white/50",
          isActive && "ring-2 ring-violet-500 border-violet-300 shadow-violet-100"
        )}
        onClick={onClick}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Processing</p>
              <p className="text-3xl font-bold text-violet-600 mt-1">{count}</p>
              <p className="text-xs text-violet-500 mt-1 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI analyzing...
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
              <Brain className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

interface TotalValueCardProps {
  value: number;
  formatCurrency: (value: number) => string;
  isActive?: boolean;
  onClick?: () => void;
}

export const TotalValueCard = memo(function TotalValueCard({
  value,
  formatCurrency,
  isActive,
  onClick,
}: TotalValueCardProps) {
  return (
    <StatCard
      title="Total Value"
      value={formatCurrency(value)}
      subtitle="Portfolio worth"
      subtitleIcon={Sparkles}
      subtitleColor="text-violet-500"
      icon={DollarSign}
      iconGradient="bg-gradient-to-br from-violet-500 to-pink-600"
      iconShadow="shadow-violet-500/30"
      isActive={isActive}
      ringColor="ring-violet-500 border-violet-300 shadow-violet-100"
      onClick={onClick}
      delay={0.25}
    />
  );
});

interface CategorizedCardProps {
  categorizedCount: number;
  totalCount: number;
  uncategorizedCount: number;
  isActive?: boolean;
  onClick?: () => void;
}

export const CategorizedCard = memo(function CategorizedCard({
  categorizedCount,
  totalCount,
  uncategorizedCount,
  isActive,
  onClick,
}: CategorizedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card 
        className={cn(
          "group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white/80 backdrop-blur-sm border-white/50",
          isActive && "ring-2 ring-amber-500 border-amber-300 shadow-amber-100"
        )}
        onClick={onClick}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Categorized</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {categorizedCount}<span className="text-lg text-slate-400">/{totalCount}</span>
              </p>
              <p className={cn(
                "text-xs mt-1 flex items-center gap-1",
                uncategorizedCount > 0 ? "text-amber-500" : "text-violet-500"
              )}>
                {uncategorizedCount > 0 ? (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    {uncategorizedCount} need categorizing
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    All categorized
                  </>
                )}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
              <Tag className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

interface HighRiskCardProps {
  count: number;
  isActive?: boolean;
  onClick?: () => void;
}

export const HighRiskCard = memo(function HighRiskCard({
  count,
  isActive,
  onClick,
}: HighRiskCardProps) {
  return (
    <StatCard
      title="High Risk"
      value={count}
      subtitle="Require attention"
      subtitleIcon={AlertTriangle}
      subtitleColor={count > 0 ? "text-red-500" : "text-violet-500"}
      icon={Shield}
      iconGradient="bg-gradient-to-br from-red-500 to-rose-600"
      iconShadow="shadow-red-500/30"
      isActive={isActive}
      ringColor="ring-red-500 border-red-300 shadow-red-100"
      onClick={onClick}
      delay={0.35}
    />
  );
});

interface ExpiringSoonCardProps {
  count: number;
  isActive?: boolean;
  onClick?: () => void;
}

export const ExpiringSoonCard = memo(function ExpiringSoonCard({
  count,
  isActive,
  onClick,
}: ExpiringSoonCardProps) {
  return (
    <StatCard
      title="Expiring Soon"
      value={count}
      subtitle="Within 30 days"
      subtitleIcon={Clock}
      subtitleColor={count > 0 ? "text-amber-500" : "text-slate-400"}
      icon={Clock}
      iconGradient="bg-gradient-to-br from-amber-500 to-orange-600"
      iconShadow="shadow-amber-500/30"
      isActive={isActive}
      ringColor="ring-amber-500 border-amber-300 shadow-amber-100"
      onClick={onClick}
      delay={0.4}
    />
  );
});

// ============================================================================
// STATS GRID COMPONENT
// ============================================================================

interface ContractStatsGridProps {
  stats: ContractStatsData;
  formatCurrency: (value: number) => string;
  statusFilter: string;
  categoryFilter: string | null;
  onStatusFilterChange: (status: string) => void;
  onCategoryFilterChange: (category: string | null) => void;
  onSortByValue: () => void;
  isValueSortActive?: boolean;
}

export const ContractStatsGrid = memo(function ContractStatsGrid({
  stats,
  formatCurrency,
  statusFilter,
  categoryFilter,
  onStatusFilterChange,
  onCategoryFilterChange,
  onSortByValue,
  isValueSortActive,
}: ContractStatsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 -mt-12 relative z-10">
      <TotalContractsCard
        count={stats.total}
        isActive={statusFilter === 'all'}
        onClick={() => onStatusFilterChange('all')}
      />
      <ActiveContractsCard
        count={stats.active}
        isActive={statusFilter === 'completed'}
        onClick={() => onStatusFilterChange('completed')}
      />
      <ProcessingContractsCard
        count={stats.processing}
        isActive={statusFilter === 'processing'}
        onClick={() => onStatusFilterChange('processing')}
      />
      <TotalValueCard
        value={stats.totalValue}
        formatCurrency={formatCurrency}
        isActive={isValueSortActive}
        onClick={onSortByValue}
      />
      <CategorizedCard
        categorizedCount={stats.categorized}
        totalCount={stats.total}
        uncategorizedCount={stats.uncategorized}
        isActive={categoryFilter === 'uncategorized'}
        onClick={() => onCategoryFilterChange(
          categoryFilter === 'uncategorized' ? null : 'uncategorized'
        )}
      />
    </div>
  );
});

// ============================================================================
// INLINE STATS SUMMARY
// ============================================================================

interface InlineStatsSummaryProps {
  totalContracts: number;
  totalValue: number;
  avgValue: number;
  highRiskCount: number;
  expiringCount: number;
  formatCurrency: (value: number) => string;
}

export const InlineStatsSummary = memo(function InlineStatsSummary({
  totalContracts,
  totalValue,
  avgValue,
  highRiskCount,
  expiringCount,
  formatCurrency,
}: InlineStatsSummaryProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-400" />
        <span className="text-slate-600">{totalContracts} contracts</span>
      </div>
      <div className="h-4 w-px bg-slate-200" />
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-violet-500" />
        <span className="text-slate-600">
          Total: <span className="font-semibold text-slate-800">{formatCurrency(totalValue)}</span>
        </span>
      </div>
      <div className="h-4 w-px bg-slate-200" />
      <div className="flex items-center gap-2">
        <span className="text-slate-600">
          Avg: <span className="font-medium">{formatCurrency(avgValue)}</span>
        </span>
      </div>
      {highRiskCount > 0 && (
        <>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-500" />
            <span className="text-red-600 font-medium">{highRiskCount} high risk</span>
          </div>
        </>
      )}
      {expiringCount > 0 && (
        <>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-amber-600 font-medium">{expiringCount} expiring soon</span>
          </div>
        </>
      )}
    </div>
  );
});
