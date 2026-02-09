'use client';

/**
 * Sortable List Component
 * Drag and drop reordering with animations
 */

import React, { useState, useCallback } from 'react';
import { motion, Reorder, useDragControls } from 'framer-motion';
import { GripVertical, X, Plus, Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface SortableItem {
  id: string;
  content: React.ReactNode;
}

interface SortableListProps {
  items: SortableItem[];
  onReorder: (items: SortableItem[]) => void;
  onRemove?: (id: string) => void;
  removable?: boolean;
  className?: string;
}

interface DraggableCardProps {
  item: SortableItem;
  onRemove?: () => void;
  removable?: boolean;
}

// ============================================================================
// Draggable Card
// ============================================================================

function DraggableCard({ item, onRemove, removable = false }: DraggableCardProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={dragControls}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      whileDrag={{ 
        scale: 1.02, 
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        zIndex: 10 
      }}
      className="relative"
    >
      <div className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl group">
        {/* Drag handle */}
        <button
          onPointerDown={(e) => dragControls.start(e)}
          className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">{item.content}</div>

        {/* Remove button */}
        {removable && onRemove && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onRemove}
            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </Reorder.Item>
  );
}

// ============================================================================
// Sortable List
// ============================================================================

export function SortableList({
  items,
  onReorder,
  onRemove,
  removable = true,
  className,
}: SortableListProps) {
  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={onReorder}
      className={cn('space-y-2', className)}
    >
      {items.map((item) => (
        <DraggableCard
          key={item.id}
          item={item}
          removable={removable}
          onRemove={onRemove ? () => onRemove(item.id) : undefined}
        />
      ))}
    </Reorder.Group>
  );
}

// ============================================================================
// Checkbox List with Reorder
// ============================================================================

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface ChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  onAdd?: (label: string) => void;
  addPlaceholder?: string;
  className?: string;
}

export function Checklist({
  items,
  onChange,
  onAdd,
  addPlaceholder = 'Add new item...',
  className,
}: ChecklistProps) {
  const [newItemLabel, setNewItemLabel] = useState('');

  const handleToggle = (id: string) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const handleRemove = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleAdd = () => {
    if (newItemLabel.trim() && onAdd) {
      onAdd(newItemLabel.trim());
      setNewItemLabel('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  // Convert to Reorder format
  const reorderItems = items.map((item) => ({
    id: item.id,
    content: (
      <label className="flex items-center gap-3 cursor-pointer group">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.preventDefault();
            handleToggle(item.id);
          }}
          className={cn(
            'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
            item.checked
              ? 'bg-violet-600 border-violet-600'
              : 'border-slate-300 hover:border-indigo-400'
          )}
        >
          {item.checked && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <Check className="w-3 h-3 text-white" />
            </motion.span>
          )}
        </motion.button>
        <span
          className={cn(
            'flex-1 transition-all',
            item.checked && 'text-slate-400 line-through'
          )}
        >
          {item.label}
        </span>
      </label>
    ),
  }));

  const handleReorder = (reordered: typeof reorderItems) => {
    const reorderedItems = reordered.map((r) =>
      items.find((item) => item.id === r.id)!
    );
    onChange(reorderedItems);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Reorder.Group
        axis="y"
        values={reorderItems}
        onReorder={handleReorder}
        className="space-y-2"
      >
        {reorderItems.map((item) => (
          <DraggableCard
            key={item.id}
            item={item}
            removable
            onRemove={() => handleRemove(item.id)}
          />
        ))}
      </Reorder.Group>

      {/* Add new item */}
      {onAdd && (
        <div className="flex items-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
          <Plus className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={addPlaceholder}
            className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
          />
          {newItemLabel.trim() && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={handleAdd}
              className="p-1 bg-violet-600 text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Kanban Column (Simple)
// ============================================================================

interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
}

interface KanbanColumnProps {
  title: string;
  items: KanbanItem[];
  onReorder: (items: KanbanItem[]) => void;
  icon?: LucideIcon;
  color?: string;
  className?: string;
}

export function KanbanColumn({
  title,
  items,
  onReorder,
  icon: Icon,
  color = 'bg-slate-100',
  className,
}: KanbanColumnProps) {
  const reorderItems = items.map((item) => ({
    id: item.id,
    content: (
      <div>
        <h4 className="font-medium text-slate-900">{item.title}</h4>
        {item.description && (
          <p className="text-sm text-slate-500 mt-1">{item.description}</p>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    ),
  }));

  const handleReorder = (reordered: typeof reorderItems) => {
    const reorderedItems = reordered.map((r) =>
      items.find((item) => item.id === r.id)!
    );
    onReorder(reorderedItems);
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Column header */}
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-xl', color)}>
        {Icon && <Icon className="w-4 h-4 text-slate-600" />}
        <h3 className="font-medium text-slate-700">{title}</h3>
        <span className="ml-auto text-sm text-slate-500">{items.length}</span>
      </div>

      {/* Items */}
      <div className="flex-1 p-2 bg-slate-50 rounded-b-xl min-h-[200px]">
        <Reorder.Group
          axis="y"
          values={reorderItems}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {reorderItems.map((item) => (
            <DraggableCard key={item.id} item={item} />
          ))}
        </Reorder.Group>
      </div>
    </div>
  );
}
