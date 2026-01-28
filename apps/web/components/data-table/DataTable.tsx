'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronUp, ChevronDown, ChevronsUpDown, Filter, Search,
  CheckSquare, Square, MinusSquare, ArrowUpDown, Download,
  Settings2, Eye, EyeOff, GripVertical, MoreHorizontal,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';

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
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  align?: 'left' | 'center' | 'right';
  sticky?: boolean;
  hidden?: boolean;
  cell?: (value: unknown, row: T) => React.ReactNode;
}

interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface FilterState {
  [key: string]: string;
}

interface PaginationState {
  page: number;
  pageSize: number;
}

// ============================================================================
// Data Table
// ============================================================================

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (rows: T[]) => void;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  stickyHeader?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyField,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  sortable = true,
  filterable = false,
  searchable = false,
  paginated = false,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  actions,
  stickyHeader = false,
  striped = false,
  hoverable = true,
  compact = false,
  className = '',
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });
  const [filters, setFilters] = useState<FilterState>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ 
    page: 1, 
    pageSize: initialPageSize 
  });
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    Object.fromEntries(columns.map(col => [col.id, !col.hidden]))
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Get cell value
  const getCellValue = useCallback((row: T, column: Column<T>): unknown => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor];
  }, []);

  // Filter data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(row => 
        columns.some(col => {
          const value = getCellValue(row, col);
          return String(value).toLowerCase().includes(query);
        })
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([columnId, filterValue]) => {
      if (filterValue) {
        const column = columns.find(col => col.id === columnId);
        if (column) {
          result = result.filter(row => {
            const value = getCellValue(row, column);
            return String(value).toLowerCase().includes(filterValue.toLowerCase());
          });
        }
      }
    });

    return result;
  }, [data, searchQuery, filters, columns, getCellValue]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sort.column || !sort.direction) return filteredData;

    const column = columns.find(col => col.id === sort.column);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = getCellValue(a, column);
      const bValue = getCellValue(b, column);

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sort, columns, getCellValue]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData;
    
    const start = (pagination.page - 1) * pagination.pageSize;
    return sortedData.slice(start, start + pagination.pageSize);
  }, [sortedData, paginated, pagination]);

  const totalPages = Math.ceil(sortedData.length / pagination.pageSize);

  // Handle sort
  const handleSort = (columnId: string) => {
    setSort(prev => {
      if (prev.column !== columnId) {
        return { column: columnId, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column: columnId, direction: 'desc' };
      }
      return { column: null, direction: null };
    });
  };

  // Selection helpers
  const isRowSelected = (row: T) => selectedRows.some(r => r[keyField] === row[keyField]);
  const isAllSelected = paginatedData.length > 0 && paginatedData.every(isRowSelected);
  const isSomeSelected = paginatedData.some(isRowSelected) && !isAllSelected;

  const toggleRowSelection = (row: T) => {
    if (isRowSelected(row)) {
      onSelectionChange?.(selectedRows.filter(r => r[keyField] !== row[keyField]));
    } else {
      onSelectionChange?.([...selectedRows, row]);
    }
  };

  const toggleAllSelection = () => {
    if (isAllSelected) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(paginatedData);
    }
  };

  // Visible columns
  const visibleColumns = columns.filter(col => columnVisibility[col.id]);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}>
      {/* Toolbar */}
      {(searchable || filterable) && (
        <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500"
                />
              </div>
            )}

            {filterable && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border transition-colors ${
                  showFilters 
                    ? 'bg-violet-50 border-violet-200 text-violet-600 dark:bg-violet-950 dark:border-violet-800 dark:text-violet-400'
                    : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Column Settings */}
            <div className="relative">
              <button
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Settings2 className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showColumnSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-20"
                  >
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                      Toggle Columns
                    </div>
                    {columns.map(col => (
                      <button
                        key={col.id}
                        onClick={() => setColumnVisibility(prev => ({ ...prev, [col.id]: !prev[col.id] }))}
                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                      >
                        {columnVisibility[col.id] ? (
                          <Eye className="w-4 h-4 text-violet-500" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        )}
                        {col.header}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter Row */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            <div className="p-4 flex flex-wrap gap-3">
              {visibleColumns.filter(col => col.filterable !== false).map(col => (
                <div key={col.id} className="flex-shrink-0">
                  <label className="block text-xs text-gray-500 mb-1">{col.header}</label>
                  <input
                    type="text"
                    value={filters[col.id] || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, [col.id]: e.target.value }))}
                    placeholder={`Filter ${col.header}...`}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 w-40"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <button onClick={toggleAllSelection}>
                    {isAllSelected ? (
                      <CheckSquare className="w-5 h-5 text-violet-600" />
                    ) : isSomeSelected ? (
                      <MinusSquare className="w-5 h-5 text-violet-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
              )}
              {visibleColumns.map(col => (
                <th
                  key={col.id}
                  style={{ 
                    width: col.width, 
                    minWidth: col.minWidth, 
                    maxWidth: col.maxWidth 
                  }}
                  className={`
                    px-4 ${compact ? 'py-2' : 'py-3'} text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider
                    ${col.sticky ? 'sticky left-0 bg-gray-50 dark:bg-gray-800/50' : ''}
                    ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''}
                  `}
                >
                  {sortable && col.sortable !== false ? (
                    <button
                      onClick={() => handleSort(col.id)}
                      className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-200"
                    >
                      {col.header}
                      {sort.column === col.id ? (
                        sort.direction === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {actions && (
                <th className="w-12 px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              // Loading skeleton
              Array.from({ length: pagination.pageSize }).map((_, i) => (
                <tr key={i}>
                  {selectable && (
                    <td className="px-4 py-3">
                      <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                  )}
                  {visibleColumns.map(col => (
                    <td key={col.id} className={`px-4 ${compact ? 'py-2' : 'py-3'}`}>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3">
                      <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                  )}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={String(row[keyField])}
                  onClick={() => onRowClick?.(row)}
                  className={`
                    ${onRowClick ? 'cursor-pointer' : ''}
                    ${hoverable ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}
                    ${striped && index % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}
                    ${isRowSelected(row) ? 'bg-violet-50 dark:bg-violet-950' : ''}
                    transition-colors
                  `}
                >
                  {selectable && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleRowSelection(row)}>
                        {isRowSelected(row) ? (
                          <CheckSquare className="w-5 h-5 text-violet-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                  )}
                  {visibleColumns.map(col => {
                    const value = getCellValue(row, col);
                    return (
                      <td
                        key={col.id}
                        className={`
                          px-4 ${compact ? 'py-2' : 'py-3'} text-sm text-gray-900 dark:text-white
                          ${col.sticky ? 'sticky left-0 bg-white dark:bg-gray-900' : ''}
                          ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''}
                        `}
                      >
                        {col.cell ? col.cell(value, row) : String(value ?? '')}
                      </td>
                    );
                  })}
                  {actions && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginated && totalPages > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Rows per page:</span>
            <select
              value={pagination.pageSize}
              onChange={(e) => setPagination({ page: 1, pageSize: Number(e.target.value) })}
              className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>
              {(pagination.page - 1) * pagination.pageSize + 1}-
              {Math.min(pagination.page * pagination.pageSize, sortedData.length)} of {sortedData.length}
            </span>

            <div className="flex items-center gap-1 ml-4">
              <button
                onClick={() => setPagination(p => ({ ...p, page: 1 }))}
                disabled={pagination.page === 1}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= totalPages}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: totalPages }))}
                disabled={pagination.page >= totalPages}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selection Summary */}
      <AnimatePresence>
        {selectedRows.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl shadow-2xl">
              <span className="font-medium">
                {selectedRows.length} item{selectedRows.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => onSelectionChange?.([])}
                className="text-sm text-gray-400 dark:text-gray-600 hover:text-white dark:hover:text-gray-900"
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Simple Table
// ============================================================================

interface SimpleTableProps {
  headers: string[];
  rows: React.ReactNode[][];
  className?: string;
  striped?: boolean;
  compact?: boolean;
}

export function SimpleTable({
  headers,
  rows,
  className = '',
  striped = false,
  compact = false,
}: SimpleTableProps) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/50">
            {headers.map((header, i) => (
              <th
                key={i}
                className={`px-4 ${compact ? 'py-2' : 'py-3'} text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {rows.map((row, i) => (
            <tr
              key={i}
              className={striped && i % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}
            >
              {row.map((cell, j) => (
                <td key={j} className={`px-4 ${compact ? 'py-2' : 'py-3'} text-sm text-gray-900 dark:text-white`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Comparison Table
// ============================================================================

interface ComparisonTableProps {
  items: {
    name: string;
    features: Record<string, boolean | string>;
    highlighted?: boolean;
  }[];
  featureLabels: Record<string, string>;
  className?: string;
}

export function ComparisonTable({
  items,
  featureLabels,
  className = '',
}: ComparisonTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr>
            <th className="px-4 py-4 text-left" />
            {items.map((item, i) => (
              <th
                key={i}
                className={`px-6 py-4 text-center ${
                  item.highlighted 
                    ? 'bg-violet-50 dark:bg-violet-950 border-t-4 border-violet-500' 
                    : ''
                }`}
              >
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {item.name}
                </span>
                {item.highlighted && (
                  <span className="block text-xs text-violet-600 dark:text-violet-400 mt-1">
                    Most Popular
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {Object.entries(featureLabels).map(([key, label]) => (
            <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </td>
              {items.map((item, i) => {
                const value = item.features[key];
                return (
                  <td
                    key={i}
                    className={`px-6 py-3 text-center ${
                      item.highlighted ? 'bg-violet-50/50 dark:bg-violet-950/50' : ''
                    }`}
                  >
                    {typeof value === 'boolean' ? (
                      value ? (
                        <CheckSquare className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )
                    ) : (
                      <span className="text-sm text-gray-900 dark:text-white">{value}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
