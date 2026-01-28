/**
 * Animated Table Component
 * Enhanced table with sorting, filtering, and animations
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';
import { SkeletonTable } from './skeleton-loader';
import { animationConfig } from '@/lib/animations/config';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

export interface AnimatedTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  selectable?: boolean;
  onRowSelect?: (row: T) => void;
  selectedRows?: Set<string>;
  rowKey: keyof T;
  emptyMessage?: string;
  searchable?: boolean;
  onSearch?: (query: string) => void;
  className?: string;
}

export function AnimatedTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  selectable = false,
  onRowSelect,
  selectedRows = new Set(),
  rowKey,
  emptyMessage = 'No data available',
  searchable = false,
  onSearch,
  className = '',
}: AnimatedTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  const sortedData = React.useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === bVal) return 0;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  if (loading) {
    return <SkeletonTable rows={5} columns={columns.length} />;
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Search Bar */}
      {searchable && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </motion.div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full">
          {/* Header */}
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-sm font-semibold text-gray-700 ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {sortColumn === column.key ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                        )}
                      </motion.div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="bg-white divide-y divide-gray-200">
            <AnimatePresence mode="popLayout">
              {sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedData.map((row, index) => {
                  const key = String(row[rowKey]);
                  const isSelected = selectedRows.has(key);
                  const isHovered = hoveredRow === key;

                  return (
                    <motion.tr
                      key={key}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{
                        duration: animationConfig.duration.fast,
                        delay: index * animationConfig.stagger.fast,
                      }}
                      onMouseEnter={() => setHoveredRow(key)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => onRowSelect?.(row)}
                      className={`
                        transition-colors
                        ${isSelected ? 'bg-violet-50' : isHovered ? 'bg-gray-50' : ''}
                        ${onRowSelect ? 'cursor-pointer' : ''}
                      `}
                    >
                      {selectable && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onRowSelect?.(row)}
                            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                        </td>
                      )}
                      {columns.map((column) => (
                        <td key={column.key} className="px-4 py-3 text-sm text-gray-900">
                          {column.render
                            ? column.render(row[column.key], row)
                            : row[column.key]}
                        </td>
                      ))}
                    </motion.tr>
                  );
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Simple Table - lightweight version without animations
 */
export function SimpleTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  className = '',
}: Pick<AnimatedTableProps<T>, 'columns' | 'data' | 'rowKey' | 'className'>) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-gray-200 ${className}`}>
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-left text-sm font-semibold text-gray-700"
                style={{ width: column.width }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row) => (
            <tr key={String(row[rowKey])} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 text-sm text-gray-900">
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Expandable Row Table - table with expandable rows
 */
export function ExpandableTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  renderExpanded,
  className = '',
}: Omit<AnimatedTableProps<T>, 'onRowSelect'> & {
  renderExpanded: (row: T) => React.ReactNode;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className={`overflow-x-auto rounded-lg border border-gray-200 ${className}`}>
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="w-12"></th>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-left text-sm font-semibold text-gray-700"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {data.map((row) => {
            const key = String(row[rowKey]);
            const isExpanded = expandedRows.has(key);

            return (
              <React.Fragment key={key}>
                <tr className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleRow(key)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: animationConfig.duration.fast }}
                      >
                        <ChevronDown className="w-5 h-5" />
                      </motion.div>
                    </button>
                  </td>
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-sm text-gray-900">
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                </tr>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.tr
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: animationConfig.duration.normal }}
                    >
                      <td colSpan={columns.length + 1} className="px-4 py-4 bg-gray-50">
                        {renderExpanded(row)}
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
