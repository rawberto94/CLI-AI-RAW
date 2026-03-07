'use client';

/**
 * Data Table
 * Feature-rich table with sorting, filtering, pagination
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
  Download,
  Columns,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/forms';
import { Popover, ActionPopover } from '@/components/overlays';

// ============================================================================
// Types
// ============================================================================

type SortDirection = 'asc' | 'desc' | null;

interface Column<T> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  cell?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  stickyHeader?: boolean;
  striped?: boolean;
  compact?: boolean;
  actions?: (row: T) => { label: string; onClick: () => void; danger?: boolean }[];
  bulkActions?: { label: string; onClick: (rows: T[]) => void; danger?: boolean }[];
  exportable?: boolean;
  onExport?: (data: T[]) => void;
}

// ============================================================================
// Sort Icon Component
// ============================================================================

function SortIcon({ direction }: { direction: SortDirection }) {
  if (!direction) {
    return <ChevronsUpDown className="w-4 h-4 text-slate-300" />;
  }
  return direction === 'asc' 
    ? <ChevronUp className="w-4 h-4 text-violet-600" />
    : <ChevronDown className="w-4 h-4 text-violet-600" />;
}

// ============================================================================
// Main Component
// ============================================================================

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  pageSize = 10,
  selectable = false,
  onSelectionChange,
  onRowClick,
  emptyMessage = 'No data available',
  isLoading = false,
  stickyHeader = false,
  striped = false,
  compact = false,
  actions,
  bulkActions,
  exportable = false,
  onExport,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map(c => c.id))
  );

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase();
    return data.filter((row) => {
      return columns.some((col) => {
        if (!col.filterable) return false;
        const value = typeof col.accessor === 'function' 
          ? col.accessor(row) 
          : row[col.accessor];
        return String(value).toLowerCase().includes(query);
      });
    });
  }, [data, searchQuery, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    
    const column = columns.find(c => c.id === sortColumn);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = typeof column.accessor === 'function' 
        ? column.accessor(a) 
        : a[column.accessor];
      const bVal = typeof column.accessor === 'function' 
        ? column.accessor(b) 
        : b[column.accessor];
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Handle sort
  const handleSort = useCallback((columnId: string) => {
    if (sortColumn === columnId) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  // Handle selection
  const handleSelectAll = useCallback(() => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const newSelected = new Set(paginatedData.map(row => row.id));
      setSelectedRows(newSelected);
      onSelectionChange?.(paginatedData);
    }
  }, [paginatedData, selectedRows, onSelectionChange]);

  const handleSelectRow = useCallback((rowId: string | number, row: T) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
    onSelectionChange?.(data.filter(r => newSelected.has(r.id)));
  }, [selectedRows, onSelectionChange, data]);

  // Get cell value
  const getCellValue = (row: T, column: Column<T>): React.ReactNode => {
    const value = typeof column.accessor === 'function' 
      ? column.accessor(row) 
      : row[column.accessor];
    
    if (column.cell) {
      return column.cell(value, row);
    }
    return value as React.ReactNode;
  };

  const visibleColumnsList = columns.filter(c => visibleColumns.has(c.id));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search..."
            className="w-full h-10 pl-10 pr-4 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-indigo-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk Actions */}
          {bulkActions && selectedRows.size > 0 && (
            <div className="flex items-center gap-2 mr-4">
              <span className="text-sm text-slate-600">
                {selectedRows.size} selected
              </span>
              {bulkActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => action.onClick(data.filter(r => selectedRows.has(r.id)))}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                    action.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Column Visibility */}
          <Popover
            trigger={
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Columns className="w-5 h-5" />
              </button>
            }
            closeOnClick={false}
            content={
              <div className="p-3 min-w-[180px]">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Columns</p>
                {columns.map((col) => (
                  <label key={col.id} className="flex items-center gap-2 py-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.id)}
                      onChange={() => {
                        const newVisible = new Set(visibleColumns);
                        if (newVisible.has(col.id)) {
                          if (newVisible.size > 1) newVisible.delete(col.id);
                        } else {
                          newVisible.add(col.id);
                        }
                        setVisibleColumns(newVisible);
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-sm text-slate-700">{col.header}</span>
                  </label>
                ))}
              </div>
            }
          />

          {/* Export */}
          {exportable && (
            <button
              onClick={() => onExport?.(sortedData)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header */}
            <thead className={cn(
              'bg-slate-50 border-b border-slate-200',
              stickyHeader && 'sticky top-0 z-10'
            )}>
              <tr>
                {selectable && (
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                  </th>
                )}
                {visibleColumnsList.map((column) => (
                  <th
                    key={column.id}
                    className={cn(
                      'px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider',
                      compact ? 'py-2' : 'py-3',
                      column.sortable && 'cursor-pointer hover:text-slate-700 select-none',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right'
                    )}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(column.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.header}</span>
                      {column.sortable && (
                        <SortIcon direction={sortColumn === column.id ? sortDirection : null} />
                      )}
                    </div>
                  </th>
                ))}
                {actions && <th className="w-12" />}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i}>
                    {selectable && (
                      <td className="px-4 py-3">
                        <div className="w-4 h-4 bg-slate-200 rounded animate-pulse" />
                      </td>
                    )}
                    {visibleColumnsList.map((col) => (
                      <td key={col.id} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse" style={{ width: '60%' }} />
                      </td>
                    ))}
                    {actions && <td />}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td 
                    colSpan={visibleColumnsList.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIndex) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: rowIndex * 0.02 }}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-slate-50',
                      striped && rowIndex % 2 === 1 && 'bg-slate-50/50',
                      selectedRows.has(row.id) && 'bg-violet-50'
                    )}
                  >
                    {selectable && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.id)}
                          onChange={() => handleSelectRow(row.id, row)}
                          className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                      </td>
                    )}
                    {visibleColumnsList.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          'px-4 text-sm text-slate-700',
                          compact ? 'py-2' : 'py-3',
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right'
                        )}
                      >
                        {getCellValue(row, column)}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-2" onClick={(e) => e.stopPropagation()}>
                        <ActionPopover
                          trigger={
                            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          }
                          actions={actions(row)}
                        />
                      </td>
                    )}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-600">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        'w-8 h-8 text-sm font-medium rounded-lg transition-colors',
                        currentPage === pageNum
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
