'use client';

/**
 * Enhanced Data Table
 * Feature-rich data table with sorting, filtering, bulk actions, and inline editing
 */

import React, { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Filter,
  X,
  MoreHorizontal,
  Download,
  Trash2,
  Edit,
  Copy,
  Eye,
  CheckSquare,
  Square,
  Minus,
  ArrowUpDown,
  Settings2,
  Columns3,
  RefreshCw,
  FileDown,
  Printer,
  Share2,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface Column<T> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  sticky?: 'left' | 'right';
  hidden?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface TableAction<T> {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick: (row: T) => void;
  variant?: 'default' | 'danger';
  disabled?: (row: T) => boolean;
  hidden?: (row: T) => boolean;
}

export interface BulkAction<T> {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick: (rows: T[]) => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

// ============================================================================
// Table Context
// ============================================================================

interface TableContextValue<T> {
  selectedRows: Set<string>;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
  isAllSelected: boolean;
  isIndeterminate: boolean;
}

const TableContext = React.createContext<TableContextValue<any> | null>(null);

function useTableContext<T>() {
  const context = React.useContext(TableContext);
  if (!context) {
    throw new Error('useTableContext must be used within EnhancedDataTable');
  }
  return context as TableContextValue<T>;
}

// ============================================================================
// Column Header
// ============================================================================

interface ColumnHeaderProps {
  column: Column<any>;
  sortState: SortState;
  onSort: (columnId: string) => void;
}

const ColumnHeader = memo(({ column, sortState, onSort }: ColumnHeaderProps) => {
  const isSorted = sortState.column === column.id;
  const canSort = column.sortable !== false;

  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider",
        "border-b border-slate-200 dark:border-slate-700",
        "bg-slate-50 dark:bg-slate-800/50",
        column.sticky === 'left' && "sticky left-0 z-10",
        column.sticky === 'right' && "sticky right-0 z-10",
        canSort && "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none"
      )}
      style={{
        width: column.width,
        minWidth: column.minWidth,
        maxWidth: column.maxWidth,
        textAlign: column.align,
      }}
      onClick={() => canSort && onSort(column.id)}
    >
      <div className="flex items-center gap-2">
        <span>{column.header}</span>
        {canSort && (
          <span className="flex-shrink-0">
            {isSorted ? (
              sortState.direction === 'asc' ? (
                <ChevronUp className="h-4 w-4 text-violet-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-violet-600" />
              )
            ) : (
              <ArrowUpDown className="h-4 w-4 text-slate-400" />
            )}
          </span>
        )}
      </div>
    </th>
  );
});

ColumnHeader.displayName = 'ColumnHeader';

// ============================================================================
// Table Row
// ============================================================================

interface TableRowProps<T> {
  row: T;
  rowId: string;
  columns: Column<T>[];
  actions?: TableAction<T>[];
  index: number;
  selectable?: boolean;
  onClick?: (row: T) => void;
}

function TableRowComponent<T>({
  row,
  rowId,
  columns,
  actions,
  index,
  selectable,
  onClick,
}: TableRowProps<T>) {
  const { selectedRows, toggleRow } = useTableContext<T>();
  const isSelected = selectedRows.has(rowId);
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close actions on outside click
  useEffect(() => {
    if (!showActions) return;

    function handleClick(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showActions]);

  const visibleActions = actions?.filter(a => !a.hidden?.(row)) || [];

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className={cn(
        "group transition-colors",
        isSelected
          ? "bg-violet-50 dark:bg-violet-900/20"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
        onClick && "cursor-pointer"
      )}
      onClick={() => onClick?.(row)}
    >
      {/* Selection checkbox */}
      {selectable && (
        <td className="w-12 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleRow(rowId);
            }}
            className="flex items-center justify-center"
          >
            {isSelected ? (
              <CheckSquare className="h-5 w-5 text-violet-600" />
            ) : (
              <Square className="h-5 w-5 text-slate-400 hover:text-slate-600" />
            )}
          </button>
        </td>
      )}

      {/* Data cells */}
      {columns.filter(c => !c.hidden).map((column) => {
        const value = typeof column.accessor === 'function'
          ? column.accessor(row)
          : row[column.accessor as keyof T];

        const content = column.render
          ? column.render(value, row, index)
          : value;

        return (
          <td
            key={column.id}
            className={cn(
              "px-4 py-3 text-sm text-slate-700 dark:text-slate-300",
              "border-b border-slate-100 dark:border-slate-800",
              column.sticky === 'left' && "sticky left-0 z-10 bg-white dark:bg-slate-900",
              column.sticky === 'right' && "sticky right-0 z-10 bg-white dark:bg-slate-900"
            )}
            style={{ textAlign: column.align }}
          >
            {content as React.ReactNode}
          </td>
        );
      })}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <td className="w-12 px-2 py-3 border-b border-slate-100 dark:border-slate-800 text-right">
          <div ref={actionsRef} className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4 text-slate-500" />
            </button>

            <AnimatePresence>
              {showActions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1"
                >
                  {visibleActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick(row);
                        setShowActions(false);
                      }}
                      disabled={action.disabled?.(row)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                        action.variant === 'danger'
                          ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700",
                        action.disabled?.(row) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {action.icon && <action.icon className="h-4 w-4" />}
                      {action.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </td>
      )}
    </motion.tr>
  );
}

const TableRow = memo(TableRowComponent) as typeof TableRowComponent;

// ============================================================================
// Pagination
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

const Pagination = memo(({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) => {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Showing <strong>{start}</strong> to <strong>{end}</strong> of <strong>{totalItems}</strong>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1 mx-2">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let page: number;
            if (totalPages <= 5) {
              page = i + 1;
            } else if (currentPage <= 3) {
              page = i + 1;
            } else if (currentPage >= totalPages - 2) {
              page = totalPages - 4 + i;
            } else {
              page = currentPage - 2 + i;
            }

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  "w-8 h-8 text-sm rounded transition-colors",
                  currentPage === page
                    ? "bg-violet-600 text-white"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                )}
              >
                {page}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';

// ============================================================================
// Toolbar
// ============================================================================

interface ToolbarProps<T> {
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedCount: number;
  bulkActions?: BulkAction<T>[];
  onBulkAction?: (actionId: string) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onColumnSettings?: () => void;
  isLoading?: boolean;
}

function ToolbarComponent<T>({
  searchValue,
  onSearchChange,
  selectedCount,
  bulkActions,
  onBulkAction,
  onRefresh,
  onExport,
  onColumnSettings,
  isLoading,
}: ToolbarProps<T>) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-3 py-2 w-64 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        {/* Bulk actions */}
        <AnimatePresence>
          {selectedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-700"
            >
              <span className="text-sm font-medium text-violet-600 dark:text-indigo-400">
                {selectedCount} selected
              </span>
              {bulkActions?.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onBulkAction?.(action.id)}
                  disabled={action.disabled}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors",
                    action.variant === 'danger'
                      ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                    action.disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {action.icon && <action.icon className="h-4 w-4" />}
                  {action.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4 text-slate-500", isLoading && "animate-spin")} />
          </button>
        )}
        {onExport && (
          <button
            onClick={onExport}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Export"
          >
            <FileDown className="h-4 w-4 text-slate-500" />
          </button>
        )}
        {onColumnSettings && (
          <button
            onClick={onColumnSettings}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Column settings"
          >
            <Columns3 className="h-4 w-4 text-slate-500" />
          </button>
        )}
      </div>
    </div>
  );
}

const Toolbar = memo(ToolbarComponent) as typeof ToolbarComponent;

// ============================================================================
// Main Enhanced Data Table
// ============================================================================

export interface EnhancedDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  actions?: TableAction<T>[];
  bulkActions?: BulkAction<T>[];
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  searchable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  onRefresh?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function EnhancedDataTable<T>({
  data,
  columns,
  getRowId,
  actions,
  bulkActions,
  onRowClick,
  selectable = true,
  searchable = true,
  pagination: showPagination = true,
  pageSize: initialPageSize = 10,
  onRefresh,
  onExport,
  isLoading = false,
  emptyMessage = 'No data available',
  className,
}: EnhancedDataTableProps<T>) {
  const [searchValue, setSearchValue] = useState('');
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Filter data by search
  const filteredData = useMemo(() => {
    if (!searchValue) return data;

    const query = searchValue.toLowerCase();
    return data.filter((row) => {
      return columns.some((col) => {
        if (!col.filterable) return false;
        const value = typeof col.accessor === 'function'
          ? col.accessor(row)
          : row[col.accessor as keyof T];
        return String(value).toLowerCase().includes(query);
      });
    });
  }, [data, searchValue, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortState.column || !sortState.direction) return filteredData;

    const column = columns.find(c => c.id === sortState.column);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = typeof column.accessor === 'function'
        ? column.accessor(a)
        : a[column.accessor as keyof T];
      const bValue = typeof column.accessor === 'function'
        ? column.accessor(b)
        : b[column.accessor as keyof T];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
      return sortState.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortState, columns]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, showPagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Handle sort
  const handleSort = useCallback((columnId: string) => {
    setSortState(prev => {
      if (prev.column !== columnId) {
        return { column: columnId, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column: columnId, direction: 'desc' };
      }
      return { column: null, direction: null };
    });
  }, []);

  // Selection handlers
  const toggleRow = useCallback((id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedData.map(getRowId)));
    }
  }, [selectedRows.size, paginatedData, getRowId]);

  const isAllSelected = paginatedData.length > 0 && selectedRows.size === paginatedData.length;
  const isIndeterminate = selectedRows.size > 0 && selectedRows.size < paginatedData.length;

  // Bulk action handler
  const handleBulkAction = useCallback((actionId: string) => {
    const action = bulkActions?.find(a => a.id === actionId);
    if (action) {
      const rows = paginatedData.filter(row => selectedRows.has(getRowId(row)));
      action.onClick(rows);
    }
  }, [bulkActions, paginatedData, selectedRows, getRowId]);

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue]);

  // Reset selection on data change
  useEffect(() => {
    setSelectedRows(new Set());
  }, [data]);

  const contextValue = useMemo<TableContextValue<T>>(() => ({
    selectedRows,
    toggleRow,
    toggleAll,
    isAllSelected,
    isIndeterminate,
  }), [selectedRows, toggleRow, toggleAll, isAllSelected, isIndeterminate]);

  return (
    <TableContext.Provider value={contextValue}>
      <div className={cn("bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden", className)}>
        {/* Toolbar */}
        {searchable && (
          <Toolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            selectedCount={selectedRows.size}
            bulkActions={bulkActions}
            onBulkAction={handleBulkAction}
            onRefresh={onRefresh}
            onExport={onExport}
            isLoading={isLoading}
          />
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {selectable && (
                  <th className="w-12 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button onClick={toggleAll} className="flex items-center justify-center">
                      {isAllSelected ? (
                        <CheckSquare className="h-5 w-5 text-violet-600" />
                      ) : isIndeterminate ? (
                        <div className="relative">
                          <Square className="h-5 w-5 text-violet-600" />
                          <Minus className="absolute inset-0 h-5 w-5 text-violet-600" />
                        </div>
                      ) : (
                        <Square className="h-5 w-5 text-slate-400" />
                      )}
                    </button>
                  </th>
                )}
                {columns.filter(c => !c.hidden).map((column) => (
                  <ColumnHeader
                    key={column.id}
                    column={column}
                    sortState={sortState}
                    onSort={handleSort}
                  />
                ))}
                {actions && actions.length > 0 && (
                  <th className="w-12 px-2 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50" />
                )}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.filter(c => !c.hidden).length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                      className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          Loading...
                        </div>
                      ) : (
                        emptyMessage
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, index) => (
                    <TableRow
                      key={getRowId(row)}
                      row={row}
                      rowId={getRowId(row)}
                      columns={columns}
                      actions={actions}
                      index={index}
                      selectable={selectable}
                      onClick={onRowClick}
                    />
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {showPagination && sortedData.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedData.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </TableContext.Provider>
  );
}

export default EnhancedDataTable;
