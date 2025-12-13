"use client";

import React, { useState, useCallback, memo, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  X,
  Eye,
  Edit,
  Trash2,
  Pin,
  Heart,
  Sparkles,
  Download,
  Share2,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  DollarSign,
  FileText,
  SlidersHorizontal,
  Check,
  RefreshCw,
  ArrowUp,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";
import type { EnhancedContract, ContractHealth } from "./EnhancedContractCard";

// ============================================================================
// Types
// ============================================================================

export interface MobileContractCardProps {
  contract: EnhancedContract;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onClick?: (id: string) => void;
  onSwipeAction?: (id: string, action: "preview" | "favorite" | "delete") => void;
  onQuickAction?: (id: string, action: string) => void;
}

export interface MobileFiltersSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  onApply: () => void;
  onReset: () => void;
  availableTags?: string[];
  resultCount?: number;
}

export interface MobileSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onFilterClick: () => void;
  activeFilterCount?: number;
  placeholder?: string;
}

export interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: value >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value);
}

function getStatusConfig(status: EnhancedContract["status"]) {
  const configs = {
    draft: { color: "bg-slate-100 text-slate-700", dotColor: "bg-slate-400", label: "Draft" },
    pending: { color: "bg-amber-50 text-amber-700", dotColor: "bg-amber-400", label: "Pending" },
    active: { color: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-400", label: "Active" },
    expired: { color: "bg-red-50 text-red-700", dotColor: "bg-red-400", label: "Expired" },
    terminated: { color: "bg-gray-100 text-gray-700", dotColor: "bg-gray-400", label: "Terminated" },
    renewal: { color: "bg-blue-50 text-blue-700", dotColor: "bg-blue-400", label: "Renewal" },
  };
  return configs[status] || configs.draft;
}

// ============================================================================
// Mobile Contract Card with Swipe Actions
// ============================================================================

export const MobileContractCard = memo(function MobileContractCard({
  contract,
  isSelected = false,
  onSelect,
  onClick,
  onSwipeAction,
  onQuickAction,
}: MobileContractCardProps) {
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-150, 0, 150],
    ["rgb(239, 68, 68)", "rgb(255, 255, 255)", "rgb(34, 197, 94)"]
  );

  const statusConfig = getStatusConfig(contract.status);
  const daysUntilExpiry = contract.endDate
    ? differenceInDays(parseISO(contract.endDate), new Date())
    : null;

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      onSwipeAction?.(contract.id, "favorite");
    } else if (info.offset.x < -100) {
      onSwipeAction?.(contract.id, "delete");
    }
  };

  return (
    <div ref={constraintsRef} className="relative overflow-hidden">
      {/* Background Actions (revealed on swipe) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-between px-6"
        style={{ background }}
      >
        <div className="flex items-center gap-2 text-white">
          <Heart className="w-6 h-6" />
          <span className="font-medium">Favorite</span>
        </div>
        <div className="flex items-center gap-2 text-white">
          <span className="font-medium">Delete</span>
          <Trash2 className="w-6 h-6" />
        </div>
      </motion.div>

      {/* Main Card */}
      <motion.div
        drag="x"
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative bg-white rounded-xl border p-4 shadow-sm",
          isSelected && "ring-2 ring-primary border-primary",
          contract.isPinned && "border-l-4 border-l-amber-400"
        )}
        onClick={() => onClick?.(contract.id)}
      >
        {/* Selection Checkbox */}
        <div
          className="absolute left-4 top-4"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect?.(contract.id, !!checked)}
          />
        </div>

        {/* Pin/Favorite Indicators */}
        <div className="absolute top-4 right-4 flex items-center gap-1">
          {contract.isPinned && (
            <Pin className="w-4 h-4 text-amber-500 fill-amber-500" />
          )}
          {contract.isFavorite && (
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
          )}
        </div>

        {/* Content */}
        <div className="pl-8 space-y-3">
          {/* Title & Type */}
          <div>
            <h3 className="font-semibold text-gray-900 line-clamp-1 pr-12">
              {contract.title}
            </h3>
            <p className="text-sm text-muted-foreground">{contract.type}</p>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
              <span className={cn("w-2 h-2 rounded-full mr-1", statusConfig.dotColor)} />
              {statusConfig.label}
            </Badge>
            {daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry >= 0 && (
              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                <Clock className="w-3 h-3 mr-1" />
                {daysUntilExpiry}d left
              </Badge>
            )}
          </div>

          {/* Parties */}
          {contract.parties.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {contract.parties.slice(0, 2).map((party) => (
                  <div
                    key={party.id}
                    className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 text-[10px] font-medium ring-2 ring-white"
                  >
                    {party.name.charAt(0)}
                  </div>
                ))}
                {contract.parties.length > 2 && (
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] flex items-center justify-center ring-2 ring-white font-medium">
                    +{contract.parties.length - 2}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate flex-1">
                {contract.parties[0]?.name}
              </span>
            </div>
          )}

          {/* Value & Date Row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              {contract.value !== undefined && (
                <span className="flex items-center gap-1 font-medium">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  {formatCurrency(contract.value, contract.currency)}
                </span>
              )}
            </div>
            {contract.endDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(parseISO(contract.endDate), "MMM d, yyyy")}
              </span>
            )}
          </div>

          {/* Health Indicator */}
          {contract.health && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    contract.health.score >= 80 && "bg-emerald-500",
                    contract.health.score >= 50 && contract.health.score < 80 && "bg-amber-500",
                    contract.health.score < 50 && "bg-red-500"
                  )}
                  style={{ width: `${contract.health.score}%` }}
                />
              </div>
              <span className="text-xs font-medium">{contract.health.score}%</span>
            </div>
          )}
        </div>

        {/* Quick Action Chevron */}
        <div className="absolute right-4 bottom-4">
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </motion.div>
    </div>
  );
});

// ============================================================================
// Mobile Search Bar
// ============================================================================

export const MobileSearchBar = memo(function MobileSearchBar({
  value,
  onChange,
  onSubmit,
  onFilterClick,
  activeFilterCount = 0,
  placeholder = "Search contracts...",
}: MobileSearchBarProps) {
  return (
    <div className="flex items-center gap-2 p-4 bg-white border-b sticky top-0 z-30">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
          className="pl-10 pr-10 h-10 rounded-full bg-gray-50 border-gray-200"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-full"
            onClick={() => onChange("")}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full shrink-0 relative"
        onClick={onFilterClick}
      >
        <SlidersHorizontal className="w-4 h-4" />
        {activeFilterCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
            {activeFilterCount}
          </span>
        )}
      </Button>
    </div>
  );
});

// ============================================================================
// Mobile Filters Bottom Sheet
// ============================================================================

export const MobileFiltersSheet = memo(function MobileFiltersSheet({
  isOpen,
  onOpenChange,
  filters,
  onFiltersChange,
  onApply,
  onReset,
  availableTags = [],
  resultCount,
}: MobileFiltersSheetProps) {
  const statusOptions = [
    { value: "draft", label: "Draft", color: "bg-slate-400" },
    { value: "pending", label: "Pending", color: "bg-amber-400" },
    { value: "active", label: "Active", color: "bg-emerald-400" },
    { value: "expired", label: "Expired", color: "bg-red-400" },
    { value: "renewal", label: "Renewal", color: "bg-blue-400" },
  ];

  const riskOptions = [
    { value: "low", label: "Low Risk", color: "text-emerald-600" },
    { value: "medium", label: "Medium Risk", color: "text-amber-600" },
    { value: "high", label: "High Risk", color: "text-orange-600" },
    { value: "critical", label: "Critical", color: "text-red-600" },
  ];

  const expiryOptions = [
    { value: 7, label: "7 days" },
    { value: 14, label: "14 days" },
    { value: 30, label: "30 days" },
    { value: 60, label: "60 days" },
    { value: 90, label: "90 days" },
  ];

  const toggleArrayFilter = (key: string, value: any) => {
    const current = filters[key] || [];
    const updated = current.includes(value)
      ? current.filter((v: any) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated.length > 0 ? updated : undefined });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="flex items-center justify-between">
            <span>Filters</span>
            {resultCount !== undefined && (
              <Badge variant="secondary" className="font-normal">
                {resultCount} results
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Filter contracts by status, risk level, and more
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100%-140px)] -mx-6 px-6">
          <div className="space-y-6">
            {/* Status Filter */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map((option) => {
                  const isSelected = filters.status?.includes(option.value);
                  return (
                    <Button
                      key={option.value}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={cn("justify-start gap-2", isSelected && "bg-primary")}
                      onClick={() => toggleArrayFilter("status", option.value)}
                    >
                      <span className={cn("w-2 h-2 rounded-full", option.color)} />
                      {option.label}
                      {isSelected && <Check className="w-4 h-4 ml-auto" />}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Risk Level Filter */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Risk Level</Label>
              <div className="grid grid-cols-2 gap-2">
                {riskOptions.map((option) => {
                  const isSelected = filters.riskLevel?.includes(option.value);
                  return (
                    <Button
                      key={option.value}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={cn("justify-start", isSelected && "bg-primary")}
                      onClick={() => toggleArrayFilter("riskLevel", option.value)}
                    >
                      <span className={option.color}>{option.label}</span>
                      {isSelected && <Check className="w-4 h-4 ml-auto" />}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Expiring Within */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Expiring Within</Label>
              <div className="flex flex-wrap gap-2">
                {expiryOptions.map((option) => {
                  const isSelected = filters.expiringWithin === option.value;
                  return (
                    <Button
                      key={option.value}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        onFiltersChange({
                          ...filters,
                          expiringWithin: isSelected ? undefined : option.value,
                        })
                      }
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Tags */}
            {availableTags.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = filters.tags?.includes(tag);
                    return (
                      <Badge
                        key={tag}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleArrayFilter("tags", tag)}
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Quick Toggles */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Quick Filters</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="favorites-only" className="font-normal cursor-pointer">
                    Favorites only
                  </Label>
                  <Checkbox
                    id="favorites-only"
                    checked={filters.isFavorite ?? false}
                    onCheckedChange={(checked) =>
                      onFiltersChange({ ...filters, isFavorite: checked || undefined })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pinned-only" className="font-normal cursor-pointer">
                    Pinned only
                  </Label>
                  <Checkbox
                    id="pinned-only"
                    checked={filters.isPinned ?? false}
                    onCheckedChange={(checked) =>
                      onFiltersChange({ ...filters, isPinned: checked || undefined })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="has-attachments" className="font-normal cursor-pointer">
                    Has attachments
                  </Label>
                  <Checkbox
                    id="has-attachments"
                    checked={filters.hasAttachments ?? false}
                    onCheckedChange={(checked) =>
                      onFiltersChange({ ...filters, hasAttachments: checked || undefined })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row gap-3 pt-4 border-t mt-4">
          <Button variant="outline" className="flex-1" onClick={onReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <SheetClose asChild>
            <Button className="flex-1" onClick={onApply}>
              Apply Filters
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
});

// ============================================================================
// Pull to Refresh Wrapper
// ============================================================================

export const MobilePullToRefresh = memo(function MobilePullToRefresh({
  onRefresh,
  children,
}: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  const PULL_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, (currentY - startY.current) * 0.5);
    setPullDistance(Math.min(distance, PULL_THRESHOLD * 1.5));
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
    setIsPulling(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-50"
        style={{ top: pullDistance - 40 }}
        animate={{
          opacity: pullDistance > 20 ? 1 : 0,
          scale: pullDistance >= PULL_THRESHOLD ? 1.2 : 1,
        }}
      >
        <div
          className={cn(
            "w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center",
            pullDistance >= PULL_THRESHOLD && "bg-primary text-primary-foreground"
          )}
        >
          {isRefreshing ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <motion.div
              animate={{
                rotate: pullDistance >= PULL_THRESHOLD ? 180 : 0,
              }}
            >
              <ArrowUp className="w-5 h-5" />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        style={{
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
});

// ============================================================================
// Floating Action Button for Quick Add
// ============================================================================

export interface MobileFABProps {
  onClick: () => void;
  icon?: React.ReactNode;
  label?: string;
}

export const MobileFAB = memo(function MobileFAB({
  onClick,
  icon = <Plus className="w-6 h-6" />,
  label,
}: MobileFABProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "fixed bottom-20 right-4 z-50",
        "w-14 h-14 rounded-full",
        "bg-gradient-to-br from-primary to-primary/80",
        "text-primary-foreground shadow-lg shadow-primary/30",
        "flex items-center justify-center",
        "active:shadow-md transition-shadow"
      )}
      onClick={onClick}
    >
      {icon}
    </motion.button>
  );
});

// Need to import Plus for the FAB
import { Plus } from "lucide-react";

// ============================================================================
// Mobile Contract List Empty State
// ============================================================================

export interface MobileEmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export const MobileEmptyState = memo(function MobileEmptyState({
  title = "No contracts found",
  description = "Try adjusting your filters or create a new contract",
  action,
  icon = <FileText className="w-16 h-16" />,
}: MobileEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="text-gray-300 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </motion.div>
  );
});

// ============================================================================
// Mobile Stats Summary (collapsible)
// ============================================================================

export interface MobileStatsSummaryProps {
  stats: {
    total: number;
    active: number;
    expiringSoon: number;
    highRisk: number;
    totalValue?: number;
  };
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const MobileStatsSummary = memo(function MobileStatsSummary({
  stats,
  isExpanded = false,
  onToggle,
}: MobileStatsSummaryProps) {
  return (
    <motion.div
      className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl mx-4 overflow-hidden"
      animate={{ height: isExpanded ? "auto" : 80 }}
    >
      {/* Collapsed View */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-gray-400">Total Contracts</p>
          </div>
          <Separator orientation="vertical" className="h-10 bg-gray-700" />
          <div>
            <p className="text-lg font-semibold text-emerald-400">{stats.active}</p>
            <p className="text-xs text-gray-400">Active</p>
          </div>
          {stats.expiringSoon > 0 && (
            <>
              <Separator orientation="vertical" className="h-10 bg-gray-700" />
              <div>
                <p className="text-lg font-semibold text-orange-400">{stats.expiringSoon}</p>
                <p className="text-xs text-gray-400">Expiring</p>
              </div>
            </>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </motion.div>
      </div>

      {/* Expanded View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-4 grid grid-cols-2 gap-3"
          >
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-xs text-gray-400">High Risk</p>
              <p className="text-xl font-bold text-red-400">{stats.highRisk}</p>
            </div>
            {stats.totalValue !== undefined && (
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-xs text-gray-400">Total Value</p>
                <p className="text-xl font-bold text-emerald-400">
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default {
  MobileContractCard,
  MobileSearchBar,
  MobileFiltersSheet,
  MobilePullToRefresh,
  MobileFAB,
  MobileEmptyState,
  MobileStatsSummary,
};
