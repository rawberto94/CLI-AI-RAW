'use client';

import React, {
  useState,
  useCallback,
  useMemo,
  memo,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
  GripVertical,
  Plus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  Tag,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Search,
  LayoutGrid,
  List,
  Settings,
  X,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  Eye,
  MessageSquare,
  Paperclip,
  Flag,
  Circle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignees?: { id: string; name: string; avatar?: string }[];
  dueDate?: Date;
  tags?: { id: string; label: string; color: string }[];
  attachments?: number;
  comments?: number;
  progress?: number;
  metadata?: Record<string, any>;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  icon?: React.ComponentType<{ className?: string }>;
  limit?: number;
  collapsed?: boolean;
}

export interface KanbanBoardProps<T extends KanbanItem> {
  columns: KanbanColumn[];
  items: T[];
  onItemMove?: (itemId: string, fromColumn: string, toColumn: string, newIndex: number) => void;
  onItemClick?: (item: T) => void;
  onItemEdit?: (item: T) => void;
  onItemDelete?: (item: T) => void;
  onAddItem?: (columnId: string) => void;
  onColumnReorder?: (columns: KanbanColumn[]) => void;
  renderCard?: (item: T) => ReactNode;
  searchable?: boolean;
  filterable?: boolean;
  className?: string;
}

// ============================================================================
// Priority Colors & Icons
// ============================================================================

const priorityConfig = {
  low: {
    color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    icon: null,
    label: 'Low',
  },
  medium: {
    color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    icon: null,
    label: 'Medium',
  },
  high: {
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    icon: AlertCircle,
    label: 'High',
  },
  urgent: {
    color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    icon: Flag,
    label: 'Urgent',
  },
};

// ============================================================================
// Column Component
// ============================================================================

interface KanbanColumnComponentProps<T extends KanbanItem> {
  column: KanbanColumn;
  items: T[];
  onItemClick?: (item: T) => void;
  onItemEdit?: (item: T) => void;
  onItemDelete?: (item: T) => void;
  onAddItem?: () => void;
  onItemMove?: (itemId: string, fromColumn: string, toColumn: string, newIndex: number) => void;
  onToggleCollapse?: () => void;
  renderCard?: (item: T) => ReactNode;
  allColumns: KanbanColumn[];
}

function KanbanColumnComponent<T extends KanbanItem>({
  column,
  items,
  onItemClick,
  onItemEdit,
  onItemDelete,
  onAddItem,
  onItemMove,
  onToggleCollapse,
  renderCard,
  allColumns,
}: KanbanColumnComponentProps<T>) {
  const [isDragOver, setIsDragOver] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const isOverLimit = column.limit ? items.length >= column.limit : false;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.itemId && data.fromColumn !== column.id) {
          onItemMove?.(data.itemId, data.fromColumn, column.id, items.length);
        }
      } catch {
        // Ignore parse errors
      }
    },
    [column.id, items.length, onItemMove]
  );

  if (column.collapsed) {
    return (
      <motion.div
        layout
        className="flex-shrink-0 w-12 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        onClick={onToggleCollapse}
      >
        <div className="h-full flex flex-col items-center py-4 gap-2">
          <ChevronRight className="w-4 h-4 text-zinc-500" />
          <div
            className="writing-mode-vertical text-sm font-medium text-zinc-700 dark:text-zinc-300"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {column.title}
          </div>
          <div className="mt-auto px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded-full text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {items.length}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={columnRef}
      layout
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-shrink-0 w-80 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border transition-all ${
        isDragOver
          ? 'border-violet-400 dark:border-violet-500 ring-2 ring-violet-400/20'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {column.icon && (
              <column.icon
                className={`w-4 h-4 ${column.color || 'text-zinc-500'}`}
              />
            )}
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              {column.title}
            </h3>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                isOverLimit
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {items.length}
              {column.limit && `/${column.limit}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              title="Collapse column"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={onAddItem}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              title="Add item"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* WIP Limit Warning */}
        {isOverLimit && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-3 h-3" />
            WIP limit exceeded
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="p-2 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              columnId={column.id}
              allColumns={allColumns}
              onClick={() => onItemClick?.(item)}
              onEdit={() => onItemEdit?.(item)}
              onDelete={() => onItemDelete?.(item)}
              onMove={onItemMove}
              renderCard={renderCard}
            />
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              No items
            </p>
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onAddItem}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add item
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Card Component
// ============================================================================

interface KanbanCardProps<T extends KanbanItem> {
  item: T;
  columnId: string;
  allColumns: KanbanColumn[];
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: (itemId: string, fromColumn: string, toColumn: string, newIndex: number) => void;
  renderCard?: (item: T) => ReactNode;
}

function KanbanCard<T extends KanbanItem>({
  item,
  columnId,
  allColumns,
  onClick,
  onEdit,
  onDelete,
  onMove,
  renderCard,
}: KanbanCardProps<T>) {
  const [showMenu, setShowMenu] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({ itemId: item.id, fromColumn: columnId })
      );
      e.dataTransfer.effectAllowed = 'move';
    },
    [item.id, columnId]
  );

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowMoveMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (renderCard) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        draggable
        onDragStartCapture={handleDragStart}
      >
        {renderCard(item)}
      </motion.div>
    );
  }

  const priority = item.priority ? priorityConfig[item.priority] : null;
  const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStartCapture={handleDragStart}
      onClick={onClick}
      className="group relative bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 cursor-pointer hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-600 transition-all"
    >
      {/* Drag Handle */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-zinc-400" />
      </div>

      {/* Menu Button */}
      <div className="absolute right-2 top-2" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-all"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {showMenu && (
            <motion.div key="menu"
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 py-1 z-50"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <Eye className="w-4 h-4" />
                View
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoveMenu(!showMoveMenu);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <span className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Move to
                </span>
                <ChevronRight className="w-3 h-3" />
              </button>

              {/* Move Submenu */}
              {showMoveMenu && (
                <div className="absolute left-full top-0 ml-1 w-40 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 py-1">
                  {allColumns
                    .filter((col) => col.id !== columnId)
                    .map((col) => (
                      <button
                        key={col.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMove?.(item.id, columnId, col.id, 0);
                          setShowMenu(false);
                          setShowMoveMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      >
                        {col.icon && <col.icon className="w-4 h-4" />}
                        {col.title}
                      </button>
                    ))}
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(item.id);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <Copy className="w-4 h-4" />
                Copy ID
              </button>
              <div className="my-1 border-t border-zinc-100 dark:border-zinc-700" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Priority Badge */}
      {priority && (
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${priority.color}`}
        >
          {priority.icon && <priority.icon className="w-3 h-3" />}
          {priority.label}
        </div>
      )}

      {/* Title */}
      <h4 className="font-medium text-zinc-900 dark:text-white mb-1 pr-6 line-clamp-2">
        {item.title}
      </h4>

      {/* Description */}
      {item.description && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3">
          {item.description}
        </p>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="px-2 py-0.5 text-xs rounded-full"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
              }}
            >
              {tag.label}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              +{item.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {item.progress !== undefined && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span>Progress</span>
            <span>{item.progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-violet-500 rounded-full transition-all"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        {/* Due Date */}
        {item.dueDate && (
          <div
            className={`flex items-center gap-1 ${
              isOverdue
                ? 'text-red-500'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Calendar className="w-3 h-3" />
            {new Date(item.dueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-3 text-zinc-400">
          {item.comments !== undefined && item.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {item.comments}
            </span>
          )}
          {item.attachments !== undefined && item.attachments > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="w-3 h-3" />
              {item.attachments}
            </span>
          )}
        </div>

        {/* Assignees */}
        {item.assignees && item.assignees.length > 0 && (
          <div className="flex -space-x-2">
            {item.assignees.slice(0, 3).map((assignee) => (
              <div
                key={assignee.id}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-500 flex items-center justify-center text-white text-xs font-medium ring-2 ring-white dark:ring-zinc-800"
                title={assignee.name}
              >
                {assignee.avatar ? (
                  <img
                    src={assignee.avatar}
                    alt={assignee.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  assignee.name.charAt(0).toUpperCase()
                )}
              </div>
            ))}
            {item.assignees.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 text-xs font-medium ring-2 ring-white dark:ring-zinc-800">
                +{item.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Board Component
// ============================================================================

export function KanbanBoard<T extends KanbanItem>({
  columns: initialColumns,
  items,
  onItemMove,
  onItemClick,
  onItemEdit,
  onItemDelete,
  onAddItem,
  onColumnReorder,
  renderCard,
  searchable = true,
  filterable = true,
  className = '',
}: KanbanBoardProps<T>) {
  const [columns, setColumns] = useState(initialColumns);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // Update columns when prop changes
  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPriority =
        !priorityFilter || item.priority === priorityFilter;

      return matchesSearch && matchesPriority;
    });
  }, [items, searchQuery, priorityFilter]);

  // Group items by column
  const itemsByColumn = useMemo(() => {
    const grouped: Record<string, T[]> = {};
    columns.forEach((col) => {
      grouped[col.id] = filteredItems.filter((item) => item.status === col.id);
    });
    return grouped;
  }, [columns, filteredItems]);

  const toggleColumnCollapse = useCallback((columnId: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, collapsed: !col.collapsed } : col
      )
    );
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4 px-2">
        <div className="flex items-center gap-3">
          {/* Search */}
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="pl-10 pr-4 py-2 w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Priority Filter */}
          {filterable && (
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <button
                onClick={() => setPriorityFilter(null)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  !priorityFilter
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                All
              </button>
              {Object.entries(priorityConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setPriorityFilter(key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    priorityFilter === key
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <button
            onClick={() => setViewMode('board')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'board'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
            title="Board view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-h-full">
          {columns.map((column) => (
            <KanbanColumnComponent
              key={column.id}
              column={column}
              items={itemsByColumn[column.id] || []}
              allColumns={columns}
              onItemClick={onItemClick}
              onItemEdit={onItemEdit}
              onItemDelete={onItemDelete}
              onAddItem={() => onAddItem?.(column.id)}
              onItemMove={onItemMove}
              onToggleCollapse={() => toggleColumnCollapse(column.id)}
              renderCard={renderCard}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Default Column Configurations
// ============================================================================

export const defaultContractColumns: KanbanColumn[] = [
  {
    id: 'draft',
    title: 'Draft',
    icon: Edit2,
    color: 'text-zinc-500',
  },
  {
    id: 'review',
    title: 'In Review',
    icon: Eye,
    color: 'text-violet-500',
    limit: 5,
  },
  {
    id: 'approval',
    title: 'Pending Approval',
    icon: Clock,
    color: 'text-amber-500',
    limit: 3,
  },
  {
    id: 'active',
    title: 'Active',
    icon: CheckCircle2,
    color: 'text-green-500',
  },
];

export const defaultWorkflowColumns: KanbanColumn[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    icon: List,
    color: 'text-zinc-500',
  },
  {
    id: 'todo',
    title: 'To Do',
    icon: Circle,
    color: 'text-violet-500',
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    icon: Clock,
    color: 'text-amber-500',
    limit: 3,
  },
  {
    id: 'done',
    title: 'Done',
    icon: CheckCircle2,
    color: 'text-green-500',
  },
];

// (icon placeholder removed)
