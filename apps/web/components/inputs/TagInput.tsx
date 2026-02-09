'use client';

/**
 * Tag Input
 * Multi-value input for tags, labels, and chips
 */

import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Tag as TagIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface Tag {
  id: string;
  label: string;
  color?: string;
}

interface TagInputProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  placeholder?: string;
  suggestions?: Tag[];
  maxTags?: number;
  allowCreate?: boolean;
  disabled?: boolean;
  error?: string;
  label?: string;
  className?: string;
  colors?: string[];
}

// ============================================================================
// Default Colors
// ============================================================================

const DEFAULT_COLORS = [
  'bg-slate-100 text-slate-700 border-slate-200',
  'bg-red-100 text-red-700 border-red-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-yellow-100 text-yellow-700 border-yellow-200',
  'bg-lime-100 text-lime-700 border-lime-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-violet-100 text-violet-700 border-cyan-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-violet-100 text-violet-700 border-indigo-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-rose-100 text-rose-700 border-rose-200',
];

// ============================================================================
// Tag Chip Component
// ============================================================================

interface TagChipProps {
  tag: Tag;
  onRemove: () => void;
  disabled?: boolean;
}

function TagChip({ tag, onRemove, disabled }: TagChipProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded-lg border',
        tag.color || 'bg-violet-100 text-violet-700 border-indigo-200'
      )}
    >
      {tag.label}
      {!disabled && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
          className="ml-0.5 p-0.5 rounded hover:bg-black/10 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </motion.span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TagInput({
  value,
  onChange,
  placeholder = 'Add tags...',
  suggestions = [],
  maxTags,
  allowCreate = true,
  disabled = false,
  error,
  label,
  className,
  colors = DEFAULT_COLORS,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter(
    (s) =>
      s.label.toLowerCase().includes(inputValue.toLowerCase()) &&
      !value.some((v) => v.id === s.id)
  );

  // Check if can add more tags
  const canAddMore = !maxTags || value.length < maxTags;

  // Get random color for new tags
  const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

  const addTag = useCallback((tag: Tag) => {
    if (!canAddMore) return;
    
    if (!value.some((v) => v.id === tag.id)) {
      onChange([...value, { ...tag, color: tag.color || getRandomColor() }]);
    }
    setInputValue('');
    setIsOpen(false);
    setSelectedIndex(0);
  }, [value, onChange, canAddMore]);

  const removeTag = useCallback((tagId: string) => {
    onChange(value.filter((t) => t.id !== tagId));
  }, [value, onChange]);

  const createTag = useCallback((label: string) => {
    if (!allowCreate || !label.trim()) return;
    
    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      label: label.trim(),
      color: getRandomColor(),
    };
    addTag(newTag);
  }, [allowCreate, addTag]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const hasValue = inputValue.trim().length > 0;
    
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (filteredSuggestions.length > 0 && selectedIndex < filteredSuggestions.length) {
          const selectedTag = filteredSuggestions[selectedIndex];
          if (selectedTag) addTag(selectedTag);
        } else if (hasValue && allowCreate) {
          createTag(inputValue);
        }
        break;
        
      case 'Backspace':
        if (!hasValue && value.length > 0) {
          const lastTag = value[value.length - 1];
          if (lastTag) removeTag(lastTag.id);
        }
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1));
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
        
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="text-sm font-medium text-slate-700">{label}</label>
      )}
      
      <div
        ref={containerRef}
        className={cn(
          'relative flex flex-wrap items-center gap-2 p-2 min-h-[44px]',
          'bg-white border rounded-xl transition-all',
          error
            ? 'border-red-300 focus-within:ring-2 focus-within:ring-red-500/20'
            : 'border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-violet-500/20',
          disabled && 'bg-slate-50 cursor-not-allowed'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Tags */}
        <AnimatePresence mode="popLayout">
          {value.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              onRemove={() => removeTag(tag.id)}
              disabled={disabled}
            />
          ))}
        </AnimatePresence>

        {/* Input */}
        {canAddMore && !disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
              setSelectedIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] px-1 py-0.5 text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
        )}

        {/* Max tags indicator */}
        {maxTags && (
          <span className="ml-auto text-xs text-slate-400">
            {value.length}/{maxTags}
          </span>
        )}
      </div>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {isOpen && (filteredSuggestions.length > 0 || (inputValue.trim() && allowCreate)) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
            style={{ 
              width: containerRef.current?.offsetWidth,
              left: containerRef.current?.offsetLeft 
            }}
          >
            <div className="max-h-48 overflow-y-auto py-1">
              {/* Existing suggestions */}
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  onClick={() => addTag(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left text-sm',
                    'transition-colors',
                    index === selectedIndex ? 'bg-violet-50' : 'hover:bg-slate-50'
                  )}
                >
                  <div className={cn(
                    'w-3 h-3 rounded-full',
                    suggestion.color?.split(' ')[0] || 'bg-violet-500'
                  )} />
                  <span className="text-slate-700">{suggestion.label}</span>
                  {index === selectedIndex && (
                    <Check className="w-4 h-4 text-violet-600 ml-auto" />
                  )}
                </button>
              ))}

              {/* Create new option */}
              {inputValue.trim() && allowCreate && !filteredSuggestions.some(
                s => s.label.toLowerCase() === inputValue.toLowerCase()
              ) && (
                <button
                  onClick={() => createTag(inputValue)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left text-sm',
                    'transition-colors hover:bg-slate-50',
                    filteredSuggestions.length === 0 && 'bg-violet-50'
                  )}
                >
                  <Plus className="w-4 h-4 text-violet-600" />
                  <span className="text-slate-700">
                    Create &quot;<span className="font-medium">{inputValue.trim()}</span>&quot;
                  </span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// ============================================================================
// Simple Tags Display
// ============================================================================

interface TagsDisplayProps {
  tags: Tag[];
  size?: 'sm' | 'md';
  className?: string;
}

export function TagsDisplay({ tags, size = 'md', className }: TagsDisplayProps) {
  if (tags.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className={cn(
            'inline-flex items-center font-medium rounded-md border',
            tag.color || 'bg-slate-100 text-slate-700 border-slate-200',
            size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
          )}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// Color Picker for Tags
// ============================================================================

interface TagColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  colors?: string[];
}

export function TagColorPicker({
  value,
  onChange,
  colors = DEFAULT_COLORS,
}: TagColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-1.5 p-2">
      {colors.map((color) => {
        const bgColor = color.split(' ')[0];
        const isSelected = value === color;
        
        return (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={cn(
              'w-6 h-6 rounded-full transition-transform',
              bgColor,
              isSelected && 'ring-2 ring-offset-2 ring-slate-400 scale-110'
            )}
          >
            {isSelected && (
              <Check className="w-4 h-4 m-auto text-slate-700" />
            )}
          </button>
        );
      })}
    </div>
  );
}
