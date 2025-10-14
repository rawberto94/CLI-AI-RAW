"use client";

import { motion } from "framer-motion";
import {
  FileText,
  DollarSign,
  FileCheck,
  AlertTriangle,
  Shield,
  Brain,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  disabled?: boolean;
}

export interface EnhancedContractTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
  className?: string;
}

const DEFAULT_TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "financial", label: "Financial", icon: DollarSign },
  { id: "clauses", label: "Clauses", icon: FileCheck },
  { id: "risk", label: "Risk Analysis", icon: AlertTriangle },
  { id: "compliance", label: "Compliance", icon: Shield },
  { id: "insights", label: "AI Insights", icon: Brain },
  { id: "timeline", label: "Timeline", icon: Clock },
];

export function EnhancedContractTabs({
  activeTab,
  onTabChange,
  children,
  className,
}: EnhancedContractTabsProps) {
  const activeTabIndex = DEFAULT_TABS.findIndex((t) => t.id === activeTab);

  return (
    <div className={cn("w-full", className)}>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center overflow-x-auto scrollbar-hide">
          {DEFAULT_TABS.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            const isDisabled = tab.disabled;

            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && onTabChange(tab.id)}
                disabled={isDisabled}
                className={cn(
                  "relative flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all whitespace-nowrap",
                  "hover:bg-gray-50 focus:outline-none",
                  isActive
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900",
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive && "text-blue-600")} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                    {tab.badge}
                  </span>
                )}

                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Progress indicator */}
        <motion.div
          className="h-1 bg-blue-600"
          initial={{ width: "0%" }}
          animate={{
            width: `${((activeTabIndex + 1) / DEFAULT_TABS.length) * 100}%`,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Tab Content */}
      <div className="relative min-h-[400px]">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="py-6"
        >
          {children}
        </motion.div>
      </div>

      {/* Navigation Breadcrumb */}
      <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
        <span>Current view:</span>
        <div className="flex items-center gap-1">
          {DEFAULT_TABS.map((tab, index) => {
            const isActive = tab.id === activeTab;
            return (
              <div key={tab.id} className="flex items-center">
                {index > 0 && <ChevronRight className="w-4 h-4 mx-1" />}
                <button
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "hover:text-blue-600 transition-colors",
                    isActive && "text-blue-600 font-medium"
                  )}
                >
                  {tab.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Individual Tab Content Components
export interface TabContentProps {
  contract: any;
  className?: string;
}

export function OverviewTabContent({ contract, className }: TabContentProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Contract Value"
          value={
            contract.totalValue
              ? `$${contract.totalValue.toLocaleString()}`
              : "N/A"
          }
          iconColor="text-green-600"
          bgColor="bg-green-50"
        />
        <MetricCard
          icon={Clock}
          label="Duration"
          value={calculateDuration(contract.startDate, contract.endDate)}
          iconColor="text-blue-600"
          bgColor="bg-blue-50"
        />
        <MetricCard
          icon={FileCheck}
          label="Clauses"
          value={contract.clauses?.length || 0}
          iconColor="text-purple-600"
          bgColor="bg-purple-50"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Risk Score"
          value={contract.riskScore ? `${contract.riskScore}/100` : "N/A"}
          iconColor="text-orange-600"
          bgColor="bg-orange-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Contract Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              label="Title"
              value={contract.contractTitle || contract.fileName}
            />
            <DetailRow label="Type" value={contract.contractType || "N/A"} />
            <DetailRow
              label="Status"
              value={<StatusBadge status={contract.status} />}
            />
            <DetailRow label="Client" value={contract.clientName || "N/A"} />
            <DetailRow
              label="Supplier"
              value={contract.supplierName || "N/A"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Important Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              label="Start Date"
              value={formatDate(contract.startDate)}
            />
            <DetailRow label="End Date" value={formatDate(contract.endDate)} />
            <DetailRow
              label="Uploaded"
              value={formatDate(contract.uploadedAt)}
            />
            <DetailRow
              label="Last Analyzed"
              value={formatDate(contract.lastAnalyzedAt)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper Components
function MetricCard({ icon: Icon, label, value, iconColor, bgColor }: any) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
          <div className={cn("p-3 rounded-full", bgColor)}>
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    COMPLETED: { label: "Active", className: "bg-green-100 text-green-800" },
    PROCESSING: { label: "Processing", className: "bg-blue-100 text-blue-800" },
    FAILED: { label: "Failed", className: "bg-red-100 text-red-800" },
    ARCHIVED: { label: "Archived", className: "bg-gray-100 text-gray-800" },
  };

  const config = statusConfig[status] || {
    label: status,
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={cn(
        "px-2 py-1 text-xs font-medium rounded-full",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

function calculateDuration(
  start: string | Date | null,
  end: string | Date | null
): string {
  if (!start || !end) return "N/A";
  const startDate = new Date(start);
  const endDate = new Date(end);
  const days = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return `${days} days`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
