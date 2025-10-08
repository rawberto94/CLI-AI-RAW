"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  BarChart3,
  DollarSign,
  FileCheck,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeIn } from "@/lib/contracts/animations";

export interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  disabled?: boolean;
}

export interface ContractDetailTabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function ContractDetailTabs({
  tabs,
  defaultTab,
  onTabChange,
  children,
  className,
}: ContractDetailTabsProps) {
  // Framer Motion typing workaround for React 19
  const MotionDiv = motion.div as any;
  const MotionSpan = motion.span as any;
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState(
    tabFromUrl || defaultTab || tabs[0]?.id
  );

  // Update URL when tab changes
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.disabled) return;

    setActiveTab(tabId);
    onTabChange?.(tabId);

    // Update URL with new tab
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const activeTabIndex = tabs.findIndex((t) => t.id === activeTab);

  return (
    <div className={cn("w-full", className)}>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center overflow-x-auto scrollbar-hide">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            const isDisabled = tab.disabled;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                disabled={isDisabled}
                className={cn(
                  "relative flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all whitespace-nowrap",
                  "border-b-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300",
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive && "text-blue-600")} />
                <span>{tab.label}</span>

                {/* Badge */}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <MotionSpan
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      "ml-1 px-2 py-0.5 text-xs font-semibold rounded-full",
                      isActive
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    )}
                  >
                    {tab.badge}
                  </MotionSpan>
                )}

                {/* Active indicator */}
                {isActive && (
                  <MotionDiv
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Progress indicator */}
        <div className="h-1 bg-gray-100">
          <MotionDiv
            className="h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{
              width: `${((activeTabIndex + 1) / tabs.length) * 100}%`,
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <MotionDiv
            key={activeTab}
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="py-6"
          >
            {children}
          </MotionDiv>
        </AnimatePresence>
      </div>

      {/* Navigation Breadcrumb */}
      <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
        <span>Current view:</span>
        <div className="flex items-center gap-1">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTab;
            return (
              <div key={tab.id} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="w-3 h-3" />}
                <button
                  onClick={() => handleTabChange(tab.id)}
                  disabled={tab.disabled}
                  className={cn(
                    "hover:text-gray-900 transition-colors",
                    isActive && "text-blue-600 font-medium",
                    tab.disabled && "opacity-50 cursor-not-allowed"
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

// Predefined tab configurations
export const DEFAULT_CONTRACT_TABS: Tab[] = [
  {
    id: "overview",
    label: "Overview",
    icon: FileText,
  },
  {
    id: "analysis",
    label: "Analysis",
    icon: BarChart3,
  },
  {
    id: "financial",
    label: "Financial",
    icon: DollarSign,
  },
  {
    id: "clauses",
    label: "Clauses",
    icon: FileCheck,
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: Clock,
  },
];

// Tab content wrapper component
export interface TabContentProps {
  tabId: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export function TabContent({
  tabId,
  activeTab,
  children,
  className,
}: TabContentProps) {
  if (tabId !== activeTab) return null;

  return <div className={cn("w-full", className)}>{children}</div>;
}
