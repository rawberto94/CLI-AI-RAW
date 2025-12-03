/**
 * Contract View Controls
 * 
 * Components for controlling view mode, sorting, and pagination
 */

"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutGrid,
  LayoutList,
  GanttChartSquare,
  Kanban,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortField, SortDirection } from "@/lib/contracts/types";
import { SORT_OPTIONS, PAGE_SIZE_OPTIONS } from "@/lib/contracts/constants";

// ============================================================================
// VIEW MODE TOGGLE
// ============================================================================

export type ViewMode = 'compact' | 'cards' | 'timeline' | 'kanban';

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export const ViewModeToggle = memo(function ViewModeToggle({
  mode,
  onChange,
}: ViewModeToggleProps) {
  const views: Array<{ value: ViewMode; icon: typeof LayoutList; label: string }> = [
    { value: 'compact', icon: LayoutList, label: 'List View' },
    { value: 'cards', icon: LayoutGrid, label: 'Card View' },
    { value: 'timeline', icon: GanttChartSquare, label: 'Timeline View' },
    { value: 'kanban', icon: Kanban, label: 'Kanban View' },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
      {views.map(({ value, icon: Icon, label }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(value)}
              className={cn(
                "h-8 w-8 p-0 rounded-md transition-all",
                mode === value 
                  ? "bg-white shadow-sm text-blue-600" 
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-2">
              {label}
              <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 rounded">V</kbd>
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
});

// ============================================================================
// SORT DROPDOWN
// ============================================================================

interface SortDropdownProps {
  field: SortField;
  direction: SortDirection;
  onFieldChange: (field: SortField) => void;
  onDirectionChange: (direction: SortDirection) => void;
}

export const SortDropdown = memo(function SortDropdown({
  field,
  direction,
  onFieldChange,
  onDirectionChange,
}: SortDropdownProps) {
  const currentSort = SORT_OPTIONS.find(o => o.value === field);
  const DirectionIcon = direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8 border-slate-200 hover:border-slate-300 hover:bg-slate-50">
          <ArrowUpDown className="h-4 w-4 text-slate-500" />
          <span className="hidden sm:inline">{currentSort?.label || 'Sort'}</span>
          <DirectionIcon className="h-3 w-3 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onFieldChange(option.value)}
            className={cn(
              "cursor-pointer",
              field === option.value && "bg-blue-50 text-blue-700"
            )}
          >
            {option.label}
            {field === option.value && (
              <DirectionIcon className="h-3 w-3 ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDirectionChange(direction === 'asc' ? 'desc' : 'asc')}
          className="cursor-pointer"
        >
          {direction === 'asc' ? (
            <>
              <ArrowDown className="h-4 w-4 mr-2" />
              Sort Descending
            </>
          ) : (
            <>
              <ArrowUp className="h-4 w-4 mr-2" />
              Sort Ascending
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// ============================================================================
// PAGINATION
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Items Info */}
      <div className="text-sm text-slate-600">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalItems}</span> contracts
      </div>

      {/* Page Size Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Per page:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-16">
              {pageSize}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <DropdownMenuItem
                key={size}
                onClick={() => onPageSizeChange(size)}
                className={cn(
                  "cursor-pointer",
                  pageSize === size && "bg-blue-50 text-blue-700"
                )}
              >
                {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>First page</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous page</TooltipContent>
        </Tooltip>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 px-2">
          {generatePageNumbers(currentPage, totalPages).map((page, idx) => (
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page as number)}
                className={cn(
                  "h-8 w-8 p-0",
                  currentPage === page && "bg-blue-600 text-white"
                )}
              >
                {page}
              </Button>
            )
          ))}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next page</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Last page</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

// Helper to generate page numbers with ellipsis
function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 4, 5, '...', total];
  }

  if (current >= total - 2) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, '...', current - 1, current, current + 1, '...', total];
}

// ============================================================================
// EXPORT MENU
// ============================================================================

interface ExportMenuProps {
  totalItems: number;
  onExportJson: () => void;
  onExportCsv: () => void;
}

export const ExportMenu = memo(function ExportMenu({
  totalItems,
  onExportJson,
  onExportCsv,
}: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportCsv} className="cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
          <Badge variant="secondary" className="ml-auto text-xs">
            {totalItems} items
          </Badge>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportJson} className="cursor-pointer">
          <FileDown className="h-4 w-4 mr-2" />
          Export as JSON
          <Badge variant="secondary" className="ml-auto text-xs">
            {totalItems} items
          </Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// ============================================================================
// CONTROLS BAR (Combined)
// ============================================================================

interface ContractControlsBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortFieldChange: (field: SortField) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  showExport?: boolean;
}

export const ContractControlsBar = memo(function ContractControlsBar({
  viewMode,
  onViewModeChange,
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  onExportJson,
  onExportCsv,
  showExport = true,
}: ContractControlsBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100">
      {/* Left: View Mode & Sort */}
      <div className="flex items-center gap-3">
        <ViewModeToggle mode={viewMode} onChange={onViewModeChange} />
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />
        <SortDropdown
          field={sortField}
          direction={sortDirection}
          onFieldChange={onSortFieldChange}
          onDirectionChange={onSortDirectionChange}
        />
      </div>

      {/* Right: Export */}
      {showExport && (
        <ExportMenu
          totalItems={totalItems}
          onExportJson={onExportJson}
          onExportCsv={onExportCsv}
        />
      )}
    </div>
  );
});
