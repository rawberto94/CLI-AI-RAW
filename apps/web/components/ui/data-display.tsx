'use client';

/**
 * Data Display Components
 * Tables, lists, avatars, timelines, and data visualization
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Check,
  Minus,
  ArrowUpDown,
  Filter,
  Download,
  Search,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Avatar
// ============================================

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
  shape?: 'circle' | 'square';
  className?: string;
}

const avatarSizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 text-xl',
};

const statusSizes = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
  '2xl': 'w-5 h-5',
};

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-slate-400',
  away: 'bg-amber-500',
  busy: 'bg-red-500',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function stringToColor(str: string): string {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-red-500',
    'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  status,
  shape = 'circle',
  className,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={cn('relative inline-flex flex-shrink-0', className)}>
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden',
          avatarSizes[size],
          shape === 'circle' ? 'rounded-full' : 'rounded-lg',
          !src || imageError ? stringToColor(name || 'User') : 'bg-slate-200'
        )}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="font-medium text-white">
            {name ? getInitials(name) : '?'}
          </span>
        )}
      </div>

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-slate-900',
            statusSizes[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  );
}

// ============================================
// Avatar Group
// ============================================

interface AvatarGroupProps {
  avatars: Array<{ src?: string; name: string }>;
  max?: number;
  size?: AvatarProps['size'];
}

export function AvatarGroup({ avatars, max = 4, size = 'md' }: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const overlap = {
    xs: '-ml-1.5',
    sm: '-ml-2',
    md: '-ml-2.5',
    lg: '-ml-3',
    xl: '-ml-4',
    '2xl': '-ml-5',
  };

  return (
    <div className="flex items-center">
      {visible.map((avatar, index) => (
        <div
          key={index}
          className={cn('relative', index > 0 && overlap[size])}
          style={{ zIndex: visible.length - index }}
        >
          <Avatar
            src={avatar.src}
            name={avatar.name}
            size={size}
            className="ring-2 ring-white dark:ring-slate-900"
          />
        </div>
      ))}

      {remaining > 0 && (
        <div
          className={cn(
            'flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-full ring-2 ring-white dark:ring-slate-900',
            avatarSizes[size],
            overlap[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

// ============================================
// Enhanced List Item
// ============================================

interface ListItemProps {
  title: string;
  subtitle?: string;
  description?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ListItem({
  title,
  subtitle,
  description,
  leftContent,
  rightContent,
  onClick,
  selected,
  disabled,
  className,
}: ListItemProps) {
  return (
    <motion.div
      whileHover={!disabled ? { backgroundColor: 'rgba(0,0,0,0.02)' } : undefined}
      whileTap={!disabled && onClick ? { scale: 0.99 } : undefined}
      onClick={!disabled ? onClick : undefined}
      className={cn(
        'flex items-center gap-4 p-4 transition-colors',
        onClick && !disabled && 'cursor-pointer',
        selected && 'bg-blue-50 dark:bg-blue-900/20',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {leftContent && (
        <div className="flex-shrink-0">{leftContent}</div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-white truncate">
            {title}
          </span>
          {subtitle && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 truncate">
            {description}
          </p>
        )}
      </div>

      {rightContent && (
        <div className="flex-shrink-0">{rightContent}</div>
      )}
    </motion.div>
  );
}

// ============================================
// List with Dividers
// ============================================

interface ListProps {
  children: React.ReactNode;
  divided?: boolean;
  className?: string;
}

export function List({ children, divided = true, className }: ListProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden',
        divided && 'divide-y divide-slate-200 dark:divide-slate-700',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// Timeline
// ============================================

interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  time?: string;
  icon?: React.ReactNode;
  color?: 'default' | 'success' | 'warning' | 'error' | 'info';
  content?: React.ReactNode;
}

interface TimelineProps {
  items: TimelineItem[];
  variant?: 'default' | 'compact' | 'alternating';
}

const timelineColors = {
  default: 'bg-slate-400',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
};

export function Timeline({ items, variant = 'default' }: TimelineProps) {
  return (
    <div className="relative">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isAlternate = variant === 'alternating' && index % 2 === 1;

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: isAlternate ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              'relative flex gap-4',
              variant === 'alternating' && 'md:w-1/2',
              variant === 'alternating' && isAlternate && 'md:ml-auto md:flex-row-reverse'
            )}
          >
            {/* Line */}
            {!isLast && (
              <div
                className={cn(
                  'absolute left-[15px] top-8 w-0.5 bg-slate-200 dark:bg-slate-700',
                  variant === 'compact' ? 'h-8' : 'h-full'
                )}
              />
            )}

            {/* Dot/Icon */}
            <div
              className={cn(
                'relative z-10 flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full',
                timelineColors[item.color || 'default']
              )}
            >
              {item.icon || <Circle className="w-3 h-3 text-white fill-white" />}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-8', variant === 'compact' && 'pb-4')}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-900 dark:text-white">
                  {item.title}
                </span>
                {item.time && (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {item.time}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {item.description}
                </p>
              )}
              {item.content && (
                <div className="mt-3">{item.content}</div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================
// Data Table
// ============================================

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  selectable?: boolean;
  selectedKeys?: Set<string | number>;
  onSelectionChange?: (keys: Set<string | number>) => void;
  sortable?: boolean;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  striped?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  selectable,
  selectedKeys = new Set(),
  onSelectionChange,
  sortable,
  onSort,
  loading,
  emptyMessage = 'No data available',
  onRowClick,
  striped = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDirection(newDirection);
    onSort?.(key, newDirection);
  };

  const handleSelectAll = () => {
    if (selectedKeys.size === data.length) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(data.map(item => item[keyField])));
    }
  };

  const handleSelectRow = (key: string | number) => {
    const newKeys = new Set(selectedKeys);
    if (newKeys.has(key)) {
      newKeys.delete(key);
    } else {
      newKeys.add(key);
    }
    onSelectionChange?.(newKeys);
  };

  const allSelected = data.length > 0 && selectedKeys.size === data.length;
  const someSelected = selectedKeys.size > 0 && selectedKeys.size < data.length;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <button
                    onClick={handleSelectAll}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      allSelected || someSelected
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    )}
                  >
                    {allSelected ? (
                      <Check className="w-3 h-3" />
                    ) : someSelected ? (
                      <Minus className="w-3 h-3" />
                    ) : null}
                  </button>
                </th>
              )}
              {columns.map(column => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider',
                    (column.sortable || sortable) && 'cursor-pointer hover:text-slate-900 dark:hover:text-white'
                  )}
                  onClick={() => (column.sortable || sortable) && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {(column.sortable || sortable) && (
                      <ArrowUpDown className={cn(
                        'w-4 h-4',
                        sortKey === column.key ? 'text-blue-500' : 'text-slate-400'
                      )} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {selectable && <td className="px-4 py-4"><div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" /></td>}
                  {columns.map(column => (
                    <td key={column.key} className="px-4 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const key = item[keyField];
                const isSelected = selectedKeys.has(key);

                return (
                  <motion.tr
                    key={key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer',
                      isSelected && 'bg-blue-50 dark:bg-blue-900/20',
                      striped && index % 2 === 1 && 'bg-slate-50 dark:bg-slate-800/30',
                      !isSelected && 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    )}
                  >
                    {selectable && (
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleSelectRow(key)}
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                            isSelected
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </button>
                      </td>
                    )}
                    {columns.map(column => (
                      <td
                        key={column.key}
                        className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300"
                      >
                        {column.render
                          ? column.render(item, index)
                          : item[column.key]}
                      </td>
                    ))}
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// Stat Card
// ============================================

interface StatDisplayProps {
  label: string;
  value: string | number;
  previousValue?: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  color?: 'default' | 'blue' | 'green' | 'red' | 'amber' | 'purple';
  size?: 'sm' | 'md' | 'lg';
}

const statColors = {
  default: 'text-slate-600 dark:text-slate-400',
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  red: 'text-red-600 dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
  purple: 'text-purple-600 dark:text-purple-400',
};

export function StatDisplay({
  label,
  value,
  previousValue,
  trend,
  trendValue,
  icon,
  color = 'default',
  size = 'md',
}: StatDisplayProps) {
  const valueSizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        {icon && <span className={statColors[color]}>{icon}</span>}
        <span>{label}</span>
      </div>

      <div className="flex items-end gap-3">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('font-bold text-slate-900 dark:text-white', valueSizes[size])}
        >
          {value}
        </motion.span>

        {(trend || trendValue) && (
          <span
            className={cn(
              'flex items-center gap-1 text-sm font-medium mb-1',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600',
              trend === 'neutral' && 'text-slate-500'
            )}
          >
            {trend === 'up' && <ChevronUp className="w-4 h-4" />}
            {trend === 'down' && <ChevronDown className="w-4 h-4" />}
            {trendValue}
          </span>
        )}
      </div>

      {previousValue !== undefined && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Previous: {previousValue}
        </p>
      )}
    </div>
  );
}

// ============================================
// Key-Value Display
// ============================================

interface KeyValuePair {
  key: string;
  value: React.ReactNode;
  copyable?: boolean;
}

interface KeyValueListProps {
  items: KeyValuePair[];
  columns?: 1 | 2 | 3;
  variant?: 'default' | 'striped' | 'card';
}

export function KeyValueList({
  items,
  columns = 1,
  variant = 'default',
}: KeyValueListProps) {
  const columnClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <dl
      className={cn(
        'grid gap-4',
        columnClass[columns],
        variant === 'card' && 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4'
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.key}
          className={cn(
            'flex flex-col gap-1',
            variant === 'striped' && index % 2 === 0 && 'bg-slate-50 dark:bg-slate-800/50 -mx-2 px-2 py-2 rounded'
          )}
        >
          <dt className="text-sm text-slate-500 dark:text-slate-400">
            {item.key}
          </dt>
          <dd className="text-slate-900 dark:text-white font-medium">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ============================================
// Progress Tracker
// ============================================

interface ProgressTrackerProps {
  label: string;
  current: number;
  total: number;
  unit?: string;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

const progressColors = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
};

export function ProgressTracker({
  label,
  current,
  total,
  unit,
  showPercentage = true,
  color = 'blue',
}: ProgressTrackerProps) {
  const percentage = Math.min((current / total) * 100, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className="font-medium text-slate-900 dark:text-white">
          {current.toLocaleString()}{unit && ` ${unit}`} / {total.toLocaleString()}{unit && ` ${unit}`}
          {showPercentage && (
            <span className="ml-2 text-slate-500">({percentage.toFixed(0)}%)</span>
          )}
        </span>
      </div>
      
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full rounded-full', progressColors[color])}
        />
      </div>
    </div>
  );
}

export default {
  Avatar,
  AvatarGroup,
  ListItem,
  List,
  Timeline,
  DataTable,
  StatDisplay,
  KeyValueList,
  ProgressTracker,
};
